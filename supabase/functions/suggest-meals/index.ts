// redeployed 2026-05-06T18:37:08Z
import Anthropic from 'npm:@anthropic-ai/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { ingredients, recipes } = await req.json() as {
      ingredients: string;
      recipes: { name: string; ingredients: string[] }[];
    };

    const recipeList = recipes
      .map(r => `- ${r.name}: ${r.ingredients.join(', ')}`)
      .join('\n');

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `I have these ingredients at home: ${ingredients}

From the list below, pick the 4 recipes I could most plausibly make (or nearly make) with what I have. Partial matches are fine — prioritise recipes where I have the main ingredients even if I'm missing a minor one.

Return ONLY a JSON array of recipe names exactly as written. If fewer than 2 are a reasonable match return [].

Recipes:
${recipeList}`,
      }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '[]';
    const match = text.match(/\[[\s\S]*?\]/);
    const names: string[] = match ? JSON.parse(match[0]) : [];

    return new Response(JSON.stringify({ matches: names, _usage: message.usage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: corsHeaders,
    });
  }
});
