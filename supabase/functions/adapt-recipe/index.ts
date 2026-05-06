// redeployed 2026-05-06T18:37:08Z
import Anthropic from 'npm:@anthropic-ai/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

const SYSTEM = `You adapt recipes based on a user's request. Return ONLY valid JSON with the same shape as the input recipe, with the requested changes applied. Update name (add a short suffix like "— Dairy-Free" or "— Serves 2"), description, ingredients, steps, and nutrition (re-estimate if needed). Preserve all other fields unchanged. Never return markdown or explanation.`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { recipe, request } = await req.json() as { recipe: unknown; request: string };

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: `Adapt this recipe — ${request}\n\n${JSON.stringify(recipe)}`,
      }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]+\}/);
    if (!jsonMatch) throw new Error('No adapted recipe returned');

    const adapted = JSON.parse(jsonMatch[0]);
    adapted._usage = message.usage;
    return new Response(JSON.stringify(adapted), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: corsHeaders,
    });
  }
});
