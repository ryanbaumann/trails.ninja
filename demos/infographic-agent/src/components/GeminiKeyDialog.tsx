import React, { useState, useEffect } from 'react';
import { X, Key, ExternalLink, Check, AlertCircle } from 'lucide-react';
import { validateApiKey } from '../services/api.ts';

interface GeminiKeyDialogProps {
  open: boolean;
  onClose: () => void;
  apiKey: string | null;
  onSaveKey: (key: string | null) => void;
}

export const GeminiKeyDialog: React.FC<GeminiKeyDialogProps> = ({
  open,
  onClose,
  apiKey,
  onSaveKey,
}) => {
  const [inputVal, setInputVal] = useState(apiKey || '');
  const [isValidating, setIsValidating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setInputVal(apiKey || '');
    setErrorMsg(null);
    setSuccessMsg(null);
  }, [open, apiKey]);

  if (!open) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputVal.trim();
    if (!trimmed) {
      onSaveKey(null);
      onClose();
      return;
    }

    setIsValidating(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const valid = await validateApiKey(trimmed);
      if (valid) {
        setSuccessMsg('API Key validated successfully.');
        setTimeout(() => {
          onSaveKey(trimmed);
          onClose();
        }, 600);
      } else {
        setErrorMsg('Invalid Gemini API Key. Please verify your key in Google AI Studio.');
      }
    } catch {
      setErrorMsg('Could not validate key. Please check your network and try again.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleClear = () => {
    setInputVal('');
    onSaveKey(null);
    setErrorMsg(null);
    setSuccessMsg(null);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="byok-title">
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Key size={18} color="#3b82f6" />
            <h3 id="byok-title" className="modal-title">Gemini API Key</h3>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close dialog">
            <X size={20} />
          </button>
        </div>

        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: '1.4' }}>
          By default, this demo uses a shared hosted daily free tier. To generate unlimited high-resolution infographics with custom model selection, add your personal Gemini API key.
        </p>

        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label" htmlFor="api-key-input">API Key</label>
            <input
              id="api-key-input"
              type="password"
              className="form-input"
              placeholder="AIzaSy..."
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              autoComplete="off"
              spellCheck="false"
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.375rem' }}>
              Stored in transient tab memory only. Never saved to localStorage or server disks.
            </p>
          </div>

          {errorMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f87171', fontSize: '0.8125rem', marginBottom: '1rem' }}>
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#4ade80', fontSize: '0.8125rem', marginBottom: '1rem' }}>
              <Check size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '0.8125rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
            >
              <span>Get a free Gemini API key in Google AI Studio</span>
              <ExternalLink size={13} />
            </a>
          </div>

          <div className="modal-footer">
            {apiKey && (
              <button
                type="button"
                className="btn-secondary"
                onClick={handleClear}
                style={{ marginRight: 'auto', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)' }}
              >
                Disconnect Key
              </button>
            )}
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" style={{ width: 'auto' }} disabled={isValidating}>
              {isValidating ? 'Validating...' : 'Save & Connect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
