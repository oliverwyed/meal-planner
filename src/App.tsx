import { useState, useEffect, useCallback, useRef } from 'react';
import { HouseholdGate } from './components/HouseholdGate';
import { CookingMode } from './components/CookingMode';
import { EventsScreen } from './components/Events';
import { Primary, Secondary, Spinner, Section, TimeSlider, BottomNav } from './components/ui';
import { Screen, Header, Row, Stepper, Chip, DayToggle } from './components/AppUI';
import { useHousehold } from './hooks/useHousehold';
import { useCommunityMeals } from './hooks/useCommunityMeals';
import { DAYS, HOUSEHOLD_ID_KEY, P, DESKTOP_BREAKPOINT } from './lib/constants';
import type { DayMode, Meal } from './lib/types';
import { clearHouseholdCache } from './lib/localCache';
import { playBeep } from './lib/timers';
import { log, logFetch, recordCost } from './lib/logger';
import { publishMeal, unpublishMeal, authSignOut } from './lib/supabase';
import { PlanScreen } from './screens/PlanScreen';
import { ShoppingScreen } from './screens/ShoppingScreen';
import { BrowseScreen } from './screens/BrowseScreen';
import { PrefsScreen } from './screens/PrefsScreen';
import RECIPES from './data/recipes.json';

const ALL_RECIPES = RECIPES as Meal[];

export type Step = 'setup' | 'plan' | 'shopping' | 'prefs' | 'browse' | 'events';

export default function App() {
  const [householdId, setHouseholdId] = useState<string | null>(() => localStorage.getItem(HOUSEHOLD_ID_KEY));

  if (!householdId) {
    return <HouseholdGate onReady={id => { localStorage.setItem(HOUSEHOLD_ID_KEY, id); setHouseholdId(id); }} />;
  }
  return <AppInner householdId={householdId} onLeave={() => { localStorage.removeItem(HOUSEHOLD_ID_KEY); clearHouseholdCache(householdId); setHouseholdId(null); authSignOut(); }} />;
}

function AppInner({ householdId, onLeave }: { householdId: string; onLeave: () => void }) {
  const { state, actions, loading } = useHousehold(householdId);
  const [step, setStep] = useState<Step>('setup');
  const [toast, setToast] = useState<string | null>(null);
  const [isFirstRun, setIsFirstRun] = useState(() => !localStorage.getItem('onboardingDone'));
  const [onboardStep, setOnboardStep] = useState<1 | 2 | 3>(1);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toastUndoRef = useRef<(() => void) | null>(null);
  const [timers, setTimers] = useState<{ id: string; label: string; remaining: number; total: number; done: boolean }[]>([]);
  const [nutritionCache, setNutritionCache] = useState<Record<string, { calories: number; protein: number; carbs: number; fat: number }>>({});
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= DESKTOP_BREAKPOINT);
  const [cookingMeal, setCookingMeal] = useState<{ meal: Meal; familySize: number } | null>(null);
  const [nutritionLoading, setNutritionLoading] = useState<Set<string>>(new Set());

  // Community meals (pre-seeded from localStorage cache; network-refreshed on Browse tab open)
  const { communityMeals, communityLoading, setCommunityMeals, setCommunityLoading } = useCommunityMeals();
  const [publishingId, setPublishingId] = useState<string | null>(null);
  // map custom meal id → communityId (if published)
  const [publishedMap, setPublishedMap] = useState<Record<string, string>>({});

  const didAutoNav = useRef(false);

  const goToStep = useCallback((s: string) => setStep(s as Step), []);

  const showToast = useCallback((msg: string, undo?: () => void) => {
    setToast(msg);
    toastUndoRef.current = undo ?? null;
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => { setToast(null); toastUndoRef.current = null; }, 4000);
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

  useEffect(() => {
    if (!loading && (state.plan || state.nextWeekPlan) && !didAutoNav.current) {
      didAutoNav.current = true;
      setStep('plan');
    }
  }, [loading, state.plan, state.nextWeekPlan]);

  useEffect(() => {
    if (step === 'plan' && !state.plan && !state.nextWeekPlan && !loading) setStep('setup');
    if (step === 'shopping' && !state.shopList && !state.nextWeekShopList && !loading) setStep('plan');
    // Guard against overriding plan auto-nav when cache hit causes loading=false immediately
    if (step === 'setup' && !isFirstRun && !didAutoNav.current) setStep('prefs');
  }, [step, state.plan, state.nextWeekPlan, state.shopList, loading, isFirstRun]);

  useEffect(() => {
    const titles: Record<Step, string> = {
      setup: 'Meal Planner',
      plan: 'Your plan — Meal Planner',
      shopping: 'Shopping list — Meal Planner',
      browse: 'Recipes — Meal Planner',
      prefs: 'Account — Meal Planner',
      events: 'Events — Meal Planner',
    };
    document.title = titles[step] ?? 'Meal Planner';
  }, [step]);

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
    return (
      <PlanScreen
        state={state}
        actions={actions}
        isDesktop={isDesktop}
        timers={timers}
        addTimer={addTimer}
        dismissTimer={dismissTimer}
        estimateNutrition={estimateNutrition}
        nutritionLoading={nutritionLoading}
        nutritionCache={nutritionCache}
        adaptRecipe={adaptRecipe}
        setCookingMeal={setCookingMeal}
        showToast={showToast}
        toast={toast}
        toastUndoRef={toastUndoRef}
        setStep={goToStep}
      />
    );
  }

  // ── Shopping screen ───────────────────────────────────────────────────────
  if (step === 'shopping' && (state.shopList || state.nextWeekShopList)) {
    return (
      <ShoppingScreen
        state={state}
        actions={actions}
        showToast={showToast}
        toast={toast}
        toastUndoRef={toastUndoRef}
        setStep={goToStep}
      />
    );
  }

  // ── Browse screen ─────────────────────────────────────────────────────────
  if (step === 'browse') {
    return (
      <BrowseScreen
        state={state}
        actions={actions}
        addTimer={addTimer}
        estimateNutrition={estimateNutrition}
        nutritionLoading={nutritionLoading}
        nutritionCache={nutritionCache}
        adaptRecipe={adaptRecipe}
        setCookingMeal={setCookingMeal}
        communityMeals={communityMeals}
        communityLoading={communityLoading}
        setCommunityMeals={setCommunityMeals}
        setCommunityLoading={setCommunityLoading}
        showToast={showToast}
        toast={toast}
        toastUndoRef={toastUndoRef}
        setStep={goToStep}
      />
    );
  }

  // ── Me screen (merged settings + prefs) ──────────────────────────────────
  if (step === 'prefs') {
    return (
      <PrefsScreen
        state={state}
        actions={actions}
        householdId={householdId}
        publishedMap={publishedMap}
        publishingId={publishingId}
        onPublish={handlePublish}
        onUnpublish={handleUnpublish}
        showToast={showToast}
        toast={toast}
        toastUndoRef={toastUndoRef}
        setStep={goToStep}
        onLeave={onLeave}
      />
    );
  }

  if (step === 'events') return (
    <Screen>
      <EventsScreen
        events={state.events ?? []}
        allMeals={[...ALL_RECIPES, ...state.customMeals]}
        pantry={state.preferences.pantry}
        onCreateEvent={actions.createEvent}
        onUpdateEvent={actions.updateEvent}
        onDeleteEvent={actions.deleteEvent}
      />
      <BottomNav
        onPlan={() => setStep('plan')}
        onShopping={() => setStep('shopping')}
        onBrowse={() => setStep('browse')}
        onEvents={() => setStep('events')}
        onProfile={() => setStep('prefs')}
        active="events"
      />
    </Screen>
  );

  return <Spinner />;
}
