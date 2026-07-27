/**
 * EtaSummary — a compact ETA row (Atlas A2UI v0.9 subset). Shows a mode glyph
 * (walk/drive/transit/bike), the resolved duration, and an optional distance.
 * Pairs with RouteItinerary in the Fleet journey to summarize a computed route.
 */
import type { FC } from 'react';
import type { ComponentNode, Dynamic } from '../protocol';
import { resolveDisplayText } from '../protocol';
import type { SurfaceState } from '../store';

type Mode = 'walk' | 'drive' | 'transit' | 'bike';
const MODE_GLYPH: Record<Mode, string> = { walk: '🚶', drive: '🚗', transit: '🚆', bike: '🚲' };

export const EtaSummary: FC<{ node: ComponentNode; surface: SurfaceState; scope?: string }> = ({
  node,
  surface,
  scope,
}) => {
  const duration = resolveDisplayText(node.duration as Dynamic<unknown> | undefined, surface.dataModel, scope);
  const distance = resolveDisplayText(node.distance as Dynamic<unknown> | undefined, surface.dataModel, scope);
  const modeRaw = resolveDisplayText(node.mode as Dynamic<unknown> | undefined, surface.dataModel, scope);
  const mode = (Object.prototype.hasOwnProperty.call(MODE_GLYPH, modeRaw) ? modeRaw : undefined) as Mode | undefined;
  if (!duration) return null;

  return (
    <div className="genui-eta">
      {mode ? (
        <span className="genui-eta__mode" aria-hidden="true">{MODE_GLYPH[mode]}</span>
      ) : null}
      <span className="genui-eta__duration">{duration}</span>
      {distance ? <span className="genui-eta__distance">{distance}</span> : null}
    </div>
  );
};
