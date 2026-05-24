import React, { useState } from 'react';
import { Primary, Secondary, Toast, Section, BottomNav } from '../components/ui';
import { Screen, Header } from '../components/AppUI';
import { P } from '../lib/constants';
import type { AppState, AppActions } from '../hooks/useHousehold';
import { CAT_EMOJI, buildShop, buildMealShop } from '../lib/shopping';

export interface ShoppingScreenProps {
  state: AppState;
  actions: AppActions;
  showToast: (msg: string, undo?: () => void) => void;
  toast: string | null;
  toastUndoRef: React.MutableRefObject<(() => void) | null>;
  setStep: (s: string) => void;
}

export function ShoppingScreen({
  state,
  actions,
  showToast,
  toast,
  toastUndoRef,
  setStep,
}: ShoppingScreenProps) {
  const [shopWeek, setShopWeek] = useState<'this' | 'next' | 'both'>('this');
  const [shopView, setShopView] = useState<'aisle' | 'recipe'>('aisle');

  const hasNext = !!state.nextWeekShopList;
  // If 'this' week has no plan, fall back to 'next' automatically
  const effectiveShopWeek = shopWeek === 'this' && !state.plan ? 'next' : shopWeek;

  // Meals for the active week selection
  const activePlanMeals: import('../lib/types').PlanMeal[] = effectiveShopWeek === 'both'
    ? [...(state.plan?.meals ?? []), ...(state.nextWeekPlan?.meals ?? [])]
    : effectiveShopWeek === 'next' ? (state.nextWeekPlan?.meals ?? []) : (state.plan?.meals ?? []);

  // Which meals are excluded (skip their ingredients from the aisle view)
  const excludedRecipes = new Set(
    Object.entries(state.shopChecked)
      .filter(([k, v]) => k.startsWith('__skip__:') && v)
      .map(([k]) => k.slice('__skip__:'.length))
  );
  const toggleExclude = (name: string) => {
    const key = `__skip__:${name}`;
    actions.setShopChecked({ ...state.shopChecked, [key]: !state.shopChecked[key] });
  };

  // Recompute aisle list excluding skipped meals
  const activePlan = effectiveShopWeek === 'next' ? state.nextWeekPlan : effectiveShopWeek === 'both'
    ? (state.plan && state.nextWeekPlan ? { ...state.plan, meals: activePlanMeals } : state.plan ?? state.nextWeekPlan)
    : state.plan;
  const filteredPlan = activePlan
    ? { ...activePlan, meals: activePlan.meals.filter(m => !excludedRecipes.has(m.name)) }
    : null;
  const activeShopListSafe = filteredPlan
    ? buildShop(filteredPlan, state.preferences.pantry, state.familySize, state.dayConfig, state.dayOverrides)
    : {};

  const totalItems = Object.values(activeShopListSafe).flat().length;
  const checkedCount = Object.keys(state.shopChecked).filter(k => !k.startsWith('__skip__:') && state.shopChecked[k]).length;

  const renderShopItem = (itemKey: string, label: string, border: boolean) => {
    const checked = !!state.shopChecked[itemKey];
    return (
      <div key={itemKey} onClick={() => actions.setShopChecked({ ...state.shopChecked, [itemKey]: !checked })}
        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', cursor: 'pointer',
          borderBottom: border ? `1px solid ${P.border}` : 'none' }}>
        <div style={{ width: '24px', height: '24px', borderRadius: '7px', border: `2px solid ${checked ? P.green : P.border}`,
          background: checked ? P.greenLight : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, fontSize: '13px', color: P.greenDark, fontWeight: 700 }}>
          {checked ? '✓' : ''}
        </div>
        <div style={{ fontSize: '14px', textDecoration: checked ? 'line-through' : 'none',
          color: checked ? P.muted : P.text, flex: 1 }}>
          {label}
        </div>
      </div>
    );
  };

  return (
    <Screen>
      <Header eyebrow="Shopping" title="What to buy" />

      {/* Week toggle */}
      {hasNext && (
        <div style={{ display: 'flex', background: P.border, borderRadius: '22px', padding: '3px', marginBottom: '10px' }}>
          {(['this', 'next', 'both'] as const).map(w => (
            <button key={w} onClick={() => setShopWeek(w)}
              style={{ flex: 1, padding: '7px 4px', borderRadius: '19px', border: 'none', fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                background: effectiveShopWeek === w ? P.card : 'transparent',
                color: effectiveShopWeek === w ? P.accent : P.muted,
                boxShadow: effectiveShopWeek === w ? P.shadow : 'none' }}>
              {w === 'this' ? 'This week' : w === 'next' ? 'Next week' : 'Both'}
            </button>
          ))}
        </div>
      )}

      {/* Aisle / Recipe view toggle */}
      <div style={{ display: 'flex', background: P.border, borderRadius: '22px', padding: '3px', marginBottom: '14px' }}>
        {(['aisle', 'recipe'] as const).map(v => (
          <button key={v} onClick={() => setShopView(v)}
            style={{ flex: 1, padding: '7px 4px', borderRadius: '19px', border: 'none', fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
              background: shopView === v ? P.card : 'transparent',
              color: shopView === v ? P.accent : P.muted,
              boxShadow: shopView === v ? P.shadow : 'none' }}>
            {v === 'aisle' ? '🛒 By aisle' : '🍽️ By recipe'}
          </button>
        ))}
      </div>

      <div style={{ fontSize: '13px', color: P.muted, marginBottom: '16px' }}>
        {shopView === 'aisle'
          ? `${totalItems} items · ${checkedCount} checked${excludedRecipes.size ? ` · ${excludedRecipes.size} recipe${excludedRecipes.size > 1 ? 's' : ''} skipped` : ''}`
          : `${activePlanMeals.length} recipes · ${excludedRecipes.size} skipped`}
      </div>

      {/* Aisle view */}
      {shopView === 'aisle' && Object.entries(activeShopListSafe).map(([cat, items]) => (
        <Section key={cat}>
          <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '10px' }}>{CAT_EMOJI[cat]} {cat}</div>
          {items.map((item, i) => renderShopItem(`${cat}:${item.display}`, item.display, i < items.length - 1))}
        </Section>
      ))}

      {/* Recipe view */}
      {shopView === 'recipe' && activePlanMeals.map(meal => {
        const skipped = excludedRecipes.has(meal.name);
        const mealShop = buildMealShop(meal, (state.dayOverrides[meal.day]?.size ?? state.familySize) / (meal.serves ?? 4));
        const allItems = Object.entries(mealShop).flatMap(([cat, items]) => items.map(item => ({ cat, item })));
        const allChecked = allItems.length > 0 && allItems.every(({ cat, item }) => state.shopChecked[`${cat}:${item.display}`]);
        return (
          <Section key={`${meal.day}:${meal.name}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: skipped ? 0 : '8px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '14px', color: skipped ? P.muted : P.text,
                  textDecoration: skipped ? 'line-through' : 'none' }}>{meal.name}</div>
                <div style={{ fontSize: '12px', color: P.muted }}>{meal.day}</div>
              </div>
              {/* Tick all */}
              {!skipped && (
                <button onClick={() => {
                  const patch = { ...state.shopChecked };
                  allItems.forEach(({ cat, item }) => { patch[`${cat}:${item.display}`] = !allChecked; });
                  actions.setShopChecked(patch);
                }} style={{ padding: '5px 10px', borderRadius: '8px', border: `1px solid ${P.border}`,
                  background: allChecked ? P.greenLight : P.bg, color: allChecked ? P.greenDark : P.muted,
                  fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {allChecked ? '✓ All got' : 'Got all'}
                </button>
              )}
              {/* Skip recipe */}
              <button onClick={() => toggleExclude(meal.name)}
                style={{ padding: '5px 10px', borderRadius: '8px', border: `1px solid ${P.border}`,
                  background: skipped ? P.accent : P.bg, color: skipped ? '#fff' : P.muted,
                  fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {skipped ? 'Unskip' : 'Skip'}
              </button>
            </div>
            {!skipped && Object.entries(mealShop).map(([cat, items]) =>
              items.map((item, i) => renderShopItem(`${cat}:${item.display}`, item.display, i < items.length - 1 || cat !== Object.keys(mealShop).at(-1)))
            )}
          </Section>
        );
      })}

      {Object.keys(state.shopChecked).some(k => !k.startsWith('__skip__:') && state.shopChecked[k]) && (
        <Secondary muted onClick={() => {
          // Preserve skip state when clearing checks
          const skipEntries = Object.fromEntries(
            Object.entries(state.shopChecked).filter(([k]) => k.startsWith('__skip__:'))
          );
          actions.setShopChecked(skipEntries);
        }}>Clear checks</Secondary>
      )}
      {excludedRecipes.size > 0 && (
        <Secondary muted onClick={() => {
          const nonSkip = Object.fromEntries(
            Object.entries(state.shopChecked).filter(([k]) => !k.startsWith('__skip__:'))
          );
          actions.setShopChecked(nonSkip);
        }}>Unskip all recipes</Secondary>
      )}
      <Primary onClick={() => {
        const weekLabel = effectiveShopWeek === 'both' ? 'Both weeks' : effectiveShopWeek === 'next' ? 'Next week' : 'This week';
        const mealLines = activePlanMeals.filter(m => !excludedRecipes.has(m.name)).map(m => `${m.day}: ${m.name}`).join('\n');
        const lines = Object.entries(activeShopListSafe).map(([cat, items]) => {
          const unchecked = items.filter(item => !state.shopChecked[`${cat}:${item.display}`]);
          if (!unchecked.length) return '';
          return `${CAT_EMOJI[cat] ?? '•'} ${cat}\n${unchecked.map(i => `  • ${i.display}`).join('\n')}`;
        }).filter(Boolean).join('\n\n');
        const hasChecked = checkedCount > 0;
        const body = `🛒 Shopping list${hasChecked ? ' (remaining)' : ''} — serves ${state.familySize}\n\n📅 ${weekLabel}\n${mealLines}\n\n${lines}`;
        if (navigator.share) navigator.share({ title: 'Shopping List', text: body }).catch(() => {});
        else navigator.clipboard?.writeText(body).then(() => showToast('Copied!'));
      }}>🔗 Share list</Primary>
      {toast && <Toast message={toast} onUndo={toastUndoRef.current ?? undefined} />}
      <BottomNav
        onPlan={() => setStep('plan')}
        onShopping={() => setStep('shopping')}
        onBrowse={() => setStep('browse')}
        onEvents={() => setStep('events')}
        onProfile={() => setStep('prefs')}
        active="shopping"
      />
    </Screen>
  );
}
