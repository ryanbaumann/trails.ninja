// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({ options: [] as unknown[] }));
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    constructor(options: unknown) { sdk.options.push(options); }
  },
}));

import {
  connectGeminiApiKey,
  disconnectGeminiApiKey,
  GEMINI_BYOK_HEADER,
  genai,
  getGeminiCredentialSnapshot,
} from './client';

beforeEach(() => {
  sdk.options.length = 0;
  disconnectGeminiApiKey();
  vi.restoreAllMocks();
});

describe('Gemini credential lifecycle', () => {
  it('validates a personal key, rebuilds the client, and keeps auth out of the URL', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const hosted = genai();
    await connectGeminiApiKey('test-personal-key');
    const personal = genai();

    expect(personal).not.toBe(hosted);
    expect(getGeminiCredentialSnapshot().source).toBe('byok');
    expect(fetchSpy).toHaveBeenCalledWith('/api/real-world-reasoning-agent/ai/validate', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ [GEMINI_BYOK_HEADER]: 'test-personal-key' }),
    }));
    expect(String(fetchSpy.mock.calls[0][0])).not.toContain('test-personal-key');
    expect(sdk.options.at(-1)).toMatchObject({
      apiKey: 'proxied',
      httpOptions: { headers: { [GEMINI_BYOK_HEADER]: 'test-personal-key' } },
    });
    expect(globalThis.sessionStorage?.length ?? 0).toBe(0);
    expect(globalThis.localStorage?.length ?? 0).toBe(0);
  });

  it('disconnects immediately and returns to the hosted proxy client', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await connectGeminiApiKey('test-personal-key');
    genai();
    disconnectGeminiApiKey();
    genai();
    expect(getGeminiCredentialSnapshot().source).toBe('hosted');
    expect(sdk.options.at(-1)).toMatchObject({ apiKey: 'proxied', httpOptions: expect.not.objectContaining({ headers: expect.anything() }) });
  });
});
