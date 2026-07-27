import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAtlas } from '@/state/store';
import { useGenui } from '@/genui/store';
import { changeExplorerTravelMode, startExplorerJourney } from './controller';

const { generateExplorerAnswer, suggestFollowups } = vi.hoisted(() => ({
  generateExplorerAnswer: vi.fn(async () => 'Atlas recommends **Sample café A** for this demo.'),
  suggestFollowups: vi.fn(async () => ['Suggested followup 1', 'Suggested followup 2']),
}));
vi.mock('./answer', async (importOriginal) => ({
  ...await importOriginal<typeof import('./answer')>(),
  generateExplorerAnswer,
}));
vi.mock('@/ai/followups', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/ai/followups')>(),
  suggestFollowups,
}));

function reset(): void {
  useGenui.getState().reset();
  useAtlas.setState({
    activeScenario: 'concierge',
    landingDismissed: false,
    drawerOpen: true,
    dockMinimized: false,
    markers: [],
    routes: [],
    cameraIntent: null,
    transcript: [],
    resumable: null,
    followups: [],
  });
}

describe('explorer controller', () => {
  beforeEach(reset);

  it('owns one updating evidence surface and presents a distinct Atlas answer', async () => {
    startExplorerJourney({
      goal: 'Find a quiet-work café I can walk to in 15 minutes and check the weather.',
      cityId: 'sf',
      mode: 'demo',
    });
    await vi.waitFor(() => {
      expect(useAtlas.getState().routes).toHaveLength(1);
    });
    await vi.waitFor(() => expect(useAtlas.getState().transcript[2]?.text).toMatch(/Sample preview.*Sample café A/i));
    const state = useAtlas.getState();
    // The explorer is the default runtime, not a journey: it owns its own genui
    // scope and must not repoint the recipe selector at Scout.
    expect(state.activeScenario).toBe('concierge');
    expect(useGenui.getState().surfaces['universal-explorer'].scenario).toBe('explorer');
    expect(state.resumable).toBeNull();
    expect(state.followups).toEqual(['Suggested followup 1', 'Suggested followup 2']);
    expect(state.transcript.map((message) => message.role)).toEqual(['user', 'surface', 'model']);
    expect(state.transcript[2]).toMatchObject({ streaming: false });
    expect(state.transcript[2]?.text).toMatch(/fictional demo data/i);
    expect(state.running).toBe(false);
    expect(Object.keys(useGenui.getState().surfaces)).toEqual(['universal-explorer']);
    expect(state.markers).toHaveLength(3);
  });

  it('keeps the surface identity and coherently replaces the winner route for a counterfactual', async () => {
    startExplorerJourney({ goal: 'Find a quiet-work café within 15 minutes.', cityId: 'sf', mode: 'demo' });
    await vi.waitFor(() => expect(useAtlas.getState().routes).toHaveLength(1));
    const surface = useGenui.getState().surfaces['universal-explorer'];
    const initialRevision = surface.rev;
    changeExplorerTravelMode('DRIVE');
    await vi.waitFor(() => {
      expect(useGenui.getState().surfaces['universal-explorer'].rev).toBeGreaterThan(initialRevision);
      expect(useAtlas.getState().markers[0]?.placeId).toBe('synthetic-candidate-b');
    });
    expect(Object.keys(useGenui.getState().surfaces)).toEqual(['universal-explorer']);
    expect(useAtlas.getState().routes).toHaveLength(1);
    expect(useAtlas.getState().routes[0]?.path.at(-1)).toEqual({ lat: 37.792, lng: -122.401 });
    expect(generateExplorerAnswer).not.toHaveBeenCalled();
  });
});
