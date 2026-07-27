import type { LatLng, MatrixCell, TravelMode } from '@/lib/types';
import { offsetLatLng } from '@/lib/geo';
import { computeMatrix } from '@/services/routes';

/**
 * Geo-targeting reach ring: an isochrone-ish polygon approximating "N minutes by
 * <mode>" from a business. Pure geometry (bearings, radius seeding/scaling,
 * ring construction) is separated from the async route-matrix calls so the
 * math is unit-testable without hitting the network.
 */

/** 12 evenly spaced compass bearings (0 = north) used to sample the ring. */
export const BEARINGS_12: number[] = Array.from({ length: 12 }, (_, i) => i * 30);

/** Rough travel-speed heuristic (meters/minute) used to seed the initial radius. */
const SPEED_M_PER_MIN: Record<TravelMode, number> = {
  WALK: 65,
  BICYCLE: 200,
  DRIVE: 400,
  TRANSIT: 300,
  TWO_WHEELER: 300,
};

export function speedForMode(mode: TravelMode): number {
  return SPEED_M_PER_MIN[mode] ?? 300;
}

/** Seed radius (meters) per bearing before any matrix-based correction. */
export function initialRadii(minutes: number, mode: TravelMode, bearings: number[] = BEARINGS_12): number[] {
  const r = Math.max(50, minutes * speedForMode(mode));
  return bearings.map(() => r);
}

/** Offset `center` by each (bearing, radius) pair into a ring of points (not closed). */
export function ringPoints(center: LatLng, bearings: number[], radii: number[]): LatLng[] {
  return bearings.map((b, i) => offsetLatLng(center, b, radii[i] ?? radii[0] ?? 0));
}

/** Close a path by repeating its first point at the end (no-op if already closed). */
export function closeRing(path: LatLng[]): LatLng[] {
  if (path.length < 2) return path;
  const first = path[0];
  const last = path[path.length - 1];
  if (first.lat === last.lat && first.lng === last.lng) return path;
  return [...path, first];
}

/**
 * Scale each bearing's seed radius so its matrix-measured duration matches
 * `targetMinutes`. Guards divide-by-zero / missing cells by leaving that
 * bearing's radius unchanged, and clamps the correction factor so one bad
 * matrix cell can't blow the ring out.
 */
export function scaledRadii(radii: number[], actualSeconds: (number | undefined)[], targetMinutes: number): number[] {
  return radii.map((r, i) => {
    const seconds = actualSeconds[i];
    const actualMinutes = seconds != null ? seconds / 60 : NaN;
    if (!actualMinutes || !isFinite(actualMinutes) || actualMinutes <= 0) return r;
    const factor = targetMinutes / actualMinutes;
    return r * Math.max(0.35, Math.min(3, factor));
  });
}

export interface ReachRingResult {
  ringPath: LatLng[];
  reachSummary: string;
}

function secondsByDestination(cells: MatrixCell[], count: number): (number | undefined)[] {
  return Array.from({ length: count }, (_, i) => {
    const cell = cells.find((c) => c.destinationIndex === i && c.status === 'OK');
    return cell ? cell.durationSeconds : undefined;
  });
}

/**
 * Two-pass reach ring: seed a radius per bearing from a speed heuristic, measure
 * real travel time to those seed points with a route matrix, scale each bearing's
 * radius to match the target minutes, then re-measure once more for the summary.
 */
export async function computeReachRing(
  center: LatLng,
  minutes: number,
  mode: TravelMode,
): Promise<ReachRingResult> {
  const clampedMinutes = Math.max(5, Math.min(30, minutes));
  const bearings = BEARINGS_12;

  const seedRadii = initialRadii(clampedMinutes, mode, bearings);
  const seedPoints = ringPoints(center, bearings, seedRadii);

  let seedCells: MatrixCell[] = [];
  try {
    seedCells = await computeMatrix([center], seedPoints, mode);
  } catch {
    seedCells = [];
  }
  const seedSeconds = secondsByDestination(seedCells, bearings.length);
  const correctedRadii = scaledRadii(seedRadii, seedSeconds, clampedMinutes);
  const correctedPoints = ringPoints(center, bearings, correctedRadii);

  let finalCells: MatrixCell[] = [];
  try {
    finalCells = await computeMatrix([center], correctedPoints, mode);
  } catch {
    finalCells = [];
  }
  const finalSeconds = secondsByDestination(finalCells, bearings.length).filter(
    (v): v is number => v != null,
  );
  const avgMinutes = finalSeconds.length
    ? finalSeconds.reduce((a, b) => a + b, 0) / finalSeconds.length / 60
    : clampedMinutes;

  const ringPath = closeRing(correctedPoints);
  const modeLabel = mode.toLowerCase().replace('_', ' ');
  const reachSummary = `~${Math.round(avgMinutes)} min ${modeLabel} reach (${clampedMinutes} min target)`;
  return { ringPath, reachSummary };
}
