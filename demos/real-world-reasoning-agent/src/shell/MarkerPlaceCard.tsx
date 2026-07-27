import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { AdvancedMarker } from '@vis.gl/react-google-maps';
import { ExternalLink, MapPin, Phone, Star, X } from 'lucide-react';
import { useAtlas } from '@/state/store';
import type { MarkerSpec, PlaceLite } from '@/lib/types';
import { fmtPrice, fmtRating } from '@/lib/format';
import { placeDetails } from '@/services/places';
import { lib } from '@/services/maps';

export function MarkerPlaceCard({ marker }: { marker: MarkerSpec }) {
  const selectMarker = useAtlas((s) => s.selectMarker);
  const [detail, setDetail] = useState<PlaceLite | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (marker.meta?.detail) {
      setDetail(marker.meta.detail as PlaceLite);
      setLoading(false);
      return;
    }
    setDetail(null);
    if (!marker.placeId) return;
    setLoading(true);
    placeDetails(marker.placeId)
      .then((p) => {
        if (!cancelled) setDetail(p);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [marker.placeId, marker.meta?.detail]);

  const name = detail?.name ?? marker.title ?? marker.label ?? 'Selected place';
  const type = detail?.primaryType ?? marker.category ?? String(marker.meta?.category ?? 'place');
  const accent = marker.color ?? 'var(--accent)';

  return (
    <AdvancedMarker
      position={marker.position}
      zIndex={30}
      clickable={true}
    >
      <article className="place-popover" style={{ '--place-accent': accent } as CSSProperties}>
        <button
          className="place-popover__close"
          onClick={(e) => {
            e.stopPropagation();
            selectMarker(null);
          }}
          aria-label="Close place details"
        >
          <X size={14} />
        </button>
        {detail?.photoUri ? (
          <img className="place-popover__photo" src={detail.photoUri} alt={name} />
        ) : (
          <div className="place-popover__photo place-popover__photo--empty">
            <MapPin size={24} />
          </div>
        )}
        <div className="place-popover__body">
          <div className="place-popover__eyebrow">Places UI Kit · {type.replace(/_/g, ' ')}</div>
          <h3>{name}</h3>
          {detail?.formattedAddress && <p className="place-popover__address">{detail.formattedAddress}</p>}
          {loading && <p className="place-popover__muted">Loading live place details…</p>}
          <div className="place-popover__facts">
            {detail?.rating != null && (
              <span>
                <Star size={12} fill="currentColor" /> {fmtRating(detail.rating, detail.userRatingCount)}
              </span>
            )}
            {detail?.priceLevel != null && <span>{fmtPrice(detail.priceLevel)}</span>}
            {detail?.openNow != null && (
              <span className={detail.openNow ? 'is-open' : 'is-closed'}>
                {detail.openNow ? 'Open now' : 'Closed'}
              </span>
            )}
          </div>
          {detail?.editorialSummary && <p className="place-popover__summary">{detail.editorialSummary}</p>}
          {marker.placeId && <PlaceUiKitMount placeId={marker.placeId} accent={accent} />}
          <div className="place-popover__actions">
            {detail?.googleMapsUri && (
              <a href={detail.googleMapsUri} target="_blank" rel="noreferrer">
                <ExternalLink size={13} /> Maps
              </a>
            )}
            {detail?.phone && (
              <a href={`tel:${detail.phone}`}>
                <Phone size={13} /> Call
              </a>
            )}
          </div>
        </div>
      </article>
    </AdvancedMarker>
  );
}

function PlaceUiKitMount({ placeId, accent }: { placeId: string; accent: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let element: HTMLElement | null = null;
    void (async () => {
      await lib('places').catch(() => undefined);
      if (disposed || !hostRef.current) return;
      const ctor = customElements.get('gmp-place-details-compact') ?? customElements.get('gmp-place-details');
      if (!ctor) return;
      element = new (ctor as CustomElementConstructor)();
      element.className = 'place-popover__ui-kit';
      element.setAttribute('orientation', 'horizontal');
      element.style.setProperty('--gmp-mat-color-primary', accent);

      const requestEl = document.createElement('gmp-place-details-place-request');
      requestEl.setAttribute('place', placeId);
      element.appendChild(requestEl);

      const contentEl = document.createElement('gmp-place-all-content');
      element.appendChild(contentEl);

      hostRef.current.replaceChildren(element);
    })();
    return () => {
      disposed = true;
      element?.remove();
      hostRef.current?.replaceChildren();
    };
  }, [accent, placeId]);

  return <div ref={hostRef} className="place-popover__ui-kit-host" aria-label="Google Places UI Kit details" />;
}
