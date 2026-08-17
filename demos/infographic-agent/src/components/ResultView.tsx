import React from 'react';
import { Download, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { AspectRatio, VisualMode } from '../types.ts';

interface ResultViewProps {
  imageUrl: string;
  topic: string;
  mode: VisualMode;
  aspect: AspectRatio;
  model: string;
}

export const ResultView: React.FC<ResultViewProps> = ({
  imageUrl,
  topic,
  mode,
  aspect,
  model,
}) => {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    const cleanSlug = topic
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'infographic';
    link.download = `${cleanSlug}-${aspect.replace(':', 'x')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenNewTab = () => {
    const win = window.open();
    if (win) {
      win.document.write(`<img src="${imageUrl}" style="max-width:100%;height:auto;" alt="Infographic" />`);
    }
  };

  return (
    <div className="result-display">
      <div className="image-preview-wrapper">
        <img
          src={imageUrl}
          alt={`Infographic for ${topic}`}
          className="infographic-image"
        />
      </div>

      <div className="image-actions-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="brand-badge" style={{ textTransform: 'none' }}>
            <ImageIcon size={12} style={{ display: 'inline', marginRight: '0.25rem', verticalAlign: 'middle' }} />
            {model}
          </span>
          <span className="brand-badge" style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)', color: '#cbd5e1' }}>
            {aspect} • {mode}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleOpenNewTab}
            title="Open in new window"
          >
            <ExternalLink size={14} />
            <span>Full View</span>
          </button>
          <button
            type="button"
            className="btn-primary"
            style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.8125rem' }}
            onClick={handleDownload}
          >
            <Download size={14} />
            <span>Download PNG</span>
          </button>
        </div>
      </div>
    </div>
  );
};
