import React from 'react';
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

export function Toast({ message }: { message: string }) {
  return (
    <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: P.text,
      color: '#fff', padding: '11px 20px', borderRadius: '12px', fontSize: '14px', fontWeight: 600,
      boxShadow: P.shadowMd, zIndex: 1000, whiteSpace: 'nowrap' }}>
      {message}
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

export function TimeSlider({ value, onChange, onCommit, label }: {
  value: string; onChange: (v: string) => void; onCommit?: (v: string) => void; label?: string;
}) {
  const num = value === 'any' ? 60 : (parseInt(value) || 60);
  const display = value === 'any' ? 'Any time' : `≤ ${value} min`;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        {label && <span style={{ fontSize: '11px', fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: '0.8px' }}>{label}</span>}
        <span style={{ fontSize: '12px', fontWeight: 700, color: P.accent, marginLeft: 'auto' }}>{display}</span>
      </div>
      <input type="range" min="15" max="60" step="5" value={num}
        onChange={e => { const v = parseInt(e.target.value); onChange(v >= 60 ? 'any' : String(v)); }}
        onPointerUp={e => { if (onCommit) { const v = parseInt((e.target as HTMLInputElement).value); onCommit(v >= 60 ? 'any' : String(v)); } }}
        style={{ width: '100%', accentColor: P.accent, cursor: 'pointer' } as any} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: P.muted, marginTop: '2px' }}>
        <span>15 min</span><span>Any time</span>
      </div>
    </div>
  );
}
