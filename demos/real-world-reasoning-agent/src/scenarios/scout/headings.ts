/**
 * Pure heading math for `inspect_candidate`. Picks the compass headings the
 * agent "looks" at when fetching Street View frames: a fixed 2-way spread when
 * there's no particular direction of interest, or a spread centered on the
 * bearing toward a point of interest (e.g. the scout area's center) so the
 * agent's narration ("looking north-east...") lines up with what it fetched.
 *
 * Two headings (not three) is deliberate: each inspection sends its frames to
 * Gemini vision in a single batched multi-image call, so every extra heading is
 * an extra image token in that call (plus an extra Street View fetch). Two
 * street angles + the aerial frame preserve the visibility/condition/activity
 * read while cutting the vision payload ~25%. Callers may still pass explicit
 * headings for a richer look.
 */
import { bearing } from '@/lib/geo';
import type { LatLng } from '@/lib/types';

export const DEFAULT_HEADINGS = [0, 180] as const;

/** Normalize a heading to the [0, 360) range. */
export function normalizeHeading(deg: number): number {
  const h = deg % 360;
  return h < 0 ? h + 360 : h;
}

/**
 * Two headings to inspect from `loc`: a fixed 0/180 spread by default, or —
 * when a point of interest is given — one frame straight toward it plus one
 * offset frame (by `spreadDeg`), so the agent looks at the frontage head-on and
 * from a useful oblique angle.
 */
export function headingsTowards(loc: LatLng, poi?: LatLng, spreadDeg = 45): number[] {
  if (!poi) return [...DEFAULT_HEADINGS];
  const center = bearing(loc, poi);
  return [normalizeHeading(center), normalizeHeading(center + spreadDeg)];
}

const COMPASS_LABELS = [
  'north',
  'north-east',
  'east',
  'south-east',
  'south',
  'south-west',
  'west',
  'north-west',
] as const;

/** Human label for a heading, e.g. 95 -> "east". Used in the agent's narration. */
export function compassLabel(deg: number): string {
  const h = normalizeHeading(deg);
  const idx = Math.round(h / 45) % 8;
  return COMPASS_LABELS[idx];
}
