# Technical Debt & Known Issues

Issues identified during code review (May 2026). Ranked by priority.

---

## High Priority

### 1. App.tsx is a 1,700-line monolith
All five screens (Plan, Shopping, Browse, Prefs, Events) render inline in one component
with 40+ state variables. Every new feature adds more clutter and slows development.
**Fix:** Extract each screen into its own component (`PlanScreen`, `ShoppingScreen`,
`BrowseScreen`, `PrefsScreen`). Events already done correctly.

### 2. buildShop / buildEventShop duplication
`buildEventShop` is a near-verbatim copy of `buildShop` (the ingredient aggregation
loop, pantry filtering, and unit merging are identical). A bug fix to one won't reach
the other.
**Fix:** Extract a shared `aggregateIngredients(batches, pantry)` core function.

### 3. Race condition in loadState
`loadState()` has no abort controller. If `householdId` changes while the initial fetch
is in flight (e.g. logout/login sequence), the old promise resolves and writes stale
state from the wrong household.
**Fix:** Pass an `AbortSignal` into `loadState` and clean up in a `useEffect` return.

---

## Medium Priority

### 4. Derived state not memoized in useHousehold
`buildShop()` is O(n×m) and runs 3× per render (this week, next week, both) without
`useMemo`. The pantry input field triggers this on every keystroke.
**Fix:** Wrap `shopList`, `nextWeekShopList`, `bothShopList`, and `allMeals` in `useMemo`.

### 5. Real-time sync is last-write-wins across entire row
Two household members editing simultaneously will silently overwrite each other because
the Supabase subscription patches the whole state object. Not currently a real problem
(mostly single-user households) but will be if multi-user is pushed.
**Fix:** Per-field timestamps or move to a CRDT merge strategy.

### 6. TypeScript `any` at Supabase boundaries
`custom_meals` and `household_state` rows are typed as `any` in supabase.ts. Schema
drift won't surface at compile time.
**Fix:** Define `CustomMealRow` and `HouseholdStateRow` interfaces matching the DB schema.

### 7. Ingredient parser drops non-metric quantities
The regex `^(\d+(?:\.\d+)?)\s*(g|kg|ml|l|tbsp|tsp|x|)` silently falls back to
displaying the raw string for anything it can't parse (fractions, "cups", "handful").
Shopping list aggregation fails to combine e.g. "2 cups flour" + "1 cup flour".
**Fix:** Extend the regex or add a pre-normalisation pass for common non-metric units.

---

## Low Priority

### 8. Service worker cache version build step is fragile
`vite.config.ts` uses sync `readFileSync`/`writeFileSync` to stamp `__BUILD_TS__` into
`dist/sw.js` after the bundle. Fails silently if the file doesn't exist yet.
**Fix:** Use a Vite virtual module or `define` to inject the timestamp at transform time.

### 9. Cook history filtered twice
`addToHistory()` and `generate()` both run the same 60-day filter on `cookHistory`.
Redundant — one of them can be removed.
