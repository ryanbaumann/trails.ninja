import type { LatLng } from '@/lib/types';

// Geocoding is CORS-blocked from the browser (CF1) → routed through /gmp proxy,
// which injects the key server-side.

export interface GeocodeResult {
  formattedAddress: string;
  location: LatLng;
  placeId?: string;
  city?: string;
  country?: string;
}

export async function geocode(address: string): Promise<GeocodeResult | null> {
  const res = await fetch(`/api/real-world-reasoning-agent/gmp/geocode/json?address=${encodeURIComponent(address)}`);
  const data = await res.json();
  const r = data.results?.[0];
  if (!r) return null;
  const city = r.address_components?.find((c: any) => c.types.includes('locality'))?.long_name;
  const country = r.address_components?.find((c: any) => c.types.includes('country'))?.short_name;
  return {
    formattedAddress: r.formatted_address,
    location: { lat: r.geometry.location.lat, lng: r.geometry.location.lng },
    placeId: r.place_id,
    city,
    country,
  };
}

export async function reverseGeocode(loc: LatLng): Promise<GeocodeResult | null> {
  const res = await fetch(`/api/real-world-reasoning-agent/gmp/geocode/json?latlng=${loc.lat},${loc.lng}`);
  const data = await res.json();
  const r = data.results?.[0];
  if (!r) return null;
  const city = r.address_components?.find((c: any) => c.types.includes('locality'))?.long_name;
  const country = r.address_components?.find((c: any) => c.types.includes('country'))?.short_name;
  return {
    formattedAddress: r.formatted_address,
    location: { lat: r.geometry.location.lat, lng: r.geometry.location.lng },
    placeId: r.place_id,
    city,
    country,
  };
}
