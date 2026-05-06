import { useState } from 'react';
import type { Meal } from '../lib/types';
import { P } from '../lib/constants';
import { Primary, Secondary } from './ui';
import { log, logFetch } from '../lib/logger';

interface Props {
  onImport: (meal: Meal) => Promise<void>;
  onCancel: () => void;
}

const BLOCKED_DOMAINS = ['bbcgoodfood.com', 'allrecipes.com', 'seriouseats.com', 'delicious.com', 'taste.com'];

function isLikelyBlocked(url: string) {
  try { return BLOCKED_DOMAINS.some(d => new URL(url).hostname.includes(d)); } catch { return false; }
}

export function ImportRecipe({ onImport, onCancel }: Props) {
  const [url, setUrl] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [mode, setMode] = useState<'url' | 'text'>('url');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<Meal | null>(null);
  const [error, setError] = useState('');

  const callFn = async (body: { url?: string; text?: string }) => {
    const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-recipe`;
    log.info('import-recipe', body.url ? `Importing URL: ${body.url}` : 'Importing pasted text');
    const res = await logFetch('import-recipe', fnUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY },
      body: JSON.stringify(body),
    });
    let data: any;
    try { data = await res.json(); } catch { throw new Error(`Server error ${res.status}`); }
    if (!res.ok) { log.error('import-recipe', data?.error ?? `Status ${res.status}`); throw new Error(data?.error ?? `Server error ${res.status}`); }
    return data as Meal;
  };

  const handleFetch = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (isLikelyBlocked(trimmed)) { setMode('text'); return; }
    setLoading(true); setError(''); setPreview(null);
    try {
      const meal = await callFn({ url: trimmed });
      setPreview(meal);
    } catch (err: any) {
      const msg = err?.message ?? '';
      if (msg.includes('blocked') || msg.includes('403') || msg.includes('429')) {
        setMode('text');
      } else {
        setError(msg || 'Import failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePaste = async () => {
    if (!pasteText.trim()) return;
    setLoading(true); setError(''); setPreview(null);
    try {
      const meal = await callFn({ text: pasteText.trim() });
      setPreview(meal);
    } catch (err: any) {
      setError(err?.message ?? 'Could not extract a recipe from that text.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!preview) return;
    await onImport(preview);
  };

  const inp = { width: '100%', padding: '11px 14px', border: `2px solid ${P.border}`, borderRadius: '10px', fontSize: '14px', background: P.card, boxSizing: 'border-box' as const };
  const blocked = isLikelyBlocked(url);

  return (
    <div>
      <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '20px', marginBottom: '16px' }}>Import a recipe</div>

      {!preview && (
        <>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            {(['url', 'text'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); }}
                style={{ padding: '6px 14px', borderRadius: '20px', border: 'none', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                  background: mode === m ? P.accent : P.border, color: mode === m ? '#fff' : P.muted }}>
                {m === 'url' ? '🔗 From URL' : '📋 Paste text'}
              </button>
            ))}
          </div>

          {mode === 'url' && (
            <>
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Recipe URL</div>
                <input value={url} onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleFetch()}
                  placeholder="https://www.bbcgoodfood.com/recipes/…"
                  style={inp} />
              </div>
              {blocked && (
                <div style={{ background: P.accentLight, borderRadius: '10px', padding: '12px 14px', marginBottom: '14px', fontSize: '13px', color: P.accentDark }}>
                  <div style={{ fontWeight: 700, marginBottom: '6px' }}>This site blocks automated imports</div>
                  <div style={{ lineHeight: 1.5, marginBottom: '10px' }}>
                    On the recipe page: tap <strong>Share → Copy</strong> in iOS Safari, then switch to Paste text and paste it in.
                    You only need the ingredients and method — not the whole page.
                  </div>
                  <button onClick={() => setMode('text')}
                    style={{ background: P.accent, color: '#fff', border: 'none', borderRadius: '8px', padding: '7px 14px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                    Switch to Paste text →
                  </button>
                </div>
              )}
              {error && <div style={{ color: '#c0392b', fontSize: '13px', marginBottom: '12px' }}>{error}</div>}
              {!blocked && (
                <Primary onClick={handleFetch} disabled={loading || !url.trim()}>
                  {loading ? '⏳ Extracting recipe…' : '🔍 Extract recipe'}
                </Primary>
              )}
            </>
          )}

          {mode === 'text' && (
            <>
              <div style={{ background: P.accentLight, borderRadius: '10px', padding: '12px 14px', marginBottom: '16px', fontSize: '13px', color: P.accentDark, lineHeight: 1.6 }}>
                <strong>Tip:</strong> You don't need to copy the whole page — just the ingredients list and method is enough.
                In iOS Safari tap <strong>Share → Copy</strong> to grab the page text.
              </div>
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Recipe text</div>
                <textarea value={pasteText} onChange={e => setPasteText(e.target.value)}
                  placeholder="Paste the ingredients and method here…"
                  rows={10}
                  style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} />
              </div>
              {error && <div style={{ color: '#c0392b', fontSize: '13px', marginBottom: '12px' }}>{error}</div>}
              <Primary onClick={handlePaste} disabled={loading || !pasteText.trim()}>
                {loading ? '⏳ Extracting recipe…' : '🔍 Extract recipe'}
              </Primary>
            </>
          )}

          <Secondary muted onClick={onCancel}>Cancel</Secondary>
        </>
      )}

      {preview && (
        <div>
          <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '6px' }}>{preview.name}</div>
            <div style={{ fontSize: '13px', color: P.muted, marginBottom: '10px' }}>{preview.description}</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {[preview.time, preview.protein, preview.cuisine, `serves ${preview.serves}`].map(t =>
                <span key={t} style={{ background: P.accentLight, color: P.accentDark, borderRadius: '8px', padding: '2px 8px', fontSize: '11px', fontWeight: 700 }}>{t}</span>
              )}
            </div>
            {preview.ingredients.length > 0 && (
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Ingredients</div>
                {preview.ingredients.map((ing, i) => <div key={i} style={{ fontSize: '13px', lineHeight: 1.6 }}>• {ing}</div>)}
              </div>
            )}
          </div>
          <Primary onClick={handleSave}>Add to my meals</Primary>
          <Secondary onClick={() => { setPreview(null); setUrl(''); setPasteText(''); }}>Try again</Secondary>
          <Secondary muted onClick={onCancel}>Cancel</Secondary>
        </div>
      )}
    </div>
  );
}
