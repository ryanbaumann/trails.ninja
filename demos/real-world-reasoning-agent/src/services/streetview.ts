import type { LatLng } from '@/lib/types';


// Street View Static images load directly as <img> (no CORS). Metadata check is
// a lightweight JSON call to confirm a pano exists before showing a hero image.

export function streetViewUrl(loc: LatLng, opts: { w?: number; h?: number; fov?: number } = {}): string {
  const { w = 800, h = 420, fov = 80 } = opts;
  return (
    `/api/real-world-reasoning-agent/gmp/streetview/maps/api/streetview?size=${w}x${h}` +
    `&location=${loc.lat},${loc.lng}&fov=${fov}&source=outdoor`
  );
}

// Shared heading-aware variant of `streetViewUrl`. Same `/api/real-world-reasoning-agent/gmp/streetview` proxy
// path/params, plus a rounded `&heading=` so callers (Scout evidence frames,
// Cinema seed stills) can request a specific facing. Defaults tuned for the
// evidence-frame use case (640x400, fov 80).
export function streetViewHeadingUrl(
  loc: LatLng,
  heading: number,
  opts: { w?: number; h?: number; fov?: number } = {},
): string {
  const { w = 640, h = 400, fov = 80 } = opts;
  return (
    `/api/real-world-reasoning-agent/gmp/streetview/maps/api/streetview?size=${w}x${h}` +
    `&location=${loc.lat},${loc.lng}&heading=${Math.round(heading)}&fov=${fov}&source=outdoor`
  );
}

export async function hasStreetView(loc: LatLng, signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch(
      `/api/real-world-reasoning-agent/gmp/streetview/maps/api/streetview/metadata?location=${loc.lat},${loc.lng}&source=outdoor`,
      signal ? { signal } : undefined,
    );
    const d = await res.json();
    return d.status === 'OK';
  } catch {
    return false;
  }
}
