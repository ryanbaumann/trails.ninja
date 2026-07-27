import { describe, expect, it } from 'vitest';
import { DEFAULT_HEADINGS, compassLabel, headingsTowards, normalizeHeading } from './headings';

describe('normalizeHeading', () => {
  it('leaves in-range headings unchanged', () => {
    expect(normalizeHeading(0)).toBe(0);
    expect(normalizeHeading(180)).toBe(180);
    expect(normalizeHeading(359)).toBe(359);
  });

  it('wraps negative headings into [0, 360)', () => {
    expect(normalizeHeading(-10)).toBe(350);
    expect(normalizeHeading(-370)).toBeCloseTo(350, 5);
  });

  it('wraps headings past 360', () => {
    expect(normalizeHeading(370)).toBe(10);
    expect(normalizeHeading(720)).toBe(0);
  });
});

describe('headingsTowards', () => {
  it('returns the fixed default spread with no point of interest', () => {
    expect(headingsTowards({ lat: 37.7, lng: -122.4 })).toEqual([...DEFAULT_HEADINGS]);
  });

  it('defaults to a 2-heading spread to keep the vision payload small', () => {
    expect(DEFAULT_HEADINGS).toHaveLength(2);
    expect(headingsTowards({ lat: 37.7, lng: -122.4 })).toHaveLength(2);
    const loc = { lat: 37.7, lng: -122.4 };
    const poi = { lat: 37.71, lng: -122.4 };
    expect(headingsTowards(loc, poi, 45)).toHaveLength(2);
  });

  it('looks head-on toward the poi plus one oblique offset', () => {
    // POI due north of loc -> bearing ~0.
    const loc = { lat: 37.7, lng: -122.4 };
    const poi = { lat: 37.71, lng: -122.4 };
    const [center, oblique] = headingsTowards(loc, poi, 45);
    expect(center).toBeCloseTo(0, 0);
    expect(oblique).toBeCloseTo(45, 0);
  });

  it('keeps both headings within [0, 360) near the 0/360 seam', () => {
    // Slightly west of due north so the center bearing is small and near the seam.
    const loc = { lat: 37.7, lng: -122.4 };
    const poi = { lat: 37.71, lng: -122.4001 };
    for (const h of headingsTowards(loc, poi, 45)) {
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
    }
  });
});

describe('compassLabel', () => {
  it('labels the eight primary compass points', () => {
    expect(compassLabel(0)).toBe('north');
    expect(compassLabel(90)).toBe('east');
    expect(compassLabel(180)).toBe('south');
    expect(compassLabel(270)).toBe('west');
    expect(compassLabel(45)).toBe('north-east');
    expect(compassLabel(135)).toBe('south-east');
  });

  it('rounds to the nearest compass point and wraps 360 back to north', () => {
    expect(compassLabel(10)).toBe('north');
    expect(compassLabel(360)).toBe('north');
    expect(compassLabel(-10)).toBe('north');
  });
});
