import { useState, useEffect } from 'react';
import { P } from '../lib/constants';
import { createHousehold, joinHousehold, sendLoginOTP, verifyLoginOTP, getAuthSession, findHouseholdByAuthUser, linkHouseholdToAuthUser, supabase } from '../lib/supabase';
import { HOUSEHOLD_ID_KEY } from '../lib/constants';
import { Primary, Secondary, Spinner } from './ui';

type View = 'checking' | 'email' | 'otp' | 'choice' | 'create' | 'join';

interface Props {
  onReady: (householdId: string) => void;
}

export function HouseholdGate({ onReady }: Props) {
  const [view, setView] = useState<View>('checking');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [familySize, setFamilySize] = useState(4);
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isReturning = !!localStorage.getItem(HOUSEHOLD_ID_KEY);

  // On mount: check for existing session, and listen for magic-link callbacks
  useEffect(() => {
    async function handleSession(uid: string) {
      const id = await findHouseholdByAuthUser(uid);
      if (id) {
        localStorage.setItem(HOUSEHOLD_ID_KEY, id);
        onReady(id);
        return;
      }
      setUserId(uid);
      setView('choice');
    }

    // Only listen for SIGNED_IN (magic-link redirect) — the initial session
    // is handled by getAuthSession() below to avoid calling handleSession twice.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) handleSession(session.user.id);
    });

    getAuthSession().then(session => {
      if (session) {
        handleSession(session.userId);
      } else {
        setView('email');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSendOTP = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) { setError('Enter a valid email address.'); return; }
    setLoading(true); setError('');
    const { error: err } = await sendLoginOTP(trimmed);
    if (err) { setError(err); setLoading(false); return; }
    setLoading(false);
    setView('otp');
  };

  const handleVerifyOTP = async () => {
    if (otp.trim().length < 6) { setError('Enter the code from your email.'); return; }
    setLoading(true); setError('');
    const { userId: uid, error: err } = await verifyLoginOTP(email.trim().toLowerCase(), otp.trim());
    if (err || !uid) { setError('Code incorrect or expired — try again.'); setLoading(false); return; }
    setUserId(uid);
    const id = await findHouseholdByAuthUser(uid);
    if (id) {
      localStorage.setItem(HOUSEHOLD_ID_KEY, id);
      onReady(id);
      return;
    }
    setLoading(false);
    setView('choice');
  };

  const handleCreate = async () => {
    setLoading(true); setError('');
    const result = await createHousehold(familySize);
    if (!result) { setError('Could not create household — check your connection.'); setLoading(false); return; }
    if (userId) await linkHouseholdToAuthUser(result.id, userId);
    localStorage.setItem(HOUSEHOLD_ID_KEY, result.id);
    onReady(result.id);
  };

  const handleJoin = async () => {
    if (inviteCode.trim().length < 6) { setError('Enter the 6-character invite code.'); return; }
    setLoading(true); setError('');
    const result = await joinHousehold(inviteCode);
    if (!result) { setError('Code not found — double-check and try again.'); setLoading(false); return; }
    if (userId) await linkHouseholdToAuthUser(result.id, userId);
    localStorage.setItem(HOUSEHOLD_ID_KEY, result.id);
    onReady(result.id);
  };

  if (view === 'checking') return <Spinner />;

  return (
    <div style={{ minHeight: '100vh', background: P.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🍽️</div>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '28px', marginBottom: '6px' }}>Meal Planner</div>
          <div style={{ fontSize: '14px', color: P.muted }}>Plan meals together, shop once.</div>
        </div>

        {view === 'email' && (
          <div style={{ background: P.card, borderRadius: '16px', padding: '24px', boxShadow: P.shadow }}>
            <div style={{ fontWeight: 700, fontSize: '18px', marginBottom: '6px' }}>
              {isReturning ? 'Welcome back' : 'Get started'}
            </div>
            <div style={{ fontSize: '14px', color: P.muted, marginBottom: '20px' }}>
              {isReturning
                ? 'Enter your email to pick up where you left off.'
                : 'Enter your email to sign in or create a new household.'}
            </div>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendOTP()}
              placeholder="you@example.com"
              autoFocus
              style={{ width: '100%', padding: '12px 14px', border: `2px solid ${P.border}`, borderRadius: '10px',
                fontSize: '15px', background: P.bg, marginBottom: '16px', boxSizing: 'border-box', outline: 'none' }}
            />
            {error && <div style={{ color: '#c0392b', fontSize: '13px', marginBottom: '12px' }}>{error}</div>}
            <Primary onClick={handleSendOTP} disabled={loading}>{loading ? 'Sending…' : 'Continue →'}</Primary>
            <Secondary muted onClick={() => { setView('join'); setError(''); }}>I have an invite code</Secondary>
          </div>
        )}

        {view === 'otp' && (
          <div style={{ background: P.card, borderRadius: '16px', padding: '24px', boxShadow: P.shadow }}>
            <div style={{ fontWeight: 700, fontSize: '18px', marginBottom: '6px' }}>Check your email</div>
            <div style={{ fontSize: '14px', color: P.muted, marginBottom: '20px' }}>
              We sent a code to <strong>{email}</strong>.
            </div>
            <input
              type="text"
              inputMode="numeric"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
              onKeyDown={e => e.key === 'Enter' && handleVerifyOTP()}
              placeholder="00000000"
              autoFocus
              style={{ width: '100%', padding: '12px 14px', border: `2px solid ${P.border}`, borderRadius: '10px',
                fontSize: '28px', letterSpacing: '8px', fontWeight: 700, textAlign: 'center',
                background: P.bg, marginBottom: '16px', boxSizing: 'border-box', outline: 'none' }}
            />
            {error && <div style={{ color: '#c0392b', fontSize: '13px', marginBottom: '12px' }}>{error}</div>}
            <Primary onClick={handleVerifyOTP} disabled={loading}>{loading ? 'Verifying…' : 'Verify'}</Primary>
            <Secondary muted onClick={() => { setView('email'); setOtp(''); setError(''); }}>← Change email</Secondary>
          </div>
        )}

        {view === 'choice' && (
          <div>
            <Primary onClick={() => setView('create')}>Create a new household</Primary>
            <Secondary onClick={() => setView('join')}>Join an existing household</Secondary>
          </div>
        )}

        {view === 'create' && (
          <div style={{ background: P.card, borderRadius: '16px', padding: '24px', boxShadow: P.shadow }}>
            <div style={{ fontWeight: 700, fontSize: '18px', marginBottom: '20px' }}>Set up your household</div>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                How many people eating?
              </div>
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
            <Secondary muted onClick={() => { setView('choice'); setError(''); }}>← Back</Secondary>
          </div>
        )}

        {view === 'join' && (
          <div style={{ background: P.card, borderRadius: '16px', padding: '24px', boxShadow: P.shadow }}>
            <div style={{ fontWeight: 700, fontSize: '18px', marginBottom: '8px' }}>Join a household</div>
            <div style={{ fontSize: '14px', color: P.muted, marginBottom: '20px' }}>
              Enter the 6-character invite code from an existing household.
            </div>
            <input
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              placeholder="A3F9KL"
              maxLength={6}
              style={{ width: '100%', padding: '12px 14px', border: `2px solid ${P.border}`, borderRadius: '10px',
                fontSize: '22px', letterSpacing: '6px', fontWeight: 700, textAlign: 'center',
                background: P.bg, marginBottom: '16px', boxSizing: 'border-box', outline: 'none' }}
            />
            {error && <div style={{ color: '#c0392b', fontSize: '13px', marginBottom: '12px' }}>{error}</div>}
            <Primary onClick={handleJoin} disabled={loading}>{loading ? 'Joining…' : 'Join household'}</Primary>
            <Secondary muted onClick={() => { setView(userId ? 'choice' : 'email'); setError(''); setInviteCode(''); }}>← Back</Secondary>
          </div>
        )}

      </div>
    </div>
  );
}