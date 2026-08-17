import React from 'react';
import { Sparkles, Key, CheckCircle2 } from 'lucide-react';

interface HeaderProps {
  apiKey: string | null;
  onOpenKeyDialog: () => void;
}

export const Header: React.FC<HeaderProps> = ({ apiKey, onOpenKeyDialog }) => {
  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="brand-group">
          <a href="/" className="back-to-home" title="Back to Ryan Baumann">
            ← Home
          </a>
          <div className="brand-icon">
            <Sparkles size={20} />
          </div>
          <div>
            <div className="brand-title">
              Infographic Agent
              <span className="brand-badge">Gemini 3.7 + 3.1</span>
            </div>
          </div>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="key-status-btn"
            onClick={onOpenKeyDialog}
            title={apiKey ? 'Personal Gemini API Key Active' : 'Hosted Daily Free Tier'}
          >
            {apiKey ? (
              <>
                <CheckCircle2 size={15} color="#10b981" />
                <span>Personal Key Active</span>
              </>
            ) : (
              <>
                <Key size={15} />
                <span>API Key / Free Tier</span>
                <span className="status-dot" />
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
