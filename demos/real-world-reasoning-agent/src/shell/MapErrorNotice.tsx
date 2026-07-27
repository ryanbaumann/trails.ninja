import { useAtlas } from '@/state/store';
import { AlertCircle, X } from 'lucide-react';

/**
 * Calm, honest failure state for when Google Maps can't load (missing key,
 * referrer-restricted key, or a required API not enabled on the project).
 * Without this the app is otherwise a silent black void — see P1.1.
 */
export function MapErrorNotice() {
  const apiHealth = useAtlas((s) => s.apiHealth);
  const setApiHealth = useAtlas((s) => s.setApiHealth);

  if (apiHealth === 'ok') return null;

  if (apiHealth === 'degraded') {
    return (
      <div
        style={{
          position: 'absolute',
          top: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
          background: 'rgba(245, 158, 11, 0.1)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: 12,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          animation: 'atlas-fade-up 300ms var(--ease)',
          color: 'var(--text)',
        }}
      >
        <AlertCircle size={20} color="var(--warn)" />
        <div style={{ fontSize: 13 }}>
          <strong style={{ color: 'var(--warn)', fontWeight: 600 }}>Rate limit reached.</strong> Some features may be temporarily unresponsive.
        </div>
        <button 
          onClick={() => setApiHealth('ok')}
          style={{ padding: 4, display: 'grid', placeItems: 'center', borderRadius: 4, background: 'rgba(255,255,255,0.05)' }}
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 90,
        background: 'radial-gradient(120% 120% at 50% 0%, rgba(224,72,72,0.12), var(--scrim) 60%)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        animation: 'atlas-fade-up 400ms var(--ease)',
      }}
    >
      <div
        className="glass"
        style={{
          maxWidth: 520,
          width: '100%',
          borderRadius: 18,
          padding: '28px 30px',
          textAlign: 'left',
        }}
      >
        <div
          style={{
            fontSize: 12,
            letterSpacing: 3,
            textTransform: 'uppercase',
            color: 'var(--bad)',
            marginBottom: 10,
          }}
        >
          Map unavailable
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 10, color: 'var(--text)' }}>
          Map couldn\'t load
        </h2>
        <p style={{ color: 'var(--text-dim)', fontSize: 14, lineHeight: 1.6, marginBottom: 14 }}>
          Google Maps refused to initialize in this browser. Everything else in the demo still
          works — this is almost always a local configuration issue, not a bug in the app.
        </p>
        <ul
          style={{
            color: 'var(--text-dim)',
            fontSize: 13.5,
            lineHeight: 1.7,
            margin: '0 0 16px',
            paddingLeft: 18,
          }}
        >
          <li>
            <code style={{ color: 'var(--text)' }}>VITE_GMP_API_KEY</code> is missing from your
            environment
          </li>
          <li>the browser key\'s HTTP-referrer restriction doesn\'t allow this origin</li>
          <li>one of the required Maps APIs isn\'t enabled on the project</li>
        </ul>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: 0 }}>
          Check the local development section in the README for setup details.
        </p>
      </div>
    </div>
  );
}
