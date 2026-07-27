import type { FC } from 'react';
import type { ComponentNode, Dynamic } from '../protocol';
import { resolveDisplayText, resolveDynamic } from '../protocol';
import type { SurfaceState } from '../store';
import { dispatchSurfaceAction } from '../actions';
import { buildAction } from './actionHelpers';

export const GroundingAttribution: FC<{ node: ComponentNode; surface: SurfaceState; scope?: string }> = ({
  node,
  surface,
  scope,
}) => {
  const title = resolveDisplayText(node.title as Dynamic<unknown> | undefined, surface.dataModel, scope);
  const urlValue = resolveDynamic(node.url as Dynamic<unknown> | undefined, surface.dataModel, scope);
  const url = typeof urlValue === 'string' && urlValue.startsWith('https://') ? urlValue : undefined;
  const placeUrlValue = resolveDynamic(node.placeUrl as Dynamic<unknown> | undefined, surface.dataModel, scope);
  const placeUrl = typeof placeUrlValue === 'string' && placeUrlValue.startsWith('https://') ? placeUrlValue : undefined;
  const provider = resolveDisplayText(node.provider as Dynamic<unknown> | undefined, surface.dataModel, scope) || 'Google Maps';
  if (!title || !url) return null;
  return (
    <div className="genui-grounding-source">
      <button
        type="button"
        className="genui-grounding-source__main"
        onClick={() => dispatchSurfaceAction(buildAction('open_url', surface, node.id, { url }))}
        aria-label={`Open source: ${title}`}
      >
        <span className="genui-grounding-source__title" translate="no">{title}</span>
        <span className="genui-grounding-source__provider" translate="no">{provider}</span>
      </button>
      {placeUrl ? (
        <button
          type="button"
          className="genui-grounding-source__place"
          onClick={() => dispatchSurfaceAction(buildAction('open_url', surface, node.id, { url: placeUrl }))}
        >View place</button>
      ) : null}
    </div>
  );
};
