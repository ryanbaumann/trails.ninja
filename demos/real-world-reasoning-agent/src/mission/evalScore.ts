import { rerankMissionCandidates } from './rank';
import type { MissionCandidate } from './types';

export interface MissionEvalCase {
  id: string;
  goal: string;
  cityId: string;
  priorities: Record<string, number>;
  candidates: { id: string; label: string; factors: Record<string, number> }[];
  expectedWinnerId: string;
}

/**
 * Predict which candidate should win given the priorities.
 * Uses the real production reranking logic.
 */
export function predictWinner(c: MissionEvalCase): string {
  const candidates: MissionCandidate[] = c.candidates.map((cand) => ({
    id: cand.id,
    label: cand.label,
    factors: cand.factors,
    inspectionState: 'scored' as const,
    evidenceIds: [],
    source: 'demo' as const,
  }));

  const ranked = rerankMissionCandidates(candidates, c.priorities);
  const winner = ranked.find((cand) => cand.rank === 1);
  return winner?.id ?? ranked[0]?.id ?? c.candidates[0].id;
}

/**
 * Score a single case: compare predicted winner to expected winner.
 */
export function scoreCase(c: MissionEvalCase): {
  id: string;
  predicted: string;
  expected: string;
  correct: boolean;
} {
  const predicted = predictWinner(c);
  return {
    id: c.id,
    predicted,
    expected: c.expectedWinnerId,
    correct: predicted === c.expectedWinnerId,
  };
}

/**
 * Evaluate the entire dataset.
 * Returns top-1 accuracy and a list of failures.
 */
export function evaluate(cases: MissionEvalCase[]): {
  total: number;
  correct: number;
  top1Accuracy: number;
  failures: { id: string; predicted: string; expected: string }[];
} {
  const results = cases.map(scoreCase);
  const correct = results.filter((r) => r.correct).length;
  const failures = results.filter((r) => !r.correct).map((r) => ({
    id: r.id,
    predicted: r.predicted,
    expected: r.expected,
  }));

  return {
    total: cases.length,
    correct,
    top1Accuracy: cases.length > 0 ? correct / cases.length : 0,
    failures,
  };
}
