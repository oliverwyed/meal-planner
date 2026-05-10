import type { Meal, DietaryMode, KidsMode, SmartPickOpts, CookHistoryEntry } from './types';

const DIETARY_EXCLUDE: Record<string, string[]> = {
  noFish: ['fish', 'seafood'],
  noPork: ['pork'],
  noRed: ['beef', 'lamb', 'pork'],
  veggie: ['chicken', 'beef', 'fish', 'pork', 'lamb', 'seafood'],
};

export function getPool(
  allMeals: Meal[],
  timeFilter: string,
  kids: KidsMode = 'either',
  dietaryMode: DietaryMode = 'none',
): Meal[] {
  const excl = DIETARY_EXCLUDE[dietaryMode] ?? [];
  const limit = timeFilter === 'any' ? Infinity : (parseInt(timeFilter) || Infinity);
  return allMeals.filter(m =>
    m.minutes <= limit &&
    (kids !== 'kids' || !m.adult) &&
    !excl.includes(m.protein)
  );
}

function getCurrentSeason(): string {
  const mo = new Date().getMonth();
  if (mo >= 2 && mo <= 4) return 'spring';
  if (mo >= 5 && mo <= 7) return 'summer';
  if (mo >= 8 && mo <= 10) return 'autumn';
  return 'winter';
}

export function smartPick(pool: Meal[], count: number, opts: SmartPickOpts = {}): Meal[] {
  const { history = [], favourites = [], dislikes = [], preferAdult = false } = opts;
  const season = getCurrentSeason();
  const now = Date.now();

  const usedProtein: Record<string, number> = {};
  const usedCuisine: Record<string, number> = {};
  const usedCarb: Record<string, number> = {};
  const selected: Meal[] = [];

  for (let i = 0; i < count; i++) {
    const remaining = pool.filter(m => !selected.find(s => s.name === m.name));
    if (!remaining.length) break;

    const adj = remaining.map(m => {
      let w = 1.0;

      // History decay — recent meals get penalised
      const entries = history.filter((h: CookHistoryEntry) => h.name === m.name);
      if (entries.length) {
        const lastDate = Math.max(...entries.map((h: CookHistoryEntry) => h.date));
        const daysSince = (now - lastDate) / (1000 * 60 * 60 * 24);
        w *= Math.min(1, daysSince / 21);
      }

      if (favourites.includes(m.name)) w *= 2.5;
      if (dislikes.includes(m.name)) w *= 0.001;
      if (m.seasons?.includes(season as any)) w *= 1.8;
      if (preferAdult && m.kidNote) w *= 0.12;

      // Variety — penalise repeated protein/cuisine/carb
      if (m.protein && usedProtein[m.protein]) w *= Math.pow(0.4, usedProtein[m.protein]);
      if (m.cuisine && usedCuisine[m.cuisine]) w *= Math.pow(0.55, usedCuisine[m.cuisine]);
      if (m.carb && m.carb !== 'none' && usedCarb[m.carb]) w *= Math.pow(0.45, usedCarb[m.carb]);

      return { m, w: Math.max(w, 0.001) };
    });

    const total = adj.reduce((a, x) => a + x.w, 0);
    let rand = Math.random() * total;
    let chosen = adj[adj.length - 1].m;
    for (const x of adj) {
      rand -= x.w;
      if (rand <= 0) { chosen = x.m; break; }
    }

    selected.push(chosen);
    if (chosen.protein) usedProtein[chosen.protein] = (usedProtein[chosen.protein] ?? 0) + 1;
    if (chosen.cuisine) usedCuisine[chosen.cuisine] = (usedCuisine[chosen.cuisine] ?? 0) + 1;
    if (chosen.carb && chosen.carb !== 'none') usedCarb[chosen.carb] = (usedCarb[chosen.carb] ?? 0) + 1;
  }

  return selected;
}
