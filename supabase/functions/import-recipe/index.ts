import Anthropic from 'npm:@anthropic-ai/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

const SYSTEM = `You extract recipe data from structured or plain text. Return ONLY valid JSON matching this exact shape:
{
  "name": string,
  "minutes": number,
  "protein": "chicken"|"beef"|"fish"|"pork"|"lamb"|"seafood"|"eggs"|"veggie",
  "cuisine": "british"|"italian"|"asian"|"mexican"|"indian"|"american"|"middleeastern"|"other",
  "carb": "none"|"pasta"|"rice"|"potato"|"bread"|"noodles",
  "serves": number,
  "adult": boolean,
  "description": string (2 evocative sentences max 40 words),
  "ingredients": string[] (each: "QTY UNIT ingredient", e.g. "400g pasta" or "2 chicken breasts"),
  "steps": string[] (5-7 concise steps, each with sensory doneness cues),
  "kidNote": string | null,
  "tip": string | null (one chef technique tip, 18-35 words)
}
If you cannot determine a field use a sensible default. Never return markdown or explanation.`;

/** Parse ISO 8601 duration like PT30M or PT1H30M into minutes */
function parseDuration(dur: string): number {
  if (!dur) return 30;
  const h = dur.match(/(\d+)H/)?.[1] ?? '0';
  const m = dur.match(/(\d+)M/)?.[1] ?? '0';
  return parseInt(h) * 60 + parseInt(m) || 30;
}

/** Extract Recipe JSON-LD from HTML, returning compact JSON string or null */
function extractJsonLd(html: string): string | null {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]+?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const items: any[] = Array.isArray(parsed)
        ? parsed
        : parsed['@graph']
          ? parsed['@graph']
          : [parsed];
      const recipe = items.find((item: any) => {
        const t = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
        return t.includes('Recipe');
      });
      if (!recipe) continue;

      const steps: string[] = (recipe.recipeInstructions ?? [])
        .map((s: any) => (typeof s === 'string' ? s : s.text ?? ''))
        .filter(Boolean);

      return JSON.stringify({
        name: recipe.name,
        description: recipe.description ?? '',
        totalTime: parseDuration(recipe.totalTime ?? recipe.cookTime ?? ''),
        yield: recipe.recipeYield ?? '4',
        ingredients: recipe.recipeIngredient ?? [],
        steps,
      });
    } catch { /* try next script tag */ }
  }
  return null;
}

/** Strip tags, scripts and excess whitespace — suitable for Claude input */
function cleanHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 28000);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json() as { url?: string; text?: string };

    // Text paste mode — skip fetch entirely
    if (body.text?.trim()) {
      const context = body.text.trim().slice(0, 28000);
      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        system: SYSTEM,
        messages: [{ role: 'user', content: `Extract the recipe from this text:\n\n${context}` }],
      });
      const text = message.content[0].type === 'text' ? message.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]+\}/);
      if (!jsonMatch) return new Response(
        JSON.stringify({ error: 'Could not find a recipe in that text. Make sure you copied the full recipe.' }),
        { status: 422, headers: corsHeaders }
      );
      const recipe = JSON.parse(jsonMatch[0]);
      recipe.time = `${recipe.minutes} min`;
      return new Response(JSON.stringify(recipe), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { url } = body;
    if (!url) return new Response(
      JSON.stringify({ error: 'url or text required' }),
      { status: 400, headers: corsHeaders }
    );

    // Fetch the page
    let html = '';
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-GB,en;q=0.9',
          'Cache-Control': 'no-cache',
        },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) return new Response(
        JSON.stringify({ error: `blocked`, status: res.status }),
        { status: 422, headers: corsHeaders }
      );
      html = await res.text();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Could not reach that page. Check the URL or paste the recipe text instead.' }),
        { status: 422, headers: corsHeaders }
      );
    }

    const context = extractJsonLd(html) ?? cleanHtml(html);

    if (!context.trim()) return new Response(
      JSON.stringify({ error: 'blocked' }),
      { status: 422, headers: corsHeaders }
    );

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: SYSTEM,
      messages: [{ role: 'user', content: `Extract the recipe from this data:\n\n${context}` }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]+\}/);
    if (!jsonMatch) return new Response(
      JSON.stringify({ error: 'No recipe found on that page. Make sure the URL points directly to a recipe.' }),
      { status: 422, headers: corsHeaders }
    );

    const recipe = JSON.parse(jsonMatch[0]);
    recipe.time = `${recipe.minutes} min`;
    recipe.sourceUrl = url;

    return new Response(JSON.stringify(recipe), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Something went wrong: ${String(err)}` }),
      { status: 500, headers: corsHeaders }
    );
  }
});
