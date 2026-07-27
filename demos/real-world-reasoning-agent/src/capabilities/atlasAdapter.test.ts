import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAtlas } from '@/state/store';
import type { CapabilityDefinition, CapabilityExecution } from './effects';
import { applyAtlasEffects, capabilityTool, PRESENTATION_TOOLS_BY_ID } from './atlasAdapter';
import { flyToCapability } from './presentation';

beforeEach(() => {
  useAtlas.setState({
    activeScenario: 'scout',
    mapMode: '2d',
    cameraIntent: null,
    markers: [],
    routes: [],
    polygons: [],
    tileOverlay: null,
    selectedMarkerId: null,
    transcript: [],
  });
});

describe('Atlas capability adapter', () => {
  it('projects generated presentation effects into the existing host store', async () => {
    const fly = PRESENTATION_TOOLS_BY_ID.get('fly_to');
    const notice = PRESENTATION_TOOLS_BY_ID.get('show_notice');
    if (!fly || !notice) throw new Error('missing generated presentation tools');

    await fly.handler({ lat: 1, lng: 2, zoom: 12 });
    applyAtlasEffects([{
      type: 'map.add-markers',
      markers: [{ position: { lat: 1, lng: 2 }, label: 'A' }],
    }]);
    await notice.handler({ title: 'Heads up', body: 'Synthetic.' });

    expect(useAtlas.getState().cameraIntent).toMatchObject({
      kind: 'fly', center: { lat: 1, lng: 2 }, zoom: 12,
    });
    expect(useAtlas.getState().markers).toHaveLength(1);
    expect(useAtlas.getState().markers[0]).toMatchObject({ glyph: 'A', scenario: 'scout' });
    expect(useAtlas.getState().transcript[0]).toMatchObject({
      role: 'notice', notice: { title: 'Heads up', body: 'Synthetic.' },
    });
  });

  it('generates the declaration directly from the manifest', () => {
    const tool = PRESENTATION_TOOLS_BY_ID.get('fly_to');
    expect(tool?.declaration).toMatchObject({
      name: flyToCapability.manifest.modelName,
      description: flyToCapability.manifest.description,
      parametersJsonSchema: flyToCapability.manifest.inputSchema,
      responseJsonSchema: flyToCapability.manifest.outputSchema,
    });
  });

  it('applies no effects when a delayed execution is aborted', async () => {
    let finish: (execution: CapabilityExecution<{ ok: true }>) => void = () => {};
    const delayed: CapabilityDefinition<{ ok: true }> = {
      manifest: flyToCapability.manifest,
      execute: () => new Promise((resolve) => { finish = resolve; }),
    };
    const sink = vi.fn();
    const tool = capabilityTool(delayed, sink);
    const controller = new AbortController();
    const pending = tool.handler({}, controller.signal);
    controller.abort();
    finish({ data: { ok: true }, effects: [{ type: 'map.clear' }] });

    await expect(pending).resolves.toEqual({ ok: false, error: 'cancelled' });
    expect(sink).not.toHaveBeenCalled();
  });

  it('normalizes an executor cancellation rejection', async () => {
    const cancelled: CapabilityDefinition<{ ok: true }> = {
      manifest: flyToCapability.manifest,
      execute: (_args, context) => new Promise((_resolve, reject) => {
        context?.cancellation?.subscribe?.(() => reject({ name: 'AbortError' }));
      }),
    };
    const sink = vi.fn();
    const tool = capabilityTool(cancelled, sink);
    const controller = new AbortController();
    const pending = tool.handler({}, controller.signal);
    controller.abort();

    await expect(pending).resolves.toEqual({ ok: false, error: 'cancelled' });
    expect(sink).not.toHaveBeenCalled();
  });
});
