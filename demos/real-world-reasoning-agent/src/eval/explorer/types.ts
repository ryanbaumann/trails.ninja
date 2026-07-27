import type { ExplorerTravelMode } from '@/explorer/contracts';

export type EvalResult = 'pass' | 'fail' | 'na';

export interface ExplorerEvalTrace {
  caseId: string;
  expectedTerminal: string;
  terminal: string;
  expectedTravelMode: ExplorerTravelMode;
  travelMode: ExplorerTravelMode;
  expectedWeatherRequested: boolean;
  weatherRequested: boolean;
  expectedWeatherLookups: number;
  weatherLookups: number;
  expectedRecommendationId?: string;
  capabilityProfile: string[];
  surfaceIds: string[];
  firstMapEffectMs?: number;
  providerSearches: number;
  groundedClaims: number;
  visibleSources: number;
  sourcesAdjacent: boolean;
  limitationsVisible: boolean;
  hardConstraintViolations: number;
  candidateCount: number;
  genericCandidateLabels: number;
  distinctVerifiedDurations: number;
  dependencyOrderValid: boolean;
  explanationVisible: boolean;
  surfaceRecommendationId?: string;
  rawToolTranscriptVisible: boolean;
  resumeRequired: boolean;
  recommendationId?: string;
  mapWinnerId?: string;
  counterfactual?: { previousWinnerId?: string; reusedSurface: boolean };
}

export type ExplorerEvalDimension =
  | 'taskCompleted'
  | 'sourceIntegrity'
  | 'constraintFidelity'
  | 'promptFidelity'
  | 'groundedSpecificity'
  | 'candidateDifferentiation'
  | 'toolDependencyOrder'
  | 'surfaceOwnership'
  | 'uiFinalConsistency'
  | 'comprehensionProxy'
  | 'firstMapEffectWithinSlo'
  | 'recoveryComplete'
  | 'counterfactualCoherent'
  | 'minimalCapabilityProfile';

export interface ExplorerEvalScore {
  caseId: string;
  dimensions: Record<ExplorerEvalDimension, EvalResult>;
}
