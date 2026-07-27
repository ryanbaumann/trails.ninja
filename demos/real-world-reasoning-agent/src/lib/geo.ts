import type { LatLng } from './types';

/** Decode a Google encoded polyline into lat/lng points (no SDK dependency). */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const len = encoded.length;

  while (index < len) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat * 1e-5, lng: lng * 1e-5 });
  }
  return points;
}

const R = 6371000; // earth radius, meters
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in meters. */
export function haversine(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function midpoint(a: LatLng, b: LatLng): LatLng {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

export function boundsFromPoints(points: LatLng[]): {
  north: number;
  south: number;
  east: number;
  west: number;
} | null {
  if (!points.length) return null;
  let north = -90;
  let south = 90;
  let east = -180;
  let west = 180;
  for (const p of points) {
    north = Math.max(north, p.lat);
    south = Math.min(south, p.lat);
    east = Math.max(east, p.lng);
    west = Math.min(west, p.lng);
  }
  return { north, south, east, west };
}

/** Bearing from a→b in degrees (0 = north). Used for van heading arrows. */
export function bearing(a: LatLng, b: LatLng): number {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x =
    Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
    Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return (Math.atan2(y, x) * 180) / Math.PI;
}

/** Linear interpolation between two points (t in 0..1). */
export function lerp(a: LatLng, b: LatLng, t: number): LatLng {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

/**
 * Offset a point by a distance (meters) along a compass bearing (degrees, 0=N).
 * Small-distance equirectangular approximation — good for the sub-km reach rings
 * and geofence math used in the demos.
 */
export function offsetLatLng(origin: LatLng, bearingDeg: number, meters: number): LatLng {
  const br = rad(bearingDeg);
  const dNorth = meters * Math.cos(br);
  const dEast = meters * Math.sin(br);
  const dLat = (dNorth / R) * (180 / Math.PI);
  const dLng = (dEast / (R * Math.cos(rad(origin.lat)))) * (180 / Math.PI);
  return { lat: origin.lat + dLat, lng: origin.lng + dLng };
}

/** A regular polygon approximating a circle — used for avoid-zones / geofences. */
export function circlePolygon(center: LatLng, radiusMeters: number, steps = 48): LatLng[] {
  const path: LatLng[] = [];
  const latR = radiusMeters / R;
  const lngR = radiusMeters / (R * Math.cos(rad(center.lat)));
  for (let i = 0; i < steps; i++) {
    const theta = (i / steps) * 2 * Math.PI;
    path.push({
      lat: center.lat + (latR * Math.sin(theta) * 180) / Math.PI,
      lng: center.lng + (lngR * Math.cos(theta) * 180) / Math.PI,
    });
  }
  return path;
}
