import type { Meal, ScaledIngredient, ShopList, Plan, DayConfig, DayOverrides } from './types';

export const CATEGORY_ORDER = [
  'Meat & Fish', 'Dairy & Eggs', 'Frozen', 'Tins & Pantry',
  'Pasta, Rice & Grains', 'Bread & Wraps', 'Fresh Produce',
] as const;

export const CAT_EMOJI: Record<string, string> = {
  'Meat & Fish': '🥩', 'Dairy & Eggs': '🧀', 'Frozen': '🧊',
  'Tins & Pantry': '🥫', 'Pasta, Rice & Grains': '🌾',
  'Bread & Wraps': '🍞', 'Fresh Produce': '🥬',
};

export function categoriseItem(label: string): string {
  const s = label.toLowerCase();
  if (/\bchicken\b|breast|thigh|drumstick|goujon|beef mince|turkey mince|\bpork\b|sausage|\blamb\b|salmon|\bfish\b|prawn|\btuna\b|meatball|bacon|\bham\b/.test(s)) return 'Meat & Fish';
  if (/\bcheese\b|\bmilk\b|\bbutter\b|cream|egg|yoghurt|crème fraîche|mozzarella|parmesan/.test(s)) return 'Dairy & Eggs';
  if (/frozen/.test(s)) return 'Frozen';
  if (/\btin\b|passata|baked bean|stock|coconut milk|chopped tomato|soy sauce|teriyaki|sweet chilli|ketchup|mayo|mayonnaise|mustard|paste|olive oil|vegetable oil|sesame oil|honey|plain flour|mixed herb|oregano|paprika|cumin|coriander|garlic granule|fajita|taco season/.test(s)) return 'Tins & Pantry';
  if (/pasta|penne|spaghetti|fusilli|rigatoni|orzo|macaroni|noodle|\brice\b/.test(s)) return 'Pasta, Rice & Grains';
  if (/bread|tortilla|pitta|naan|pizza base|taco shell|\bwrap\b/.test(s)) return 'Bread & Wraps';
  return 'Fresh Produce';
}

export function scaledIngredients(ingredients: string[], scale: number): ScaledIngredient[] {
  return (ingredients ?? []).map(str => {
    const m = str.match(/^(\d+(?:\.\d+)?)\s*(g|kg|ml|l|tbsp|tsp|x|)\b\s*(.+)$/i);
    if (!m) return { qty: '', label: str, display: str };
    const num = parseFloat(m[1]) * scale;
    const rounded = num % 1 < 0.1 || num % 1 > 0.9 ? Math.round(num) : parseFloat(num.toFixed(1));
    const u = (m[2] ?? '').toLowerCase();
    const label = m[3].trim();
    const sp = ['g', 'kg', 'ml', 'l'].includes(u) ? '' : ' ';
    const display = u ? `${rounded}${sp}${u} ${label}` : `${rounded} ${label}`;
    return { qty: rounded + (u ? sp + u : ''), label, display };
  });
}

export function getCookedNote(label: string, qty: string): string | null {
  const m = (qty ?? '').match(/^([\d.]+)\s*g$/i);
  if (!m) return null;
  const g = parseFloat(m[1]);
  if (/\b(pasta|penne|spaghetti|fusilli|linguine|rigatoni|macaroni|tagliatelle|orzo|shells|farfalle)\b/i.test(label)) return `≈${Math.round(g * 2.5)}g cooked`;
  if (/\brice\b/i.test(label) && !/microwave|arborio/i.test(label)) return `≈${Math.round(g * 3)}g cooked`;
  if (/\bnoodle/i.test(label) && !/microwave|fresh|cooked/i.test(label)) return `≈${Math.round(g * 2.5)}g cooked`;
  return null;
}

function buildCategorised(ingredients: string[], scale: number): ShopList {
  const result: Record<string, ScaledIngredient[]> = {};
  for (const cat of CATEGORY_ORDER) result[cat] = [];
  scaledIngredients(ingredients, scale).forEach(ing => {
    const cat = categoriseItem(ing.label.toLowerCase());
    (result[cat] ?? result['Fresh Produce']).push(ing);
  });
  const out: ShopList = {};
  for (const cat of CATEGORY_ORDER) {
    if (result[cat]?.length) out[cat] = result[cat];
  }
  return out;
}

export function buildMealShop(meal: Meal, scale: number): ShopList {
  return buildCategorised(meal.ingredients ?? [], scale);
}

export function buildEventShop(
  dishes: Array<{ meal: Meal; servings: number }>,
  pantry: string,
): ShopList {
  const pw = (pantry ?? '').toLowerCase().split(/[,\n]/).map(s => s.trim()).filter(Boolean);
  const seen = new Map<string, ScaledIngredient & { category: string }>();
  for (const { meal, servings } of dishes) {
    const scale = servings / (meal.serves ?? 4);
    scaledIngredients(meal.ingredients ?? [], scale).forEach(ing => {
      const lc = ing.label.toLowerCase();
      if (pw.some(w => {
        const re = new RegExp(`(?:^|\\b)${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\b|$)`, 'i');
        return re.test(lc) || re.test(ing.display.toLowerCase());
      })) return;
      if (seen.has(lc)) {
        const ex = seen.get(lc)!;
        const em = ex.qty.match(/^([\d.]+)\s*(g|kg|ml|l|tbsp|tsp|x|)$/i);
        const nm = ing.qty.match(/^([\d.]+)\s*(g|kg|ml|l|tbsp|tsp|x|)$/i);
        if (em && nm && em[2].toLowerCase() === nm[2].toLowerCase()) {
          const tot = parseFloat(em[1]) + parseFloat(nm[1]);
          const rounded = tot % 1 < 0.1 || tot % 1 > 0.9 ? Math.round(tot) : parseFloat(tot.toFixed(1));
          const u = em[2].toLowerCase();
          const sp = ['g', 'kg', 'ml', 'l'].includes(u) ? '' : ' ';
          seen.set(lc, { qty: rounded + (u ? sp + u : ''), label: ing.label, display: u ? `${rounded}${sp}${u} ${ing.label}` : `${rounded} ${ing.label}`, category: categoriseItem(lc) });
        }
        return;
      }
      seen.set(lc, { ...ing, category: categoriseItem(lc) });
    });
  }
  const result: Record<string, ScaledIngredient[]> = {};
  for (const cat of CATEGORY_ORDER) result[cat] = [];
  seen.forEach(item => (result[item.category] ?? result['Fresh Produce']).push(item));
  const out: ShopList = {};
  for (const cat of CATEGORY_ORDER) { if (result[cat]?.length) out[cat] = result[cat]; }
  return out;
}

export function buildShop(
  plan: Plan,
  pantry: string,
  familySize: number,
  dayConfig: DayConfig,
  dayOverrides: DayOverrides,
): ShopList {
  const pw = (pantry ?? '').toLowerCase().split(/[,\n]/).map(s => s.trim()).filter(Boolean);
  const seen = new Map<string, ScaledIngredient & { category: string }>();

  const meals = plan.meals.filter(m => !dayConfig[m.day] || dayConfig[m.day] === 'home');
  meals.forEach(m => {
    const size = dayOverrides[m.day]?.size ?? familySize;
    const scale = size / (m.serves ?? 4);
    scaledIngredients(m.ingredients ?? [], scale).forEach(ing => {
      const lc = ing.label.toLowerCase();
      if (pw.some(w => {
        const re = new RegExp(`(?:^|\\b)${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\b|$)`, 'i');
        return re.test(lc) || re.test(ing.display.toLowerCase());
      })) return;

      if (seen.has(lc)) {
        const ex = seen.get(lc)!;
        const em = ex.qty.match(/^([\d.]+)\s*(g|kg|ml|l|tbsp|tsp|x|)$/i);
        const nm = ing.qty.match(/^([\d.]+)\s*(g|kg|ml|l|tbsp|tsp|x|)$/i);
        if (em && nm && em[2].toLowerCase() === nm[2].toLowerCase()) {
          const tot = parseFloat(em[1]) + parseFloat(nm[1]);
          const rounded = tot % 1 < 0.1 || tot % 1 > 0.9 ? Math.round(tot) : parseFloat(tot.toFixed(1));
          const u = em[2].toLowerCase();
          const sp = ['g', 'kg', 'ml', 'l'].includes(u) ? '' : ' ';
          seen.set(lc, { qty: rounded + (u ? sp + u : ''), label: ing.label, display: u ? `${rounded}${sp}${u} ${ing.label}` : `${rounded} ${ing.label}`, category: categoriseItem(lc) });
        }
        return;
      }
      seen.set(lc, { ...ing, category: categoriseItem(lc) });
    });
  });

  const result: Record<string, ScaledIngredient[]> = {};
  for (const cat of CATEGORY_ORDER) result[cat] = [];
  seen.forEach(item => (result[item.category] ?? result['Fresh Produce']).push(item));
  const out: ShopList = {};
  for (const cat of CATEGORY_ORDER) {
    if (result[cat]?.length) out[cat] = result[cat];
  }
  return out;
}
