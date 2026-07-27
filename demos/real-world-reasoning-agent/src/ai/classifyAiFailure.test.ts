import { describe, it, expect } from 'vitest';
import { classifyAiFailure } from './image';

describe('classifyAiFailure', () => {
  it('maps HTTP 429 (proxy window or upstream quota) to rate-limited', () => {
    expect(classifyAiFailure({ name: 'ApiError', status: 429 })).toBe('rate-limited');
  });

  it('maps HTTP 503 to unavailable (transient, retryable)', () => {
    expect(classifyAiFailure({ name: 'ApiError', status: 503 })).toBe('unavailable');
  });

  it('treats a real ApiError 429 body (the shape the proxy returns) as rate-limited', () => {
    const err = Object.assign(new Error(
      '{"error":{"message":"The demo is busy right now — try again in a few minutes","code":429,"status":"Too Many Requests"}}',
    ), { name: 'ApiError', status: 429 });
    expect(classifyAiFailure(err)).toBe('rate-limited');
  });

  it('falls back to message sniffing when status is absent', () => {
    expect(classifyAiFailure(new Error('429 Too Many Requests'))).toBe('rate-limited');
    expect(classifyAiFailure(new Error('rate limit exceeded'))).toBe('rate-limited');
    expect(classifyAiFailure(new Error('503 Service Unavailable'))).toBe('unavailable');
  });

  it('classifies model/key/quota and unknown errors as other', () => {
    expect(classifyAiFailure({ status: 403 })).toBe('other');
    expect(classifyAiFailure(new Error('API key not valid'))).toBe('other');
    expect(classifyAiFailure(null)).toBe('other');
    expect(classifyAiFailure(undefined)).toBe('other');
  });
});
