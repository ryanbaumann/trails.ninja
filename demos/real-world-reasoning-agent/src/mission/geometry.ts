import type { LatLng } from '@/lib/types';

/**
 * Deterministic map geometry for the mission flow. These are DERIVED, clearly
 * approximate shapes (a walking-reach hull and a suggested walking route) — not
 * measured isochrones or routed polylines. Keeping them deterministic means the
 * demo path renders identically without any network call, and the "computed"
 * provenance in the UI stays honest.
 */

const EARTH_M_PER_DEG_LAT = 111_320;
/** Typical walking pace, meters per minute. */
export const WALK_METERS_PER_MIN = 80;

function metersPerDegLng(lat: number): number {
  return EARTH_M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

/** Meters of reach for a walk budget (minutes). */
export function walkReachMeters(minutes: number): number {
  return Math.max(120, minutes * WALK_METERS_PER_MIN);
}

/**
 * A closed polygon approximating how far you can walk from `center` in
 * `radiusMeters`. Slightly lobed (deterministically, seeded by the center) so it
 * reads as an organic catchment rather than a perfect circle, while never
 * pretending to be a real routed isochrone.
 */
export function reachHull(center: LatLng, radiusMeters: number, points = 28): LatLng[] {
  const mPerLng = metersPerDegLng(center.lat) || EARTH_M_PER_DEG_LAT;
  // Deterministic phase from the coordinates keeps every render identical.
  const seed = Math.abs(Math.sin(center.lat * 12.9898 + center.lng * 78.233));
  const hull: LatLng[] = [];
  for (let i = 0; i < points; i += 1) {
    const angle = (i / points) * Math.PI * 2;
    // Gentle deterministic wobble (±12%) so the catchment isn't a plain circle.
    const wobble = 1 + 0.12 * Math.sin(angle * 3 + seed * Math.PI * 2);
    const r = radiusMeters * wobble;
    hull.push({
      lat: center.lat + (r * Math.sin(angle)) / EARTH_M_PER_DEG_LAT,
      lng: center.lng + (r * Math.cos(angle)) / mPerLng,
    });
  }
  return hull;
}

/**
 * A simple, deterministic walking route from `from` to `to`: a couple of
 * street-like right-angle-ish bends rather than a straight line. Approximation
 * only — labelled as computed in the UI.
 */
export function walkRoute(from: LatLng, to: LatLng): LatLng[] {
  const mid1 = { lat: from.lat, lng: from.lng + (to.lng - from.lng) * 0.6 };
  const mid2 = { lat: from.lat + (to.lat - from.lat) * 0.6, lng: to.lng };
  return [from, mid1, mid2, to];
}

/** Stable center for an application-drawn ring; suitable for search/routing anchors. */
export function ringCenter(path: LatLng[]): LatLng | undefined {
  if (path.length < 3) return undefined;
  const sum = path.reduce((acc, point) => ({ lat: acc.lat + point.lat, lng: acc.lng + point.lng }), { lat: 0, lng: 0 });
  return { lat: sum.lat / path.length, lng: sum.lng / path.length };
}

export function pointInRing(point: LatLng, ring: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[i];
    const b = ring[j];
    const crosses = (a.lat > point.lat) !== (b.lat > point.lat)
      && point.lng < ((b.lng - a.lng) * (point.lat - a.lat)) / ((b.lat - a.lat) || Number.EPSILON) + a.lng;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function pointInConstraint(point: LatLng, outer: LatLng[], exclusions: LatLng[][] = []): boolean {
  return pointInRing(point, outer) && !exclusions.some((ring) => pointInRing(point, ring));
}
