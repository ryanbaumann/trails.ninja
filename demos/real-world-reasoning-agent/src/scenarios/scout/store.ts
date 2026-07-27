import { create } from 'zustand';
import type { LatLng, PlaceLite } from '@/lib/types';
import type { VisionVerdict } from '@/ai/vision';

export type CandidateStatus = 'pending' | 'inspected' | 'scored';

/** What kind of imagery a frame is, for labeling in evidence surfaces. */
export type EvidenceKind = 'street' | 'aerial' | 'photo';

export interface EvidenceFrame {
  url: string; // streetViewUrl / staticMap aerial (or Places photo fallback) actually fetched
  ref?: string; // img:<id> registry ref (WS0 src/genui/images.ts)
  heading: number; // compass heading this frame looked toward, 0=N (NaN for aerial/photo)
  kind?: EvidenceKind; // defaults to 'street' when omitted
  verdict?: VisionVerdict;
}

export interface CandidateScores {
  visibility: number;
  condition: number;
  activity: number;
  access: number;
  environment: number;
  total: number;
}

export interface Candidate {
  id: string;
  place?: PlaceLite;
  loc: LatLng;
  label: string;
  status: CandidateStatus;
  evidence: EvidenceFrame[];
  scores?: CandidateScores;
  rank?: number;
  videoRef?: string; // img:<id> registry ref to the generated walkthrough clip
}

export interface RubricWeights {
  visibility: number;
  condition: number;
  activity: number;
  access: number;
  environment: number;
}

export interface ScoutArea {
  center: LatLng;
  radiusM: number;
  query: string;
}

/** Default weights sum to 1 — kept as the demo's starting rubric. */
export const DEFAULT_WEIGHTS: RubricWeights = {
  visibility: 0.25,
  condition: 0.2,
  activity: 0.25,
  access: 0.2,
  environment: 0.1,
};

export const INSPECTION_CAP = 6;

interface ScoutState {
  candidates: Candidate[];
  rubricWeights: RubricWeights;
  area?: ScoutArea;
  inspectionsUsed: number;

  setCandidates: (c: Candidate[]) => void;
  addCandidate: (c: Candidate) => void;
  patchCandidate: (id: string, patch: Partial<Candidate>) => void;
  setArea: (a: ScoutArea) => void;
  setWeights: (w: RubricWeights) => void;
  incrementInspections: () => void;
  reset: () => void;
}

export const useScout = create<ScoutState>((set) => ({
  candidates: [],
  rubricWeights: DEFAULT_WEIGHTS,
  area: undefined,
  inspectionsUsed: 0,

  setCandidates: (c) => set({ candidates: c }),
  addCandidate: (c) => set((s) => ({ candidates: [...s.candidates, c] })),
  patchCandidate: (id, patch) =>
    set((s) => ({
      candidates: s.candidates.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    })),
  setArea: (a) => set({ area: a }),
  setWeights: (w) => set({ rubricWeights: w }),
  incrementInspections: () => set((s) => ({ inspectionsUsed: s.inspectionsUsed + 1 })),
  reset: () => set({ candidates: [], rubricWeights: DEFAULT_WEIGHTS, area: undefined, inspectionsUsed: 0 }),
}));

export const scout = useScout.getState;
