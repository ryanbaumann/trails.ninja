/** Pure, provider- and model-SDK-neutral capability metadata. */
export interface CapabilitySchema {
  type?: string;
  description?: string;
  properties?: Record<string, CapabilitySchema>;
  items?: CapabilitySchema;
  required?: string[];
  enum?: Array<string | number | boolean>;
}

export interface CapabilityManifest {
  schemaVersion: '1';
  id: string;
  version: string;
  modelName: string;
  description: string;
  inputSchema: CapabilitySchema;
  outputSchema: CapabilitySchema;
  prerequisites: string[];
  providerFeatures: string[];
  hostFeatures: string[];
  consent: 'none' | 'location' | 'media' | 'external-write';
  approval: 'none' | 'confirm';
  coordinateProvenance: 'not-applicable' | 'user-tool-or-host';
  sideEffect: 'none' | 'host-ui' | 'external-write';
  reversible: boolean;
  idempotency: 'idempotent' | 'per-invocation';
  cost: { class: 'no-direct-provider-call' | 'metered-provider-call'; note: string };
  latency: 'local' | 'network';
  presenter: { id: string; mode: 'effects-only' | 'surface' };
  summarizerId: string;
  evalTags: string[];
  retry: { automatic: boolean; maxAttempts: number; retryableCodes: string[] };
}

export interface CapabilityDeclaration {
  name: string;
  description: string;
  parametersJsonSchema: CapabilitySchema;
  responseJsonSchema?: CapabilitySchema;
}

export function capabilityDeclaration(manifest: CapabilityManifest): CapabilityDeclaration {
  return {
    name: manifest.modelName,
    description: manifest.description,
    parametersJsonSchema: manifest.inputSchema,
    responseJsonSchema: manifest.outputSchema,
  };
}

export function createCapabilityRegistry(
  manifests: readonly CapabilityManifest[],
): ReadonlyMap<string, CapabilityManifest> {
  const registry = new Map<string, CapabilityManifest>();
  const modelNames = new Set<string>();
  for (const manifest of manifests) {
    if (registry.has(manifest.id)) throw new Error(`Duplicate capability id: ${manifest.id}`);
    if (modelNames.has(manifest.modelName)) {
      throw new Error(`Duplicate capability model name: ${manifest.modelName}`);
    }
    registry.set(manifest.id, manifest);
    modelNames.add(manifest.modelName);
  }
  return registry;
}

/** Resolve only requested capabilities and their prerequisites in stable dependency order. */
export function resolveCapabilityProfile(
  registry: ReadonlyMap<string, CapabilityManifest>,
  requestedIds: readonly string[],
): CapabilityManifest[] {
  const resolved: CapabilityManifest[] = [];
  const complete = new Set<string>();
  const visiting = new Set<string>();

  const visit = (id: string) => {
    if (complete.has(id)) return;
    const manifest = registry.get(id);
    if (!manifest) throw new Error(`Unknown capability: ${id}`);
    if (visiting.has(id)) throw new Error(`Capability prerequisite cycle at: ${id}`);
    visiting.add(id);
    for (const prerequisite of manifest.prerequisites) visit(prerequisite);
    visiting.delete(id);
    complete.add(id);
    resolved.push(manifest);
  };

  for (const id of requestedIds) visit(id);
  return resolved;
}
