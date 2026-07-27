import { describe, expect, it } from 'vitest';
import { buildWalkthroughVideoSurface } from './walkthroughSurface';
import { ATLAS_CATALOG_ID, type CreateSurfaceMsg, type UpdateComponentsMsg } from '@/genui/protocol';

describe('buildWalkthroughVideoSurface', () => {
  it('emits a rooted surface with a Video node bound to the ref', () => {
    const { surfaceId, messages } = buildWalkthroughVideoSurface({ label: 'Branch', videoRef: 'img:vid1' });
    expect(surfaceId).toMatch(/^scout-walkthrough-/);

    const compMsg = messages.find((m): m is UpdateComponentsMsg => 'updateComponents' in m)!;
    const components = compMsg.updateComponents.components;
    expect(components.find((c) => c.id === 'root')).toBeDefined();

    const video = components.find((c) => c.component === 'Video');
    expect(video).toBeDefined();
    expect(video?.url).toBe('img:vid1');
  });

  it('creates the surface under the Atlas catalog', () => {
    const { messages } = buildWalkthroughVideoSurface({ label: 'Branch', videoRef: 'img:vid1' });
    const createMsg = messages.find((m): m is CreateSurfaceMsg => 'createSurface' in m)!;
    expect(createMsg.createSurface.catalogId).toBe(ATLAS_CATALOG_ID);
  });
});
