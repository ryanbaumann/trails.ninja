import { beforeEach, describe, expect, it } from 'vitest';
import { useAtlas } from './store';

beforeEach(() => {
  // Reset only the fields these tests touch.
  useAtlas.setState({
    transcript: [],
    telemetry: [],
    running: false,
    resumable: null,
    followups: [],
    activeScenario: 'concierge',
    cameraUrlSync: true,
  });
});

describe('session state', () => {
  it('clears the last report when camera URL synchronization changes', () => {
    useAtlas.getState().setCameraReport({ lat: 12.34, lng: 56.78 });
    useAtlas.getState().setCameraUrlSync(false);
    expect(useAtlas.getState()).toMatchObject({ cameraUrlSync: false, cameraReport: null });
  });

  it('setRunning toggles the single in-flight flag', () => {
    expect(useAtlas.getState().running).toBe(false);
    useAtlas.getState().setRunning(true);
    expect(useAtlas.getState().running).toBe(true);
    useAtlas.getState().setRunning(false);
    expect(useAtlas.getState().running).toBe(false);
  });

  it('setResumable records and clears the session prompt', () => {
    expect(useAtlas.getState().resumable).toBeNull();
    useAtlas.getState().setResumable('find me a good site');
    expect(useAtlas.getState().resumable).toBe('find me a good site');
    useAtlas.getState().setResumable(null);
    expect(useAtlas.getState().resumable).toBeNull();
  });

  it('clearChat wipes the transcript, telemetry, resume marker, and followups', () => {
    const s = useAtlas.getState();
    s.setResumable('stale prompt');
    s.setFollowups(['next step']);
    s.addMsg({ id: 'm1', role: 'user', text: 'hi', ts: 1 });
    s.pushTool({ id: 't1', name: 'search_places', status: 'ok', ts: 1 });

    useAtlas.getState().clearChat();

    expect(useAtlas.getState().transcript).toEqual([]);
    expect(useAtlas.getState().telemetry).toEqual([]);
    expect(useAtlas.getState().resumable).toBeNull();
    expect(useAtlas.getState().followups).toEqual([]);
  });

  // The point of the session collapse: a recipe switch continues the same
  // conversation instead of swapping to a parallel one.
  it('survives a recipe switch', () => {
    const s = useAtlas.getState();
    s.addMsg({ id: 'm1', role: 'user', text: 'find a cafe', ts: 1 });
    s.setResumable('find a cafe');

    useAtlas.getState().setScenario('scout');

    expect(useAtlas.getState().transcript.map((m) => m.id)).toEqual(['m1']);
    expect(useAtlas.getState().resumable).toBe('find a cafe');
  });

  it('stamps the active recipe onto tool events so diagnostics keep attribution', () => {
    useAtlas.getState().setScenario('insight');
    useAtlas.getState().pushTool({ id: 't1', name: 'get_environment', status: 'ok', ts: 1 });
    useAtlas.getState().setScenario('scout');
    useAtlas.getState().pushTool({ id: 't2', name: 'scout_area', status: 'ok', ts: 2 });

    expect(useAtlas.getState().telemetry.map((e) => e.scenario)).toEqual(['insight', 'scout']);
  });

  it('bounds the telemetry log', () => {
    for (let i = 0; i < 60; i++) {
      useAtlas.getState().pushTool({ id: `t${i}`, name: 'search_places', status: 'ok', ts: i });
    }
    const log = useAtlas.getState().telemetry;
    expect(log).toHaveLength(48);
    expect(log.at(-1)?.id).toBe('t59');
  });
});
