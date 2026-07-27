import { X, Download } from 'lucide-react';
import { useAdStudio } from './store';
import { getImage } from '@/genui/images';

/**
 * Full-bleed viewer for a single generated creative. Opened from the CampaignBoard
 * grid (store `lightbox` holds the selected creative id) and mounted as the
 * scenario Overlay. Every creative is labelled AI-generated and grounded.
 */
export function CreativeLightbox() {
  const id = useAdStudio((s) => s.lightbox);
  const creatives = useAdStudio((s) => s.creatives);
  const setLightbox = useAdStudio((s) => s.setLightbox);

  const creative = id ? creatives.find((c) => c.id === id) : undefined;
  if (!creative) return null;

  const src = creative.imageRef ? getImage(creative.imageRef) : undefined;

  const download = () => {
    if (!src) return;
    const a = document.createElement('a');
    a.href = src;
    a.download = `atlas-ad-${creative.id}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div
      onClick={() => setLightbox(null)}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 'var(--z-modal)' as unknown as number,
        background: 'rgba(6,4,12,.72)',
        backdropFilter: 'blur(6px)',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass"
        style={{
          borderRadius: 18,
          overflow: 'hidden',
          maxWidth: 'min(520px, 92vw)',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--glass-line)',
        }}
      >
        <div style={{ position: 'relative', background: 'var(--bg-2)', display: 'grid', placeItems: 'center' }}>
          {src && (
            <img
              src={src}
              alt={creative.headline}
              style={{ width: '100%', maxHeight: '62vh', objectFit: 'contain', display: 'block' }}
            />
          )}
          <button
            onClick={() => setLightbox(null)}
            aria-label="Close"
            className="glass"
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              width: 30,
              height: 30,
              borderRadius: 999,
              display: 'grid',
              placeItems: 'center',
              border: '1px solid var(--glass-line)',
              cursor: 'pointer',
            }}
          >
            <X size={15} />
          </button>
          <span
            style={{
              position: 'absolute',
              bottom: 10,
              left: 10,
              fontSize: 10,
              fontWeight: 700,
              padding: '4px 9px',
              borderRadius: 999,
              background: 'var(--scrim)',
              letterSpacing: 0.3,
            }}
          >
            AI-generated image · grounded in Google Maps data
          </span>
        </div>

        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.25 }}>{creative.headline}</div>
          {creative.body && (
            <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5 }}>{creative.body}</div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
            <div style={{ fontSize: 11.5, color: 'var(--text-faint)', textTransform: 'capitalize' }}>
              {creative.cta ? `${creative.cta} · ` : ''}
              {creative.style} · {creative.format}
            </div>
            <button
              onClick={download}
              disabled={!src}
              className="glass"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 12px',
                borderRadius: 10,
                border: '1px solid var(--glass-line)',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: src ? 'pointer' : 'default',
              }}
            >
              <Download size={13} /> Download
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
