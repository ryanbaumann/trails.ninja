
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PASSPORT, missionPromptContext, prioritiesToRubric, useMission } from './store';

const mockLocalStorage = {
  store: {} as Record<string, string>,
  getItem(key: string) { return this.store[key] || null; },
  setItem(key: string, value: string) { this.store[key] = value; },
  removeItem(key: string) { delete this.store[key]; },
  clear() { this.store = {}; },
  get length() { return Object.keys(this.store).length; },
};
global.window = { localStorage: mockLocalStorage } as any;

beforeEach(() => {
  window.localStorage.clear();
  useMission.getState().reset('sf');
});

describe('mission store', () => {
  it('starts a typed mission and exposes current preferences to model turns', () => {
    useMission.getState().start({
      goal: 'Find a calm launch site',
      cityId: 'nyc',
      mode: 'live',
      preferences: { maxTravelMinutes: 15, priorities: { access: 90 } },
    });

    expect(useMission.getState().mission).toMatchObject({ goal: 'Find a calm launch site', cityId: 'nyc', status: 'observing' });
    expect(missionPromptContext()).toContain('15-minute target; advisory until route eligibility is implemented');
    expect(missionPromptContext()).toContain('access=90');
  });

  it('normalizes UI-scale priorities into a fractional Scout rubric', () => {
    const rubric = prioritiesToRubric(DEFAULT_PASSPORT.priorities);
    expect(Object.values(rubric).reduce((sum, value) => sum + value, 0)).toBeCloseTo(1);
    expect(rubric.visibility).toBeCloseTo(80 / 325);
  });

  it('requires explicit consent before retaining and supports deletion', () => {
    useMission.getState().updatePassport({ accessibility: ['step-free entrance'] });
    expect(window.localStorage.length).toBe(0);

    useMission.getState().setRetentionConsent(true);
    expect(window.localStorage.length).toBe(1);

    useMission.getState().forgetPassport();
    expect(window.localStorage.length).toBe(0);
    expect(useMission.getState().mission.preferences).toEqual(DEFAULT_PASSPORT);
  });

  it('tracks map selection, area, scrub and per-candidate geometry', () => {
    useMission.getState().setCandidates([
      { id: 'a', label: 'A', inspectionState: 'scored', evidenceIds: [], source: 'demo', rank: 1 },
    ]);

    useMission.getState().selectCandidate('a');
    expect(useMission.getState().mission.selectedCandidateId).toBe('a');
    useMission.getState().selectCandidate(null);
    expect(useMission.getState().mission.selectedCandidateId).toBeUndefined();

    useMission.getState().setArea({ kind: 'circle', center: { lat: 1, lng: 2 }, radiusM: 800 });
    expect(useMission.getState().mission.area).toMatchObject({ kind: 'circle', radiusM: 800 });

    expect(useMission.getState().mission.scrub.hour).toBe(9);
    useMission.getState().updateScrub({ hour: 18, weather: 'rain' });
    expect(useMission.getState().mission.scrub).toMatchObject({ hour: 18, weather: 'rain', openOnly: false });

    const reachPath = [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, { lat: 1, lng: 1 }];
    useMission.getState().setCandidateGeometry('a', { reachPath });
    expect(useMission.getState().mission.candidates[0].reachPath).toEqual(reachPath);
  });

  it('approves and undoes a decision without losing candidates', () => {
    useMission.getState().setCandidates([
      { id: 'a', label: 'A', inspectionState: 'scored', evidenceIds: [], source: 'demo', rank: 1 },
    ]);
    useMission.getState().approveDecision('a', 'Best fit');
    expect(useMission.getState().mission.status).toBe('approved');
    expect(useMission.getState().mission.decision?.approvedAt).toBeTruthy();

    useMission.getState().undoApproval();
    expect(useMission.getState().mission.status).toBe('comparing');
    expect(useMission.getState().mission.decision?.approvedAt).toBeUndefined();
    expect(useMission.getState().mission.candidates).toHaveLength(1);
  });

  it('invalidates approval and downstream artifacts when the area or priorities change', () => {
    const state = useMission.getState();
    state.setCandidates([{ id: 'a', label: 'A', inspectionState: 'scored', evidenceIds: [], source: 'demo' }]);
    state.approveDecision('a');
    state.addArtifact({ id: 'campaign-a', kind: 'campaign', label: 'Campaign' });
    state.setArea({ kind: 'circle', center: { lat: 1, lng: 2 }, radiusM: 500 });

    expect(useMission.getState().mission).toMatchObject({
      status: 'comparing',
      decision: undefined,
      invalidation: { reason: 'area' },
      campaignReadiness: { status: 'not-ready' },
    });
    expect(useMission.getState().mission.artifacts).toEqual([]);

    useMission.getState().approveDecision('a');
    useMission.getState().updatePriority('access', 12);
    expect(useMission.getState().mission.decision).toBeUndefined();
    expect(useMission.getState().mission.invalidation?.reason).toBe('priorities');
  });

  it('drives creation, failure, resume, and completion through explicit events', () => {
    const state = useMission.getState();
    state.transition({ type: 'launch' });
    state.transition({ type: 'create-campaign' });
    expect(useMission.getState().mission.campaignReadiness.status).toBe('creating');

    state.transition({ type: 'fail', error: { code: 'image', message: 'Image failed', retryable: true } });
    expect(useMission.getState().mission).toMatchObject({
      status: 'failed',
      error: { code: 'image', retryable: true },
      campaignReadiness: { status: 'failed' },
    });

    state.transition({ type: 'resume' });
    state.transition({ type: 'complete', campaignArtifactId: 'campaign-1' });
    expect(useMission.getState().mission).toMatchObject({
      status: 'complete',
      campaignReadiness: { status: 'ready', artifactId: 'campaign-1' },
    });
  });

  it('merges Scout observations by id without losing mission geometry, selection, or approval', () => {
    const state = useMission.getState();
    state.setCandidates([{
      id: 'a',
      label: 'Earlier A',
      inspectionState: 'scored',
      evidenceIds: [],
      source: 'live',
      reachPath: [{ lat: 1, lng: 2 }],
    }]);
    state.selectCandidate('a');
    state.approveDecision('a');

    state.syncScoutCandidates([{
      id: 'a',
      label: 'Updated A',
      loc: { lat: 3, lng: 4 },
      status: 'scored',
      evidence: [{ url: 'street-view', ref: 'img:a', heading: 90 }],
      scores: { visibility: 80, condition: 80, activity: 80, access: 80, environment: 80, total: 80 },
    }]);

    expect(useMission.getState().mission).toMatchObject({
      status: 'approved',
      selectedCandidateId: 'a',
      decision: { candidateId: 'a' },
      candidates: [{ id: 'a', label: 'Updated A', reachPath: [{ lat: 1, lng: 2 }] }],
      evidence: [{ id: 'scout:a:0', imageRef: 'img:a' }],
    });
  });
});
