import Anthropic from 'npm:@anthropic-ai/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

const SYSTEM = `You are an expert chef planning a dinner party cooking schedule for a home cook with a standard kitchen: one oven, one hob with 4 rings, standard equipment.

You will receive a list of dishes with their total cooking time, description, and ingredients. Produce a practical, interleaved cooking timeline.

Rules:
- Break each dish into phases: active prep, active cooking, passive cooking (oven/simmer/rest)
- Fill passive windows with active tasks from other dishes
- Group related prep into single blocks where sensible
- Flag oven temperature conflicts; note resting time for large proteins
- Keep the action field concise and specific (8–15 words)
- Each block represents ONE focused task. Do not combine unrelated tasks into one block.

For each block include:
- "detail": 1–3 sentences of specific, actionable instructions for exactly what the cook does during this block — not the whole recipe, just this moment
- "blockIngredients": array of ingredient name strings (name only, no quantities) that are specifically needed for this block, taken from the dish's ingredient list. Empty array [] if none or if it's a passive block.

Return ONLY valid JSON, no markdown fences:
{
  "schedule": [
    {
      "startTime": "HH:MM",
      "endTime": "HH:MM",
      "mealName": "dish name exactly as given, or 'Serve' for the final block",
      "action": "concise action, 8-15 words",
      "note": "oven temp / parallel task / null",
      "detail": "1-3 sentences of specific instructions for this exact moment",
      "blockIngredients": ["ingredient name", "another ingredient"]
    }
  ]
}

All times 24h. Sort by startTime. End with mealName "Serve", startTime and endTime both equal to serveTime, action "Plate up and serve", detail "Bring all dishes to the table and serve.", blockIngredients [].`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { dishes, serveTime, guestCount } = await req.json() as {
      dishes: Array<{
        name: string;
        minutes: number;
        category: string;
        steps: string[];
        ingredients?: string[];
        description?: string;
      }>;
      serveTime: string;
      guestCount: number;
    };

    if (!dishes?.length || !serveTime) {
      return new Response(JSON.stringify({ error: 'dishes and serveTime required' }), { status: 400, headers: corsHeaders });
    }

    const dishSummary = dishes.map(d => {
      const lines = [`## ${d.name} (${d.category}, ${d.minutes} min)`];
      if (d.description) lines.push(d.description);
      if (d.ingredients?.length) lines.push(`Ingredients: ${d.ingredients.join(', ')}`);
      return lines.join('\n');
    }).join('\n\n');

    const prompt = `Serve time: ${serveTime}\nGuests: ${guestCount}\nDishes: ${dishes.length}\n\n${dishSummary}`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    });

    const stopReason = (message as any).stop_reason;
    if (stopReason === 'max_tokens') {
      return new Response(
        JSON.stringify({ error: 'Schedule too long to generate. Try removing a dish or two.' }),
        { status: 422, headers: corsHeaders },
      );
    }

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]+\}/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: "Couldn't generate a schedule. Try again." }), { status: 422, headers: corsHeaders });
    }

    const result = JSON.parse(jsonMatch[0]);
    const usage = (message as any).usage;

    return new Response(
      JSON.stringify({ ...result, _usage: usage ? { input_tokens: usage.input_tokens, output_tokens: usage.output_tokens } : undefined }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: `Something went wrong: ${String(err)}` }), { status: 500, headers: corsHeaders });
  }
});
