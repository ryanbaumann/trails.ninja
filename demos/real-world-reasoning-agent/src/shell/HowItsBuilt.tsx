import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useAtlas } from '@/state/store';
import { SCENARIOS } from '@/scenarios/registry';
import { COMMON_TOOLS } from '@/ai/tools/common';
import { composeSystemPrompt } from '@/ai/prompts';
import { DEFAULT_CITY_PRESET } from '@/lib/cities';

/**
 * The "fork-me" moment: one click reveals that the active journey is literally a
 * system prompt plus typed tools, policies, reusable orchestration, and generated surfaces.
 */
export function HowItsBuilt({ open, onClose }: { open: boolean; onClose: () => void }) {
  const scenario = useAtlas((s) => s.activeScenario);
  const cityId = useAtlas((s) => s.cityId);
  const cities = useAtlas((s) => s.cities);
  const mod = SCENARIOS[scenario];
  const city = cities.find((c) => c.id === cityId) ?? DEFAULT_CITY_PRESET;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  // mod.tools already includes COMMON_TOOLS (each journey spreads them in first),
  // so it is the full, de-duplicated tool surface for this journey.
  const commonNames = new Set(COMMON_TOOLS.map((t) => t.declaration.name));
  const toolCount = mod.tools.length;
  const systemPrompt = composeSystemPrompt(mod.systemPrompt, { name: city.name });

  return (
    <div
      role="dialog"
      aria-label="How this journey is built"
      onClick={onClose}
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
          padding: 18,
          width: 'min(640px, 94vw)',
          maxHeight: 'min(calc(100vh - 48px), 900px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700 }}>
              This journey is one prompt and {toolCount} tools.
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 6, lineHeight: 1.5 }}>
              One reusable agent loop coordinates purpose-built tools, policies, typed state, and
              generated surfaces. The model interprets and replans; deterministic actions stay local.
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="glass"
            style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', flexShrink: 0 }}
          >
            <X size={17} />
          </button>
        </div>

        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 13.5 }}>System prompt</summary>
          <pre
            style={{
              marginTop: 10,
              padding: 12,
              borderRadius: 12,
              background: 'var(--bg-2)',
              border: '1px solid var(--glass-line)',
              fontSize: 12,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: 320,
              overflow: 'auto',
            }}
          >
            {systemPrompt}
          </pre>
        </details>

        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 13.5 }}>
            Tools ({toolCount})
          </summary>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {mod.tools.map((t, i) => {
              const name = t.declaration.name ?? `tool_${i}`;
              return (
                <div
                  key={name}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 10,
                    background: 'var(--bg-2)',
                    border: '1px solid var(--glass-line)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <code style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--accent)' }}>{name}</code>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: 0.5,
                        textTransform: 'uppercase',
                        color: 'var(--text-faint)',
                      }}
                    >
                      {commonNames.has(name) ? 'common' : 'journey'}
                    </span>
                  </div>
                  {t.declaration.description ? (
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 3, lineHeight: 1.45 }}>
                      {t.declaration.description}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </details>
      </div>
    </div>
  );
}
