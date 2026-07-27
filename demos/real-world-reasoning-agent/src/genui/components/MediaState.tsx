/**
 * Shared accessible loading/error states for the media catalog components
 * (Image, Video, MapPreview). Loading uses role="status"; error uses role="alert"
 * and a "Retry" button so a transient failure (blocked/broken src) is recoverable
 * without re-emitting the surface. Styling lives under the ".genui-media-state"
 * block in global.css.
 */
import type { FC } from 'react';

export const MediaLoading: FC<{ label?: string; className?: string }> = ({ label = 'Loading…', className }) => (
  <div className={`genui-media-state genui-media-state--loading${className ? ` ${className}` : ''}`} role="status">
    <span className="genui-media-state__spinner" aria-hidden="true" />
    <span className="genui-media-state__text">{label}</span>
  </div>
);

export const MediaError: FC<{ label?: string; onRetry: () => void; className?: string }> = ({
  label = "Couldn't load",
  onRetry,
  className,
}) => (
  <div className={`genui-media-state genui-media-state--error${className ? ` ${className}` : ''}`} role="alert">
    <span className="genui-media-state__text">{label}</span>
    <button type="button" className="genui-btn genui-media-state__retry" onClick={onRetry}>
      Retry
    </button>
  </div>
);
