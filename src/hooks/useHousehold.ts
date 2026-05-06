import { useState, useEffect, useRef, useCallback } from 'react';
import type { HouseholdState, DayName, DayMode, KidsMode, Meal, Plan, PlanMeal, DayConfig, DayOverrides, Preferences } from '../lib/types';
import { DEFAULT_DAY_CONFIG, DAYS } from '../lib/constants';
import { loadState, saveState, saveFamilySize, addCustomMeal, updateCustomMeal, deleteCustomMeal, subscribeToState } from '../lib/supabase';
import { getPool, smartPick } from '../lib/scoring';
import { buildShop } from '../lib/shopping';
import RECIPES from '../data/recipes.json';

const ALL_RECIPES = RECIPES as Meal[];

function getCurrentSeason() {
  const mo = new Date().getMonth();
  if (mo >= 2 && mo <= 4) return 'spring';
  if (mo >= 5 && mo <= 7) return 'summer';
  if (mo >= 8 && mo <= 10) return 'autumn';
  return 'winter';
}

export type AppState = HouseholdState & {
  householdId: string;
  shopList: ReturnType<typeof buildShop> | null;
  season: string;
};

export type AppActions = {
  generate: () => void;
  swap: (day: DayName, extraDislikes?: string[]) => void;
  setDayMode: (day: DayName, mode: DayMode) => void;
  setKidsMode: (day: DayName, mode: KidsMode) => void;
  cycleKids: (day: DayName) => void;
  setFamilySize: (n: number) => void;
  setDaySize: (day: DayName, n: number) => void;
  setDayTime: (day: DayName, tf: string) => void;
  setPreferences: (patch: Partial<Preferences>) => void;
  toggleFav: (name: string) => void;
  addDislike: (name: string) => void;
  addMeal: (meal: Meal) => Promise<void>;
  editMeal: (meal: Meal) => Promise<void>;
  removeMeal: (id: string) => Promise<void>;
  replaceMealInPlan: (day: DayName, meal: Meal) => void;
  restorePlan: (plan: Plan, dayOverrides?: DayOverrides) => void;
  clearHistory: () => void;
  addToHistory: (meals: { name: string }[]) => void;
  pickCookNow: (time: string, kidsMode: KidsMode, dietary: string) => Meal | null;
};

export function useHousehold(householdId: string): { state: AppState; actions: AppActions; loading: boolean } {
  const [loading, setLoading] = useState(true);
  const [hs, setHs] = useState<HouseholdState>({
    plan: null,
    dayConfig: { ...DEFAULT_DAY_CONFIG },
    kidsConfig: {},
    dayOverrides: {},
    familySize: 4,
    preferences: { favourites: [], dislikes: [], pantry: '', dietaryMode: 'none', timeFilter: 'any' },
    cookHistory: [],
    customMeals: [],
  });

  const isRemoteUpdate = useRef(false);

  // Derived
  const allMeals = [...ALL_RECIPES, ...hs.customMeals];
  const season = getCurrentSeason();
  const shopList = hs.plan
    ? buildShop(hs.plan, hs.preferences.pantry, hs.familySize, hs.dayConfig, hs.dayOverrides)
    : null;

  // Load initial state
  useEffect(() => {
    loadState(householdId).then(state => {
      if (state) setHs(state);
      setLoading(false);
    });
  }, [householdId]);

  // Real-time subscription
  useEffect(() => {
    const sub = subscribeToState(householdId, patch => {
      isRemoteUpdate.current = true;
      setHs(prev => ({
        ...prev,
        ...patch,
        plan: patch.plan ?? prev.plan,
        preferences: patch.preferences ?? prev.preferences,
      }));
    });
    return () => { sub.unsubscribe(); };
  }, [householdId]);

  // Persist state changes (debounced, skip remote-triggered updates)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const prevHs = useRef(hs);
  useEffect(() => {
    if (isRemoteUpdate.current) { isRemoteUpdate.current = false; prevHs.current = hs; return; }
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const p = prevHs.current;
      const patch: Partial<Omit<HouseholdState, 'customMeals' | 'familySize'>> = {};
      if (hs.plan !== p.plan)               patch.plan         = hs.plan;
      if (hs.dayConfig !== p.dayConfig)     patch.dayConfig    = hs.dayConfig;
      if (hs.kidsConfig !== p.kidsConfig)   patch.kidsConfig   = hs.kidsConfig;
      if (hs.dayOverrides !== p.dayOverrides) patch.dayOverrides = hs.dayOverrides;
      if (hs.preferences !== p.preferences) patch.preferences  = hs.preferences;
      if (hs.cookHistory !== p.cookHistory) patch.cookHistory  = hs.cookHistory;
      prevHs.current = hs;
      if (Object.keys(patch).length) saveState(householdId, patch);
    }, 400);
    return () => clearTimeout(saveTimer.current);
  }, [householdId, hs]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const getKidsMode = useCallback((day: DayName): KidsMode => {
    return (hs.kidsConfig[day] as KidsMode) ?? 'either';
  }, [hs.kidsConfig]);

  const pool = useCallback((day: DayName, timef?: string) =>
    getPool(allMeals, timef ?? hs.dayOverrides[day]?.time ?? hs.preferences.timeFilter, getKidsMode(day), hs.preferences.dietaryMode),
    [allMeals, hs.dayOverrides, hs.preferences.timeFilter, hs.preferences.dietaryMode, getKidsMode]);

  const smartOpts = useCallback((day: DayName) => ({
    history: hs.cookHistory, favourites: hs.preferences.favourites, dislikes: hs.preferences.dislikes,
    preferAdult: getKidsMode(day) === 'adults',
  }), [hs.cookHistory, hs.preferences.favourites, hs.preferences.dislikes, getKidsMode]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const generate = useCallback(() => {
    const homeDays = DAYS.filter(d => !hs.dayConfig[d] || hs.dayConfig[d] === 'home');
    const selected: PlanMeal[] = [];
    for (const day of homeDays) {
      const p = pool(day).filter(m => !selected.find(s => s.name === m.name));
      const [pick] = smartPick(p.length ? p : pool(day), 1, smartOpts(day));
      if (pick) selected.push({ ...pick, day });
    }
    const newPlan: Plan = { meals: selected, generatedAt: Date.now() };
    const now = Date.now();
    const newHistory = [...hs.cookHistory, ...selected.map(m => ({ name: m.name, date: now }))]
      .filter(h => now - h.date < 60 * 24 * 60 * 60 * 1000);
    setHs(prev => ({ ...prev, plan: newPlan, dayOverrides: {}, cookHistory: newHistory }));
  }, [hs.dayConfig, hs.cookHistory, pool, smartOpts]);

  const swap = useCallback((day: DayName, extraDislikes: string[] = []) => {
    if (!hs.plan) return;
    const allDis = [...hs.preferences.dislikes, ...extraDislikes];
    const used = hs.plan.meals.map(m => m.name);
    const avail = pool(day).filter(m => !used.includes(m.name) && !allDis.includes(m.name));
    const [pick] = smartPick(avail.length ? avail : pool(day), 1, { ...smartOpts(day), dislikes: allDis });
    if (!pick) return;
    setHs(prev => ({
      ...prev,
      plan: { ...prev.plan!, meals: prev.plan!.meals.map(m => m.day === day ? { ...pick, day } : m) },
    }));
  }, [hs.plan, hs.preferences.dislikes, pool, smartOpts]);

  const setDayMode = useCallback((day: DayName, mode: DayMode) => {
    setHs(prev => {
      const newDayConfig: DayConfig = { ...prev.dayConfig, [day]: mode };
      let newPlan = prev.plan;
      if (mode === 'home' && prev.plan && !prev.plan.meals.find(m => m.day === day)) {
        const p = pool(day);
        const used = prev.plan.meals.map(m => m.name);
        const avail = p.filter(m => !used.includes(m.name));
        const [pick] = smartPick(avail.length ? avail : p, 1, smartOpts(day));
        if (pick) newPlan = { ...prev.plan, meals: [...prev.plan.meals, { ...pick, day }] };
      }
      if (mode !== 'home' && prev.plan) {
        newPlan = { ...prev.plan, meals: prev.plan.meals.filter(m => m.day !== day) };
      }
      return { ...prev, dayConfig: newDayConfig, plan: newPlan };
    });
  }, [pool, smartOpts]);

  const setKidsMode = useCallback((day: DayName, mode: KidsMode) => {
    setHs(prev => ({ ...prev, kidsConfig: { ...prev.kidsConfig, [day]: mode } }));
  }, []);

  const cycleKids = useCallback((day: DayName) => {
    const next: Record<KidsMode, KidsMode> = { kids: 'adults', adults: 'either', either: 'kids' };
    setKidsMode(day, next[getKidsMode(day)]);
  }, [getKidsMode, setKidsMode]);

  const setFamilySize = useCallback((n: number) => {
    setHs(prev => ({ ...prev, familySize: n }));
    saveFamilySize(householdId, n);
  }, [householdId]);

  const setDaySize = useCallback((day: DayName, n: number) => {
    setHs(prev => {
      const cur = prev.dayOverrides[day] ?? {};
      const next: DayOverrides = { ...prev.dayOverrides, [day]: { ...cur, size: n === prev.familySize ? undefined : n } };
      if (next[day]?.size === undefined) { const { size: _, ...rest } = next[day] ?? {}; next[day] = Object.keys(rest).length ? rest : undefined as any; if (!next[day]) delete next[day]; }
      return { ...prev, dayOverrides: next };
    });
  }, []);

  const setDayTime = useCallback((day: DayName, tf: string) => {
    setHs(prev => {
      const cur = prev.dayOverrides[day] ?? {};
      const isSameAsGlobal = tf === prev.preferences.timeFilter;
      const next: DayOverrides = { ...prev.dayOverrides, [day]: { ...cur, time: isSameAsGlobal ? undefined : tf } };
      if (next[day]?.time === undefined) { const { time: _, ...rest } = next[day] ?? {}; next[day] = Object.keys(rest).length ? rest : undefined as any; if (!next[day]) delete next[day]; }
      return { ...prev, dayOverrides: next };
    });
  }, []);

  const setPreferences = useCallback((patch: Partial<Preferences>) => {
    setHs(prev => ({ ...prev, preferences: { ...prev.preferences, ...patch } }));
  }, []);

  const toggleFav = useCallback((name: string) => {
    setHs(prev => {
      const isFav = prev.preferences.favourites.includes(name);
      return { ...prev, preferences: { ...prev.preferences, favourites: isFav ? prev.preferences.favourites.filter(f => f !== name) : [...prev.preferences.favourites, name] } };
    });
  }, []);

  const addDislike = useCallback((name: string) => {
    setHs(prev => ({ ...prev, preferences: { ...prev.preferences, dislikes: [...prev.preferences.dislikes, name] } }));
  }, []);

  const addMeal = useCallback(async (meal: Meal) => {
    const saved = await addCustomMeal(householdId, meal);
    if (saved) setHs(prev => ({ ...prev, customMeals: [...prev.customMeals, saved] }));
  }, [householdId]);

  const editMeal = useCallback(async (meal: Meal) => {
    if (!meal.id) return;
    const saved = await updateCustomMeal(meal.id, meal);
    if (saved) setHs(prev => ({ ...prev, customMeals: prev.customMeals.map(m => m.id === meal.id ? saved : m) }));
  }, []);

  const removeMeal = useCallback(async (id: string) => {
    await deleteCustomMeal(id);
    setHs(prev => ({ ...prev, customMeals: prev.customMeals.filter(m => m.id !== id) }));
  }, []);

  const replaceMealInPlan = useCallback((day: DayName, meal: Meal) => {
    setHs(prev => ({
      ...prev,
      plan: prev.plan ? { ...prev.plan, meals: prev.plan.meals.map(m => m.day === day ? { ...meal, day } : m) } : prev.plan,
    }));
  }, []);

  const restorePlan = useCallback((plan: Plan, dayOverrides?: DayOverrides) => {
    setHs(prev => ({ ...prev, plan, ...(dayOverrides !== undefined ? { dayOverrides } : {}) }));
  }, []);

  const clearHistory = useCallback(() => {
    setHs(prev => ({ ...prev, cookHistory: [] }));
  }, []);

  const addToHistory = useCallback((meals: { name: string }[]) => {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    setHs(prev => {
      const newEntries = meals
        .filter(m => !prev.cookHistory.some(h => h.name === m.name && h.date > oneDayAgo))
        .map(m => ({ name: m.name, date: now }));
      if (!newEntries.length) return prev;
      return {
        ...prev,
        cookHistory: [...prev.cookHistory, ...newEntries]
          .filter(h => now - h.date < 60 * 24 * 60 * 60 * 1000),
      };
    });
  }, []);

  const pickCookNow = useCallback((time: string, kidsMode: KidsMode, dietary: string): Meal | null => {
    const p = getPool(allMeals, time, kidsMode, dietary as any);
    const used = hs.plan?.meals.map(m => m.name) ?? [];
    const avail = p.filter(m => !used.includes(m.name) && !hs.preferences.dislikes.includes(m.name));
    const [pick] = smartPick(avail.length ? avail : p, 1, {
      history: hs.cookHistory, favourites: hs.preferences.favourites, dislikes: hs.preferences.dislikes,
      preferAdult: kidsMode === 'adults',
    });
    return pick ?? null;
  }, [allMeals, hs.plan, hs.preferences, hs.cookHistory]);

  return {
    state: { ...hs, householdId, shopList, season },
    actions: { generate, swap, setDayMode, setKidsMode, cycleKids, setFamilySize, setDaySize, setDayTime, setPreferences, toggleFav, addDislike, addMeal, editMeal, removeMeal, replaceMealInPlan, restorePlan, clearHistory, addToHistory, pickCookNow },
    loading,
  };
}
