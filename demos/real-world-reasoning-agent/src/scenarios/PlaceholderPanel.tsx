/** Small glass "warming up" panel used by placeholder scenario modules. */
export function PlaceholderPanel({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ padding: '20px 18px' }}>
      <h2
        style={{
          margin: '0 0 8px',
          fontFamily: 'var(--font-display)',
          fontSize: 18,
          color: 'var(--text)',
        }}
      >
        {title}
      </h2>
      <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 14, lineHeight: 1.5 }}>{body}</p>
    </div>
  );
}
