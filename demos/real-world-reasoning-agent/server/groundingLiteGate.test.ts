import { describe, expect, it } from 'vitest';
// @ts-expect-error JavaScript server guard intentionally has no declaration file.
import { validateGroundingLiteCall } from './groundingLiteGate.mjs';

const call = (name: string, args: unknown) => ({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });

describe('Grounding Lite proxy argument gate', () => {
  it('accepts only bounded arguments for the three explorer tools', () => {
    expect(validateGroundingLiteCall(call('search_places', { text_query: 'coffee', location_bias: { circle: { center: { latitude: 1, longitude: 2 }, radius_meters: 8000 } }, language_code: 'en', region_code: 'US' }))).toBe(true);
    expect(validateGroundingLiteCall(call('compute_routes', { origin: { lat_lng: { latitude: 1, longitude: 2 } }, destination: { place_id: 'p1' }, travel_mode: 'WALK' }))).toBe(true);
    expect(validateGroundingLiteCall(call('lookup_weather', { location: { place_id: 'p1' }, units_system: 'METRIC' }))).toBe(true);
  });

  it('rejects unknown keys, unbounded coordinates, and unsupported tools or modes', () => {
    expect(validateGroundingLiteCall(call('search_places', { text_query: 'coffee', unexpected: true }))).toBe(false);
    expect(validateGroundingLiteCall(call('compute_routes', { origin: { lat_lng: { latitude: 91, longitude: 2 } }, destination: { place_id: 'p1' }, travel_mode: 'TRANSIT' }))).toBe(false);
    expect(validateGroundingLiteCall(call('delete_everything', {}))).toBe(false);
  });
});
