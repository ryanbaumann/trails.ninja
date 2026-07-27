import { describe, it, expect } from 'vitest';
import {
  BEARINGS_12,
  initialRadii,
  ringPoints,
  closeRing,
  scaledRadii,
  speedForMode,
} from './targeting';
import type { LatLng } from '@/lib/types';

const CENTER: LatLng = { lat: 37.7955, lng: -122.3937 };

describe('BEARINGS_12', () => {
  it('has 12 evenly spaced compass bearings starting at 0', () => {
    expect(BEARINGS_12).toHaveLength(12);
    expect(BEARINGS_12[0]).toBe(0);
    expect(BEARINGS_12[11]).toBe(330);
    for (let i = 1; i < BEARINGS_12.length; i++) {
      expect(BEARINGS_12[i] - BEARINGS_12[i - 1]).toBe(30);
    }
  });
});

describe('speedForMode', () => {
  it('ranks WALK slowest and DRIVE fastest', () => {
    expect(speedForMode('WALK')).toBeLessThan(speedForMode('BICYCLE'));
    expect(speedForMode('BICYCLE')).toBeLessThan(speedForMode('DRIVE'));
  });
});

describe('initialRadii', () => {
  it('returns one radius per bearing, scaling with minutes', () => {
    const radii = initialRadii(10, 'WALK');
    expect(radii).toHaveLength(BEARINGS_12.length);
    expect(radii.every((r) => r > 0)).toBe(true);
    const longer = initialRadii(20, 'WALK');
    expect(longer[0]).toBeGreaterThan(radii[0]);
  });

  it('never returns a zero/negative radius for degenerate input', () => {
    const radii = initialRadii(0, 'WALK');
    expect(radii.every((r) => r >= 50)).toBe(true);
  });
});

describe('ringPoints + closeRing', () => {
  it('produces 12 distinct points around the center', () => {
    const radii = initialRadii(15, 'DRIVE');
    const pts = ringPoints(CENTER, BEARINGS_12, radii);
    expect(pts).toHaveLength(12);
    for (const p of pts) {
      // Each point is offset from the center — but a due-N/S point shares the
      // center longitude and a due-E/W point shares its latitude, so only
      // require that a point isn't identical to the center on both axes.
      expect(p.lat === CENTER.lat && p.lng === CENTER.lng).toBe(false);
    }
    // North point (bearing 0) should be due north: same lng, greater lat.
    expect(pts[0].lat).toBeGreaterThan(CENTER.lat);
    expect(Math.abs(pts[0].lng - CENTER.lng)).toBeLessThan(1e-6);
  });

  it('closes the ring by repeating the first point', () => {
    const radii = initialRadii(15, 'DRIVE');
    const pts = ringPoints(CENTER, BEARINGS_12, radii);
    const closed = closeRing(pts);
    expect(closed).toHaveLength(pts.length + 1);
    expect(closed[closed.length - 1]).toEqual(closed[0]);
  });

  it('is a no-op on an already-closed ring', () => {
    const closedOnce = closeRing([CENTER, { lat: CENTER.lat + 0.01, lng: CENTER.lng }, CENTER]);
    expect(closeRing(closedOnce)).toHaveLength(closedOnce.length);
  });
});

describe('scaledRadii', () => {
  it('scales a radius up when actual travel time is shorter than target', () => {
    const radii = [1000];
    // actual matrix says the seed point is only 5 min away but target is 10 min.
    const scaled = scaledRadii(radii, [5 * 60], 10);
    expect(scaled[0]).toBeGreaterThan(radii[0]);
  });

  it('scales a radius down when actual travel time is longer than target', () => {
    const radii = [1000];
    const scaled = scaledRadii(radii, [20 * 60], 10);
    expect(scaled[0]).toBeLessThan(radii[0]);
  });

  it('leaves the radius unchanged when the matrix cell is missing (guards divide-by-zero)', () => {
    const radii = [1000];
    expect(scaledRadii(radii, [undefined], 10)[0]).toBe(1000);
    expect(scaledRadii(radii, [0], 10)[0]).toBe(1000);
    expect(scaledRadii(radii, [NaN], 10)[0]).toBe(1000);
  });

  it('clamps the correction factor so a single bad cell cannot blow out the ring', () => {
    const radii = [1000];
    const scaled = scaledRadii(radii, [1], 30); // absurdly fast reading
    expect(scaled[0]).toBeLessThanOrEqual(1000 * 3);
  });
});
