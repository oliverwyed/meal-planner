import { useState, useMemo, useRef } from 'react';
import type { Meal, DinnerEvent, EventDish, EventCategory } from '../lib/types';
import { P } from '../lib/constants';
import { Primary, Secondary } from './ui';
import { buildEventShop, CATEGORY_ORDER, CAT_EMOJI, scaledIngredients } from '../lib/shopping';
import { log, logFetch, recordCost } from '../lib/logger';

interface Props {
  events: DinnerEvent[];
  allMeals: Meal[];
  pantry: string;
  onCreateEvent: (e: Omit<DinnerEvent, 'id'>) => void;
  onUpdateEvent: (id: string, patch: Partial<DinnerEvent>) => void;
  onDeleteEvent: (id: string) => void;
}

const CATEGORY_LABELS: Record<EventCategory, string> = {
  starter: 'Starters', main: 'Mains', side: 'Sides',
  dessert: 'Desserts', drinks: 'Drinks', other: 'Other',
};
const CATEGORY_ORDER_EVENT: EventCategory[] = ['starter', 'main', 'side', 'dessert', 'drinks', 'other'];
const DISH_COLORS = ['#4F46E5', '#059669', '#D97706', '#DC2626', '#7C3AED', '#0891B2', '#BE185D'];

function fmt12(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h < 12 ? 'am' : 'pm';
  return `${h === 0 ? 12 : h > 12 ? h - 12 : h}:${String(m).padStart(2, '0')}${ampm}`;
}

function fmtDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function minsBetween(a: string, b: string): number {
  const [ah, am] = a.split(':').map(Number);
  const [bh, bm] = b.split(':').map(Number);
  return (bh * 60 + bm) - (ah * 60 + am);
}

function fmtDuration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function defaultCategory(meal: Meal): EventCategory {
  if (['pasta', 'rice', 'potato', 'noodles', 'bread'].includes(meal.carb) && meal.protein === 'veggie') return 'side';
  if (meal.adult && meal.minutes > 45) return 'main';
  return 'main';
}

// ── Create Event Modal ────────────────────────────────────────────────────────

function CreateEventModal({ onSave, onClose }: { onSave: (e: Omit<DinnerEvent, 'id'>) => void; onClose: () => void }) {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [serveTime, setServeTime] = useState('19:00');
  const [guestCount, setGuestCount] = useState(8);

  const save = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), date: date || undefined, serveTime, guestCount, dishes: [] });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
      onClick={onClose}>
      <div style={{ background: P.bg, borderRadius: '20px', padding: '24px', width: '100%', maxWidth: '400px', boxShadow: '0 8px 40px rgba(0,0,0,0.22)' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '22px', marginBottom: '20px' }}>New event</div>

        <label style={{ fontSize: '12px', fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '6px' }}>Event name</label>
        <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()}
          placeholder="Summer BBQ, Christmas Dinner…"
          autoFocus
          style={{ width: '100%', padding: '10px 12px', border: `2px solid ${P.border}`, borderRadius: '10px', fontSize: '15px', background: P.card, marginBottom: '16px', boxSizing: 'border-box', outline: 'none' }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '6px' }}>Date (optional)</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: `2px solid ${P.border}`, borderRadius: '10px', fontSize: '14px', background: P.card, boxSizing: 'border-box', outline: 'none' }} />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '6px' }}>Serve time</label>
            <input type="time" value={serveTime} onChange={e => setServeTime(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: `2px solid ${P.border}`, borderRadius: '10px', fontSize: '14px', background: P.card, boxSizing: 'border-box', outline: 'none' }} />
          </div>
        </div>

        <label style={{ fontSize: '12px', fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>Guests</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <button onClick={() => setGuestCount(n => Math.max(1, n - 1))}
            style={{ background: P.border, border: 'none', borderRadius: '8px', width: '36px', height: '36px', fontSize: '18px', cursor: 'pointer' }}>−</button>
          <span style={{ fontSize: '24px', fontWeight: 700, minWidth: '40px', textAlign: 'center' }}>{guestCount}</span>
          <button onClick={() => setGuestCount(n => Math.min(50, n + 1))}
            style={{ background: P.border, border: 'none', borderRadius: '8px', width: '36px', height: '36px', fontSize: '18px', cursor: 'pointer' }}>+</button>
        </div>

        <Primary onClick={save} disabled={!name.trim()}>Create event</Primary>
        <div style={{ marginTop: '8px' }}><Secondary onClick={onClose}>Cancel</Secondary></div>
      </div>
    </div>
  );
}

// ── Add Dish Modal ────────────────────────────────────────────────────────────

function AddDishModal({ allMeals, guestCount, existingDishes, onAdd, onClose }: {
  allMeals: Meal[];
  guestCount: number;
  existingDishes: EventDish[];
  onAdd: (dish: EventDish) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Meal | null>(null);
  const [category, setCategory] = useState<EventCategory>('main');
  const [servings, setServings] = useState(guestCount);

  const existingNames = existingDishes.map(d => d.meal.name);
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return allMeals.filter(m => !existingNames.includes(m.name) && (!q || m.name.toLowerCase().includes(q) || m.description?.toLowerCase().includes(q)));
  }, [query, allMeals, existingNames]);

  const handleSelect = (meal: Meal) => {
    setSelected(meal);
    setCategory(defaultCategory(meal));
    setServings(guestCount);
  };

  const handleAdd = () => {
    if (!selected) return;
    onAdd({ meal: selected, category, servings });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.55)', overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '24px 0 40px' } as React.CSSProperties}
      onClick={onClose}>
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0 16px' }} onClick={e => e.stopPropagation()}>
        <div style={{ background: P.bg, borderRadius: '20px', overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.22)' }}>
          <div style={{ background: `linear-gradient(135deg, ${P.accent}, ${P.accentDark})`, padding: '18px 20px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '20px' }}>{selected ? 'Configure dish' : 'Add a dish'}</div>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', fontSize: '16px', fontWeight: 700 }}>✕</button>
          </div>

          <div style={{ padding: '16px' }}>
            {!selected ? (
              <>
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search recipes…" autoFocus
                  style={{ width: '100%', padding: '10px 12px', border: `2px solid ${P.border}`, borderRadius: '10px', fontSize: '14px', background: P.card, marginBottom: '12px', boxSizing: 'border-box', outline: 'none' }} />
                <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
                  {filtered.slice(0, 40).map(meal => (
                    <button key={meal.name} onClick={() => handleSelect(meal)}
                      style={{ width: '100%', background: 'none', border: 'none', borderBottom: `1px solid ${P.border}`, padding: '10px 4px', cursor: 'pointer', textAlign: 'left', display: 'flex', gap: '12px', alignItems: 'center' }}>
                      {meal.photo ? <img src={meal.photo} alt="" style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} /> :
                        <div style={{ width: '44px', height: '44px', borderRadius: '8px', background: P.accentLight, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🍽️</div>}
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '14px' }}>{meal.name}</div>
                        <div style={{ fontSize: '12px', color: P.muted }}>{meal.time} · serves {meal.serves}</div>
                      </div>
                    </button>
                  ))}
                  {filtered.length === 0 && <div style={{ color: P.muted, fontSize: '14px', textAlign: 'center', padding: '24px' }}>No recipes found</div>}
                </div>
              </>
            ) : (
              <>
                <div style={{ background: P.accentLight, borderRadius: '12px', padding: '12px 14px', marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                  {selected.photo ? <img src={selected.photo} alt="" style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} /> :
                    <div style={{ width: '48px', height: '48px', borderRadius: '8px', background: P.card, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>🍽️</div>}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '15px' }}>{selected.name}</div>
                    <div style={{ fontSize: '13px', color: P.muted }}>{selected.time} · serves {selected.serves}</div>
                  </div>
                </div>

                <label style={{ fontSize: '12px', fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>Course</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                  {CATEGORY_ORDER_EVENT.map(cat => (
                    <button key={cat} onClick={() => setCategory(cat)}
                      style={{ padding: '6px 12px', borderRadius: '20px', border: `2px solid ${category === cat ? P.accent : P.border}`, background: category === cat ? P.accentLight : P.card, color: category === cat ? P.accentDark : P.text, fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                      {CATEGORY_LABELS[cat]}
                    </button>
                  ))}
                </div>

                <label style={{ fontSize: '12px', fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '8px' }}>Servings (recipe serves {selected.serves})</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                  <button onClick={() => setServings(n => Math.max(1, n - 1))}
                    style={{ background: P.border, border: 'none', borderRadius: '8px', width: '36px', height: '36px', fontSize: '18px', cursor: 'pointer' }}>−</button>
                  <span style={{ fontSize: '24px', fontWeight: 700, minWidth: '40px', textAlign: 'center' }}>{servings}</span>
                  <button onClick={() => setServings(n => Math.min(100, n + 1))}
                    style={{ background: P.border, border: 'none', borderRadius: '8px', width: '36px', height: '36px', fontSize: '18px', cursor: 'pointer' }}>+</button>
                </div>

                <Primary onClick={handleAdd}>Add to event</Primary>
                <div style={{ marginTop: '8px' }}>
                  <Secondary onClick={() => setSelected(null)}>← Back to search</Secondary>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Course Balance Hints ──────────────────────────────────────────────────────

function CourseBalanceHints({ dishes, onSuggest }: { dishes: EventDish[]; onSuggest: () => void }) {
  if (dishes.length === 0) return null;
  const cats = new Set(dishes.map(d => d.category));
  const missing: string[] = [];
  if (!cats.has('starter')) missing.push('starter');
  if (!cats.has('main')) missing.push('main');
  if (!cats.has('dessert')) missing.push('dessert');
  if (!missing.length) return null;

  return (
    <div style={{ background: P.accentLight, borderRadius: '10px', padding: '10px 14px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
      <div style={{ fontSize: '13px', color: P.accentDark, lineHeight: 1.3 }}>
        No {missing.join(' or ')} yet
      </div>
      <button onClick={onSuggest}
        style={{ background: P.accent, border: 'none', color: '#fff', borderRadius: '8px', padding: '5px 10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
        ✨ Suggest
      </button>
    </div>
  );
}

// ── Suggest Menu Panel ────────────────────────────────────────────────────────

function SuggestMenuPanel({ allMeals, event, onAddDishes, onClose }: {
  allMeals: Meal[];
  event: DinnerEvent;
  onAddDishes: (dishes: EventDish[]) => void;
  onClose: () => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [concept, setConcept] = useState('');
  const [suggested, setSuggested] = useState<Array<{ meal: Meal; category: EventCategory; selected: boolean }>>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggest = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError('');
    setSuggested([]);
    setConcept('');
    try {
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/suggest-event-menu`;
      const res = await logFetch('suggest-event-menu', fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          prompt,
          guestCount: event.guestCount,
          recipes: allMeals.map(m => ({
            name: m.name,
            course: m.course ?? 'main',
            cuisine: m.cuisine,
            protein: m.protein,
            description: m.description,
            time: m.time,
          })),
        }),
      });
      let data: any;
      try { data = await res.json(); } catch { throw new Error(`Server error ${res.status}`); }
      if (!res.ok) throw new Error(data?.error ?? `Server error ${res.status}`);
      if (data._usage) recordCost('suggest-event-menu', data._usage.input_tokens, data._usage.output_tokens);

      const existingNames = new Set(event.dishes.map(d => d.meal.name));
      const mealByName = new Map(allMeals.map(m => [m.name.toLowerCase(), m]));

      const matched = (data.dishes as Array<{ name: string; category: EventCategory }>)
        .filter(s => !existingNames.has(s.name))
        .map(s => {
          const meal = mealByName.get(s.name.toLowerCase());
          if (!meal) return null;
          return { meal, category: s.category as EventCategory, selected: true };
        })
        .filter(Boolean) as Array<{ meal: Meal; category: EventCategory; selected: boolean }>;

      setConcept(data.concept ?? '');
      setSuggested(matched);
      if (!matched.length) setError('No matching recipes found. Try a different description.');
    } catch (err: any) {
      log.error('suggest-event-menu', String(err));
      setError(err?.message ?? 'Could not generate suggestions. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggle = (name: string) =>
    setSuggested(prev => prev.map(s => s.meal.name === name ? { ...s, selected: !s.selected } : s));

  const addSelected = () => {
    const toAdd = suggested
      .filter(s => s.selected)
      .map(s => ({ meal: s.meal, category: s.category, servings: event.guestCount }));
    onAddDishes(toAdd);
  };

  const selectedCount = suggested.filter(s => s.selected).length;

  return (
    <div style={{ background: P.card, borderRadius: '16px', border: `2px solid ${P.accent}`, padding: '16px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ fontWeight: 700, fontSize: '15px' }}>✨ AI menu suggestion</div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: P.muted, fontSize: '18px', cursor: 'pointer', padding: '2px 6px', lineHeight: 1 }}>✕</button>
      </div>

      {!suggested.length && (
        <>
          <input
            ref={inputRef}
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && suggest()}
            placeholder={`e.g. "Summer BBQ", "Cosy Italian dinner for 6", "Veggie feast"`}
            autoFocus
            style={{ width: '100%', padding: '10px 12px', border: `2px solid ${P.border}`, borderRadius: '10px', fontSize: '14px', background: P.bg, marginBottom: '10px', boxSizing: 'border-box' as const, outline: 'none' }}
          />
          {error && <div style={{ color: '#DC2626', fontSize: '13px', marginBottom: '10px' }}>{error}</div>}
          <Primary onClick={suggest} disabled={loading || !prompt.trim()}>
            {loading ? '✨ Planning your menu…' : '✨ Suggest a menu'}
          </Primary>
        </>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: P.muted }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>👨‍🍳</div>
          <div style={{ fontSize: '13px' }}>Curating your menu…</div>
        </div>
      )}

      {!loading && suggested.length > 0 && (
        <>
          {concept && (
            <div style={{ fontSize: '13px', color: P.muted, fontStyle: 'italic', marginBottom: '12px', lineHeight: 1.4, borderBottom: `1px solid ${P.border}`, paddingBottom: '10px' }}>
              {concept}
            </div>
          )}
          {suggested.map(s => (
            <div key={s.meal.name} onClick={() => toggle(s.meal.name)}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '10px', cursor: 'pointer', marginBottom: '6px', transition: 'background 0.15s',
                background: s.selected ? P.accentLight : P.bg, border: `1.5px solid ${s.selected ? P.accent : P.border}` }}>
              {s.meal.photo
                ? <img src={s.meal.photo} alt="" style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }} />
                : <div style={{ width: '40px', height: '40px', borderRadius: '6px', background: P.accentLight, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>🍽️</div>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>{s.meal.name}</div>
                <div style={{ fontSize: '12px', color: P.muted }}>{CATEGORY_LABELS[s.category]} · {s.meal.time}</div>
              </div>
              <div style={{ fontSize: '16px', color: s.selected ? P.accent : P.muted, fontWeight: 700, flexShrink: 0 }}>
                {s.selected ? '✓' : '○'}
              </div>
            </div>
          ))}
          {error && <div style={{ color: '#DC2626', fontSize: '13px', marginTop: '8px', marginBottom: '4px' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <Primary onClick={addSelected} disabled={!selectedCount}>
              Add {selectedCount} dish{selectedCount !== 1 ? 'es' : ''}
            </Primary>
            <Secondary onClick={() => { setSuggested([]); setConcept(''); setError(''); setTimeout(() => inputRef.current?.focus(), 50); }}>
              Try again
            </Secondary>
          </div>
        </>
      )}
    </div>
  );
}

// ── Event Detail ──────────────────────────────────────────────────────────────

function EventDetail({ event, allMeals, pantry, onUpdate, onDelete, onBack }: {
  event: DinnerEvent;
  allMeals: Meal[];
  pantry: string;
  onUpdate: (patch: Partial<DinnerEvent>) => void;
  onDelete: () => void;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<'dishes' | 'shopping' | 'schedule'>('dishes');
  const [showAddDish, setShowAddDish] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const [editServeTime, setEditServeTime] = useState(false);
  const [serveTimeDraft, setServeTimeDraft] = useState(event.serveTime);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dishColorMap = useMemo(() => {
    const m = new Map<string, string>();
    event.dishes.forEach((d, i) => m.set(d.meal.name, DISH_COLORS[i % DISH_COLORS.length]));
    return m;
  }, [event.dishes]);

  const addDish = (dish: EventDish) => {
    onUpdate({ dishes: [...event.dishes, dish] });
    setShowAddDish(false);
  };

  const addDishes = (newDishes: EventDish[]) => {
    onUpdate({ dishes: [...event.dishes, ...newDishes] });
    setShowSuggest(false);
  };

  const removeDish = (mealName: string) => {
    const dishes = event.dishes.filter(d => d.meal.name !== mealName);
    const schedule = event.schedule?.filter(s => s.mealName !== mealName);
    onUpdate({ dishes, schedule });
  };

  const updateDishServings = (mealName: string, servings: number) => {
    onUpdate({ dishes: event.dishes.map(d => d.meal.name === mealName ? { ...d, servings } : d) });
  };

  const generateSchedule = async () => {
    if (!event.dishes.length) { setScheduleError('Add at least one dish first.'); return; }
    setScheduleLoading(true);
    setScheduleError('');
    try {
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-event-schedule`;
      log.info('generate-event-schedule', `Generating for ${event.dishes.length} dishes, serve ${event.serveTime}`);
      const res = await logFetch('generate-event-schedule', fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          dishes: event.dishes.map(d => ({
            name: d.meal.name,
            minutes: d.meal.minutes,
            category: d.category,
            steps: d.meal.steps ?? [],
            ingredients: scaledIngredients(d.meal.ingredients ?? [], d.servings / (d.meal.serves ?? 4)).map(i => i.display),
            description: d.meal.description,
          })),
          serveTime: event.serveTime,
          guestCount: event.guestCount,
        }),
      });
      let data: any;
      try { data = await res.json(); } catch { throw new Error(`Server error ${res.status}`); }
      if (!res.ok) throw new Error(data?.error ?? `Server error ${res.status}`);
      if (data._usage) recordCost('generate-event-schedule', data._usage.input_tokens, data._usage.output_tokens);
      onUpdate({ schedule: data.schedule, scheduleGeneratedAt: Date.now() });
    } catch (err: any) {
      log.error('generate-event-schedule', String(err));
      setScheduleError(err?.message ?? 'Could not generate schedule. Try again.');
    } finally {
      setScheduleLoading(false);
    }
  };

  const shopList = useMemo(
    () => buildEventShop(event.dishes, pantry),
    [event.dishes, pantry],
  );

  const dishesByCategory = useMemo(() => {
    const m = new Map<EventCategory, EventDish[]>();
    for (const cat of CATEGORY_ORDER_EVENT) m.set(cat, []);
    for (const d of event.dishes) m.get(d.category)!.push(d);
    return m;
  }, [event.dishes]);

  return (
    <>
      {showAddDish && (
        <AddDishModal
          allMeals={allMeals}
          guestCount={event.guestCount}
          existingDishes={event.dishes}
          onAdd={addDish}
          onClose={() => setShowAddDish(false)}
        />
      )}

      <div style={{ minHeight: '100vh', background: P.bg }}>
        {/* Header */}
        <div style={{ background: `linear-gradient(135deg, ${P.accent}, ${P.accentDark})`, padding: '16px 16px 0', color: '#fff' }}>
          <div style={{ maxWidth: '480px', margin: '0 auto' }}>
            <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>← Back</button>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '26px', marginBottom: '4px' }}>{event.name}</div>
            <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '4px' }}>
              {event.date ? `${fmtDate(event.date)} · ` : ''}{event.guestCount} guests
              {editServeTime ? (
                <input type="time" value={serveTimeDraft}
                  onChange={e => setServeTimeDraft(e.target.value)}
                  onBlur={() => { onUpdate({ serveTime: serveTimeDraft }); setEditServeTime(false); }}
                  autoFocus
                  style={{ marginLeft: '8px', background: 'rgba(255,255,255,0.3)', border: 'none', borderRadius: '6px', padding: '2px 6px', color: '#fff', fontSize: '13px', outline: 'none' }} />
              ) : (
                <button onClick={() => setEditServeTime(true)}
                  style={{ marginLeft: '8px', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '6px', padding: '2px 8px', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>
                  Serve {fmt12(event.serveTime)}
                </button>
              )}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '4px', marginTop: '12px' }}>
              {(['dishes', 'shopping', 'schedule'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  style={{ flex: 1, background: tab === t ? 'rgba(255,255,255,0.25)' : 'transparent', border: 'none', color: '#fff', padding: '8px 4px', borderRadius: '8px 8px 0 0', cursor: 'pointer', fontSize: '13px', fontWeight: 700, textTransform: 'capitalize', opacity: tab === t ? 1 : 0.7 }}>
                  {t === 'dishes' ? `🍽 Dishes (${event.dishes.length})` : t === 'shopping' ? '🛒 Shopping' : '⏰ Schedule'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '16px 16px 120px' }}>

          {/* ── Dishes tab ── */}
          {tab === 'dishes' && (
            <>
              {showSuggest && (
                <SuggestMenuPanel
                  allMeals={allMeals}
                  event={event}
                  onAddDishes={addDishes}
                  onClose={() => setShowSuggest(false)}
                />
              )}

              {event.dishes.length === 0 && !showSuggest && (
                <div style={{ textAlign: 'center', padding: '32px 16px 16px', color: P.muted }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>🍽️</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px', color: P.text }}>No dishes yet</div>
                  <div style={{ fontSize: '13px', marginBottom: '20px' }}>Build a menu manually or let AI suggest one.</div>
                  <button onClick={() => setShowSuggest(true)}
                    style={{ background: `linear-gradient(135deg, ${P.accent}, ${P.accentDark})`, border: 'none', color: '#fff', borderRadius: '12px', padding: '12px 20px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', marginBottom: '10px', width: '100%' }}>
                    ✨ Suggest a menu
                  </button>
                </div>
              )}

              {!showSuggest && event.dishes.length > 0 && (
                <CourseBalanceHints dishes={event.dishes} onSuggest={() => setShowSuggest(true)} />
              )}

              {CATEGORY_ORDER_EVENT.map(cat => {
                const dishes = dishesByCategory.get(cat) ?? [];
                if (!dishes.length) return null;
                return (
                  <div key={cat} style={{ marginBottom: '20px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>{CATEGORY_LABELS[cat]}</div>
                    {dishes.map(d => (
                      <div key={d.meal.name} style={{ background: P.card, borderRadius: '12px', padding: '12px', marginBottom: '8px', boxShadow: P.shadow, borderLeft: `4px solid ${dishColorMap.get(d.meal.name)}` }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                          {d.meal.photo && <img src={d.meal.photo} alt="" style={{ width: '52px', height: '52px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '2px' }}>{d.meal.name}</div>
                            <div style={{ fontSize: '12px', color: P.muted }}>{d.meal.time}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                              <span style={{ fontSize: '12px', color: P.muted }}>Serves:</span>
                              <button onClick={() => updateDishServings(d.meal.name, Math.max(1, d.servings - 1))}
                                style={{ background: P.border, border: 'none', borderRadius: '6px', width: '26px', height: '26px', fontSize: '14px', cursor: 'pointer' }}>−</button>
                              <span style={{ fontWeight: 700, fontSize: '14px', minWidth: '24px', textAlign: 'center' }}>{d.servings}</span>
                              <button onClick={() => updateDishServings(d.meal.name, Math.min(100, d.servings + 1))}
                                style={{ background: P.border, border: 'none', borderRadius: '6px', width: '26px', height: '26px', fontSize: '14px', cursor: 'pointer' }}>+</button>
                            </div>
                          </div>
                          <button onClick={() => removeDish(d.meal.name)}
                            style={{ background: 'none', border: 'none', color: P.muted, fontSize: '18px', cursor: 'pointer', padding: '4px', flexShrink: 0 }}>✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}

              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}><Primary onClick={() => setShowAddDish(true)}>+ Add dish</Primary></div>
                {!showSuggest && event.dishes.length > 0 && (
                  <button onClick={() => setShowSuggest(true)}
                    style={{ background: P.accentLight, border: `1.5px solid ${P.accent}`, color: P.accentDark, borderRadius: '12px', padding: '0 14px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    ✨ Suggest
                  </button>
                )}
              </div>

              <div style={{ marginTop: '24px', borderTop: `1px solid ${P.border}`, paddingTop: '16px' }}>
                {confirmDelete ? (
                  <div style={{ background: '#FEF2F2', borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px', color: '#DC2626' }}>Delete this event?</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={onDelete} style={{ flex: 1, background: '#DC2626', border: 'none', color: '#fff', borderRadius: '8px', padding: '10px', fontWeight: 700, cursor: 'pointer' }}>Delete</button>
                      <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, background: P.border, border: 'none', borderRadius: '8px', padding: '10px', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(true)} style={{ background: 'none', border: 'none', color: '#DC2626', fontSize: '13px', cursor: 'pointer', padding: '4px 0' }}>Delete event</button>
                )}
              </div>
            </>
          )}

          {/* ── Shopping tab ── */}
          {tab === 'shopping' && (
            <>
              {event.dishes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 16px', color: P.muted }}>
                  <div style={{ fontSize: '13px' }}>Add dishes to generate a shopping list.</div>
                </div>
              ) : Object.keys(shopList).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 16px', color: P.muted }}>
                  <div style={{ fontSize: '13px' }}>All ingredients are in your pantry.</div>
                </div>
              ) : (
                <>
                  <div style={{ background: P.accentLight, borderRadius: '12px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: P.accentDark, fontWeight: 600 }}>
                    Shopping for {event.dishes.reduce((s, d) => Math.max(s, d.servings), 0)} people · {event.dishes.length} dish{event.dishes.length !== 1 ? 'es' : ''}
                  </div>
                  {CATEGORY_ORDER.filter(cat => shopList[cat]?.length).map(cat => (
                    <div key={cat} style={{ marginBottom: '20px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                        {CAT_EMOJI[cat]} {cat}
                      </div>
                      {shopList[cat].map(item => (
                        <div key={item.label} style={{ background: P.card, borderRadius: '10px', padding: '10px 14px', marginBottom: '6px', fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: P.shadow }}>
                          <span style={{ fontWeight: 600 }}>{item.label}</span>
                          <span style={{ color: P.muted, fontSize: '13px' }}>{item.qty}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </>
              )}
            </>
          )}

          {/* ── Schedule tab ── */}
          {tab === 'schedule' && (
            <>
              {scheduleError && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '10px', padding: '10px 14px', color: '#DC2626', fontSize: '13px', marginBottom: '12px' }}>{scheduleError}</div>
              )}

              {event.dishes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 16px', color: P.muted }}>
                  <div style={{ fontSize: '13px' }}>Add dishes first, then generate a cooking schedule.</div>
                </div>
              ) : (
                <>
                  <Primary onClick={generateSchedule} disabled={scheduleLoading}>
                    {scheduleLoading ? '✨ Planning your kitchen…' : event.schedule ? '🔄 Regenerate schedule' : '✨ Generate cooking schedule'}
                  </Primary>

                  {event.schedule && !scheduleLoading && (
                    <div style={{ marginTop: '20px' }}>
                      <div style={{ fontSize: '12px', color: P.muted, marginBottom: '16px' }}>
                        Serving at {fmt12(event.serveTime)} · {event.dishes.length} dishes for {event.guestCount} guests
                      </div>

                      {/* Timeline */}
                      <div style={{ position: 'relative' }}>
                        {/* Vertical line */}
                        <div style={{ position: 'absolute', left: '19px', top: '8px', bottom: '8px', width: '2px', background: P.border, zIndex: 0 }} />

                        {event.schedule.map((block, i) => {
                          const isServe = block.mealName === 'Serve';
                          const color = isServe ? P.green : (dishColorMap.get(block.mealName) ?? P.accent);
                          const duration = minsBetween(block.startTime, block.endTime);
                          return (
                            <div key={i} style={{ display: 'flex', gap: '12px', marginBottom: '16px', position: 'relative', zIndex: 1 }}>
                              {/* Dot */}
                              <div style={{ flexShrink: 0, width: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: color, border: `3px solid ${P.bg}`, boxShadow: `0 0 0 2px ${color}`, marginTop: '4px' }} />
                              </div>
                              {/* Content */}
                              <div style={{ flex: 1, background: isServe ? P.greenLight : P.card, borderRadius: '12px', padding: '10px 12px', boxShadow: P.shadow, borderLeft: `3px solid ${color}` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                                  <div style={{ fontWeight: 700, fontSize: '13px', color }}>{isServe ? '🎉 Serve' : block.mealName}</div>
                                  <div style={{ fontSize: '12px', fontWeight: 700, color: P.muted, whiteSpace: 'nowrap', marginLeft: '8px' }}>
                                    {fmt12(block.startTime)}{duration > 0 ? ` · ${fmtDuration(duration)}` : ''}
                                  </div>
                                </div>
                                <div style={{ fontSize: '13px', color: P.text, lineHeight: 1.4 }}>{block.action}</div>
                                {block.note && (
                                  <div style={{ fontSize: '12px', color: P.muted, marginTop: '5px', fontStyle: 'italic' }}>📌 {block.note}</div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {scheduleLoading && (
                    <div style={{ textAlign: 'center', padding: '40px 16px', color: P.muted }}>
                      <div style={{ fontSize: '32px', marginBottom: '12px' }}>👨‍🍳</div>
                      <div style={{ fontSize: '14px' }}>Planning your kitchen…</div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ── Events Screen (list) ──────────────────────────────────────────────────────

export function EventsScreen({ events, allMeals, pantry, onCreateEvent, onUpdateEvent, onDeleteEvent }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedEvent = events.find(e => e.id === selectedId) ?? null;

  const handleCreate = (e: Omit<DinnerEvent, 'id'>) => {
    onCreateEvent(e);
    setShowCreate(false);
    // Select the newly created event — it gets the last id in the array after next render
    // We use a small trick: the parent calls setHs synchronously, so the new event is at the end
  };

  if (selectedEvent) {
    return (
      <EventDetail
        event={selectedEvent}
        allMeals={allMeals}
        pantry={pantry}
        onUpdate={patch => onUpdateEvent(selectedEvent.id, patch)}
        onDelete={() => { onDeleteEvent(selectedEvent.id); setSelectedId(null); }}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <>
      {showCreate && (
        <CreateEventModal
          onSave={e => { handleCreate(e); }}
          onClose={() => setShowCreate(false)}
        />
      )}

      <div style={{ minHeight: '100vh', background: P.bg }}>
        <div style={{ background: `linear-gradient(135deg, ${P.accent}, ${P.accentDark})`, padding: '20px 16px 24px', color: '#fff' }}>
          <div style={{ maxWidth: '480px', margin: '0 auto' }}>
            <div style={{ fontSize: '11px', opacity: 0.85, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: '4px' }}>Dinner parties & gatherings</div>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '28px' }}>🎉 Events</div>
          </div>
        </div>

        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '16px 16px 120px' }}>
          {events.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 16px' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>🍽️</div>
              <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Plan your next gathering</div>
              <div style={{ fontSize: '14px', color: P.muted, lineHeight: 1.5, marginBottom: '24px' }}>
                Create an event to plan a full menu, get a combined shopping list, and a step-by-step cooking schedule so everything lands on the table at the same time.
              </div>
              <Primary onClick={() => setShowCreate(true)}>+ New event</Primary>
            </div>
          ) : (
            <>
              <Primary onClick={() => setShowCreate(true)}>+ New event</Primary>
              <div style={{ marginTop: '16px' }}>
                {events.map(ev => {
                  const mains = ev.dishes.filter(d => d.category === 'main').length;
                  const sides = ev.dishes.filter(d => d.category === 'side').length;
                  return (
                    <button key={ev.id} onClick={() => setSelectedId(ev.id)}
                      style={{ width: '100%', background: P.card, border: 'none', borderRadius: '16px', padding: '16px', marginBottom: '10px', cursor: 'pointer', textAlign: 'left', boxShadow: P.shadow, display: 'flex', gap: '14px', alignItems: 'center' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: P.accentLight, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>🎉</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '3px' }}>{ev.name}</div>
                        <div style={{ fontSize: '13px', color: P.muted }}>
                          {ev.date ? `${fmtDate(ev.date)} · ` : ''}{ev.guestCount} guests · serve {fmt12(ev.serveTime)}
                        </div>
                        {ev.dishes.length > 0 && (
                          <div style={{ fontSize: '12px', color: P.accent, marginTop: '3px', fontWeight: 600 }}>
                            {ev.dishes.length} dish{ev.dishes.length !== 1 ? 'es' : ''}
                            {mains > 0 ? ` · ${mains} main${mains !== 1 ? 's' : ''}` : ''}
                            {sides > 0 ? ` · ${sides} side${sides !== 1 ? 's' : ''}` : ''}
                            {ev.schedule ? ' · schedule ready' : ''}
                          </div>
                        )}
                      </div>
                      <div style={{ color: P.muted, fontSize: '18px' }}>›</div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
