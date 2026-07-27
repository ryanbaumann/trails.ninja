import { describe, expect, it } from 'vitest';
import { fuseScores } from './fuseScores';
import { DEFAULT_WEIGHTS } from './store';

describe('fuseScores', () => {
  it('gives a perfect candidate a total near 100', () => {
    const result = fuseScores(
      {
        vision: { visibility: 10, condition: 10, activity: 10 },
        density: { complementary: 5, competitor: 0 },
        env: { aqi: 0, pollenIndex: 0 },
        accessMinutes: 0,
      },
      DEFAULT_WEIGHTS,
    );
    expect(result.visibility).toBe(100);
    expect(result.condition).toBe(100);
    expect(result.access).toBe(100);
    expect(result.environment).toBe(100);
    // Activity intentionally blends vision (100) with Places density, which tops
    // out slightly below 100, so a "perfect" candidate lands in the high 90s.
    expect(result.total).toBeGreaterThanOrEqual(98);
  });

  it('gives a worst-case candidate a total near 0', () => {
    const result = fuseScores(
      {
        vision: { visibility: 0, condition: 0, activity: 0 },
        density: { complementary: 0, competitor: 20 },
        env: { aqi: 300, pollenIndex: 5 },
        accessMinutes: 30,
      },
      DEFAULT_WEIGHTS,
    );
    expect(result.visibility).toBe(0);
    expect(result.condition).toBe(0);
    expect(result.access).toBe(0);
    expect(result.environment).toBe(0);
    expect(result.total).toBeLessThan(5);
  });

  it('falls back to neutral midpoints when access/environment data is missing', () => {
    const result = fuseScores(
      {
        vision: { visibility: 5, condition: 5, activity: 5 },
        density: { complementary: 0, competitor: 0 },
        env: {},
        accessMinutes: undefined,
      },
      DEFAULT_WEIGHTS,
    );
    expect(result.access).toBe(50);
    expect(result.environment).toBe(70);
  });

  it('respects weighting: a visibility-only weight vector reduces to the visibility sub-score', () => {
    const inputs = {
      vision: { visibility: 8, condition: 2, activity: 1 },
      density: { complementary: 0, competitor: 0 },
      env: { aqi: 100, pollenIndex: 2 },
      accessMinutes: 10,
    };
    const visibilityOnly = fuseScores(inputs, {
      visibility: 1,
      condition: 0,
      activity: 0,
      access: 0,
      environment: 0,
    });
    expect(visibilityOnly.total).toBe(visibilityOnly.visibility);
    expect(visibilityOnly.visibility).toBe(80);
  });

  it('normalizes 0-100 preference weights instead of saturating the total', () => {
    const inputs = {
      vision: { visibility: 6, condition: 5, activity: 4 },
      density: { complementary: 1, competitor: 1 },
      env: { aqi: 60, pollenIndex: 2 },
      accessMinutes: 10,
    };
    const rawPriorities = {
      visibility: 80,
      condition: 55,
      activity: 45,
      access: 75,
      environment: 70,
    };
    const total = Object.values(rawPriorities).reduce((sum, value) => sum + value, 0);
    const normalized = Object.fromEntries(
      Object.entries(rawPriorities).map(([key, value]) => [key, value / total]),
    ) as typeof rawPriorities;

    const fromRawPriorities = fuseScores(inputs, rawPriorities);
    const fromNormalizedWeights = fuseScores(inputs, normalized);

    expect(fromRawPriorities.total).toBe(fromNormalizedWeights.total);
    expect(fromRawPriorities.total).toBeLessThan(100);
  });

  it('increasing complementary density raises activity; increasing competitor density lowers it', () => {
    const base = {
      vision: { visibility: 5, condition: 5, activity: 5 },
      env: {},
      accessMinutes: 10,
    };
    const withComplementary = fuseScores({ ...base, density: { complementary: 5, competitor: 0 } }, DEFAULT_WEIGHTS);
    const withCompetitor = fuseScores({ ...base, density: { complementary: 0, competitor: 5 } }, DEFAULT_WEIGHTS);
    const neutral = fuseScores({ ...base, density: { complementary: 0, competitor: 0 } }, DEFAULT_WEIGHTS);
    expect(withComplementary.activity).toBeGreaterThan(neutral.activity);
    expect(withCompetitor.activity).toBeLessThan(neutral.activity);
  });

  it('total is clamped to [0, 100] even with out-of-range inputs', () => {
    const result = fuseScores(
      {
        vision: { visibility: 999, condition: 999, activity: 999 },
        density: { complementary: 999, competitor: 0 },
        env: { aqi: -999, pollenIndex: -999 },
        accessMinutes: -999,
      },
      DEFAULT_WEIGHTS,
    );
    expect(result.total).toBeLessThanOrEqual(100);
    expect(result.total).toBeGreaterThanOrEqual(0);
  });
});
