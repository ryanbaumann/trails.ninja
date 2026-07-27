import { useEffect, useState } from 'react';
import { X, KeyRound } from 'lucide-react';
import { hasVisitorGeminiKey, setVisitorGeminiKey } from '@/ai/client';

export function ByokModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [visitorKey, setVisitorKey] = useState('');
  const [hasVisitorKey, setHasVisitorKey] = useState(hasVisitorGeminiKey);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Use your own Gemini key"
      onClick={onClose}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 'var(--z-modal)' as unknown as number,
        background: 'var(--scrim)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass"
        style={{
          borderRadius: 20,
          padding: 24,
          width: 'min(440px, 100%)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <KeyRound size={20} color="var(--brand-b)" />
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>
              {hasVisitorKey ? 'Using your Gemini key' : 'Bring your own key'}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="glass"
            style={{ width: 32, height: 32, borderRadius: 10, display: 'grid', placeItems: 'center', flexShrink: 0, border: 'none', background: 'var(--glass-2)' }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.5 }}>
          The shared demo is intentionally capped. Bring a key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Google AI Studio</a> to keep exploring on your own quota.
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={visitorKey}
            onChange={(e) => setVisitorKey(e.target.value)}
            type="password"
            autoComplete="off"
            placeholder="Gemini API key"
            aria-label="Gemini API key"
            style={{
              flex: 1,
              minWidth: 0,
              background: 'rgba(0,0,0,0.2)',
              border: '1px solid var(--glass-line)',
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: 14,
              color: 'var(--text)',
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={() => {
              setVisitorGeminiKey(visitorKey);
              setVisitorKey('');
              setHasVisitorKey(Boolean(visitorKey.trim()));
            }}
            style={{
              background: 'var(--glass-2)',
              border: '1px solid var(--glass-line)',
              borderRadius: 10,
              padding: '0 16px',
              fontSize: 13,
              fontWeight: 800,
              color: 'var(--brand-b)',
              cursor: 'pointer',
            }}
          >
            {hasVisitorKey ? 'Replace' : 'Use key'}
          </button>
          {hasVisitorKey && (
            <button
              type="button"
              onClick={() => {
                setVisitorGeminiKey('');
                setHasVisitorKey(false);
              }}
              style={{
                background: 'var(--glass-2)',
                border: '1px solid var(--glass-line)',
                borderRadius: 10,
                padding: '0 16px',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--bad)',
                cursor: 'pointer',
              }}
            >
              Remove
            </button>
          )}
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.4 }}>
          Your key is stored only in this browser and is sent through Atlas only to make Gemini requests; it is not saved by the demo.
        </div>
      </div>
    </div>
  );
}
