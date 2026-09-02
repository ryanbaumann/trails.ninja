import { describe, expect, it } from 'vitest';
import {
  stripToOrigin,
  validateMetadata,
  METADATA_MAX_RECORDS,
  classifyProxyOutcome,
  toProxyDiagRecord,
  PROXY_ENDPOINTS,
  shouldHeartbeat,
  HEARTBEAT_MS,
  GMP_SOLUTION_ID,
  upstreamHeaders,
  allowedGeminiModels,
  GEMINI_BYOK_HEADER,
  selectGeminiCredential,
  validateGeminiCredential,
  capGenerateContentRequest,
} from './lib.mjs';

describe('Gemini credential routing', () => {
  it('allowlists the orchestrator and worker defaults', () => {
    const models = allowedGeminiModels();
    expect(models.has('gemini-3.8-flash')).toBe(true);
    expect(models.has('gemini-3.7-flash')).toBe(true);
    expect(models.has('gemini-3.6-flash')).toBe(true);
    expect(models.has('gemini-3.5-flash-lite')).toBe(true);
    expect(models.has('gemini-omni-1.1-flash-preview')).toBe(true);
  });

  it('prefers a plausible personal key and otherwise uses hosted auth', () => {
    expect(selectGeminiCredential({ [GEMINI_BYOK_HEADER]: 'personal-test-key' }, 'hosted-test-key'))
      .toEqual({ source: 'byok', key: 'personal-test-key' });
    expect(selectGeminiCredential({}, 'hosted-test-key'))
      .toEqual({ source: 'hosted', key: 'hosted-test-key' });
    expect(selectGeminiCredential({ [GEMINI_BYOK_HEADER]: 'bad key' }, 'hosted-test-key').source)
      .toBe('invalid');
  });

  it('validates required models with header auth and never puts a key in the URL', async () => {
    const calls = [];
    const result = await validateGeminiCredential('personal-test-key', async (url, init) => {
      calls.push({ url, init });
      return new Response('{}', { status: 200 });
    });
    expect(result).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls.every(({ url }) => !String(url).includes('personal-test-key'))).toBe(true);
    expect(calls.every(({ init }) => init.headers['x-goog-api-key'] === 'personal-test-key')).toBe(true);
  });
});

describe('hosted Gemini output budget', () => {
  it('adds or clamps maxOutputTokens without changing other generation settings', () => {
    const added = JSON.parse(capGenerateContentRequest('{"contents":[]}', 2048).toString());
    expect(added.generationConfig.maxOutputTokens).toBe(2048);

    const clamped = JSON.parse(capGenerateContentRequest(JSON.stringify({
      contents: [],
      generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
    }), 2048).toString());
    expect(clamped.generationConfig).toEqual({ temperature: 0.2, maxOutputTokens: 2048 });
  });

  it('preserves a lower caller budget and rejects malformed JSON', () => {
    const request = JSON.parse(capGenerateContentRequest(JSON.stringify({
      generationConfig: { maxOutputTokens: 512 },
    }), 2048).toString());
    expect(request.generationConfig.maxOutputTokens).toBe(512);
    expect(() => capGenerateContentRequest('[]', 2048)).toThrow();
    expect(() => capGenerateContentRequest('{', 2048)).toThrow();
  });
});

describe('stripToOrigin', () => {
  it('reduces a full replay URL (with a raw prompt in the query) to its origin', () => {
    expect(stripToOrigin('https://atlas.app/?scenario=scout&prompt=find%20a%20quiet%20cafe%20near%20me')).toBe(
      'https://atlas.app',
    );
  });

  it('keeps a bare origin unchanged and returns empty for missing/invalid input', () => {
    expect(stripToOrigin('https://atlas.app')).toBe('https://atlas.app');
    expect(stripToOrigin('')).toBe('');
    expect(stripToOrigin(undefined)).toBe('');
    expect(stripToOrigin('not a url')).toBe('');
  });
});

describe('upstreamHeaders', () => {
  it('injects fixed solution attribution for production Weather proxy calls', () => {
    const headers = upstreamHeaders(
      { accept: 'application/json', referer: 'https://atlas.app/?prompt=private' },
      new URL('https://weather.googleapis.com/v1/currentConditions:lookup'),
    );
    expect(headers).toMatchObject({
      accept: 'application/json',
      referer: 'https://atlas.app',
      'X-Goog-Maps-Solution-ID': GMP_SOLUTION_ID,
    });
  });

  it('does not attach the Weather solution ID to unrelated upstreams', () => {
    expect(upstreamHeaders({}, new URL('https://routes.googleapis.com/')))
      .not.toHaveProperty('X-Goog-Maps-Solution-ID');
  });
});

describe('validateMetadata', () => {
  const ok = { scenario: 'adstudio', tool: 'generate_ad_creatives', status: 'error', category: 'error:generate_ad_creatives', detailLabels: ['Business'], tsBucket: 1_700_000_040_000 };

  it('accepts a clean array of sanitized records', () => {
    expect(validateMetadata([ok])).toEqual({ ok: true, count: 1 });
  });

  it('rejects non-arrays and oversize batches', () => {
    expect(validateMetadata({}).ok).toBe(false);
    expect(validateMetadata(new Array(METADATA_MAX_RECORDS + 1).fill(ok)).ok).toBe(false);
  });

  it('rejects unknown keys (no smuggling extra fields)', () => {
    expect(validateMetadata([{ ...ok, summary: 'Blue Bottle Coffee' }]).ok).toBe(false);
  });

  it('rejects bad types and invalid status', () => {
    expect(validateMetadata([{ ...ok, status: 'weird' }]).ok).toBe(false);
    expect(validateMetadata([{ ...ok, tsBucket: 'now' }]).ok).toBe(false);
    expect(validateMetadata([{ ...ok, detailLabels: [1, 2] }]).ok).toBe(false);
  });

  it('rejects forbidden content (urls, coords, emails, tokens, place ids)', () => {
    expect(validateMetadata([{ ...ok, category: 'http://leak.example' }]).ok).toBe(false);
    expect(validateMetadata([{ ...ok, detailLabels: ['37.79557,-122.39374'] }]).ok).toBe(false);
    expect(validateMetadata([{ ...ok, detailLabels: ['user@example.com'] }]).ok).toBe(false);
    expect(validateMetadata([{ ...ok, detailLabels: ['{business.name}'] }]).ok).toBe(false);
    expect(validateMetadata([{ ...ok, tool: 'placeId' }]).ok).toBe(false);
  });
});

describe('classifyProxyOutcome', () => {
  it('maps statuses to coarse, content-free failure classes', () => {
    expect(classifyProxyOutcome(429)).toBe('rate_limit');
    expect(classifyProxyOutcome(403)).toBe('forbidden');
    expect(classifyProxyOutcome(500)).toBe('upstream_error');
    expect(classifyProxyOutcome(502)).toBe('upstream_error');
    expect(classifyProxyOutcome(404)).toBe('bad_request');
    expect(classifyProxyOutcome(400)).toBe('bad_request');
    expect(classifyProxyOutcome(200)).toBe('ok');
    expect(classifyProxyOutcome(204)).toBe('ok');
    expect(classifyProxyOutcome(100)).toBe('other');
  });
});

describe('toProxyDiagRecord', () => {
  it('projects a failure into a SanitizedDiagnostic-shaped record', () => {
    expect(toProxyDiagRecord('ai', 429, 1_700_000_040_000)).toEqual({
      scenario: 'proxy',
      tool: 'ai',
      status: 'error',
      category: 'proxy:ai:rate_limit',
      detailLabels: [],
      tsBucket: 1_700_000_040_000,
    });
  });

  it('marks a 2xx as status:ok (the caller decides whether to log it)', () => {
    const r = toProxyDiagRecord('gmp:tile', 200, 0);
    expect(r?.status).toBe('ok');
    expect(r?.category).toBe('proxy:gmp:tile:ok');
  });

  it('rejects unknown endpoint labels (no smuggling a path/url as a label)', () => {
    expect(toProxyDiagRecord('/gmp/geocode?address=1600', 429)).toBeNull();
    expect(toProxyDiagRecord('http://leak.example', 500)).toBeNull();
  });

  it('only emits the fixed coarse endpoint labels', () => {
    expect([...PROXY_ENDPOINTS]).toEqual(['ai', 'gmp', 'gmp:tile', 'gmp:photo']);
  });

  it('defaults a bad tsBucket to 0 rather than leaking a non-numeric value', () => {
    // @ts-expect-error deliberately passing a bad tsBucket
    expect(toProxyDiagRecord('ai', 500, 'now').tsBucket).toBe(0);
  });
});

describe('shouldHeartbeat', () => {
  it('emits the first sample for an endpoint, then throttles within the interval', () => {
    const state = new Map<string, number>();
    expect(shouldHeartbeat(state, 'gmp:tile', 1_000, 10_000)).toBe(true);
    expect(shouldHeartbeat(state, 'gmp:tile', 5_000, 10_000)).toBe(false); // < interval
    expect(shouldHeartbeat(state, 'gmp:tile', 10_999, 10_000)).toBe(false); // still < interval
    expect(shouldHeartbeat(state, 'gmp:tile', 11_000, 10_000)).toBe(true); // interval elapsed
    expect(shouldHeartbeat(state, 'gmp:tile', 15_000, 10_000)).toBe(false); // throttled again
  });

  it('tracks each endpoint independently', () => {
    const state = new Map<string, number>();
    expect(shouldHeartbeat(state, 'ai', 0, 10_000)).toBe(true);
    expect(shouldHeartbeat(state, 'gmp', 0, 10_000)).toBe(true); // different endpoint, own clock
    expect(shouldHeartbeat(state, 'ai', 1_000, 10_000)).toBe(false);
  });

  it('is disabled when the interval is 0 or negative (never emits)', () => {
    const state = new Map<string, number>();
    expect(shouldHeartbeat(state, 'ai', 1_000, 0)).toBe(false);
    expect(shouldHeartbeat(state, 'ai', 1_000, -1)).toBe(false);
    expect(state.size).toBe(0); // did not record anything
  });

  it('defaults to the 10-minute HEARTBEAT_MS interval', () => {
    const state = new Map<string, number>();
    expect(HEARTBEAT_MS).toBe(10 * 60 * 1000);
    expect(shouldHeartbeat(state, 'ai', 0)).toBe(true);
    expect(shouldHeartbeat(state, 'ai', HEARTBEAT_MS - 1)).toBe(false);
    expect(shouldHeartbeat(state, 'ai', HEARTBEAT_MS)).toBe(true);
  });
});
