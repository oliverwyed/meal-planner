import { useState, useRef } from 'react';
import type { Meal } from '../lib/types';
import { P } from '../lib/constants';
import { Primary, Secondary } from './ui';
import { log, logFetch, recordCost } from '../lib/logger';

interface Props {
  onImport: (meal: Meal) => Promise<void>;
  onCancel: () => void;
}

export function PhotoImport({ onImport, onCancel }: Props) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<Meal | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | null) => {
    if (!file) return;
    setImageFile(file);
    setPreview(null);
    setError('');
    const reader = new FileReader();
    reader.onload = e => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const extract = async () => {
    if (!imageFile) return;
    setLoading(true);
    setError('');
    setPreview(null);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = e => {
          const result = e.target?.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(imageFile);
      });

      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-recipe-photo`;
      log.info('parse-recipe-photo', `Extracting from photo (${imageFile.name})`);
      const res = await logFetch('parse-recipe-photo', fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ imageBase64: base64, mediaType: imageFile.type }),
      });
      let data: any;
      try { data = await res.json(); } catch { throw new Error(`Server error ${res.status}`); }
      if (!res.ok) throw new Error(data?.error ?? `Server error ${res.status}`);
      if (data._usage) recordCost('parse-recipe-photo', data._usage.input_tokens, data._usage.output_tokens);
      const { _usage: _u, ...meal } = data;
      setPreview({ ...meal, custom: true });
    } catch (err: any) {
      log.error('parse-recipe-photo', String(err));
      setError(err?.message ?? 'Could not extract recipe. Try a clearer photo.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!preview) return;
    setSaving(true);
    try {
      // Pass imagePreview as the photo field (data URL); parent will upload to storage
      await onImport({ ...preview, photo: imagePreview ?? undefined });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.55)', overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '24px 0 40px' } as React.CSSProperties}
      onClick={onCancel}>
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0 16px' }} onClick={e => e.stopPropagation()}>
        <div style={{ background: P.bg, borderRadius: '20px', overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.22)' }}>
          {/* Header */}
          <div style={{ background: `linear-gradient(135deg, ${P.accent}, ${P.accentDark})`, padding: '20px 20px 20px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '11px', opacity: 0.85, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase' }}>Add recipe</div>
              <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '22px', marginTop: '3px' }}>📷 From a photo</div>
            </div>
            <button onClick={onCancel}
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '10px', padding: '8px 12px', cursor: 'pointer', fontSize: '18px', fontWeight: 700 }}>✕</button>
          </div>

          <div style={{ padding: '20px' }}>
            {!preview && (
              <>
                <div style={{ fontSize: '13px', color: P.muted, marginBottom: '16px', lineHeight: 1.5 }}>
                  Photograph a recipe card, cookbook page, or handwritten recipe. AI will extract all the details.
                </div>

                {/* Photo picker buttons */}
                {!imagePreview ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                    <button onClick={() => cameraRef.current?.click()}
                      style={{ background: P.accentLight, border: `2px dashed ${P.accent}`, borderRadius: '14px', padding: '20px 12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '28px' }}>📷</span>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: P.accentDark }}>Take photo</span>
                    </button>
                    <button onClick={() => galleryRef.current?.click()}
                      style={{ background: P.accentLight, border: `2px dashed ${P.accent}`, borderRadius: '14px', padding: '20px 12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '28px' }}>🖼️</span>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: P.accentDark }}>Gallery</span>
                    </button>
                    <input ref={cameraRef} type="file" accept="image/*" capture="environment"
                      style={{ display: 'none' }} onChange={e => handleFile(e.target.files?.[0] ?? null)} />
                    <input ref={galleryRef} type="file" accept="image/*"
                      style={{ display: 'none' }} onChange={e => handleFile(e.target.files?.[0] ?? null)} />
                  </div>
                ) : (
                  <div style={{ marginBottom: '16px' }}>
                    <img src={imagePreview} alt="Recipe photo" style={{ width: '100%', maxHeight: '240px', objectFit: 'cover', borderRadius: '12px', display: 'block', marginBottom: '10px' }} />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => { setImageFile(null); setImagePreview(null); setError(''); }}
                        style={{ background: P.border, border: 'none', borderRadius: '8px', padding: '7px 14px', fontSize: '13px', fontWeight: 700, color: P.muted, cursor: 'pointer' }}>
                        Change photo
                      </button>
                    </div>
                  </div>
                )}

                {error && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '10px', padding: '10px 14px', color: '#DC2626', fontSize: '13px', marginBottom: '12px' }}>{error}</div>}

                <Primary onClick={extract} disabled={!imageFile || loading}>
                  {loading ? '✨ Reading recipe…' : '✨ Extract with AI'}
                </Primary>
                <div style={{ marginTop: '8px' }}>
                  <Secondary onClick={onCancel}>Cancel</Secondary>
                </div>
              </>
            )}

            {preview && (
              <>
                <div style={{ background: P.accentLight, borderRadius: '12px', padding: '12px 14px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: P.accent, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Recipe extracted ✓</div>
                  <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '2px' }}>{preview.name}</div>
                  <div style={{ fontSize: '13px', color: P.muted }}>{preview.time} · {preview.cuisine} · serves {preview.serves}</div>
                </div>

                <div style={{ background: P.card, borderRadius: '12px', border: `1px solid ${P.border}`, padding: '12px 14px', marginBottom: '16px', maxHeight: '200px', overflowY: 'auto' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Ingredients</div>
                  {preview.ingredients?.map((ing, i) => (
                    <div key={i} style={{ fontSize: '13px', padding: '3px 0', borderBottom: i < preview.ingredients.length - 1 ? `1px solid ${P.border}` : 'none' }}>{ing}</div>
                  ))}
                </div>

                {imagePreview && (
                  <div style={{ marginBottom: '12px' }}>
                    <img src={imagePreview} alt={preview.name} style={{ width: '100%', maxHeight: '160px', objectFit: 'cover', borderRadius: '10px', display: 'block' }} />
                    <div style={{ fontSize: '11px', color: P.muted, marginTop: '4px' }}>Photo will be saved with the recipe</div>
                  </div>
                )}

                <Primary onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : '✓ Save to my meals'}
                </Primary>
                <div style={{ marginTop: '8px' }}>
                  <Secondary onClick={() => { setPreview(null); setError(''); }}>← Try again</Secondary>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
