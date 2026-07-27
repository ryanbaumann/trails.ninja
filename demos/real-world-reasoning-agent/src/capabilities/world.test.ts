import { describe, expect, it, vi } from 'vitest';
import { applyEffects, emptyHostSnapshot } from './effects';

vi.mock('@/services/places', () => ({
  searchText: vi.fn(async () => [
    { id: 'place-a', name: 'Cafe A', location: { lat: 37.79, lng: -122.4 }, rating: 4.5 },
    { id: 'place-b', name: 'Cafe B', location: { lat: 37.8, lng: -122.41 } },
  ]),
  placeDetails: vi.fn(async () => ({
    id: 'place-a',
    name: 'Cafe A',
    location: { lat: 37.79, lng: -122.4 },
    formattedAddress: '1 Main St',
  })),
}));
vi.mock('@/services/routes', () => ({
  computeRoute: vi.fn(async () => ({
    path: [{ lat: 37.79, lng: -122.4 }, { lat: 37.8, lng: -122.41 }],
    distanceMeters: 900,
    durationSeconds: 660,
  })),
}));
vi.mock('@/services/env', () => ({
  environmentSnapshot: vi.fn(async () => ({
    air: { aqi: 30, category: 'Good' },
    weather: { tempC: 14, condition: 'Cloudy' },
  })),
}));

const {
  searchPlacesCapability,
  getPlaceDetailsCapability,
  focusPlaceCapability,
  addMarkersCapability,
  drawRouteCapability,
  getEnvironmentCapability,
  WORLD_PROFILE,
} = await import('./world');

describe('world capabilities', () => {
  it('search_places returns data plus typed effects, mutating nothing itself', async () => {
    const execution = await searchPlacesCapability.execute({ query: 'cafe' });

    expect(execution.data).toMatchObject({ count: 2 });
    expect(execution.effects.map((e) => e.type)).toEqual(['map.add-markers', 'map.fit']);

    // The effects alone reproduce the map state the old handler used to write
    // into the store directly — which is what makes a run replayable.
    const host = applyEffects(emptyHostSnapshot(), execution.effects);
    expect(host.markers).toHaveLength(2);
    expect(host.markers[0]).toMatchObject({ placeId: 'place-a', label: '1', title: 'Cafe A' });
    expect(host.camera).toMatchObject({ kind: 'fit' });
  });

  it('search_places frames a single result with a fly instead of a fit', async () => {
    const places = await import('@/services/places');
    vi.mocked(places.searchText).mockResolvedValueOnce([
      { id: 'only', name: 'Solo', location: { lat: 1, lng: 2 } } as never,
    ]);
    const execution = await searchPlacesCapability.execute({ query: 'cafe' });
    expect(execution.effects.map((e) => e.type)).toEqual(['map.add-markers', 'map.fly']);
  });

  it('search_places with no results emits no map effects', async () => {
    const places = await import('@/services/places');
    vi.mocked(places.searchText).mockResolvedValueOnce([]);
    const execution = await searchPlacesCapability.execute({ query: 'nothing' });
    expect(execution.effects).toEqual([]);
    expect(execution.data).toMatchObject({ count: 0 });
  });

  it('get_place_details selects the place and frames it', async () => {
    const execution = await getPlaceDetailsCapability.execute({ placeId: 'place-a' });
    expect(execution.data).toMatchObject({ name: 'Cafe A', address: '1 Main St' });
    expect(execution.effects).toEqual([
      { type: 'map.select-place', placeId: 'place-a' },
      { type: 'map.fly', center: { lat: 37.79, lng: -122.4 }, zoom: 16.5 },
    ]);
  });

  it('focus_place emits a selection and refuses an empty placeId', async () => {
    expect((await focusPlaceCapability.execute({ placeId: 'x' })).effects)
      .toEqual([{ type: 'map.select-place', placeId: 'x' }]);

    const empty = await focusPlaceCapability.execute({});
    expect(empty.data).toMatchObject({ ok: false });
    expect(empty.effects).toEqual([]);
  });

  it('draw_route adds the polyline and fits it', async () => {
    const execution = await drawRouteCapability.execute({
      originLat: 37.79, originLng: -122.4, destLat: 37.8, destLng: -122.41, travelMode: 'WALK',
    });
    expect(execution.data).toMatchObject({ ok: true, distanceMeters: 900, durationSeconds: 660 });
    expect(execution.effects.map((e) => e.type)).toEqual(['map.add-route', 'map.fit']);

    const host = applyEffects(emptyHostSnapshot(), execution.effects);
    expect(host.routes).toHaveLength(1);
  });

  it('draw_route reports failure without emitting effects when no route exists', async () => {
    const routes = await import('@/services/routes');
    vi.mocked(routes.computeRoute).mockResolvedValueOnce(null as never);
    const execution = await drawRouteCapability.execute({
      originLat: 0, originLng: 0, destLat: 1, destLng: 1,
    });
    expect(execution.data).toMatchObject({ ok: false });
    expect(execution.effects).toEqual([]);
  });

  it('add_markers places explicit coordinates and no-ops on an empty list', async () => {
    const execution = await addMarkersCapability.execute({
      markers: [{ lat: 1, lng: 2, label: 'A' }],
    });
    const host = applyEffects(emptyHostSnapshot(), execution.effects);
    expect(host.markers).toEqual([{ position: { lat: 1, lng: 2 }, label: 'A', title: 'A', color: '#6d5ef3' }]);
    expect((await addMarkersCapability.execute({ markers: [] })).effects).toEqual([]);
  });

  it('get_environment is a read: data only, zero effects', async () => {
    const execution = await getEnvironmentCapability.execute({ lat: 37.79, lng: -122.4 });
    expect(execution.data).toMatchObject({ airQuality: { aqi: 30 }, weather: { tempC: 14 } });
    expect(execution.effects).toEqual([]);
  });

  it('declares a metered cost wherever a provider is actually called', () => {
    const metered = Object.fromEntries(
      WORLD_PROFILE.map((m) => [m.modelName, m.cost.class === 'metered-provider-call']),
    );
    expect(metered).toEqual({
      search_places: true,
      get_place_details: true,
      draw_route: true,
      get_environment: true,
      // Host-state only — no provider call, so no metered cost claim.
      focus_place: false,
      add_markers: false,
    });
  });
});
