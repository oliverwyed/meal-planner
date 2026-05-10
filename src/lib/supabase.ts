import { createClient } from '@supabase/supabase-js';
import type { HouseholdState, Meal, CommunityMeal, RecipeReview } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Household ────────────────────────────────────────────────────────────────────────────

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

// ── Auth (email OTP for recovery) ────────────────────────────────────────────────────

export async function sendLoginOTP(email: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  return { error: error?.message ?? null };
}

export async function verifyLoginOTP(email: string, token: string): Promise<{ userId: string | null; error: string | null }> {
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error || !data.user) return { userId: null, error: error?.message ?? 'Verification failed' };
  return { userId: data.user.id, error: null };
}

export async function getAuthSession(): Promise<{ userId: string; email: string } | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  return { userId: session.user.id, email: session.user.email ?? '' };
}

export async function authSignOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function findHouseholdByAuthUser(userId: string): Promise<string | null> {
  const { data } = await supabase.from('households').select('id').eq('auth_user_id', userId).maybeSingle();
  return data?.id ?? null;
}

export async function linkHouseholdToAuthUser(householdId: string, userId: string): Promise<void> {
  // Only link if the household has no existing auth owner
  await supabase.from('households').update({ auth_user_id: userId }).eq('id', householdId).is('auth_user_id', null);
}

export async function getHouseholdInviteCode(householdId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('households')
    .select('invite_code')
    .eq('id', householdId)
    .single();
  if (error) { console.error(error); return null; }
  return data.invite_code;
}

// ── State ──────────────────────────────────────────────────────────────────────────────

export async function loadState(householdId: string): Promise<HouseholdState | null> {
  const [stateRes, mealsRes, houseRes] = await Promise.all([
    supabase.from('household_state').select('*').eq('household_id', householdId).single(),
    supabase.from('custom_meals').select('*').eq('household_id', householdId),
    supabase.from('households').select('family_size').eq('id', householdId).single(),
  ]);
  if (stateRes.error) { console.error(stateRes.error); return null; }
  const s = stateRes.data;
  const customMeals: Meal[] = (mealsRes.data ?? []).map((r: any) => ({ ...r.meal_data, id: r.id, sourceUrl: r.source_url }));
  const rawPlan = s.plan ?? null;
  const { shopChecked: loadedChecked, ...cleanPlan } = rawPlan ?? {};
  return {
    plan: rawPlan ? (cleanPlan as import('./types').Plan) : null,
    planHistory: s.plan_history ?? [],
    dayConfig: s.day_config ?? {},
    kidsConfig: s.kids_config ?? {},
    dayOverrides: s.day_overrides ?? {},
    familySize: houseRes.data?.family_size ?? 4,
    preferences: s.preferences ?? { favourites: [], dislikes: [], pantry: '', dietaryMode: 'none', timeFilter: 'any' },
    cookHistory: s.cook_history ?? [],
    customMeals,
    shopChecked: (loadedChecked as Record<string, boolean>) ?? {},
  };
}

export async function saveState(
  householdId: string,
  patch: Partial<Omit<HouseholdState, 'customMeals' | 'familySize'>>,
): Promise<void> {
  const update: Record<string, any> = {};
  if ('plan' in patch)        update.plan          = patch.plan;
  if ('planHistory' in patch) update.plan_history  = patch.planHistory;
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

// ── Custom meals ───────────────────────────────────────────────────────────────────────

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

export async function updateCustomMeal(mealId: string, meal: Meal): Promise<Meal | null> {
  const { sourceUrl, id: _id, ...mealData } = meal;
  const { data, error } = await supabase
    .from('custom_meals')
    .update({ meal_data: { ...mealData, custom: true }, source_url: sourceUrl ?? null })
    .eq('id', mealId)
    .select('id, meal_data, source_url')
    .single();
  if (error) { console.error(error); return null; }
  return { ...data.meal_data, id: data.id, sourceUrl: data.source_url };
}

export async function deleteCustomMeal(mealId: string): Promise<void> {
  await supabase.from('custom_meals').delete().eq('id', mealId);
}

// ── Real-time ─────────────────────────────────────────────────────────────────────────────

export function subscribeToState(householdId: string, onUpdate: (state: Partial<HouseholdState>) => void) {
  return supabase
    .channel(`household:${householdId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'household_state', filter: `household_id=eq.${householdId}` }, payload => {
      const s = payload.new as any;
      const rawPlan = s.plan ?? null;
      const { shopChecked: remoteChecked, ...cleanPlan } = rawPlan ?? {};
      onUpdate({
        plan: rawPlan ? cleanPlan : null,
        planHistory: s.plan_history ?? [],
        dayConfig: s.day_config ?? {},
        kidsConfig: s.kids_config ?? {},
        dayOverrides: s.day_overrides ?? {},
        preferences: s.preferences,
        cookHistory: s.cook_history ?? [],
        shopChecked: (remoteChecked as Record<string, boolean>) ?? {},
      });
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'custom_meals', filter: `household_id=eq.${householdId}` }, async () => {
      const { data } = await supabase.from('custom_meals').select('*').eq('household_id', householdId);
      const customMeals: Meal[] = (data ?? []).map((r: any) => ({ ...r.meal_data, id: r.id, sourceUrl: r.source_url }));
      onUpdate({ customMeals });
    })
    .subscribe();
}

// ── Community meals ─────────────────────────────────────────────────────────────────────────

export async function loadCommunityMeals(): Promise<CommunityMeal[]> {
  const { data, error } = await supabase
    .from('community_meals')
    .select('*')
    .order('published_at', { ascending: false });
  if (error) { console.error(error); return []; }
  return (data ?? []).map((r: any) => ({
    ...r.meal_data,
    communityId: r.id,
    sourceHouseholdId: r.source_household_id,
    publishedAt: new Date(r.published_at).getTime(),
    sourceUrl: r.source_url,
    photo: r.photo_url ?? r.meal_data?.photo,
    custom: true,
  }));
}

export async function publishMeal(
  householdId: string,
  meal: Meal,
): Promise<CommunityMeal | null> {
  const { sourceUrl, id: _id, communityId: _cid, ...mealData } = meal as any;
  const { data, error } = await supabase
    .from('community_meals')
    .insert({
      meal_data: { ...mealData, custom: true },
      source_url: sourceUrl ?? null,
      photo_url: meal.photo ?? null,
      source_household_id: householdId,
    })
    .select('*')
    .single();
  if (error) { console.error(error); return null; }
  return {
    ...data.meal_data,
    communityId: data.id,
    sourceHouseholdId: data.source_household_id,
    publishedAt: new Date(data.published_at).getTime(),
    sourceUrl: data.source_url,
    photo: data.photo_url ?? data.meal_data?.photo,
    custom: true,
  };
}

export async function unpublishMeal(communityId: string, householdId: string): Promise<void> {
  await supabase.from('community_meals').delete()
    .eq('id', communityId)
    .eq('source_household_id', householdId);
}

export async function uploadRecipePhoto(file: File): Promise<string | null> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from('recipe-photos').upload(path, file, { upsert: false });
  if (error) { console.error(error); return null; }
  const { data } = supabase.storage.from('recipe-photos').getPublicUrl(path);
  return data.publicUrl;
}

// ── Reviews ─────────────────────────────────────────────────────────────────────────────

export async function loadReviews(recipeName: string): Promise<RecipeReview[]> {
  const { data, error } = await supabase
    .from('recipe_reviews')
    .select('*')
    .eq('recipe_name', recipeName)
    .order('created_at', { ascending: false });
  if (error) { console.error(error); return []; }
  return (data ?? []).map((r: any) => ({
    id: r.id,
    recipeName: r.recipe_name,
    stars: r.stars,
    comment: r.comment ?? undefined,
    createdAt: new Date(r.created_at).getTime(),
  }));
}

export async function addReview(
  householdId: string,
  recipeName: string,
  stars: number,
  comment: string,
): Promise<RecipeReview | null> {
  const { data, error } = await supabase
    .from('recipe_reviews')
    .insert({ household_id: householdId, recipe_name: recipeName, stars, comment: comment.trim() || null })
    .select('*')
    .single();
  if (error) { console.error(error); return null; }
  return {
    id: data.id,
    recipeName: data.recipe_name,
    stars: data.stars,
    comment: data.comment ?? undefined,
    createdAt: new Date(data.created_at).getTime(),
  };
}

export async function deleteReview(reviewId: string, householdId: string): Promise<void> {
  await supabase.from('recipe_reviews').delete()
    .eq('id', reviewId)
    .eq('household_id', householdId);
}
