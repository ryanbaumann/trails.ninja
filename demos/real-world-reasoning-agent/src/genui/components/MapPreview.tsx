/**
 * MapPreview — a static map thumbnail (Atlas's answer to MAUI's inline
 * live GoogleMap; we never mount a second live map inside the chat dock).
 * Tapping it flies the real map camera to the location via the built-in
 * `fly_to` action.
 */
import { useState, type FC } from 'react';
import type { ComponentNode, Dynamic } from '../protocol';
import { resolveDisplayText, resolveDynamic } from '../protocol';
import type { SurfaceState } from '../store';
import { staticMapUrl } from '@/services/staticmap';
import { dispatchSurfaceAction } from '../actions';
import { buildAction } from './actionHelpers';
import { MediaError } from './MediaState';

interface MarkerLite {
  lat: number;
  lng: number;
}

function isMarkerLite(m: unknown): m is MarkerLite {
  return !!m && typeof (m as MarkerLite).lat === 'number' && typeof (m as MarkerLite).lng === 'number';
}

export const MapPreview: FC<{ node: ComponentNode; surface: SurfaceState; scope?: string }> = ({
  node,
  surface,
  scope,
}) => {
  const lat = resolveDynamic(node.lat as Dynamic<number> | undefined, surface.dataModel, scope);
  const lng = resolveDynamic(node.lng as Dynamic<number> | undefined, surface.dataModel, scope);
  const zoom = resolveDynamic(node.zoom as Dynamic<number> | undefined, surface.dataModel, scope);
  // Route the human-visible label through resolveDisplayText so {path} tokens
  // interpolate and unresolved ones are dropped (lat/lng/zoom stay numeric).
  const label = resolveDisplayText(node.label as Dynamic<unknown> | undefined, surface.dataModel, scope);
  const markersRaw = resolveDynamic(node.markers as Dynamic<MarkerLite[]> | undefined, surface.dataModel, scope);

  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  const markers = Array.isArray(markersRaw) && markersRaw.filter(isMarkerLite).length
    ? markersRaw.filter(isMarkerLite)
    : [{ lat, lng }];
  const zoomNum = typeof zoom === 'number' ? zoom : 14;
  const url = staticMapUrl({ lat, lng }, { zoom: zoomNum, markers, w: 480, h: 260 });

  if (failed) {
    return (
      <MediaError
        className="genui-mappreview--error"
        label="Couldn't load the map preview."
        onRetry={() => {
          setFailed(false);
          setReloadKey((k) => k + 1);
        }}
      />
    );
  }

  const onClick = () => {
    dispatchSurfaceAction(buildAction('fly_to', surface, node.id, { lat, lng, zoom: zoomNum + 1 }));
  };

  return (
    <button type="button" className="genui-mappreview" onClick={onClick} aria-label={label ? `Fly to ${label}` : 'Fly to location'}>
      <img key={reloadKey} src={url} alt={label || 'Map preview'} loading="lazy" onError={() => setFailed(true)} />
      {label ? <span className="genui-mappreview__label">{label}</span> : null}
    </button>
  );
};
