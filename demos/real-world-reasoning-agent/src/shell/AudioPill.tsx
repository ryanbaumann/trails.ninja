import { useSyncExternalStore } from 'react';
import { Pause, Play, Square, Volume2 } from 'lucide-react';
import { speechStatus, subscribeSpeech, pauseSpeech, resumeSpeech, stopSpeech } from '@/ai/tts';
import { useCinema } from '@/scenarios/cinema/store';

/**
 * Small, non-blocking pill offering pause/resume/stop for any narration currently
 * playing (Cinema free-explore narration, Insight read-aloud briefs, etc). Hidden
 * while idle, and hidden during a running Cinema tour since the tour's own
 * transport controls already cover play/pause.
 */
export function AudioPill() {
  const status = useSyncExternalStore(subscribeSpeech, speechStatus);
  const tourId = useCinema((s) => s.tourId);

  if (status === 'idle' || tourId) return null;

  const playing = status === 'playing';

  return (
    <div
      className="glass"
      style={{
        position: 'absolute',
        right: 20,
        bottom: 108,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        borderRadius: 999,
        padding: 8,
      }}
    >
      <Volume2 size={16} color="var(--text-dim)" style={{ pointerEvents: 'none' }} />
      <button
        onClick={() => void (playing ? pauseSpeech() : resumeSpeech())}
        aria-label={playing ? 'Pause narration' : 'Resume narration'}
        className="glass"
        style={{
          width: 38,
          height: 38,
          borderRadius: 999,
          display: 'grid',
          placeItems: 'center',
          color: 'var(--text)',
        }}
      >
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <button
        onClick={() => stopSpeech()}
        aria-label="Stop narration"
        className="glass"
        style={{
          width: 38,
          height: 38,
          borderRadius: 999,
          display: 'grid',
          placeItems: 'center',
          color: 'var(--text)',
        }}
      >
        <Square size={16} />
      </button>
    </div>
  );
}
