import { describe, expect, it } from 'vitest';
import { pointInConstraint, ringCenter } from './geometry';

const outer = [
  { lat: 0, lng: 0 },
  { lat: 0, lng: 10 },
  { lat: 10, lng: 10 },
  { lat: 10, lng: 0 },
];
const exclusion = [
  { lat: 4, lng: 4 },
  { lat: 4, lng: 6 },
  { lat: 6, lng: 6 },
  { lat: 6, lng: 4 },
];

describe('mission geometry constraints', () => {
  it('computes a stable application-drawn center', () => {
    expect(ringCenter(outer)).toEqual({ lat: 5, lng: 5 });
  });

  it('includes the outer area and removes exclusion rings', () => {
    expect(pointInConstraint({ lat: 2, lng: 2 }, outer, [exclusion])).toBe(true);
    expect(pointInConstraint({ lat: 5, lng: 5 }, outer, [exclusion])).toBe(false);
    expect(pointInConstraint({ lat: 12, lng: 2 }, outer, [exclusion])).toBe(false);
  });
});
