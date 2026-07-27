import { describe, expect, it, vi } from 'vitest';
import { createExplorerFixture, SAMPLE_PLACES } from './fixtures';
import { rerunExplorerRoutes, runExplorer } from './runtime';
import type { ExplorerUpdate } from './contracts';
import { createFixtureWorld } from '@/world/fixtures';

const input = {
  query: 'quiet-work café near the selected area',
  origin: { lat: 37.7955, lng: -122.3937 },
  maxTravelMinutes: 15,
  surfaceId: 'universal-explorer',
} as const;

describe('universal explorer runtime', () => {
  it('streams one surface, emits the first map effect after search, and skips unrequested weather', async () => {
    const updates: ExplorerUpdate[] = [];
    const grounding = createExplorerFixture();
    const weather = vi.spyOn(grounding, 'lookupWeather');
    const run = await runExplorer(input, { grounding, now: () => 100 }, (update) => { updates.push(update); });

    expect(new Set(updates.map((update) => update.view.surfaceId))).toEqual(new Set(['universal-explorer']));
    expect(updates.map((update) => update.view.stage)).toEqual([
      'interpreting', 'searching', 'checking-routes', 'ready',
    ]);
    expect(updates[2].effects.map((effect) => effect.type)).toEqual(['map.replace-markers', 'map.fit']);
    expect(run.view.winnerId).toBe('synthetic-candidate-a');
    expect(run.view.candidates.find((candidate) => candidate.id === 'synthetic-candidate-c')).toMatchObject({ eligible: false });
    expect(run.view.limitations).toContain('Walking routes are in beta and may sometimes lack clear sidewalks or pedestrian paths.');
    expect(weather).not.toHaveBeenCalled();
  });

  it('honors an explicit shortest-drive request and only checks weather when requested', async () => {
    const grounding = createExplorerFixture();
    const route = vi.spyOn(grounding, 'computeRoute');
    const weather = vi.spyOn(grounding, 'lookupWeather');
    const drive = await runExplorer({ ...input, query: 'Find an errand stop with the shortest drive.' }, { grounding }, () => {});
    expect(drive.view.travelMode).toBe('DRIVE');
    expect(route.mock.calls.every(([request]) => request.travelMode === 'DRIVE')).toBe(true);
    expect(weather).not.toHaveBeenCalled();

    route.mockClear();
    const withWeather = await runExplorer({ ...input, query: 'Find lunch and tell me if I need a jacket.' }, { grounding }, () => {});
    expect(withWeather.view.currentWeatherRequested).toBe(true);
    expect(weather).toHaveBeenCalledTimes(1);
  });

  it('includes the registered display capability only when a display route adapter is configured', async () => {
    const displayRoutes = createFixtureWorld({
      route: { path: [input.origin, SAMPLE_PLACES[0].location], distanceMeters: 1, durationSeconds: 1 },
    }).routes;
    const run = await runExplorer(input, { grounding: createExplorerFixture(), displayRoutes }, () => {});
    expect(run.view.capabilityProfile).toContain('world.routes.display@1');
  });

  it('clarifies before providers when the request lacks a useful place intent', async () => {
    const grounding = createExplorerFixture();
    const search = vi.spyOn(grounding, 'searchPlaces');
    const run = await runExplorer({ ...input, query: 'ok' }, { grounding }, () => {});
    expect(run.view.stage).toBe('needs-clarification');
    expect(run.view.capabilityProfile).toEqual(['world.presentation.explorer@1']);
    expect(search).not.toHaveBeenCalled();
    const vague = await runExplorer({ ...input, query: 'find somewhere good nearby' }, { grounding }, () => {});
    expect(vague.view.stage).toBe('needs-clarification');
    expect(search).not.toHaveBeenCalled();
  });

  it('stops honestly on no results without routes, weather, markers, or a recommendation', async () => {
    const grounding = createExplorerFixture({ places: { status: 'empty' } });
    const route = vi.spyOn(grounding, 'computeRoute');
    const weather = vi.spyOn(grounding, 'lookupWeather');
    const updates: ExplorerUpdate[] = [];
    const run = await runExplorer(input, { grounding }, (update) => { updates.push(update); });
    expect(run.view).toMatchObject({ stage: 'empty', candidates: [] });
    expect(run.view.winnerId).toBeUndefined();
    expect(route).not.toHaveBeenCalled();
    expect(weather).not.toHaveBeenCalled();
    expect(updates.at(-1)?.effects).toEqual([{ type: 'map.replace-markers', scope: 'universal-explorer', markers: [] }]);
  });

  it('keeps a route-backed decision when weather is unavailable and makes no weather claim', async () => {
    const run = await runExplorer({ ...input, query: `${input.query}; check the weather` }, {
      grounding: createExplorerFixture({ weather: { status: 'failure', message: 'Weather unavailable.', retryable: true } }),
    }, () => {});
    expect(run.view).toMatchObject({ stage: 'partial', winnerId: 'synthetic-candidate-a' });
    expect(run.view.weather).toBeUndefined();
    expect(run.view.narrative).toMatch(/no jacket claim/i);
    expect(run.view.limitations).toContain('Current weather could not be verified.');
  });

  it('reuses the shortlist and updates the same surface for the driving counterfactual', async () => {
    const grounding = createExplorerFixture();
    const search = vi.spyOn(grounding, 'searchPlaces');
    const initial = await runExplorer(input, { grounding }, () => {});
    search.mockClear();
    const revisions: number[] = [];
    const counterfactual = await rerunExplorerRoutes(initial, input, 'DRIVE', { grounding }, (update) => { revisions.push(update.view.revision); });
    expect(search).not.toHaveBeenCalled();
    expect(counterfactual.view.surfaceId).toBe(initial.view.surfaceId);
    expect(counterfactual.view.winnerId).toBe('synthetic-candidate-b');
    expect(counterfactual.places).toEqual(SAMPLE_PLACES);
    expect(revisions.length).toBeGreaterThan(1);
  });
});
