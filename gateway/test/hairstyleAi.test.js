import { test } from 'node:test';
import assert from 'node:assert/strict';

import { handleHairstyleAiApi, HAIRSTYLE_MODELS, validateHairstyleApiKey } from '../lib/hairstyleAi.js';

const API_KEY = 'test-key-with-enough-characters';
const FRONT_IMAGE = 'data:image/jpeg;base64,YWJj';

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

test('current model routing uses gemini-3.8-flash for opt-in analysis and the image-capable model for edits', () => {
  assert.equal(HAIRSTYLE_MODELS.vision, 'gemini-3.8-flash');
  assert.equal(HAIRSTYLE_MODELS.image, 'gemini-3.1-flash-lite-image');
});

test('API key validation rejects empty, short, and malformed values', () => {
  assert.equal(validateHairstyleApiKey(''), null);
  assert.equal(validateHairstyleApiKey('too-short'), null);
  assert.equal(validateHairstyleApiKey('bad key with spaces and enough length'), null);
  assert.equal(validateHairstyleApiKey(API_KEY), API_KEY);
});

test('handler requires POST and a selected hosted or transient key', async () => {
  const methodResult = await handleHairstyleAiApi({
    pathname: '/api/hairstyle-ai-studio/analyze',
    method: 'GET',
    body: {},
    apiKey: API_KEY,
  });
  assert.equal(methodResult.statusCode, 405);

  const keyResult = await handleHairstyleAiApi({
    pathname: '/api/hairstyle-ai-studio/analyze',
    method: 'POST',
    body: {},
    apiKey: '',
  });
  assert.equal(keyResult.statusCode, 401);
  assert.equal(keyResult.json.code, 'INVALID_GEMINI_KEY');
});

test('key validation checks Gemini without generating content', async () => {
  let upstreamRequest;
  const validation = await handleHairstyleAiApi({
    pathname: '/api/hairstyle-ai-studio/validate-key',
    method: 'POST',
    body: {},
    apiKey: API_KEY,
    credentialSource: 'byok',
    fetchImpl: async (url, init) => {
      upstreamRequest = { url, init };
      return jsonResponse({ name: `models/${HAIRSTYLE_MODELS.image}` });
    },
  });

  assert.equal(validation.statusCode, 200);
  assert.deepEqual(validation.json, { valid: true });
  assert.match(upstreamRequest.url, /\/v1beta\/models\//);
  assert.equal(upstreamRequest.init.method, 'GET');
  assert.equal(upstreamRequest.init.headers['x-goog-api-key'], API_KEY);
});

test('analysis is stateless, bounded, and uses the caller key only upstream', async () => {
  let upstreamRequest;
  const result = await handleHairstyleAiApi({
    pathname: '/api/hairstyle-ai-studio/analyze',
    method: 'POST',
    apiKey: API_KEY,
    body: {
      base64Image: FRONT_IMAGE,
      availableStyles: [{ id: 'bob', label: 'Bob', description: 'A short bob' }],
    },
    fetchImpl: async (_url, init) => {
      upstreamRequest = init;
      return jsonResponse({
        steps: [{
          type: 'model_output',
          content: [{ type: 'text', text: '{"recommendedStyleId":"bob"}' }],
        }],
      });
    },
  });

  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.json, { recommendedStyleId: 'bob' });
  assert.equal(upstreamRequest.headers['x-goog-api-key'], API_KEY);
  assert.equal(upstreamRequest.headers['Api-Revision'], '2026-05-20');
  const payload = JSON.parse(upstreamRequest.body);
  assert.equal(payload.model, HAIRSTYLE_MODELS.vision);
  assert.equal(payload.store, false);
  assert.deepEqual(payload.generation_config, { thinking_level: 'low' });
  assert.match(payload.input[1].text, /Do not infer or classify gender/);
  assert.doesNotMatch(JSON.stringify(result), new RegExp(API_KEY));
});

test('caller cancellation aborts the upstream Gemini interaction', async () => {
  const controller = new AbortController();
  let upstreamSignal;
  const pending = handleHairstyleAiApi({
    pathname: '/api/hairstyle-ai-studio/generate',
    method: 'POST',
    apiKey: API_KEY,
    signal: controller.signal,
    body: {
      images: { front: FRONT_IMAGE },
      styleDescription: 'Textured bob',
    },
    fetchImpl: async (_url, init) => {
      upstreamSignal = init.signal;
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
      });
    },
  });

  controller.abort();
  const result = await pending;
  assert.equal(upstreamSignal.aborted, true);
  assert.equal(result.statusCode, 499);
  assert.deepEqual(result.json, { error: 'Request cancelled.' });
});

test('generation validates inputs before contacting Gemini', async () => {
  let calls = 0;
  const result = await handleHairstyleAiApi({
    pathname: '/api/hairstyle-ai-studio/generate',
    method: 'POST',
    apiKey: API_KEY,
    body: { images: { front: 'https://example.com/photo.jpg' }, styleDescription: 'Bob' },
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse({});
    },
  });

  assert.equal(result.statusCode, 400);
  assert.equal(calls, 0);
});

test('generation makes one stateless image interaction and returns a data URL', async () => {
  let upstreamPayload;
  const result = await handleHairstyleAiApi({
    pathname: '/api/hairstyle-ai-studio/generate',
    method: 'POST',
    apiKey: API_KEY,
    body: {
      images: { front: FRONT_IMAGE, side: null, back: null },
      styleDescription: 'Textured bob',
      generationMode: 'fast',
      outputLayout: 'single',
    },
    fetchImpl: async (_url, init) => {
      upstreamPayload = JSON.parse(init.body);
      return jsonResponse({
        steps: [{
          type: 'model_output',
          content: [{ type: 'image', mime_type: 'image/jpeg', data: 'ZmluYWw=' }],
        }],
      });
    },
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.json.image, 'data:image/jpeg;base64,ZmluYWw=');
  assert.equal(upstreamPayload.model, HAIRSTYLE_MODELS.image);
  assert.equal(upstreamPayload.store, false);
  assert.equal(upstreamPayload.response_format.image_size, '1K');
});

test('upstream authentication and quota failures are sanitized', async () => {
  for (const [status, expected] of [[403, 401], [429, 429]]) {
    const result = await handleHairstyleAiApi({
      pathname: '/api/hairstyle-ai-studio/analyze',
      method: 'POST',
      apiKey: API_KEY,
      body: { base64Image: FRONT_IMAGE, availableStyles: [] },
      fetchImpl: async () => jsonResponse({ error: { message: 'provider detail' } }, { ok: false, status }),
    });
    assert.equal(result.statusCode, expected);
    assert.doesNotMatch(JSON.stringify(result), /provider detail/);
  }
});

test('upstream quota errors distinguish personal keys from the shared tier', async () => {
  const personal = await handleHairstyleAiApi({
    pathname: '/api/hairstyle-ai-studio/analyze',
    method: 'POST',
    apiKey: API_KEY,
    credentialSource: 'byok',
    body: { base64Image: FRONT_IMAGE, availableStyles: [] },
    fetchImpl: async () => jsonResponse({}, { ok: false, status: 429 }),
  });
  assert.equal(personal.json.code, 'GEMINI_QUOTA_EXHAUSTED');

  const hosted = await handleHairstyleAiApi({
    pathname: '/api/hairstyle-ai-studio/analyze',
    method: 'POST',
    apiKey: API_KEY,
    credentialSource: 'hosted',
    body: { base64Image: FRONT_IMAGE, availableStyles: [] },
    fetchImpl: async () => jsonResponse({}, { ok: false, status: 429 }),
  });
  assert.equal(hosted.json.code, 'FREE_TIER_UNAVAILABLE');
});
