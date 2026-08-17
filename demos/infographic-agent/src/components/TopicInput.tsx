import React from 'react';
import { VisualMode, AspectRatio, ImageModelOption } from '../types.ts';
import { Sparkles, Wand2, Layers, Sliders, Image as ImageIcon } from 'lucide-react';

interface TopicInputProps {
  topic: string;
  setTopic: (val: string) => void;
  mode: VisualMode;
  setMode: (val: VisualMode) => void;
  aspect: AspectRatio;
  setAspect: (val: AspectRatio) => void;
  imageModel: ImageModelOption;
  setImageModel: (val: ImageModelOption) => void;
  instructions: string;
  setInstructions: (val: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
}

const MODES_LIST: Array<{ id: VisualMode; label: string; desc: string }> = [
  { id: 'data-story', label: 'Data Story', desc: 'Stats, charts, metrics & trends' },
  { id: 'executive-summary', label: 'Executive', desc: 'Minimal, strategic takeaways' },
  { id: 'technical-deep-dive', label: 'Technical', desc: 'Architecture, code & system flow' },
  { id: 'classroom', label: 'Classroom', desc: 'Friendly, step-by-step analogies' },
  { id: 'quick-slide', label: 'Quick Slide', desc: 'High-impact presentation slide' },
  { id: 'brandkit', label: 'Brand Kit', desc: 'Swatches, typography & UI board' },
  { id: 'blog-post', label: 'Editorial Hero', desc: 'Punchy tagline & dramatic visual' },
  { id: 'portfolio-showcase', label: 'Case Study', desc: 'Milestones & alignment grid' },
];

const ASPECT_LIST: AspectRatio[] = ['16:9', '1:1', '9:16', '3:4', '4:3', '1:4', '16:10', '21:9'];

const STARTERS = [
  'Global renewable energy transition trends 2024–2030 with key solar & wind growth metrics',
  'Multi-agent AI orchestration architecture comparing Centralized vs Choreographed patterns',
  'Core Web Vitals checklist: LCP, INP, and CLS optimization best practices for frontend engineers',
  'PostgreSQL vs BigQuery for analytical query workloads: throughput, cost, and index tradeoffs',
];

export const TopicInput: React.FC<TopicInputProps> = ({
  topic,
  setTopic,
  mode,
  setMode,
  aspect,
  setAspect,
  imageModel,
  setImageModel,
  instructions,
  setInstructions,
  onSubmit,
  isLoading,
}) => {
  return (
    <div className="panel-card">
      <div className="panel-title">
        <Sparkles size={18} color="#3b82f6" />
        <span>Infographic Creator</span>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="topic-input">Topic or Raw Content</label>
        <textarea
          id="topic-input"
          className="form-textarea"
          placeholder="Enter a research topic, article text, data table, or technical concept to visualize..."
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          disabled={isLoading}
        />
        <div className="starters-row">
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', alignSelf: 'center' }}>Examples:</span>
          {STARTERS.map((s, idx) => (
            <button
              key={idx}
              type="button"
              className="starter-chip"
              onClick={() => setTopic(s)}
              disabled={isLoading}
            >
              {s.slice(0, 32)}...
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Layers size={14} />
          <span>Visual Mode</span>
        </label>
        <div className="mode-grid">
          {MODES_LIST.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`mode-btn ${mode === m.id ? 'active' : ''}`}
              onClick={() => setMode(m.id)}
              disabled={isLoading}
            >
              <span className="mode-name">{m.label}</span>
              <span className="mode-desc">{m.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Aspect Ratio</label>
        <div className="aspect-row">
          {ASPECT_LIST.map((ar) => (
            <button
              key={ar}
              type="button"
              className={`aspect-btn ${aspect === ar ? 'active' : ''}`}
              onClick={() => setAspect(ar)}
              disabled={isLoading}
            >
              {ar}
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <ImageIcon size={14} />
          <span>Image Render Model</span>
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <button
            type="button"
            className={`mode-btn ${imageModel === 'gemini-3.1-flash-lite-image' ? 'active' : ''}`}
            onClick={() => setImageModel('gemini-3.1-flash-lite-image')}
            disabled={isLoading}
          >
            <span className="mode-name">3.1 Flash Lite Image</span>
            <span className="mode-desc">Default website fast tier</span>
          </button>
          <button
            type="button"
            className={`mode-btn ${imageModel === 'gemini-3.1-flash-image' ? 'active' : ''}`}
            onClick={() => setImageModel('gemini-3.1-flash-image')}
            disabled={isLoading}
          >
            <span className="mode-name">3.1 Flash Image</span>
            <span className="mode-desc">Studio high resolution</span>
          </button>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="instructions-input" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Sliders size={14} />
          <span>Custom Instructions (Optional)</span>
        </label>
        <input
          id="instructions-input"
          type="text"
          className="form-input"
          placeholder="e.g. Use a dark navy background with emerald green accents, highlight 3 key stats"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          disabled={isLoading}
        />
      </div>

      <button
        type="button"
        className="btn-primary"
        onClick={onSubmit}
        disabled={isLoading || !topic.trim()}
      >
        <Wand2 size={16} />
        <span>{isLoading ? 'Architecting Infographic...' : 'Generate Infographic'}</span>
      </button>
    </div>
  );
};
