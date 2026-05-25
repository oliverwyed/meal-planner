import React, { useState, useEffect } from 'react';
import { P } from '../lib/constants';

export function Primary({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ width: '100%', background: disabled ? P.border : P.accent, color: disabled ? P.muted : '#fff', border: 'none',
        borderRadius: '14px', padding: '14px', fontSize: '15px', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
        marginBottom: '10px', transition: 'opacity 0.15s' }}>
      {children}
    </button>
  );
}

export function Secondary({ children, onClick, muted }: { children: React.ReactNode; onClick?: () => void; muted?: boolean }) {
  return (
    <button onClick={onClick}
      style={{ width: '100%', background: 'transparent', color: muted ? P.muted : P.accent, border: `1.5px solid ${muted ? P.border : P.accentLight}`,
        borderRadius: '14px', padding: '13px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', marginBottom: '10px' }}>
      {children}
    </button>
  );
}

export function Tag({ children, bg, color }: { children: React.ReactNode; bg: string; color: string }) {
  return (
    <span style={{ display: 'inline-block', background: bg, color, borderRadius: '8px', padding: '2px 8px',
      fontSize: '11px', fontWeight: 700, marginRight: '5px', marginBottom: '3px' }}>
      {children}
    </span>
  );
}

export function Toast({ message, onUndo, bottom }: { message: string; onUndo?: () => void; bottom?: string }) {
  return (
    <div style={{ position: 'fixed', bottom: bottom ?? 'calc(72px + env(safe-area-inset-bottom, 0px))', left: '50%', transform: 'translateX(-50%)', background: P.text,
      color: '#fff', padding: '11px 20px', borderRadius: '12px', fontSize: '14px', fontWeight: 600,
      boxShadow: P.shadowMd, zIndex: 1000, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '12px' }}>
      {message}
      {onUndo && (
        <button onClick={onUndo}
          style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '6px',
            padding: '3px 9px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
          Undo
        </button>
      )}
    </div>
  );
}

export function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ width: '32px', height: '32px', border: `3px solid ${P.border}`, borderTopColor: P.accent,
        borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export function Section({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: P.card, borderRadius: '14px', padding: '14px 18px', marginBottom: '10px',
      boxShadow: P.shadow, border: `1px solid ${P.border}`, ...style }}>
      {children}
    </div>
  );
}

export function ActiveTimers({ timers, onDismiss }: {
  timers: { id: string; label: string; remaining: number; total: number; done: boolean }[];
  onDismiss: (id: string) => void;
}) {
  if (timers.length === 0) return null;
  return (
    <div style={{ position: 'fixed', bottom: 'calc(68px + env(safe-area-inset-bottom, 0px))', left: '50%', transform: 'translateX(-50%)', zIndex: 300,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', pointerEvents: 'none' }}>
      {timers.map(t => {
        const pct = t.total > 0 ? Math.max(0, t.remaining / t.total) : 0;
        return (
          <div key={t.id}
            style={{ background: '#1E293B', color: '#fff', borderRadius: '20px', padding: '7px 14px',
              display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600,
              boxShadow: '0 4px 16px rgba(0,0,0,0.25)', pointerEvents: 'auto',
              whiteSpace: 'nowrap' }}>
            <span style={{ fontSize: '11px', opacity: 0.7, maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.label}</span>
            {t.done
              ? <span style={{ color: '#4ADE80', fontWeight: 700 }}>Done ✓</span>
              : <>
                  <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct * 100}%`, height: '100%', background: pct < 0.25 ? '#F87171' : '#818CF8', borderRadius: '2px', transition: 'width 1s linear' }} />
                  </div>
                  <span style={{ fontVariantNumeric: 'tabular-nums', minWidth: '36px' }}>
                    {Math.floor(t.remaining / 60)}:{String(t.remaining % 60).padStart(2, '0')}
                  </span>
                </>
            }
            <button onClick={() => onDismiss(t.id)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
                fontSize: '16px', lineHeight: 1, padding: '0 0 0 2px', display: 'flex', alignItems: 'center' }}
              aria-label="Cancel timer">×</button>
          </div>
        );
      })}
    </div>
  );
}

export function TimeSlider({ value, onChange, onCommit, label }: {
  value: string; onChange: (v: string) => void; onCommit?: (v: string) => void; label?: string;
}) {
  const toNum = (v: string) => v === 'any' ? 60 : (parseInt(v) || 60);
  const [localVal, setLocalVal] = useState(() => toNum(value));
  useEffect(() => { setLocalVal(toNum(value)); }, [value]);
  const display = localVal >= 60 ? 'Any time' : `≤ ${localVal} min`;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        {label && <span style={{ fontSize: '11px', fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: '0.8px' }}>{label}</span>}
        <span style={{ fontSize: '12px', fontWeight: 700, color: P.accent, marginLeft: 'auto' }}>{display}</span>
      </div>
      <input type="range" min="15" max="60" step="5" value={localVal}
        onChange={e => setLocalVal(parseInt(e.target.value))}
        onPointerUp={e => {
          const v = parseInt((e.target as HTMLInputElement).value);
          const str = v >= 60 ? 'any' : String(v);
          onChange(str);
          if (onCommit) onCommit(str);
        }}
        style={{ width: '100%', accentColor: P.accent, cursor: 'pointer' } as any} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: P.muted, marginTop: '2px' }}>
        <span>15 min</span><span>Any time</span>
      </div>
    </div>
  );
}

export const BOTTOM_NAV_HEIGHT = 56;

export function BottomNav({ onPlan, onShopping, onBrowse, onProfile, onEvents, active }: {
  onPlan: () => void;
  onShopping: () => void;
  onBrowse: () => void;
  onProfile: () => void;
  onEvents?: () => void;
  active?: 'shopping' | 'browse' | 'plan' | 'settings' | 'profile' | 'events';
}) {
  const tabs = [
    { id: 'plan', icon: '📅', label: 'Week', onClick: onPlan },
    { id: 'shopping', icon: '🛒', label: 'Shopping', onClick: onShopping },
    { id: 'browse', icon: '🍴', label: 'Recipes', onClick: onBrowse },
    ...(onEvents ? [{ id: 'events', icon: '🎉', label: 'Events', onClick: onEvents }] : []),
    { id: 'profile', icon: '👤', label: 'Account', onClick: onProfile },
  ];
  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
      background: P.card, borderTop: `1px solid ${P.border}`,
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      display: 'grid', gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
      {tabs.map(({ id, icon, label, onClick }) => {
        const isActive = active === id;
        return (
          <button key={id} onClick={onClick}
            style={{ background: 'none', border: 'none', padding: '10px 4px 10px', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
              borderTop: isActive ? `2px solid ${P.accent}` : '2px solid transparent' }}>
            <span style={{ fontSize: '20px', lineHeight: 1 }}>{icon}</span>
            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.3px',
              color: isActive ? P.accent : P.muted }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function BackBar({ onClick, label = '← Back to plan' }: { onClick: () => void; label?: string }) {
  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
      background: P.card, borderTop: `1px solid ${P.border}`,
      padding: `10px 16px calc(10px + env(safe-area-inset-bottom, 0px))` }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        <button onClick={onClick}
          style={{ background: 'none', border: 'none', color: P.accent, fontSize: '15px',
            fontWeight: 700, cursor: 'pointer', padding: '4px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
          {label}
        </button>
      </div>
    </div>
  );
}
