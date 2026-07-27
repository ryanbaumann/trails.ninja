/**
 * EvidenceSource — a compact chip that attributes a claim to a grounded source
 * (Atlas A2UI v0.9 subset). Shows an optional provenance tag (observed/computed/
 * inferred/generated), the source label, an optional confidence percentage, and,
 * when a `url` is present, a borderless "Source" button that opens it via the
 * built-in open_url action. Keeps model claims honest about where they came from.
 */
import type { FC } from 'react';
import type { ComponentNode, Dynamic } from '../protocol';
import { resolveDisplayText, resolveDynamic } from '../protocol';
import type { SurfaceState } from '../store';
import { dispatchSurfaceAction } from '../actions';
import { buildAction } from './actionHelpers';

type Provenance = 'observed' | 'computed' | 'inferred' | 'generated';
const PROVENANCE = new Set<Provenance>(['observed', 'computed', 'inferred', 'generated']);

export const EvidenceSource: FC<{ node: ComponentNode; surface: SurfaceState; scope?: string }> = ({
  node,
  surface,
  scope,
}) => {
  const label = resolveDisplayText(node.label as Dynamic<unknown> | undefined, surface.dataModel, scope);
  const provRaw = resolveDisplayText(node.provenance as Dynamic<unknown> | undefined, surface.dataModel, scope);
  const provenance: Provenance | undefined = PROVENANCE.has(provRaw as Provenance)
    ? (provRaw as Provenance)
    : undefined;
  const urlRaw = resolveDynamic(node.url as Dynamic<unknown> | undefined, surface.dataModel, scope);
  const url = typeof urlRaw === 'string' && urlRaw ? urlRaw : undefined;
  const confidence = resolveDynamic(node.confidence as Dynamic<number> | undefined, surface.dataModel, scope);
  if (!label) return null;

  const pct =
    typeof confidence === 'number' && Number.isFinite(confidence)
      ? `${Math.round(Math.max(0, Math.min(1, confidence)) * 100)}%`
      : undefined;

  return (
    <div className="genui-evidence">
      {provenance ? (
        <span className={`genui-evidence__tag genui-evidence__tag--${provenance}`}>{provenance}</span>
      ) : null}
      <span className="genui-evidence__label">{label}</span>
      {pct ? <span className="genui-evidence__confidence">{pct}</span> : null}
      {url ? (
        <button
          type="button"
          className="genui-btn genui-btn--borderless genui-evidence__source"
          onClick={() => dispatchSurfaceAction(buildAction('open_url', surface, node.id, { url }))}
        >
          Source
        </button>
      ) : null}
    </div>
  );
};
