import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  capabilityDeclaration,
  createCapabilityRegistry,
  resolveCapabilityProfile,
  type CapabilityManifest,
} from './manifest';
import { applyEffects, emptyHostSnapshot } from './effects';
import {
  clearMapCapability,
  flyToCapability,
  showNoticeCapability,
  PRESENTATION_PROFILE,
} from './presentation';

const manifest = (id: string, prerequisites: string[] = []): CapabilityManifest => ({
  schemaVersion: '1',
  id,
  version: '1.0.0',
  modelName: id,
  description: `${id} description`,
  inputSchema: { type: 'object', properties: {} },
  outputSchema: { type: 'object', properties: {} },
  prerequisites,
  providerFeatures: [],
  hostFeatures: [],
  consent: 'none',
  approval: 'none',
  coordinateProvenance: 'not-applicable',
  sideEffect: 'host-ui',
  reversible: true,
  idempotency: 'idempotent',
  cost: { class: 'no-direct-provider-call', note: 'test' },
  latency: 'local',
  presenter: { id: 'map', mode: 'effects-only' },
  summarizerId: id,
  evalTags: ['test'],
  retry: { automatic: false, maxAttempts: 0, retryableCodes: [] },
});

describe('capability manifests', () => {
  it('generates a schema-equivalent Gemini declaration', () => {
    const source: CapabilityManifest = {
      ...manifest('fly_to'),
      inputSchema: {
        type: 'object',
        properties: { lat: { type: 'number' }, lng: { type: 'number' } },
        required: ['lat', 'lng'],
      },
    };
    expect(capabilityDeclaration(source)).toEqual({
      name: 'fly_to',
      description: 'fly_to description',
      parametersJsonSchema: source.inputSchema,
      responseJsonSchema: source.outputSchema,
    });
  });

  it('resolves minimal prerequisite profiles deterministically', () => {
    const registry = new Map([
      ['present', manifest('present', ['fetch'])],
      ['fetch', manifest('fetch', ['locate'])],
      ['locate', manifest('locate')],
      ['unrelated', manifest('unrelated')],
    ]);
    expect(resolveCapabilityProfile(registry, ['present']).map((item) => item.id))
      .toEqual(['locate', 'fetch', 'present']);
    expect(() => resolveCapabilityProfile(registry, ['missing'])).toThrow(/unknown capability/i);
  });

  it('rejects duplicate registrations and prerequisite cycles', () => {
    expect(() => createCapabilityRegistry([manifest('same'), manifest('same')])).toThrow(/duplicate capability id/i);
    expect(() => createCapabilityRegistry([
      manifest('first'),
      { ...manifest('second'), modelName: 'first' },
    ])).toThrow(/duplicate capability model name/i);
    const cycle = new Map([
      ['a', manifest('a', ['b'])],
      ['b', manifest('b', ['a'])],
    ]);
    expect(() => resolveCapabilityProfile(cycle, ['a'])).toThrow(/cycle/i);
  });

  it('exports the real minimal presentation profile in stable order', () => {
    expect(PRESENTATION_PROFILE.map(({ modelName }) => modelName))
      .toEqual(['fly_to', 'clear_map', 'show_notice']);
  });

  it('keeps manifests JSON-safe and pure executors free of host/model imports', () => {
    for (const item of PRESENTATION_PROFILE) {
      expect(JSON.parse(JSON.stringify(item))).toEqual(item);
    }
    const source = readFileSync(new URL('./presentation.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/zustand|state\/store|@google\/genai|\bgoogle\.maps\b|React/);
  });
});

describe('presentation capabilities', () => {
  it('return typed effects without mutating a host', async () => {
    const fly = await flyToCapability.execute({ lat: 1, lng: 2, label: 'Target' });
    const notice = await showNoticeCapability.execute({ title: 'Heads up', body: 'Synthetic.' });
    const clear = await clearMapCapability.execute({});

    expect(fly).toMatchObject({ data: { ok: true, movedTo: 'Target' }, effects: [{ type: 'map.fly' }] });
    expect(notice).toMatchObject({ data: { ok: true }, effects: [{ type: 'chat.notice' }] });
    expect(clear).toMatchObject({ data: { ok: true }, effects: [{ type: 'map.clear' }] });
  });

  it('replays the same effects into deterministic fixture hosts', async () => {
    const flyRun = await flyToCapability.execute({ lat: 1, lng: 2, zoom: 12 });
    const effects = [
      { type: 'map.add-markers' as const, markers: [{ position: { lat: 1, lng: 2 }, label: 'A' }] },
      ...flyRun.effects,
    ];
    expect(JSON.parse(JSON.stringify(effects))).toEqual(effects);

    const first = applyEffects(emptyHostSnapshot('2d'), effects);
    const second = applyEffects(emptyHostSnapshot('2d'), effects);
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      markers: [{ position: { lat: 1, lng: 2 }, label: 'A' }],
      camera: { kind: 'fly', center: { lat: 1, lng: 2 }, zoom: 12 },
    });
  });

  it('replaces explorer markers and route without retaining stale presentation state', () => {
    const result = applyEffects(emptyHostSnapshot(), [
      { type: 'map.replace-markers', scope: 'explorer', markers: [{ position: { lat: 1, lng: 2 }, label: '1' }] },
      { type: 'map.replace-route', scope: 'explorer', route: { path: [{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }] } },
      { type: 'map.replace-markers', scope: 'explorer', markers: [{ position: { lat: 5, lng: 6 }, label: '1' }] },
      { type: 'map.replace-route', scope: 'explorer', route: null },
      { type: 'map.fit', points: [{ lat: 5, lng: 6 }] },
    ]);
    expect(result.markers).toEqual([{ position: { lat: 5, lng: 6 }, label: '1' }]);
    expect(result.routes).toEqual([]);
    expect(result.camera).toEqual({ kind: 'fit', bounds: [{ lat: 5, lng: 6 }] });
  });

  it('projects 3D camera semantics and fully clears map decorations', async () => {
    const fly = await flyToCapability.execute({ lat: 1, lng: 2 });
    const clear = await clearMapCapability.execute({});
    const initial = {
      ...emptyHostSnapshot('3d'),
      markers: [{ position: { lat: 0, lng: 0 } }],
      routes: [{}],
      polygons: [{}],
      tileOverlay: 'aqi' as const,
      selectedMarkerId: 'm1',
    };
    const result = applyEffects(initial, [...fly.effects, ...clear.effects]);
    expect(result.camera).toMatchObject({ kind: 'fly3d', range: 1400, tilt: 60, heading: 0 });
    expect(result).toMatchObject({
      markers: [], routes: [], polygons: [], tileOverlay: null, selectedMarkerId: null,
    });
  });
});
