import React, { useState } from 'react';
import type { Meal, DayName, DayMode } from '../lib/types';
import { P } from '../lib/constants';
import { Primary, Secondary } from './ui';
import { getLogs, clearLogs, getTotalCost } from '../lib/logger';

export function formatLastUsed(date: number | null): string | null {
  if (!date) return null;
  const days = Math.round((Date.now() - date) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days}d ago`;
  return `${Math.round(days / 7)}w ago`;
}

export const SEASON_INFO: Record<string, { label: string }> = {
  spring: { label: '🌸 Spring' }, summer: { label: '☀️ Summer' },
  autumn: { label: '🍂 Autumn' }, winter: { label: '❄️ Winter' },
};

export function Screen({ children, padBottom }: { children: React.ReactNode; padBottom?: string }) {
  return (
    <div style={{ minHeight: '100vh', background: P.bg, padding: `0 0 ${padBottom ?? '80px'}` }}>
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0 16px' }}>{children}</div>
    </div>
  );
}

export function Header({ eyebrow, title, subtitle, actions }: { eyebrow: string; title: string; subtitle?: string; actions?: React.ReactNode }) {
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

export function IconBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title?: string }) {
  return (
    <button onClick={onClick} title={title}
      style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: '10px', padding: '7px 10px', fontSize: '16px', cursor: 'pointer' }}>
      {children}
    </button>
  );
}

export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
      <div style={{ fontWeight: 700, fontSize: '15px' }}>{label}</div>
      {children}
    </div>
  );
}

export function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (n: number) => void }) {
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

export function Chip({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ background: active ? P.accentLight : 'transparent', border: `1.5px solid ${active ? P.accent : P.border}`,
        borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: 700, color: active ? P.accentDark : P.muted, cursor: 'pointer' }}>
      {children}
    </button>
  );
}

export function DayActions({ onHome, onOff }: { onHome?: () => void; onOff?: () => void }) {
  return (
    <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
      {onHome && <ActionBtn bg={P.accentLight} color={P.accentDark} onClick={onHome}>🍽️ Use a recipe</ActionBtn>}
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

export function DayToggle({ day, mode: rawMode, onChange }: { day: DayName; mode: string; onChange: (m: DayMode) => void }) {
  const mode: DayMode = rawMode === 'gousto' ? 'off' : (rawMode as DayMode) ?? 'home';
  const cycle: Record<DayMode, DayMode> = { home: 'off', off: 'home' };
  const labels: Record<DayMode, string> = { home: '🍽️ Home', off: '— Off' };
  const colors: Record<DayMode, [string, string]> = { home: [P.accentLight, P.accentDark], off: ['#F0F0F0', P.muted] };
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

export function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
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

export function MealPicker({ meals, favourites, dislikes, onPick, onToggleFav, onDislike }: {
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

export function AddMealForm({ onSave, onCancel, initial }: { onSave: (m: Meal) => Promise<void>; onCancel: () => void; initial?: Meal }) {
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

export function HelpModal({ onClose }: { onClose: () => void }) {
  const sections = [
    { icon: '📅', title: 'Your week', items: [
      'Tap any meal card to see its full description. Tap "Ingredients & recipe" to expand the full recipe with ingredients scaled to your family size.',
      '☆ to favourite a meal — favourites are suggested 2.5× more often.',
      '🔄 to swap a meal for a different suggestion.',
      '👎 to skip a meal forever. It disappears from suggestions.',
      '📋 to hand-pick any meal from the full library for that day.',
    ]},
    { icon: '🍴', title: 'Find a recipe', items: [
      'Tap "Find a recipe" in the bottom bar to get a meal suggestion independent of your weekly plan.',
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

export function BrowseMealCard({ meal, isFav, onFav, onAdd, onView, compact, communityLabel }: {
  meal: Meal; isFav: boolean; onFav: () => void; onAdd: () => void; onView?: () => void; compact?: boolean; communityLabel?: boolean;
}) {
  const cardStyle: React.CSSProperties = compact
    ? { width: '140px', flexShrink: 0, background: P.card, borderRadius: '14px', overflow: 'hidden', boxShadow: P.shadow, border: `1px solid ${P.border}`, cursor: 'pointer' }
    : { background: P.card, borderRadius: '14px', overflow: 'hidden', boxShadow: P.shadow, border: `1px solid ${P.border}`, cursor: onView ? 'pointer' : 'default' };
  return (
    <div style={cardStyle} onClick={onView}>
      {meal.photo && (
        <div style={{ position: 'relative' }}>
          <img src={meal.photo} alt={meal.name} loading="lazy"
            style={{ width: '100%', height: compact ? '90px' : '120px', objectFit: 'cover', display: 'block' }} />
          <button onClick={e => { e.stopPropagation(); onFav(); }}
            style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(255,255,255,0.85)', border: 'none', borderRadius: '20px', width: '28px', height: '28px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isFav ? '★' : '☆'}
          </button>
        </div>
      )}
      <div style={{ padding: compact ? '8px' : '10px 12px 12px' }}>
        <div style={{ fontWeight: 700, fontSize: compact ? '12px' : '13px', lineHeight: 1.3, marginBottom: '3px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>
          {meal.name}
        </div>
        <div style={{ fontSize: '11px', color: P.muted, marginBottom: compact ? '6px' : '8px' }}>
          ⏱ {meal.time}{communityLabel ? ' · 👥' : ''}
        </div>
        {!compact && (
          <button onClick={e => { e.stopPropagation(); onAdd(); }}
            style={{ width: '100%', background: P.accentLight, border: 'none', borderRadius: '8px', padding: '7px', fontSize: '12px', fontWeight: 700, color: P.accentDark, cursor: 'pointer' }}>
            + Add to plan
          </button>
        )}
        {compact && (
          <button onClick={e => { e.stopPropagation(); onAdd(); }}
            style={{ width: '100%', background: P.accentLight, border: 'none', borderRadius: '6px', padding: '5px', fontSize: '11px', fontWeight: 700, color: P.accentDark, cursor: 'pointer' }}>
            + Add
          </button>
        )}
      </div>
    </div>
  );
}

export function RecipeDetailSheet({ meal, isFav, onFav, onAdd, onClose, familySize }: {
  meal: Meal; isFav: boolean; onFav: () => void; onAdd: () => void; onClose: () => void; familySize: number;
}) {
  const scale = familySize / (meal.serves ?? 4);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
      onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />
      <div style={{ position: 'relative', background: P.bg, borderRadius: '20px 20px 0 0', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 -4px 32px rgba(0,0,0,0.18)' }}
        onClick={e => e.stopPropagation()}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
          <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: P.border }} />
        </div>
        {/* Photo or gradient header */}
        {meal.photo ? (
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <img src={meal.photo} alt={meal.name} style={{ width: '100%', height: '200px', objectFit: 'cover', display: 'block' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 60%)' }} />
            <button onClick={onClose} style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(0,0,0,0.4)', border: 'none', color: '#fff', borderRadius: '20px', width: '32px', height: '32px', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 16px 4px' }}>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: P.muted, fontSize: '22px', cursor: 'pointer', padding: '4px 8px' }}>✕</button>
          </div>
        )}
        {/* Scrollable content */}
        <div style={{ overflowY: 'auto', padding: '16px 20px 32px', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
          {/* Title + meta */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '22px', lineHeight: 1.25, flex: 1, marginRight: '12px' }}>{meal.name}</div>
            <button onClick={onFav} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: isFav ? P.gold : P.muted, flexShrink: 0, padding: '2px' }}>
              {isFav ? '★' : '☆'}
            </button>
          </div>
          <div style={{ fontSize: '13px', color: P.muted, marginBottom: '14px' }}>
            ⏱ {meal.time} · {meal.cuisine} · {meal.protein} · serves {meal.serves ?? 4}
          </div>
          {meal.description && (
            <div style={{ fontSize: '14px', color: P.text, lineHeight: 1.6, marginBottom: '18px' }}>{meal.description}</div>
          )}
          {/* Ingredients */}
          {(meal.ingredients ?? []).length > 0 && (
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', color: P.muted, marginBottom: '8px' }}>
                Ingredients {familySize !== (meal.serves ?? 4) && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>· scaled for {familySize}</span>}
              </div>
              <div style={{ background: P.card, borderRadius: '12px', border: `1px solid ${P.border}`, padding: '4px 14px' }}>
                {(meal.ingredients ?? []).map((ing, i) => (
                  <div key={i} style={{ padding: '8px 0', borderBottom: i < (meal.ingredients ?? []).length - 1 ? `1px solid ${P.border}` : 'none', fontSize: '14px', lineHeight: 1.5 }}>
                    {scale !== 1 ? scaleIngredient(ing, scale) : ing}
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Steps */}
          {(meal.steps ?? []).length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', color: P.muted, marginBottom: '8px' }}>Method</div>
              {(meal.steps ?? []).map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: '12px', marginBottom: '10px' }}>
                  <div style={{ flexShrink: 0, width: '24px', height: '24px', borderRadius: '50%', background: P.accentLight, color: P.accentDark, fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</div>
                  <div style={{ fontSize: '14px', lineHeight: 1.6, color: P.text, paddingTop: '2px' }}>{step}</div>
                </div>
              ))}
            </div>
          )}
          {/* Add to plan */}
          <button onClick={onAdd}
            style={{ width: '100%', background: P.accent, color: '#fff', border: 'none', borderRadius: '12px', padding: '14px', fontSize: '15px', fontWeight: 700, cursor: 'pointer' }}>
            + Add to plan
          </button>
        </div>
      </div>
    </div>
  );
}

function scaleIngredient(ingredient: string, scale: number): string {
  if (Math.abs(scale - 1) < 0.05) return ingredient;
  return ingredient.replace(/(\d+\.?\d*)/g, (_, n) => {
    const scaled = parseFloat(n) * scale;
    return scaled % 1 === 0 ? String(scaled) : scaled.toFixed(1).replace(/\.0$/, '');
  });
}

export function LogsPanel() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState(() => getLogs());
  const [totalCost, setTotalCost] = useState(() => getTotalCost());

  const refresh = () => { setEntries(getLogs()); setTotalCost(getTotalCost()); };

  const copyAll = () => {
    const text = entries.map(e =>
      `[${new Date(e.ts).toISOString()}] [${e.level.toUpperCase()}] [${e.ctx}] ${e.msg}${e.data ? ' ' + JSON.stringify(e.data) : ''}`
    ).join('\n');
    navigator.clipboard?.writeText(text).then(() => {});
  };

  const LEVEL_COLOR: Record<string, string> = { error: '#c0392b', warn: '#d97706', info: P.muted };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: open ? '10px' : 0 }}>
        <button onClick={() => { setOpen(x => !x); refresh(); }}
          style={{ background: 'none', border: 'none', fontWeight: 700, fontSize: '14px', color: P.text, cursor: 'pointer', padding: 0 }}>
          {open ? '▲' : '▼'} Debug logs ({entries.length})
        </button>
        {!open && totalCost > 0 && (
          <span style={{ fontSize: '12px', color: P.muted }}>API cost: <strong>${totalCost.toFixed(4)}</strong></span>
        )}
        {open && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={copyAll} style={{ background: 'none', border: 'none', color: P.accent, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Copy all</button>
            <button onClick={() => { clearLogs(); refresh(); }} style={{ background: 'none', border: 'none', color: P.muted, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Clear</button>
          </div>
        )}
      </div>
      {open && totalCost > 0 && (
        <div style={{ background: '#EDE9FE', borderRadius: '8px', padding: '8px 12px', marginBottom: '8px', fontSize: '12px', color: '#5B21B6', fontWeight: 600 }}>
          Estimated API cost (this device): ${totalCost.toFixed(4)} — based on Haiku 4.5 pricing ($0.80/MTok in, $4.00/MTok out)
        </div>
      )}
      {open && (
        <div style={{ background: '#1a1a1a', borderRadius: '10px', padding: '10px 12px', maxHeight: '280px', overflowY: 'auto', fontFamily: 'monospace' }}>
          {entries.length === 0
            ? <div style={{ fontSize: '12px', color: '#666' }}>No logs yet.</div>
            : [...entries].reverse().map((e, i) => (
                <div key={i} style={{ fontSize: '11px', lineHeight: 1.6, color: LEVEL_COLOR[e.level] ?? P.muted, borderBottom: i < entries.length - 1 ? '1px solid #333' : 'none', paddingBottom: '3px', marginBottom: '3px' }}>
                  <span style={{ color: '#666' }}>{new Date(e.ts).toLocaleTimeString()} </span>
                  <span style={{ color: '#888' }}>[{e.ctx}] </span>
                  {e.msg}
                  {e.data && <span style={{ color: '#555' }}> {JSON.stringify(e.data)}</span>}
                </div>
              ))
          }
        </div>
      )}
    </div>
  );
}
