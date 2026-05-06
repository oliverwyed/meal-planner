import Anthropic from 'npm:@anthropic-ai/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

const SYSTEM = `You are a nutritionist. Given recipe ingredients and serves, estimate the nutrition PER SERVING. Return ONLY valid JSON: { "calories": number, "protein": number, "carbs": number, "fat": number }. Round to nearest integer. Never return markdown.`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json() as { ingredients: string[]; serves: number; name: string };
    const { ingredients, serves, name } = body;

    if (!ingredients || ingredients.length === 0) {
      return new Response(
        JSON.stringify({ error: 'ingredients required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: `Recipe: ${name}\nServes: ${serves}\nIngredients:\n${ingredients.join('\n')}\n\nEstimate nutrition per serving.`,
      }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]+\}/);
    if (!jsonMatch) {
      return new Response(
        JSON.stringify({ error: 'Could not estimate nutrition' }),
        { status: 422, headers: corsHeaders }
      );
    }

    const nutrition = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(nutrition), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Something went wrong: ${String(err)}` }),
      { status: 500, headers: corsHeaders }
    );
  }
});
