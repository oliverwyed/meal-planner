import React, { useState, useEffect } from 'react';
import { ImportRecipe } from '../components/ImportRecipe';
import { PhotoImport } from '../components/PhotoImport';
import { Primary, Secondary, Toast, Section, BottomNav } from '../components/ui';
import { TimeSlider } from '../components/ui';
import { Screen, Header, Row, Stepper, Chip, DayToggle, Modal, AddMealForm, LogsPanel, formatLastUsed } from '../components/AppUI';
import { DAYS } from '../lib/constants';
import { P } from '../lib/constants';
import type { DayMode, Meal } from '../lib/types';
import type { AppState, AppActions } from '../hooks/useHousehold';
import { uploadRecipePhoto, getHouseholdInviteCode } from '../lib/supabase';

export interface PrefsScreenProps {
  state: AppState;
  actions: AppActions;
  householdId: string;
  publishedMap: Record<string, string>;
  publishingId: string | null;
  onPublish: (meal: Meal) => void;
  onUnpublish: (meal: Meal) => void;
  showToast: (msg: string, undo?: () => void) => void;
  toast: string | null;
  toastUndoRef: React.MutableRefObject<(() => void) | null>;
  setStep: (s: string) => void;
  onLeave: () => void;
}

export function PrefsScreen({
  state,
  actions,
  householdId,
  publishedMap,
  publishingId,
  onPublish,
  onUnpublish,
  showToast,
  toast,
  toastUndoRef,
  setStep,
  onLeave,
}: PrefsScreenProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [addMealOpen, setAddMealOpen] = useState(false);
  const [editMealTarget, setEditMealTarget] = useState<Meal | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showPhotoImport, setShowPhotoImport] = useState(false);
  const [pantryDraft, setPantryDraft] = useState(state.preferences.pantry);

  // Keep pantryDraft in sync when state changes externally
  useEffect(() => { setPantryDraft(state.preferences.pantry); }, [state.preferences.pantry]);

  // Save pantry on unmount
  useEffect(() => () => {
    actions.setPreferences({ pantry: pantryDraft });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pantryDraft]);

  return (
    <Screen>
      <Header eyebrow="Account" title="Your account" />

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
                <button onClick={() => onPublish(m)} disabled={publishingId === m.id}
                  style={{ marginTop: '5px', background: 'none', border: `1px solid ${P.border}`, borderRadius: '6px', padding: '3px 10px', fontSize: '11px', fontWeight: 700, color: P.muted, cursor: 'pointer' }}>
                  {publishingId === m.id ? 'Publishing…' : '👥 Share with community'}
                </button>
              ) : (
                <button onClick={() => onUnpublish(m)}
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
            // Upload all photos to storage, replacing data URLs with storage URLs
            if (meal.photos && meal.photos.length > 0) {
              const urls: string[] = [];
              for (const dataUrl of meal.photos) {
                if (dataUrl.startsWith('data:')) {
                  const res = await fetch(dataUrl);
                  const blob = await res.blob();
                  const file = new File([blob], 'recipe.jpg', { type: blob.type });
                  const url = await uploadRecipePhoto(file);
                  if (url) urls.push(url);
                } else {
                  urls.push(dataUrl);
                }
              }
              meal = { ...meal, photos: urls, photo: urls[0] };
            } else if (meal.photo?.startsWith('data:')) {
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
        onEvents={() => setStep('events')}
        onProfile={() => setStep('prefs')}
        active="profile"
      />
    </Screen>
  );
}
