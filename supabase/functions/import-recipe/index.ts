import Anthropic from 'npm:@anthropic-ai/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

const SYSTEM = `You extract recipe data from HTML or text. Return ONLY valid JSON matching this exact shape:
{
  "name": string,
  "minutes": number,
  "protein": "chicken"|"beef"|"fish"|"pork"|"lamb"|"seafood"|"eggs"|"veggie",
  "cuisine": "british"|"italian"|"asian"|"mexican"|"indian"|"american"|"middleeastern"|"other",
  "carb": "none"|"pasta"|"rice"|"potato"|"bread"|"noodles",
  "serves": number,
  "adult": boolean,
  "description": string (2 evocative sentences),
  "ingredients": string[] (each: "QTY UNIT ingredient", e.g. "400g pasta" or "2 x chicken breasts"),
  "steps": string[] (5-7 steps, each with sensory doneness cues),
  "kidNote": string | null,
  "tip": string | null (one chef technique tip, 18-35 words)
}
If you cannot determine a field, use a sensible default. Never return markdown or explanation.`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { url } = await req.json() as { url: string };
    if (!url) return new Response(JSON.stringify({ error: 'url required' }), { status: 400, headers: corsHeaders });

    // Fetch the page HTML
    let html = '';
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RecipeImporter/1.0)' },
        signal: AbortSignal.timeout(10000),
      });
      html = await res.text();
      // Trim to first 40k chars — Claude doesn't need the whole page
      html = html.slice(0, 40000);
    } catch {
      return new Response(JSON.stringify({ error: 'Could not fetch the page. Try copying the recipe text manually.' }), { status: 422, headers: corsHeaders });
    }

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: SYSTEM,
      messages: [{ role: 'user', content: `Extract the recipe from this page:\n\n${html}` }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]+\}/);
    if (!jsonMatch) return new Response(JSON.stringify({ error: 'No recipe found on that page.' }), { status: 422, headers: corsHeaders });

    const recipe = JSON.parse(jsonMatch[0]);
    recipe.time = `${recipe.minutes} min`;
    recipe.sourceUrl = url;

    return new Response(JSON.stringify(recipe), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
