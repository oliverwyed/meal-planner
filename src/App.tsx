import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HouseholdGate } from './components/HouseholdGate';
import { MealCard } from './components/MealCard';
import { CookingMode } from './components/CookingMode';
import { ImportRecipe } from './components/ImportRecipe';
import { PhotoImport } from './components/PhotoImport';
import { Primary, Secondary, Toast, Spinner, Section, TimeSlider, ActiveTimers, BottomNav } from './components/ui';
import { Screen, Header, IconBtn, Row, Stepper, Chip, DayActions, DayToggle, Modal, MealPicker, AddMealForm, HelpModal, BrowseMealCard, RecipeDetailSheet, LogsPanel, formatLastUsed, SEASON_INFO } from './components/AppUI';
import { useHousehold } from './hooks/useHousehold';
import { DAYS, HOUSEHOLD_ID_KEY, P, DESKTOP_BREAKPOINT } from './lib/constants';
import type { DayName, DayMode, KidsMode, Meal, CommunityMeal, RecipeReview } from './lib/types';
import { playBeep } from './lib/timers';
import { CAT_EMOJI } from './lib/shopping';
import { log, logFetch, recordCost } from './lib/logger';
import { downloadICS } from './lib/ics';
import { loadCommunityMeals, publishMeal, unpublishMeal, uploadRecipePhoto, loadReviews, addReview, deleteReview, getHouseholdInviteCode, authSignOut } from './lib/supabase';
import RECIPES from './data/recipes.json';

const ALL_RECIPES = RECIPES as Meal[];

type Step = 'setup' | 'plan' | 'shopping' | 'prefs' | 'browse';

export default function App() {
  const [householdId, setHouseholdId] = useState<string | null>(() => localStorage.getItem(HOUSEHOLD_ID_KEY));

  if (!householdId) {
    return <HouseholdGate onReady={id => { localStorage.setItem(HOUSEHOLD_ID_KEY, id); setHouseholdId(id); }} />;
  }
  return <AppInner householdId={householdId} onLeave={() => { localStorage.removeItem(HOUSEHOLD_ID_KEY); setHouseholdId(null); authSignOut(); }} />;
}

function AppInner({ householdId, onLeave }: { householdId: string; onLeave: () => void }) {
  const { state, actions, loading } = useHousehold(householdId);
  const [step, setStep] = useState<Step>('setup');
  const [previewDay, setPreviewDay] = useState<DayName | null>(null);
  const [expandedDay, setExpandedDay] = useState<DayName | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<DayName | 'cookNow' | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [addMealOpen, setAddMealOpen] = useState(false);
  const [editMealTarget, setEditMealTarget] = useState<Meal | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(() => localStorage.getItem('hintDismissed') === '1');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPlanHistory, setShowPlanHistory] = useState(false);
  const [isFirstRun, setIsFirstRun] = useState(() => !localStorage.getItem('onboardingDone'));
  const [onboardStep, setOnboardStep] = useState<1 | 2 | 3>(1);
  const [pantryDraft, setPantryDraft] = useState(state.preferences.pantry);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toastUndoRef = useRef<(() => void) | null>(null);
  const [cookNow, setCookNow] = useState<Meal | null>(null);
  const [cookNowExp, setCookNowExp] = useState(false);
  const [cookNowAddToPlan, setCookNowAddToPlan] = useState(false);
  const [cookNowOpts, setCookNowOpts] = useState<{ kids: string; size: number; time: string; dietary: string }>({
    kids: 'either', size: 4, time: 'any', dietary: 'none',
  });
  const [timers, setTimers] = useState<{ id: string; label: string; remaining: number; total: number; done: boolean }[]>([]);
  const [nutritionCache, setNutritionCache] = useState<Record<string, { calories: number; protein: number; carbs: number; fat: number }>>({});
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= DESKTOP_BREAKPOINT);
  const [cookingMeal, setCookingMeal] = useState<{ meal: Meal; familySize: number } | null>(null);

  // Find-a-recipe modal tabs
  const [findRecipeTab, setFindRecipeTab] = useState<'suggest' | 'fridge'>('suggest');
  const [fridgeQuery, setFridgeQuery] = useState('');
  const [fridgeLoading, setFridgeLoading] = useState(false);
  const [fridgeMatches, setFridgeMatches] = useState<Meal[] | null>(null);
  const [fridgeAI, setFridgeAI] = useState(false);

  const showToast = useCallback((msg: string, undo?: () => void) => {
    setToast(msg);
    toastUndoRef.current = undo ?? null;
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => { setToast(null); toastUndoRef.current = null; }, 2500);
  }, []);

  const addTimer = useCallback((label: string, seconds: number) => {
    const id = `${Date.now()}-${Math.random()}`;
    setTimers(prev => [...prev, { id, label, remaining: seconds, total: seconds, done: false }]);
  }, []);

  const dismissTimer = useCallback((id: string) => {
    setTimers(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    const hasActive = timers.some(t => !t.done);
    if (!hasActive) return;
    const interval = setInterval(() => {
      setTimers(prev => prev.map(t => {
        if (t.done) return t;
        const remaining = t.remaining - 1;
        if (remaining <= 0) {
          playBeep();
          return { ...t, remaining: 0, done: true };
        }
        return { ...t, remaining };
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, [timers]);

  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const [nutritionLoading, setNutritionLoading] = useState<Set<string>>(new Set());

  // Browse screen state
  const [browseQuery, setBrowseQuery] = useState('');
  const [browseProtein, setBrowseProtein] = useState('');
  const [browseCuisine, setBrowseCuisine] = useState('');
  const [browseTime, setBrowseTime] = useState('');
  const [browseAddDay, setBrowseAddDay] = useState<Meal | null>(null);
  const [browseDetailMeal, setBrowseDetailMeal] = useState<Meal | null>(null);
  const [browseAIOpen, setBrowseAIOpen] = useState(false);
  const [planDetailMeal, setPlanDetailMeal] = useState<{ meal: Meal; daySize: number } | null>(null);
  const [browseTab, setBrowseTab] = useState<'all' | 'community'>('all');
  const [planWeek, setPlanWeek] = useState<'this' | 'next'>('this');
  const [shopWeek, setShopWeek] = useState<'this' | 'next' | 'both'>('this');

  // Rollover: show banner when current plan predates this Monday
  const [showRollover, setShowRollover] = useState(false);
  useEffect(() => {
    if (!state.plan || !state.nextWeekPlan) { setShowRollover(false); return; }
    const now = new Date();
    const dow = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
    monday.setHours(0, 0, 0, 0);
    setShowRollover(state.plan.generatedAt < monday.getTime());
  }, [state.plan, state.nextWeekPlan]);

  // Community meals
  const [communityMeals, setCommunityMeals] = useState<CommunityMeal[]>([]);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  // map custom meal id → communityId (if published)
  const [publishedMap, setPublishedMap] = useState<Record<string, string>>({});

  // Reviews: cache by recipe name
  const [reviewsCache, setReviewsCache] = useState<Record<string, RecipeReview[]>>({});
  const [reviewsLoadingSet, setReviewsLoadingSet] = useState<Set<string>>(new Set());
  // track which review id belongs to this household per recipe
  const [myReviews, setMyReviews] = useState<Record<string, string>>({});

  // Photo import
  const [showPhotoImport, setShowPhotoImport] = useState(false);

  const estimateNutrition = useCallback(async (meal: Meal) => {
    if (meal.nutrition || nutritionCache[meal.name] || nutritionLoading.has(meal.name)) return;
    setNutritionLoading(prev => new Set(prev).add(meal.name));
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const res = await logFetch('get-nutrition', `${supabaseUrl}/functions/v1/get-nutrition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
        body: JSON.stringify({ ingredients: meal.ingredients, serves: meal.serves, name: meal.name }),
      });
      if (!res.ok) { showToast('Could not estimate nutrition'); return; }
      const data = await res.json();
      if (data.error) { log.error('get-nutrition', 'API error', { error: data.error }); showToast('Could not estimate nutrition'); return; }
      if (data._usage) recordCost('get-nutrition', data._usage.input_tokens, data._usage.output_tokens);
      const { _usage: _u1, ...nutrition } = data;
      setNutritionCache(prev => ({ ...prev, [meal.name]: nutrition }));
      // Persist into plan meal so it survives page reload
      const planMeal = state.plan?.meals.find(m => m.name === meal.name);
      if (planMeal) actions.replaceMealInPlan(planMeal.day, { ...planMeal, nutrition });
      // Persist into custom meal record
      if (meal.id && meal.custom) actions.editMeal({ ...meal, nutrition });
    } catch (err) {
      log.error('get-nutrition', 'Unexpected error', { err: String(err) });
      showToast('Could not estimate nutrition');
    } finally {
      setNutritionLoading(prev => { const n = new Set(prev); n.delete(meal.name); return n; });
    }
  }, [nutritionCache, nutritionLoading, showToast, state.plan, actions.replaceMealInPlan, actions.editMeal]);

  const keywordMatchFridge = useCallback((query: string, allMeals: Meal[]): Meal[] => {
    const STOPWORDS = new Set(['a', 'an', 'the', 'of', 'with', 'and', 'or', 'some', 'fresh', 'dried',
      'large', 'small', 'medium', 'big', 'whole', 'sliced', 'chopped', 'diced', 'minced', 'grated',
      'cooked', 'raw', 'frozen', 'canned', 'tin', 'bag', 'bunch', 'handful', 'tbsp', 'tsp', 'g', 'kg', 'ml']);
    const tokens = query.toLowerCase()
      .split(/[\s,]+/)
      .map(t => t.replace(/[^a-z]/g, ''))
      .filter(t => t.length > 2 && !STOPWORDS.has(t));
    if (tokens.length === 0) return [];
    return allMeals
      .map(meal => {
        const ingText = (meal.ingredients ?? []).join(' ').toLowerCase();
        const hits = tokens.filter(t => ingText.includes(t)).length;
        return { meal, hits };
      })
      .filter(s => s.hits > 0)
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 5)
      .map(s => s.meal);
  }, []);

  const searchFridge = useCallback(async (query: string) => {
    const allMeals = ALL_RECIPES.concat(state.customMeals);
    setFridgeLoading(true);
    setFridgeMatches(null);
    setFridgeAI(false);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const res = await logFetch('suggest-meals', `${supabaseUrl}/functions/v1/suggest-meals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
        body: JSON.stringify({
          ingredients: query,
          recipes: allMeals.map(m => ({ name: m.name, ingredients: m.ingredients ?? [] })),
        }),
        signal: AbortSignal.timeout(12000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data._usage) recordCost('suggest-meals', data._usage.input_tokens, data._usage.output_tokens);
        const names: string[] = data.matches ?? [];
        const matches = names.map(n => allMeals.find(m => m.name === n)).filter(Boolean) as Meal[];
        if (matches.length > 0) {
          setFridgeMatches(matches);
          setFridgeAI(true);
          setFridgeLoading(false);
          return;
        }
        log.warn('suggest-meals', 'AI returned empty matches, falling back to keyword');
      }
    } catch (err) {
      log.error('suggest-meals', 'Fetch failed, falling back to keyword', { err: String(err) });
    }
    // Fallback: client-side keyword matching
    log.info('suggest-meals', 'Using keyword fallback');
    setFridgeMatches(keywordMatchFridge(query, allMeals));
    setFridgeLoading(false);
  }, [state.customMeals, keywordMatchFridge]);

  const adaptRecipe = useCallback(async (meal: Meal, request: string): Promise<Meal> => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    log.info('adapt-recipe', `Adapting "${meal.name}"`, { request });
    const res = await logFetch('adapt-recipe', `${supabaseUrl}/functions/v1/adapt-recipe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
      body: JSON.stringify({ recipe: meal, request }),
    });
    if (!res.ok) throw new Error(`Adaptation failed (${res.status})`);
    const adapted = await res.json();
    if (adapted.error) { log.error('adapt-recipe', adapted.error); throw new Error(adapted.error); }
    if (adapted._usage) recordCost('adapt-recipe', adapted._usage.input_tokens, adapted._usage.output_tokens);
    const { _usage: _u2, ...adaptedMeal } = adapted;
    log.info('adapt-recipe', `Success → "${adaptedMeal.name}"`);
    return adaptedMeal as Meal;
  }, []);

  const rePick = useCallback((opts?: { time: string; kids: string; dietary: string }) => {
    const o = opts ?? cookNowOpts;
    const meal = actions.pickCookNow(o.time, o.kids as any, o.dietary);
    if (meal) { setCookNow(meal); setCookNowExp(true); }
    else showToast('No meals match — try relaxing your filters');
  }, [cookNowOpts, actions, showToast]);

  const didAutoNav = useRef(false);

  useEffect(() => {
    if (!loading && state.plan && !didAutoNav.current) {
      didAutoNav.current = true;
      setStep('plan');
    }
  }, [loading, state.plan]);

  useEffect(() => {
    if (step === 'plan' && !state.plan && !state.nextWeekPlan && !loading) setStep('setup');
    if (step === 'shopping' && !state.shopList && !state.nextWeekShopList && !loading) setStep('plan');
    if (step === 'setup' && !isFirstRun) setStep('prefs');
  }, [step, state.plan, state.nextWeekPlan, state.shopList, loading, isFirstRun]);

  useEffect(() => { setPantryDraft(state.preferences.pantry); }, [state.preferences.pantry]);

  // Load community meals when browse tab is opened
  useEffect(() => {
    if (browseTab !== 'community' || communityLoading || communityMeals.length > 0) return;
    setCommunityLoading(true);
    loadCommunityMeals().then(meals => { setCommunityMeals(meals); setCommunityLoading(false); });
  }, [browseTab, communityLoading, communityMeals.length]);

  const fetchReviews = useCallback(async (recipeName: string) => {
    if (reviewsCache[recipeName] !== undefined || reviewsLoadingSet.has(recipeName)) return;
    setReviewsLoadingSet(prev => new Set(prev).add(recipeName));
    const data = await loadReviews(recipeName);
    setReviewsCache(prev => ({ ...prev, [recipeName]: data }));
    setReviewsLoadingSet(prev => { const n = new Set(prev); n.delete(recipeName); return n; });
  }, [reviewsCache, reviewsLoadingSet]);

  const handleAddReview = useCallback(async (recipeName: string, stars: number, comment: string) => {
    const review = await addReview(state.householdId, recipeName, stars, comment);
    if (!review) return;
    setReviewsCache(prev => ({ ...prev, [recipeName]: [review, ...(prev[recipeName] ?? [])] }));
    setMyReviews(prev => ({ ...prev, [recipeName]: review.id }));
  }, [state.householdId]);

  const handleDeleteReview = useCallback(async (recipeName: string, reviewId: string) => {
    await deleteReview(reviewId, state.householdId);
    setReviewsCache(prev => ({ ...prev, [recipeName]: (prev[recipeName] ?? []).filter(r => r.id !== reviewId) }));
    setMyReviews(prev => { const n = { ...prev }; delete n[recipeName]; return n; });
  }, [state.householdId]);

  const handlePublish = useCallback(async (meal: Meal) => {
    if (!meal.id) return;
    setPublishingId(meal.id);
    const community = await publishMeal(state.householdId, meal);
    if (community) {
      setCommunityMeals(prev => [community, ...prev]);
      setPublishedMap(prev => ({ ...prev, [meal.id!]: community.communityId }));
      showToast('Published to community!');
    }
    setPublishingId(null);
  }, [state.householdId, showToast]);

  const handleUnpublish = useCallback(async (meal: Meal) => {
    if (!meal.id) return;
    const communityId = publishedMap[meal.id];
    if (!communityId) return;
    await unpublishMeal(communityId, state.householdId);
    setCommunityMeals(prev => prev.filter(m => m.communityId !== communityId));
    setPublishedMap(prev => { const n = { ...prev }; delete n[meal.id!]; return n; });
    showToast('Removed from community');
  }, [publishedMap, showToast, state.householdId]);

  const si = SEASON_INFO[state.season] ?? { label: '' };

  if (loading) return <Spinner />;

  // ── Setup / Onboarding screen ─────────────────────────────────────────────
  if (step === 'setup') {
    // First-run: 3-step onboarding wizard
    if (isFirstRun) {
      const steps: Record<number, string> = { 1: 'Your household', 2: 'Preferences', 3: 'Your week' };
      return (
        <Screen padBottom="32px">
          {/* Progress indicator */}
          <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', padding: '20px 0 8px' }}>
            {[1, 2, 3].map(s => (
              <div key={s} style={{ height: '6px', borderRadius: '3px', background: s <= onboardStep ? P.accent : P.border,
                width: s === onboardStep ? '28px' : '10px', transition: 'width 0.25s ease, background 0.25s ease' }} />
            ))}
          </div>
          <div style={{ textAlign: 'center', fontSize: '11px', color: P.muted, fontWeight: 700, letterSpacing: '1px',
            textTransform: 'uppercase', marginBottom: '20px' }}>Step {onboardStep} of 3 — {steps[onboardStep]}</div>

          {onboardStep === 1 && <>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div style={{ fontSize: '40px', marginBottom: '10px' }}>🍽️</div>
              <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '26px', lineHeight: 1.25, marginBottom: '6px' }}>
                Welcome to Meal Planner
              </div>
              <div style={{ fontSize: '14px', color: P.muted, lineHeight: 1.5 }}>
                We'll build a personalised weekly dinner plan for your household — then generate a shopping list automatically.
              </div>
            </div>
            <Section>
              <Row label="How many people are eating?">
                <Stepper value={state.familySize} min={1} max={12} onChange={actions.setFamilySize} />
              </Row>
            </Section>
            <div style={{ marginTop: '20px' }}>
              <Primary onClick={() => setOnboardStep(2)}>Next →</Primary>
            </div>
          </>}

          {onboardStep === 2 && <>
            <Header eyebrow="Preferences" title="How do you like to cook?" />
            <Section>
              <Row label="Max cook time per evening"><span /></Row>
              <TimeSlider value={state.preferences.timeFilter} onChange={v => actions.setPreferences({ timeFilter: v })} />
            </Section>
            <Section>
              <Row label="Dietary needs"><span /></Row>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                {([['none', 'No restrictions'], ['noFish', 'No fish'], ['noPork', 'No pork'], ['noRed', 'No red meat'], ['veggie', '🌱 Vegetarian']] as [string, string][]).map(([v, l]) => (
                  <Chip key={v} active={state.preferences.dietaryMode === v} onClick={() => actions.setPreferences({ dietaryMode: v as any })}>{l}</Chip>
                ))}
              </div>
            </Section>
            <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
              <Secondary muted onClick={() => setOnboardStep(1)}>← Back</Secondary>
              <Primary onClick={() => setOnboardStep(3)}>Next →</Primary>
            </div>
          </>}

          {onboardStep === 3 && <>
            <Header eyebrow="Your week" title="Which days do you cook?" subtitle="Tap a day to toggle it on or off" />
            {DAYS.map(day => (
              <DayToggle key={day} day={day} mode={(state.dayConfig[day] as DayMode) ?? 'home'} onChange={mode => actions.setDayMode(day, mode)} />
            ))}
            <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
              <Secondary muted onClick={() => setOnboardStep(2)}>← Back</Secondary>
              <Primary onClick={() => {
                actions.generate();
                localStorage.setItem('onboardingDone', '1');
                setIsFirstRun(false);
                setStep('plan');
              }}>✨ Build my first plan</Primary>
            </div>
          </>}
        </Screen>
      );
    }

    // Returning users redirected to Me screen via useEffect
    return null;
  }

  // ── Cooking mode overlay ─────────────────────────────────────────────────
  if (cookingMeal) return (
    <CookingMode
      meal={cookingMeal.meal}
      familySize={cookingMeal.familySize}
      onClose={() => setCookingMeal(null)}
      onStartTimer={addTimer}
      timers={timers}
      onDismissTimer={dismissTimer}
    />
  );

  // ── Plan screen ───────────────────────────────────────────────────────────
  if (step === 'plan' && (state.plan || state.nextWeekPlan)) {
  const todayName = new Date().toLocaleDateString('en-GB', { weekday: 'long' }) as DayName;
  const thisWeekMonday = (() => {
    const d = new Date(); const dow = d.getDay();
    d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow)); d.setHours(0,0,0,0); return d;
  })();
  const activeWeekMonday = planWeek === 'next'
    ? new Date(thisWeekMonday.getTime() + 7 * 24 * 60 * 60 * 1000)
    : thisWeekMonday;
  const dayDate = (dayName: DayName) => {
    const d = new Date(activeWeekMonday);
    d.setDate(activeWeekMonday.getDate() + DAYS.indexOf(dayName));
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };
  const activePlan = planWeek === 'this' ? state.plan : state.nextWeekPlan;
  const todayMeal = planWeek === 'this' ? state.plan?.meals.find(m => m.day === todayName) ?? null : null;
  const todayDaySize = state.dayOverrides[todayName]?.size ?? state.familySize;
  return (
    <div style={{ display: isDesktop ? 'flex' : 'block', minHeight: '100vh', background: P.bg }}>
      {/* Desktop sidebar */}
      {isDesktop && (
        <div style={{ width: '220px', background: P.card, borderRight: `1px solid ${P.border}`, position: 'sticky', top: 0, height: '100vh', display: 'flex', flexDirection: 'column', padding: '24px 0', flexShrink: 0 }}>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '20px', padding: '0 20px 20px', borderBottom: `1px solid ${P.border}`, marginBottom: '12px' }}>🍽️ Meal Planner</div>
          {(['plan', 'shopping', 'prefs'] as const).map(s => {
            const labels: Record<string, string> = { plan: '📅 Plan', shopping: '🛒 Shopping', prefs: '👤 Me' };
            const active = s === 'plan';
            return (
              <button key={s} onClick={() => setStep(s)}
                style={{ background: active ? P.accentLight : 'none', border: 'none', borderRadius: '10px', margin: '2px 12px', padding: '9px 12px', fontSize: '14px', fontWeight: 700, color: active ? P.accentDark : P.muted, cursor: 'pointer', textAlign: 'left' }}>
                {labels[s]}
              </button>
            );
          })}
          <div style={{ borderTop: `1px solid ${P.border}`, margin: '12px 0', padding: '12px 12px 0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <button onClick={() => setStep('browse')}
              style={{ background: P.accentLight, border: 'none', borderRadius: '10px', padding: '9px 12px', fontSize: '14px', fontWeight: 700, color: P.accentDark, cursor: 'pointer', textAlign: 'left' }}>
              🍴 Browse recipes
            </button>
            <button onClick={() => {
              if (planWeek === 'next') {
                actions.generateNextWeek();
                showToast('Next week regenerated!');
              } else {
                const prevPlan = state.plan;
                const prevOverrides = state.dayOverrides;
                actions.generate();
                actions.setShopChecked({});
                showToast('New plan generated!', prevPlan ? () => { actions.restorePlan(prevPlan, prevOverrides); actions.setShopChecked({}); } : undefined);
              }
            }} style={{ background: 'none', border: 'none', borderRadius: '10px', padding: '9px 12px', fontSize: '14px', fontWeight: 700, color: P.muted, cursor: 'pointer', textAlign: 'left' }}>
              🔄 Regenerate
            </button>
            {state.planHistory.length > 0 && (
              <button onClick={() => setShowPlanHistory(true)}
                style={{ background: 'none', border: 'none', borderRadius: '10px', padding: '9px 12px', fontSize: '14px', fontWeight: 700, color: P.muted, cursor: 'pointer', textAlign: 'left' }}>
                🕐 History
              </button>
            )}
          </div>
        </div>
      )}
      <div style={{ flex: 1, maxWidth: isDesktop ? 'none' : '480px', margin: isDesktop ? '0' : '0 auto', padding: '0 16px', paddingBottom: isDesktop ? '40px' : '80px', overflowX: 'hidden' }}>
      <div style={{ padding: '24px 0 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: P.accent, fontWeight: 700, marginBottom: '5px' }}>{planWeek === 'next' ? 'Next week' : 'This week'}</div>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '22px', lineHeight: 1.3, marginBottom: '4px' }}>Here's the plan</div>
            {activePlan && (() => {
              const isStale = Date.now() - activePlan.generatedAt > 7 * 24 * 60 * 60 * 1000;
              return (
                <div style={{ fontSize: '12px', color: isStale ? P.accent : P.muted, fontWeight: isStale ? 600 : 400, marginBottom: '6px' }}>
                  Generated {formatLastUsed(activePlan.generatedAt) ?? 'today'}{isStale ? ' — time to refresh?' : ''}
                </div>
              );
            })()}
          </div>
          <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
            <IconBtn onClick={() => {
              if (planWeek === 'next') {
                actions.generateNextWeek();
                showToast('Next week regenerated!');
              } else {
                const prevPlan = state.plan;
                const prevOverrides = state.dayOverrides;
                actions.generate();
                actions.setShopChecked({});
                showToast('New plan generated!', prevPlan ? () => { actions.restorePlan(prevPlan, prevOverrides); actions.setShopChecked({}); } : undefined);
              }
            }} title="Regenerate plan">🔄</IconBtn>
            {(activePlan ?? state.plan) && <IconBtn onClick={() => downloadICS((activePlan ?? state.plan)!, state.familySize)} title="Export to calendar">📅</IconBtn>}
            {state.planHistory.length > 0 && (
              <IconBtn onClick={() => setShowPlanHistory(true)} title="Previous plans">🕐</IconBtn>
            )}
            <IconBtn onClick={() => setShowHelp(true)} title="How it works">ℹ️</IconBtn>
          </div>
        </div>
        {!hintDismissed && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '12px' }}>
            <p style={{ fontSize: '13px', color: P.muted, margin: 0, flex: 1, lineHeight: 1.5 }}>
              Tap a card for recipe &amp; ingredients · ☆ favourite · 🔄 swap · 👎 skip forever
            </p>
            <button onClick={() => { setHintDismissed(true); localStorage.setItem('hintDismissed', '1'); }}
              style={{ background: 'none', border: 'none', color: P.muted, cursor: 'pointer', fontSize: '16px', flexShrink: 0, padding: '0 2px', lineHeight: 1 }}>×</button>
          </div>
        )}
      </div>

      {/* Rollover banner */}
      {showRollover && (
        <div style={{ background: P.accentLight, border: `1px solid ${P.accent}`, borderRadius: '14px', padding: '12px 14px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '13px', color: P.accent, marginBottom: '2px' }}>New week started</div>
            <div style={{ fontSize: '12px', color: P.muted }}>Promote next week's plan to this week?</div>
          </div>
          <button onClick={() => { actions.promoteNextWeekPlan(); setPlanWeek('this'); setShowRollover(false); }}
            style={{ background: P.accent, color: '#fff', border: 'none', borderRadius: '10px', padding: '7px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Promote
          </button>
          <button onClick={() => setShowRollover(false)}
            style={{ background: 'transparent', border: 'none', color: P.muted, fontSize: '18px', cursor: 'pointer', lineHeight: 1, padding: '0 2px' }}>
            ×
          </button>
        </div>
      )}

      {/* Week toggle */}
      <div style={{ display: 'flex', background: P.border, borderRadius: '22px', padding: '3px', marginBottom: '16px' }}>
        {(['this', 'next'] as const).map(w => (
          <button key={w} onClick={() => { setPlanWeek(w); setPreviewDay(null); setExpandedDay(null); }}
            style={{ flex: 1, padding: '8px', borderRadius: '19px', border: 'none', fontSize: '13px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
              background: planWeek === w ? P.card : 'transparent',
              color: planWeek === w ? P.accent : P.muted,
              boxShadow: planWeek === w ? P.shadow : 'none' }}>
            {w === 'this' ? 'This week' : 'Next week'}
          </button>
        ))}
      </div>

      {/* Tonight hero */}
      {todayMeal && !isDesktop && (() => {
        const mode = (state.dayConfig[todayName] as string);
        if (mode === 'off' || mode === 'gousto') return null;
        return (
          <div style={{ background: `linear-gradient(135deg, ${P.accent}, ${P.accentDark})`, borderRadius: '18px', padding: '16px 18px', marginBottom: '20px', color: '#fff' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', opacity: 0.8, marginBottom: '4px' }}>
              Tonight · {dayDate(todayName)}
            </div>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '20px', lineHeight: 1.25, marginBottom: '4px' }}>{todayMeal.name}</div>
            <div style={{ fontSize: '13px', opacity: 0.8, marginBottom: '14px' }}>{todayMeal.time} · {todayMeal.cuisine}</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setCookingMeal({ meal: todayMeal, familySize: todayDaySize })}
                style={{ flex: 1, background: '#fff', color: P.accent, border: 'none', borderRadius: '10px', padding: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                👨‍🍳 Cook now
              </button>
              <button onClick={() => setPlanDetailMeal({ meal: todayMeal, daySize: todayDaySize })}
                style={{ flex: 1, background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                View recipe →
              </button>
            </div>
          </div>
        );
      })()}

      {!activePlan ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>📅</div>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '20px', marginBottom: '8px' }}>
            {planWeek === 'next' ? 'No plan for next week yet' : 'No plan for this week yet'}
          </div>
          <div style={{ fontSize: '14px', color: P.muted, marginBottom: '24px' }}>
            Generate a plan to see what you'll be cooking.
          </div>
          <button onClick={() => {
            if (planWeek === 'next') { actions.generateNextWeek(); showToast('Next week plan generated!'); }
            else { actions.generate(); actions.setShopChecked({}); showToast('Plan generated!'); }
          }} style={{ background: P.accent, color: '#fff', border: 'none', borderRadius: '14px', padding: '14px 28px', fontSize: '15px', fontWeight: 700, cursor: 'pointer' }}>
            ✨ {planWeek === 'next' ? 'Generate next week' : 'Generate this week'}
          </button>
        </div>
      ) : (
      <div style={isDesktop ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' } : {}}>
      {DAYS.map(day => {
        const isToday = planWeek === 'this' && day === todayName;
        const rawMode = state.dayConfig[day] as string;
        const mode: DayMode = (rawMode === 'gousto' || rawMode === 'off') ? 'off' : 'home';

        if (mode === 'off') return (
          <div key={day} style={{ background: P.card, borderRadius: '16px', padding: '15px 16px', marginBottom: '10px', boxShadow: P.shadow, border: `1px solid ${P.border}`, opacity: 0.5 }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ fontSize: '26px', flexShrink: 0, paddingTop: '2px' }}>—</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '12px', color: P.accent, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{day} <span style={{ fontWeight: 400, opacity: 0.7 }}>· {dayDate(day)}</span></div>
                <div style={{ fontWeight: 700, fontSize: '16px', color: P.muted }}>Day off</div>
              </div>
            </div>
            <DayActions onHome={() => actions.setDayMode(day, 'home')} />
          </div>
        );

        const meal = activePlan.meals.find(m => m.day === day);
        if (!meal) return null;

        const lu = state.cookHistory.filter(h => h.name === meal.name);
        const lastUsedStr = formatLastUsed(lu.length ? Math.max(...lu.map(h => h.date)) : null);
        const daySize = state.dayOverrides[day]?.size ?? state.familySize;
        const dayTF = state.dayOverrides[day]?.time ?? state.preferences.timeFilter;

        return (
          <div key={day}>
            <MealCard
              meal={meal} day={`${day} · ${dayDate(day)}`}
              isFav={state.preferences.favourites.includes(meal.name)}
              isSeasonal={!!(meal.seasons?.includes(state.season as any))}
              seasonLabel={si.label}
              overviewOpen={previewDay === day || expandedDay === day}
              expanded={expandedDay === day}
              familySize={daySize}
              highlight={isToday}
              onView={() => setPlanDetailMeal({ meal, daySize })}
              onOverview={() => {
                if (previewDay === day || expandedDay === day) {
                  setPreviewDay(null); setExpandedDay(null);
                } else {
                  setPreviewDay(day); setExpandedDay(null);
                }
              }}
              onFullExpand={() => {
                if (expandedDay === day) { setExpandedDay(null); }
                else { setPreviewDay(day); setExpandedDay(day); fetchReviews(meal.name); }
              }}
              onFav={() => actions.toggleFav(meal.name)}
              onSwap={() => {
                if (planWeek === 'next') { actions.swapNextWeek(day); }
                else { actions.swap(day); }
                setPreviewDay(null); setExpandedDay(null); showToast('Swapped!');
              }}
              onDislike={() => {
                const dislikedMeal = meal;
                actions.addDislike(dislikedMeal.name);
                if (planWeek === 'next') { actions.swapNextWeek(day); }
                else { actions.swap(day); }
                setPreviewDay(null); setExpandedDay(null);
                showToast("Won't suggest again", () => {
                  actions.setPreferences({ dislikes: state.preferences.dislikes.filter(d => d !== dislikedMeal.name) });
                  if (planWeek === 'next') actions.replaceMealInNextWeekPlan(day, dislikedMeal);
                  else actions.replaceMealInPlan(day, dislikedMeal);
                });
              }}
              onChoose={() => setPickerFor(day)}
              onMarkOff={() => actions.setDayMode(day, 'off')}
              onMarkCooked={() => { actions.addToHistory([{ name: meal.name }]); showToast('Logged as cooked!'); }}
              onChangeMealSize={d => actions.setDaySize(day, Math.max(1, Math.min(20, daySize + d)))}
              kidsMode={(state.kidsConfig[day] as KidsMode) ?? 'either'}
              onCycleKids={() => actions.cycleKids(day)}
              dayTimeFilter={dayTF}
              onSetDayTime={tf => actions.setDayTime(day, tf)}
              lastUsedStr={lastUsedStr}
              onStartTimer={addTimer}
              onEstimateNutrition={() => estimateNutrition(meal)}
              nutritionLoading={nutritionLoading.has(meal.name)}
              nutrition={meal.nutrition ?? nutritionCache[meal.name]}
              onCookMode={() => setCookingMeal({ meal, familySize: daySize })}
              onAdapt={request => adaptRecipe(meal, request)}
              onSaveAdapted={adapted => { actions.addMeal(adapted); if (planWeek === 'next') actions.replaceMealInNextWeekPlan(day, adapted); else actions.replaceMealInPlan(day, adapted); showToast(`Saved: ${adapted.name}`); }}
              reviews={reviewsCache[meal.name]}
              reviewsLoading={reviewsLoadingSet.has(meal.name)}
              onAddReview={(stars, comment) => handleAddReview(meal.name, stars, comment)}
              householdReviewId={myReviews[meal.name]}
              onDeleteReview={id => handleDeleteReview(meal.name, id)}
            />
          </div>
        );
      })}
      </div>
      )}

      <ActiveTimers timers={timers} onDismiss={dismissTimer} />

      {planDetailMeal && (
        <RecipeDetailSheet
          meal={planDetailMeal.meal}
          isFav={state.preferences.favourites.includes(planDetailMeal.meal.name)}
          onFav={() => actions.toggleFav(planDetailMeal.meal.name)}
          onCook={() => { setCookingMeal({ meal: planDetailMeal.meal, familySize: planDetailMeal.daySize }); setPlanDetailMeal(null); }}
          onClose={() => setPlanDetailMeal(null)}
          familySize={planDetailMeal.daySize}
        />
      )}

      {!isDesktop && (
        <BottomNav
          onPlan={() => setStep('plan')}
          onShopping={() => setStep('shopping')}
          onBrowse={() => setStep('browse')}
          onProfile={() => setStep('prefs')}
          active="plan"
        />
      )}

      {toast && <Toast message={toast} onUndo={toastUndoRef.current ?? undefined} bottom="80px" />}

      {pickerFor && (
        <Modal onClose={() => setPickerFor(null)}>
          <MealPicker
            meals={ALL_RECIPES.concat(state.customMeals)}
            favourites={state.preferences.favourites}
            dislikes={state.preferences.dislikes}
            onPick={meal => {
              if (pickerFor === 'cookNow') {
                setCookNow(meal); setCookNowExp(true); setPickerFor(null);
              } else {
                if (planWeek === 'next') actions.replaceMealInNextWeekPlan(pickerFor as DayName, meal);
                else actions.replaceMealInPlan(pickerFor as DayName, meal);
                setPickerFor(null); showToast(`Switched to ${meal.name}`);
              }
            }}
            onToggleFav={actions.toggleFav}
            onDislike={name => { actions.addDislike(name); showToast('Marked as disliked'); }}
          />
        </Modal>
      )}

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      {/* Plan history modal */}
      {showPlanHistory && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '24px 0 40px' } as React.CSSProperties}
            onClick={() => setShowPlanHistory(false)}>
            <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0 16px' }} onClick={e => e.stopPropagation()}>
              <div style={{ background: P.bg, borderRadius: '20px', boxShadow: '0 8px 40px rgba(0,0,0,0.22)', overflow: 'hidden' }}>
                <div style={{ background: P.accent, padding: '18px 20px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '11px', opacity: 0.85, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase' }}>Plan history</div>
                    <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '20px', marginTop: '2px' }}>🕐 Previous plans</div>
                  </div>
                  <button onClick={() => setShowPlanHistory(false)}
                    style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '10px', padding: '8px 12px', cursor: 'pointer', fontSize: '18px', fontWeight: 700 }}>✕</button>
                </div>
                <div style={{ padding: '16px 20px 24px' }}>
                  {state.planHistory.length === 0 ? (
                    <div style={{ color: P.muted, fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>No previous plans yet. Generate a new plan to start building history.</div>
                  ) : (
                    state.planHistory.map((entry, idx) => {
                      const d = new Date(entry.savedAt);
                      const weekLabel = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                      return (
                        <div key={idx} style={{ borderBottom: idx < state.planHistory.length - 1 ? `1px solid ${P.border}` : 'none', paddingBottom: '16px', marginBottom: '16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: P.text }}>Week of {weekLabel}</div>
                            <button onClick={() => {
                              actions.restorePlan(entry.plan, entry.dayOverrides);
                              actions.setShopChecked({});
                              setShowPlanHistory(false);
                              showToast('Plan restored!', () => {
                                actions.restorePlan(state.plan!, state.dayOverrides);
                                actions.setShopChecked({});
                              });
                            }} style={{ background: P.accentLight, border: 'none', borderRadius: '8px', padding: '5px 12px', fontSize: '12px', fontWeight: 700, color: P.accentDark, cursor: 'pointer' }}>
                              Restore
                            </button>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {entry.plan.meals.map(m => (
                              <div key={m.day} style={{ display: 'flex', gap: '8px', fontSize: '13px' }}>
                                <span style={{ color: P.muted, minWidth: '36px', flexShrink: 0 }}>{m.day.slice(0, 3)}</span>
                                <span style={{ color: P.text }}>{m.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                  {state.planHistory.length > 0 && (
                    <button onClick={() => { actions.clearPlanHistory(); setShowPlanHistory(false); }}
                      style={{ background: 'none', border: `1px solid ${P.border}`, borderRadius: '8px', padding: '6px 14px', fontSize: '12px', color: P.muted, cursor: 'pointer', marginTop: '4px' }}>
                      Clear history
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
  } // end plan screen

  // ── Shopping screen ───────────────────────────────────────────────────────
  if (step === 'shopping' && (state.shopList || state.nextWeekShopList)) {
  const hasNext = !!state.nextWeekShopList;
  const activeShopList =
    shopWeek === 'next' ? state.nextWeekShopList :
    shopWeek === 'both' ? state.bothShopList :
    state.shopList;
  const activeShopListSafe = activeShopList ?? {};
  const totalItems = Object.values(activeShopListSafe).flat().length;
  const checkedCount = Object.values(state.shopChecked).filter(Boolean).length;
  return (
    <Screen>
      <Header eyebrow="Shopping" title="What to buy" />
      {hasNext && (
        <div style={{ display: 'flex', background: P.border, borderRadius: '22px', padding: '3px', marginBottom: '14px' }}>
          {(['this', 'next', 'both'] as const).map(w => (
            <button key={w} onClick={() => setShopWeek(w)}
              style={{ flex: 1, padding: '7px 4px', borderRadius: '19px', border: 'none', fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                background: shopWeek === w ? P.card : 'transparent',
                color: shopWeek === w ? P.accent : P.muted,
                boxShadow: shopWeek === w ? P.shadow : 'none' }}>
              {w === 'this' ? 'This week' : w === 'next' ? 'Next week' : 'Both'}
            </button>
          ))}
        </div>
      )}
      <div style={{ fontSize: '13px', color: P.muted, marginBottom: '16px' }}>
        {totalItems} items · {checkedCount} checked
      </div>
      {Object.entries(activeShopListSafe).map(([cat, items]) => (
        <Section key={cat}>
          <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '10px' }}>{CAT_EMOJI[cat]} {cat}</div>
          {items.map((item, i) => {
            const key = `${cat}:${item.display}`;
            return (
              <div key={i} onClick={() => actions.setShopChecked({ ...state.shopChecked, [key]: !state.shopChecked[key] })}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0',
                  borderBottom: i < items.length - 1 ? `1px solid ${P.border}` : 'none', cursor: 'pointer' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '7px', border: `2px solid ${state.shopChecked[key] ? P.green : P.border}`,
                  background: state.shopChecked[key] ? P.greenLight : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, fontSize: '13px', color: P.greenDark, fontWeight: 700 }}>
                  {state.shopChecked[key] ? '✓' : ''}
                </div>
                <div style={{ fontSize: '14px', textDecoration: state.shopChecked[key] ? 'line-through' : 'none',
                  color: state.shopChecked[key] ? P.muted : P.text, flex: 1 }}>
                  {item.display}
                </div>
              </div>
            );
          })}
        </Section>
      ))}
      {Object.values(state.shopChecked).some(Boolean) && (
        <Secondary muted onClick={() => actions.setShopChecked({})}>Clear checks</Secondary>
      )}
      <Primary onClick={() => {
        const weekLabel = shopWeek === 'both' ? 'Both weeks' : shopWeek === 'next' ? 'Next week' : 'This week';
        const planForLabel = shopWeek === 'next' ? state.nextWeekPlan : state.plan;
        const mealLines = planForLabel?.meals.map(m => `${m.day}: ${m.name}`).join('\n') ?? '';
        const bothMealLines = shopWeek === 'both'
          ? [state.plan?.meals, state.nextWeekPlan?.meals].flatMap(ms => ms ?? []).map(m => `${m.day}: ${m.name}`).join('\n')
          : mealLines;
        const lines = Object.entries(activeShopListSafe).map(([cat, items]) => {
          const unchecked = items.filter(item => !state.shopChecked[`${cat}:${item.display}`]);
          if (!unchecked.length) return '';
          return `${CAT_EMOJI[cat] ?? '•'} ${cat}\n${unchecked.map(i => `  • ${i.display}`).join('\n')}`;
        }).filter(Boolean).join('\n\n');
        const hasChecked = Object.values(state.shopChecked).some(Boolean);
        const body = `🛒 Shopping list${hasChecked ? ' (remaining)' : ''} — serves ${state.familySize}\n\n📅 ${weekLabel}\n${bothMealLines}\n\n${lines}`;
        if (navigator.share) navigator.share({ title: 'Shopping List', text: body }).catch(() => {});
        else navigator.clipboard?.writeText(body).then(() => showToast('Copied!'));
      }}>🔗 Share list</Primary>
      {toast && <Toast message={toast} onUndo={toastUndoRef.current ?? undefined} />}
      <BottomNav
        onPlan={() => setStep('plan')}
        onShopping={() => setStep('shopping')}
        onBrowse={() => setStep('browse')}
        onProfile={() => setStep('prefs')}
        active="shopping"
      />
    </Screen>
  );
  } // end shopping screen

  // ── Browse screen ─────────────────────────────────────────────────────────
  if (step === 'browse') {
    const si = SEASON_INFO[state.season] ?? { label: '' };
    const allMeals = ALL_RECIPES.concat(state.customMeals);
    const q = browseQuery.trim().toLowerCase();
    const filterMeals = (meals: Meal[]) => meals.filter(m => {
      if (browseProtein && m.protein !== browseProtein) return false;
      if (browseCuisine && m.cuisine !== browseCuisine) return false;
      if (browseTime === '30' && m.minutes > 30) return false;
      if (browseTime === '45' && m.minutes > 45) return false;
      if (q) {
        const hay = `${m.name} ${m.cuisine} ${m.protein} ${m.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const browsed = filterMeals(allMeals);
    const browsedCommunity = filterMeals(communityMeals);
    const seasonal = allMeals.filter(m => m.seasons?.includes(state.season as any));
    const hasFilters = !!(browseQuery || browseProtein || browseCuisine || browseTime);

    const addDayModal = browseAddDay && (
      <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        onClick={() => setBrowseAddDay(null)}>
        <div style={{ background: P.card, borderRadius: '20px 20px 0 0', padding: '20px 20px 32px', width: '100%', maxWidth: '480px' }}
          onClick={e => e.stopPropagation()}>
          <div style={{ textAlign: 'center', marginBottom: '4px', fontSize: '16px', fontWeight: 700 }}>Add to plan</div>
          <div style={{ textAlign: 'center', color: P.muted, fontSize: '13px', marginBottom: '16px' }}>{browseAddDay.name}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {!state.plan ? (
              <div style={{ textAlign: 'center', color: P.muted, fontSize: '13px', padding: '10px 0' }}>Generate a plan first to add meals to it</div>
            ) : DAYS.filter(d => !state.dayConfig[d] || state.dayConfig[d] === 'home').map(day => {
              const current = state.plan!.meals.find(m => m.day === day);
              return (
                <button key={day} onClick={() => {
                  actions.replaceMealInPlan(day, browseAddDay!);
                  setBrowseAddDay(null);
                  showToast(`Added to ${day}!`);
                }}
                  style={{ background: P.bg, border: `2px solid ${P.border}`, borderRadius: '10px', padding: '10px 14px', fontSize: '14px', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700 }}>{day}</span>
                  <span style={{ fontSize: '12px', color: P.muted, maxWidth: '55%', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {current ? `Replace: ${current.name}` : '+ Add'}
                  </span>
                </button>
              );
            })}
          </div>
          <button onClick={() => setBrowseAddDay(null)}
            style={{ width: '100%', marginTop: '12px', background: 'none', border: 'none', color: P.muted, fontSize: '14px', cursor: 'pointer', padding: '8px' }}>
            Cancel
          </button>
        </div>
      </div>
    );

    return (
      <div style={{ background: P.bg, minHeight: '100vh', paddingBottom: '80px' }}>
        {/* Sticky header */}
        <div style={{ position: 'sticky', top: 0, zIndex: 100, background: P.card, borderBottom: `1px solid ${P.border}`, padding: '12px 16px 0' }}>
          <div style={{ maxWidth: '480px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '20px', flex: 1 }}>Recipes</div>
              {hasFilters && (
                <button onClick={() => { setBrowseQuery(''); setBrowseProtein(''); setBrowseCuisine(''); setBrowseTime(''); }}
                  style={{ background: 'none', border: 'none', color: P.accent, fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                  Clear
                </button>
              )}
            </div>

            {/* Tab bar */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
              {([['all', '🍽️ All recipes'], ['community', '👥 Community']] as ['all' | 'community', string][]).map(([t, l]) => (
                <button key={t} onClick={() => setBrowseTab(t)}
                  style={{ padding: '6px 14px', borderRadius: '20px', border: 'none', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                    background: browseTab === t ? P.accent : P.accentLight, color: browseTab === t ? '#fff' : P.accentDark }}>
                  {l}
                </button>
              ))}
            </div>

            {/* Search */}
            <input
              type="search"
              placeholder={browseTab === 'community' ? 'Search community recipes…' : 'Search meals…'}
              value={browseQuery}
              onChange={e => setBrowseQuery(e.target.value)}
              style={{ width: '100%', padding: '9px 14px', border: `2px solid ${P.border}`, borderRadius: '10px', fontSize: '14px', background: P.bg, boxSizing: 'border-box', outline: 'none', marginBottom: '8px' }}
            />
            {/* Filter chips — only on All tab */}
            {browseTab === 'all' && <>
              <div style={{ overflowX: 'auto', whiteSpace: 'nowrap', marginBottom: '6px', scrollbarWidth: 'none' }}>
                {([['', 'Any time'], ['30', '≤ 30 min'], ['45', '≤ 45 min']] as [string, string][]).map(([v, l]) => (
                  <button key={v} onClick={() => setBrowseTime(browseTime === v ? '' : v)}
                    style={{ display: 'inline-block', marginRight: '6px', padding: '5px 12px', borderRadius: '20px', border: 'none', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                      background: browseTime === v ? P.accent : P.accentLight, color: browseTime === v ? '#fff' : P.accentDark }}>
                    {l}
                  </button>
                ))}
              </div>
              <div style={{ overflowX: 'auto', whiteSpace: 'nowrap', marginBottom: '6px', scrollbarWidth: 'none' }}>
                {([['', 'All proteins'], ['chicken', '🍗 Chicken'], ['beef', '🥩 Beef'], ['fish', '🐟 Fish'], ['pork', '🥓 Pork'], ['lamb', '🍖 Lamb'], ['seafood', '🦐 Seafood'], ['eggs', '🥚 Eggs'], ['veggie', '🌱 Veggie']] as [string, string][]).map(([v, l]) => (
                  <button key={v} onClick={() => setBrowseProtein(browseProtein === v ? '' : v)}
                    style={{ display: 'inline-block', marginRight: '6px', padding: '5px 12px', borderRadius: '20px', border: 'none', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                      background: browseProtein === v ? P.accent : P.accentLight, color: browseProtein === v ? '#fff' : P.accentDark }}>
                    {l}
                  </button>
                ))}
              </div>
              <div style={{ overflowX: 'auto', whiteSpace: 'nowrap', marginBottom: '10px', scrollbarWidth: 'none' }}>
                {([['', 'All cuisines'], ['british', '🇬🇧 British'], ['italian', '🇮🇹 Italian'], ['asian', '🥢 Asian'], ['mexican', '🌮 Mexican'], ['indian', '🍛 Indian'], ['american', '🍔 American'], ['middleeastern', '🧆 Middle Eastern'], ['other', '🌍 Other']] as [string, string][]).map(([v, l]) => (
                  <button key={v} onClick={() => setBrowseCuisine(browseCuisine === v ? '' : v)}
                    style={{ display: 'inline-block', marginRight: '6px', padding: '5px 12px', borderRadius: '20px', border: 'none', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                      background: browseCuisine === v ? P.accent : P.accentLight, color: browseCuisine === v ? '#fff' : P.accentDark }}>
                    {l}
                  </button>
                ))}
              </div>
            </>}
          </div>
        </div>

        {/* AI panel */}
        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '12px 16px 0' }}>
          <div style={{ background: P.card, borderRadius: '16px', border: `1px solid ${P.border}`, overflow: 'hidden', boxShadow: P.shadow }}>
            <div onClick={() => { if (!browseAIOpen) { setBrowseAIOpen(true); if (!cookNow) rePick(); } else setBrowseAIOpen(false); }}
              style={{ background: `linear-gradient(135deg, ${P.accent}, ${P.accentDark})`, padding: '14px 16px', color: '#fff', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '11px', opacity: 0.85, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase' }}>AI Suggestions</div>
                <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '18px', marginTop: '2px' }}>✨ Find something for tonight</div>
              </div>
              <div style={{ fontSize: '18px', opacity: 0.8 }}>{browseAIOpen ? '▲' : '▼'}</div>
            </div>
            {browseAIOpen && (() => {
              const updateOpts = (patch: Partial<typeof cookNowOpts>) => {
                const next = { ...cookNowOpts, ...patch };
                setCookNowOpts(next);
                if (!('size' in patch)) rePick(next);
              };
              const lu = cookNow ? state.cookHistory.filter(h => h.name === cookNow.name) : [];
              const lastUsedStr = cookNow ? formatLastUsed(lu.length ? Math.max(...lu.map(h => h.date)) : null) : null;
              const homeDays = DAYS.filter(d => !state.dayConfig[d] || state.dayConfig[d] === 'home');
              return (
                <>
                  <div style={{ display: 'flex', gap: '6px', padding: '10px 16px', borderBottom: `1px solid ${P.border}`, background: P.bg }}>
                    {([['🎲 Suggested', 'suggest'], ['🧊 From my fridge', 'fridge']] as [string, 'suggest' | 'fridge'][]).map(([label, tab]) => (
                      <button key={tab} onClick={() => { setFindRecipeTab(tab); if (tab === 'suggest' && !cookNow) rePick(); }}
                        style={{ padding: '6px 14px', borderRadius: '20px', border: 'none', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                          background: findRecipeTab === tab ? P.accent : P.accentLight, color: findRecipeTab === tab ? '#fff' : P.accentDark }}>
                        {label}
                      </button>
                    ))}
                  </div>
                  {findRecipeTab === 'fridge' && (
                    <div style={{ padding: '16px' }}>
                      <div style={{ fontSize: '13px', color: P.muted, marginBottom: '12px', lineHeight: 1.5 }}>Tell us what you have and we'll find the best matches.</div>
                      <textarea value={fridgeQuery} onChange={e => setFridgeQuery(e.target.value)}
                        placeholder="e.g. chicken thighs, broccoli, pasta, garlic" rows={3}
                        style={{ width: '100%', padding: '11px 14px', border: `2px solid ${P.border}`, borderRadius: '10px', fontSize: '14px', background: P.card, boxSizing: 'border-box', resize: 'none', lineHeight: 1.5, marginBottom: '10px' } as React.CSSProperties} />
                      <button onClick={() => searchFridge(fridgeQuery)} disabled={fridgeLoading || !fridgeQuery.trim()}
                        style={{ width: '100%', background: P.accent, color: '#fff', border: 'none', borderRadius: '10px', padding: '12px', fontSize: '14px', fontWeight: 700, cursor: fridgeLoading || !fridgeQuery.trim() ? 'default' : 'pointer', opacity: fridgeLoading || !fridgeQuery.trim() ? 0.6 : 1, marginBottom: '12px' }}>
                        {fridgeLoading ? '✨ Asking AI…' : '🔍 Find meals'}
                      </button>
                      {fridgeMatches !== null && fridgeMatches.length === 0 && <div style={{ textAlign: 'center', color: P.muted, fontSize: '14px' }}>No close matches found.</div>}
                      {fridgeMatches && fridgeMatches.length > 0 && (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: '1px' }}>{fridgeMatches.length} match{fridgeMatches.length !== 1 ? 'es' : ''} found</div>
                            {fridgeAI && <span style={{ background: '#EDE9FE', color: '#5B21B6', borderRadius: '6px', padding: '2px 7px', fontSize: '10px', fontWeight: 700 }}>✨ AI</span>}
                          </div>
                          {fridgeMatches.map(match => (
                            <div key={match.name} onClick={() => { setCookNow(match); setCookNowExp(false); setFindRecipeTab('suggest'); setFridgeMatches(null); setFridgeQuery(''); }}
                              style={{ background: P.bg, border: `1.5px solid ${P.border}`, borderRadius: '12px', padding: '12px 14px', marginBottom: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div><div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '2px' }}>{match.name}</div><div style={{ fontSize: '12px', color: P.muted }}>{match.time} · {match.cuisine}</div></div>
                              <div style={{ fontSize: '20px', marginLeft: '10px', flexShrink: 0 }}>→</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {findRecipeTab === 'suggest' && (
                    <>
                      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${P.border}`, background: P.card }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', gap: '5px' }}>
                            {([['👶 Kids', 'kids'], ['✌️ Either', 'either'], ['🍷 Adults', 'adults']] as [string, string][]).map(([label, val]) => (
                              <button key={val} onClick={() => updateOpts({ kids: val })}
                                style={{ background: cookNowOpts.kids === val ? P.accentLight : 'transparent', border: `1.5px solid ${cookNowOpts.kids === val ? P.accent : P.border}`, borderRadius: '20px', padding: '4px 10px', fontSize: '12px', fontWeight: 700, color: cookNowOpts.kids === val ? P.accentDark : P.muted, cursor: 'pointer' }}>
                                {label}
                              </button>
                            ))}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button onClick={() => setCookNowOpts(p => ({ ...p, size: Math.max(1, p.size - 1) }))} style={{ background: P.border, border: 'none', borderRadius: '6px', width: '22px', height: '22px', fontSize: '15px', cursor: 'pointer', color: P.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: P.muted, minWidth: '52px', textAlign: 'center' }}>{cookNowOpts.size} people</span>
                            <button onClick={() => setCookNowOpts(p => ({ ...p, size: Math.min(20, p.size + 1) }))} style={{ background: P.border, border: 'none', borderRadius: '6px', width: '22px', height: '22px', fontSize: '15px', cursor: 'pointer', color: P.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                          </div>
                        </div>
                        <div style={{ marginBottom: '8px' }}><TimeSlider value={cookNowOpts.time} label="Max cook time" onChange={v => updateOpts({ time: v })} /></div>
                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                          {([['none', 'All'], ['noFish', 'No fish'], ['noPork', 'No pork'], ['noRed', 'No red meat'], ['veggie', '🌱 Veggie']] as [string, string][]).map(([v, l]) => (
                            <button key={v} onClick={() => updateOpts({ dietary: v })}
                              style={{ background: cookNowOpts.dietary === v ? P.greenLight : 'transparent', border: `1.5px solid ${cookNowOpts.dietary === v ? P.greenDark : P.border}`, borderRadius: '20px', padding: '3px 9px', fontSize: '11px', fontWeight: 700, color: cookNowOpts.dietary === v ? P.greenDark : P.muted, cursor: 'pointer' }}>
                              {l}
                            </button>
                          ))}
                        </div>
                      </div>
                      {cookNow ? (
                        <div style={{ padding: '16px' }}>
                          <MealCard meal={cookNow} day="Tonight"
                            isFav={state.preferences.favourites.includes(cookNow.name)}
                            isSeasonal={!!(cookNow.seasons?.includes(state.season as any))}
                            seasonLabel={si.label} overviewOpen={true} expanded={cookNowExp}
                            familySize={cookNowOpts.size}
                            onView={() => setBrowseDetailMeal(cookNow)}
                            onOverview={() => setCookNowExp(x => !x)} onFullExpand={() => setCookNowExp(x => !x)}
                            onFav={() => actions.toggleFav(cookNow.name)} onSwap={() => rePick()}
                            onDislike={() => { const prev = cookNow; actions.addDislike(prev.name); rePick(); showToast("Won't suggest again", () => { actions.setPreferences({ dislikes: state.preferences.dislikes.filter(d => d !== prev.name) }); setCookNow(prev); setCookNowExp(true); }); }}
                            lastUsedStr={lastUsedStr} onStartTimer={addTimer}
                            onEstimateNutrition={() => estimateNutrition(cookNow)}
                            nutritionLoading={nutritionLoading.has(cookNow.name)}
                            nutrition={cookNow.nutrition ?? nutritionCache[cookNow.name]}
                            onCookMode={() => setCookingMeal({ meal: cookNow, familySize: cookNowOpts.size })}
                            onAdapt={request => adaptRecipe(cookNow, request)}
                            onSaveAdapted={adapted => { actions.addMeal(adapted); showToast(`Saved: ${adapted.name}`); }}
                          />
                        </div>
                      ) : (
                        <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                          <button onClick={() => rePick()} style={{ background: P.accent, color: '#fff', border: 'none', borderRadius: '12px', padding: '13px 28px', fontSize: '15px', fontWeight: 700, cursor: 'pointer' }}>🎲 Get a suggestion</button>
                        </div>
                      )}
                      {cookNow && (
                        <div style={{ padding: '0 16px 16px' }}>
                          <Primary onClick={() => rePick()}>🔀 Suggest something else</Primary>
                          <Secondary muted onClick={() => { actions.addToHistory([{ name: cookNow.name }]); setCookNow(null); showToast('Logged as cooked!'); }}>✓ Cooked it</Secondary>
                          <button onClick={() => setPickerFor('cookNow')} style={{ width: '100%', background: 'none', border: 'none', color: P.muted, fontSize: '14px', fontWeight: 600, cursor: 'pointer', marginTop: '4px', padding: '4px' }}>📋 Browse all meals</button>
                          {state.plan && homeDays.length > 0 && (
                            <>
                              <button onClick={() => setCookNowAddToPlan(x => !x)} style={{ width: '100%', background: 'none', border: 'none', color: P.muted, fontSize: '14px', fontWeight: 600, cursor: 'pointer', marginTop: '4px', padding: '4px' }}>📅 Add to this week's plan</button>
                              {cookNowAddToPlan && (
                                <div style={{ marginTop: '12px', background: P.card, borderRadius: '14px', padding: '10px 14px', border: `1px solid ${P.border}` }}>
                                  <div style={{ fontSize: '11px', color: P.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Replace which day?</div>
                                  {homeDays.map((d, idx) => {
                                    const existing = state.plan!.meals.find(m => m.day === d);
                                    return (
                                      <div key={d} onClick={() => { actions.replaceMealInPlan(d, cookNow); setCookNow(null); setBrowseAIOpen(false); setCookNowAddToPlan(false); showToast(`${d}: ${cookNow.name}`); setStep('plan'); }}
                                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 4px', cursor: 'pointer', borderBottom: idx < homeDays.length - 1 ? `1px solid ${P.border}` : 'none' }}>
                                        <div style={{ fontWeight: 700, fontSize: '13px', minWidth: '72px' }}>{d}</div>
                                        <div style={{ fontSize: '12px', color: P.muted, flex: 1, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>{existing ? existing.name : '+ Add'}</div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '16px 16px 0' }}>
          {browseTab === 'all' && <>
            {/* Seasonal strip — only when no filters active */}
            {!hasFilters && seasonal.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: P.accent, marginBottom: '10px' }}>
                  {SEASON_INFO[state.season]?.label ?? '🍽️'} In season now
                </div>
                <div style={{ overflowX: 'auto', display: 'flex', gap: '10px', scrollbarWidth: 'none', paddingBottom: '4px' }}>
                  {seasonal.slice(0, 8).map(m => (
                    <BrowseMealCard key={m.name} meal={m}
                      isFav={state.preferences.favourites.includes(m.name)}
                      onFav={() => actions.toggleFav(m.name)}
                      onAdd={() => setBrowseAddDay(m)}
                      onView={() => setBrowseDetailMeal(m)}
                      compact
                    />
                  ))}
                </div>
              </div>
            )}
            <div style={{ fontSize: '12px', color: P.muted, marginBottom: '12px', fontWeight: 600 }}>
              {browsed.length} {browsed.length === 1 ? 'recipe' : 'recipes'}{hasFilters ? ' matching' : ''}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {browsed.map(m => (
                <BrowseMealCard key={m.name} meal={m}
                  isFav={state.preferences.favourites.includes(m.name)}
                  onFav={() => actions.toggleFav(m.name)}
                  onAdd={() => setBrowseAddDay(m)}
                  onView={() => setBrowseDetailMeal(m)}
                />
              ))}
            </div>
            {browsed.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 16px', color: P.muted }}>
                <div style={{ fontSize: '36px', marginBottom: '10px' }}>🍽️</div>
                <div style={{ fontWeight: 700, marginBottom: '6px' }}>No recipes found</div>
                <div style={{ fontSize: '13px' }}>Try clearing some filters</div>
              </div>
            )}
          </>}

          {browseTab === 'community' && <>
            {communityLoading && <div style={{ textAlign: 'center', padding: '40px', color: P.muted }}>Loading…</div>}
            {!communityLoading && browsedCommunity.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 16px', color: P.muted }}>
                <div style={{ fontSize: '36px', marginBottom: '10px' }}>👥</div>
                <div style={{ fontWeight: 700, marginBottom: '6px' }}>No community recipes yet</div>
                <div style={{ fontSize: '13px', marginBottom: '16px' }}>Publish one of your custom meals to get started!</div>
                <button onClick={() => setStep('prefs')}
                  style={{ background: P.accentLight, border: 'none', borderRadius: '10px', padding: '10px 20px', fontSize: '13px', fontWeight: 700, color: P.accentDark, cursor: 'pointer' }}>
                  Go to My Meals →
                </button>
              </div>
            )}
            {!communityLoading && browsedCommunity.length > 0 && <>
              <div style={{ fontSize: '12px', color: P.muted, marginBottom: '12px', fontWeight: 600 }}>
                {browsedCommunity.length} community {browsedCommunity.length === 1 ? 'recipe' : 'recipes'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {browsedCommunity.map(m => (
                  <BrowseMealCard key={(m as CommunityMeal).communityId} meal={m}
                    isFav={state.preferences.favourites.includes(m.name)}
                    onFav={() => actions.toggleFav(m.name)}
                    onAdd={() => setBrowseAddDay(m)}
                    onView={() => setBrowseDetailMeal(m)}
                    communityLabel
                  />
                ))}
              </div>
            </>}
          </>}
        </div>

        {addDayModal}
        {browseDetailMeal && (
          <RecipeDetailSheet
            meal={browseDetailMeal}
            isFav={state.preferences.favourites.includes(browseDetailMeal.name)}
            onFav={() => actions.toggleFav(browseDetailMeal.name)}
            onAdd={() => { setBrowseAddDay(browseDetailMeal); setBrowseDetailMeal(null); }}
            onCook={() => { setCookingMeal({ meal: browseDetailMeal, familySize: state.familySize }); setBrowseDetailMeal(null); }}
            onClose={() => setBrowseDetailMeal(null)}
            familySize={state.familySize}
          />
        )}
        {toast && <Toast message={toast} onUndo={toastUndoRef.current ?? undefined} bottom="80px" />}
        <BottomNav
          onPlan={() => setStep('plan')}
          onShopping={() => setStep('shopping')}
          onBrowse={() => setStep('browse')}
            onProfile={() => setStep('prefs')}
          active="browse"
        />
      </div>
    );
  }

  // ── Me screen (merged settings + prefs) ──────────────────────────────────
  if (step === 'prefs') return (
    <Screen>
      <Header eyebrow="Me" title="Your account" />

      {!state.plan && (
        <div style={{ marginBottom: '16px' }}>
          <Primary onClick={() => { actions.generate(); setStep('plan'); }}>✨ Generate this week's meals</Primary>
        </div>
      )}

      {/* 1. Preferences */}
      <Section>
        <div style={{ fontWeight: 700, marginBottom: '12px' }}>Preferences</div>
        <Row label="People eating">
          <Stepper value={state.familySize} min={1} max={12} onChange={actions.setFamilySize} />
        </Row>
        <div style={{ marginTop: '12px', marginBottom: '4px' }}>
          <TimeSlider value={state.preferences.timeFilter} label="Max cook time" onChange={v => actions.setPreferences({ timeFilter: v })} />
        </div>
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '12px', marginBottom: '16px' }}>
          {([['none', 'All'], ['noFish', 'No fish'], ['noPork', 'No pork'], ['noRed', 'No red meat'], ['veggie', '🌱 Veggie']] as [string, string][]).map(([v, l]) => (
            <Chip key={v} active={state.preferences.dietaryMode === v} onClick={() => actions.setPreferences({ dietaryMode: v as any })}>{l}</Chip>
          ))}
        </div>
        <div style={{ borderTop: `1px solid ${P.border}`, paddingTop: '14px' }}>
          <div style={{ fontWeight: 700, marginBottom: '8px' }}>Cooking days</div>
          {DAYS.map(day => (
            <DayToggle key={day} day={day} mode={(state.dayConfig[day] as DayMode) ?? 'home'} onChange={mode => actions.setDayMode(day, mode)} />
          ))}
          {state.plan && (
            <div style={{ marginTop: '12px' }}>
              <Secondary muted onClick={() => { actions.generate(); setStep('plan'); showToast('Plan regenerated!'); }}>🔄 Regenerate plan</Secondary>
            </div>
          )}
        </div>
      </Section>

      <Section>
        <div style={{ fontWeight: 700, marginBottom: '10px' }}>My meals</div>
        {state.customMeals.length === 0 && <div style={{ fontSize: '13px', color: P.muted, marginBottom: '10px' }}>No custom or imported meals yet.</div>}
        {state.customMeals.map(m => {
          const isPublished = m.id ? !!publishedMap[m.id] : false;
          return (
            <div key={m.id} style={{ padding: '8px 0', borderBottom: `1px solid ${P.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>{m.name}</div>
                  <div style={{ fontSize: '11px', color: P.muted }}>{m.time} · {m.cuisine}{m.sourceUrl ? ' · 🔗 Imported' : ''}{isPublished ? ' · 👥 Shared' : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={() => setEditMealTarget(m)}
                    style={{ background: 'none', border: 'none', color: P.accent, cursor: 'pointer', fontSize: '15px', padding: '4px 6px' }}>✎</button>
                  <button onClick={() => { if (m.id) actions.removeMeal(m.id); }}
                    style={{ background: 'none', border: 'none', color: P.muted, cursor: 'pointer', fontSize: '18px', padding: '4px 6px' }}>✕</button>
                </div>
              </div>
              {!isPublished ? (
                <button onClick={() => handlePublish(m)} disabled={publishingId === m.id}
                  style={{ marginTop: '5px', background: 'none', border: `1px solid ${P.border}`, borderRadius: '6px', padding: '3px 10px', fontSize: '11px', fontWeight: 700, color: P.muted, cursor: 'pointer' }}>
                  {publishingId === m.id ? 'Publishing…' : '👥 Share with community'}
                </button>
              ) : (
                <button onClick={() => handleUnpublish(m)}
                  style={{ marginTop: '5px', background: 'none', border: `1px solid ${P.border}`, borderRadius: '6px', padding: '3px 10px', fontSize: '11px', fontWeight: 700, color: P.accent, cursor: 'pointer' }}>
                  ✓ Shared · Remove
                </button>
              )}
            </div>
          );
        })}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '12px' }}>
          <button onClick={() => setShowPhotoImport(true)}
            style={{ background: P.accentLight, border: 'none', borderRadius: '8px', padding: '9px', fontSize: '12px', fontWeight: 700, color: P.accentDark, cursor: 'pointer' }}>
            📷 From photo
          </button>
          <button onClick={() => setShowImport(true)}
            style={{ background: P.accentLight, border: 'none', borderRadius: '8px', padding: '9px', fontSize: '12px', fontWeight: 700, color: P.accentDark, cursor: 'pointer' }}>
            🔗 From URL
          </button>
          <button onClick={() => setAddMealOpen(true)}
            style={{ background: P.greenLight, border: 'none', borderRadius: '8px', padding: '9px', fontSize: '12px', fontWeight: 700, color: P.greenDark, cursor: 'pointer' }}>
            + Manual
          </button>
        </div>
      </Section>

      <Section>
        <div style={{ fontWeight: 700, marginBottom: '8px' }}>Pantry</div>
        <div style={{ fontSize: '13px', color: P.muted, marginBottom: '8px' }}>Items you always have — excluded from the shopping list.</div>
        <textarea value={pantryDraft}
          onChange={e => setPantryDraft(e.target.value)}
          onBlur={e => actions.setPreferences({ pantry: e.target.value })}
          placeholder="olive oil, salt, pepper, garlic, onion"
          style={{ width: '100%', padding: '10px 12px', border: `2px solid ${P.border}`, borderRadius: '10px', fontSize: '14px', background: P.card, resize: 'vertical', minHeight: '80px', boxSizing: 'border-box' }} />
      </Section>

      <Section>
        <div style={{ fontWeight: 700, marginBottom: '12px' }}>Tastes</div>
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>
            Favourites ({state.preferences.favourites.length})
          </div>
          {state.preferences.favourites.length === 0
            ? <div style={{ fontSize: '13px', color: P.muted }}>Star a meal to add it here.</div>
            : state.preferences.favourites.map(name => (
              <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0' }}>
                <span style={{ fontSize: '14px' }}>⭐ {name}</span>
                <button onClick={() => actions.toggleFav(name)} style={{ background: 'none', border: 'none', color: P.muted, cursor: 'pointer' }}>✕</button>
              </div>
            ))
          }
        </div>
        <div style={{ borderTop: `1px solid ${P.border}`, paddingTop: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>
            Won't cook ({state.preferences.dislikes.length})
          </div>
          {state.preferences.dislikes.length === 0
            ? <div style={{ fontSize: '13px', color: P.muted }}>Thumbs-down a meal to add it here.</div>
            : state.preferences.dislikes.map(name => (
              <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0' }}>
                <span style={{ fontSize: '14px' }}>👎 {name}</span>
                <button onClick={() => actions.setPreferences({ dislikes: state.preferences.dislikes.filter(d => d !== name) })}
                  style={{ background: 'none', border: 'none', color: P.muted, cursor: 'pointer' }}>✕</button>
              </div>
            ))
          }
        </div>
      </Section>

      <Section>
        <div style={{ fontWeight: 700, marginBottom: '8px' }}>Cook history</div>
        {state.cookHistory.length === 0
          ? <div style={{ fontSize: '13px', color: P.muted, marginBottom: '8px' }}>No meals logged yet.</div>
          : [...state.cookHistory]
              .sort((a, b) => b.date - a.date)
              .slice(0, 8)
              .map((h, i, arr) => (
                <div key={`${h.name}-${h.date}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px',
                  borderBottom: i < arr.length - 1 ? `1px solid ${P.border}` : 'none' }}>
                  <span>{h.name}</span>
                  <span style={{ color: P.muted }}>{formatLastUsed(h.date)}</span>
                </div>
              ))
        }
        <button onClick={() => { actions.clearHistory(); showToast('Cook history cleared'); }}
          style={{ background: 'none', border: 'none', color: P.muted, fontSize: '13px', cursor: 'pointer', padding: 0, marginTop: '8px' }}>
          Clear history
        </button>
      </Section>

      <div style={{ marginBottom: '10px' }}>
        <button onClick={() => setShowAdvanced(x => !x)}
          style={{ background: 'none', border: 'none', fontWeight: 700, fontSize: '14px', color: P.muted, cursor: 'pointer', padding: '8px 0', width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>{showAdvanced ? '▲' : '▼'}</span> Advanced
        </button>
        {showAdvanced && <Section><LogsPanel /></Section>}
      </div>

      <Section>
        <div style={{ fontWeight: 700, marginBottom: '12px' }}>Account</div>
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '13px', color: P.muted, marginBottom: '8px' }}>Share your invite code so others can join your household.</div>
          {inviteCode ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ flex: 1, background: P.bg, border: `1.5px solid ${P.border}`, borderRadius: '8px', padding: '9px 12px', fontFamily: 'monospace', fontSize: '15px', fontWeight: 700, letterSpacing: '2px', color: P.accent }}>
                {inviteCode}
              </div>
              <button onClick={() => { navigator.clipboard?.writeText(inviteCode); showToast('Copied!'); }}
                style={{ background: P.accentLight, border: 'none', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', fontWeight: 700, color: P.accentDark, cursor: 'pointer', flexShrink: 0 }}>
                Copy
              </button>
            </div>
          ) : (
            <button onClick={async () => { setInviteLoading(true); const code = await getHouseholdInviteCode(householdId); setInviteCode(code); setInviteLoading(false); }}
              disabled={inviteLoading}
              style={{ background: P.accentLight, border: 'none', borderRadius: '8px', padding: '9px 14px', fontSize: '13px', fontWeight: 700, color: P.accentDark, cursor: 'pointer', opacity: inviteLoading ? 0.7 : 1 }}>
              {inviteLoading ? 'Loading…' : '🔗 Show invite code'}
            </button>
          )}
        </div>
        <div style={{ borderTop: `1px solid ${P.border}`, paddingTop: '12px' }}>
          <button onClick={() => { if (window.confirm('Leave this household? You can rejoin with the invite code.')) onLeave(); }}
            style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: '14px', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
            Leave household
          </button>
        </div>
      </Section>

      {toast && <Toast message={toast} onUndo={toastUndoRef.current ?? undefined} />}

      {showImport && (
        <Modal onClose={() => setShowImport(false)}>
          <ImportRecipe
            onImport={async meal => { await actions.addMeal(meal); setShowImport(false); showToast(`${meal.name} added!`); }}
            onCancel={() => setShowImport(false)}
          />
        </Modal>
      )}

      {showPhotoImport && (
        <PhotoImport
          onImport={async meal => {
            // Upload photo to storage if we have a data URL — replace with storage URL
            if (meal.photo?.startsWith('data:')) {
              const res = await fetch(meal.photo);
              const blob = await res.blob();
              const file = new File([blob], 'recipe.jpg', { type: blob.type });
              const url = await uploadRecipePhoto(file);
              if (url) meal = { ...meal, photo: url };
            }
            await actions.addMeal(meal);
            setShowPhotoImport(false);
            showToast(`${meal.name} added!`);
          }}
          onCancel={() => setShowPhotoImport(false)}
        />
      )}

      {addMealOpen && (
        <Modal onClose={() => setAddMealOpen(false)}>
          <AddMealForm
            onSave={async meal => { await actions.addMeal(meal); setAddMealOpen(false); showToast(`${meal.name} added!`); }}
            onCancel={() => setAddMealOpen(false)}
          />
        </Modal>
      )}

      {editMealTarget && (
        <Modal onClose={() => setEditMealTarget(null)}>
          <AddMealForm
            initial={editMealTarget}
            onSave={async meal => { await actions.editMeal({ ...meal, id: editMealTarget.id }); setEditMealTarget(null); showToast(`${meal.name} updated!`); }}
            onCancel={() => setEditMealTarget(null)}
          />
        </Modal>
      )}
      <BottomNav
        onPlan={() => setStep('plan')}
        onShopping={() => setStep('shopping')}
        onBrowse={() => setStep('browse')}
        onProfile={() => setStep('prefs')}
        active="profile"
      />
    </Screen>
  );

  return <Spinner />;
}
