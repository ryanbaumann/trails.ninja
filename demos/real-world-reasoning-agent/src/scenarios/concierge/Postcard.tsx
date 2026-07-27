import { X, Download, Loader2, Share2 } from 'lucide-react';
import { useConcierge } from './store';
import { atlas } from '@/state/store';
import { buildReplayUrl, shareOrCopy } from '@/lib/share';

async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || 'image/png' });
}

/** Full-screen postcard modal (Overlay). Shows the Nano Banana result. */
export function Postcard() {
  const open = useConcierge((s) => s.postcardOpen);
  const postcard = useConcierge((s) => s.postcard);
  const close = () => useConcierge.getState().openPostcard(false);

  // Share the postcard image itself when the browser supports file sharing;
  // otherwise fall back to a replay link that re-plans this day live.
  const share = async () => {
    const s = atlas();
    const firstPrompt = s.transcript.find((m) => m.role === 'user')?.text?.trim();
    const url = buildReplayUrl({
      scenario: 'concierge',
      cityId: s.cityId,
      prompt: firstPrompt || 'Plan me a perfect walkable day',
    });
    try {
      let file: File | undefined;
      if (postcard.dataUrl) {
        try {
          file = await dataUrlToFile(postcard.dataUrl, 'atlas-postcard.png');
        } catch {
          file = undefined;
        }
      }
      const canShareFiles = !!(
        file &&
        typeof navigator !== 'undefined' &&
        navigator.canShare?.({ files: [file] })
      );
      const result = await shareOrCopy({
        url,
        title: 'Atlas — my day, as a postcard',
        text: firstPrompt || undefined,
        files: canShareFiles && file ? [file] : undefined,
      });
      if (result === 'copied') {
        s.pushToast('info', 'Replay link copied — anyone who opens it watches Atlas plan this live.');
      }
    } catch {
      // User dismissed the share sheet, or sharing is unavailable — no-op.
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="AI-generated postcard"
      onClick={close}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 'var(--z-modal)' as unknown as number,
        background: 'var(--scrim)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: 24,
        overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass panel-scroll"
        style={{
          margin: 'auto',
          borderRadius: 20,
          padding: 16,
          width: 'min(560px, 92vw)',
          // Subtract the scrim's 24px padding top+bottom so the card's own edges
          // (header, download button) always stay reachable; the scrim scrolls too.
          maxHeight: 'min(calc(100vh - 48px), 900px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700 }}>
              Your day, as a postcard
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>AI-generated image · Nano Banana</div>
          </div>
          <button onClick={close} aria-label="Close" className="glass" style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center' }}>
            <X size={17} />
          </button>
        </div>

        <div
          style={{
            borderRadius: 14,
            overflow: 'hidden',
            aspectRatio: '3 / 2',
            flexShrink: 0,
            display: 'grid',
            placeItems: 'center',
            background: 'var(--bg-2)',
          }}
        >
          {postcard.status === 'loading' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: 'var(--text-dim)' }}>
              <Loader2 size={26} style={{ animation: 'atlas-spin 1s linear infinite' }} />
              <span style={{ fontSize: 13 }}>Painting your postcard…</span>
            </div>
          )}
          {postcard.status === 'error' && (
            <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>Couldn't generate the postcard — try again.</span>
          )}
          {postcard.status === 'done' && postcard.dataUrl && (
            <img
              src={postcard.dataUrl}
              alt="AI-generated travel postcard"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          )}
        </div>

        {postcard.status === 'done' && postcard.dataUrl && (
          <div style={{ display: 'flex', gap: 10 }}>
            <a
              href={postcard.dataUrl}
              download="atlas-postcard.png"
              style={{
                flex: 1,
                padding: '11px 14px',
                borderRadius: 12,
                background: '#f59e0b',
                color: '#0b0e14',
                fontWeight: 700,
                fontSize: 13.5,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Download size={16} /> Download postcard
            </a>
            <button
              onClick={() => void share()}
              className="glass"
              aria-label="Share this postcard"
              style={{
                padding: '11px 14px',
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 13.5,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                color: 'var(--text)',
              }}
            >
              <Share2 size={16} /> Share
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
