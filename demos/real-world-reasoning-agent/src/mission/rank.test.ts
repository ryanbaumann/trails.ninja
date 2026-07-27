import { describe, expect, it } from 'vitest';
import { rerankMissionCandidates } from './rank';
import type { MissionCandidate } from './types';

const candidate = (id: string, factors?: Record<string, number>): MissionCandidate => ({
  id,
  label: id,
  inspectionState: factors ? 'scored' : 'skeleton',
  factors,
  evidenceIds: [],
  source: 'demo',
});

describe('rerankMissionCandidates', () => {
  it('reranks locally when the preference weights change', () => {
    const values = [candidate('visible', { visibility: 10, access: 2 }), candidate('accessible', { visibility: 2, access: 10 })];

    const visibilityFirst = rerankMissionCandidates(values, { visibility: 100, access: 0 });
    const accessFirst = rerankMissionCandidates(values, { visibility: 0, access: 100 });

    expect(visibilityFirst.find((item) => item.id === 'visible')?.rank).toBe(1);
    expect(accessFirst.find((item) => item.id === 'accessible')?.rank).toBe(1);
  });

  it('keeps input order for ties and leaves skeletons unranked', () => {
    const ranked = rerankMissionCandidates(
      [candidate('first', { access: 5 }), candidate('second', { access: 5 }), candidate('skeleton')],
      { access: 100 },
    );
    expect(ranked.map((item) => item.rank)).toEqual([1, 2, undefined]);
  });
});

