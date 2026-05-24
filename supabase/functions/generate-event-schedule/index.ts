import Anthropic from 'npm:@anthropic-ai/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

const SYSTEM = `You are an expert chef planning a dinner party cooking schedule for a home cook with a standard kitchen: one oven, one hob with 4 rings, standard equipment.

Given a list of dishes with their cooking steps and a serve time, generate a practical, interleaved cooking timeline. Consider:
- Work backwards from serve time; each dish's start = serveTime minus its total minutes
- Identify genuine parallel opportunities (e.g. prep veg while roast cooks passively, make sauce while pasta boils)
- Flag oven temperature conflicts when dishes need different temps simultaneously
- Add resting time for large proteins (note it in the block)
- Group closely-timed tasks if logical
- Keep actions specific and actionable — what to actually do, not "cook the dish"

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

All times in 24h format. Sort schedule by startTime. Include a final block: mealName "Serve", startTime and endTime both equal to serveTime, action "Plate up and bring to the table".`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { dishes, serveTime, guestCount } = await req.json() as {
      dishes: Array<{ name: string; minutes: number; category: string; steps: string[] }>;
      serveTime: string;
      guestCount: number;
    };

    if (!dishes?.length || !serveTime) {
      return new Response(JSON.stringify({ error: 'dishes and serveTime required' }), { status: 400, headers: corsHeaders });
    }

    const dishSummary = dishes.map(d =>
      `## ${d.name} (${d.category}, ${d.minutes} min)\nSteps:\n${d.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
    ).join('\n\n');

    const prompt = `Serve time: ${serveTime}\nGuests: ${guestCount}\n\n${dishSummary}`;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
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
