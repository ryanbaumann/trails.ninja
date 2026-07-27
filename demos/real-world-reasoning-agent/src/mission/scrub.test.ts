import { describe, it, expect } from 'vitest';
import { scrubbedFactors, scrubbedScore, disruptionDelta } from './scrub';
import type { EnvironmentScrub, MissionCandidate } from './types';
import { DEFAULT_SCRUB } from './store';

function candidate(
  id: string,
  factors: Record<string, number>,
  observedSignals?: MissionCandidate['observedSignals'],
): MissionCandidate {
  return { id, label: id, inspectionState: 'scored', evidenceIds: [], source: 'demo', factors, observedSignals };
}

const baseScrub: EnvironmentScrub = {
  hour: 12,
  weather: 'clear',
  openOnly: false,
  traffic: 'moderate',
  sun: 'mid',
};

const baseFactors = {
  visibility: 80,
  condition: 70,
  activity: 60,
  access: 75,
  environment: 65,
};

describe('scrubbedFactors', () => {
  it('should clamp values to 0..100 range', () => {
    const factors = { visibility: 95, access: 90 };
    const scrub: EnvironmentScrub = { ...baseScrub, sun: 'high' };
    const result = scrubbedFactors(factors, scrub);
    // high sun applies 1.10 multiplier to visibility: 95 * 1.10 = 104.5 → clamped to 100
    expect(result.visibility).toBe(100);
  });

  it('should reduce access and activity on rain', () => {
    const scrub: EnvironmentScrub = { ...baseScrub, weather: 'rain' };
    const result = scrubbedFactors(baseFactors, scrub);
    // Rain: access *= 0.75, activity *= 0.80
    expect(result.access).toBeLessThan(baseFactors.access);
    expect(result.activity).toBeLessThan(baseFactors.activity);
    expect(result.access).toBe(75 * 0.75); // 56.25
    expect(result.activity).toBe(60 * 0.80); // 48
  });

  it('should reduce environment on heat', () => {
    const scrub: EnvironmentScrub = { ...baseScrub, weather: 'heat' };
    const result = scrubbedFactors(baseFactors, scrub);
    expect(result.environment).toBeLessThan(baseFactors.environment);
    expect(result.environment).toBe(65 * 0.70); // 45.5
  });

  it('should reduce condition on wind', () => {
    const scrub: EnvironmentScrub = { ...baseScrub, weather: 'wind' };
    const result = scrubbedFactors(baseFactors, scrub);
    expect(result.condition).toBeLessThan(baseFactors.condition);
    expect(result.condition).toBe(70 * 0.85); // 59.5
  });

  it('should reduce visibility on low sun and increase on high sun', () => {
    const lowScrub: EnvironmentScrub = { ...baseScrub, sun: 'low' };
    const highScrub: EnvironmentScrub = { ...baseScrub, sun: 'high' };
    const lowResult = scrubbedFactors(baseFactors, lowScrub);
    const highResult = scrubbedFactors(baseFactors, highScrub);

    expect(lowResult.visibility).toBeLessThan(baseFactors.visibility);
    expect(highResult.visibility).toBeGreaterThan(baseFactors.visibility);
    expect(lowResult.visibility).toBe(80 * 0.80); // 64
    expect(highResult.visibility).toBe(80 * 1.10); // 88
  });

  it('should reduce access on heavy traffic and increase on light traffic', () => {
    const heavyScrub: EnvironmentScrub = { ...baseScrub, traffic: 'heavy' };
    const lightScrub: EnvironmentScrub = { ...baseScrub, traffic: 'light' };
    const heavyResult = scrubbedFactors(baseFactors, heavyScrub);
    const lightResult = scrubbedFactors(baseFactors, lightScrub);

    expect(heavyResult.access).toBeLessThan(baseFactors.access);
    expect(lightResult.access).toBeGreaterThan(baseFactors.access);
  });

  it('should reduce activity during early or late hours', () => {
    const earlyScrub: EnvironmentScrub = { ...baseScrub, hour: 5 };
    const lateScrub: EnvironmentScrub = { ...baseScrub, hour: 22 };
    const earlyResult = scrubbedFactors(baseFactors, earlyScrub);
    const lateResult = scrubbedFactors(baseFactors, lateScrub);

    expect(earlyResult.activity).toBeLessThan(baseFactors.activity);
    expect(lateResult.activity).toBeLessThan(baseFactors.activity);
    expect(earlyResult.activity).toBe(60 * 0.65); // 39
  });
});

describe('scrubbedScore', () => {
  it('should compute average of scrubbed factor values', () => {
    const factors = { visibility: 80, access: 60, activity: 40 };
    const score = scrubbedScore(factors, baseScrub);
    // baseline: (80 + 60 + 40) / 3 = 60
    expect(score).toBe(60);
  });

  it('should return rounded score to one decimal', () => {
    const factors = { visibility: 81, access: 64, activity: 42 };
    const score = scrubbedScore(factors, baseScrub);
    // (81 + 64 + 42) / 3 = 62.333... → 62.3
    expect(score).toBe(62.3);
  });

  it('should reflect scrub adjustments in the score', () => {
    const factors = { access: 80, activity: 80 };
    const rainScrub: EnvironmentScrub = { ...baseScrub, weather: 'rain' };
    const score = scrubbedScore(factors, rainScrub);
    // access: 80 * 0.75 = 60, activity: 80 * 0.80 = 64 → avg = 62
    expect(score).toBe(62);
  });
});

describe('disruptionDelta', () => {
  it('openOnly includes only candidates with valid hours that contain the selected hour', () => {
    const rows = disruptionDelta([
      candidate('open', { access: 80 }, { hours: { valid: true, openAtHours: [9] } }),
      candidate('closed', { access: 90 }, { hours: { valid: true, openAtHours: [10] } }),
      candidate('unknown', { access: 100 }),
    ], { ...DEFAULT_SCRUB, openOnly: true, hour: 9 });
    expect(rows.map((row) => row.id)).toEqual(['open']);
  });

  it('uses mission priorities instead of an unweighted average', () => {
    const rows = disruptionDelta([
      candidate('access', { access: 100, visibility: 0 }),
      candidate('visibility', { access: 0, visibility: 100 }),
    ], DEFAULT_SCRUB, { access: 90, visibility: 10 });
    expect(rows[0].id).toBe('access');
  });
  it('should compute base and scrubbed scores for each candidate', () => {
    const candidates: MissionCandidate[] = [
      {
        id: 'c1',
        label: 'Place A',
        inspectionState: 'scored',
        evidenceIds: [],
        source: 'live',
        factors: { visibility: 80, access: 60 },
      },
      {
        id: 'c2',
        label: 'Place B',
        inspectionState: 'scored',
        evidenceIds: [],
        source: 'live',
        factors: { visibility: 90, access: 70 },
      },
    ];

    const result = disruptionDelta(candidates, baseScrub);
    expect(result).toHaveLength(2);
    expect(result[0].label).toBe('Place B'); // higher score
    expect(result[0].base).toBe(80); // (90 + 70) / 2
    expect(result[0].scrubbed).toBe(80);
    expect(result[0].delta).toBe(0);
  });

  it('should sort by scrubbed score descending', () => {
    const candidates: MissionCandidate[] = [
      {
        id: 'c1',
        label: 'Low',
        inspectionState: 'scored',
        evidenceIds: [],
        source: 'live',
        factors: { access: 40 },
      },
      {
        id: 'c2',
        label: 'High',
        inspectionState: 'scored',
        evidenceIds: [],
        source: 'live',
        factors: { access: 90 },
      },
    ];

    const result = disruptionDelta(candidates, baseScrub);
    expect(result[0].label).toBe('High');
    expect(result[1].label).toBe('Low');
  });

  it('should skip candidates without factors', () => {
    const candidates: MissionCandidate[] = [
      {
        id: 'c1',
        label: 'Has factors',
        inspectionState: 'scored',
        evidenceIds: [],
        source: 'live',
        factors: { visibility: 80 },
      },
      {
        id: 'c2',
        label: 'No factors',
        inspectionState: 'skeleton',
        evidenceIds: [],
        source: 'live',
      },
    ];

    const result = disruptionDelta(candidates, baseScrub);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Has factors');
  });

  it('should detect ranking flips from condition changes', () => {
    const candidates: MissionCandidate[] = [
      {
        id: 'c1',
        label: 'Outdoor café',
        inspectionState: 'scored',
        evidenceIds: [],
        source: 'live',
        factors: { access: 90, activity: 80, environment: 85 },
      },
      {
        id: 'c2',
        label: 'Indoor café',
        inspectionState: 'scored',
        evidenceIds: [],
        source: 'live',
        factors: { access: 75, activity: 75, environment: 75 },
      },
    ];

    const clearResult = disruptionDelta(candidates, baseScrub);
    const rainScrub: EnvironmentScrub = { ...baseScrub, weather: 'rain' };
    const rainResult = disruptionDelta(candidates, rainScrub);

    // Clear: outdoor should be first (higher base)
    expect(clearResult[0].label).toBe('Outdoor café');

    // Rain reduces outdoor access/activity more than indoor, potentially flipping order
    const outdoorRain = rainResult.find(r => r.label === 'Outdoor café')!;
    const indoorRain = rainResult.find(r => r.label === 'Indoor café')!;

    expect(outdoorRain.delta).toBeLessThan(0); // outdoor score drops
    expect(indoorRain.delta).toBeLessThan(0); // indoor also drops but less
  });
});
