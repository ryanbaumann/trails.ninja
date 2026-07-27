import { describe, it, expect, vi, afterEach } from 'vitest';

/**
 * The omni video feature is now ON by default (VITE_VIDEO_GEN_ENABLED unset →
 * enabled). A deployer can still hard-disable it with VITE_VIDEO_GEN_ENABLED=false,
 * and when they do, generateVideo must fail fast with an actionable message BEFORE
 * touching the network / SDK — so opting out is a real, billable-call-free kill switch.
 *
 * The flag is read at module-load time (a config.ts const), so we stub the env and
 * re-import the module to exercise the disabled branch deterministically without a
 * live SDK/proxy.
 */
describe('generateVideo feature flag', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('throws an actionable error when explicitly disabled', async () => {
    vi.stubEnv('VITE_VIDEO_GEN_ENABLED', 'false');
    vi.resetModules();
    const { generateVideo } = await import('./video');
    await expect(
      generateVideo({ imageBase64: 'AAAA', prompt: 'slow push-in over the plaza' }),
    ).rejects.toThrow(/VITE_VIDEO_GEN_ENABLED/);
  });
});
