/**
 * World capabilities — the provider-backed half of the capability set.
 *
 * These used to be hand-written `ToolDefinition`s in `ai/tools/common.ts` that
 * reached straight into the Zustand store: `search_places` fetched results AND
 * dropped markers AND moved the camera as an untyped side effect, and
 * `get_place_details` / `focus_place` / `draw_route` did the same. That made a
 * tool's map behaviour invisible to the effect reducer, impossible to replay
 * into a fixture host, and impossible to test without a live store.
 *
 * Each capability now returns `{ data, effects }` like the presentation ones, so
 * every map change in the app travels a single typed path.
 */
import type { CapabilityDefinition, EffectMarker, HostEffect } from './effects';
import type { CapabilityManifest, CapabilitySchema } from './manifest';
import { createCapabilityRegistry, resolveCapabilityProfile } from './manifest';
import { searchText, placeDetails } from '@/services/places';
import { computeRoute } from '@/services/routes';
import { environmentSnapshot } from '@/services/env';
import type { TravelMode } from '@/lib/types';

const ACCENT = '#6d5ef3';

const num = (value: unknown, fallback = 0) =>
  typeof value === 'number' ? value : Number(value) || fallback;
const str = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback);

function manifest(
  id: string,
  modelName: string,
  description: string,
  inputSchema: CapabilitySchema,
  outputSchema: CapabilitySchema,
  options: {
    metered?: boolean;
    presenterId?: string;
    sideEffect?: CapabilityManifest['sideEffect'];
  } = {},
): CapabilityManifest {
  const metered = options.metered ?? true;
  return {
    schemaVersion: '1',
    id,
    version: '1.0.0',
    modelName,
    description,
    inputSchema,
    outputSchema,
    prerequisites: [],
    providerFeatures: [],
    hostFeatures: [options.presenterId ?? 'map'],
    consent: 'none',
    approval: 'none',
    coordinateProvenance: 'user-tool-or-host',
    sideEffect: options.sideEffect ?? 'host-ui',
    reversible: false,
    idempotency: 'idempotent',
    cost: metered
      ? {
          class: 'metered-provider-call',
          note: 'Calls a Google Maps Platform API; usage is billed to the configured project.',
        }
      : {
          class: 'no-direct-provider-call',
          note: 'Reads host state only.',
        },
    latency: metered ? 'network' : 'local',
    presenter: { id: options.presenterId ?? 'map', mode: 'effects-only' },
    summarizerId: modelName,
    evalTags: ['world', modelName],
    retry: { automatic: false, maxAttempts: 0, retryableCodes: [] },
  };
}

/** Markers + a framing camera move for a set of results. */
function placementEffects(markers: EffectMarker[]): HostEffect[] {
  if (!markers.length) return [];
  const points = markers.map((m) => m.position);
  return [
    { type: 'map.add-markers', markers },
    points.length > 1
      ? { type: 'map.fit', points }
      : { type: 'map.fly', center: points[0], zoom: 15 },
  ];
}

export const searchPlacesCapability: CapabilityDefinition = {
  manifest: manifest(
    'world.places.search',
    'search_places',
    'Search real places by text (e.g. "specialty coffee near Ferry Building"). Drops numbered markers on the map and returns the results. Use before recommending anything.',
    {
      type: 'object',
      properties: {
        query: { type: 'string' },
        lat: { type: 'number', description: 'bias latitude (optional)' },
        lng: { type: 'number', description: 'bias longitude (optional)' },
        maxResults: { type: 'number' },
        openNow: { type: 'boolean' },
      },
      required: ['query'],
    },
    { type: 'object', properties: { count: { type: 'number' }, places: { type: 'array' } }, required: ['count', 'places'] },
  ),
  async execute(args) {
    const near = args.lat != null && args.lng != null
      ? { lat: num(args.lat), lng: num(args.lng) }
      : undefined;
    const results = await searchText(str(args.query), {
      near,
      maxResults: args.maxResults != null ? num(args.maxResults) : 8,
      openNow: args.openNow === true,
    });
    const markers: EffectMarker[] = results.map((place, index) => ({
      position: place.location,
      label: String(index + 1),
      title: place.name,
      color: ACCENT,
      placeId: place.id,
    }));
    return {
      data: {
        count: results.length,
        places: results.map((place, index) => ({
          index: index + 1,
          placeId: place.id,
          name: place.name,
          rating: place.rating,
          userRatingCount: place.userRatingCount,
          priceLevel: place.priceLevel,
          address: place.formattedAddress,
          type: place.primaryType,
          location: place.location,
        })),
      },
      effects: placementEffects(markers),
    };
  },
};

export const getPlaceDetailsCapability: CapabilityDefinition = {
  manifest: manifest(
    'world.places.get',
    'get_place_details',
    'Fetch rich details for one place by placeId (hours, phone, website, summary, photo).',
    { type: 'object', properties: { placeId: { type: 'string' } }, required: ['placeId'] },
    { type: 'object', properties: { name: { type: 'string' } } },
  ),
  async execute(args) {
    const place = await placeDetails(str(args.placeId));
    return {
      data: {
        name: place.name,
        rating: place.rating,
        userRatingCount: place.userRatingCount,
        priceLevel: place.priceLevel,
        address: place.formattedAddress,
        phone: place.phone,
        website: place.websiteUri,
        openNow: place.openNow,
        hours: place.regularOpeningHours,
        summary: place.editorialSummary,
        location: place.location,
      },
      effects: [
        { type: 'map.select-place', placeId: place.id },
        { type: 'map.fly', center: place.location, zoom: 16.5 },
      ],
    };
  },
};

export const focusPlaceCapability: CapabilityDefinition = {
  manifest: manifest(
    'world.places.focus',
    'focus_place',
    'Focus the map on a place already shown by placeId, opening its popup. Use when discussing a specific place. Focus is best-effort: if that place is not currently on the map, nothing moves.',
    { type: 'object', properties: { placeId: { type: 'string' } }, required: ['placeId'] },
    {
      type: 'object',
      properties: { ok: { type: 'boolean' }, focusRequested: { type: 'string' } },
      required: ['ok'],
    },
    { metered: false },
  ),
  async execute(args) {
    const placeId = str(args.placeId);
    if (!placeId) return { data: { ok: false, error: 'placeId is required' }, effects: [] };
    // A capability cannot read host state, so it must not claim the place was
    // focused — only that focus was requested. The host resolves placeId to a
    // marker and no-ops when it is not on the map.
    return {
      data: { ok: true, focusRequested: placeId },
      effects: [{ type: 'map.select-place', placeId }],
    };
  },
};

export const addMarkersCapability: CapabilityDefinition = {
  manifest: manifest(
    'world.map.add-markers',
    'add_markers',
    'Drop labeled markers on the map at explicit coordinates.',
    {
      type: 'object',
      properties: {
        markers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              lat: { type: 'number' },
              lng: { type: 'number' },
              label: { type: 'string' },
              color: { type: 'string' },
            },
            required: ['lat', 'lng'],
          },
        },
      },
      required: ['markers'],
    },
    { type: 'object', properties: { ok: { type: 'boolean' }, added: { type: 'number' } }, required: ['ok', 'added'] },
    { metered: false },
  ),
  async execute(args) {
    const list = Array.isArray(args.markers) ? (args.markers as Record<string, unknown>[]) : [];
    const markers: EffectMarker[] = list.map((marker) => ({
      position: { lat: num(marker.lat), lng: num(marker.lng) },
      ...(marker.label ? { label: String(marker.label), title: String(marker.label) } : {}),
      color: str(marker.color, ACCENT),
    }));
    return {
      data: { ok: true, added: markers.length },
      effects: markers.length ? [{ type: 'map.add-markers', markers }] : [],
    };
  },
};

export const drawRouteCapability: CapabilityDefinition = {
  manifest: manifest(
    'world.routes.compute',
    'draw_route',
    'Compute and draw a real route between two points. Returns live distance and duration.',
    {
      type: 'object',
      properties: {
        originLat: { type: 'number' },
        originLng: { type: 'number' },
        destLat: { type: 'number' },
        destLng: { type: 'number' },
        travelMode: { type: 'string', enum: ['WALK', 'DRIVE', 'BICYCLE', 'TRANSIT', 'TWO_WHEELER'] },
      },
      required: ['originLat', 'originLng', 'destLat', 'destLng'],
    },
    {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
        distanceMeters: { type: 'number' },
        durationSeconds: { type: 'number' },
      },
      required: ['ok'],
    },
  ),
  async execute(args) {
    const origin = { lat: num(args.originLat), lng: num(args.originLng) };
    const destination = { lat: num(args.destLat), lng: num(args.destLng) };
    const travelMode = (str(args.travelMode, 'DRIVE') as TravelMode) || 'DRIVE';
    const route = await computeRoute(origin, destination, { travelMode, trafficAware: true });
    if (!route) return { data: { ok: false, error: 'no route found' }, effects: [] };
    return {
      data: {
        ok: true,
        distanceMeters: route.distanceMeters,
        durationSeconds: route.durationSeconds,
      },
      effects: [
        { type: 'map.add-route', route: { path: route.path, color: '#22d3ee' } },
        ...(route.path.length ? [{ type: 'map.fit', points: route.path } as const] : []),
      ],
    };
  },
};

export const getEnvironmentCapability: CapabilityDefinition = {
  manifest: manifest(
    'world.conditions.lookup',
    'get_environment',
    'Get real air quality, current weather, pollen and solar potential for a coordinate.',
    {
      type: 'object',
      properties: { lat: { type: 'number' }, lng: { type: 'number' } },
      required: ['lat', 'lng'],
    },
    { type: 'object', properties: {} },
    { presenterId: 'conditions', sideEffect: 'none' },
  ),
  async execute(args) {
    const snapshot = await environmentSnapshot({ lat: num(args.lat), lng: num(args.lng) });
    return {
      data: {
        airQuality: snapshot.air && { aqi: snapshot.air.aqi, category: snapshot.air.category },
        weather: snapshot.weather && {
          tempC: snapshot.weather.tempC,
          condition: snapshot.weather.condition,
        },
        pollen: snapshot.pollen,
        solar: snapshot.solar && {
          yearlyEnergyKwh: Math.round(snapshot.solar.yearlyEnergyKwh),
          sunHoursPerYear: Math.round(snapshot.solar.sunshineHoursPerYear),
        },
      },
      effects: [],
    };
  },
};

export const WORLD_CAPABILITIES = [
  searchPlacesCapability,
  getPlaceDetailsCapability,
  focusPlaceCapability,
  addMarkersCapability,
  drawRouteCapability,
  getEnvironmentCapability,
] as const;

export const WORLD_PROFILE_IDS = WORLD_CAPABILITIES.map(({ manifest }) => manifest.id);
export const WORLD_CAPABILITY_REGISTRY = createCapabilityRegistry(
  WORLD_CAPABILITIES.map(({ manifest }) => manifest),
);
export const WORLD_PROFILE = resolveCapabilityProfile(WORLD_CAPABILITY_REGISTRY, WORLD_PROFILE_IDS);
