// redeployed 2026-05-07T00:00:00Z
import Anthropic from 'npm:@anthropic-ai/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

const SYSTEM = `You extract recipe data from a photo of a recipe card, cookbook page, or handwritten recipe. Return ONLY valid JSON matching this exact shape:
{
  "name": string,
  "minutes": number,
  "protein": "chicken"|"beef"|"fish"|"pork"|"lamb"|"seafood"|"eggs"|"veggie",
  "cuisine": "british"|"italian"|"asian"|"mexican"|"indian"|"american"|"middleeastern"|"other",
  "carb": "none"|"pasta"|"rice"|"potato"|"bread"|"noodles",
  "serves": number,
  "adult": boolean,
  "description": string (2 evocative sentences, max 40 words),
  "ingredients": string[] (each: "QTY UNIT ingredient", e.g. "400g pasta" or "2 chicken breasts"),
  "steps": string[] (5-7 concise steps, each with sensory doneness cues),
  "kidNote": string | null,
  "tip": string | null (one chef technique tip, 18-35 words),
  "nutrition": { "calories": number, "protein": number, "carbs": number, "fat": number }
}
If you cannot read a field clearly, use a sensible default. Never return markdown or explanation.`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json() as { imageBase64: string; mediaType: string };

    if (!body.imageBase64) {
      return new Response(JSON.stringify({ error: 'imageBase64 required' }), { status: 400, headers: corsHeaders });
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const mediaType = validTypes.includes(body.mediaType) ? body.mediaType : 'image/jpeg';

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: body.imageBase64,
            },
          },
          { type: 'text', text: 'Extract the recipe from this photo.' },
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
