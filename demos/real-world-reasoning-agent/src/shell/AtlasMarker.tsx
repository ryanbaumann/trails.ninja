import type { CSSProperties } from 'react';
import type { MarkerSpec } from '@/lib/types';

export function AtlasMarker({ marker, selected }: { marker: MarkerSpec; selected: boolean }) {
  const kind = marker.kind ?? 'pin';
  const style: CSSProperties = { '--marker-accent': marker.color ?? '#f59e0b' } as CSSProperties;

  // Directional markers (e.g. trucks) rotate their whole body + ::after nose to
  // face the travel heading. We must set the rotation on the marker element
  // itself so it shares the same pivot as the decorative nose triangle.
  const directional = typeof marker.heading === 'number' && Number.isFinite(marker.heading);
  let glyphStyle: CSSProperties | undefined;
  if (directional) {
    const heading = marker.heading as number;
    // The inline transform overrides the CSS `.atlas-marker` rule entirely, so we
    // must re-declare translate(-50%,-50%) (centering) and the selected scale here,
    // then append the rotation. The existing `transition: transform` keeps it smooth.
    const scale = selected ? 1.25 : 1;
    style.transform = `translate(-50%, -50%) rotate(${heading}deg) scale(${scale})`;
    // Counter-rotate the glyph so the emoji/label stays upright while the body turns.
    glyphStyle = { transform: `rotate(${-heading}deg)`, display: 'inline-block' };
  }

  return (
    <span
      className={`atlas-marker atlas-marker--${kind} ${selected ? 'is-selected' : ''}`}
      style={style}
    >
      <span className="atlas-marker__glyph" style={glyphStyle}>
        {marker.glyph ?? marker.label ?? '•'}
      </span>
    </span>
  );
}
