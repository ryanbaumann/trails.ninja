import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAtlas } from '@/state/store';
import { useAdStudio } from '@/scenarios/adstudio/store';
import { useMission } from './store';
import type { MissionCandidate } from './types';
import {
  approveMissionCandidate,
  focusMissionCandidate,
  revealMissionIn3D,
  startFlagshipMission,
} from './controller';

// The controller's only side channels to the network are @/ai/session (copilot)
// and @/services/routes (live geometry). Mock both so the LIVE handoff is testable
// headlessly: the public/internal copilot sends become spies, and
// computeRoute returns a fixed path. The demo path never touches either branch.
const sess = vi.hoisted(() => ({ sent: [] as string[], internal: [] as string[] }));
vi.mock('@/ai/session', () => ({
  resetCopilot: () => {},
  sendToCopilot: (text: string) => { sess.sent.push(text); },
  sendInternalToCopilot: (text: string) => { sess.internal.push(text); },
}));
vi.mock('@/services/routes', () => ({
  computeRoute: async () => ({ path: [{ lat: 0, lng: 0 }, { lat: 1, lng: 1 }] }),
}));

// The demo mission is pure zustand-store logic (no network, no DOM), so the
// entire hero click-flow AND its camera/marker choreography are assertable in a
// node test. This is the fast, browser-free counterpart to mission-smoke.mjs:
// the browser only needs to confirm these intents actually paint.

function reset(): void {
  useAtlas.setState({
    activeScenario: 'concierge',
    drawerOpen: false,
    landingDismissed: false,
    dockMinimized: false,
    markers: [],
    cameraIntent: null,
    cameraUrlSync: true,
    selectedMarkerId: null,
  });
  useAdStudio.getState().reset();
  useMission.getState().reset('sf');
  sess.sent.length = 0;
  sess.internal.length = 0;
}

function winnerId(): string {
  const winner = useMission.getState().mission.candidates.find((c) => c.rank === 1);
  if (!winner) throw new Error('no rank-1 candidate');
  return winner.id;
}

/** Drive the demo journey through to a ready campaign. */
async function runToCampaign(): Promise<void> {
  startFlagshipMission({ goal: 'Find a calm launch site', cityId: 'sf', mode: 'demo' });
  await approveMissionCandidate(winnerId());
}

describe('mission controller — demo hero journey', () => {
  beforeEach(reset);

  it('scopes a user-selected location to a clearable mission area', () => {
    startFlagshipMission({
      goal: 'Find a fit',
      cityId: 'sf',
      mode: 'demo',
      location: { lat: 12.34, lng: 56.78 },
    });
    expect(useMission.getState().mission.area).toEqual({
      kind: 'circle',
      center: { lat: 12.34, lng: 56.78 },
      radiusM: 1_000,
    });
    expect(useAtlas.getState().cityId).toBe('sf');
    expect(useAtlas.getState().cameraUrlSync).toBe(false);

    useMission.getState().setArea(undefined);
    expect(useMission.getState().mission.area).toBeUndefined();
  });

  it('start(demo) seeds ranked candidates, rank-glyph markers, a fit camera, and comparing status', () => {
    startFlagshipMission({ goal: 'Find a calm launch site', cityId: 'sf', mode: 'demo' });

    const atlas = useAtlas.getState();
    expect(atlas.activeScenario).toBe('scout');
    expect(atlas.drawerOpen).toBe(true);
    expect(atlas.landingDismissed).toBe(true);

    const mission = useMission.getState().mission;
    expect(mission.status).toBe('comparing');
    expect(mission.candidates).toHaveLength(3);
    expect(mission.candidates.every((c) => typeof c.rank === 'number')).toBe(true);
    expect(mission.evidence).toHaveLength(3);

    // Markers mirror the ranked candidates with their rank as the glyph.
    expect(atlas.markers).toHaveLength(3);
    const ranks = atlas.markers.map((m) => m.glyph).sort();
    expect(ranks).toEqual(['1', '2', '3']);

    // The camera fits all candidates so the user sees the whole comparison.
    expect(atlas.cameraIntent?.kind).toBe('fit');
  });

  it('starts a live mission through the internal copilot channel', () => {
    startFlagshipMission({ goal: 'Find a calm launch site', cityId: 'sf', mode: 'live' });

    expect(sess.sent).toHaveLength(0);
    expect(sess.internal).toHaveLength(1);
    expect(sess.internal[0]).toMatch(/start the flagship mission/i);
  });

  it('focus computes the walking-reach hull for the selected candidate', () => {
    startFlagshipMission({ goal: 'Find a calm launch site', cityId: 'sf', mode: 'demo' });
    const id = winnerId();
    focusMissionCandidate(id);

    const mission = useMission.getState().mission;
    expect(mission.selectedCandidateId).toBe(id);
    const focused = mission.candidates.find((c) => c.id === id);
    expect(focused?.reachPath?.length).toBeGreaterThan(0);
  });

  it('approve records the decision + artifacts and auto-hands off to a ready Ad Studio campaign', async () => {
    await runToCampaign();

    const mission = useMission.getState().mission;
    expect(mission.decision?.candidateId).toBe(winnerId());
    expect(mission.decision?.approvedAt).toBeTruthy();

    // The rationale is the computed "why": it names the winning factor and the
    // head-to-head delta, not the old generic "Approved after comparing N…".
    const rationale = mission.decision?.rationale ?? '';
    expect(rationale).not.toMatch(/Approved after comparing/);
    expect(rationale).toMatch(/leads on [A-Z]\w+ \(\d+ vs \d+\)/);

    const kinds = mission.artifacts.map((a) => a.kind);
    expect(kinds).toContain('site-selection');
    expect(kinds).toContain('route-reach');
    expect(kinds).toContain('campaign');

    // Demo auto-chains approve → create: the campaign is ready, not pending.
    expect(mission.status).toBe('complete');
    expect(mission.campaignReadiness.status).toBe('ready');

    const ad = useAdStudio.getState();
    expect(ad.business?.name).toBeTruthy();
    expect(ad.creatives).toHaveLength(1);
    expect(ad.creatives[0].status).toBe('ready');

    // Handoff moves the user into Ad Studio and folds the Scout drawer away.
    const atlas = useAtlas.getState();
    expect(atlas.activeScenario).toBe('adstudio');
    expect(atlas.drawerOpen).toBe(false);
  });

  it('reveal is reachable once the campaign is ready and flips into the 3D cinema scene', async () => {
    await runToCampaign();

    // Handoff surfaces the reveal in the AdStudio narrative thread too, so the
    // payoff is discoverable after the drawer folds away.
    expect(useAtlas.getState().followups).toContain('Reveal in 3D');

    const ok = revealMissionIn3D();
    expect(ok).toBe(true);
    expect(useAtlas.getState().activeScenario).toBe('cinema');
    expect(useMission.getState().mission.artifacts.map((a) => a.kind)).toContain('reveal');

    // The climax is decluttered: drawer folded, dock minimized, map full-bleed.
    expect(useAtlas.getState().drawerOpen).toBe(false);
    expect(useAtlas.getState().dockMinimized).toBe(true);
  });

  it('reveal is blocked before a campaign exists', () => {
    startFlagshipMission({ goal: 'Find a calm launch site', cityId: 'sf', mode: 'demo' });
    // Not approved / no ready campaign yet.
    expect(revealMissionIn3D()).toBe(false);
    expect(useAtlas.getState().activeScenario).toBe('scout');
  });

  it('changing the search area after approval invalidates the decision and downstream artifacts', async () => {
    await runToCampaign();
    expect(useMission.getState().mission.decision?.approvedAt).toBeTruthy();

    useMission.getState().setArea({ kind: 'circle', center: { lat: 1, lng: 2 }, radiusM: 500 });

    const mission = useMission.getState().mission;
    expect(mission.decision).toBeUndefined();
    expect(mission.invalidation?.reason).toBe('area');
    expect(mission.campaignReadiness.status).toBe('not-ready');
  });
});

describe('mission controller — live handoff auto-runs the campaign', () => {
  beforeEach(reset);

  const LIVE_WINNER: MissionCandidate = {
    id: 'live-1',
    label: 'Real Café',
    location: { lat: 37.77, lng: -122.42 },
    place: {
      id: 'places/real-cafe',
      name: 'Real Café',
      location: { lat: 37.77, lng: -122.42 },
      formattedAddress: '1 Market St',
      primaryType: 'cafe',
    },
    score: 80,
    confidence: 0.8,
    rank: 1,
    inspectionState: 'scored',
    factors: { visibility: 84, condition: 73, activity: 58, access: 87, environment: 76 },
    evidenceIds: [],
    source: 'live',
  };

  it('approving a live winner with place details hands off and drives the grounded run', async () => {
    startFlagshipMission({ goal: 'Find a launch site', cityId: 'sf', mode: 'live' });
    useMission.getState().setCandidates([LIVE_WINNER]);
    sess.internal.length = 0; // drop the scout kickoff message; we only care about the handoff turn

    await approveMissionCandidate('live-1');

    // Business set from the winner's real Places details, mission in the creating phase,
    // and the map switched to the Ad Studio journey.
    expect(useAdStudio.getState().business?.name).toBe('Real Café');
    expect(useMission.getState().mission.status).toBe('creating');
    expect(useMission.getState().mission.campaignReadiness.status).toBe('creating');
    expect(useAtlas.getState().activeScenario).toBe('adstudio');

    // The regression this locks: the campaign auto-runs instead of stranding the user
    // behind a manual chip. Exactly one copilot instruction is sent, and it drives the
    // grounded facts → creative workflow without re-resolving the business.
    expect(sess.sent).toHaveLength(0);
    expect(sess.internal).toHaveLength(1);
    const instruction = sess.internal[0];
    expect(instruction).toMatch(/gather the grounded campaign facts/i);
    expect(instruction).toMatch(/generate the campaign creative/i);
    expect(instruction).toMatch(/do NOT call set_campaign_business/i);
  });

  it('a live winner missing place details does not auto-run (keeps the explicit CTA)', async () => {
    startFlagshipMission({ goal: 'Find a launch site', cityId: 'sf', mode: 'live' });
    useMission.getState().setCandidates([{ ...LIVE_WINNER, place: undefined }]);
    sess.internal.length = 0;

    await approveMissionCandidate('live-1');

    // No place → no handoff, no copilot turn; the mission rests at 'approved' so the
    // MissionSpine still shows the deliberate "Create campaign" fallback.
    expect(useMission.getState().mission.status).toBe('approved');
    expect(sess.internal).toHaveLength(0);
  });
});
