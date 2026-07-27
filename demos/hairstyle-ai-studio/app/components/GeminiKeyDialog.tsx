import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound, X } from 'lucide-react';

interface GeminiKeyDialogProps {
  isOpen: boolean;
  hasPersonalKey: boolean;
  onClose: () => void;
  onConnect: (apiKey: string) => Promise<boolean>;
  onDisconnect: () => void;
}

export const GeminiKeyDialog = ({
  isOpen,
  hasPersonalKey,
  onClose,
  onConnect,
  onDisconnect,
}: GeminiKeyDialogProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [keyInput, setKeyInput] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    window.requestAnimationFrame(() => inputRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="gemini-key-title"
        className="w-full max-w-lg rounded-t-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:rounded-3xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
              <KeyRound size={21} aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-primary-600 dark:text-primary-400">
                Keep creating
              </p>
              <h2 id="gemini-key-title" className="mt-1 text-xl font-black text-slate-900 dark:text-white">
                {hasPersonalKey ? 'Personal Gemini key connected' : 'Use your Gemini API key'}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-slate-800"
            aria-label="Close API key dialog"
          >
            <X size={20} />
          </button>
        </div>

        {hasPersonalKey ? (
          <div className="mt-6">
            <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
              <CheckCircle2 size={18} aria-hidden="true" />
              Validated for this tab only
            </p>
            <button
              type="button"
              onClick={() => {
                onDisconnect();
                onClose();
              }}
              className="mt-4 min-h-12 w-full rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:border-primary-400 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-slate-700 dark:text-slate-200"
            >
              Disconnect and use the shared tier
            </button>
          </div>
        ) : (
          <form
            className="mt-6"
            onSubmit={async (event) => {
              event.preventDefault();
              setError('');
              setIsValidating(true);
              try {
                const connected = await onConnect(keyInput);
                if (!connected) {
                  setError('That key format is not valid.');
                  return;
                }
                setKeyInput('');
              } catch (validationError) {
                setError(validationError instanceof Error ? validationError.message : 'Gemini could not validate that key.');
              } finally {
                setIsValidating(false);
              }
            }}
          >
            <label htmlFor="gemini-api-key" className="block text-sm font-bold text-slate-800 dark:text-slate-200">
              Gemini API key
            </label>
            <div className="relative mt-2">
              <input
                ref={inputRef}
                id="gemini-api-key"
                type={isVisible ? 'text' : 'password'}
                value={keyInput}
                onChange={(event) => {
                  setKeyInput(event.target.value);
                  setError('');
                }}
                autoComplete="off"
                spellCheck={false}
                aria-describedby="gemini-key-help gemini-key-error"
                className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 pr-12 font-mono text-sm text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                placeholder="Paste your key"
              />
              <button
                type="button"
                onClick={() => setIsVisible((visible) => !visible)}
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
                aria-label={isVisible ? 'Hide API key' : 'Show API key'}
              >
                {isVisible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p id="gemini-key-help" className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              The proxy validates your key without generating content. It stays in this tab’s memory and is never stored or sent to analytics.{' '}
              <a className="font-bold text-primary-600 underline underline-offset-2 dark:text-primary-400" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
                Create a key
              </a>
            </p>
            <p id="gemini-key-error" role="alert" className="mt-2 min-h-5 text-xs font-semibold text-red-600 dark:text-red-400">
              {error}
            </p>
            <button
              type="submit"
              disabled={isValidating || !keyInput.trim()}
              className="mt-2 min-h-12 w-full rounded-xl bg-primary-600 px-4 text-sm font-bold text-white shadow-lg transition-colors hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isValidating ? 'Checking key…' : 'Validate and connect'}
            </button>
          </form>
        )}
      </section>
    </div>
  );
};
