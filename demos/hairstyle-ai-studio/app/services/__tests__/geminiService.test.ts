import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  analyzeUserImage,
  generateHairstyleImage,
  refineHairstyleImage,
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
    mockFetch.mockResolvedValue(jsonResponse({ error: 'Slow down' }, false, 429));
    await expect(
      generateHairstyleImage(API_KEY, { front: 'x', side: null, back: null }, 'bob')
    ).rejects.toBeInstanceOf(RateLimitError);
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
