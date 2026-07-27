import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clientIp, createRateLimiter, rateLimitPolicyForPath, RATE_LIMIT_POLICIES } from '../lib/rateLimit.js';

test('createRateLimiter allows up to max requests per window then blocks', () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 3 });
  assert.equal(limiter.check('1.2.3.4'), true);
  assert.equal(limiter.check('1.2.3.4'), true);
  assert.equal(limiter.check('1.2.3.4'), true);
  assert.equal(limiter.check('1.2.3.4'), false);
  limiter.stop();
});

test('rateLimitPolicyForPath assigns independent route policies', () => {
  assert.equal(rateLimitPolicyForPath('/api/contact'), 'contact');
  assert.equal(rateLimitPolicyForPath('/api/strava/token'), 'oauth');
  assert.equal(rateLimitPolicyForPath('/api/strava/photo'), 'photo');
  assert.equal(rateLimitPolicyForPath('/api/photo-proxy'), 'photo');
  assert.equal(rateLimitPolicyForPath('/api/isochrones'), 'isochrones');
  assert.equal(rateLimitPolicyForPath('/api/hairstyle-ai-studio/analyze'), 'hairstyleText');
  assert.equal(rateLimitPolicyForPath('/api/hairstyle-ai-studio/generate'), 'hairstyleImage');
  assert.equal(rateLimitPolicyForPath('/api/hairstyle-ai-studio/refine'), 'hairstyleImage');
  assert.equal(rateLimitPolicyForPath('/api/apps'), null);
});

// Regression: publish/save/review/social used to leave three of the four
// writer endpoints unmapped (and therefore unlimited).
test('rateLimitPolicyForPath maps every writer form endpoint', () => {
  assert.equal(rateLimitPolicyForPath('/api/writer/publish'), 'writer');
  assert.equal(rateLimitPolicyForPath('/api/writer/review'), 'writer');
  assert.equal(rateLimitPolicyForPath('/api/writer/social'), 'writer');
  assert.equal(rateLimitPolicyForPath('/api/writer/save'), 'writerSave');
});

test('writerSave policy is more generous than the other writer actions but still bounded', () => {
  assert.ok(RATE_LIMIT_POLICIES.writerSave.max > RATE_LIMIT_POLICIES.writer.max);
  assert.equal(RATE_LIMIT_POLICIES.writerSave.windowMs, 60_000);
});

test('clientIp ignores spoofed X-Forwarded-For prefixes on Cloud Run', () => {
  const request = {
    headers: { 'x-forwarded-for': 'spoofed, 203.0.113.8, 169.254.1.1' },
    socket: { remoteAddress: '127.0.0.1' },
  };
  assert.equal(clientIp(request), '203.0.113.8');
  request.headers['x-forwarded-for'] = 'spoofed-only';
  assert.equal(clientIp(request), '127.0.0.1');
});

test('createRateLimiter tracks separate keys independently', () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
  assert.equal(limiter.check('a'), true);
  assert.equal(limiter.check('b'), true);
  assert.equal(limiter.check('a'), false);
  assert.equal(limiter.check('b'), false);
  limiter.stop();
});
