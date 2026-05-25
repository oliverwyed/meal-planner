import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MealCard } from '../components/MealCard';
import { Toast, ActiveTimers, BottomNav } from '../components/ui';
import { IconBtn, Modal, MealPicker, HelpModal, RecipeDetailSheet, formatLastUsed, SEASON_INFO } from '../components/AppUI';
import { DAYS } from '../lib/constants';
import { P } from '../lib/constants';
import type { DayName, DayMode, KidsMode, Meal, RecipeReview } from '../lib/types';
import type { AppState, AppActions } from '../hooks/useHousehold';
import { DayActions } from '../components/AppUI';
import { downloadICS } from '../lib/ics';
import { loadReviews, addReview, deleteReview } from '../lib/supabase';
import RECIPES from '../data/recipes.json';

const ALL_RECIPES = RECIPES as Meal[];

export interface PlanScreenProps {
  state: AppState;
  actions: AppActions;
  isDesktop: boolean;
  timers: { id: string; label: string; remaining: number; total: number; done: boolean }[];
  addTimer: (label: string, seconds: number) => void;
  dismissTimer: (id: string) => void;
  estimateNutrition: (meal: Meal) => void;
  nutritionLoading: Set<string>;
  nutritionCache: Record<string, { calories: number; protein: number; carbs: number; fat: number }>;
  adaptRecipe: (meal: Meal, request: string) => Promise<Meal>;
  setCookingMeal: (m: { meal: Meal; familySize: number } | null) => void;
  showToast: (msg: string, undo?: () => void) => void;
  toast: string | null;
  toastUndoRef: React.MutableRefObject<(() => void) | null>;
  setStep: (s: string) => void;
}

export function PlanScreen({
  state,
  actions,
  isDesktop,
  timers,
  addTimer,
  dismissTimer,
  estimateNutrition,
  nutritionLoading,
  nutritionCache,
  adaptRecipe,
  setCookingMeal,
  showToast,
  toast,
  toastUndoRef,
  setStep,
}: PlanScreenProps) {
  const [planWeek, setPlanWeek] = useState<'this' | 'next'>('this');
  const [previewDay, setPreviewDay] = useState<DayName | null>(null);
  const [expandedDay, setExpandedDay] = useState<DayName | null>(null);
  const [pickerFor, setPickerFor] = useState<DayName | 'cookNow' | null>(null);
  const [showPlanHistory, setShowPlanHistory] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(() => localStorage.getItem('hintDismissed') === '1');
  const [planDetailMeal, setPlanDetailMeal] = useState<{ meal: Meal; daySize: number } | null>(null);
  const [showRollover, setShowRollover] = useState(false);
  const [reviewsCache, setReviewsCache] = useState<Record<string, RecipeReview[]>>({});
  const [reviewsLoadingSet, setReviewsLoadingSet] = useState<Set<string>>(new Set());
  const [myReviews, setMyReviews] = useState<Record<string, string>>({});
  const lastGenRef = useRef(0);

  // Auto-select next week tab when there's no current week plan
  useEffect(() => {
    if (!state.plan && state.nextWeekPlan) setPlanWeek('next');
  }, [state.plan, state.nextWeekPlan]);

  // Rollover: show banner when current plan predates this Monday
  useEffect(() => {
    if (!state.plan || !state.nextWeekPlan) { setShowRollover(false); return; }
    const now = new Date();
    const dow = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
    monday.setHours(0, 0, 0, 0);
    setShowRollover(state.plan.generatedAt < monday.getTime());
  }, [state.plan, state.nextWeekPlan]);

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

  const si = SEASON_INFO[state.season] ?? { label: '' };

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
          {(['plan', 'shopping', 'browse', 'events', 'prefs'] as const).map(s => {
            const labels: Record<string, string> = { plan: '📅 Plan', shopping: '🛒 Shopping', browse: '🍴 Recipes', events: '🎉 Events', prefs: '⚙️ Account' };
            const active = s === 'plan';
            return (
              <button key={s} onClick={() => setStep(s)}
                style={{ background: active ? P.accentLight : 'none', border: 'none', borderRadius: '10px', margin: '2px 12px', padding: '9px 12px', fontSize: '14px', fontWeight: 700, color: active ? P.accentDark : P.muted, cursor: 'pointer', textAlign: 'left' }}>
                {labels[s]}
              </button>
            );
          })}
          <div style={{ borderTop: `1px solid ${P.border}`, margin: '12px 0', padding: '12px 12px 0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <button onClick={() => {
              if (Date.now() - lastGenRef.current < 2000) return;
              lastGenRef.current = Date.now();
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
              if (Date.now() - lastGenRef.current < 2000) return;
              lastGenRef.current = Date.now();
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

      {/* Week toggle — only show when both plans exist */}
      {state.plan && state.nextWeekPlan && (
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
      )}

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
            <DayActions onHome={() => actions.setDayMode(day, 'home', planWeek)} />
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
              meal={meal} day={isToday ? `Today · ${dayDate(day)}` : `${day} · ${dayDate(day)}`}
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
              onMarkOff={() => actions.setDayMode(day, 'off', planWeek)}
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
          onEvents={() => setStep('events')}
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
                setPickerFor(null);
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
}
