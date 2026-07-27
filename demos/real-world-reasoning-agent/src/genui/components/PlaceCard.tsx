/**
 * PlaceCard — renders live Google place data through Places UI Kit. Footer
 * actions: Show on map (select_place) and Ask about this (send_prompt).
 */
import { useEffect, useRef, useState, type FC } from 'react';
import type { ComponentNode, Dynamic } from '../protocol';
import { resolveDynamic } from '../protocol';
import type { SurfaceState } from '../store';
import { lib } from '@/services/maps';
import { USAGE_ATTRIBUTION_ID } from '@/lib/config';
import { dispatchSurfaceAction } from '../actions';
import { buildAction } from './actionHelpers';

export const PlaceCard: FC<{ node: ComponentNode; surface: SurfaceState; scope?: string }> = ({
  node,
  surface,
  scope,
}) => {
  const placeId = resolveDynamic(node.placeId as Dynamic<string> | undefined, surface.dataModel, scope);

  if (typeof placeId !== 'string') return null;

  return (
    <div className="genui-placecard">
      <PlaceUiKitDetails placeId={placeId} />
      <div className="genui-placecard__actions">
        <button
          type="button"
          className="genui-btn genui-btn--borderless"
          onClick={() => dispatchSurfaceAction(buildAction('select_place', surface, node.id, { placeId }))}
        >
          Show on map
        </button>
        <button
          type="button"
          className="genui-btn genui-btn--borderless"
          onClick={() =>
            dispatchSurfaceAction(
              buildAction('send_prompt', surface, node.id, { prompt: 'Tell me more about this place' }),
            )
          }
        >
          Ask about this
        </button>
      </div>
    </div>
  );
};

function PlaceUiKitDetails({ placeId }: { placeId: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [unsupported, setUnsupported] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let disposed = false;
    let element: HTMLElement | null = null;
    setUnsupported(false);
    setLoading(true);

    void (async () => {
      await lib('places').catch(() => undefined);
      if (disposed || !hostRef.current) return;

      const ctor = customElements.get('gmp-place-details-compact') ?? customElements.get('gmp-place-details');
      if (!ctor) {
        setUnsupported(true);
        setLoading(false);
        return;
      }

      element = new (ctor as CustomElementConstructor)();
      element.className = 'genui-placecard__ui-kit';
      element.setAttribute('place', placeId);
      element.setAttribute('orientation', 'vertical');
      element.setAttribute('truncation-preferred', '');
      // Attribute the Places calls this element makes to the agent-skills program
      // WITHOUT removing Google's own attribution (the gmp-place-attribution child
      // below is Google's and stays).
      (element as unknown as { internalUsageAttributionIds?: string[] }).internalUsageAttributionIds = [
        USAGE_ATTRIBUTION_ID,
      ];

      const requestEl = document.createElement('gmp-place-details-place-request');
      requestEl.setAttribute('place', placeId);
      element.appendChild(requestEl);

      const contentEl = document.createElement('gmp-place-content-config');
      contentEl.appendChild(document.createElement('gmp-place-media'));
      contentEl.appendChild(document.createElement('gmp-place-rating'));
      contentEl.appendChild(document.createElement('gmp-place-type'));
      contentEl.appendChild(document.createElement('gmp-place-price'));
      contentEl.appendChild(document.createElement('gmp-place-address'));
      contentEl.appendChild(document.createElement('gmp-place-open-now-status'));
      contentEl.appendChild(document.createElement('gmp-place-attribution'));
      element.appendChild(contentEl);

      hostRef.current.replaceChildren(element);
      setLoading(false);
    })();

    return () => {
      disposed = true;
      element?.remove();
      hostRef.current?.replaceChildren();
    };
  }, [placeId]);

  // States render as siblings of the host (never as React children of hostRef,
  // whose children are owned directly by the effect via replaceChildren).
  return (
    <div className="genui-placecard__ui-kit-wrap">
      <div ref={hostRef} className="genui-placecard__ui-kit-host" aria-label="Google Places UI Kit place details" />
      {loading ? (
        <div className="genui-placecard__loading" role="status">
          Loading place…
        </div>
      ) : null}
      {unsupported ? (
        <div className="genui-placecard__fallback" role="alert">
          Place details are unavailable.
        </div>
      ) : null}
    </div>
  );
}
