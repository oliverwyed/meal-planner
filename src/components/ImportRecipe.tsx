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
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<Meal | null>(null);
  const [error, setError] = useState('');

  const handleFetch = async () => {
    if (!url.trim()) return;
    setLoading(true); setError(''); setPreview(null);
    try {
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-recipe`;
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Import failed.'); return; }
      setPreview(data as Meal);
    } catch {
      setError('Network error — check your connection.');
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
      <div style={{ fontSize: '13px', color: P.muted, marginBottom: '20px' }}>
        Paste a link from any recipe website — BBC Good Food, Ottolenghi, a food blog, anywhere.
      </div>

      {!preview && (
        <>
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Recipe URL</div>
            <input value={url} onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleFetch()}
              placeholder="https://www.bbcgoodfood.com/recipes/..."
              style={inp} />
          </div>
          {error && <div style={{ color: '#c0392b', fontSize: '13px', marginBottom: '12px' }}>{error}</div>}
          <Primary onClick={handleFetch} disabled={loading || !url.trim()}>
            {loading ? '⏳ Extracting recipe…' : '🔍 Extract recipe'}
          </Primary>
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
          <Secondary onClick={() => { setPreview(null); setUrl(''); }}>Try a different URL</Secondary>
          <Secondary muted onClick={onCancel}>Cancel</Secondary>
        </div>
      )}
    </div>
  );
}
