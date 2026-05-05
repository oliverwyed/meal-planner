import { useState } from 'react';
import type { Meal } from '../lib/types';
import { P } from '../lib/constants';
import { Primary, Secondary } from './ui';

interface Props {
  onImport: (meal: Meal) => Promise<void>;
  onCancel: () => void;
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
    const res = await fetch(fnUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw data;
    return data as Meal;
  };

  const handleFetch = async () => {
    if (!url.trim()) return;
    setLoading(true); setError(''); setPreview(null);
    try {
      const meal = await callFn({ url: url.trim() });
      setPreview(meal);
    } catch (err: any) {
      if (err?.error === 'blocked' || err?.status === 403 || err?.status === 429) {
        setMode('text');
        setError('That site blocks automated imports. Copy the recipe text from the page and paste it below.');
      } else {
        setError(err?.error ?? 'Import failed.');
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
      setError(err?.error ?? 'Could not extract a recipe from that text.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!preview) return;
    await onImport(preview);
  };

  const inp = { width: '100%', padding: '11px 14px', border: `2px solid ${P.border}`, borderRadius: '10px', fontSize: '14px', background: P.card, boxSizing: 'border-box' as const };

  return (
    <div>
      <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '20px', marginBottom: '6px' }}>Import a recipe</div>

      {!preview && (
        <>
          {/* Mode tabs */}
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
              <div style={{ fontSize: '13px', color: P.muted, marginBottom: '14px' }}>
                Paste a link from any recipe website.
              </div>
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Recipe URL</div>
                <input value={url} onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleFetch()}
                  placeholder="https://www.bbcgoodfood.com/recipes/…"
                  style={inp} />
              </div>
              {error && <div style={{ color: '#B45309', background: '#FEF3C7', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', marginBottom: '12px' }}>{error}</div>}
              <Primary onClick={handleFetch} disabled={loading || !url.trim()}>
                {loading ? '⏳ Extracting recipe…' : '🔍 Extract recipe'}
              </Primary>
            </>
          )}

          {mode === 'text' && (
            <>
              <div style={{ fontSize: '13px', color: P.muted, marginBottom: '14px' }}>
                Copy the recipe text from the website and paste it here — ingredients, steps, everything.
              </div>
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Recipe text</div>
                <textarea value={pasteText} onChange={e => setPasteText(e.target.value)}
                  placeholder="Paste the full recipe here…"
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
