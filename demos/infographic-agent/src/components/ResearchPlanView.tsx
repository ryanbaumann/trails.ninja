import React, { useState } from 'react';
import { InfographicAnalysis } from '../types.ts';
import { FileText, Copy, Check, Palette } from 'lucide-react';

interface ResearchPlanViewProps {
  analysis: InfographicAnalysis;
  prompt: string;
}

export const ResearchPlanView: React.FC<ResearchPlanViewProps> = ({ analysis, prompt }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="analysis-box">
      <div className="analysis-header">
        <FileText size={14} style={{ display: 'inline', marginRight: '0.35rem', verticalAlign: 'middle' }} />
        <span>Stage 1: Gemini 3.7 Flash Research & Architecture</span>
      </div>

      {analysis.title && (
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0.35rem 0 0.15rem', color: 'var(--text-primary)' }}>
          {analysis.title}
        </h3>
      )}
      {analysis.subtitle && (
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
          {analysis.subtitle}
        </p>
      )}

      <div className="analysis-stat-row">
        {typeof analysis.dataPointsCount === 'number' && (
          <div className="analysis-stat">
            <span className="stat-val">{analysis.dataPointsCount}</span>
            <span className="stat-label">Data Points</span>
          </div>
        )}
        {typeof analysis.sectionsCount === 'number' && (
          <div className="analysis-stat">
            <span className="stat-val">{analysis.sectionsCount}</span>
            <span className="stat-label">Layout Sections</span>
          </div>
        )}
      </div>

      {Array.isArray(analysis.brandColors) && analysis.brandColors.length > 0 && (
        <div style={{ marginTop: '0.75rem' }}>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Palette size={12} />
            <span>Harmonious Color Palette:</span>
          </div>
          <div className="palette-swatches">
            {analysis.brandColors.map((color, idx) => (
              <div
                key={idx}
                className="palette-swatch"
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        </div>
      )}

      {analysis.sourceAttribution && (
        <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.625rem' }}>
          Source: {analysis.sourceAttribution}
        </p>
      )}

      <div style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600 }}>Synthesized Image Prompt:</span>
          <button
            type="button"
            onClick={handleCopyPrompt}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              background: 'transparent',
              border: 'none',
              color: copied ? '#4ade80' : '#60a5fa',
              fontSize: '0.6875rem',
              cursor: 'pointer',
            }}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy Prompt'}</span>
          </button>
        </div>
        <div className="prompt-preview">{prompt}</div>
      </div>
    </div>
  );
};
