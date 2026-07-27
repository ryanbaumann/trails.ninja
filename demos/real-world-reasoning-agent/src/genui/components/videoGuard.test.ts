import { describe, it, expect } from 'vitest';
import { isAllowedVideoUrl } from './videoGuard';

describe('isAllowedVideoUrl', () => {
  it('accepts a data:video/* URL', () => {
    expect(isAllowedVideoUrl('data:video/mp4;base64,AAA')).toBe(true);
  });

  it('accepts an https: URL', () => {
    expect(isAllowedVideoUrl('https://example.com/clip.mp4')).toBe(true);
  });

  it('accepts a same-origin /gmp/ proxy path', () => {
    expect(isAllowedVideoUrl('/api/real-world-reasoning-agent/gmp/streetview/whatever')).toBe(true);
  });

  it('rejects an empty string', () => {
    expect(isAllowedVideoUrl('')).toBe(false);
  });

  it('rejects a javascript: URL', () => {
    expect(isAllowedVideoUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects a data:image/* URL (not video)', () => {
    expect(isAllowedVideoUrl('data:image/png;base64,AAA')).toBe(false);
  });
});
