import { afterEach, describe, expect, it, vi } from 'vitest';
import { preflightMissionMode, resolveMissionMode } from './capabilityPreflight';

afterEach(() => vi.unstubAllGlobals());

describe('resolveMissionMode', () => {
  it('allows Live only when every required capability is ready', () => {
    expect(resolveMissionMode({ browserMaps: true, serverMaps: true, gemini: true, mapsGrounding: true, online: true, apiHealth: 'ok' })).toBe('live');
  });

  it.each([
    { browserMaps: false, serverMaps: true, gemini: true, mapsGrounding: true, online: true, apiHealth: 'ok' as const },
    { browserMaps: true, serverMaps: false, gemini: true, mapsGrounding: true, online: true, apiHealth: 'ok' as const },
    { browserMaps: true, serverMaps: true, gemini: false, mapsGrounding: true, online: true, apiHealth: 'ok' as const },
    { browserMaps: true, serverMaps: true, gemini: true, mapsGrounding: false, online: true, apiHealth: 'ok' as const },
    { browserMaps: true, serverMaps: true, gemini: true, mapsGrounding: true, online: false, apiHealth: 'ok' as const },
    { browserMaps: true, serverMaps: true, gemini: true, mapsGrounding: true, online: true, apiHealth: 'degraded' as const },
  ])('falls back to Sample when a capability is unavailable: %o', (input) => {
    expect(resolveMissionMode(input)).toBe('demo');
  });
});

describe('preflightMissionMode', () => {
  it('selects Live from a valid positive same-origin preflight', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ maps: true, gemini: true, mapsGrounding: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(preflightMissionMode(true, 'ok')).resolves.toBe('live');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/real-world-reasoning-agent/capabilities',
      expect.objectContaining({ method: 'GET', cache: 'no-store' }),
    );
  });

  it('accepts a connected personal key when hosted Gemini is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ maps: true, gemini: false, mapsGrounding: false }), { status: 200 })));
    await expect(preflightMissionMode(true, 'ok', undefined, true)).resolves.toBe('live');
  });

  it('fails closed to Sample when preflight is unavailable or malformed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(preflightMissionMode(true, 'ok')).resolves.toBe('demo');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{bad json', { status: 200 })));
    await expect(preflightMissionMode(true, 'ok')).resolves.toBe('demo');
  });
});
