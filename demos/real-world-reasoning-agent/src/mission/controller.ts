import { resetCopilot, sendInternalToCopilot } from '@/ai/session';
import { atlas } from '@/state/store';
import { adstudio } from '@/scenarios/adstudio/store';
import { missionStore, useMission } from './store';
import { rerankMissionCandidates } from './rank';
import { reachHull, walkReachMeters, walkRoute } from './geometry';
import { computeRoute } from '@/services/routes';
import { putImage } from '@/genui/images';
import type { LatLng } from '@/lib/types';
import type { MissionCandidate, MissionMode, PreferencePassport } from './types';

const DEMO_ACCENT = '#60a5fa';

/** Anchor a route starts from: the drawn area's center, else the city center. */
function missionAnchor(): LatLng | undefined {
  const state = missionStore();
  if (state.mission.area?.center) return state.mission.area.center;
  const app = atlas();
  return (app.cities.find((city) => city.id === state.mission.cityId) ?? app.cities[0])?.center;
}

export function startFlagshipMission(input: {
  goal: string;
  cityId: string;
  mode: MissionMode;
  preferences?: Partial<PreferencePassport>;
  location?: LatLng;
}): void {
  const state = missionStore();
  state.start(input);
  atlas().setCameraUrlSync(!input.location);
  if (input.location) {
    useMission.setState((current) => ({
      mission: {
        ...current.mission,
        area: { kind: 'circle', center: input.location, radiusM: 1_000 },
      },
    }));
  }
  atlas().setScenario('scout');
  if (typeof window === 'undefined' || window.innerWidth >= 1024) {
    atlas().setDrawer(true);
  }
  atlas().dismissLanding();

  if (input.mode === 'demo') {
    seedDemoCandidates(input.cityId, input.location);
    return;
  }

  sendInternalToCopilot(
    `Start the flagship mission. Scout three candidates for this goal: ${input.goal} ` +
      'Stream candidate pins first, then inspect the strongest candidates and score only supported evidence.',
  );
}

/** Clearly synthetic, generic fixtures keep the no-credentials path deterministic without inventing place facts. */
function seedDemoCandidates(cityId: string, location?: LatLng): void {
  const app = atlas();
  const city = app.cities.find((item) => item.id === cityId) ?? app.cities[0];
  const center = location ?? city.center;
  const offsets = [
    { lat: 0.0022, lng: -0.0018 },
    { lat: -0.0012, lng: 0.0024 },
    { lat: 0.0002, lng: 0.0035 },
  ];
  const factors = [
    { visibility: 84, condition: 73, activity: 58, access: 87, environment: 76 },
    { visibility: 71, condition: 86, activity: 64, access: 74, environment: 82 },
    { visibility: 88, condition: 68, activity: 72, access: 67, environment: 71 },
  ];
  const candidates: MissionCandidate[] = offsets.map((offset, index) => {
    const id = `demo-candidate-${index + 1}`;
    return {
      id,
      label: `Demo candidate ${String.fromCharCode(65 + index)}`,
      location: { lat: center.lat + offset.lat, lng: center.lng + offset.lng },
      confidence: 0.62,
      inspectionState: 'scored' as const,
      factors: factors[index],
      // Evidence IDs are keyed by candidate id (not list position) so they stay
      // correct after reranking reorders the list.
      evidenceIds: [`demo-evidence-${id}`],
      source: 'demo' as const,
      observedSignals: {
        hours: { valid: true, openAtHours: Array.from({ length: 15 }, (_, hour) => hour + 6) },
        weather: true,
        traffic: true,
        sun: true,
      },
    };
  });
  const ranked = rerankMissionCandidates(candidates, missionStore().mission.preferences.priorities);
  useMission.setState((current) => ({
    mission: {
      ...current.mission,
      candidates: ranked,
      evidence: ranked.map((candidate) => ({
        id: `demo-evidence-${candidate.id}`,
        kind: 'place',
        provenance: 'generated',
        sourceLabel: 'Deterministic Atlas demo fixture — not live Google Maps data',
        confidence: candidate.confidence,
        location: candidate.location,
        limitations: ['Synthetic scoring for interaction demonstration only.', 'No real-world claim is made.'],
      })),
      status: 'comparing',
    },
  }));
  app.setMarkers(
    ranked.flatMap((candidate) =>
      candidate.location
        ? [{
            id: `mission-${candidate.id}`,
            position: candidate.location,
            glyph: String(candidate.rank),
            title: `${candidate.label} · deterministic demo fixture`,
            color: DEMO_ACCENT,
            kind: 'pin' as const,
            meta: { demo: true, candidateId: candidate.id },
            scenario: 'scout' as const,
          }]
        : [],
    ),
  );
  app.setCamera({ kind: 'fit', bounds: ranked.flatMap((candidate) => (candidate.location ? [candidate.location] : [])) });
}

export function rerankMission(priorities: Record<string, number>): void {
  const state = missionStore();
  state.updatePassport({ priorities });
  state.setCandidates(rerankMissionCandidates(state.mission.candidates, priorities));
}

/** Focus a candidate (map click / Claim Lens) and lazily compute its walking-reach hull. */
export function focusMissionCandidate(candidateId: string): void {
  const state = missionStore();
  const candidate = state.mission.candidates.find((item) => item.id === candidateId);
  state.selectCandidate(candidateId);
  if (candidate?.location && !candidate.reachPath) {
    const minutes = state.mission.preferences.maxTravelMinutes ?? 12;
    state.setCandidateGeometry(candidateId, { reachPath: reachHull(candidate.location, walkReachMeters(minutes)) });
  }
}

/**
 * One-line "why this one" rationale: the winner's lead over the runner-up on the
 * operator's highest-weighted priority. Falls back to a generic line only when
 * the factor data needed to compute a delta is missing.
 */
function buildApprovalRationale(candidate: MissionCandidate, candidates: MissionCandidate[]): string {
  const generic = `Approved after comparing ${candidates.length} candidates.`;
  const priorities = missionStore().mission.preferences.priorities;
  const factors = candidate.factors;
  if (!factors) return generic;
  // Highest-weighted priority that the candidates actually score on.
  const topFactor = Object.entries(priorities)
    .filter(([key]) => key in factors)
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!topFactor) return generic;
  const runnerUp = candidates
    .filter((item) => item.id !== candidate.id && item.factors?.[topFactor] != null)
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))[0];
  const winnerValue = factors[topFactor];
  const runnerValue = runnerUp?.factors?.[topFactor];
  if (winnerValue == null || runnerValue == null) return generic;
  const label = topFactor.charAt(0).toUpperCase() + topFactor.slice(1);
  return `#${candidate.rank ?? 1} leads on ${label} (${winnerValue} vs ${runnerValue}), your highest priority.`;
}

export async function approveMissionCandidate(candidateId: string): Promise<void> {
  const state = missionStore();
  const candidate = state.mission.candidates.find((item) => item.id === candidateId);
  if (!candidate) return;
  state.approveDecision(candidateId, buildApprovalRationale(candidate, state.mission.candidates));
  state.addArtifact({ id: `decision-${candidateId}`, kind: 'site-selection', label: candidate.label });
  // Demo uses a visibly modeled estimate. Live geometry must come from Routes.
  if (candidate.location) {
    const minutes = state.mission.preferences.maxTravelMinutes ?? 12;
    const anchor = missionAnchor();
    const routePath = anchor
      ? state.mode === 'demo'
        ? walkRoute(anchor, candidate.location)
        : (await computeRoute(anchor, candidate.location, { travelMode: 'WALK' }).catch(() => null))?.path
      : undefined;
    if (missionStore().mission.decision?.candidateId !== candidateId) return;
    state.setCandidateGeometry(candidateId, {
      reachPath: state.mode === 'demo' ? reachHull(candidate.location, walkReachMeters(minutes)) : undefined,
      routePath,
    });
    state.addArtifact({
      id: `reach-${candidateId}`,
      kind: 'route-reach',
      label: state.mode === 'demo'
        ? `Modeled reach and route estimate · ${candidate.label}`
        : routePath?.length
          ? `Routes API walking route · ${candidate.label}`
          : `Walking route unavailable · ${candidate.label}`,
    });
  }
  // Approve is the one deliberate decision; the campaign is plumbing, so auto-bridge
  // it. The demo carries the winner straight into its ready fixture workspace; live
  // hands off too whenever the winner has the Places details the campaign needs
  // (handoff then drives the grounded run). Live without place details can't run a
  // campaign, so leave the explicit "Create campaign" CTA on the spine for that case.
  if (state.mode === 'demo' || candidate.place) handoffMissionToAdStudio();
}

export function handoffMissionToAdStudio(): boolean {
  const state = missionStore();
  const decision = state.mission.decision;
  const winner = state.mission.candidates.find((candidate) => candidate.id === decision?.candidateId);
  if (!decision?.approvedAt || !winner) return false;

  if (state.mode === 'demo') {
    adstudio().reset();
    adstudio().setBusiness({
      id: winner.id,
      name: winner.label,
      location: winner.location ?? missionAnchor() ?? { lat: 0, lng: 0 },
      formattedAddress: 'Deterministic demo fixture — not a real place',
      primaryType: 'demo_fixture',
    }, state.mission.goal);
    adstudio().setFacts({
      grounding: 'Deterministic campaign fixture. No live Google Maps facts were used.',
      vibe: 'Quiet morning workspace with clear street presence',
    });
    const imageRef = putImage(
      'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#172554"/><stop offset="1" stop-color="#0f766e"/></linearGradient></defs><rect width="1024" height="1024" fill="url(#g)"/><circle cx="790" cy="220" r="190" fill="#fbbf24" opacity=".9"/><text x="72" y="720" fill="white" font-family="sans-serif" font-size="78" font-weight="700">Make room for focus.</text><text x="76" y="805" fill="#dbeafe" font-family="sans-serif" font-size="38">Atlas deterministic demo creative</text></svg>',
      ),
    );
    adstudio().addCreative({
      id: `demo-creative-${winner.id}`,
      imageRef,
      headline: 'Make room for focus.',
      body: 'A deterministic Atlas campaign concept for the approved demo candidate.',
      cta: 'Preview the concept',
      style: 'calm morning editorial',
      format: 'square',
      status: 'ready',
      conditioning: 'text-only',
    });
    state.addArtifact({
      id: `campaign-${winner.id}`,
      kind: 'campaign',
      label: 'Demo campaign creative (deterministic fixture)',
      ref: imageRef,
    });
    state.transition({ type: 'complete', campaignArtifactId: `campaign-${winner.id}` });
    continueMissionInAdStudio(winner.label, true);
    return true;
  }

  if (!winner.place) {
    state.transition({
      type: 'fail',
      error: { code: 'CAMPAIGN_PLACE_MISSING', message: 'Live campaign handoff requires current Places details.', retryable: true },
    });
    return false;
  }

  adstudio().setBusiness(winner.place, state.mission.goal);
  state.transition({ type: 'create-campaign' });
  continueMissionInAdStudio(winner.label, false);
  return true;
}

function continueMissionInAdStudio(winnerLabel: string, demo: boolean): void {
  const app = atlas();
  resetCopilot();
  app.clearChat();
  app.setScenario('adstudio');
  app.pushToast(
    demo ? 'good' : 'info',
    demo ? 'Approved · campaign ready in Ad Studio' : 'Approved · building the campaign in Ad Studio',
  );
  // Keep the Ad Studio panel OPEN while the live campaign builds (it can take a
  // while) so the user watches progress instead of a blank map. The demo campaign
  // is an instant fixture, so fold the drawer there and let the ready creative
  // headline the dock.
  if (typeof window === 'undefined' || window.innerWidth >= 1024) {
    app.setDrawer(!demo);
  }
  app.setDockMinimized(false);
  app.addMsg({
    id: `mission-handoff-${Date.now()}`,
    role: 'notice',
    ts: Date.now(),
    notice: {
      title: `Mission continued · ${winnerLabel}`,
      body: demo
        ? 'Scout evidence and the approved winner are preserved. The deterministic campaign creative is ready below.'
        : 'Scout evidence and the approved winner are preserved. Atlas is gathering facts and creating the campaign here.',
    },
  });
  // Once the demo campaign is ready, offer the 3D reveal as a follow-up chip in
  // the dock. CopilotDock wires the "Reveal in 3D" chip straight to
  // revealMissionIn3D() (a deliberate one-click trigger, not a model round-trip),
  // so the payoff stays reachable after the Scout drawer folds away.
  const revealReady = demo && missionStore().mission.campaignReadiness.status === 'ready';
  app.setFollowups(demo
    ? revealReady
      ? ['Show the campaign creative', 'Reveal in 3D', 'Explain the campaign evidence']
      : ['Show the campaign creative', 'Explain the campaign evidence']
    // Live auto-runs the campaign below, so don't offer a chip that re-triggers it.
    : ['Review the grounded campaign facts', 'Explain why this creative fits']);

  // Live: auto-bridge the plumbing. The approved winner's Places details are already
  // set as the campaign business (handoffMissionToAdStudio → setBusiness), so drive
  // the grounded campaign run immediately rather than stranding the mission in
  // 'creating' behind a manual chip click. setScenario('adstudio') above already made
  // adstudio the active journey, so the internal send routes to its freshly reset engine.
  // The demo path is a synchronous fixture and needs no copilot turn.
  if (!demo) {
    sendInternalToCopilot(
      `The approved location "${winnerLabel}" is already set as this campaign's business — its Places ` +
        'details are loaded, so do NOT call set_campaign_business or search_places again. Gather the grounded ' +
        'campaign facts, then generate the campaign creative right away: skip the art-direction picker and pick ' +
        'one strong grounded style yourself. When the creative is ready, say in one line why it fits this ' +
        'location and that the winner can now be revealed in 3D.',
    );
  }
}

export function revealMissionIn3D(): boolean {
  const state = missionStore();
  const decision = state.mission.decision;
  if (!decision?.approvedAt || state.mission.campaignReadiness.status !== 'ready') return false;
  const winner = state.mission.candidates.find((candidate) => candidate.id === decision.candidateId);
  if (!winner?.location) return false;
  state.addArtifact({ id: `reveal-${winner.id}`, kind: 'reveal', label: `3D reveal · ${winner.label}` });
  state.transition({ type: 'complete' });
  atlas().setScenario('cinema');
  // Declutter the climax: fold the drawer and minimize the dock so the orbiting
  // 3D reveal plays full-bleed. renderMissionReveal (cinema onEnter) drives the
  // camera choreography.
  atlas().setDrawer(false);
  atlas().setDockMinimized(true);
  return true;
}
