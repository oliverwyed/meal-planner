// @version 2
import Anthropic from 'npm:@anthropic-ai/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

const SYSTEM = `You are a menu planner for dinner parties and gatherings. Given a natural-language event description and a recipe library, select the most appropriate dishes to create a balanced, cohesive menu.

Rules:
- Pick recipes ONLY from the provided library — use exact recipe names as listed
- Aim for a balanced menu appropriate for the event style:
  • BBQ / outdoor → grilled/smoky mains, sharing sides, summery desserts, minimal formal starters
  • Dinner party → 1 starter, 1–2 mains, 2–3 sides, 1 dessert
  • Sunday lunch → 1 main showstopper, 2–3 sides, 1 dessert
  • Indian / themed feast → 1–2 sharing starters, 2–3 mains, rice/bread sides, 1 dessert
  • Christmas → 1 starter, 1 main centrepiece, 3–4 sides, 1–2 desserts
  • Casual supper → 1–2 mains, 1–2 sides
- Respect any dietary constraints mentioned (vegetarian, no fish, etc.)
- Assign the correct category for each dish: starter, main, side, dessert, drinks, other
- Write a brief, evocative concept line (1 sentence, max 20 words)
- Select 4–10 dishes total; fewer is better than padding with irrelevant dishes

Return ONLY valid JSON, no markdown fences, no extra text:
{
  "concept": "A relaxed summer BBQ…",
  "dishes": [
    {"name": "exact recipe name from the library", "category": "starter|main|side|dessert|drinks|other"}
  ]
}`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { prompt, guestCount, recipes } = await req.json() as {
      prompt: string;
      guestCount: number;
      recipes: Array<{ name: string; course: string; cuisine: string; protein: string; description: string; time: string }>;
    };

    if (!prompt?.trim() || !recipes?.length) {
      return new Response(JSON.stringify({ error: 'prompt and recipes required' }), { status: 400, headers: corsHeaders });
    }

    const libraryStr = recipes
      .map(r => `- ${r.name} [${r.course ?? 'main'}, ${r.cuisine}, ${r.protein}, ${r.time}]: ${r.description}`)
      .join('\n');

    const userPrompt = `Event: ${prompt}\nGuests: ${guestCount}\n\nAvailable recipes:\n${libraryStr}`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]+\}/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: "Couldn't generate a menu suggestion. Try again." }), { status: 422, headers: corsHeaders });
    }

    const result = JSON.parse(jsonMatch[0]);
    const usage = (message as any).usage;

    return new Response(
      JSON.stringify({
        ...result,
        _usage: usage ? { input_tokens: usage.input_tokens, output_tokens: usage.output_tokens } : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Something went wrong: ${String(err)}` }),
      { status: 500, headers: corsHeaders },
    );
  }
});
