import { describe, expect, it } from 'vitest';
import baseline from '../../../eval/explorer/baseline.json';
import cases from '../../../eval/explorer/cases.json';
import { executeExplorerEval } from './harness';
import { evaluateExplorerTraces, gradeExplorerTrace } from './grader';
import type { ExplorerEvalCase } from './harness';
import type { ExplorerEvalDimension, ExplorerEvalScore } from './types';

describe('independent explorer evaluator', () => {
  it('reports a locked per-dimension delta for the executable synthetic cases', async () => {
    const traces = await executeExplorerEval(cases as ExplorerEvalCase[]);
    const report = evaluateExplorerTraces(traces);
    expect(report).toMatchObject({ total: 7, perfect: 7, p75FirstMapEffectMs: 0 });
    expect(report.byDimension.counterfactualCoherent).toEqual({ passed: 1, applicable: 1 });

    const baselineScores = baseline as ExplorerEvalScore[];
    expect(new Set(baselineScores.map((score) => score.caseId))).toEqual(new Set(cases.map((item) => item.id)));
    for (const dimension of Object.keys(report.byDimension) as ExplorerEvalDimension[]) {
      const before = baselineScores.filter((score) => score.dimensions[dimension] === 'pass').length;
      expect(report.byDimension[dimension].passed).toBeGreaterThanOrEqual(before);
    }
  });

  it('isolates a stale counterfactual map selection', () => {
    const score = gradeExplorerTrace({
      caseId: 'mutation', expectedTerminal: 'ready', terminal: 'ready',
      expectedTravelMode: 'WALK', travelMode: 'WALK',
      expectedWeatherRequested: true, weatherRequested: true,
      expectedWeatherLookups: 1, weatherLookups: 1,
      expectedRecommendationId: 'b',
      capabilityProfile: ['world.grounding.places.search@1', 'world.grounding.routes.compute@1', 'world.grounding.weather.lookup@1', 'world.presentation.explorer@1'],
      surfaceIds: ['universal-explorer'], providerSearches: 0, groundedClaims: 1, visibleSources: 1,
      sourcesAdjacent: true, limitationsVisible: true, hardConstraintViolations: 0, candidateCount: 2,
      genericCandidateLabels: 0,
      distinctVerifiedDurations: 2, dependencyOrderValid: true, explanationVisible: true,
      recommendationId: 'b', surfaceRecommendationId: 'b', mapWinnerId: 'a',
      rawToolTranscriptVisible: false, resumeRequired: false,
      counterfactual: { previousWinnerId: 'a', reusedSurface: true },
    });
    expect(score.dimensions.counterfactualCoherent).toBe('fail');
    expect(Object.entries(score.dimensions).filter(([, value]) => value === 'fail').map(([key]) => key))
      .toEqual(['uiFinalConsistency', 'counterfactualCoherent']);
  });
});
