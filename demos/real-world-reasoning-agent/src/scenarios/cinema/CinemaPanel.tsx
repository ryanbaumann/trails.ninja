import { Film, Play, Sparkles, Clapperboard } from 'lucide-react';
import { useCinema } from './store';
import { startTour, generateTourVideo } from './controller';
import { sendToCopilot } from '@/ai/session';
import { VIDEO_GEN_ENABLED } from '@/lib/config';
import { TOURS, TOUR_BY_ID } from './tours';

const ACCENT = '#f472b6';

/** Small "Preview/New" pill used to nudge attention to a fresh capability. */
function NewBadge({ children }: { children: string }) {
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: 0.7,
        padding: '2px 6px',
        borderRadius: 999,
        background: 'rgba(11,14,20,0.22)',
        color: 'inherit',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </span>
  );
}

export function CinemaPanel() {
  const tourId = useCinema((s) => s.tourId);
  const stopIndex = useCinema((s) => s.stopIndex);
  const transcript = useCinema((s) => s.transcript);
  const video = useCinema((s) => s.video);
  const tour = tourId ? TOUR_BY_ID[tourId] : undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
      <div>
        <h2 style={{ fontSize: 20, marginBottom: 4 }}>Take the city shot-by-shot</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.45 }}>
          Pick a route. The camera moves, pins the landmark, and narration starts with the shot —
          not after it.
        </p>
      </div>

      {!tour && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {TOURS.map((t) => (
            <button
              key={t.id}
              onClick={() => startTour(t.id)}
              className="glass"
              style={{
                textAlign: 'left',
                padding: 14,
                borderRadius: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <span style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--accent-soft)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Film size={18} style={{ color: ACCENT }} />
              </span>
              <span style={{ flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700 }}>{t.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{t.subtitle} · {t.stops.length} stops</div>
              </span>
              <Play size={16} style={{ color: ACCENT }} />
            </button>
          ))}
          <button
            onClick={() => sendToCopilot('Fly me to the Colosseum in Rome and tell me about it.')}
            style={{
              padding: '11px 14px',
              borderRadius: 12,
              background: 'var(--accent-soft)',
              border: '1px solid var(--glass-line)',
              color: 'var(--text)',
              fontWeight: 600,
              fontSize: 13,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
            }}
          >
            <Sparkles size={14} /> Free-explore: "fly me anywhere"
          </button>
        </div>
      )}

      {tour && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div className="glass" style={{ borderRadius: 12, padding: '10px 12px' }}>
            <div style={{ fontSize: 10.5, color: ACCENT, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
              Now playing
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{tour.title}</div>
          </div>

          {VIDEO_GEN_ENABLED && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button
                onClick={() => void generateTourVideo()}
                disabled={video.status === 'loading'}
                style={{
                  position: 'relative',
                  padding: '12px 14px',
                  borderRadius: 12,
                  background:
                    video.status === 'loading'
                      ? 'var(--accent-soft)'
                      : 'linear-gradient(135deg, #f472b6 0%, #a855f7 100%)',
                  border: '1px solid var(--glass-line)',
                  color: video.status === 'loading' ? 'var(--text)' : '#0b0e14',
                  fontWeight: 700,
                  fontSize: 13,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  opacity: video.status === 'loading' ? 0.7 : 1,
                  cursor: video.status === 'loading' ? 'default' : 'pointer',
                  boxShadow: video.status === 'loading' ? 'none' : '0 4px 18px rgba(244,114,182,0.32)',
                }}
              >
                <Clapperboard size={15} />
                {video.status === 'loading' ? 'Generating your flythrough…' : 'Generate a video of this tour'}
                {video.status !== 'loading' && <NewBadge>Preview</NewBadge>}
              </button>

              {video.status === 'idle' && (
                <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                  <Sparkles size={11} style={{ color: ACCENT }} /> Turn this stop into a short AI-generated flythrough clip.
                </div>
              )}

              {video.status === 'ready' && video.url && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <video src={video.url} controls playsInline style={{ width: '100%', borderRadius: 12, display: 'block' }} />
                  {video.stopName && (
                    <div style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>{video.stopName}</div>
                  )}
                </div>
              )}

              {video.status === 'error' && (
                <div style={{ fontSize: 11.5, color: 'var(--text-dim)', opacity: 0.8 }}>{video.error}</div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {tour.stops.map((s, i) => (
              <div
                key={s.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '6px 9px',
                  borderRadius: 9,
                  fontSize: 12.5,
                  background: i === stopIndex ? 'var(--accent-soft)' : 'transparent',
                  color: i === stopIndex ? 'var(--text)' : 'var(--text-dim)',
                }}
              >
                <span style={{ width: 18, height: 18, borderRadius: 5, background: i === stopIndex ? ACCENT : 'var(--glass-2)', color: i === stopIndex ? '#0b0e14' : 'var(--text-dim)', fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  {i + 1}
                </span>
                {s.name}
              </div>
            ))}
          </div>

          {transcript.length > 0 && (
            <div className="panel-scroll" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--glass-line)', paddingTop: 10 }}>
              <div style={{ fontSize: 10.5, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Narration</div>
              {transcript.map((t, i) => (
                <div key={i} style={{ fontSize: 12, lineHeight: 1.5 }}>
                  <span style={{ color: ACCENT, fontWeight: 600 }}>{t.stopName}. </span>
                  <span style={{ color: 'var(--text-dim)' }}>{t.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
