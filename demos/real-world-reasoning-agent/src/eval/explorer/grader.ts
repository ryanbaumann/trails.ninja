import type { EvalResult, ExplorerEvalDimension, ExplorerEvalScore, ExplorerEvalTrace } from './types';

const CORE_PROFILE = [
  'world.grounding.places.search@1',
  'world.grounding.routes.compute@1',
  'world.presentation.explorer@1',
];

function same(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function gradeExplorerTrace(trace: ExplorerEvalTrace): ExplorerEvalScore {
  const mapApplicable = trace.firstMapEffectMs !== undefined;
  const counterfactual = trace.counterfactual;
  const expectedProfile = trace.expectedTerminal === 'needs-clarification'
    ? ['world.presentation.explorer@1']
    : [
      ...CORE_PROFILE.slice(0, 2),
      ...(trace.expectedWeatherRequested ? ['world.grounding.weather.lookup@1'] : []),
      CORE_PROFILE[2],
    ];
  const dimensions: Record<ExplorerEvalDimension, EvalResult> = {
    taskCompleted: trace.terminal === trace.expectedTerminal
      && (trace.expectedRecommendationId === undefined || trace.recommendationId === trace.expectedRecommendationId)
      && (trace.terminal !== 'ready' || Boolean(trace.recommendationId)) ? 'pass' : 'fail',
    sourceIntegrity: trace.groundedClaims === 0
      ? trace.limitationsVisible || trace.terminal === 'needs-clarification' ? 'pass' : 'fail'
      : trace.visibleSources >= trace.groundedClaims && trace.sourcesAdjacent && trace.limitationsVisible ? 'pass' : 'fail',
    constraintFidelity: trace.hardConstraintViolations === 0 ? 'pass' : 'fail',
    promptFidelity: trace.travelMode === trace.expectedTravelMode
      && trace.weatherRequested === trace.expectedWeatherRequested
      && trace.weatherLookups === trace.expectedWeatherLookups ? 'pass' : 'fail',
    groundedSpecificity: trace.candidateCount > 0
      ? trace.genericCandidateLabels === 0 ? 'pass' : 'fail'
      : 'na',
    candidateDifferentiation: trace.candidateCount >= 2
      ? trace.distinctVerifiedDurations >= 2 ? 'pass' : 'fail'
      : 'na',
    toolDependencyOrder: trace.dependencyOrderValid ? 'pass' : 'fail',
    surfaceOwnership: new Set(trace.surfaceIds).size === 1 && trace.surfaceIds.length > 0 ? 'pass' : 'fail',
    uiFinalConsistency: trace.recommendationId
      ? trace.surfaceRecommendationId === trace.recommendationId && trace.mapWinnerId === trace.recommendationId ? 'pass' : 'fail'
      : trace.surfaceRecommendationId === undefined && trace.mapWinnerId === undefined ? 'pass' : 'fail',
    comprehensionProxy: trace.explanationVisible && trace.limitationsVisible ? 'pass' : 'fail',
    firstMapEffectWithinSlo: mapApplicable ? trace.firstMapEffectMs! <= 3_000 ? 'pass' : 'fail' : 'na',
    recoveryComplete: !trace.resumeRequired && !trace.rawToolTranscriptVisible ? 'pass' : 'fail',
    counterfactualCoherent: counterfactual
      ? counterfactual.reusedSurface
        && trace.providerSearches === 0
        && counterfactual.previousWinnerId !== trace.recommendationId
        && trace.mapWinnerId === trace.recommendationId ? 'pass' : 'fail'
      : 'na',
    minimalCapabilityProfile: same(trace.capabilityProfile, expectedProfile) ? 'pass' : 'fail',
  };
  return { caseId: trace.caseId, dimensions };
}

export function evaluateExplorerTraces(traces: ExplorerEvalTrace[]) {
  const scores = traces.map(gradeExplorerTrace);
  const dimensions = Object.keys(scores[0]?.dimensions ?? {}) as ExplorerEvalDimension[];
  const timings = traces.flatMap((trace) => trace.firstMapEffectMs === undefined ? [] : [trace.firstMapEffectMs]).sort((a, b) => a - b);
  return {
    total: scores.length,
    perfect: scores.filter((score) => Object.values(score.dimensions).every((value) => value !== 'fail')).length,
    p75FirstMapEffectMs: timings.length ? timings[Math.ceil(timings.length * 0.75) - 1] : null,
    byDimension: Object.fromEntries(dimensions.map((dimension) => {
      const applicable = scores.filter((score) => score.dimensions[dimension] !== 'na');
      return [dimension, {
        passed: applicable.filter((score) => score.dimensions[dimension] === 'pass').length,
        applicable: applicable.length,
      }];
    })),
    scores,
  };
}
