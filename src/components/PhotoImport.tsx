import { useState, useRef } from 'react';
import type { Meal } from '../lib/types';
import { P } from '../lib/constants';
import { Primary, Secondary } from './ui';
import { log, logFetch, recordCost } from '../lib/logger';

interface Props {
  onImport: (meal: Meal) => Promise<void>;
  onCancel: () => void;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve((e.target?.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function PhotoImport({ onImport, onCancel }: Props) {
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<Meal | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setPreview(null);
    setError('');
    const newFiles = Array.from(files);
    const newPreviews = await Promise.all(newFiles.map(fileToDataUrl));
    setImageFiles(prev => [...prev, ...newFiles]);
    setImagePreviews(prev => [...prev, ...newPreviews]);
  };

  const removePhoto = (idx: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== idx));
    setImagePreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const extract = async () => {
    if (imageFiles.length === 0) return;
    setLoading(true);
    setError('');
    setPreview(null);
    try {
      const images = await Promise.all(
        imageFiles.map(async f => ({ imageBase64: await fileToBase64(f), mediaType: f.type }))
      );

      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-recipe-photo`;
      log.info('parse-recipe-photo', `Extracting from ${images.length} photo(s)`);
      const res = await logFetch('parse-recipe-photo', fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ images }),
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
      await onImport({
        ...preview,
        photo: imagePreviews[0] ?? undefined,
        photos: imagePreviews.length > 0 ? imagePreviews : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const hasPhotos = imageFiles.length > 0;

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
                  Photograph a recipe card, cookbook page, or handwritten recipe. Add multiple photos if it spans several pages. AI will extract all the details.
                </div>

                {/* Add photo buttons — always visible so user can add more */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: hasPhotos ? '12px' : '16px' }}>
                  <button onClick={() => cameraRef.current?.click()}
                    style={{ background: P.accentLight, border: `2px dashed ${P.accent}`, borderRadius: '14px', padding: '16px 12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '24px' }}>📷</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: P.accentDark }}>Take photo</span>
                  </button>
                  <button onClick={() => galleryRef.current?.click()}
                    style={{ background: P.accentLight, border: `2px dashed ${P.accent}`, borderRadius: '14px', padding: '16px 12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '24px' }}>🖼️</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: P.accentDark }}>Gallery</span>
                  </button>
                  <input ref={cameraRef} type="file" accept="image/*" capture="environment"
                    style={{ display: 'none' }} onChange={e => addFiles(e.target.files)} />
                  <input ref={galleryRef} type="file" accept="image/*" multiple
                    style={{ display: 'none' }} onChange={e => addFiles(e.target.files)} />
                </div>

                {/* Thumbnail strip */}
                {hasPhotos && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                      {imageFiles.length} photo{imageFiles.length > 1 ? 's' : ''} selected
                    </div>
                    <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                      {imagePreviews.map((src, i) => (
                        <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
                          <img src={src} alt={`Photo ${i + 1}`}
                            style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '10px', display: 'block', border: `2px solid ${i === 0 ? P.accent : P.border}` }} />
                          {i === 0 && imageFiles.length > 1 && (
                            <div style={{ position: 'absolute', top: '3px', left: '3px', background: P.accent, color: '#fff', fontSize: '9px', fontWeight: 700, borderRadius: '4px', padding: '1px 4px' }}>1st</div>
                          )}
                          <button onClick={() => removePhoto(i)}
                            style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#DC2626', border: 'none', color: '#fff', borderRadius: '50%', width: '20px', height: '20px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {error && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '10px', padding: '10px 14px', color: '#DC2626', fontSize: '13px', marginBottom: '12px' }}>{error}</div>}

                <Primary onClick={extract} disabled={!hasPhotos || loading}>
                  {loading ? '✨ Reading recipe…' : `✨ Extract with AI${imageFiles.length > 1 ? ` (${imageFiles.length} photos)` : ''}`}
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

                {imagePreviews.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', gap: '6px', overflowX: 'auto' }}>
                      {imagePreviews.map((src, i) => (
                        <img key={i} src={src} alt={`Photo ${i + 1}`}
                          style={{ width: imagePreviews.length === 1 ? '100%' : '72px', height: imagePreviews.length === 1 ? '160px' : '72px', objectFit: 'cover', borderRadius: '10px', display: 'block', flexShrink: 0 }} />
                      ))}
                    </div>
                    <div style={{ fontSize: '11px', color: P.muted, marginTop: '4px' }}>
                      {imagePreviews.length === 1 ? 'Photo will be saved with the recipe' : `${imagePreviews.length} photos will be saved with the recipe`}
                    </div>
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
