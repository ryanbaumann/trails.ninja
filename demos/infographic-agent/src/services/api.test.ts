import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prepareInfographic, renderInfographic, validateApiKey, RateLimitError } from './api.ts';

describe('Infographic Agent API Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('prepares infographic analysis and prompt', async () => {
    const mockResponse = {
      analysis: {
        title: 'Test Infographic',
        subtitle: 'Visual Overview',
        dataPointsCount: 4,
        sectionsCount: 3,
        brandColors: ['#000000', '#ffffff'],
      },
      prompt: 'INFOGRAPHIC POSTER: test visual instructions',
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockResponse,
    } as unknown as Response);

    const result = await prepareInfographic({
      topic: 'AI Systems',
      mode: 'data-story',
      aspect: '16:9',
    });

    expect(result.analysis.title).toBe('Test Infographic');
    expect(result.prompt).toContain('INFOGRAPHIC POSTER');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/infographic-agent/prepare',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      })
    );
  });

  it('throws RateLimitError on 429 status code', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        error: 'Daily rate limit reached. Connect your personal Gemini API key.',
        code: 'RATE_LIMITED',
        retryAfter: 3600,
      }),
    } as unknown as Response);

    await expect(
      prepareInfographic({
        topic: 'AI Systems',
        mode: 'data-story',
        aspect: '16:9',
      })
    ).rejects.toThrow(RateLimitError);
  });

  it('renders infographic image with specified model', async () => {
    const mockResponse = {
      image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      model: 'gemini-3.1-flash-lite-image',
      aspect: '16:9',
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockResponse,
    } as unknown as Response);

    const result = await renderInfographic({
      prompt: 'INFOGRAPHIC POSTER: clean layout',
      mode: 'data-story',
      aspect: '16:9',
      imageModel: 'gemini-3.1-flash-lite-image',
    });

    expect(result.image).toContain('data:image/png;base64,');
    expect(result.model).toBe('gemini-3.1-flash-lite-image');
  });

  it('validates api key correctly', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ valid: true }),
    } as unknown as Response);

    const isValid = await validateApiKey('AIzaSyValidTestKey');
    expect(isValid).toBe(true);
  });
});
