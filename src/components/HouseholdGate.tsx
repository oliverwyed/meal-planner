import { useState } from 'react';
import { P } from '../lib/constants';
import { createHousehold, joinHousehold } from '../lib/supabase';
import { HOUSEHOLD_ID_KEY } from '../lib/constants';
import { Primary, Secondary } from './ui';

interface Props {
  onReady: (householdId: string) => void;
}

export function HouseholdGate({ onReady }: Props) {
  const [view, setView] = useState<'landing' | 'create' | 'join'>('landing');
  const [familySize, setFamilySize] = useState(4);
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    setLoading(true); setError('');
    const result = await createHousehold(familySize);
    if (!result) { setError('Could not create household. Check your connection.'); setLoading(false); return; }
    localStorage.setItem(HOUSEHOLD_ID_KEY, result.id);
    onReady(result.id);
  };

  const handleJoin = async () => {
    if (inviteCode.trim().length < 6) { setError('Enter the 6-character code from your partner\'s app.'); return; }
    setLoading(true); setError('');
    const result = await joinHousehold(inviteCode);
    if (!result) { setError('Code not found — double-check and try again.'); setLoading(false); return; }
    localStorage.setItem(HOUSEHOLD_ID_KEY, result.id);
    onReady(result.id);
  };

  return (
    <div style={{ minHeight: '100vh', background: P.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🍽️</div>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '28px', marginBottom: '6px' }}>Meal Planner</div>
          <div style={{ fontSize: '14px', color: P.muted }}>Plan meals together, shop once.</div>
        </div>

        {view === 'landing' && (
          <div>
            <Primary onClick={() => setView('create')}>Create a new household</Primary>
            <Secondary onClick={() => setView('join')}>Join an existing household</Secondary>
          </div>
        )}

        {view === 'create' && (
          <div style={{ background: P.card, borderRadius: '16px', padding: '24px', boxShadow: P.shadow }}>
            <div style={{ fontWeight: 700, fontSize: '18px', marginBottom: '20px' }}>Set up your household</div>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>How many people eating?</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button onClick={() => setFamilySize(n => Math.max(1, n - 1))}
                  style={{ background: P.border, border: 'none', borderRadius: '8px', width: '36px', height: '36px', fontSize: '18px', cursor: 'pointer' }}>−</button>
                <span style={{ fontSize: '24px', fontWeight: 700, minWidth: '40px', textAlign: 'center' }}>{familySize}</span>
                <button onClick={() => setFamilySize(n => Math.min(12, n + 1))}
                  style={{ background: P.border, border: 'none', borderRadius: '8px', width: '36px', height: '36px', fontSize: '18px', cursor: 'pointer' }}>+</button>
              </div>
            </div>
            {error && <div style={{ color: '#c0392b', fontSize: '13px', marginBottom: '12px' }}>{error}</div>}
            <Primary onClick={handleCreate} disabled={loading}>{loading ? 'Creating…' : 'Create household'}</Primary>
            <Secondary muted onClick={() => { setView('landing'); setError(''); }}>Back</Secondary>
          </div>
        )}

        {view === 'join' && (
          <div style={{ background: P.card, borderRadius: '16px', padding: '24px', boxShadow: P.shadow }}>
            <div style={{ fontWeight: 700, fontSize: '18px', marginBottom: '8px' }}>Join a household</div>
            <div style={{ fontSize: '14px', color: P.muted, marginBottom: '20px' }}>
              Ask the person who created the household for their 6-character invite code.
            </div>
            <input
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value.toUpperCase())}
              placeholder="e.g. A3F9KL"
              maxLength={6}
              style={{ width: '100%', padding: '12px 14px', border: `2px solid ${P.border}`, borderRadius: '10px',
                fontSize: '22px', letterSpacing: '6px', fontWeight: 700, textAlign: 'center',
                background: P.card, marginBottom: '16px', boxSizing: 'border-box' }}
            />
            {error && <div style={{ color: '#c0392b', fontSize: '13px', marginBottom: '12px' }}>{error}</div>}
            <Primary onClick={handleJoin} disabled={loading}>{loading ? 'Joining…' : 'Join household'}</Primary>
            <Secondary muted onClick={() => { setView('landing'); setError(''); setInviteCode(''); }}>Back</Secondary>
          </div>
        )}
      </div>
    </div>
  );
}
