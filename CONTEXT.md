# Meal Planner App — Context for New Chat

## What it is
A React 19 + Vite PWA that generates weekly meal plans for households, with real-time multi-user sync via Supabase. Deployed via Vercel.

**Repo:** `oliverwyed/meal-planner`
**Active dev branch:** `v2`
**Vercel deploy branch:** `claude/deploy-vercel-v2-F7pwA` (fully synced with v2)

---

## Tech Stack
- **Frontend:** React 19, TypeScript, Vite 8 — single `src/App.tsx` (1,466 lines) + component files
- **Backend:** Supabase (Postgres + Realtime + Auth + Storage)
- **Deployment:** Vercel (`vercel.json` → `npm run build` → `dist/`)
- **Env vars needed:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

---

## App Structure — 5 Bottom Nav Tabs

| Tab | Screen | Purpose |
|-----|--------|---------|
| Week | `plan` | Generate/view weekly + next-week plan; portions, day modes, kids toggle, plan history |
| Shopping | `shopping` | Aggregated shopping list; tick off items; copy/share |
| Recipes | `browse` | Browse built-in + community meals; filter by protein/cuisine/time; AI suggestion |
| Me | `prefs` | Family size, dietary mode, favourites/dislikes, pantry, invite code, logs, sign out |
| — | `setup` | First-run only — create or join a household |

Plus overlays: cooking mode (step-by-step with timers), recipe detail sheet, photo/URL import, plan history restore, onboarding wizard.

---

## Key Source Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | Main app, all UI state, plan generation, shopping list |
| `src/hooks/useHousehold.ts` | State management, Supabase load/save/subscribe, smartPick meal selection |
| `src/lib/supabase.ts` | All DB operations (households, state, meals, auth, community, reviews) |
| `src/lib/types.ts` | All TypeScript types |
| `src/lib/scoring.ts` | `smartPick()` — weighted meal selection (history, favourites, seasonality) |
| `src/lib/shopping.ts` | Shopping list builder + ingredient scaling |
| `src/lib/timers.ts` | Cooking timer parsing and Web Audio beeps |
| `src/lib/ics.ts` | Calendar export (.ics) |
| `src/data/recipes.json` | ~40+ built-in recipes (175 KB) |
| `src/components/AppUI.tsx` | Shared UI: modals, cards, recipe detail sheet, day toggles |
| `src/components/MealCard.tsx` | Meal cards with nutrition, reviews, swap, cook now |
| `src/components/CookingMode.tsx` | Full-screen cooking interface with wake lock |
| `src/components/HouseholdGate.tsx` | Email OTP auth, create/join household |
| `src/components/ImportRecipe.tsx` | URL-to-recipe import via Supabase Edge Function |
| `src/components/PhotoImport.tsx` | Photo-to-recipe via AI |

---

## Database Schema (6 migrations applied)

| Migration | What it does |
|-----------|-------------|
| `001_initial.sql` | `households`, `household_state`, `custom_meals` tables; RLS; Realtime |
| `002_plan_history.sql` | Adds `plan_history` JSONB column |
| `003_community_reviews.sql` | `community_meals`, `recipe_reviews` tables; recipe-photos storage bucket |
| `004_rls_hardening.sql` | Tightens RLS policies |
| `005_auth_email.sql` | Adds `auth_user_id` to households (email OTP recovery) |
| `006_next_week_plan.sql` | Adds `next_week_plan` JSONB column — already applied to DB |

---

## Known Limitations
- RLS ownership is enforced at the app layer, not DB policies
- Recipe URL import blocks BBC Good Food, AllRecipes, etc. (scraping barriers) — user must paste text
- Email OTP recovery only works for the household creator (not join-by-invite members)
- No explicit TODO/FIXME comments in code

---

## Git State
- Branch `claude/deploy-vercel-v2-F7pwA` is clean, up to date, and pushed
- `v2` is the active development branch with the same content
- All 6 migrations have been applied to the Supabase database
