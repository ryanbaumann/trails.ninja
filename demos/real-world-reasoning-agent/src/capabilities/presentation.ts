import type { CapabilityDefinition } from './effects';
import {
  createCapabilityRegistry,
  resolveCapabilityProfile,
  type CapabilityManifest,
  type CapabilitySchema,
} from './manifest';

const num = (value: unknown, fallback = 0) =>
  typeof value === 'number' ? value : Number(value) || fallback;
const str = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback;

const manifest = (
  id: string,
  modelName: string,
  description: string,
  inputSchema: CapabilitySchema,
  outputSchema: CapabilitySchema,
  presenterId: string,
  coordinateProvenance: CapabilityManifest['coordinateProvenance'] = 'not-applicable',
): CapabilityManifest => ({
  schemaVersion: '1',
  id,
  version: '1.0.0',
  modelName,
  description,
  inputSchema,
  outputSchema,
  prerequisites: [],
  providerFeatures: [],
  hostFeatures: [presenterId],
  consent: 'none',
  approval: 'none',
  coordinateProvenance,
  sideEffect: 'host-ui',
  reversible: false,
  idempotency: modelName === 'show_notice' ? 'per-invocation' : 'idempotent',
  cost: {
    class: 'no-direct-provider-call',
    note: 'This local capability makes no provider call; host map rendering may still be metered.',
  },
  latency: 'local',
  presenter: { id: presenterId, mode: 'effects-only' },
  summarizerId: modelName,
  evalTags: ['presentation', modelName],
  retry: { automatic: false, maxAttempts: 0, retryableCodes: [] },
});

export const flyToCapability: CapabilityDefinition<{ ok: true; movedTo: unknown }> = {
  manifest: manifest(
    'host.map.fly',
    'fly_to',
    'Move the map camera to a location. Works in both 2D and 3D. Use after finding a place, or when the user names a city/landmark.',
    {
      type: 'object',
      properties: {
        lat: { type: 'number' },
        lng: { type: 'number' },
        zoom: { type: 'number', description: '2D zoom 3-20 (default 15)' },
        heading: { type: 'number' },
        tilt: { type: 'number' },
        label: { type: 'string', description: 'optional short name of the target' },
      },
      required: ['lat', 'lng'],
    },
    { type: 'object', properties: { ok: { type: 'boolean' }, movedTo: {} }, required: ['ok', 'movedTo'] },
    'map',
  ),
  async execute(args) {
    const center = { lat: num(args.lat), lng: num(args.lng) };
    return {
      data: { ok: true, movedTo: args.label ?? center },
      effects: [{
        type: 'map.fly',
        center,
        ...(args.zoom == null ? {} : { zoom: num(args.zoom) }),
        ...(args.heading == null ? {} : { heading: num(args.heading) }),
        ...(args.tilt == null ? {} : { tilt: num(args.tilt) }),
      }],
    };
  },
};

export const clearMapCapability: CapabilityDefinition<{ ok: true }> = {
  manifest: manifest(
    'host.map.clear',
    'clear_map',
    'Remove all markers, routes and overlays from the map.',
    { type: 'object', properties: {} },
    { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
    'map',
  ),
  execute: async () => ({ data: { ok: true }, effects: [{ type: 'map.clear' }] }),
};

export const showNoticeCapability: CapabilityDefinition<{ ok: true }> = {
  manifest: manifest(
    'host.notice.show',
    'show_notice',
    'Surface a titled card to the user in the chat (a tip, summary or heads-up).',
    {
      type: 'object',
      properties: { title: { type: 'string' }, body: { type: 'string' } },
      required: ['title', 'body'],
    },
    { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
    'notice',
  ),
  async execute(args) {
    return {
      data: { ok: true },
      effects: [{ type: 'chat.notice', title: str(args.title), body: str(args.body) }],
    };
  },
};

export const PRESENTATION_CAPABILITIES = [
  flyToCapability,
  clearMapCapability,
  showNoticeCapability,
] as const;

export const PRESENTATION_PROFILE_IDS = PRESENTATION_CAPABILITIES.map(({ manifest }) => manifest.id);
export const PRESENTATION_CAPABILITY_REGISTRY = createCapabilityRegistry(
  PRESENTATION_CAPABILITIES.map(({ manifest }) => manifest),
);
export const PRESENTATION_PROFILE = resolveCapabilityProfile(
  PRESENTATION_CAPABILITY_REGISTRY,
  PRESENTATION_PROFILE_IDS,
);
