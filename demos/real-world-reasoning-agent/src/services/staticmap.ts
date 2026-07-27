import type { LatLng } from '@/lib/types';
import { MAP_ID } from '@/lib/config';

// Static Maps images load directly as <img> (no CORS). Used for share cards and
// the Cinema 2D fallback stills when WebGL is unavailable.

export interface StaticMapOpts {
  w?: number;
  h?: number;
  zoom?: number;
  markers?: LatLng[];
  path?: LatLng[];
  scale?: 1 | 2;
  /** Base map type. `satellite`/`hybrid` give an overhead aerial view (used by
   *  Scout's imagery grounding). A cloud `map_id` can't be combined with a
   *  non-roadmap `maptype`, so `map_id` is omitted for those. */
  maptype?: 'roadmap' | 'satellite' | 'hybrid';
}

export function staticMapUrl(center: LatLng, opts: StaticMapOpts = {}): string {
  const { w = 640, h = 400, zoom = 14, markers = [], path = [], scale = 2, maptype = 'roadmap' } = opts;
  const params = new URLSearchParams({
    center: `${center.lat},${center.lng}`,
    zoom: String(zoom),
    size: `${w}x${h}`,
    scale: String(scale),
  });
  if (maptype === 'roadmap') params.set('map_id', MAP_ID);
  else params.set('maptype', maptype);
  let url = `/api/real-world-reasoning-agent/gmp/staticmap/maps/api/staticmap?${params.toString()}`;
  for (const m of markers) url += `&markers=color:0x6d5ef3%7C${m.lat},${m.lng}`;
  if (path.length) {
    const enc = path.map((p) => `${p.lat},${p.lng}`).join('%7C');
    url += `&path=color:0x22d3eeff%7Cweight:4%7C${enc}`;
  }
  return url;
}
