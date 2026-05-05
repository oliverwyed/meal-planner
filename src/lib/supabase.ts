import { createClient } from '@supabase/supabase-js';
import type { HouseholdState, Meal } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Household ────────────────────────────────────────────────────────────────

export async function createHousehold(familySize: number): Promise<{ id: string; inviteCode: string } | null> {
  const { data, error } = await supabase
    .from('households')
    .insert({ family_size: familySize })
    .select('id, invite_code')
    .single();
  if (error) { console.error(error); return null; }
  return { id: data.id, inviteCode: data.invite_code };
}

export async function joinHousehold(inviteCode: string): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from('households')
    .select('id')
    .eq('invite_code', inviteCode.trim().toUpperCase())
    .single();
  if (error) { console.error(error); return null; }
  return { id: data.id };
}

// ── State ────────────────────────────────────────────────────────────────────

export async function loadState(householdId: string): Promise<HouseholdState | null> {
  const [stateRes, mealsRes, houseRes] = await Promise.all([
    supabase.from('household_state').select('*').eq('household_id', householdId).single(),
    supabase.from('custom_meals').select('*').eq('household_id', householdId),
    supabase.from('households').select('family_size').eq('id', householdId).single(),
  ]);
  if (stateRes.error) { console.error(stateRes.error); return null; }
  const s = stateRes.data;
  const customMeals: Meal[] = (mealsRes.data ?? []).map((r: any) => ({ ...r.meal_data, id: r.id, sourceUrl: r.source_url }));
  return {
    plan: s.plan ?? null,
    dayConfig: s.day_config ?? {},
    kidsConfig: s.kids_config ?? {},
    dayOverrides: s.day_overrides ?? {},
    familySize: houseRes.data?.family_size ?? 4,
    preferences: s.preferences ?? { favourites: [], dislikes: [], pantry: '', dietaryMode: 'none', timeFilter: 'any' },
    cookHistory: s.cook_history ?? [],
    customMeals,
  };
}

export async function saveState(
  householdId: string,
  patch: Partial<Omit<HouseholdState, 'customMeals' | 'familySize'>>,
): Promise<void> {
  const update: Record<string, any> = {};
  if ('plan' in patch)        update.plan          = patch.plan;
  if ('dayConfig' in patch)   update.day_config    = patch.dayConfig;
  if ('kidsConfig' in patch)  update.kids_config   = patch.kidsConfig;
  if ('dayOverrides' in patch) update.day_overrides = patch.dayOverrides;
  if ('preferences' in patch) update.preferences   = patch.preferences;
  if ('cookHistory' in patch) update.cook_history  = patch.cookHistory;
  if (!Object.keys(update).length) return;
  const { error } = await supabase
    .from('household_state')
    .upsert({ household_id: householdId, ...update }, { onConflict: 'household_id' });
  if (error) console.error(error);
}

export async function saveFamilySize(householdId: string, familySize: number): Promise<void> {
  await supabase.from('households').update({ family_size: familySize }).eq('id', householdId);
}

// ── Custom meals ─────────────────────────────────────────────────────────────

export async function addCustomMeal(householdId: string, meal: Meal): Promise<Meal | null> {
  const { sourceUrl, id: _id, ...mealData } = meal;
  const { data, error } = await supabase
    .from('custom_meals')
    .insert({ household_id: householdId, meal_data: { ...mealData, custom: true }, source_url: sourceUrl ?? null })
    .select('id, meal_data, source_url')
    .single();
  if (error) { console.error(error); return null; }
  return { ...data.meal_data, id: data.id, sourceUrl: data.source_url };
}

export async function deleteCustomMeal(mealId: string): Promise<void> {
  await supabase.from('custom_meals').delete().eq('id', mealId);
}

// ── Real-time ─────────────────────────────────────────────────────────────────

export function subscribeToState(householdId: string, onUpdate: (state: Partial<HouseholdState>) => void) {
  return supabase
    .channel(`household:${householdId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'household_state', filter: `household_id=eq.${householdId}` }, payload => {
      const s = payload.new as any;
      onUpdate({
        plan: s.plan ?? null,
        dayConfig: s.day_config ?? {},
        kidsConfig: s.kids_config ?? {},
        dayOverrides: s.day_overrides ?? {},
        preferences: s.preferences,
        cookHistory: s.cook_history ?? [],
      });
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'custom_meals', filter: `household_id=eq.${householdId}` }, async () => {
      const { data } = await supabase.from('custom_meals').select('*').eq('household_id', householdId);
      const customMeals: Meal[] = (data ?? []).map((r: any) => ({ ...r.meal_data, id: r.id, sourceUrl: r.source_url }));
      onUpdate({ customMeals });
    })
    .subscribe();
}
