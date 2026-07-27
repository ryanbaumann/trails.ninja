import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, X } from 'lucide-react';
import { useCinema } from './store';
import { tourControl, setMuted } from './controller';
import { TOUR_BY_ID } from './tours';

/** Letterbox + transport controls, above the map, below the HUD. */
export function CinemaOverlay() {
  const tourId = useCinema((s) => s.tourId);
  const stopIndex = useCinema((s) => s.stopIndex);
  const playing = useCinema((s) => s.playing);
  const muted = useCinema((s) => s.muted);
  const tour = tourId ? TOUR_BY_ID[tourId] : undefined;
  const active = !!tour;

  return (
    <>
      {/* Letterbox bars */}
      <div
        style={{
          position: 'absolute',
          insetInline: 0,
          top: 0,
          height: active ? 54 : 0,
          background: 'linear-gradient(to bottom, rgba(6,8,12,.92), transparent)',
          pointerEvents: 'none',
          transition: 'height 500ms var(--ease)',
          zIndex: 'var(--z-overlay)' as unknown as number,
        }}
      />
      <div
        style={{
          position: 'absolute',
          insetInline: 0,
          bottom: 0,
          height: active ? 150 : 0,
          background: 'linear-gradient(to top, rgba(6,8,12,.92), transparent)',
          pointerEvents: 'none',
          transition: 'height 500ms var(--ease)',
          zIndex: 'var(--z-overlay)' as unknown as number,
        }}
      />

      {active && (
        <>
          {/* Transport controls */}
          <div
            style={{
              position: 'absolute',
              bottom: 52,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 'calc(var(--z-overlay) + 13)' as unknown as number,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Ctrl onClick={() => tourControl('prev')} aria="Previous stop"><SkipBack size={16} /></Ctrl>
            <Ctrl
              onClick={() => tourControl(playing ? 'pause' : 'play')}
              aria={playing ? 'Pause' : 'Play'}
              primary
            >
              {playing ? <Pause size={18} /> : <Play size={18} />}
            </Ctrl>
            <Ctrl onClick={() => tourControl('next')} aria="Next stop"><SkipForward size={16} /></Ctrl>

            <div style={{ display: 'flex', gap: 5, margin: '0 6px' }}>
              {tour!.stops.map((_, i) => (
                <span
                  key={i}
                  style={{
                    width: i === stopIndex ? 18 : 7,
                    height: 7,
                    borderRadius: 999,
                    background: i === stopIndex ? '#f472b6' : 'rgba(255,255,255,.3)',
                    transition: 'width 300ms var(--ease)',
                  }}
                />
              ))}
            </div>

            <Ctrl onClick={() => setMuted(!muted)} aria={muted ? 'Unmute' : 'Mute'}>
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </Ctrl>
            <Ctrl onClick={() => tourControl('exit')} aria="Exit tour"><X size={16} /></Ctrl>
          </div>
        </>
      )}
    </>
  );
}

function Ctrl({
  onClick,
  children,
  aria,
  primary,
}: {
  onClick: () => void;
  children: React.ReactNode;
  aria: string;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={aria}
      className="glass"
      style={{
        width: primary ? 46 : 38,
        height: primary ? 46 : 38,
        borderRadius: 999,
        display: 'grid',
        placeItems: 'center',
        color: primary ? '#0b0e14' : 'var(--text)',
        background: primary ? '#f472b6' : 'var(--glass)',
      }}
    >
      {children}
    </button>
  );
}
