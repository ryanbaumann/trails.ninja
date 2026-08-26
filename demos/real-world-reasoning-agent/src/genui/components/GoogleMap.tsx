/**
 * GoogleMap — official Maps Agentic UI Toolkit (MAUI) component for interactive
 * map cards. Supports center, zoom, anchorMarker, markers, routes, and mode,
 * rendering a high-fidelity static preview that flies the live map camera on tap.
 */
import { useState, type FC } from 'react';
import type { ComponentNode, Dynamic } from '../protocol';
import { resolveDisplayText, resolveDynamic } from '../protocol';
import type { SurfaceState } from '../store';
import { staticMapUrl } from '@/services/staticmap';
import { dispatchSurfaceAction } from '../actions';
import { buildAction } from './actionHelpers';
import { MediaError } from './MediaState';

interface LatLngLite {
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
}

function extractLatLng(obj: unknown): { lat: number; lng: number } | null {
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as LatLngLite;
  const lat = typeof o.lat === 'number' ? o.lat : typeof o.latitude === 'number' ? o.latitude : null;
  const lng = typeof o.lng === 'number' ? o.lng : typeof o.longitude === 'number' ? o.longitude : null;
  if (lat === null || lng === null) return null;
  return { lat, lng };
}

export const GoogleMap: FC<{ node: ComponentNode; surface: SurfaceState; scope?: string }> = ({
  node,
  surface,
  scope,
}) => {
  const centerRaw = resolveDynamic(node.center as Dynamic<unknown> | undefined, surface.dataModel, scope);
  const latRaw = resolveDynamic(node.lat as Dynamic<number> | undefined, surface.dataModel, scope);
  const lngRaw = resolveDynamic(node.lng as Dynamic<number> | undefined, surface.dataModel, scope);
  const zoomRaw = resolveDynamic(node.zoom as Dynamic<number> | undefined, surface.dataModel, scope);
  const label = resolveDisplayText(node.label as Dynamic<unknown> | undefined, surface.dataModel, scope);
  const anchorRaw = resolveDynamic(node.anchorMarker as Dynamic<unknown> | undefined, surface.dataModel, scope);
  const markersRaw = resolveDynamic(node.markers as Dynamic<unknown[]> | undefined, surface.dataModel, scope);

  const center =
    extractLatLng(centerRaw) ??
    (typeof latRaw === 'number' && typeof lngRaw === 'number' ? { lat: latRaw, lng: lngRaw } : null);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  if (!center) return null;

  const markers: Array<{ lat: number; lng: number }> = [];
  const anchor = extractLatLng(anchorRaw);
  if (anchor) markers.push(anchor);

  if (Array.isArray(markersRaw)) {
    for (const m of markersRaw) {
      const pos = extractLatLng(m);
      if (pos) markers.push(pos);
    }
  }

  if (markers.length === 0) {
    markers.push(center);
  }

  const zoomNum = typeof zoomRaw === 'number' ? zoomRaw : 13;
  const url = staticMapUrl(center, { zoom: zoomNum, markers, w: 480, h: 260 });

  if (failed) {
    return (
      <MediaError
        className="genui-mappreview--error"
        label="Couldn't load the map viewport."
        onRetry={() => {
          setFailed(false);
          setReloadKey((k) => k + 1);
        }}
      />
    );
  }

  const onClick = () => {
    dispatchSurfaceAction(
      buildAction('fly_to', surface, node.id, { lat: center.lat, lng: center.lng, zoom: zoomNum + 1 }),
    );
  };

  return (
    <button
      type="button"
      className="genui-mappreview"
      onClick={onClick}
      aria-label={label ? `Fly to ${label}` : 'Fly to map location'}
    >
      <img key={reloadKey} src={url} alt={label || 'Google Map viewport'} loading="lazy" onError={() => setFailed(true)} />
      {label ? <span className="genui-mappreview__label">{label}</span> : null}
    </button>
  );
};
