import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ExternalLink, Eye, EyeOff, KeyRound, ShieldCheck, X } from 'lucide-react';
import {
  connectGeminiApiKey,
  disconnectGeminiApiKey,
  GeminiCredentialError,
  getGeminiCredentialSnapshot,
  subscribeGeminiCredential,
} from '@/ai/client';

interface GeminiKeyDialogProps {
  open: boolean;
  onClose: () => void;
  hostedAvailable?: boolean;
}

const ERROR_COPY = {
  invalid: 'That key was rejected. Check it in Google AI Studio and try again.',
  quota: 'The key is valid, but its Gemini quota is currently unavailable.',
  model_unavailable: 'This key cannot access both Atlas agent models yet.',
  network: 'Atlas could not reach Gemini to verify the key. Check your connection and retry.',
  unknown: 'Atlas could not connect that key. Please try again.',
} as const;

export function GeminiKeyDialog({ open, onClose, hostedAvailable = false }: GeminiKeyDialogProps) {
  const credential = useSyncExternalStore(
    subscribeGeminiCredential,
    getGeminiCredentialSnapshot,
    getGeminiCredentialSnapshot,
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [key, setKey] = useState('');
  const [reveal, setReveal] = useState(false);
  const [state, setState] = useState<'idle' | 'checking' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => {
      (credential.source === 'byok'
        ? panelRef.current?.querySelector<HTMLButtonElement>('[data-disconnect]')
        : inputRef.current)?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), a[href], select:not([disabled]), textarea:not([disabled])',
      )];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [credential.source, onClose, open]);

  useEffect(() => {
    if (open) return;
    setKey('');
    setReveal(false);
    setState('idle');
    setError('');
  }, [open]);

  if (!open) return null;

  const connect = async (event: React.FormEvent) => {
    event.preventDefault();
    if (state === 'checking') return;
    setState('checking');
    setError('');
    try {
      await connectGeminiApiKey(key);
      setKey('');
      setReveal(false);
      setState('idle');
    } catch (reason) {
      const code = reason instanceof GeminiCredentialError ? reason.code : 'unknown';
      setError(ERROR_COPY[code]);
      setState('error');
    }
  };

  return (
    <div className="gemini-key-modal" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div
        ref={panelRef}
        className="glass gemini-key-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gemini-key-title"
        aria-describedby="gemini-key-description"
      >
        <div className="gemini-key-sheet__head">
          <span className="gemini-key-sheet__icon"><KeyRound size={18} aria-hidden="true" /></span>
          <div>
            <h2 id="gemini-key-title">Connect Gemini</h2>
            <p id="gemini-key-description">Use your own Gemini API key for Atlas agent requests.</p>
          </div>
          <button type="button" className="gemini-key-sheet__close" onClick={onClose} aria-label="Close Gemini setup">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {credential.source === 'byok' ? (
          <div className="gemini-key-connected" role="status">
            <ShieldCheck size={20} aria-hidden="true" />
            <div><strong>Personal key connected</strong><span>Atlas will use it for this tab until you disconnect or reload.</span></div>
            <button type="button" data-disconnect onClick={() => disconnectGeminiApiKey()}>Disconnect</button>
          </div>
        ) : (
          <form onSubmit={connect} className="gemini-key-form">
            <label htmlFor="gemini-api-key">Gemini API key</label>
            <div className="gemini-key-input">
              <input
                ref={inputRef}
                id="gemini-api-key"
                type={reveal ? 'text' : 'password'}
                value={key}
                onChange={(event) => { setKey(event.target.value); setError(''); setState('idle'); }}
                autoComplete="off"
                spellCheck={false}
                placeholder="Paste your key"
                aria-invalid={state === 'error'}
                aria-describedby={error ? 'gemini-key-error' : undefined}
              />
              <button type="button" onClick={() => setReveal((value) => !value)} aria-label={reveal ? 'Hide API key' : 'Show API key'}>
                {reveal ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
              </button>
            </div>
            {error ? <p id="gemini-key-error" className="gemini-key-error" role="alert">{error}</p> : null}
            <button type="submit" className="gemini-key-connect" disabled={!key.trim() || state === 'checking'}>
              {state === 'checking' ? 'Checking both agent models…' : 'Test and connect'}
            </button>
          </form>
        )}

        <div className="gemini-key-privacy">
          <ShieldCheck size={15} aria-hidden="true" />
          <p>
            The key stays in this tab's memory and is sent through Atlas's same-origin proxy to Google only for Gemini requests.
            It is never saved to browser storage, URLs, chat, or diagnostics.
          </p>
        </div>
        {hostedAvailable && credential.source !== 'byok' ? <p className="gemini-key-hosted">Hosted Gemini access is already available; connecting a personal key overrides it for this tab.</p> : null}
        <a className="gemini-key-link" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
          Create or manage a key in Google AI Studio <ExternalLink size={13} aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
