import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HouseholdGate } from './components/HouseholdGate';
import { MealCard } from './components/MealCard';
import { CookingMode } from './components/CookingMode';
import { ImportRecipe } from './components/ImportRecipe';
import { Primary, Secondary, Toast, Spinner, Section, TimeSlider, ActiveTimers } from './components/ui';
import { useHousehold } from './hooks/useHousehold';
import { DAYS, HOUSEHOLD_ID_KEY, P, DESKTOP_BREAKPOINT } from './lib/constants';
import type { DayName, DayMode, KidsMode, Meal } from './lib/types';
import { playBeep } from './lib/timers';
import { CAT_EMOJI } from './lib/shopping';
import RECIPES from './data/recipes.json';

const ALL_RECIPES = RECIPES as Meal[];

type Step = 'setup' | 'plan' | 'shopping' | 'prefs';

const SEASON_INFO: Record<string, { label: string }> = {
  spring: { label: '🌸 Spring' }, summer: { label: '☀️ Summer' },
  autumn: { label: '🍂 Autumn' }, winter: { label: '❄️ Winter' },
};

function formatLastUsed(date: number | null): string | null {
  if (!date) return null;
  const days = Math.round((Date.now() - date) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days}d ago`;
  return `${Math.round(days / 7)}w ago`;
}

export default function App() {
  const [householdId, setHouseholdId] = useState<string | null>(() => localStorage.getItem(HOUSEHOLD_ID_KEY));

  if (!householdId) {
    return <HouseholdGate onReady={id => { localStorage.setItem(HOUSEHOLD_ID_KEY, id); setHouseholdId(id); }} />;
  }
  return <AppInner householdId={householdId} onLeave={() => { localStorage.removeItem(HOUSEHOLD_ID_KEY); setHouseholdId(null); }} />;
}

function AppInner({ householdId, onLeave }: { householdId: string; onLeave: () => void }) {
  const { state, actions, loading } = useHousehold(householdId);
  const [step, setStep] = useState<Step>('setup');
  const [previewDay, setPreviewDay] = useState<DayName | null>(null);
  const [expandedDay, setExpandedDay] = useState<DayName | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(sessionStorage.getItem('shopChecked') ?? '{}'); } catch { return {}; }
  });
  const [pickerFor, setPickerFor] = useState<DayName | 'cookNow' | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [addMealOpen, setAddMealOpen] = useState(false);
  const [editMealTarget, setEditMealTarget] = useState<Meal | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(() => localStorage.getItem('hintDismissed') === '1');
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

  const estimateNutrition = useCallback(async (meal: Meal) => {
    if (nutritionCache[meal.name]) return;
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/get-nutrition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
        body: JSON.stringify({ ingredients: meal.ingredients, serves: meal.serves, name: meal.name }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setNutritionCache(prev => ({ ...prev, [meal.name]: data }));
    } catch {
      // silently fail
    }
  }, [nutritionCache]);

  const didAutoNav = useRef(false);

  useEffect(() => {
    if (!loading && state.plan && !didAutoNav.current) {
      didAutoNav.current = true;
      setStep('plan');
    }
  }, [loading, state.plan]);

  useEffect(() => {
    if (step === 'plan' && !state.plan && !loading) setStep('setup');
    if (step === 'shopping' && !state.shopList && !loading) setStep('plan');
  }, [step, state.plan, state.shopList, loading]);

  useEffect(() => {
    sessionStorage.setItem('shopChecked', JSON.stringify(checked));
  }, [checked]);

  useEffect(() => { setPantryDraft(state.preferences.pantry); }, [state.preferences.pantry]);

  const si = SEASON_INFO[state.season] ?? { label: '' };

  if (loading) return <Spinner />;

  // ── Setup screen ──────────────────────────────────────────────────────────
  if (step === 'setup') return (
    <Screen>
      <Header eyebrow="Meal Planner" title="Set up your week" subtitle="Choose your days and preferences" />
      <Section>
        <Row label="People eating">
          <Stepper value={state.familySize} min={1} max={12} onChange={actions.setFamilySize} />
        </Row>
      </Section>
      <Section>
        <Row label="Max cook time"><span /></Row>
        <TimeSlider value={state.preferences.timeFilter} onChange={v => actions.setPreferences({ timeFilter: v })} />
      </Section>
      <Section>
        <Row label="Dietary"><span /></Row>
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          {([['none','All'],['noFish','No fish'],['noPork','No pork'],['noRed','No red meat'],['veggie','🌱 Veggie']] as [string,string][]).map(([v,l]) => (
            <Chip key={v} active={state.preferences.dietaryMode === v} onClick={() => actions.setPreferences({ dietaryMode: v as any })}>{l}</Chip>
          ))}
        </div>
      </Section>
      {DAYS.map(day => (
        <DayToggle key={day} day={day} mode={(state.dayConfig[day] as DayMode) ?? 'home'} onChange={mode => actions.setDayMode(day, mode)} />
      ))}
      <div style={{ marginTop: '16px' }}>
        <Primary onClick={() => { actions.generate(); setStep('plan'); }}>Generate this week's meals</Primary>
        {state.plan && <Secondary onClick={() => setStep('plan')}>Back to plan</Secondary>}
      </div>
    </Screen>
  );

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
  if (step === 'plan' && state.plan) return (
    <div style={{ display: isDesktop ? 'flex' : 'block', minHeight: '100vh', background: P.bg }}>
      {/* Desktop sidebar */}
      {isDesktop && (
        <div style={{ width: '220px', background: P.card, borderRight: `1px solid ${P.border}`, position: 'sticky', top: 0, height: '100vh', display: 'flex', flexDirection: 'column', padding: '24px 0', flexShrink: 0 }}>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '20px', padding: '0 20px 20px', borderBottom: `1px solid ${P.border}`, marginBottom: '12px' }}>🍽️ Meal Planner</div>
          {(['plan', 'shopping', 'setup'] as const).map(s => {
            const labels: Record<string, string> = { plan: '📅 Plan', shopping: '🛒 Shopping', setup: '⚙️ Settings' };
            const active = s === 'plan';
            return (
              <button key={s} onClick={() => setStep(s === 'shopping' ? 'shopping' : s === 'setup' ? 'setup' : 'plan')}
                style={{ background: active ? P.accentLight : 'none', border: 'none', borderRadius: '10px', margin: '2px 12px', padding: '9px 12px', fontSize: '14px', fontWeight: 700, color: active ? P.accentDark : P.muted, cursor: 'pointer', textAlign: 'left' }}>
                {labels[s]}
              </button>
            );
          })}
          <button onClick={() => setStep('prefs')}
            style={{ background: 'none', border: 'none', borderRadius: '10px', margin: '2px 12px', padding: '9px 12px', fontSize: '14px', fontWeight: 700, color: P.muted, cursor: 'pointer', textAlign: 'left' }}>
            👤 Preferences
          </button>
        </div>
      )}
      <div style={{ flex: 1, maxWidth: isDesktop ? 'none' : '480px', margin: isDesktop ? '0' : '0 auto', padding: '0 16px', paddingBottom: '100px', overflowX: 'hidden' }}>
      <div style={{ padding: '24px 0 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: P.accent, fontWeight: 700, marginBottom: '5px' }}>Your week</div>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '22px', lineHeight: 1.3, marginBottom: '4px' }}>Here's the plan</div>
            {(() => {
              const isStale = Date.now() - state.plan.generatedAt > 7 * 24 * 60 * 60 * 1000;
              return (
                <div style={{ fontSize: '12px', color: isStale ? P.accent : P.muted, fontWeight: isStale ? 600 : 400, marginBottom: '6px' }}>
                  Generated {formatLastUsed(state.plan.generatedAt) ?? 'today'}{isStale ? ' — time to refresh?' : ''}
                </div>
              );
            })()}
          </div>
          <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
            <IconBtn onClick={() => setShowHelp(true)} title="How it works">ℹ️</IconBtn>
            <IconBtn onClick={() => setStep('setup')} title="Settings">⚙️</IconBtn>
            <IconBtn onClick={() => setStep('prefs')} title="Preferences">👤</IconBtn>
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

      <div style={isDesktop ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' } : {}}>
      {DAYS.map(day => {
        const mode = (state.dayConfig[day] as DayMode) ?? 'home';

        if (mode === 'off') return (
          <div key={day} style={{ background: P.card, borderRadius: '16px', padding: '15px 16px', marginBottom: '10px', boxShadow: P.shadow, border: `1px solid ${P.border}`, opacity: 0.5 }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ fontSize: '26px', flexShrink: 0, paddingTop: '2px' }}>—</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '12px', color: P.accent, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{day}</div>
                <div style={{ fontWeight: 700, fontSize: '16px', color: P.muted }}>Day off</div>
              </div>
            </div>
            <DayActions onHome={() => actions.setDayMode(day, 'home')} onGousto={() => actions.setDayMode(day, 'gousto')} />
          </div>
        );

        if (mode === 'gousto') return (
          <div key={day} style={{ background: P.card, borderRadius: '16px', padding: '15px 16px', marginBottom: '10px', boxShadow: P.shadow, border: `1px solid ${P.border}`, opacity: 0.6 }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ fontSize: '26px', flexShrink: 0, paddingTop: '2px' }}>📦</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '12px', color: P.accent, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{day}</div>
                <div style={{ fontWeight: 700, fontSize: '16px' }}>Gousto</div>
                <div style={{ fontSize: '13px', color: P.muted }}>Meal kit — sorted!</div>
              </div>
            </div>
            <DayActions onHome={() => actions.setDayMode(day, 'home')} onOff={() => actions.setDayMode(day, 'off')} />
          </div>
        );

        const meal = state.plan!.meals.find(m => m.day === day);
        if (!meal) return null;

        const lu = state.cookHistory.filter(h => h.name === meal.name);
        const lastUsedStr = formatLastUsed(lu.length ? Math.max(...lu.map(h => h.date)) : null);
        const daySize = state.dayOverrides[day]?.size ?? state.familySize;
        const dayTF = state.dayOverrides[day]?.time ?? state.preferences.timeFilter;

        return (
          <div key={day}>
            <MealCard
              meal={meal} day={day}
              isFav={state.preferences.favourites.includes(meal.name)}
              isSeasonal={!!(meal.seasons?.includes(state.season as any))}
              seasonLabel={si.label}
              overviewOpen={previewDay === day || expandedDay === day}
              expanded={expandedDay === day}
              familySize={daySize}
              onOverview={() => {
                if (previewDay === day || expandedDay === day) {
                  setPreviewDay(null); setExpandedDay(null);
                } else {
                  setPreviewDay(day); setExpandedDay(null);
                }
              }}
              onFullExpand={() => {
                if (expandedDay === day) { setExpandedDay(null); }
                else { setPreviewDay(day); setExpandedDay(day); }
              }}
              onFav={() => actions.toggleFav(meal.name)}
              onSwap={() => { actions.swap(day); setPreviewDay(null); setExpandedDay(null); showToast('Swapped!'); }}
              onDislike={() => {
                const dislikedMeal = meal;
                actions.addDislike(dislikedMeal.name);
                actions.swap(day);
                setPreviewDay(null); setExpandedDay(null);
                showToast("Won't suggest again", () => {
                  actions.setPreferences({ dislikes: state.preferences.dislikes.filter(d => d !== dislikedMeal.name) });
                  actions.replaceMealInPlan(day, dislikedMeal);
                });
              }}
              onChoose={() => setPickerFor(day)}
              onMarkGousto={() => actions.setDayMode(day, 'gousto')}
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
              nutrition={meal.nutrition ?? nutritionCache[meal.name]}
              onCookMode={() => setCookingMeal({ meal, familySize: daySize })}
            />
          </div>
        );
      })}
      </div>

      <ActiveTimers timers={timers} onDismiss={dismissTimer} />

      <div style={{ marginTop: '6px' }}>
        <Primary onClick={() => setStep('shopping')}>View shopping list</Primary>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <Secondary onClick={() => {
            const prevPlan = state.plan;
            const prevOverrides = state.dayOverrides;
            actions.generate();
            setChecked({});
            showToast('New plan generated!', prevPlan ? () => { actions.restorePlan(prevPlan, prevOverrides); setChecked({}); } : undefined);
          }}>🔄 Regenerate</Secondary>
          <Secondary onClick={() => setStep('setup')}>⚙️ Edit days</Secondary>
        </div>
      </div>

      {/* Floating Cook Tonight button */}
      <button onClick={() => {
        const opts = { kids: 'either', size: state.familySize, time: state.preferences.timeFilter, dietary: state.preferences.dietaryMode };
        setCookNowOpts(opts);
        const meal = actions.pickCookNow(opts.time, opts.kids as any, opts.dietary);
        if (meal) { setCookNow(meal); setCookNowExp(true); setCookNowAddToPlan(false); }
        else showToast('No meals match — try relaxing your filters');
      }} style={{ position: 'fixed', bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))', right: '20px', zIndex: 200,
        background: `linear-gradient(135deg, ${P.accent}, ${P.accentDark})`,
        color: '#fff', border: 'none', borderRadius: '28px',
        padding: '14px 20px', fontSize: '15px', fontWeight: 700,
        cursor: 'pointer', boxShadow: '0 4px 20px rgba(79,70,229,0.30)',
        display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
        🍴 Cook tonight
      </button>

      {toast && <Toast message={toast} onUndo={toastUndoRef.current ?? undefined} bottom="80px" />}

      {/* Cook Tonight modal */}
      {cookNow && (() => {
        const rePick = (opts = cookNowOpts) => {
          const meal = actions.pickCookNow(opts.time, opts.kids as any, opts.dietary);
          if (meal) { setCookNow(meal); setCookNowExp(true); }
          else showToast('No meals match — try relaxing your filters');
        };
        const updateOpts = (patch: Partial<typeof cookNowOpts>) => {
          const next = { ...cookNowOpts, ...patch };
          setCookNowOpts(next);
          if (!('size' in patch)) rePick(next);
        };
        const lu = state.cookHistory.filter(h => h.name === cookNow.name);
        const lastUsedStr = formatLastUsed(lu.length ? Math.max(...lu.map(h => h.date)) : null);
        const homeDays = DAYS.filter(d => !state.dayConfig[d] || state.dayConfig[d] === 'home');
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 500 }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '24px 0 40px' } as React.CSSProperties}
              onClick={() => setCookNow(null)}>
              <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0 16px' }} onClick={e => e.stopPropagation()}>
                <div style={{ background: P.bg, borderRadius: '20px', boxShadow: '0 8px 40px rgba(0,0,0,0.22)', overflow: 'hidden' }}>
                  {/* Header */}
                  <div style={{ background: `linear-gradient(135deg, ${P.accent}, ${P.accentDark})`, padding: '20px 20px 16px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '11px', opacity: 0.85, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase' }}>Cook tonight</div>
                      <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '22px', marginTop: '3px' }}>What shall we make?</div>
                    </div>
                    <button onClick={() => setCookNow(null)}
                      style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '10px', padding: '8px 12px', cursor: 'pointer', fontSize: '18px', fontWeight: 700 }}>✕</button>
                  </div>

                  {/* Filters */}
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
                        <button onClick={() => setCookNowOpts(p => ({ ...p, size: Math.max(1, p.size - 1) }))}
                          style={{ background: P.border, border: 'none', borderRadius: '6px', width: '22px', height: '22px', fontSize: '15px', cursor: 'pointer', color: P.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: P.muted, minWidth: '52px', textAlign: 'center' }}>{cookNowOpts.size} people</span>
                        <button onClick={() => setCookNowOpts(p => ({ ...p, size: Math.min(20, p.size + 1) }))}
                          style={{ background: P.border, border: 'none', borderRadius: '6px', width: '22px', height: '22px', fontSize: '15px', cursor: 'pointer', color: P.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                      </div>
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <TimeSlider value={cookNowOpts.time} label="Max cook time" onChange={v => updateOpts({ time: v })} />
                    </div>
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                      {([['none', 'All'], ['noFish', 'No fish'], ['noPork', 'No pork'], ['noRed', 'No red meat'], ['veggie', '🌱 Veggie']] as [string, string][]).map(([v, l]) => (
                        <button key={v} onClick={() => updateOpts({ dietary: v })}
                          style={{ background: cookNowOpts.dietary === v ? P.greenLight : 'transparent', border: `1.5px solid ${cookNowOpts.dietary === v ? P.greenDark : P.border}`, borderRadius: '20px', padding: '3px 9px', fontSize: '11px', fontWeight: 700, color: cookNowOpts.dietary === v ? P.greenDark : P.muted, cursor: 'pointer' }}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Suggested meal card */}
                  <div style={{ padding: '16px' }}>
                    <MealCard meal={cookNow} day="Tonight"
                      isFav={state.preferences.favourites.includes(cookNow.name)}
                      isSeasonal={!!(cookNow.seasons?.includes(state.season as any))}
                      seasonLabel={si.label}
                      overviewOpen={true}
                      expanded={cookNowExp}
                      familySize={cookNowOpts.size}
                      onOverview={() => setCookNowExp(x => !x)}
                      onFullExpand={() => setCookNowExp(x => !x)}
                      onFav={() => actions.toggleFav(cookNow.name)}
                      onSwap={() => rePick()}
                      onDislike={() => {
                        const prev = cookNow;
                        actions.addDislike(prev.name);
                        rePick();
                        showToast("Won't suggest again", () => {
                          actions.setPreferences({ dislikes: state.preferences.dislikes.filter(d => d !== prev.name) });
                          setCookNow(prev); setCookNowExp(true);
                        });
                      }}
                      lastUsedStr={lastUsedStr}
                    />
                  </div>

                  {/* Actions */}
                  <div style={{ padding: '0 16px 20px' }}>
                    <Primary onClick={() => rePick()}>🔀 Suggest something else</Primary>
                    <Secondary muted onClick={() => { actions.addToHistory([{ name: cookNow.name }]); setCookNow(null); showToast('Logged as cooked!'); }}>✓ Cooked it</Secondary>
                    <button onClick={() => setPickerFor('cookNow')}
                      style={{ width: '100%', background: 'none', border: 'none', color: P.muted, fontSize: '14px', fontWeight: 600, cursor: 'pointer', marginTop: '4px', padding: '4px' }}>
                      📋 Browse all meals
                    </button>
                    {state.plan && homeDays.length > 0 && (
                      <>
                        <button onClick={() => setCookNowAddToPlan(x => !x)}
                          style={{ width: '100%', background: 'none', border: 'none', color: P.muted, fontSize: '14px', fontWeight: 600, cursor: 'pointer', marginTop: '4px', padding: '4px' }}>
                          📅 Add to this week's plan
                        </button>
                        {cookNowAddToPlan && (
                          <div style={{ marginTop: '12px', background: P.card, borderRadius: '14px', padding: '10px 14px', border: `1px solid ${P.border}` }}>
                            <div style={{ fontSize: '11px', color: P.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Replace which day?</div>
                            {homeDays.map((d, idx) => {
                              const existing = state.plan!.meals.find(m => m.day === d);
                              return (
                                <div key={d} onClick={() => { actions.replaceMealInPlan(d, cookNow); setCookNow(null); showToast(`${d}: ${cookNow.name}`); }}
                                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 4px', cursor: 'pointer', borderBottom: idx < homeDays.length - 1 ? `1px solid ${P.border}` : 'none' }}>
                                  <div style={{ fontWeight: 700, fontSize: '13px', minWidth: '72px' }}>{d}</div>
                                  <div style={{ fontSize: '12px', color: P.muted, textAlign: 'right', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{existing ? existing.name : '—'}</div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
                actions.replaceMealInPlan(pickerFor as DayName, meal); setPickerFor(null); showToast(`Switched to ${meal.name}`);
              }
            }}
            onToggleFav={actions.toggleFav}
            onDislike={name => { actions.addDislike(name); showToast('Marked as disliked'); }}
          />
        </Modal>
      )}

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      </div>
    </div>
  );

  // ── Shopping screen ───────────────────────────────────────────────────────
  if (step === 'shopping' && state.shopList) return (
    <Screen>
      <Header eyebrow="Shopping" title="What to buy" actions={<IconBtn onClick={() => setStep('plan')} title="Back">←</IconBtn>} />
      <div style={{ fontSize: '13px', color: P.muted, marginBottom: '16px' }}>
        {Object.values(state.shopList).flat().length} items · {Object.values(checked).filter(Boolean).length} checked
      </div>
      {Object.entries(state.shopList).map(([cat, items]) => (
        <Section key={cat}>
          <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '10px' }}>{CAT_EMOJI[cat]} {cat}</div>
          {items.map((item, i) => {
            const key = `${cat}:${item.display}`;
            return (
              <div key={i} onClick={() => setChecked(prev => ({ ...prev, [key]: !prev[key] }))}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0',
                  borderBottom: i < items.length - 1 ? `1px solid ${P.border}` : 'none', cursor: 'pointer' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '7px', border: `2px solid ${checked[key] ? P.green : P.border}`,
                  background: checked[key] ? P.greenLight : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, fontSize: '13px', color: P.greenDark, fontWeight: 700 }}>
                  {checked[key] ? '✓' : ''}
                </div>
                <div style={{ fontSize: '14px', textDecoration: checked[key] ? 'line-through' : 'none',
                  color: checked[key] ? P.muted : P.text, flex: 1 }}>
                  {item.display}
                </div>
              </div>
            );
          })}
        </Section>
      ))}
      <Primary onClick={() => {
        const mealLines = state.plan!.meals.map(m => `${m.day}: ${m.name}`).join('\n');
        const lines = Object.entries(state.shopList!).map(([cat, items]) => {
          const unchecked = items.filter(item => !checked[`${cat}:${item.display}`]);
          if (!unchecked.length) return '';
          return `${CAT_EMOJI[cat] ?? '•'} ${cat}\n${unchecked.map(i => `  • ${i.display}`).join('\n')}`;
        }).filter(Boolean).join('\n\n');
        const hasChecked = Object.values(checked).some(Boolean);
        const body = `🛒 Shopping list${hasChecked ? ' (remaining)' : ''} — serves ${state.familySize}\n\n📅 This week\n${mealLines}\n\n${lines}`;
        if (navigator.share) navigator.share({ title: 'Shopping List', text: body }).catch(() => {});
        else navigator.clipboard?.writeText(body).then(() => showToast('Copied!'));
      }}>🔗 Share list</Primary>
      <Secondary muted onClick={() => setStep('plan')}>Back to meals</Secondary>
      {toast && <Toast message={toast} onUndo={toastUndoRef.current ?? undefined} />}
    </Screen>
  );

  // ── Prefs screen ──────────────────────────────────────────────────────────
  if (step === 'prefs') return (
    <Screen>
      <Header eyebrow="Preferences" title="Your settings" actions={<IconBtn onClick={() => setStep('plan')} title="Back">←</IconBtn>} />

      <Section>
        <div style={{ fontWeight: 700, marginBottom: '8px' }}>Household</div>
        <div style={{ fontSize: '13px', color: P.muted, marginBottom: '10px' }}>Share this code so your partner can join on their device.</div>
        {inviteCode && <div style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '2px', marginBottom: '8px', color: P.text }}>{inviteCode}</div>}
        <button disabled={inviteLoading} onClick={async () => {
          if (inviteCode) {
            navigator.clipboard?.writeText(inviteCode).then(() => showToast('Invite code copied!'));
            return;
          }
          setInviteLoading(true);
          try {
            const { supabase } = await import('./lib/supabase');
            const { data } = await supabase.from('households').select('invite_code').eq('id', householdId).single();
            if (data?.invite_code) {
              setInviteCode(data.invite_code);
              navigator.clipboard?.writeText(data.invite_code).then(() => showToast('Invite code copied!'));
            } else {
              showToast('Could not load invite code');
            }
          } catch {
            showToast('Could not load invite code');
          } finally {
            setInviteLoading(false);
          }
        }} style={{ background: inviteLoading ? P.border : P.accentLight, border: 'none', borderRadius: '8px', padding: '7px 14px', fontSize: '13px', fontWeight: 700, color: inviteLoading ? P.muted : P.accentDark, cursor: inviteLoading ? 'default' : 'pointer' }}>
          {inviteLoading ? 'Loading…' : '📋 Copy invite code'}
        </button>
      </Section>

      <Section>
        <div style={{ fontWeight: 700, marginBottom: '10px' }}>My meals</div>
        {state.customMeals.length === 0 && <div style={{ fontSize: '13px', color: P.muted, marginBottom: '10px' }}>No custom or imported meals yet.</div>}
        {state.customMeals.map(m => (
          <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${P.border}` }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>{m.name}</div>
              <div style={{ fontSize: '11px', color: P.muted }}>{m.time} · {m.cuisine}{m.sourceUrl ? ' · 🔗 Imported' : ''}</div>
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button onClick={() => setEditMealTarget(m)}
                style={{ background: 'none', border: 'none', color: P.accent, cursor: 'pointer', fontSize: '15px', padding: '4px 6px' }}>✎</button>
              <button onClick={() => { if (m.id) actions.removeMeal(m.id); }}
                style={{ background: 'none', border: 'none', color: P.muted, cursor: 'pointer', fontSize: '18px', padding: '4px 6px' }}>✕</button>
            </div>
          </div>
        ))}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px' }}>
          <button onClick={() => setShowImport(true)}
            style={{ background: P.accentLight, border: 'none', borderRadius: '8px', padding: '9px', fontSize: '13px', fontWeight: 700, color: P.accentDark, cursor: 'pointer' }}>
            🔗 Import from URL
          </button>
          <button onClick={() => setAddMealOpen(true)}
            style={{ background: P.greenLight, border: 'none', borderRadius: '8px', padding: '9px', fontSize: '13px', fontWeight: 700, color: P.greenDark, cursor: 'pointer' }}>
            + Add manually
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
        <div style={{ fontWeight: 700, marginBottom: '8px' }}>Favourites ({state.preferences.favourites.length})</div>
        {state.preferences.favourites.length === 0
          ? <div style={{ fontSize: '13px', color: P.muted }}>Star a meal from the plan view.</div>
          : state.preferences.favourites.map(name => (
            <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
              <span style={{ fontSize: '14px' }}>⭐ {name}</span>
              <button onClick={() => actions.toggleFav(name)} style={{ background: 'none', border: 'none', color: P.muted, cursor: 'pointer' }}>✕</button>
            </div>
          ))
        }
      </Section>

      <Section>
        <div style={{ fontWeight: 700, marginBottom: '8px' }}>Dislikes ({state.preferences.dislikes.length})</div>
        {state.preferences.dislikes.length === 0
          ? <div style={{ fontSize: '13px', color: P.muted }}>Thumbs-down a meal to add it here.</div>
          : state.preferences.dislikes.map(name => (
            <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
              <span style={{ fontSize: '14px' }}>👎 {name}</span>
              <button onClick={() => actions.setPreferences({ dislikes: state.preferences.dislikes.filter(d => d !== name) })}
                style={{ background: 'none', border: 'none', color: P.muted, cursor: 'pointer' }}>✕</button>
            </div>
          ))
        }
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

      <Secondary muted onClick={() => { if (window.confirm('Leave this household? You can rejoin with the invite code.')) onLeave(); }}>
        Leave household
      </Secondary>

      {toast && <Toast message={toast} onUndo={toastUndoRef.current ?? undefined} />}

      {showImport && (
        <Modal onClose={() => setShowImport(false)}>
          <ImportRecipe
            onImport={async meal => { await actions.addMeal(meal); setShowImport(false); showToast(`${meal.name} added!`); }}
            onCancel={() => setShowImport(false)}
          />
        </Modal>
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
    </Screen>
  );

  return <Spinner />;
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function Screen({ children, padBottom }: { children: React.ReactNode; padBottom?: string }) {
  return (
    <div style={{ minHeight: '100vh', background: P.bg, padding: `0 0 ${padBottom ?? '40px'}` }}>
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0 16px' }}>{children}</div>
    </div>
  );
}

function Header({ eyebrow, title, subtitle, actions }: { eyebrow: string; title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div style={{ padding: '24px 0 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <div>
        <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: P.accent, fontWeight: 700, marginBottom: '5px' }}>{eyebrow}</div>
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '22px', lineHeight: 1.3 }}>{title}</div>
        {subtitle && <div style={{ fontSize: '13px', color: P.muted, marginTop: '3px' }}>{subtitle}</div>}
      </div>
      {actions && <div style={{ display: 'flex', gap: '4px', paddingTop: '4px' }}>{actions}</div>}
    </div>
  );
}

function IconBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title?: string }) {
  return (
    <button onClick={onClick} title={title}
      style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: '10px', padding: '7px 10px', fontSize: '16px', cursor: 'pointer' }}>
      {children}
    </button>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
      <div style={{ fontWeight: 700, fontSize: '15px' }}>{label}</div>
      {children}
    </div>
  );
}

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <button onClick={() => onChange(Math.max(min, value - 1))}
        style={{ background: P.border, border: 'none', borderRadius: '7px', width: '30px', height: '30px', fontSize: '16px', cursor: 'pointer' }}>−</button>
      <span style={{ fontSize: '16px', fontWeight: 700, minWidth: '28px', textAlign: 'center' }}>{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))}
        style={{ background: P.border, border: 'none', borderRadius: '7px', width: '30px', height: '30px', fontSize: '16px', cursor: 'pointer' }}>+</button>
    </div>
  );
}

function Chip({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ background: active ? P.accentLight : 'transparent', border: `1.5px solid ${active ? P.accent : P.border}`,
        borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: 700, color: active ? P.accentDark : P.muted, cursor: 'pointer' }}>
      {children}
    </button>
  );
}


function DayActions({ onHome, onGousto, onOff }: { onHome?: () => void; onGousto?: () => void; onOff?: () => void }) {
  return (
    <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
      {onHome && <ActionBtn bg={P.accentLight} color={P.accentDark} onClick={onHome}>🍽️ Use a recipe</ActionBtn>}
      {onGousto && <ActionBtn bg={P.greenLight} color={P.greenDark} onClick={onGousto}>📦 Gousto</ActionBtn>}
      {onOff && <ActionBtn bg={P.border} color={P.muted} onClick={onOff}>— Day off</ActionBtn>}
    </div>
  );
}

function ActionBtn({ children, bg, color, onClick }: { children: React.ReactNode; bg: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ background: bg, border: 'none', borderRadius: '8px', padding: '5px 10px', fontSize: '12px', fontWeight: 700, color, cursor: 'pointer' }}>
      {children}
    </button>
  );
}

function DayToggle({ day, mode, onChange }: { day: DayName; mode: DayMode; onChange: (m: DayMode) => void }) {
  const cycle: Record<DayMode, DayMode> = { home: 'gousto', gousto: 'off', off: 'home' };
  const labels: Record<DayMode, string> = { home: '🍽️ Home', gousto: '📦 Gousto', off: '— Off' };
  const colors: Record<DayMode, [string, string]> = { home: [P.accentLight, P.accentDark], gousto: [P.greenLight, P.greenDark], off: ['#F0F0F0', P.muted] };
  const [bg, fg] = colors[mode];
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: P.card, borderRadius: '12px', padding: '10px 14px', marginBottom: '6px', boxShadow: P.shadow, border: `1px solid ${P.border}` }}>
      <span style={{ fontWeight: 600, fontSize: '14px' }}>{day}</span>
      <button onClick={() => onChange(cycle[mode])}
        style={{ background: bg, color: fg, border: 'none', borderRadius: '8px', padding: '4px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
        {labels[mode]}
      </button>
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const desktop = window.innerWidth >= 768;
  if (desktop) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 500 }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)' } as React.CSSProperties} onClick={onClose} />
        <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: '480px', background: P.card, padding: '24px', overflowY: 'auto', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', zIndex: 501 }}
          onClick={e => e.stopPropagation()}>
          <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', background: P.border, border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', fontSize: '16px', color: P.muted }}>✕</button>
          {children}
        </div>
      </div>
    );
  }
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', overflowY: 'auto', padding: '24px 0 40px' } as React.CSSProperties}
        onClick={onClose}>
        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0 16px' }} onClick={e => e.stopPropagation()}>
          <div style={{ background: P.bg, borderRadius: '20px', padding: '24px', boxShadow: P.shadowMd }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

function MealPicker({ meals, favourites, dislikes, onPick, onToggleFav, onDislike }: {
  meals: Meal[]; favourites: string[]; dislikes: string[];
  onPick: (m: Meal) => void; onToggleFav: (n: string) => void; onDislike: (n: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [timeChip, setTimeChip] = useState<string>('any');
  const filtered = meals.filter(m =>
    !dislikes.includes(m.name) &&
    m.name.toLowerCase().includes(query.toLowerCase()) &&
    (timeChip === 'any' || m.minutes <= parseInt(timeChip))
  );
  return (
    <div>
      <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '20px', marginBottom: '12px' }}>Choose a meal</div>
      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '10px' }}>
        {([['any', 'Any time'], ['30', '≤ 30 min'], ['20', '≤ 20 min'], ['15', '≤ 15 min']] as [string, string][]).map(([v, l]) => (
          <button key={v} onClick={() => setTimeChip(v)}
            style={{ background: timeChip === v ? P.accentLight : 'transparent', border: `1.5px solid ${timeChip === v ? P.accent : P.border}`, borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: 700, color: timeChip === v ? P.accentDark : P.muted, cursor: 'pointer' }}>
            {l}
          </button>
        ))}
      </div>
      <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search…"
        style={{ width: '100%', padding: '10px 14px', border: `2px solid ${P.border}`, borderRadius: '10px', fontSize: '14px', background: P.card, marginBottom: '14px', boxSizing: 'border-box' }} />
      <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
        {filtered.map(m => {
          const isFav = favourites.includes(m.name);
          const isOpen = expanded === m.name;
          return (
            <div key={m.name} style={{ background: P.card, borderRadius: '12px', marginBottom: '6px', boxShadow: P.shadow, border: `1px solid ${isFav ? P.gold : P.border}`, overflow: 'hidden' }}>
              <div style={{ padding: '11px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 0, marginRight: '10px', cursor: 'pointer' }} onClick={() => setExpanded(isOpen ? null : m.name)}>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>{m.name}</div>
                  <div style={{ fontSize: '12px', color: P.muted }}>{m.time} · {m.cuisine} · {m.protein}</div>
                  <div style={{ fontSize: '11px', color: P.accent, fontWeight: 600 }}>{isOpen ? '▲ Hide' : '▼ View recipe'}</div>
                </div>
                <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                  <button onClick={() => onToggleFav(m.name)} style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: isFav ? P.gold : P.muted }}>{isFav ? '★' : '☆'}</button>
                  <button onClick={() => onDislike(m.name)} style={{ background: 'none', border: 'none', fontSize: '14px', cursor: 'pointer' }}>👎</button>
                  <button onClick={() => onPick(m)} style={{ background: P.accent, color: '#fff', border: 'none', borderRadius: '7px', padding: '5px 10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Pick</button>
                </div>
              </div>
              {isOpen && (
                <div style={{ borderTop: `1px solid ${P.border}`, padding: '12px 14px 14px', background: P.bg }}>
                  <div style={{ fontSize: '13px', color: P.muted, marginBottom: '8px' }}>{m.description}</div>
                  {(m.ingredients ?? []).map((ing, i) => <div key={i} style={{ fontSize: '13px', lineHeight: 1.6 }}>• {ing}</div>)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AddMealForm({ onSave, onCancel, initial }: { onSave: (m: Meal) => Promise<void>; onCancel: () => void; initial?: Meal }) {
  const [f, setF] = useState({
    name: initial?.name ?? '',
    minutes: String(initial?.minutes ?? 20),
    protein: initial?.protein ?? 'chicken',
    cuisine: initial?.cuisine ?? 'british',
    carb: initial?.carb ?? 'none',
    description: initial?.description ?? '',
    ingredients: initial?.ingredients?.join('\n') ?? '',
    steps: initial?.steps?.join('\n') ?? '',
  });
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));
  const ss: React.CSSProperties = { width: '100%', padding: '10px 12px', border: `2px solid ${P.border}`, borderRadius: '10px', fontSize: '14px', background: P.card, boxSizing: 'border-box' };
  const valid = f.name.trim().length > 0;
  const desktop = window.innerWidth >= 768;
  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: P.muted, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</div>
      {children}
    </div>
  );
  return (
    <div>
      <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '20px', marginBottom: '20px' }}>{initial ? 'Edit meal' : 'Add a meal'}</div>
      {desktop ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Meal name"><input value={f.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Leftover Curry Rice" style={ss} /></Field>
            <Field label="Cook time (min)"><select value={f.minutes} onChange={e => set('minutes', e.target.value)} style={ss}>{[10,15,20,25,30,35,40,45,50,60,75,90].map(n => <option key={n} value={n}>{n}</option>)}</select></Field>
            <Field label="Protein"><select value={f.protein} onChange={e => set('protein', e.target.value)} style={ss}>{['chicken','beef','fish','pork','lamb','seafood','eggs','veggie'].map(p => <option key={p}>{p}</option>)}</select></Field>
            <Field label="Cuisine"><select value={f.cuisine} onChange={e => set('cuisine', e.target.value)} style={ss}>{['british','italian','asian','mexican','indian','american','middleeastern','other'].map(c => <option key={c}>{c}</option>)}</select></Field>
          </div>
          <Field label="Description (optional)"><textarea value={f.description} onChange={e => set('description', e.target.value)} placeholder="A short summary shown on the meal card" style={{ ...ss, resize: 'vertical', minHeight: '60px' }} /></Field>
          <Field label="Ingredients (one per line)"><textarea value={f.ingredients} onChange={e => set('ingredients', e.target.value)} placeholder={'400g pasta\n2 x chicken breasts'} style={{ ...ss, resize: 'vertical', minHeight: '80px' }} /></Field>
          <Field label="Steps (one per line)"><textarea value={f.steps} onChange={e => set('steps', e.target.value)} style={{ ...ss, resize: 'vertical', minHeight: '80px' }} /></Field>
        </>
      ) : (
        <>
          <Field label="Meal name"><input value={f.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Leftover Curry Rice" style={ss} /></Field>
          <Field label="Cook time (min)"><select value={f.minutes} onChange={e => set('minutes', e.target.value)} style={ss}>{[10,15,20,25,30,35,40,45,50,60,75,90].map(n => <option key={n} value={n}>{n}</option>)}</select></Field>
          <Field label="Protein"><select value={f.protein} onChange={e => set('protein', e.target.value)} style={ss}>{['chicken','beef','fish','pork','lamb','seafood','eggs','veggie'].map(p => <option key={p}>{p}</option>)}</select></Field>
          <Field label="Cuisine"><select value={f.cuisine} onChange={e => set('cuisine', e.target.value)} style={ss}>{['british','italian','asian','mexican','indian','american','middleeastern','other'].map(c => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Description (optional)"><textarea value={f.description} onChange={e => set('description', e.target.value)} placeholder="A short summary shown on the meal card" style={{ ...ss, resize: 'vertical', minHeight: '60px' }} /></Field>
          <Field label="Ingredients (one per line)"><textarea value={f.ingredients} onChange={e => set('ingredients', e.target.value)} placeholder={'400g pasta\n2 x chicken breasts'} style={{ ...ss, resize: 'vertical', minHeight: '80px' }} /></Field>
          <Field label="Steps (one per line)"><textarea value={f.steps} onChange={e => set('steps', e.target.value)} style={{ ...ss, resize: 'vertical', minHeight: '80px' }} /></Field>
        </>
      )}
      <Primary disabled={!valid} onClick={async () => {
        await onSave({ name: f.name.trim(), time: `${f.minutes} min`, minutes: parseInt(f.minutes) || 20,
          protein: f.protein as any, cuisine: f.cuisine as any, carb: f.carb as any, serves: initial?.serves ?? 4,
          description: f.description.trim() || f.steps.split('\n')[0] || f.name,
          ingredients: f.ingredients.split('\n').map(s => s.trim()).filter(Boolean),
          steps: f.steps.split('\n').map(s => s.trim()).filter(Boolean), custom: true });
      }}>{initial ? 'Save changes' : 'Save meal'}</Primary>
      <Secondary muted onClick={onCancel}>Cancel</Secondary>
    </div>
  );
}

function HelpModal({ onClose }: { onClose: () => void }) {
  const sections = [
    { icon: '📅', title: 'Your week', items: [
      'Tap any meal card to see its full description. Tap "Ingredients & recipe" to expand the full recipe with ingredients scaled to your family size.',
      '☆ to favourite a meal — favourites are suggested 2.5× more often.',
      '🔄 to swap a meal for a different suggestion.',
      '👎 to skip a meal forever. It disappears from suggestions.',
      '📋 to hand-pick any meal from the full library for that day.',
    ]},
    { icon: '🍴', title: 'Cook tonight', items: [
      'Tap the orange button at the bottom-right to get a meal suggestion for tonight — independent of your weekly plan.',
      'Filter by kids/adults, max cook time, and dietary preference before picking.',
      '🔀 Suggest something else to get a different recommendation. 📋 Browse all meals to hand-pick from the full library.',
      '📅 Add to this week\'s plan to slot tonight\'s suggestion into any day.',
    ]},
    { icon: '🧠', title: 'Smart suggestions', items: [
      'Meals you\'ve had recently are de-prioritised. After 3–5 weeks they\'re back in full rotation.',
      'Favourites are suggested 2.5× more often. Seasonal meals get a boost in the right season.',
      'Protein, cuisine and carb type are balanced across the week automatically.',
      'Dislikes, time filters and kid-friendly settings all shape the suggestion pool.',
    ]},
    { icon: '🛒', title: 'Shopping list', items: [
      'All ingredients are scaled to your family size. Identical items across meals are combined.',
      'Add pantry staples during setup (oil, salt, garlic…) — they\'re removed from the list automatically.',
      'Tap items to check them off. Share the remaining unchecked list to your notes or messages.',
    ]},
    { icon: '👥', title: 'Household sync', items: [
      'Your plan, favourites, and shopping list sync in real time with anyone who joins your household.',
      'Find the invite code under Preferences → Household. Share it so your partner can join on their device.',
    ]},
  ];
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, overflowY: 'auto', background: P.bg }}>
      <div style={{ background: `linear-gradient(135deg, ${P.accent}, ${P.accentDark})`, color: '#fff', padding: '48px 24px 24px' }}>
        <div style={{ maxWidth: '480px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '10px', padding: '8px 14px', cursor: 'pointer', fontSize: '15px', fontWeight: 700 }}>
            ← Back
          </button>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '22px' }}>How it works</div>
        </div>
      </div>
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '24px 16px 60px' }}>
        {sections.map(s => (
          <div key={s.title} style={{ marginBottom: '28px' }}>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '18px', marginBottom: '10px' }}>{s.icon} {s.title}</div>
            <div style={{ background: P.card, borderRadius: '14px', padding: '4px 16px', boxShadow: P.shadow, border: `1px solid ${P.border}` }}>
              {s.items.map((item, i) => (
                <div key={i} style={{ padding: '12px 0', borderBottom: i < s.items.length - 1 ? `1px solid ${P.border}` : 'none', fontSize: '14px', lineHeight: 1.6, color: P.text }}>
                  {item}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
