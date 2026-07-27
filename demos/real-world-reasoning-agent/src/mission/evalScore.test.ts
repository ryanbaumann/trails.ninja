import { describe, expect, it } from 'vitest';
import cases from '../../eval/missions.json';
import { evaluate, type MissionEvalCase } from './evalScore';

const dataset = cases as unknown as MissionEvalCase[];

describe('Mission candidate reranking evaluation', () => {
  it('has 30-50 cases', () => {
    expect(dataset.length).toBeGreaterThanOrEqual(30);
    expect(dataset.length).toBeLessThanOrEqual(50);
  });

  it('has valid structure for every case', () => {
    const caseIds = new Set<string>();
    for (const testCase of dataset) {
      // No duplicate case ids
      expect(caseIds.has(testCase.id)).toBe(false);
      caseIds.add(testCase.id);

      // Each case has 3-5 candidates
      expect(testCase.candidates.length).toBeGreaterThanOrEqual(3);
      expect(testCase.candidates.length).toBeLessThanOrEqual(5);

      // expectedWinnerId exists among candidates
      const candidateIds = testCase.candidates.map((c) => c.id);
      expect(candidateIds).toContain(testCase.expectedWinnerId);

      // All candidates have factors
      for (const candidate of testCase.candidates) {
        expect(candidate.factors).toBeDefined();
        expect(typeof candidate.factors).toBe('object');
      }
    }
  });

  it('achieves 100% top-1 accuracy (baseline consistency check)', () => {
    const result = evaluate(dataset);

    // If this assertion fails, debug output:
    if (result.failures.length > 0) {
      console.error('Baseline failures detected:');
      for (const failure of result.failures) {
        console.error(`  Case ${failure.id}: expected ${failure.expected}, got ${failure.predicted}`);
      }
    }

    // The dataset is hand-built to be self-consistent with the reranker logic.
    // If this fails, the expectedWinnerId values are wrong.
    expect(result.top1Accuracy).toBe(1);
    expect(result.correct).toBe(result.total);
    expect(result.failures).toHaveLength(0);
  });
});
