import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createRealWorldReasoningHandler,
  GMP_SOLUTION_ID,
  REAL_WORLD_REASONING_PREFIX,
  validateRealWorldReasoningMetadata,
} from '../lib/realWorldReasoning.js';
import {
  clientIp,
  createCircularBucketRateLimiter,
  DEFAULT_GEMINI_OMNI_LIMITS,
  resetHostedGeminiHealthForTesting,
  recordHostedGeminiFailure,
  recordHostedGeminiSuccess,
  isHostedGeminiHealthy,
} from '../lib/rateLimit.js';

const PERSONAL_KEY = 'personal-test-key';
const HOSTED_KEY = 'hosted-test-key';
const BASE_ENV = {
  RWR_AI_RATE_LIMIT: '1000',
  RWR_GMP_RATE_LIMIT: '1000',
  RWR_PROXY_HEARTBEAT_MS: '0',
};

class MockResponse extends EventEmitter {
  constructor() {
    super();
    this.statusCode = null;
    this.headers = {};
    this.chunks = [];
    this.headersSent = false;
    this.writableEnded = false;
    this.destroyed = false;
  }

  writeHead(statusCode, headers = {}) {
    this.statusCode = statusCode;
    this.headers = Object.fromEntries(
      Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
    );
    this.headersSent = true;
  }

  write(chunk) {
    this.chunks.push(Buffer.from(chunk));
    return true;
  }

  end(chunk) {
    if (chunk !== undefined) this.write(chunk);
    this.writableEnded = true;
  }

  destroy() {
    this.destroyed = true;
  }

  get text() {
    return Buffer.concat(this.chunks).toString('utf8');
  }
}

function mockRequest({
  method = 'GET',
  headers = {},
  body = '',
  remoteAddress = '127.0.0.1',
} = {}) {
  const request = Readable.from(body === '' ? [] : [Buffer.from(body)]);
  request.method = method;
  request.headers = { host: 'fieldwork.test', ...headers };
  request.socket = { remoteAddress };
  return request;
}

async function invoke({
  handler = createRealWorldReasoningHandler({ logger: () => {} }),
  path = 'capabilities',
  method = 'GET',
  headers,
  body,
  env = BASE_ENV,
  fetchImpl = async () => {
    throw new Error('Unexpected upstream call');
  },
  search = '',
  remoteAddress,
} = {}) {
  const request = mockRequest({ method, headers, body, remoteAddress });
  const response = new MockResponse();
  const handled = await handler({
    request,
    response,
    pathname: `${REAL_WORLD_REASONING_PREFIX}${path}`,
    searchParams: new URLSearchParams(search),
    env,
    fetchImpl,
  });
  return { handled, request, response };
}

test('handler claims only its namespaced prefix and reports configured capabilities', async () => {
  const handler = createRealWorldReasoningHandler({ logger: () => {} });
  const request = mockRequest();
  const response = new MockResponse();
  const outside = await handler({
    request,
    response,
    pathname: '/api/other/capabilities',
    searchParams: new URLSearchParams(),
    env: {},
    fetchImpl: async () => {
      throw new Error('Unexpected upstream call');
    },
  });
  assert.equal(outside, false);
  assert.equal(response.headersSent, false);

  const result = await invoke({
    handler,
    env: {
      ...BASE_ENV,
      GMP_SERVER_API_KEY: 'maps-test-key',
      GMP_MCP_KEY: 'mcp-test-key',
      GEMINI_API_KEY: HOSTED_KEY,
      RWR_GROUNDING_LITE_ENABLED: 'true',
    },
  });
  assert.equal(result.handled, true);
  assert.equal(result.response.statusCode, 200);
  assert.deepEqual(JSON.parse(result.response.text), {
    maps: true,
    gemini: true,
    hostedGemini: true,
    mapsGrounding: true,
    groundingLite: true,
  });
});

test('rate buckets use the trusted Cloud Run client hop and ignore lone spoofable XFF values', async () => {
  assert.equal(clientIp(mockRequest({
    headers: { 'x-forwarded-for': 'spoofed, 198.51.100.42, trusted-proxy' },
  })), '198.51.100.42');
  assert.equal(clientIp(mockRequest({
    headers: { 'x-forwarded-for': 'spoofed-only' },
    remoteAddress: '10.0.0.5',
  })), '10.0.0.5');

  const handler = createRealWorldReasoningHandler({ logger: () => {} });
  const options = {
    handler,
    path: 'ai/v1beta/models/not-a-real-model:generateContent',
    method: 'POST',
    headers: {
      origin: 'https://fieldwork.test',
      'content-type': 'application/json',
      'x-atlas-gemini-key': PERSONAL_KEY,
      'x-forwarded-for': 'attacker-controlled',
    },
    body: '{}',
    env: { ...BASE_ENV, RWR_AI_RATE_LIMIT: '1' },
    remoteAddress: '10.0.0.5',
  };
  const first = await invoke(options);
  assert.equal(first.response.statusCode, 403);
  const second = await invoke({
    ...options,
    headers: { ...options.headers, 'x-forwarded-for': 'different-attacker-value' },
  });
  assert.equal(second.response.statusCode, 429);
});

test('all supported GMP product proxies add fixed Solution ID attribution', async (t) => {
  const routes = [
    ['geocode/json', 'address=Mountain+View', 'maps.googleapis.com'],
    ['airquality/v1/currentConditions:lookup', '', 'airquality.googleapis.com', 'POST'],
    ['weather/v1/currentConditions:lookup', 'location.latitude=1&location.longitude=2', 'weather.googleapis.com'],
    ['pollen/v1/forecast:lookup', 'location.latitude=1&location.longitude=2&days=1', 'pollen.googleapis.com'],
    ['solar/v1/buildingInsights:findClosest', 'location.latitude=1&location.longitude=2', 'solar.googleapis.com'],
    ['streetview/maps/api/streetview', 'size=600x300&location=1%2C2', 'maps.googleapis.com'],
    ['staticmap/maps/api/staticmap', 'size=600x300&center=1%2C2', 'maps.googleapis.com'],
  ];

  for (const [path, search, expectedHost, method = 'GET'] of routes) {
    await t.test(path, async () => {
      let upstream;
      const result = await invoke({
        path: `gmp/${path}`,
        search,
        method,
        body: method === 'POST' ? '{}' : '',
        headers: {
          origin: 'https://fieldwork.test',
          'content-type': 'application/json',
        },
        env: { ...BASE_ENV, GMP_SERVER_API_KEY: 'maps-test-key' },
        fetchImpl: async (url, init) => {
          upstream = { url: new URL(url), init };
          return new Response('{}', {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        },
      });
      assert.equal(result.response.statusCode, 200);
      assert.equal(upstream.url.hostname, expectedHost);
      assert.equal(upstream.url.searchParams.get('key'), 'maps-test-key');
      assert.equal(upstream.init.headers['X-Goog-Maps-Solution-ID'], GMP_SOLUTION_ID);
    });
  }
});

test('Air Quality heatmap tiles include both required header and tile solution query', async () => {
  let upstream;
  await invoke({
    path: 'gmp/airquality/v1/mapTypes/US_AQI/heatmapTiles/2/1/1',
    env: { ...BASE_ENV, GMP_SERVER_API_KEY: 'maps-test-key' },
    fetchImpl: async (url, init) => {
      upstream = { url: new URL(url), init };
      return new Response('png', { status: 200, headers: { 'content-type': 'image/png' } });
    },
  });
  assert.equal(upstream.url.searchParams.get('solution_id'), GMP_SOLUTION_ID);
  assert.equal(upstream.init.headers['X-Goog-Maps-Solution-ID'], GMP_SOLUTION_ID);
});

test('shared Maps proxy stops at independent daily REST and tile cost ceilings', async () => {
  let calls = 0;
  const handler = createRealWorldReasoningHandler({ logger: () => {} });
  const fetchImpl = async () => {
    calls += 1;
    return new Response('{}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const env = {
    ...BASE_ENV,
    GMP_SERVER_API_KEY: 'maps-test-key',
    RWR_DAILY_GMP_CAP: '1',
    RWR_DAILY_GMP_TILE_CAP: '1',
  };

  const restOptions = {
    handler,
    path: 'gmp/weather/v1/currentConditions:lookup',
    search: 'location.latitude=1&location.longitude=2',
    headers: { origin: 'https://fieldwork.test' },
    env,
    fetchImpl,
  };
  assert.equal((await invoke(restOptions)).response.statusCode, 200);
  assert.equal((await invoke(restOptions)).response.statusCode, 429);

  const tileOptions = {
    handler,
    path: 'gmp/airquality/v1/mapTypes/US_AQI/heatmapTiles/2/1/1',
    headers: { origin: 'https://fieldwork.test' },
    env,
    fetchImpl,
  };
  assert.equal((await invoke(tileOptions)).response.statusCode, 200);
  assert.equal((await invoke(tileOptions)).response.statusCode, 429);
  assert.equal(calls, 2);
});

test('GMP proxy blocks cross-origin and attacker-controlled targets before fetch', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response('{}');
  };
  const crossOrigin = await invoke({
    path: 'gmp/weather/v1/currentConditions:lookup',
    headers: { origin: 'https://evil.example' },
    env: { ...BASE_ENV, GMP_SERVER_API_KEY: 'maps-test-key' },
    fetchImpl,
  });
  assert.equal(crossOrigin.response.statusCode, 429);
  const fetchMetadataBlocked = await invoke({
    path: 'gmp/weather/v1/currentConditions:lookup',
    headers: { 'sec-fetch-site': 'cross-site' },
    env: { ...BASE_ENV, GMP_SERVER_API_KEY: 'maps-test-key' },
    fetchImpl,
  });
  assert.equal(fetchMetadataBlocked.response.statusCode, 429);

  const photo = await invoke({
    path: 'gmp/placephoto',
    search: `url=${encodeURIComponent('https://evil.example/photo.jpg')}`,
    env: { ...BASE_ENV, GMP_SERVER_API_KEY: 'maps-test-key' },
    fetchImpl,
  });
  assert.equal(photo.response.statusCode, 400);

  const pinned = await invoke({
    path: 'gmp/weather//evil.example/steal',
    env: { ...BASE_ENV, GMP_SERVER_API_KEY: 'maps-test-key' },
    fetchImpl,
  });
  assert.equal(pinned.response.statusCode, 404);
  const wrongMethod = await invoke({
    path: 'gmp/weather/v1/currentConditions:lookup',
    method: 'POST',
    env: { ...BASE_ENV, GMP_SERVER_API_KEY: 'maps-test-key' },
    fetchImpl,
  });
  assert.equal(wrongMethod.response.statusCode, 404);
  assert.equal(calls, 0);
});

test('Places photo proxy allows only pinned Google-hosted image URLs', async () => {
  let upstream;
  const photoUrl = 'https://places.googleapis.com/v1/places/example/photos/photo/media?maxWidthPx=640';
  const result = await invoke({
    path: 'gmp/placephoto',
    search: `url=${encodeURIComponent(photoUrl)}`,
    headers: { origin: 'https://fieldwork.test' },
    env: { ...BASE_ENV, GMP_SERVER_API_KEY: 'maps-test-key' },
    fetchImpl: async (url) => {
      upstream = new URL(url);
      return new Response('image', {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      });
    },
  });
  assert.equal(result.response.statusCode, 200);
  assert.equal(upstream.hostname, 'places.googleapis.com');
  assert.equal(upstream.searchParams.get('key'), 'maps-test-key');

  const directCdn = await invoke({
    path: 'gmp/placephoto',
    search: `url=${encodeURIComponent('https://lh3.googleusercontent.com/arbitrary')}`,
    env: { ...BASE_ENV, GMP_SERVER_API_KEY: 'maps-test-key' },
  });
  assert.equal(directCdn.response.statusCode, 400);
});

test('BYOK Gemini traffic bypasses hosted caps, strips URL keys, and preserves caller budget', async () => {
  let upstream;
  const body = JSON.stringify({
    contents: [{ parts: [{ text: 'hello' }] }],
    generationConfig: { maxOutputTokens: 8_192 },
  });
  const result = await invoke({
    path: 'ai/v1beta/models/gemini-3.6-flash:generateContent',
    search: 'key=visitor-key&alt=sse',
    method: 'POST',
    headers: {
      origin: 'https://fieldwork.test',
      referer: 'https://fieldwork.test/?prompt=do-not-forward',
      'content-type': 'application/json',
      'x-atlas-gemini-key': PERSONAL_KEY,
    },
    body,
    env: {
      ...BASE_ENV,
      GEMINI_API_KEY: HOSTED_KEY,
      RWR_DAILY_AI_CAP: '0',
    },
    fetchImpl: async (url, init) => {
      upstream = { url: new URL(url), init };
      return new Response('{"ok":true}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  assert.equal(result.response.statusCode, 200);
  assert.equal(upstream.url.searchParams.has('key'), false);
  assert.equal(upstream.url.searchParams.get('alt'), 'sse');
  assert.equal(upstream.init.headers['x-goog-api-key'], PERSONAL_KEY);
  assert.equal(upstream.init.headers.referer, 'https://fieldwork.test');
  assert.equal(JSON.parse(upstream.init.body).generationConfig.maxOutputTokens, 8_192);
});

test('hosted Gemini traffic clamps output and stops at its daily spend cap', async () => {
  const calls = [];
  const handler = createRealWorldReasoningHandler({ logger: () => {} });
  const options = {
    handler,
    path: 'ai/v1beta/models/gemini-3.6-flash:generateContent',
    method: 'POST',
    headers: { origin: 'https://fieldwork.test', 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [],
      generationConfig: { temperature: 0.2, maxOutputTokens: 8_192 },
    }),
    env: {
      ...BASE_ENV,
      GEMINI_API_KEY: HOSTED_KEY,
      RWR_DAILY_AI_CAP: '1',
      RWR_HOSTED_AI_MAX_OUTPUT_TOKENS: '2048',
    },
    fetchImpl: async (_url, init) => {
      calls.push(init);
      return new Response('{}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  };

  const first = await invoke(options);
  assert.equal(first.response.statusCode, 200);
  assert.equal(JSON.parse(calls[0].body).generationConfig.maxOutputTokens, 2_048);

  const second = await invoke(options);
  assert.equal(second.response.statusCode, 429);
  assert.equal(calls.length, 1);
});

test('malformed personal key never falls back to the hosted Gemini key', async () => {
  let calls = 0;
  const result = await invoke({
    path: 'ai/v1beta/models/gemini-3.6-flash:generateContent',
    method: 'POST',
    headers: {
      origin: 'https://fieldwork.test',
      'content-type': 'application/json',
      'x-atlas-gemini-key': 'bad key',
    },
    body: '{}',
    env: { ...BASE_ENV, GEMINI_API_KEY: HOSTED_KEY },
    fetchImpl: async () => {
      calls += 1;
      return new Response('{}');
    },
  });
  assert.equal(result.response.statusCode, 401);
  assert.equal(calls, 0);
});

test('Interactions API permits only allowlisted body models and keeps hosted video disabled by default', async () => {
  let calls = 0;
  const hosted = await invoke({
    path: 'ai/v1beta/interactions',
    method: 'POST',
    headers: { origin: 'https://fieldwork.test', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'gemini-omni-1.1-flash-preview', input: 'hello' }),
    env: { ...BASE_ENV, GEMINI_API_KEY: HOSTED_KEY },
    fetchImpl: async () => {
      calls += 1;
      return new Response('{}');
    },
  });
  assert.equal(hosted.response.statusCode, 429);

  const disallowed = await invoke({
    path: 'ai/v1beta/interactions',
    method: 'POST',
    headers: {
      origin: 'https://fieldwork.test',
      'content-type': 'application/json',
      'x-atlas-gemini-key': PERSONAL_KEY,
    },
    body: JSON.stringify({ model: 'not-a-real-model', input: 'hello' }),
    env: BASE_ENV,
    fetchImpl: async () => {
      calls += 1;
      return new Response('{}');
    },
  });
  assert.equal(disallowed.response.statusCode, 403);

  const allowed = await invoke({
    path: 'ai/v1beta/interactions',
    method: 'POST',
    headers: {
      origin: 'https://fieldwork.test',
      'content-type': 'application/json',
      'x-atlas-gemini-key': PERSONAL_KEY,
    },
    body: JSON.stringify({ model: 'gemini-omni-1.1-flash-preview', input: 'hello' }),
    env: BASE_ENV,
    fetchImpl: async (_url, init) => {
      calls += 1;
      assert.equal(init.headers['x-goog-api-key'], PERSONAL_KEY);
      return new Response('{}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });
  assert.equal(allowed.response.statusCode, 200);
  assert.equal(calls, 1);
});

test('Gemini validation checks required models with header-only authentication', async () => {
  const calls = [];
  const result = await invoke({
    path: 'ai/validate',
    method: 'POST',
    headers: {
      origin: 'https://fieldwork.test',
      'x-atlas-gemini-key': PERSONAL_KEY,
    },
    env: BASE_ENV,
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response('{}', { status: 200 });
    },
  });
  assert.equal(result.response.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls.every(({ url }) => !url.includes(PERSONAL_KEY)), true);
  assert.equal(calls.every(({ init }) => init.headers['x-goog-api-key'] === PERSONAL_KEY), true);
});

test('metadata sink accepts only consented, structural, content-free records', async () => {
  const records = [{
    scenario: 'adstudio',
    tool: 'generate_ad_creatives',
    status: 'ok',
    category: 'success',
    detailLabels: ['Business'],
    tsBucket: 1_700_000_040_000,
  }];
  assert.deepEqual(validateRealWorldReasoningMetadata(records), { ok: true, count: 1 });
  assert.equal(validateRealWorldReasoningMetadata([{ ...records[0], url: 'https://example.com' }]).ok, false);
  assert.equal(validateRealWorldReasoningMetadata([{ ...records[0], tool: 'x'.repeat(65) }]).ok, false);
  assert.equal(validateRealWorldReasoningMetadata([{
    ...records[0],
    detailLabels: Array.from({ length: 11 }, () => 'Label'),
  }]).ok, false);

  const logs = [];
  const handler = createRealWorldReasoningHandler({ logger: (line) => logs.push(line) });
  const accepted = await invoke({
    handler,
    path: 'metadata',
    method: 'POST',
    headers: {
      origin: 'https://fieldwork.test',
      'content-type': 'application/json',
      'x-atlas-consent': '1',
    },
    body: JSON.stringify(records),
  });
  assert.equal(accepted.response.statusCode, 204);
  assert.equal(JSON.parse(logs[0]).evt, 'diag_batch');

  const dirty = await invoke({
    handler,
    path: 'metadata',
    method: 'POST',
    headers: {
      origin: 'https://fieldwork.test',
      'content-type': 'application/json',
      'x-atlas-consent': '1',
    },
    body: JSON.stringify([{ ...records[0], category: 'https://leak.example' }]),
    remoteAddress: '127.0.0.2',
  });
  assert.equal(dirty.response.statusCode, 400);
  assert.doesNotMatch(logs.join('\n'), /leak\.example/);
});

test('oversize AI bodies fail with 413 before any upstream request', async () => {
  let calls = 0;
  const result = await invoke({
    path: 'ai/v1beta/models/gemini-3.6-flash:generateContent',
    method: 'POST',
    headers: {
      origin: 'https://fieldwork.test',
      'content-type': 'application/json',
      'x-atlas-gemini-key': PERSONAL_KEY,
    },
    body: 'x'.repeat(1_025),
    env: { ...BASE_ENV, RWR_BODY_CAP_BYTES: '1024' },
    fetchImpl: async () => {
      calls += 1;
      return new Response('{}');
    },
  });
  assert.equal(result.response.statusCode, 413);
  assert.equal(calls, 0);
});

test('Omni model requests enforce the 2 calls/day Omni rate limiter on hosted credentials', async () => {
  let currentTime = Date.parse('2026-08-17T12:00:00Z');
  const omniLimiter = createCircularBucketRateLimiter({
    ...DEFAULT_GEMINI_OMNI_LIMITS,
    now: () => currentTime,
  });
  const handler = createRealWorldReasoningHandler({
    logger: () => {},
    geminiOmniLimiter: omniLimiter,
    now: () => currentTime,
  });

  const env = {
    ...BASE_ENV,
    GEMINI_API_KEY: HOSTED_KEY,
    RWR_DAILY_VIDEO_CAP: '100',
  };

  let upstreamCalls = 0;
  const mockFetch = async () => {
    upstreamCalls += 1;
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'done' }] } }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  // Call 1: success
  const call1 = await invoke({
    handler,
    path: 'ai/v1beta/models/gemini-omni-1.1-flash-preview:generateContent',
    method: 'POST',
    headers: { origin: 'https://fieldwork.test', 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: 'test 1' }] }] }),
    env,
    fetchImpl: mockFetch,
  });
  assert.equal(call1.response.statusCode, 200);
  assert.equal(upstreamCalls, 1);

  // Call 2: success
  const call2 = await invoke({
    handler,
    path: 'ai/v1beta/models/gemini-omni-1.1-flash-preview:generateContent',
    method: 'POST',
    headers: { origin: 'https://fieldwork.test', 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: 'test 2' }] }] }),
    env,
    fetchImpl: mockFetch,
  });
  assert.equal(call2.response.statusCode, 200);
  assert.equal(upstreamCalls, 2);

  // Call 3: 429 blocked by Omni limiter
  const call3 = await invoke({
    handler,
    path: 'ai/v1beta/models/gemini-omni-1.1-flash-preview:generateContent',
    method: 'POST',
    headers: { origin: 'https://fieldwork.test', 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: 'test 3' }] }] }),
    env,
    fetchImpl: mockFetch,
  });
  assert.equal(call3.response.statusCode, 429);
  assert.match(call3.response.chunks.join(''), /Daily Gemini Omni request limit reached/);
  assert.equal(upstreamCalls, 2);

  // Personal key bypasses the hosted Omni limit
  const personalCall = await invoke({
    handler,
    path: 'ai/v1beta/models/gemini-omni-1.1-flash-preview:generateContent',
    method: 'POST',
    headers: {
      origin: 'https://fieldwork.test',
      'content-type': 'application/json',
      'x-atlas-gemini-key': PERSONAL_KEY,
    },
    body: JSON.stringify({ contents: [{ parts: [{ text: 'personal' }] }] }),
    env,
    fetchImpl: mockFetch,
  });
  assert.equal(personalCall.response.statusCode, 200);
  assert.equal(upstreamCalls, 3);
});

test('hosted Gemini health changes capabilities and blocks hosted requests with 503 FREE_TIER_UNAVAILABLE', async () => {
  resetHostedGeminiHealthForTesting();
  const env = {
    ...BASE_ENV,
    GMP_SERVER_API_KEY: 'maps-test-key',
    GEMINI_API_KEY: HOSTED_KEY,
    RWR_GROUNDING_LITE_ENABLED: 'true',
  };
  const handler = createRealWorldReasoningHandler({
    env,
    fetchImpl: async () => new Response('{"ok":true}', { status: 200 }),
  });

  // When healthy: gemini is true, hostedGemini is true
  const healthyCap = await invoke({ handler, env });
  assert.deepEqual(JSON.parse(healthyCap.response.text), {
    maps: true,
    gemini: true,
    hostedGemini: true,
    mapsGrounding: true,
    groundingLite: true,
  });

  // Mark unhealthy
  recordHostedGeminiFailure('quota_depleted');

  // When unhealthy: gemini is false, hostedGemini is false
  const degradedCap = await invoke({ handler, env });
  assert.deepEqual(JSON.parse(degradedCap.response.text), {
    maps: true,
    gemini: false,
    hostedGemini: false,
    mapsGrounding: false,
    groundingLite: false,
  });

  // When unhealthy but BYOK key is provided: gemini is true, hostedGemini is false
  const byokCap = await invoke({
    handler,
    env,
    headers: { 'x-atlas-gemini-key': PERSONAL_KEY },
  });
  assert.deepEqual(JSON.parse(byokCap.response.text), {
    maps: true,
    gemini: true,
    hostedGemini: false,
    mapsGrounding: true,
    groundingLite: true,
  });

  // Hosted request returns 503 FREE_TIER_UNAVAILABLE immediately without calling upstream
  let calledUpstream = false;
  const mockFetch = async () => {
    calledUpstream = true;
    return new Response('{}', { status: 200 });
  };
  const unhealthyHandler = createRealWorldReasoningHandler({ env, fetchImpl: mockFetch });
  const hostedCall = await invoke({
    handler: unhealthyHandler,
    path: 'ai/v1beta/models/gemini-3.8-flash:generateContent',
    method: 'POST',
    headers: { origin: 'https://fieldwork.test', 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: 'hello' }] }] }),
    env,
    fetchImpl: mockFetch,
  });
  assert.equal(hostedCall.response.statusCode, 503);
  assert.equal(calledUpstream, false);
  assert.match(hostedCall.response.chunks.join(''), /The shared Gemini allowance is temporarily unavailable/);

  // BYOK request still succeeds
  const personalCall = await invoke({
    handler: unhealthyHandler,
    path: 'ai/v1beta/models/gemini-3.8-flash:generateContent',
    method: 'POST',
    headers: {
      origin: 'https://fieldwork.test',
      'content-type': 'application/json',
      'x-atlas-gemini-key': PERSONAL_KEY,
    },
    body: JSON.stringify({ contents: [{ parts: [{ text: 'hello personal' }] }] }),
    env,
    fetchImpl: mockFetch,
  });
  assert.equal(personalCall.response.statusCode, 200);
  assert.equal(calledUpstream, true);

  resetHostedGeminiHealthForTesting();
});

