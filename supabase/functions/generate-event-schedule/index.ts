import Anthropic from 'npm:@anthropic-ai/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

const SYSTEM = `You are an expert chef planning a dinner party cooking schedule for a home cook with a standard kitchen: one oven, one hob with 4 rings, standard equipment.

You will receive a list of dishes with their ingredients, total cooking time, and optional steps. Your job is to produce a practical, interleaved cooking timeline.

STEP 1 — Analyse each dish:
- Break its total time into realistic phases: active prep (chopping, mixing, marinating), active cooking (frying, stirring, reducing), and passive cooking (oven, long simmer, resting)
- Infer phase durations from the ingredient list and dish type. Examples:
  • A 1.5kg whole chicken with root vegetables → ~15 min prep, ~80 min passive oven, 10 min rest
  • Risotto with arborio rice and stock → ~10 min prep, ~30 min active stirring
  • Pasta bake with béchamel → ~20 min active sauce, ~25 min passive oven
- Passive phases are opportunities to do active work on other dishes

STEP 2 — Build an interleaved schedule working backwards from serve time:
- Fill passive windows with active tasks from other dishes
- Group logically related prep (e.g. all vegetable chopping in one block)
- Flag oven temperature conflicts when simultaneous dishes need different temps
- Note resting time for large proteins
- Every action should be specific and actionable — not "cook the dish"

Return ONLY valid JSON, no markdown:
{
  "schedule": [
    {
      "startTime": "HH:MM",
      "endTime": "HH:MM",
      "mealName": "dish name exactly as given, or 'Serve' for the final block",
      "action": "concise action description, 10-25 words",
      "note": "oven temp, parallel task note, or null"
    }
  ]
}

All times in 24h format. Sort by startTime. End with a final block: mealName "Serve", startTime and endTime both equal to serveTime, action "Plate up and serve".`;

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
      const lines = [`## ${d.name} (${d.category}, ${d.minutes} min total)`];
      if (d.description) lines.push(`Description: ${d.description}`);
      if (d.ingredients?.length) lines.push(`Ingredients (scaled for ${guestCount} guests):\n${d.ingredients.map(i => `- ${i}`).join('\n')}`);
      if (d.steps?.length) lines.push(`Steps:\n${d.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`);
      return lines.join('\n');
    }).join('\n\n');

    const prompt = `Serve time: ${serveTime}\nGuests: ${guestCount}\n\n${dishSummary}`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    });

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
