import { useAtlas } from '@/state/store';

const COLOR = {
  info: 'var(--info)',
  good: 'var(--good)',
  warn: 'var(--warn)',
  bad: 'var(--bad)',
} as const;

export function Toasts() {
  const toasts = useAtlas((s) => s.toasts);
  const dismiss = useAtlas((s) => s.dismissToast);
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 20,
        right: 20,
        zIndex: 60,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className="glass"
          style={{
            borderRadius: 12,
            padding: '10px 14px',
            fontSize: 13,
            textAlign: 'left',
            borderLeft: `3px solid ${COLOR[t.kind]}`,
            maxWidth: 320,
            animation: 'atlas-fade-up 200ms var(--ease)',
          }}
        >
          {t.text}
        </button>
      ))}
    </div>
  );
}
