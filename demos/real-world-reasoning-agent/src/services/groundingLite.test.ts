import { afterEach, describe, expect, it, vi } from 'vitest';
import { groundingLiteProvider, parseMcpEnvelope } from './groundingLite';

const source = { title: 'Source title', url: 'https://maps.google.com/source' };

afterEach(() => vi.unstubAllGlobals());

describe('Maps Grounding Lite MCP adapter', () => {
  it('parses JSON and event-stream MCP envelopes', () => {
    const body = { result: { structuredContent: { routes: [] } } };
    expect(parseMcpEnvelope(JSON.stringify(body))).toEqual({ routes: [] });
    expect(parseMcpEnvelope(`event: message\ndata: ${JSON.stringify(body)}\n\n`)).toEqual({ routes: [] });
  });

  it('throws on upstream isError responses', () => {
    const body = { id: 1, jsonrpc: '2.0', result: { content: [{ text: 'Requests from referer <empty> are blocked.', type: 'text' }], isError: true } };
    expect(() => parseMcpEnvelope(JSON.stringify(body))).toThrow('Requests from referer <empty> are blocked.');
  });

  it('normalizes search places only when coordinates, place URL, and attribution are present', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ result: { structuredContent: {
      summary: 'Try **Blue Bottle Coffee** [0] or **Sightglass Coffee** [1].',
      places: [
        { id: 'p1', location: { latitude: 1, longitude: 2 }, googleMapsLinks: { placeUrl: 'https://maps.google.com/p1' }, attribution: source },
        { id: 'p2', location: { latitude: 5, longitude: 6 }, googleMapsLinks: { placeUrl: 'https://maps.google.com/p2' }, attribution: source },
        { id: 'missing-source', location: { latitude: 3, longitude: 4 }, googleMapsLinks: { placeUrl: 'https://maps.google.com/p2' } },
      ],
    } } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(groundingLiteProvider.searchPlaces({ query: 'coffee', near: { lat: 1, lng: 2 } })).resolves.toEqual({
      status: 'success',
      value: [
        { id: 'p1', label: 'Blue Bottle Coffee', location: { lat: 1, lng: 2 }, placeUrl: 'https://maps.google.com/p1', attribution: source },
        { id: 'p2', label: 'Sightglass Coffee', location: { lat: 5, lng: 6 }, placeUrl: 'https://maps.google.com/p2', attribution: source },
      ],
      summary: 'Try **Blue Bottle Coffee** [0] or **Sightglass Coffee** [1].',
    });
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.params.arguments).toEqual({
      text_query: 'coffee',
      location_bias: { circle: { center: { latitude: 1, longitude: 2 }, radius_meters: 8000 } },
      language_code: 'en',
    });
  });

  it('uses the official route fields and fails closed without required attribution', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: { structuredContent: { routes: [{ distanceMeters: 750, duration: '540s', attribution: source }] } } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: { structuredContent: { routes: [{ distanceMeters: 750, duration: '540s' }] } } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(groundingLiteProvider.computeRoute({ origin: { lat: 1, lng: 2 }, destinationPlaceId: 'p1', travelMode: 'WALK' })).resolves.toMatchObject({
      status: 'success', value: { durationSeconds: 540, distanceMeters: 750 },
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)).params.arguments).toEqual({
      origin: { lat_lng: { latitude: 1, longitude: 2 } }, destination: { place_id: 'p1' }, travel_mode: 'WALK',
    });
    await expect(groundingLiteProvider.computeRoute({ origin: { lat: 1, lng: 2 }, destinationPlaceId: 'p1', travelMode: 'WALK' })).resolves.toEqual({ status: 'empty' });
  });
});
