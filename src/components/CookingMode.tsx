import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Meal } from '../lib/types';
import { parseTimerParts } from '../lib/timers';
import { buildMealShop, CAT_EMOJI } from '../lib/shopping';

interface Timer {
  id: string;
  label: string;
  remaining: number;
  total: number;
  done: boolean;
}

interface Props {
  meal: Meal;
  familySize: number;
  onClose: () => void;
  onStartTimer: (label: string, seconds: number) => void;
  timers: Timer[];
  onDismissTimer: (id: string) => void;
}

export function CookingMode({ meal, familySize, onClose, onStartTimer, timers, onDismissTimer }: Props) {
  const [stepIdx, setStepIdx] = useState(0);
  const [showIngredients, setShowIngredients] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [panelOffset, setPanelOffset] = useState(0);
  const wakeLockRef = useRef<any>(null);
  const touchStartX = useRef<number | null>(null);
  const panelTouchStartY = useRef<number | null>(null);

  const steps = meal.steps ?? [];
  const scale = familySize / (meal.serves ?? 4);
  const shopByCategory = buildMealShop(meal, scale);
  const allIngredients = Object.values(shopByCategory).flat();

  // Wake lock — keep screen on while cooking
  useEffect(() => {
    async function acquire() {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock?.request('screen');
      } catch {}
    }
    acquire();
    return () => { wakeLockRef.current?.release(); };
  }, []);

  // Re-acquire wake lock if tab becomes visible again
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') {
        (navigator as any).wakeLock?.request('screen').then((lock: any) => {
          wakeLockRef.current = lock;
        }).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') setStepIdx(i => Math.min(i + 1, steps.length - 1));
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') setStepIdx(i => Math.max(i - 1, 0));
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [steps.length, onClose]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) {
      if (dx < 0) setStepIdx(i => Math.min(i + 1, steps.length - 1));
      else setStepIdx(i => Math.max(i - 1, 0));
    }
    touchStartX.current = null;
  }, [steps.length]);

  const handlePanelDragStart = useCallback((e: React.TouchEvent) => {
    panelTouchStartY.current = e.touches[0].clientY;
    setPanelOffset(0);
  }, []);

  const handlePanelDragMove = useCallback((e: React.TouchEvent) => {
    if (panelTouchStartY.current === null) return;
    const dy = e.touches[0].clientY - panelTouchStartY.current;
    if (dy > 0) setPanelOffset(dy);
  }, []);

  const handlePanelDragEnd = useCallback(() => {
    if (panelOffset > 80) {
      setShowIngredients(false);
    }
    setPanelOffset(0);
    panelTouchStartY.current = null;
  }, [panelOffset]);

  const progress = steps.length > 1 ? (stepIdx / (steps.length - 1)) * 100 : 100;
  const currentStep = steps[stepIdx] ?? '';
  const stepTimers = timers.filter(t => !t.done);
  const doneTimers = timers.filter(t => t.done);

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#0F172A', color: '#F8FAFC',
        display: 'flex', flexDirection: 'column', fontFamily: "'DM Sans', sans-serif" }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 16px 0', gap: '12px', flexShrink: 0 }}>
        <button onClick={onClose}
          style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '10px',
            color: '#94A3B8', fontSize: '14px', fontWeight: 600, padding: '8px 12px', cursor: 'pointer', flexShrink: 0 }}>
          ✕ Exit
        </button>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '17px', fontWeight: 700,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meal.name}</div>
          {steps.length > 0 && (
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
              Step {stepIdx + 1} of {steps.length}
            </div>
          )}
        </div>
        <button onClick={() => { setShowIngredients(s => !s); setPanelOffset(0); }}
          style={{ background: showIngredients ? '#4F46E5' : 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '10px',
            color: showIngredients ? '#fff' : '#94A3B8', fontSize: '14px', fontWeight: 600,
            padding: '8px 12px', cursor: 'pointer', flexShrink: 0 }}>
          🧾 {allIngredients.length > 0 ? `${checked.size}/${allIngredients.length}` : 'Ingredients'}
        </button>
      </div>

      {/* Progress bar */}
      {steps.length > 0 && (
        <div style={{ margin: '12px 16px 0', height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', flexShrink: 0 }}>
          <div style={{ width: `${progress}%`, height: '100%', background: '#4F46E5', borderRadius: '2px', transition: 'width 0.3s ease' }} />
        </div>
      )}

      {/* Active timers bar */}
      {(stepTimers.length > 0 || doneTimers.length > 0) && (
        <div style={{ display: 'flex', gap: '8px', padding: '10px 16px 0', flexWrap: 'wrap', flexShrink: 0 }}>
          {[...stepTimers, ...doneTimers].map(t => {
            const pct = t.total > 0 ? Math.max(0, t.remaining / t.total) : 0;
            return (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '6px',
                background: t.done ? 'rgba(74,222,128,0.15)' : 'rgba(79,70,229,0.25)',
                borderRadius: '20px', padding: '5px 10px 5px 12px', fontSize: '13px', fontWeight: 600 }}>
                <span style={{ opacity: 0.7, maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '11px' }}>{t.label}</span>
                {t.done
                  ? <span style={{ color: '#4ADE80' }}>Done ✓</span>
                  : <>
                      <div style={{ width: '28px', height: '3px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ width: `${pct * 100}%`, height: '100%', background: pct < 0.25 ? '#F87171' : '#818CF8', borderRadius: '2px', transition: 'width 1s linear' }} />
                      </div>
                      <span style={{ fontVariantNumeric: 'tabular-nums', minWidth: '32px', fontSize: '13px' }}>
                        {Math.floor(t.remaining / 60)}:{String(t.remaining % 60).padStart(2, '0')}
                      </span>
                    </>
                }
                <button onClick={() => onDismissTimer(t.id)}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)',
                    cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '0 0 0 2px' }}>×</button>
              </div>
            );
          })}
        </div>
      )}

      {/* Main content — step or no-steps fallback */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 16px', display: 'flex', flexDirection: 'column' }}>
        {steps.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', color: '#475569' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>🍽️</div>
              <div style={{ fontSize: '16px' }}>No steps for this recipe.</div>
              <div style={{ fontSize: '13px', marginTop: '6px' }}>Check the ingredients panel above.</div>
            </div>
          </div>
        ) : (
          <>
            {/* Step number */}
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#4F46E5', letterSpacing: '1.5px',
              textTransform: 'uppercase', marginBottom: '16px' }}>
              Step {stepIdx + 1}
            </div>

            {/* Step text — large and readable */}
            <div style={{ fontSize: 'clamp(18px, 4vw, 26px)', lineHeight: 1.65, fontWeight: 500, flex: 1 }}>
              {parseTimerParts(currentStep).map((part, j) =>
                part.seconds ? (
                  <button key={j} onClick={() => onStartTimer(part.text, part.seconds!)}
                    style={{ background: 'rgba(79,70,229,0.3)', color: '#A5B4FC', border: '1px solid rgba(79,70,229,0.5)',
                      borderRadius: '8px', padding: '2px 8px', fontSize: 'inherit', fontWeight: 700,
                      cursor: 'pointer', margin: '0 2px', lineHeight: 'inherit' }}>
                    ⏱ {part.text}
                  </button>
                ) : (
                  <span key={j}>{part.text}</span>
                )
              )}
            </div>

            {/* Step progress dots */}
            {steps.length > 1 && steps.length <= 12 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '24px' }}>
                {steps.map((_, i) => (
                  <button key={i} onClick={() => setStepIdx(i)}
                    style={{ width: i === stepIdx ? '20px' : '8px', height: '8px', borderRadius: '4px',
                      background: i === stepIdx ? '#4F46E5' : i < stepIdx ? '#475569' : 'rgba(255,255,255,0.15)',
                      border: 'none', cursor: 'pointer', padding: 0, transition: 'all 0.2s' }} />
                ))}
              </div>
            )}
            {steps.length > 12 && (
              <div style={{ textAlign: 'center', fontSize: '12px', color: '#475569', marginTop: '16px' }}>
                {stepIdx + 1} / {steps.length}
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom navigation */}
      {steps.length > 0 && (
        <div style={{ display: 'flex', gap: '12px', padding: '12px 16px', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)', flexShrink: 0 }}>
          <button onClick={() => setStepIdx(i => Math.max(i - 1, 0))} disabled={stepIdx === 0}
            style={{ flex: 1, padding: '16px', borderRadius: '14px', border: 'none', fontSize: '16px', fontWeight: 700,
              cursor: stepIdx === 0 ? 'default' : 'pointer',
              background: stepIdx === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)',
              color: stepIdx === 0 ? '#334155' : '#CBD5E1' }}>
            ← Previous
          </button>
          {stepIdx < steps.length - 1 ? (
            <button onClick={() => setStepIdx(i => i + 1)}
              style={{ flex: 1, padding: '16px', borderRadius: '14px', border: 'none', fontSize: '16px', fontWeight: 700,
                cursor: 'pointer', background: '#4F46E5', color: '#fff' }}>
              Next →
            </button>
          ) : (
            <button onClick={onClose}
              style={{ flex: 1, padding: '16px', borderRadius: '14px', border: 'none', fontSize: '16px', fontWeight: 700,
                cursor: 'pointer', background: '#059669', color: '#fff' }}>
              ✓ Done!
            </button>
          )}
        </div>
      )}

      {/* Ingredients panel — slides up from bottom */}
      {showIngredients && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}
          onClick={() => { setShowIngredients(false); setPanelOffset(0); }}>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0,
            background: '#1E293B', borderRadius: '20px 20px 0 0',
            maxHeight: '70vh', overflowY: 'auto', padding: '16px 20px', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)',
            transform: `translateY(${panelOffset}px)`,
            transition: panelOffset > 0 ? 'none' : 'transform 0.25s ease' }}
            onClick={e => e.stopPropagation()}>
            {/* Drag handle */}
            <div style={{ width: '36px', height: '4px', background: 'rgba(255,255,255,0.15)',
              borderRadius: '2px', margin: '0 auto 16px', cursor: 'grab', touchAction: 'none' }}
              onTouchStart={handlePanelDragStart}
              onTouchMove={handlePanelDragMove}
              onTouchEnd={handlePanelDragEnd} />
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#94A3B8', letterSpacing: '1px',
              textTransform: 'uppercase', marginBottom: '14px' }}>
              Ingredients — serves {familySize}
            </div>
            {allIngredients.length === 0 ? (
              <div style={{ color: '#475569', fontSize: '14px' }}>No ingredients listed.</div>
            ) : (
              Object.entries(shopByCategory).map(([cat, items]) => (
                <div key={cat} style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', letterSpacing: '1px',
                    textTransform: 'uppercase', marginBottom: '6px' }}>
                    {CAT_EMOJI[cat] ?? '•'} {cat}
                  </div>
                  {items.map((x, i) => {
                    const globalIdx = allIngredients.indexOf(x);
                    const isChecked = checked.has(globalIdx);
                    return (
                      <div key={i} onClick={() => setChecked(prev => {
                        const next = new Set(prev);
                        if (next.has(globalIdx)) next.delete(globalIdx);
                        else next.add(globalIdx);
                        return next;
                      })} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0',
                        borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '5px', flexShrink: 0,
                          background: isChecked ? '#4F46E5' : 'transparent',
                          border: `2px solid ${isChecked ? '#4F46E5' : '#334155'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {isChecked && <span style={{ color: '#fff', fontSize: '12px', lineHeight: 1 }}>✓</span>}
                        </div>
                        <span style={{ fontSize: '15px', lineHeight: 1.5,
                          color: isChecked ? '#475569' : '#CBD5E1',
                          textDecoration: isChecked ? 'line-through' : 'none' }}>
                          {x.display}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
