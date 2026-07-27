import { describe, expect, it, beforeEach } from 'vitest';
import { compareSites } from './controller';
import { useScout, type Candidate, type CandidateScores } from './store';

const scores = (total: number): CandidateScores => ({
  visibility: total,
  condition: total,
  activity: total,
  access: total,
  environment: total,
  total,
});

function candidate(id: string, rank: number | undefined, total: number): Candidate {
  return {
    id,
    loc: { lat: 37.8, lng: -122.4 },
    label: `Site ${id}`,
    status: rank == null ? 'inspected' : 'scored',
    evidence: [],
    ...(rank == null ? {} : { rank, scores: scores(total) }),
  };
}

describe('compareSites', () => {
  beforeEach(() => useScout.getState().reset());

  it('errors when nothing is scored yet', () => {
    useScout.setState({ candidates: [candidate('a', undefined, 0)] });
    const res = compareSites();
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/score_candidates first/);
  });

  it('errors when only one site is scored', () => {
    useScout.setState({ candidates: [candidate('a', 1, 8), candidate('b', undefined, 0)] });
    const res = compareSites();
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/at least two/);
  });

  it('returns rows ordered by rank with the rank-1 site as the winner', () => {
    // Deliberately out of order to prove it sorts by rank, not insertion order.
    useScout.setState({
      candidates: [candidate('b', 2, 6), candidate('a', 1, 9), candidate('c', 3, 4)],
      area: { center: { lat: 37.8, lng: -122.4 }, radiusM: 500, query: 'espresso bar' },
    });
    const res = compareSites();
    expect(res.ok).toBe(true);
    expect(res.rows?.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(res.rows?.map((r) => r.candidateId)).toEqual(['a', 'b', 'c']);
    expect(res.winner?.candidateId).toBe('a');
    expect(res.winner?.total).toBe(9);
    expect(res.area).toBe('espresso bar');
  });
});
