import React, { useMemo } from 'react';
import type { Meal, KidsMode } from '../lib/types';
import { P } from '../lib/constants';
import { Tag, TimeSlider } from './ui';
import { buildMealShop, getCookedNote, CAT_EMOJI } from '../lib/shopping';
import { parseTimerParts } from '../lib/timers';

interface Props {
  meal: Meal;
  day?: string;
  isFav: boolean;
  isSeasonal: boolean;
  seasonLabel: string;
  overviewOpen: boolean;
  expanded: boolean;
  familySize: number;
  onOverview: () => void;
  onFullExpand: () => void;
  onFav: () => void;
  onSwap?: () => void;
  onDislike?: () => void;
  onChoose?: () => void;
  onMarkOff?: () => void;
  onMarkCooked?: () => void;
  onChangeMealSize?: (delta: number) => void;
  kidsMode?: KidsMode;
  onCycleKids?: () => void;
  dayTimeFilter?: string;
  onSetDayTime?: (tf: string) => void;
  readOnly?: boolean;
  lastUsedStr?: string | null;
  onStartTimer?: (label: string, seconds: number) => void;
  onEstimateNutrition?: () => void;
  nutrition?: { calories: number; protein: number; carbs: number; fat: number };
  onCookMode?: () => void;
}

function getMealEmoji(meal: Meal): string {
  const p: Record<string, string> = { chicken: '🍗', beef: '🥩', fish: '🐟', pork: '🥓', lamb: '🍖', seafood: '🦐', eggs: '🍳', veggie: '🥦' };
  const c: Record<string, string> = { italian: '🍝', asian: '🍜', mexican: '🌮', indian: '🍛', american: '🍔', middleeastern: '🧆', british: '🍽️' };
  return p[meal.protein] ?? c[meal.cuisine] ?? '🍽️';
}

export function MealCard({ meal, day, isFav, isSeasonal, seasonLabel, overviewOpen, expanded, familySize, onOverview, onFullExpand, onFav,
  onSwap, onDislike, onChoose, onMarkOff, onMarkCooked, onChangeMealSize, kidsMode, onCycleKids, dayTimeFilter, onSetDayTime,
  readOnly, lastUsedStr, onStartTimer, onEstimateNutrition, nutrition, onCookMode }: Props) {
  const scale = familySize / (meal.serves ?? 4);
  const shopByCategory = useMemo(() => buildMealShop(meal, scale), [meal, scale]);

  return (
    <div style={{ background: P.card, borderRadius: '16px', marginBottom: '10px',
      boxShadow: P.shadow, border: `2px solid ${isFav ? P.gold : P.border}`, overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '15px 16px', cursor: 'pointer' }} onClick={onOverview}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ fontSize: '26px', flexShrink: 0, paddingTop: '2px' }}>{getMealEmoji(meal)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '12px', color: P.accent, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{day ?? ''}</div>
              {!readOnly && (
                <div style={{ display: 'flex', gap: 0, marginRight: '-4px', flexShrink: 0 }}>
                  <Btn onClick={onFav} title={isFav ? 'Remove favourite' : 'Add favourite'} fontSize="18px" color={isFav ? P.gold : P.muted}>{isFav ? '★' : '☆'}</Btn>
                  {onSwap && <Btn onClick={onSwap} title="Swap">🔄</Btn>}
                  {onDislike && <Btn onClick={onDislike} title="Never suggest again">👎</Btn>}
                  {onChoose && <Btn onClick={onChoose} title="Choose from list" fontSize="15px" color={P.muted}>📋</Btn>}
                </div>
              )}
            </div>
            <div style={{ fontWeight: 700, fontSize: '16px', lineHeight: 1.3, marginBottom: '3px' }}>{meal.name}</div>
            <div style={{ fontSize: '13px', color: P.muted, lineHeight: 1.45,
              ...(overviewOpen || expanded ? {} : { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }) }}>{meal.description}</div>
            <div style={{ marginTop: '7px' }}>
              {meal.time && <Tag bg={P.accentLight} color={P.accentDark}>{meal.time}</Tag>}
              {isSeasonal && <Tag bg="#D1FAE5" color="#065F46">{seasonLabel}</Tag>}
              {isFav && <Tag bg={P.goldLight} color={P.gold}>⭐ Fav</Tag>}
              {meal.kidNote && <Tag bg={P.greenLight} color={P.greenDark}>👶 Kid-friendly</Tag>}
              {meal.sourceUrl && <Tag bg={P.border} color={P.muted}>🔗 Imported</Tag>}
              {lastUsedStr && <Tag bg={P.border} color={P.muted}>🕐 {lastUsedStr}</Tag>}
            </div>
            <div onClick={e => { e.stopPropagation(); onFullExpand(); }}
              style={{ fontSize: '12px', color: P.accent, fontWeight: 600, marginTop: '7px' }}>
              {expanded ? '▲ Hide recipe' : overviewOpen ? '▼ Ingredients & recipe' : '▼ Read more'}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded body */}
      <div style={{ maxHeight: expanded ? '2600px' : '0', opacity: expanded ? 1 : 0, overflow: 'hidden', transition: 'max-height 0.35s ease, opacity 0.2s' }}>
        <div style={{ borderTop: `1px solid ${P.border}`, padding: '14px 16px 18px' }}>

          {/* Cook this — prominent CTA at top */}
          {onCookMode && meal.steps && meal.steps.length > 0 && (
            <button onClick={e => { e.stopPropagation(); onCookMode(); }}
              style={{ width: '100%', background: P.accent, border: 'none', borderRadius: '12px',
                padding: '13px', fontSize: '15px', fontWeight: 700, color: '#fff',
                cursor: 'pointer', marginBottom: '16px', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: '8px' }}>
              👨‍🍳 Cook this now
            </button>
          )}

          {/* Serving size + time override */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: P.muted, letterSpacing: '1.2px', textTransform: 'uppercase' }}>Ingredients — serves {familySize}</div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
              {onCycleKids && (
                <button onClick={e => { e.stopPropagation(); onCycleKids(); }}
                  style={{ background: P.border, border: 'none', borderRadius: '20px', padding: '3px 8px', fontSize: '11px', fontWeight: 700, color: P.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                  {kidsMode === 'kids' ? '👶 Kids' : kidsMode === 'adults' ? '🍷 Adults' : '✌️ Either'}
                </button>
              )}
              {onChangeMealSize && <SmallBtn onClick={() => onChangeMealSize(-1)}>−</SmallBtn>}
              {onChangeMealSize && <SmallBtn onClick={() => onChangeMealSize(1)}>+</SmallBtn>}
            </div>
          </div>

          {onSetDayTime && dayTimeFilter !== undefined && (
            <div style={{ marginBottom: '12px' }}>
              <TimeSlider value={dayTimeFilter} label="Swap max time" onChange={onSetDayTime} />
            </div>
          )}

          {/* Categorised ingredients */}
          {Object.keys(shopByCategory).length > 0
            ? <div style={{ marginBottom: '16px' }}>
                {Object.entries(shopByCategory).map(([cat, items]) => (
                  <div key={cat} style={{ marginBottom: '10px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: P.muted, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>
                      {CAT_EMOJI[cat] ?? '•'} {cat}
                    </div>
                    {items.map((x, i) => {
                      const cn = getCookedNote(x.label, x.qty);
                      return <div key={i} style={{ fontSize: '14px', lineHeight: 1.6, paddingLeft: '6px' }}>
                        {x.display}{cn && <span style={{ fontSize: '12px', color: P.muted, marginLeft: '4px' }}>({cn})</span>}
                      </div>;
                    })}
                  </div>
                ))}
                <button onClick={e => {
                  e.stopPropagation();
                  const lines = Object.entries(shopByCategory).map(([cat, items]) =>
                    `${CAT_EMOJI[cat] ?? '•'} ${cat}\n${items.map(x => `  • ${x.display}`).join('\n')}`
                  ).join('\n\n');
                  const body = `🛒 ${meal.name} — serves ${familySize}\n\n${lines}`;
                  if (navigator.share) navigator.share({ title: meal.name, text: body }).catch(() => {});
                  else navigator.clipboard?.writeText(body);
                }} style={{ background: 'none', border: `1px solid ${P.border}`, borderRadius: '8px',
                  padding: '5px 12px', fontSize: '12px', color: P.muted, cursor: 'pointer', marginTop: '4px' }}>
                  🔗 Share ingredients
                </button>
              </div>
            : <div style={{ fontSize: '14px', color: P.muted, marginBottom: '16px' }}>No ingredients listed</div>
          }

          {/* Nutrition row */}
          {nutrition ? (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <span style={{ background: P.accentLight, color: P.accentDark, borderRadius: '8px', padding: '3px 8px', fontSize: '11px', fontWeight: 700 }}>🔥 {nutrition.calories} cal</span>
              <span style={{ background: P.accentLight, color: P.accentDark, borderRadius: '8px', padding: '3px 8px', fontSize: '11px', fontWeight: 700 }}>🥩 {nutrition.protein}g protein</span>
              <span style={{ background: P.accentLight, color: P.accentDark, borderRadius: '8px', padding: '3px 8px', fontSize: '11px', fontWeight: 700 }}>🍞 {nutrition.carbs}g carbs</span>
              <span style={{ background: P.accentLight, color: P.accentDark, borderRadius: '8px', padding: '3px 8px', fontSize: '11px', fontWeight: 700 }}>🫙 {nutrition.fat}g fat</span>
            </div>
          ) : onEstimateNutrition ? (
            <div style={{ marginBottom: '14px' }}>
              <button onClick={e => { e.stopPropagation(); onEstimateNutrition(); }}
                style={{ background: 'none', border: 'none', color: P.muted, fontSize: '12px', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                Estimate nutrition
              </button>
            </div>
          ) : null}

          {/* Steps */}
          {meal.steps && meal.steps.length > 0 && <>
            <div style={{ fontSize: '11px', fontWeight: 700, color: P.muted, letterSpacing: '1.2px', marginBottom: '8px', textTransform: 'uppercase' }}>Recipe</div>
            <ol style={{ paddingLeft: '18px' }}>
              {meal.steps.map((s, i) => (
                <li key={i} style={{ fontSize: '14px', lineHeight: 1.6, marginBottom: '6px' }}>
                  {parseTimerParts(s).map((part, j) =>
                    part.seconds ? (
                      <button key={j} onClick={e => { e.stopPropagation(); onStartTimer?.(part.text, part.seconds!); }}
                        style={{ background: P.accentLight, color: P.accentDark, border: 'none', borderRadius: '6px',
                          padding: '1px 6px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', margin: '0 1px' }}>
                        ⏱ {part.text}
                      </button>
                    ) : (
                      <span key={j}>{part.text}</span>
                    )
                  )}
                </li>
              ))}
            </ol>
          </>}

          {/* Kid note */}
          {meal.kidNote && (
            <div style={{ marginTop: '14px', background: P.greenLight, borderRadius: '10px', padding: '11px 14px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '16px', flexShrink: 0 }}>👶</span>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: P.greenDark, letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: '3px' }}>For kids</div>
                <div style={{ fontSize: '13px', lineHeight: 1.5, color: P.greenDark }}>{meal.kidNote}</div>
              </div>
            </div>
          )}

          {/* Chef tip */}
          {meal.tip && (
            <div style={{ marginTop: '14px', background: P.goldLight, borderRadius: '10px', padding: '11px 14px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '16px', flexShrink: 0 }}>👨‍🍳</span>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: P.gold, letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: '3px' }}>Chef's tip</div>
                <div style={{ fontSize: '13px', lineHeight: 1.5, color: '#78350F' }}>{meal.tip}</div>
              </div>
            </div>
          )}

          {/* Day-mode actions */}
          {(onMarkCooked || onMarkOff) && <div style={{ display: 'flex', gap: '6px', marginTop: '16px', paddingTop: '12px', borderTop: `1px solid ${P.border}`, flexWrap: 'wrap' }}>
            {onMarkCooked && (
              <button onClick={e => { e.stopPropagation(); onMarkCooked(); }}
                style={{ background: P.border, border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: 700, color: P.text, cursor: 'pointer' }}>
                ✓ Cooked it
              </button>
            )}
            {onMarkOff && (
              <button onClick={e => { e.stopPropagation(); onMarkOff(); }}
                style={{ background: P.border, border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: 700, color: P.muted, cursor: 'pointer' }}>
                — Day off
              </button>
            )}
          </div>}
        </div>
      </div>
    </div>
  );
}

function Btn({ children, onClick, title, fontSize = '18px', color, fontWeight }: {
  children: React.ReactNode; onClick?: () => void; title?: string;
  fontSize?: string; color?: string; fontWeight?: number | string;
}) {
  return (
    <button onClick={e => { e.stopPropagation(); onClick?.(); }} title={title}
      style={{ background: 'none', border: 'none', fontSize, cursor: 'pointer', padding: '4px 6px', color: color ?? P.text, fontWeight }}>
      {children}
    </button>
  );
}

function SmallBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={e => { e.stopPropagation(); onClick(); }}
      style={{ background: P.border, border: 'none', borderRadius: '6px', width: '24px', height: '24px',
        fontSize: '16px', cursor: 'pointer', color: P.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </button>
  );
}
