import type { EnvironmentScrub, MissionCandidate } from './types';

/**
 * Apply deterministic condition adjustments to a candidate's base factors.
 * Returns a new factor map with clamped values (0..100).
 *
 * Rules:
 * - Rain reduces outdoor access and activity comfort
 * - Heat reduces environmental comfort
 * - Wind reduces physical condition assessment
 * - Low sun increases glare sensitivity (lowers visibility); high sun improves it
 * - Heavy traffic reduces access; light traffic improves it
 * - Early (<7) or late (>21) hours reduce activity levels
 */
export function scrubbedFactors(
  factors: Record<string, number>,
  scrub: EnvironmentScrub,
): Record<string, number> {
  const result = { ...factors };

  // Weather impacts
  if (scrub.weather === 'rain') {
    // Rain makes outdoor access harder and reduces activity comfort
    result.access = clamp((result.access ?? 0) * 0.75);
    result.activity = clamp((result.activity ?? 0) * 0.80);
  }
  if (scrub.weather === 'heat') {
    // Heat reduces environmental comfort
    result.environment = clamp((result.environment ?? 0) * 0.70);
  }
  if (scrub.weather === 'wind') {
    // Wind affects physical condition (awnings, outdoor seating, signage)
    result.condition = clamp((result.condition ?? 0) * 0.85);
  }

  // Sun angle impacts visibility (glare vs clarity)
  if (scrub.sun === 'low') {
    // Low sun creates glare, reduces visibility
    result.visibility = clamp((result.visibility ?? 0) * 0.80);
  } else if (scrub.sun === 'high') {
    // High sun improves visibility
    result.visibility = clamp((result.visibility ?? 0) * 1.10);
  }
  // 'mid' sun has no adjustment (baseline)

  // Traffic impacts access
  if (scrub.traffic === 'heavy') {
    // Heavy traffic makes access harder
    result.access = clamp((result.access ?? 0) * 0.70);
  } else if (scrub.traffic === 'light') {
    // Light traffic improves access
    result.access = clamp((result.access ?? 0) * 1.08);
  }
  // 'moderate' traffic has no adjustment (baseline)

  // Hour of day impacts activity
  if (scrub.hour < 7 || scrub.hour > 21) {
    // Early morning or late evening reduces activity levels
    result.activity = clamp((result.activity ?? 0) * 0.65);
  }

  return result;
}

/**
 * Compute a single aggregate score from scrubbed factors.
 * Returns the simple average of all factor values (0..100).
 */
export function scrubbedScore(
  factors: Record<string, number>,
  scrub: EnvironmentScrub,
  priorities?: Record<string, number>,
): number {
  const scrubbed = scrubbedFactors(factors, scrub);
  const entries = Object.entries(scrubbed);
  if (entries.length === 0) return 0;
  const totalWeight = entries.reduce((sum, [key]) => sum + Math.max(0, priorities?.[key] ?? 1), 0) || 1;
  const sum = entries.reduce((acc, [key, value]) => acc + value * Math.max(0, priorities?.[key] ?? 1), 0);
  return Math.round((sum / totalWeight) * 10) / 10;
}

export interface DisruptionRow {
  id: string;
  label: string;
  base: number;
  scrubbed: number;
  delta: number;
}

/**
 * Compare baseline vs scrubbed scores for all candidates with factors.
 * Returns rows sorted by scrubbed score (descending).
 * Candidates without factors are skipped.
 */
export function disruptionDelta(
  candidates: MissionCandidate[],
  scrub: EnvironmentScrub,
  priorities?: Record<string, number>,
): DisruptionRow[] {
  const rows: DisruptionRow[] = [];

  for (const candidate of candidates) {
    if (!candidate.factors) continue;
    if (scrub.openOnly) {
      const hours = candidate.observedSignals?.hours;
      if (!hours?.valid || !hours.openAtHours?.includes(scrub.hour)) continue;
    }

    const base = scrubbedScore(candidate.factors, DEFAULT_BASELINE, priorities);
    const scrubbed = scrubbedScore(candidate.factors, scrub, priorities);
    const delta = Math.round((scrubbed - base) * 10) / 10;

    rows.push({
      id: candidate.id,
      label: candidate.label,
      base,
      scrubbed,
      delta,
    });
  }

  // Sort by scrubbed score descending
  return rows.sort((a, b) => b.scrubbed - a.scrubbed);
}

const DEFAULT_BASELINE: EnvironmentScrub = {
  hour: 9,
  weather: 'clear',
  openOnly: false,
  traffic: 'moderate',
  sun: 'mid',
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}
