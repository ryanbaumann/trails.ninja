import type { MissionCandidate } from './types';

/** Re-score already-computed factors locally. No model or Maps call is needed for a counterfactual weight change. */
export function rerankMissionCandidates(
  candidates: MissionCandidate[],
  priorities: Record<string, number>,
): MissionCandidate[] {
  const scored = candidates
    .map((candidate, index) => ({ candidate, index, score: weightedScore(candidate.factors, priorities) }))
    .filter((row): row is { candidate: MissionCandidate; index: number; score: number } => row.score != null)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const byId = new Map(scored.map((row, index) => [row.candidate.id, { score: row.score, rank: index + 1 }]));
  return candidates.map((candidate) => {
    const result = byId.get(candidate.id);
    return result ? { ...candidate, score: result.score, rank: result.rank, inspectionState: 'scored' } : candidate;
  });
}

function weightedScore(factors: Record<string, number> | undefined, priorities: Record<string, number>): number | undefined {
  if (!factors) return undefined;
  let weighted = 0;
  let totalWeight = 0;
  for (const [key, value] of Object.entries(factors)) {
    const weight = Math.max(0, priorities[key] ?? 0);
    weighted += value * weight;
    totalWeight += weight;
  }
  return totalWeight ? Math.round((weighted / totalWeight) * 10) / 10 : undefined;
}

