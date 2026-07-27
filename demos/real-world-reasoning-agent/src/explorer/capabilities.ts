import { createCapabilityRegistry, resolveCapabilityProfile, type CapabilityManifest } from '@/capabilities/manifest';

const manifest = (
  id: string,
  modelName: string,
  sideEffect: CapabilityManifest['sideEffect'],
  costClass: CapabilityManifest['cost']['class'],
  prerequisites: string[] = [],
): CapabilityManifest => ({
  schemaVersion: '1', id, version: '1', modelName,
  description: `Universal explorer capability: ${modelName}.`,
  inputSchema: { type: 'object', properties: {} },
  outputSchema: { type: 'object', properties: {} },
  prerequisites,
  providerFeatures: sideEffect === 'none' ? [modelName] : [],
  hostFeatures: sideEffect === 'host-ui' ? [modelName] : [],
  consent: 'location', approval: 'none', coordinateProvenance: 'user-tool-or-host',
  sideEffect, reversible: sideEffect === 'host-ui', idempotency: 'idempotent',
  cost: { class: costClass, note: costClass === 'metered-provider-call' ? 'Bounded provider request.' : 'Local presentation.' },
  latency: sideEffect === 'none' ? 'network' : 'local',
  presenter: { id: sideEffect === 'host-ui' ? 'explorer' : 'none', mode: sideEffect === 'host-ui' ? 'surface' : 'effects-only' },
  summarizerId: modelName, evalTags: ['universal-explorer'],
  retry: { automatic: false, maxAttempts: 0, retryableCodes: [] },
});

export const EXPLORER_CAPABILITY_MANIFESTS = [
  manifest('world.grounding.places.search@1', 'search_grounded_places', 'none', 'metered-provider-call'),
  manifest('world.grounding.routes.compute@1', 'compute_grounded_route', 'none', 'metered-provider-call', ['world.grounding.places.search@1']),
  manifest('world.grounding.weather.lookup@1', 'lookup_grounded_weather', 'none', 'metered-provider-call', ['world.grounding.places.search@1']),
  manifest('world.routes.display@1', 'display_route', 'host-ui', 'metered-provider-call'),
  manifest('world.presentation.explorer@1', 'present_explorer', 'host-ui', 'no-direct-provider-call'),
] as const;

const registry = createCapabilityRegistry(EXPLORER_CAPABILITY_MANIFESTS);

export function explorerCapabilityProfile(includeDisplayRoute: boolean, includeWeather: boolean): string[] {
  return resolveCapabilityProfile(registry, [
    'world.grounding.routes.compute@1',
    ...(includeWeather ? ['world.grounding.weather.lookup@1'] : []),
    ...(includeDisplayRoute ? ['world.routes.display@1'] : []),
    'world.presentation.explorer@1',
  ]).map((item) => item.id);
}
