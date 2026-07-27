/**
 * Pure score fusion — no service calls, no store access. Combines Gemini vision
 * verdicts with real Places density, environment, and route-matrix access into
 * the five Scout sub-scores + a weighted total. Kept separate from tools.ts so
 * it's trivially unit-testable.
 */
import type { CandidateScores, RubricWeights } from './store';

export interface FuseInputs {
  /** Averaged Gemini vision sub-scores, each 0-10 (0 = worst, 10 = best). */
  vision: { visibility: number; condition: number; activity: number };
  /** Places density near the candidate (raw counts within a small radius). */
  density: { complementary: number; competitor: number };
  /** Environment signals; undefined fields fall back to a neutral midpoint. */
  env: { aqi?: number; pollenIndex?: number };
  /** Average minutes to the area's access anchors via computeMatrix; lower is better. */
  accessMinutes?: number;
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Accept either 0-1 rubric weights or 0-100 UI priorities at the boundary. */
export function normalizeRubricWeights(weights: RubricWeights): RubricWeights {
  const entries = Object.entries(weights) as [keyof RubricWeights, number][];
  const total = entries.reduce((sum, [, value]) => sum + Math.max(0, value), 0);
  return Object.fromEntries(
    entries.map(([key, value]) => [key, total ? Math.max(0, value) / total : 0]),
  ) as unknown as RubricWeights;
}

/** Weighted fusion of vision + real-world signals into 0-100 sub-scores + total. */
export function fuseScores(inputs: FuseInputs, weights: RubricWeights): CandidateScores {
  const normalizedWeights = normalizeRubricWeights(weights);
  const visibility = clamp(inputs.vision.visibility * 10);
  const condition = clamp(inputs.vision.condition * 10);

  // Activity blends the vision pedestrian-activity signal with real Places
  // density: nearby complementary businesses are a contextual activity proxy;
  // this must never be presented as measured or live foot traffic.
  const activityFromVision = inputs.vision.activity * 10;
  const activityFromDensity = clamp(50 + inputs.density.complementary * 8 - inputs.density.competitor * 4);
  const activity = clamp(activityFromVision * 0.6 + activityFromDensity * 0.4);

  // Access: 0 minutes → 100, 25+ minutes → 0. Missing matrix data → neutral 50.
  const access = inputs.accessMinutes == null ? 50 : clamp(100 - inputs.accessMinutes * 4);

  // Environment: lower AQI/pollen is better. Missing data → neutral-good 70
  // (a demo default so a candidate isn't penalized for a dead API call).
  const aqiScore = inputs.env.aqi == null ? 70 : clamp(100 - inputs.env.aqi / 3);
  const pollenScore = inputs.env.pollenIndex == null ? 70 : clamp(100 - inputs.env.pollenIndex * 20);
  const environment = clamp((aqiScore + pollenScore) / 2);

  const total = clamp(
    visibility * normalizedWeights.visibility +
      condition * normalizedWeights.condition +
      activity * normalizedWeights.activity +
      access * normalizedWeights.access +
      environment * normalizedWeights.environment,
  );

  return {
    visibility: round1(visibility),
    condition: round1(condition),
    activity: round1(activity),
    access: round1(access),
    environment: round1(environment),
    total: round1(total),
  };
}
