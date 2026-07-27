import { describe, it, expect } from 'vitest';
import { adPrompt } from './image';
import type { PlaceLite } from '@/lib/types';

const BUSINESS: PlaceLite = {
  id: 'place-1',
  name: 'Blue Bottle Coffee',
  location: { lat: 37.7955, lng: -122.3937 },
  formattedAddress: '1 Ferry Building, San Francisco, CA 94111',
  rating: 4.6,
};

describe('adPrompt', () => {
  it('always instructs the model to use the attached photo as visual reference', () => {
    const prompt = adPrompt(BUSINESS, {}, 'warm golden-hour photo', 'square');
    expect(prompt).toMatch(/attached photo of the actual storefront\/location as visual reference/i);
  });

  it('includes the business name and chosen style/format', () => {
    const prompt = adPrompt(BUSINESS, {}, 'bold flat-color poster', 'story');
    expect(prompt).toContain('Blue Bottle Coffee');
    expect(prompt).toContain('bold flat-color poster');
    expect(prompt).toMatch(/9:16/);
  });

  it('includes a rating >= 4.2', () => {
    const prompt = adPrompt(BUSINESS, {}, 'style', 'square');
    expect(prompt).toContain('4.6');
  });

  it('omits ratings below 4.2 (not a strong enough grounded signal)', () => {
    const lowRated: PlaceLite = { ...BUSINESS, rating: 3.8 };
    const prompt = adPrompt(lowRated, {}, 'style', 'square');
    expect(prompt).not.toContain('3.8');
    expect(prompt).not.toMatch(/highly rated/);
  });

  it('never fabricates facts beyond what is passed in', () => {
    const noFacts: PlaceLite = { id: 'p2', name: 'Some Shop', location: { lat: 0, lng: 0 } };
    const prompt = adPrompt(noFacts, {}, 'style', 'banner');
    // The prompt must not fabricate a positive award/claim; it may (and should)
    // carry the "no fake awards" guardrail instruction.
    expect(prompt).not.toMatch(/award-winning/i);
    expect(prompt).toMatch(/no fake awards, no invented claims/i);
  });

  it('weaves in grounded weather and vibe facts when present', () => {
    const prompt = adPrompt(
      BUSINESS,
      { env: { weather: { tempC: 22, condition: 'Sunny' } }, vibe: 'busy lunchtime foot traffic' },
      'style',
      'square',
    );
    expect(prompt).toMatch(/22°C/);
    expect(prompt).toMatch(/sunny/i);
    expect(prompt).toMatch(/busy lunchtime foot traffic/);
  });

  it('includes the requested headline as overlay copy when provided', () => {
    const prompt = adPrompt(BUSINESS, {}, 'style', 'square', { headline: 'Fresh Roast Daily' });
    expect(prompt).toContain('Fresh Roast Daily');
  });
});
