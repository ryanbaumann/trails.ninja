/**
 * CopilotDock — the composer, and only the composer.
 *
 * It used to stack the message list, a progress panel, tool chips, starter
 * chips, follow-up chips, a share chip and a resume chip above the input, all
 * floating over the map. Every one of those is agent output and now belongs to
 * AgentCanvas; what remains here is the single always-available way to talk to
 * the agent, pinned to the bottom of the shell grid.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, Square, Mic, Loader2 } from 'lucide-react';
import { atlas, useAtlas } from '@/state/store';
import { SCENARIOS } from '@/scenarios/registry';
import { sendToCopilot, abortCopilot } from '@/ai/session';
import { useVoiceInput } from '@/shell/useVoiceInput';
import { RecipePicker } from '@/shell/RecipePicker';

/** Grace period after end-of-speech before a dictated prompt auto-sends, so the
 *  user has a beat to cancel (by typing) if the transcript looks wrong. */
const VOICE_AUTO_SUBMIT_MS = 1000;

export function CopilotDock() {
  const scenario = useAtlas((s) => s.activeScenario);
  const streaming = useAtlas((s) => s.running);
  const mod = SCENARIOS[scenario];
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  // Pending hands-free auto-submit timer (armed when dictation ends on silence).
  const voiceSubmitTimer = useRef<number | null>(null);
  const cancelVoiceSubmit = useCallback(() => {
    if (voiceSubmitTimer.current != null) {
      window.clearTimeout(voiceSubmitTimer.current);
      voiceSubmitTimer.current = null;
    }
  }, []);
  // Voice input drops the transcript into the composer (appending to any typed
  // text) and focuses it. On the manual tap-to-stop path the user reviews before
  // sending; on the auto (stopped-speaking) path we submit after a short delay.
  const voice = useVoiceInput(
    useCallback(
      (text: string, meta: { autoSubmit: boolean }) => {
        setInput((prev) => {
          const combined = prev.trim() ? `${prev.trim()} ${text}` : text;
          if (meta.autoSubmit && combined.trim()) {
            cancelVoiceSubmit();
            voiceSubmitTimer.current = window.setTimeout(() => {
              voiceSubmitTimer.current = null;
              const t = combined.trim();
              if (!t || atlas().running) return;
              setInput('');
              sendToCopilot(t);
            }, VOICE_AUTO_SUBMIT_MS);
          }
          return combined;
        });
        inputRef.current?.focus();
      },
      [cancelVoiceSubmit],
    ),
  );

  // Clear any pending hands-free auto-submit when the component unmounts.
  useEffect(() => cancelVoiceSubmit, [cancelVoiceSubmit]);

  const submit = () => {
    cancelVoiceSubmit();
    const t = input.trim();
    if (!t || streaming) return;
    setInput('');
    sendToCopilot(t);
  };

  return (
    <div className="copilot-dock">
      <div className="glass copilot-dock__composer">
        <RecipePicker />
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => {
            cancelVoiceSubmit();
            setInput(e.target.value);
          }}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder={
            streaming
              ? 'Atlas is working — press Stop to interrupt…'
              : voice.state === 'recording'
                ? 'Listening… tap the mic to stop'
                : voice.state === 'transcribing'
                  ? 'Transcribing…'
                  : (mod.placeholder ?? `Ask Atlas — ${mod.title}…`)
          }
          aria-label="Ask the Atlas copilot"
          className="copilot-dock__input"
          style={streaming ? { opacity: 0.55 } : undefined}
        />
        {voice.supported && (
          <button
            onClick={voice.toggle}
            disabled={voice.state === 'transcribing'}
            aria-label={
              voice.state === 'recording'
                ? 'Stop recording'
                : voice.state === 'transcribing'
                  ? 'Transcribing voice input'
                  : 'Speak your request'
            }
            aria-pressed={voice.state === 'recording'}
            title={voice.state === 'recording' ? 'Stop recording' : 'Speak your request'}
            className={`copilot-dock__mic${voice.state === 'recording' ? ' is-recording' : ''}`}
          >
            {voice.state === 'transcribing' ? (
              <Loader2 size={18} className="copilot-dock__mic-spin" aria-hidden="true" />
            ) : (
              <Mic size={18} aria-hidden="true" />
            )}
          </button>
        )}
        <button
          onClick={streaming ? () => abortCopilot() : submit}
          aria-label={streaming ? 'Stop' : 'Send'}
          title={streaming ? 'Stop' : 'Send'}
          className="copilot-dock__send"
          style={{ background: streaming ? 'var(--bad)' : 'var(--brand-grad)' }}
        >
          {streaming ? <Square size={16} color="#fff" fill="#fff" /> : <Send size={18} color="#fff" />}
        </button>
      </div>
    </div>
  );
}
