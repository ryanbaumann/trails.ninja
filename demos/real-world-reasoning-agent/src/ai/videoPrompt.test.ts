import { describe, it, expect } from 'vitest';
import { buildTourVideoPrompt, buildWalkthroughPrompt } from './videoPrompt';

describe('buildTourVideoPrompt', () => {
  it('returns a non-empty string including the place name and a motion direction', () => {
    const prompt = buildTourVideoPrompt('Sydney Opera House');
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
    expect(prompt).toContain('Sydney Opera House');
    expect(prompt).toMatch(/dolly|push-in|motion|aerial|flythrough/i);
  });
});

describe('buildWalkthroughPrompt', () => {
  it('returns a non-empty string including the label and a motion direction', () => {
    const prompt = buildWalkthroughPrompt('123 Market Street');
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
    expect(prompt).toContain('123 Market Street');
    expect(prompt).toMatch(/walk|walkthrough|approach|motion/i);
  });
});
