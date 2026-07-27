import { useEffect, useState } from 'react';
import { X, SlidersHorizontal, Download, Trash2, UploadCloud } from 'lucide-react';
import { useAtlas, collectSanitizedDiagnostics, type ThinkingChoice } from '@/state/store';
import { validateSanitized } from '@/diagnostics/telemetry';

type SendState = { kind: 'idle' | 'sending' | 'ok' | 'error'; msg?: string };

/** Production orchestrator models known to be on the server allowlist. */
const CHAT_MODELS = ['gemini-3.6-flash'];
const THINKING: ThinkingChoice[] = ['default', 'low', 'medium'];

/**
 * Hidden admin panel for live A/B testing of the copilot chat model + thinking
 * level, without code edits or env changes. Toggle with Cmd/Ctrl+Shift+A, or open
 * on load with `?admin=1`. Changing a value rebuilds the engines (see session.ts),
 * so the next message uses the new config; the transcript is kept as a log.
 */
export function AdminPanel() {
  const open = useAtlas((s) => s.adminOpen);
  const toggleAdmin = useAtlas((s) => s.toggleAdmin);
  const setAdminOpen = useAtlas((s) => s.setAdminOpen);
  const chatModel = useAtlas((s) => s.chatModel);
  const chatThinking = useAtlas((s) => s.chatThinking);
  const setChatModel = useAtlas((s) => s.setChatModel);
  const setChatThinking = useAtlas((s) => s.setChatThinking);
  const clearAllTelemetry = useAtlas((s) => s.clearAllTelemetry);
  // Opt-in consent for the server send. Off by default — nothing leaves the
  // browser unless the operator both checks this AND clicks Send.
  const [consent, setConsent] = useState(false);
  const [sendState, setSendState] = useState<SendState>({ kind: 'idle' });

  // Export the bounded session diagnostics as SANITIZED JSON (structural
  // metadata only — no prompts, Maps content, ids, or coordinates leave the
  // browser). See src/diagnostics/telemetry (reliability §5).
  const exportDiagnostics = () => {
    const data = JSON.stringify(collectSanitizedDiagnostics(), null, 2);
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'atlas-diagnostics.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Consent-gated send to the demo's namespaced same-origin metadata sink (server logs the
  // sanitized batch for the telemetry-triage job). Belt-and-suspenders: re-run
  // the content validator client-side and refuse if anything trips it, so a leak
  // never leaves the browser even if the sanitizer regressed.
  const sendDiagnostics = async () => {
    const records = collectSanitizedDiagnostics();
    if (records.length === 0) {
      setSendState({ kind: 'error', msg: 'No diagnostics to send yet.' });
      return;
    }
    if (records.some((r) => validateSanitized(r).length > 0)) {
      setSendState({ kind: 'error', msg: 'Refused: a record failed the content check.' });
      return;
    }
    setSendState({ kind: 'sending' });
    try {
      const res = await fetch('/api/real-world-reasoning-agent/metadata', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-atlas-consent': '1' },
        body: JSON.stringify(records),
      });
      if (res.status === 204) setSendState({ kind: 'ok', msg: `Sent ${records.length} record(s).` });
      else if (res.status === 403) setSendState({ kind: 'error', msg: 'Consent required.' });
      else if (res.status === 429) setSendState({ kind: 'error', msg: 'Busy — try again shortly.' });
      else if (res.status === 400) setSendState({ kind: 'error', msg: 'Rejected by the server.' });
      else setSendState({ kind: 'error', msg: `Unexpected response (${res.status}).` });
    } catch {
      setSendState({ kind: 'error', msg: 'Network error.' });
    }
  };

  // Global toggle shortcut (Cmd/Ctrl + Shift + A). Always mounted so it works
  // whether the panel is open or closed.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        toggleAdmin();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleAdmin]);

  if (!open) return null;

  const models = CHAT_MODELS.includes(chatModel) ? CHAT_MODELS : [chatModel, ...CHAT_MODELS];

  return (
    <div className="glass admin-panel" role="dialog" aria-label="Admin: copilot model tuner">
      <div className="admin-panel__head">
        <SlidersHorizontal size={15} aria-hidden="true" />
        <span className="admin-panel__title">Agent routing</span>
        <button
          onClick={() => setAdminOpen(false)}
          className="admin-panel__close"
          aria-label="Close admin panel"
          title="Close (Cmd/Ctrl+Shift+A)"
        >
          <X size={15} />
        </button>
      </div>

      <label className="admin-panel__row">
        <span className="admin-panel__label">Orchestrator</span>
        <select
          className="admin-panel__control"
          value={models.includes(chatModel) ? chatModel : ''}
          onChange={(e) => setChatModel(e.target.value)}
        >
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>

      <label className="admin-panel__row">
        <span className="admin-panel__label">Thinking</span>
        <select
          className="admin-panel__control"
          value={chatThinking}
          onChange={(e) => setChatThinking(e.target.value as ThinkingChoice)}
        >
          {THINKING.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>

      <p className="admin-panel__hint">
        Applies to your next message. <code>default</code> = medium. Task agents use
        <code>gemini-3.5-flash-lite</code> at minimal or medium thinking. Switching
        starts fresh model context.
      </p>

      <div className="admin-panel__row admin-panel__row--actions">
        <span className="admin-panel__label">Diagnostics</span>
        <div className="admin-panel__actions">
          <button
            type="button"
            className="admin-panel__control admin-panel__btn"
            onClick={exportDiagnostics}
            title="Download sanitized session diagnostics (no content leaves the browser)"
          >
            <Download size={13} aria-hidden="true" /> Export
          </button>
          <button
            type="button"
            className="admin-panel__control admin-panel__btn"
            onClick={clearAllTelemetry}
            title="Clear the in-memory session diagnostics"
          >
            <Trash2 size={13} aria-hidden="true" /> Clear
          </button>
        </div>
      </div>

      <label className="admin-panel__row admin-panel__consent">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => {
            setConsent(e.target.checked);
            setSendState({ kind: 'idle' });
          }}
          aria-label="Consent to send sanitized diagnostics to the server"
        />
        <span className="admin-panel__label">
          I consent to send sanitized diagnostics to the server for reliability triage.
        </span>
      </label>
      <div className="admin-panel__row admin-panel__row--actions">
        <span className="admin-panel__label">Send</span>
        <div className="admin-panel__actions">
          <button
            type="button"
            className="admin-panel__control admin-panel__btn"
            onClick={sendDiagnostics}
            disabled={!consent || sendState.kind === 'sending'}
            title="POST sanitized diagnostics to the namespaced same-origin metadata sink (opt-in)"
          >
            <UploadCloud size={13} aria-hidden="true" />{' '}
            {sendState.kind === 'sending' ? 'Sending…' : 'Send diagnostics'}
          </button>
        </div>
      </div>
      {sendState.msg && (
        <p
          className="admin-panel__hint"
          role="status"
          data-state={sendState.kind}
        >
          {sendState.msg}
        </p>
      )}
      <p className="admin-panel__hint">
        Export and send contain only structural metadata (tool, status, category) —
        never prompts, Maps content, ids, or locations. The send is opt-in and
        requires the consent above.
      </p>
    </div>
  );
}
