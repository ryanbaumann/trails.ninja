import { Play, Square, Image as ImageIcon, MapPin, Star, Clock } from 'lucide-react';
import { useConcierge } from './store';
import { atlas } from '@/state/store';
import { playTour, stopTour, makePostcard } from './controller';
import { sendToCopilot } from '@/ai/session';
import { fmtDistance, fmtDuration, fmtPrice, fmtRating } from '@/lib/format';

const ACCENT = '#f59e0b';

export function ItineraryBoard() {
  const stops = useConcierge((s) => s.stops);
  const building = useConcierge((s) => s.building);
  const totalMeters = useConcierge((s) => s.totalMeters);
  const totalSeconds = useConcierge((s) => s.totalSeconds);
  const activeStop = useConcierge((s) => s.activeStop);
  const playing = useConcierge((s) => s.playing);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%', minHeight: 0 }}>
      <div>
        <h2 style={{ fontSize: 20, marginBottom: 4 }}>Design my day</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.5 }}>
          A conversational itinerary on live Google Places + Routes. Describe a day below and Atlas
          assembles real stops and legs on the map.
        </p>
      </div>

      {stops.length > 0 && (
        <div style={{ display: 'flex', gap: 10 }}>
          <Stat label="Stops" value={String(stops.length)} />
          <Stat label="Distance" value={fmtDistance(totalMeters)} />
          <Stat label="Moving" value={fmtDuration(totalSeconds)} />
        </div>
      )}

      {stops.length > 0 && (
        <div style={{ display: 'flex', gap: 8 }}>
          <ActionBtn
            onClick={() => (playing ? stopTour() : void playTour())}
            primary
            icon={playing ? <Square size={15} /> : <Play size={15} />}
            label={playing ? 'Stop tour' : 'Play tour'}
          />
          <ActionBtn
            onClick={() => void makePostcard()}
            icon={<ImageIcon size={15} />}
            label="Postcard"
          />
        </div>
      )}

      <div className="panel-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 2 }}>
        {building && stops.length === 0 && <Skeletons />}
        {!building && stops.length === 0 && (
          <p style={{ color: 'var(--text-faint)', fontSize: 12, lineHeight: 1.6 }}>
            Try: <em>"Plan a perfect Saturday near the Ferry Building — specialty coffee, a great
            museum, golden-hour dinner with a view, all walkable."</em> Atlas will search real
            places, pick the strong ones, and lay out the walking route.
          </p>
        )}
        {stops.map((s, i) => {
          const d = s.detail;
          const loc = d?.location;
          return (
            <button
              key={`${s.placeId ?? s.name}-${i}`}
              onClick={() => loc && atlas().setCamera({ kind: 'fly', center: loc, zoom: 16.5 })}
              className="glass"
              style={{
                textAlign: 'left',
                borderRadius: 14,
                overflow: 'hidden',
                padding: 0,
                border: i === activeStop ? `1px solid ${ACCENT}` : '1px solid var(--glass-line)',
                boxShadow: i === activeStop ? `0 0 0 1px ${ACCENT}, var(--shadow-2)` : 'var(--shadow-2)',
                transition: 'border-color 200ms var(--ease)',
              }}
            >
              {d?.photoUri && (
                <div style={{ position: 'relative', height: 116 }}>
                  <img
                    src={d.photoUri}
                    alt={s.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                  {s.window && (
                    <span
                      style={{
                        position: 'absolute',
                        top: 8,
                        left: 8,
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: 999,
                        background: 'var(--scrim)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Clock size={11} /> {s.window}
                    </span>
                  )}
                  {d.openNow != null && (
                    <span
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 999,
                        background: d.openNow ? 'rgba(52,211,153,.9)' : 'rgba(248,113,113,.9)',
                        color: '#0b0e14',
                      }}
                    >
                      {d.openNow ? 'Open' : 'Closed'}
                    </span>
                  )}
                </div>
              )}
              <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 6,
                      background: ACCENT,
                      color: '#0b0e14',
                      fontSize: 12,
                      fontWeight: 800,
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.25 }}>{s.name}</span>
                </div>
                {s.why && (
                  <p style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.45 }}>{s.why}</p>
                )}
                {d?.editorialSummary && (
                  <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.45, fontStyle: 'italic' }}>
                    {d.editorialSummary}
                  </p>
                )}
                {d?.formattedAddress && (
                  <p style={{ fontSize: 11.5, color: 'var(--text-faint)', lineHeight: 1.4 }}>{d.formattedAddress}</p>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11.5, color: 'var(--text-dim)' }}>
                  {d?.rating != null && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <Star size={11} fill="currentColor" /> {fmtRating(d.rating, d.userRatingCount)}
                    </span>
                  )}
                  {d?.priceLevel != null && <span>{fmtPrice(d.priceLevel)}</span>}
                  {s.category && <span style={{ textTransform: 'capitalize' }}>{s.category}</span>}
                  {!d && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <MapPin size={11} /> pinned
                    </span>
                  )}
                </div>
                {(d?.phone || d?.websiteUri) && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11.5, marginTop: 2 }}>
                    {d.phone && (
                      <a href={`tel:${d.phone}`} style={{ color: 'var(--accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                        onClick={(e) => e.stopPropagation()}>
                        📞 {d.phone}
                      </a>
                    )}
                    {d.websiteUri && (
                      <a href={d.websiteUri} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                        onClick={(e) => e.stopPropagation()}>
                        🔗 Website
                      </a>
                    )}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <button
        onClick={() => sendToCopilot('Make this itinerary more rainy-day friendly — swap outdoor stops for great indoor ones.')}
        style={{
          padding: '10px 14px',
          borderRadius: 12,
          background: 'var(--accent-soft)',
          border: '1px solid var(--glass-line)',
          color: 'var(--text)',
          fontWeight: 600,
          fontSize: 13,
        }}
      >
        Make it rainy-day friendly
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass" style={{ flex: 1, padding: '9px 11px', borderRadius: 12 }}>
      <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{value}</div>
      <div style={{ fontSize: 10.5, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </div>
    </div>
  );
}

function ActionBtn({
  onClick,
  icon,
  label,
  primary,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '9px 12px',
        borderRadius: 12,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        fontSize: 13,
        fontWeight: 600,
        color: primary ? '#0b0e14' : 'var(--text)',
        background: primary ? ACCENT : 'var(--glass-2)',
        border: '1px solid var(--glass-line)',
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function Skeletons() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div key={i} className="glass atlas-shimmer" style={{ height: 150, borderRadius: 14 }} />
      ))}
    </>
  );
}
