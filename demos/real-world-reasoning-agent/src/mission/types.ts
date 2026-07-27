import type { LatLng, PlaceLite } from '@/lib/types';

export type MissionStatus =
  | 'draft'
  | 'observing'
  | 'comparing'
  | 'approved'
  | 'creating'
  | 'complete'
  | 'partial'
  | 'failed';

export interface MissionError {
  code: string;
  message: string;
  retryable: boolean;
  occurredAt: string;
}

export interface MissionInvalidation {
  reason: 'area' | 'priorities' | 'candidates';
  invalidatedAt: string;
}

export interface CampaignReadiness {
  status: 'not-ready' | 'creating' | 'ready' | 'failed';
  artifactId?: string;
}

export type MissionEvent =
  | { type: 'launch' }
  | { type: 'observe' }
  | { type: 'compare' }
  | { type: 'approve'; decision: Decision }
  | { type: 'invalidate'; reason: MissionInvalidation['reason']; at?: string }
  | { type: 'create-campaign' }
  | { type: 'complete'; campaignArtifactId?: string }
  | { type: 'undo-approval' }
  | { type: 'partial' }
  | { type: 'resume' }
  | { type: 'fail'; error: Omit<MissionError, 'occurredAt'> & { occurredAt?: string } };

export type MissionMode = 'live' | 'demo';

export interface SpatialConstraint {
  kind: 'circle' | 'polygon';
  center?: LatLng;
  radiusM?: number;
  path?: LatLng[];
  excludedPaths?: LatLng[][];
}

export interface PreferencePassport {
  travelModes: string[];
  maxTravelMinutes?: number;
  budget?: string;
  priorities: Record<string, number>;
  accessibility: string[];
  environmentSensitivities: string[];
  interests: string[];
  retainedWithConsent: boolean;
}

export interface EvidenceRef {
  id: string;
  kind: 'place' | 'streetview' | 'aerial' | 'route' | 'weather' | 'air' | 'pollen' | 'solar';
  provenance: 'observed' | 'computed' | 'inferred' | 'generated';
  sourceLabel: string;
  /** Capture timestamp when the provider actually returns one (imagery date, etc.). */
  observedAt?: string;
  confidence?: number;
  location?: LatLng;
  /** Camera compass heading in degrees for directional (Street View) frames. */
  heading?: number;
  imageRef?: string;
  attribution?: string;
  limitations?: string[];
}

export interface MissionCandidate {
  id: string;
  label: string;
  location?: LatLng;
  place?: PlaceLite;
  score?: number;
  confidence?: number;
  rank?: number;
  inspectionState: 'skeleton' | 'observed' | 'scored';
  factors?: Record<string, number>;
  evidenceIds: string[];
  source: MissionMode;
  /** Provider-backed inputs available for truthful current-evidence controls. */
  observedSignals?: {
    hours?: { valid: boolean; openAtHours?: number[] };
    weather?: boolean;
    traffic?: boolean;
    sun?: boolean;
  };
  /** Walking-reach hull around the candidate (approx isochrone), rendered on the map. */
  reachPath?: LatLng[];
  /** Suggested walking route from the area anchor to the candidate. */
  routePath?: LatLng[];
}

/**
 * A scrub-able snapshot of the conditions a decision is made under. Editing it
 * lets the operator preview how time/weather/traffic change the comparison
 * (a "before/after disruption" view) without re-running the model.
 */
export interface EnvironmentScrub {
  /** Hour of day, 0–23. */
  hour: number;
  weather: 'clear' | 'rain' | 'heat' | 'wind';
  /** Only weigh candidates that would be open at the scrubbed hour. */
  openOnly: boolean;
  traffic: 'light' | 'moderate' | 'heavy';
  /** Relative sun elevation, drives glare/shade weighting. */
  sun: 'low' | 'mid' | 'high';
}

export interface Decision {
  candidateId: string;
  rationale?: string;
  approvedAt?: string;
}

export interface MissionArtifact {
  id: string;
  kind: 'site-selection' | 'campaign' | 'route-reach' | 'share' | 'walkthrough' | 'reveal';
  label: string;
  ref?: string;
  createdAt: string;
}

export interface Mission {
  id: string;
  goal: string;
  cityId: string;
  area?: SpatialConstraint;
  preferences: PreferencePassport;
  candidates: MissionCandidate[];
  decision?: Decision;
  artifacts: MissionArtifact[];
  evidence: EvidenceRef[];
  status: MissionStatus;
  error?: MissionError;
  invalidation?: MissionInvalidation;
  campaignReadiness: CampaignReadiness;
  /** Candidate currently focused for inspection (Claim Lens / map selection). */
  selectedCandidateId?: string;
  /** Conditions the current comparison is framed under. */
  scrub: EnvironmentScrub;
}
