import test from 'node:test';
import assert from 'node:assert/strict';
import {
  handleInfographicAgentApi,
  validateInfographicApiKey,
} from '../lib/infographicAgent.js';

test('validateInfographicApiKey validates API keys correctly', () => {
  assert.equal(validateInfographicApiKey('AIzaSyValidGeminiKey123'), 'AIzaSyValidGeminiKey123');
  assert.equal(validateInfographicApiKey('short'), null);
  assert.equal(validateInfographicApiKey(null), null);
  assert.equal(validateInfographicApiKey(undefined), null);
  assert.equal(validateInfographicApiKey(''), null);
});

test('handleInfographicAgentApi returns 404 for unknown path', async () => {
  const result = await handleInfographicAgentApi({
    pathname: '/api/infographic-agent/unknown',
    method: 'POST',
    body: {},
    apiKey: 'AIzaSyValidGeminiKey123',
    credentialSource: 'hosted',
  });
  assert.equal(result.statusCode, 404);
  assert.match(result.json.error, /Unknown infographic-agent API route/);
});

test('handleInfographicAgentApi /prepare rejects missing topic', async () => {
  const result = await handleInfographicAgentApi({
    pathname: '/api/infographic-agent/prepare',
    method: 'POST',
    body: {},
    apiKey: 'AIzaSyValidGeminiKey123',
    credentialSource: 'hosted',
  });
  assert.equal(result.statusCode, 400);
  assert.match(result.json.error, /Topic or content text is required/);
});

test('handleInfographicAgentApi /render rejects missing prompt', async () => {
  const result = await handleInfographicAgentApi({
    pathname: '/api/infographic-agent/render',
    method: 'POST',
    body: {},
    apiKey: 'AIzaSyValidGeminiKey123',
    credentialSource: 'hosted',
  });
  assert.equal(result.statusCode, 400);
  assert.match(result.json.error, /A prompt or edit instruction is required/);
});
