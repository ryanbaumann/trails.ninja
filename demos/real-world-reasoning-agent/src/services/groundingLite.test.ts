import { describe, expect, it } from 'vitest';
import { groundingLiteProvider, mapsGroundingProvider } from './groundingLite';

describe('groundingLite compatibility layer', () => {
  it('re-exports mapsGroundingProvider as groundingLiteProvider', () => {
    expect(groundingLiteProvider).toBe(mapsGroundingProvider);
    expect(typeof groundingLiteProvider.searchPlaces).toBe('function');
    expect(typeof groundingLiteProvider.computeRoute).toBe('function');
    expect(typeof groundingLiteProvider.lookupWeather).toBe('function');
  });
});
