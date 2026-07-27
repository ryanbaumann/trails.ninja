import { describe, expect, it } from 'vitest';
import { buildExplorerSurface } from './presenter';
import { runExplorer } from './runtime';
import { createExplorerFixture } from './fixtures';
import type { ExplorerView } from './contracts';

describe('explorer presenter', () => {
  it('creates one compact evidence surface and never links Sample fixtures', async () => {
    const views: ExplorerView[] = [];
    await runExplorer({ query: 'quiet work cafe; do I need a jacket?', origin: { lat: 1, lng: 2 } }, { grounding: createExplorerFixture() }, ({ view }) => { views.push(view); });
    const first = buildExplorerSurface(views[0], true);
    const final = buildExplorerSurface(views.at(-1)!, false);
    expect(first.filter((message) => 'createSurface' in message)).toHaveLength(1);
    expect(final.some((message) => 'createSurface' in message)).toBe(false);
    const update = final.find((message) => 'updateComponents' in message)!;
    const components = 'updateComponents' in update ? update.updateComponents.components : [];
    const root = components.find((component) => component.id === 'root')!;
    const children = root.children as string[];
    expect(children).toContain('sample-disclosure');
    expect(children).toContain('candidate-0-card');
    // Each candidate card must include a PlaceCard node
    expect(components.filter((component) => component.component === 'PlaceCard')).toHaveLength(3);
    expect(components.filter((component) => component.component === 'GroundingAttribution')).toHaveLength(0);
    expect(JSON.stringify(components)).not.toMatch(/github|https?:\/\//i);
    expect(components.some((component) => component.id === 'weather-inference')).toBe(true);
    expect(components.filter((component) => component.component === 'ProgressStatus')).toHaveLength(0);
    // The surface, not the shell, owns the counterfactual: one NextActions node
    // carrying the travel-mode comparison.
    const nextActions = components.filter((component) => component.component === 'NextActions');
    expect(nextActions).toHaveLength(1);
    expect(nextActions[0].actions).toMatchObject([
      { action: { event: { name: 'explorer_change_travel_mode', context: { travelMode: 'DRIVE' } } } },
    ]);
    expect(components.filter((component) => component.component === 'Button')).toHaveLength(0);
  });

  it('keeps live place and weather attribution inside the supporting evidence cards', async () => {
    const views: ExplorerView[] = [];
    await runExplorer({ query: 'quiet work cafe; check the weather', origin: { lat: 1, lng: 2 }, dataMode: 'live' }, { grounding: createExplorerFixture() }, ({ view }) => { views.push(view); });
    const final = buildExplorerSurface(views.at(-1)!, true);
    const update = final.find((message) => 'updateComponents' in message)!;
    const components = 'updateComponents' in update ? update.updateComponents.components : [];
    const byId = new Map(components.map((component) => [component.id, component]));
    for (const index of [0, 1, 2]) {
      expect(byId.get(`candidate-${index}-column`)?.children).toEqual([
        `candidate-${index}-place`, `candidate-${index}-claim`, `candidate-${index}-source`,
      ]);
    }
    expect(byId.get('weather-column')?.children).toEqual([
      'weather-claim', 'weather-source', 'weather-inference',
    ]);
  });
});
