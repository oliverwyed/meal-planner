import React, { useState, useCallback, useEffect } from 'react';
import { MealCard } from '../components/MealCard';
import { Primary, Secondary, Toast, BottomNav } from '../components/ui';
import { TimeSlider } from '../components/ui';
import { Modal, MealPicker, BrowseMealCard, RecipeDetailSheet, formatLastUsed, SEASON_INFO } from '../components/AppUI';
import { DAYS } from '../lib/constants';
import { P } from '../lib/constants';
import type { Meal, CommunityMeal } from '../lib/types';
import type { AppState, AppActions } from '../hooks/useHousehold';
import { log, logFetch, recordCost } from '../lib/logger';
import RECIPES from '../data/recipes.json';

const ALL_RECIPES = RECIPES as Meal[];

export interface BrowseScreenProps {
  state: AppState;
  actions: AppActions;
  addTimer: (label: string, seconds: number) => void;
  estimateNutrition: (meal: Meal) => void;
  nutritionLoading: Set<string>;
  nutritionCache: Record<string, { calories: number; protein: number; carbs: number; fat: number }>;
  adaptRecipe: (meal: Meal, request: string) => Promise<Meal>;
  setCookingMeal: (m: { meal: Meal; familySize: number } | null) => void;
  communityMeals: CommunityMeal[];
  communityLoading: boolean;
  setCommunityMeals: React.Dispatch<React.SetStateAction<CommunityMeal[]>>;
  setCommunityLoading: React.Dispatch<React.SetStateAction<boolean>>;
  showToast: (msg: string, undo?: () => void) => void;
  toast: string | null;
  toastUndoRef: React.MutableRefObject<(() => void) | null>;
  setStep: (s: string) => void;
}

export function BrowseScreen({
  state,
  actions,
  addTimer,
  estimateNutrition,
  nutritionLoading,
  nutritionCache,
  adaptRecipe,
  setCookingMeal,
  communityMeals,
  communityLoading,
  setCommunityMeals,
  setCommunityLoading,
  showToast,
  toast,
  toastUndoRef,
  setStep,
}: BrowseScreenProps) {
  const [browseQuery, setBrowseQuery] = useState('');
  const [browseProtein, setBrowseProtein] = useState('');
  const [browseCuisine, setBrowseCuisine] = useState('');
  const [browseTime, setBrowseTime] = useState('');
  const [browseCourse, setBrowseCourse] = useState('');
  const [browseAddDay, setBrowseAddDay] = useState<Meal | null>(null);
  const [browseDetailMeal, setBrowseDetailMeal] = useState<Meal | null>(null);
  const [browseAIOpen, setBrowseAIOpen] = useState(false);
  const [browseTab, setBrowseTab] = useState<'all' | 'community'>('all');
  const [cookNow, setCookNow] = useState<Meal | null>(null);
  const [cookNowExp, setCookNowExp] = useState(false);
  const [cookNowAddToPlan, setCookNowAddToPlan] = useState(false);
  const [cookNowOpts, setCookNowOpts] = useState<{ kids: string; size: number; time: string; dietary: string }>({
    kids: 'either', size: 4, time: 'any', dietary: 'none',
  });
  const [findRecipeTab, setFindRecipeTab] = useState<'suggest' | 'fridge'>('suggest');
  const [fridgeQuery, setFridgeQuery] = useState('');
  const [fridgeLoading, setFridgeLoading] = useState(false);
  const [fridgeMatches, setFridgeMatches] = useState<Meal[] | null>(null);
  const [fridgeAI, setFridgeAI] = useState(false);
  const [pickerFor, setPickerFor] = useState<'cookNow' | null>(null);

  const si = SEASON_INFO[state.season] ?? { label: '' };

  // Load community meals when browse tab is opened
  useEffect(() => {
    if (browseTab !== 'community' || communityLoading || communityMeals.length > 0) return;
    setCommunityLoading(true);
    import('../lib/supabase').then(({ loadCommunityMeals }) => {
      loadCommunityMeals().then(meals => { setCommunityMeals(meals); setCommunityLoading(false); });
    });
  }, [browseTab, communityLoading, communityMeals.length, setCommunityMeals, setCommunityLoading]);

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

  const rePick = useCallback((opts?: { time: string; kids: string; dietary: string }) => {
    const o = opts ?? cookNowOpts;
    const meal = actions.pickCookNow(o.time, o.kids as any, o.dietary);
    if (meal) { setCookNow(meal); setCookNowExp(true); }
    else showToast('No meals match — try relaxing your filters');
  }, [cookNowOpts, actions, showToast]);

  const allMeals = ALL_RECIPES.concat(state.customMeals);
  const q = browseQuery.trim().toLowerCase();
  const filterMeals = (meals: Meal[]) => meals.filter(m => {
    if (browseCourse && (m.course ?? 'main') !== browseCourse) return false;
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
  const seasonal = allMeals.filter(m => m.seasons?.includes(state.season as any) && (!m.course || m.course === 'main'));
  const hasFilters = !!(browseQuery || browseProtein || browseCuisine || browseTime || browseCourse);

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
              <button onClick={() => { setBrowseQuery(''); setBrowseProtein(''); setBrowseCuisine(''); setBrowseTime(''); setBrowseCourse(''); }}
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
              {([['', 'All courses'], ['main', '🍽️ Mains'], ['starter', '🥗 Starters'], ['side', '🥦 Sides'], ['dessert', '🍰 Desserts']] as [string, string][]).map(([v, l]) => (
                <button key={v} onClick={() => setBrowseCourse(browseCourse === v ? '' : v)}
                  style={{ display: 'inline-block', marginRight: '6px', padding: '5px 12px', borderRadius: '20px', border: 'none', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                    background: browseCourse === v ? P.accent : P.accentLight, color: browseCourse === v ? '#fff' : P.accentDark }}>
                  {l}
                </button>
              ))}
            </div>
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
              {([['', 'All cuisines'], ['british', '🇬🇧 British'], ['italian', '🇮🇹 Italian'], ['french', '🥐 French'], ['asian', '🥢 Asian'], ['mexican', '🌮 Mexican'], ['indian', '🍛 Indian'], ['american', '🍔 American'], ['middleeastern', '🧆 Middle Eastern'], ['other', '🌍 Other']] as [string, string][]).map(([v, l]) => (
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
                          lastUsedStr={formatLastUsed(state.cookHistory.filter(h => h.name === cookNow.name).length ? Math.max(...state.cookHistory.filter(h => h.name === cookNow.name).map(h => h.date)) : null)}
                          onStartTimer={addTimer}
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
      {pickerFor === 'cookNow' && (
        <Modal onClose={() => setPickerFor(null)}>
          <MealPicker
            meals={ALL_RECIPES.concat(state.customMeals)}
            favourites={state.preferences.favourites}
            dislikes={state.preferences.dislikes}
            onPick={meal => {
              setCookNow(meal); setCookNowExp(true); setPickerFor(null);
            }}
            onToggleFav={actions.toggleFav}
            onDislike={name => { actions.addDislike(name); showToast('Marked as disliked'); }}
          />
        </Modal>
      )}
      {toast && <Toast message={toast} onUndo={toastUndoRef.current ?? undefined} bottom="80px" />}
      <BottomNav
        onPlan={() => setStep('plan')}
        onShopping={() => setStep('shopping')}
        onBrowse={() => setStep('browse')}
        onEvents={() => setStep('events')}
        onProfile={() => setStep('prefs')}
        active="browse"
      />
    </div>
  );
}
