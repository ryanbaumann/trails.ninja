import React, { useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';

interface RefineSectionProps {
  onRefine: (instruction: string) => void;
  isRefining: boolean;
}

const REFINE_PRESETS = [
  'Enhance typography contrast and make headlines bolder',
  'Shift color scheme to deep slate with cyan accents',
  'Add clear section dividers and callout badges',
  'Simplify data visual blocks for cleaner readability',
];

export const RefineSection: React.FC<RefineSectionProps> = ({ onRefine, isRefining }) => {
  const [instruction, setInstruction] = useState('');

  const handleSub = (e: React.FormEvent) => {
    e.preventDefault();
    if (!instruction.trim() || isRefining) return;
    onRefine(instruction.trim());
    setInstruction('');
  };

  return (
    <div className="panel-card" style={{ marginTop: '1.5rem' }}>
      <div className="panel-title">
        <Sparkles size={16} color="#3b82f6" />
        <span>Iterative Design Refinement</span>
      </div>

      <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.875rem' }}>
        Request specific visual or structural edits while preserving the core infographic layout.
      </p>

      <div className="starters-row" style={{ marginBottom: '0.875rem' }}>
        {REFINE_PRESETS.map((preset, idx) => (
          <button
            key={idx}
            type="button"
            className="starter-chip"
            onClick={() => setInstruction(preset)}
            disabled={isRefining}
          >
            {preset}
          </button>
        ))}
      </div>

      <form onSubmit={handleSub} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          className="form-input"
          style={{ flex: '1 1 240px' }}
          placeholder="Describe changes (e.g., make the charts larger, use emerald accents)..."
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          disabled={isRefining}
        />
        <button
          type="submit"
          className="btn-primary"
          style={{ width: 'auto', padding: '0.625rem 1.25rem' }}
          disabled={isRefining || !instruction.trim()}
        >
          <RefreshCw size={14} className={isRefining ? 'spinner' : ''} style={{ animation: isRefining ? 'spin 1s linear infinite' : 'none' }} />
          <span>{isRefining ? 'Refining...' : 'Apply Edit'}</span>
        </button>
      </form>
    </div>
  );
};
