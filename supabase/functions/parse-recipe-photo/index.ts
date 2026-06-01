// redeployed 2026-05-21T00:00:00Z
import Anthropic from 'npm:@anthropic-ai/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

const SYSTEM = `You extract recipe data from one or more photos of a recipe card, cookbook page, or handwritten recipe. The photos may show different pages or sections of the same recipe.

CRITICAL RULES — read these before extracting anything:
- Only extract what you can actually read in the image. NEVER invent, infer, or substitute ingredients, steps, or quantities.
- If an ingredient name is partially obscured or unclear, omit it entirely rather than guessing.
- Ingredient names must be copied exactly as written — do not substitute trade names, brand names, or "equivalent" products (e.g. if it says "peri peri spice mix", do not write "peri peri sauce").
- If you cannot determine a numeric field, use a reasonable structural default (e.g. minutes=30, serves=4) — never invent ingredients or steps to fill space.
- Steps must reflect only what is written in the recipe. Do not add steps that aren't there.

Return ONLY valid JSON matching this exact shape, no markdown, no explanation:
{
  "name": string,
  "minutes": number,
  "protein": "chicken"|"beef"|"fish"|"pork"|"lamb"|"seafood"|"eggs"|"veggie",
  "cuisine": "british"|"italian"|"french"|"asian"|"mexican"|"indian"|"american"|"middleeastern"|"other",
  "carb": "none"|"pasta"|"rice"|"potato"|"bread"|"noodles",
  "serves": number,
  "adult": boolean,
  "description": string (2 evocative sentences describing the dish, max 40 words),
  "ingredients": string[] (each exactly as written: "QTY UNIT ingredient" — copy ingredient names verbatim from the image),
  "steps": string[] (the steps as written, condensed to 5-7 items, each with sensory doneness cues where visible),
  "kidNote": string | null,
  "tip": string | null (one chef technique tip if present in the recipe, 18-35 words),
  "nutrition": { "calories": number, "protein": number, "carbs": number, "fat": number }
}`;

const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

type ImageInput = { imageBase64: string; mediaType: string };

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json() as { images?: ImageInput[]; imageBase64?: string; mediaType?: string };

    // Normalise: accept either `images` array or legacy single `imageBase64`
    let images: ImageInput[];
    if (body.images && Array.isArray(body.images) && body.images.length > 0) {
      images = body.images;
    } else if (body.imageBase64) {
      images = [{ imageBase64: body.imageBase64, mediaType: body.mediaType ?? 'image/jpeg' }];
    } else {
      return new Response(JSON.stringify({ error: 'images array or imageBase64 required' }), { status: 400, headers: corsHeaders });
    }

    const imageBlocks = images.map(img => ({
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: (validTypes.includes(img.mediaType) ? img.mediaType : 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
        data: img.imageBase64,
      },
    }));

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: [
          ...imageBlocks,
          { type: 'text', text: images.length > 1 ? 'Extract the recipe from these photos. They may show different parts of the same recipe — combine them into one complete recipe.' : 'Extract the recipe from this photo.' },
        ],
      }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]+\}/);
    if (!jsonMatch) {
      return new Response(
        JSON.stringify({ error: "Couldn't find a recipe in that photo. Try a clearer image with the full recipe visible." }),
        { status: 422, headers: corsHeaders },
      );
    }

    const recipe = JSON.parse(jsonMatch[0]);
    recipe.time = `${recipe.minutes} min`;
    recipe.custom = true;

    const usage = (message as any).usage;
    if (usage) {
      return new Response(JSON.stringify({ ...recipe, _usage: { input_tokens: usage.input_tokens, output_tokens: usage.output_tokens } }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(recipe), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Something went wrong: ${String(err)}` }),
      { status: 500, headers: corsHeaders },
    );
  }
});
