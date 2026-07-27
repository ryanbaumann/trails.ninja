import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  analyzeUserImage,
  generateHairstyleImage,
  refineHairstyleImage,
  getFreeTierStatus,
  validateGeminiKey,
  GeminiApiError,
  RateLimitError,
} from '../geminiService';

const mockFetch = vi.fn();
const API_KEY = 'test-key-with-enough-characters';

const jsonResponse = (body: unknown, ok = true, status = 200): Response => ({
  ok,
  status,
  json: async () => body,
} as unknown as Response);

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('analyzeUserImage', () => {
  it('uses the namespaced proxy and transient key header', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ recommendedStyleId: 'wolf-cut' }));
    const styles = [{ id: 'wolf-cut', label: 'Wolf Cut', description: 'x', category: 'style' as const }];
    const result = await analyzeUserImage(API_KEY, 'data:image/png;base64,abc', styles);

    expect(result).toEqual({ recommendedStyleId: 'wolf-cut' });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/hairstyle-ai-studio/analyze');
    expect(init.headers['X-Gemini-API-Key']).toBe(API_KEY);
    expect(JSON.parse(init.body).availableStyles).toEqual(styles);
  });

  it('omits the personal-key header while using the hosted free tier', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ recommendedStyleId: null }));
    await analyzeUserImage('', 'data:image/png;base64,abc', []);

    expect(mockFetch.mock.calls[0][1].headers['X-Gemini-API-Key']).toBeUndefined();
  });
});

describe('credential and quota flow', () => {
  it('validates a personal key through the proxy before activation', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ valid: true }));
    await expect(validateGeminiKey(API_KEY)).resolves.toBe(true);
    expect(mockFetch.mock.calls[0][0]).toBe('/api/hairstyle-ai-studio/validate-key');
    expect(mockFetch.mock.calls[0][1].headers['X-Gemini-API-Key']).toBe(API_KEY);
  });

  it('reads the shared allowance without consuming it', async () => {
    const quota = { enabled: true, limit: 5, remaining: 4, resetAt: '2026-07-28T00:00:00.000Z' };
    mockFetch.mockResolvedValue(jsonResponse(quota));
    await expect(getFreeTierStatus()).resolves.toEqual(quota);
    expect(mockFetch.mock.calls[0][1].method).toBe('GET');
  });
});

describe('generateHairstyleImage', () => {
  it('makes exactly one image request and returns its data URL', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ image: 'data:image/jpeg;base64,final' }));
    const url = await generateHairstyleImage(
      API_KEY,
      { front: 'data:image/png;base64,f', side: null, back: null },
      'Short bob'
    );

    expect(url).toBe('data:image/jpeg;base64,final');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toBe('/api/hairstyle-ai-studio/generate');
  });

  it('raises RateLimitError on HTTP 429', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ error: 'Use your key', code: 'FREE_TIER_EXHAUSTED' }, false, 429));
    const promise = generateHairstyleImage(
      '', { front: 'x', side: null, back: null }, 'bob'
    );
    await expect(
      promise
    ).rejects.toBeInstanceOf(RateLimitError);
    await expect(promise).rejects.toMatchObject({ code: 'FREE_TIER_EXHAUSTED' });
  });

  it('preserves provider quota error codes for a personal key', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ error: 'Key quota used', code: 'GEMINI_QUOTA_EXHAUSTED' }, false, 429));
    await expect(
      generateHairstyleImage(API_KEY, { front: 'x', side: null, back: null }, 'bob')
    ).rejects.toEqual(expect.objectContaining<Partial<GeminiApiError>>({
      code: 'GEMINI_QUOTA_EXHAUSTED',
    }));
  });

  it('rejects a successful response without an image', async () => {
    mockFetch.mockResolvedValue(jsonResponse({}));
    await expect(
      generateHairstyleImage(API_KEY, { front: 'x', side: null, back: null }, 'bob')
    ).rejects.toThrow('without returning an image');
  });
});

describe('refineHairstyleImage', () => {
  it('sends the current image and resolves the refined result', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ image: 'data:image/jpeg;base64,refined' }));
    const url = await refineHairstyleImage(API_KEY, 'data:image/png;base64,cur', 'shorter bangs');

    expect(url).toBe('data:image/jpeg;base64,refined');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.currentImage).toBe('data:image/png;base64,cur');
    expect(body.refinementInstruction).toBe('shorter bangs');
  });
});
