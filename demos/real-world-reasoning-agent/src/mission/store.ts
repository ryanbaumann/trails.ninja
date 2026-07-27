import { create } from 'zustand';
import { uid } from '@/lib/id';
import type { LatLng } from '@/lib/types';
import type { Candidate as ScoutCandidate, RubricWeights } from '@/scenarios/scout/store';
import type {
  Decision,
  EnvironmentScrub,
  EvidenceRef,
  Mission,
  MissionArtifact,
  MissionCandidate,
  MissionMode,
  MissionEvent,
  PreferencePassport,
  SpatialConstraint,
} from './types';
import { pointInConstraint } from './geometry';

const PASSPORT_STORAGE_KEY = 'atlas.preference-passport.v1';

/** Neutral midday, fair-weather baseline so the comparison starts undistorted. */
export const DEFAULT_SCRUB: EnvironmentScrub = {
  hour: 9,
  weather: 'clear',
  openOnly: false,
  traffic: 'moderate',
  sun: 'mid',
};

export const DEFAULT_PASSPORT: PreferencePassport = {
  travelModes: ['WALK'],
  priorities: {
    visibility: 80,
    access: 75,
    environment: 70,
    condition: 55,
    activity: 45,
  },
  accessibility: [],
  environmentSensitivities: [],
  interests: ['quiet work'],
  retainedWithConsent: false,
};

function readRetainedPassport(): PreferencePassport | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = window.localStorage.getItem(PASSPORT_STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<PreferencePassport>;
    if (!parsed.retainedWithConsent) return undefined;
    return { ...DEFAULT_PASSPORT, ...parsed, priorities: { ...DEFAULT_PASSPORT.priorities, ...parsed.priorities } };
  } catch {
    return undefined;
  }
}

function writeRetainedPassport(passport: PreferencePassport): void {
  if (typeof window === 'undefined') return;
  if (passport.retainedWithConsent) window.localStorage?.setItem(PASSPORT_STORAGE_KEY, JSON.stringify(passport));
  else window.localStorage?.removeItem(PASSPORT_STORAGE_KEY);
}

function newMission(cityId = 'sf', passport = readRetainedPassport() ?? DEFAULT_PASSPORT): Mission {
  return {
    id: uid('mission'),
    goal: 'Find a quiet-work café with healthy morning air and strong street visibility.',
    cityId,
    preferences: { ...passport, priorities: { ...passport.priorities } },
    candidates: [],
    artifacts: [],
    evidence: [],
    status: 'draft',
    campaignReadiness: { status: 'not-ready' },
    scrub: { ...DEFAULT_SCRUB },
  };
}

function evidenceFromScout(candidate: ScoutCandidate): EvidenceRef[] {
  return candidate.evidence.map((frame, index) => ({
    id: `scout:${candidate.id}:${index}`,
    kind: frame.kind === 'aerial' ? 'aerial' : 'streetview',
    provenance: 'observed',
    sourceLabel: frame.kind === 'aerial' ? 'Google Maps aerial imagery' : 'Google Street View',
    confidence: frame.verdict?.confidence,
    location: candidate.loc,
    heading: Number.isFinite(frame.heading) ? frame.heading : undefined,
    imageRef: frame.ref,
    attribution: 'Google Maps',
    limitations: frame.kind === 'photo' ? ['Places photo may not show the current frontage.'] : undefined,
  }));
}

export function missionCandidateFromScout(candidate: ScoutCandidate): MissionCandidate {
  const factors = candidate.scores
    ? {
        visibility: candidate.scores.visibility,
        condition: candidate.scores.condition,
        activity: candidate.scores.activity,
        access: candidate.scores.access,
        environment: candidate.scores.environment,
      }
    : undefined;
  return {
    id: candidate.id,
    label: candidate.label,
    location: candidate.loc,
    place: candidate.place,
    score: candidate.scores?.total,
    confidence: candidate.evidence[0]?.verdict?.confidence,
    rank: candidate.rank,
    inspectionState: candidate.status === 'scored' ? 'scored' : candidate.status === 'inspected' ? 'observed' : 'skeleton',
    factors,
    evidenceIds: candidate.evidence.map((_, index) => `scout:${candidate.id}:${index}`),
    source: 'live',
  };
}

interface MissionState {
  mission: Mission;
  mode: MissionMode;
  start: (input: { goal: string; cityId: string; mode: MissionMode; preferences?: Partial<PreferencePassport> }) => void;
  setMode: (mode: MissionMode) => void;
  updateGoal: (goal: string) => void;
  updatePassport: (patch: Partial<PreferencePassport>) => void;
  updatePriority: (key: string, value: number) => void;
  setRetentionConsent: (consented: boolean) => void;
  forgetPassport: () => void;
  syncScoutCandidates: (candidates: ScoutCandidate[]) => void;
  setCandidates: (candidates: MissionCandidate[]) => void;
  setArea: (area: SpatialConstraint | undefined) => void;
  selectCandidate: (candidateId: string | null) => void;
  updateScrub: (patch: Partial<EnvironmentScrub>) => void;
  setCandidateGeometry: (candidateId: string, geometry: { reachPath?: LatLng[]; routePath?: LatLng[] }) => void;
  setDecision: (decision: Decision | undefined) => void;
  approveDecision: (candidateId: string, rationale?: string) => void;
  undoApproval: () => void;
  addArtifact: (artifact: Omit<MissionArtifact, 'createdAt'> & { createdAt?: string }) => void;
  transition: (event: MissionEvent) => void;
  reset: (cityId?: string) => void;
}

export const useMission = create<MissionState>((set) => ({
  mission: newMission(),
  mode: 'live',
  start: ({ goal, cityId, mode, preferences }) =>
    set((state) => ({
      mode,
      mission: {
        ...newMission(cityId, {
          ...state.mission.preferences,
          ...preferences,
          priorities: { ...state.mission.preferences.priorities, ...preferences?.priorities },
        }),
        goal,
        status: 'observing',
      },
    })),
  setMode: (mode) => set({ mode }),
  updateGoal: (goal) => set((state) => ({ mission: { ...state.mission, goal } })),
  updatePassport: (patch) =>
    set((state) => {
      const preferences = {
        ...state.mission.preferences,
        ...patch,
        priorities: { ...state.mission.preferences.priorities, ...patch.priorities },
      };
      writeRetainedPassport(preferences);
      const prioritiesChanged = patch.priorities != null && Object.entries(patch.priorities)
        .some(([key, value]) => state.mission.preferences.priorities[key] !== value);
      return { mission: prioritiesChanged
        ? reduceMission({ ...state.mission, preferences }, { type: 'invalidate', reason: 'priorities' })
        : { ...state.mission, preferences } };
    }),
  updatePriority: (key, value) =>
    set((state) => {
      const preferences = {
        ...state.mission.preferences,
        priorities: { ...state.mission.preferences.priorities, [key]: Math.max(0, Math.min(100, value)) },
      };
      writeRetainedPassport(preferences);
      return {
        mission: state.mission.preferences.priorities[key] === preferences.priorities[key]
          ? { ...state.mission, preferences }
          : reduceMission({ ...state.mission, preferences }, { type: 'invalidate', reason: 'priorities' }),
      };
    }),
  setRetentionConsent: (consented) =>
    set((state) => {
      const preferences = { ...state.mission.preferences, retainedWithConsent: consented };
      writeRetainedPassport(preferences);
      return { mission: { ...state.mission, preferences } };
    }),
  forgetPassport: () => {
    if (typeof window !== 'undefined') window.localStorage.removeItem(PASSPORT_STORAGE_KEY);
    set((state) => ({
      mission: { ...state.mission, preferences: { ...DEFAULT_PASSPORT, priorities: { ...DEFAULT_PASSPORT.priorities } } },
    }));
  },
  syncScoutCandidates: (candidates) =>
    set((state) => {
      const area = state.mission.area;
      const constrained = area?.kind === 'polygon' && area.path?.length
        ? candidates.filter((candidate) => !candidate.loc || pointInConstraint(candidate.loc, area.path!, area.excludedPaths))
        : candidates;
      const incoming = constrained.map(missionCandidateFromScout);
      const priorCandidates = new Map(state.mission.candidates.map((candidate) => [candidate.id, candidate]));
      const mergedCandidates = incoming.map((candidate) => {
        const prior = priorCandidates.get(candidate.id);
        return prior ? { ...prior, ...candidate, reachPath: prior.reachPath, routePath: prior.routePath } : candidate;
      });
      const incomingEvidence = constrained.flatMap(evidenceFromScout);
      const evidenceById = new Map(state.mission.evidence.map((evidence) => [evidence.id, evidence]));
      incomingEvidence.forEach((evidence) => evidenceById.set(evidence.id, { ...evidenceById.get(evidence.id), ...evidence }));
      const ids = new Set(mergedCandidates.map((candidate) => candidate.id));
      const candidateRemoved = !!state.mission.decision && !ids.has(state.mission.decision.candidateId);
      let mission: Mission = {
        ...state.mission,
        candidates: mergedCandidates,
        evidence: [...evidenceById.values()],
        selectedCandidateId: state.mission.selectedCandidateId && ids.has(state.mission.selectedCandidateId)
          ? state.mission.selectedCandidateId
          : undefined,
      };
      if (candidateRemoved) mission = reduceMission(mission, { type: 'invalidate', reason: 'candidates' });
      else if (['draft', 'observing', 'comparing', 'partial', 'failed'].includes(mission.status)) {
        mission = reduceMission(
          mission,
          constrained.some((candidate) => candidate.status === 'scored') ? { type: 'compare' } : { type: 'observe' },
        );
      }
      return {
        mission,
      };
    }),
  setCandidates: (candidates) => set((state) => {
    const prior = new Map(state.mission.candidates.map((candidate) => [candidate.id, candidate]));
    const merged = candidates.map((candidate) => ({ ...prior.get(candidate.id), ...candidate }));
    return { mission: { ...state.mission, candidates: merged } };
  }),
  setArea: (area) => set((state) => {
    const changed = JSON.stringify(state.mission.area) !== JSON.stringify(area);
    const mission = { ...state.mission, area };
    return { mission: changed ? reduceMission(mission, { type: 'invalidate', reason: 'area' }) : mission };
  }),
  selectCandidate: (candidateId) =>
    set((state) => ({ mission: { ...state.mission, selectedCandidateId: candidateId ?? undefined } })),
  updateScrub: (patch) =>
    set((state) => ({ mission: { ...state.mission, scrub: { ...state.mission.scrub, ...patch } } })),
  setCandidateGeometry: (candidateId, geometry) =>
    set((state) => ({
      mission: {
        ...state.mission,
        candidates: state.mission.candidates.map((candidate) =>
          candidate.id === candidateId ? { ...candidate, ...geometry } : candidate,
        ),
      },
    })),
  setDecision: (decision) => set((state) => ({ mission: { ...state.mission, decision } })),
  approveDecision: (candidateId, rationale) => set((state) => {
    const candidate = state.mission.candidates.find((item) => item.id === candidateId);
    if (!candidate || candidate.inspectionState !== 'scored') return state;
    return {
      mission: reduceMission(state.mission, {
        type: 'approve',
        decision: { candidateId, rationale, approvedAt: new Date().toISOString() },
      }),
    };
  }),
  undoApproval: () => set((state) => ({ mission: reduceMission(state.mission, { type: 'undo-approval' }) })),
  addArtifact: (artifact) =>
    set((state) => ({
      mission: {
        ...state.mission,
        artifacts: [
          ...state.mission.artifacts.filter((item) => item.id !== artifact.id),
          { ...artifact, createdAt: artifact.createdAt ?? new Date().toISOString() },
        ],
      },
    })),
  transition: (event) => set((state) => ({ mission: reduceMission(state.mission, event) })),
  reset: (cityId) => set((state) => ({ mission: newMission(cityId ?? state.mission.cityId), mode: 'live' })),
}));

const DOWNSTREAM_ARTIFACTS = new Set<MissionArtifact['kind']>(['site-selection', 'campaign', 'route-reach', 'share', 'reveal']);

/** The sole lifecycle transition authority for mission state. */
export function reduceMission(mission: Mission, event: MissionEvent): Mission {
  switch (event.type) {
    case 'launch': return { ...mission, status: 'observing', error: undefined, invalidation: undefined };
    case 'observe': return mission.status === 'draft' ? mission : { ...mission, status: 'observing', error: undefined };
    case 'compare': return mission.status === 'draft' ? mission : { ...mission, status: 'comparing', error: undefined };
    case 'approve': return { ...mission, status: 'approved', decision: event.decision, error: undefined, invalidation: undefined };
    case 'invalidate':
      return {
        ...mission,
        status: mission.candidates.length ? 'comparing' : 'observing',
        decision: undefined,
        artifacts: mission.artifacts.filter((artifact) => !DOWNSTREAM_ARTIFACTS.has(artifact.kind)),
        campaignReadiness: { status: 'not-ready' },
        invalidation: { reason: event.reason, invalidatedAt: event.at ?? new Date().toISOString() },
        error: undefined,
      };
    case 'create-campaign': return { ...mission, status: 'creating', campaignReadiness: { status: 'creating' }, error: undefined };
    case 'complete': return {
      ...mission,
      status: 'complete',
      campaignReadiness: event.campaignArtifactId
        ? { status: 'ready', artifactId: event.campaignArtifactId }
        : mission.campaignReadiness,
      error: undefined,
    };
    case 'undo-approval': return {
      ...mission,
      status: mission.candidates.length ? 'comparing' : 'observing',
      decision: undefined,
      artifacts: mission.artifacts.filter((artifact) => !DOWNSTREAM_ARTIFACTS.has(artifact.kind)),
      campaignReadiness: { status: 'not-ready' },
      error: undefined,
    };
    case 'partial': return { ...mission, status: 'partial' };
    case 'resume': return { ...mission, status: mission.candidates.length ? 'comparing' : 'observing', error: undefined };
    case 'fail': return {
      ...mission,
      status: 'failed',
      error: { ...event.error, occurredAt: event.error.occurredAt ?? new Date().toISOString() },
      campaignReadiness: mission.status === 'creating' ? { status: 'failed' } : mission.campaignReadiness,
    };
  }
}

export const missionStore = useMission.getState;

export function missionPromptContext(): string {
  const { mission, mode } = useMission.getState();
  if (mission.status === 'draft') return '';
  const p = mission.preferences;
  const priorities = Object.entries(p.priorities)
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => `${key}=${value}`)
    .join(', ');
  return [
    '--- Active mission (application-owned state) ---',
    `Mission id: ${mission.id}`,
    `Mode: ${mode === 'demo' ? 'DEMO — deterministic fixtures, never claim live observations' : 'LIVE'}`,
    `Goal: ${mission.goal}`,
    `City id: ${mission.cityId}`,
    `Travel preference: ${p.travelModes.join('/')} (${p.maxTravelMinutes == null ? 'no eligibility limit' : `${p.maxTravelMinutes}-minute target; advisory until route eligibility is implemented`})`,
    `Priorities: ${priorities}`,
    `Accessibility preferences (not verified constraints): ${p.accessibility.join(', ') || 'none specified'}`,
    `Environment preferences (ranking signals, not guarantees): ${p.environmentSensitivities.join(', ') || 'none specified'}`,
    `Mission status: ${mission.status}`,
    mission.area?.kind === 'polygon' && mission.area.path?.length
      ? `Spatial constraint (application-drawn): outer=${JSON.stringify(mission.area.path)}; exclusions=${JSON.stringify(mission.area.excludedPaths ?? [])}; center=${JSON.stringify(mission.area.center)}`
      : mission.area?.kind === 'circle'
        ? `Spatial constraint (application-owned): center=${JSON.stringify(mission.area.center)}; radiusM=${mission.area.radiusM ?? 'unspecified'}`
        : 'Spatial constraint: none',
    'Use only explicitly supplied values. Treat only application-enforced fields as hard constraints.',
  ].join('\n');
}

export function prioritiesToRubric(priorities: Record<string, number>): RubricWeights {
  const keys: (keyof RubricWeights)[] = ['visibility', 'condition', 'activity', 'access', 'environment'];
  const total = keys.reduce((sum, key) => sum + Math.max(0, priorities[key] ?? 0), 0) || 1;
  return Object.fromEntries(keys.map((key) => [key, Math.max(0, priorities[key] ?? 0) / total])) as unknown as RubricWeights;
}
