import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clientIp,
  createDailyRateLimiter,
  createRateLimiter,
  rateLimitPolicyForPath,
  RATE_LIMIT_POLICIES,
  CircularBucketRateLimiter,
  createCircularBucketRateLimiter,
  extractGeminiTokenUsage,
  extractGeminiUsageAndCost,
  calculateGeminiCostMicros,
  DEFAULT_GEMINI_LIMITS,
  DEFAULT_GEMINI_OMNI_LIMITS,
  geminiOmniRateLimiter,
  recordHostedGeminiFailure,
  recordHostedGeminiSuccess,
  isHostedGeminiHealthy,
  getHostedGeminiHealth,
  resetHostedGeminiHealthForTesting,
} from '../lib/rateLimit.js';

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
  assert.equal(rateLimitPolicyForPath('/api/hairstyle-ai-studio/generate'), null);
  assert.equal(rateLimitPolicyForPath('/api/hairstyle-ai-studio/refine'), null);
  assert.equal(rateLimitPolicyForPath('/api/hairstyle-ai-studio/quota'), null);
  assert.equal(rateLimitPolicyForPath('/api/apps'), null);
});

test('createDailyRateLimiter resets at UTC midnight and can refund failed work', () => {
  let timestamp = Date.parse('2026-07-27T23:59:00Z');
  const limiter = createDailyRateLimiter({ max: 2, now: () => timestamp });

  assert.deepEqual(limiter.status('visitor'), {
    limit: 2,
    remaining: 2,
    resetAt: '2026-07-28T00:00:00.000Z',
  });
  assert.equal(limiter.take('visitor'), true);
  assert.equal(limiter.take('visitor'), true);
  assert.equal(limiter.take('visitor'), false);
  assert.equal(limiter.status('visitor').remaining, 0);

  limiter.refund('visitor');
  assert.equal(limiter.status('visitor').remaining, 1);

  timestamp = Date.parse('2026-07-28T00:00:01Z');
  assert.equal(limiter.status('visitor').remaining, 2);
  assert.equal(limiter.take('visitor'), true);
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

test('CircularBucketRateLimiter enforces user call limit of 100 per day', () => {
  let currentTime = Date.parse('2026-08-17T12:00:00Z');
  const limiter = createCircularBucketRateLimiter({
    userDailyCalls: 100,
    userDailyTokens: 100_000,
    globalDailyCalls: 1_000,
    globalDailyTokens: 1_000_000,
    now: () => currentTime,
  });

  for (let i = 0; i < 100; i++) {
    const result = limiter.consume('user-1', { calls: 1, tokens: 10 });
    assert.equal(result.allowed, true, `Call ${i + 1} should be allowed`);
    assert.equal(result.user.remainingCalls, 100 - (i + 1));
  }

  const blocked = limiter.consume('user-1', { calls: 1, tokens: 10 });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, 'USER_CALL_LIMIT');
  assert.ok(blocked.message.includes('Daily Gemini request limit reached (100 calls/day)'));

  // Another user is not blocked
  const user2 = limiter.consume('user-2', { calls: 1, tokens: 10 });
  assert.equal(user2.allowed, true);
});

test('CircularBucketRateLimiter enforces user token limit of 100k per day', () => {
  let currentTime = Date.parse('2026-08-17T12:00:00Z');
  const limiter = createCircularBucketRateLimiter({
    userDailyCalls: 100,
    userDailyTokens: 100_000,
    globalDailyCalls: 1_000,
    globalDailyTokens: 1_000_000,
    now: () => currentTime,
  });

  // Consume 90k tokens
  const r1 = limiter.consume('user-tokens', { calls: 1, tokens: 90_000 });
  assert.equal(r1.allowed, true);
  assert.equal(r1.user.remainingTokens, 10_000);

  // Requesting 15k tokens exceeds remaining 10k
  const blocked = limiter.consume('user-tokens', { calls: 1, tokens: 15_000 });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, 'USER_TOKEN_LIMIT');
  assert.ok(blocked.message.includes('Daily Gemini token limit reached'));

  // Requesting exactly remaining 10k tokens succeeds
  const r2 = limiter.consume('user-tokens', { calls: 1, tokens: 10_000 });
  assert.equal(r2.allowed, true);
  assert.equal(r2.user.remainingTokens, 0);

  // Any further token request is blocked
  const blocked2 = limiter.consume('user-tokens', { calls: 1, tokens: 1 });
  assert.equal(blocked2.allowed, false);
  assert.equal(blocked2.reason, 'USER_TOKEN_LIMIT');
});

test('CircularBucketRateLimiter enforces global call limit of 1,000 per day', () => {
  let currentTime = Date.parse('2026-08-17T12:00:00Z');
  const limiter = createCircularBucketRateLimiter({
    userDailyCalls: 100,
    userDailyTokens: 100_000,
    globalDailyCalls: 1_000,
    globalDailyTokens: 1_000_000,
    now: () => currentTime,
  });

  // 10 users each consume 100 calls -> total 1000 calls
  for (let u = 0; u < 10; u++) {
    for (let c = 0; c < 100; c++) {
      const res = limiter.consume(`user-${u}`, { calls: 1, tokens: 10 });
      assert.equal(res.allowed, true);
    }
  }

  // 11th user is blocked by global call limit
  const blocked = limiter.consume('user-11', { calls: 1, tokens: 10 });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, 'GLOBAL_CALL_LIMIT');
  assert.ok(blocked.message.includes('shared Gemini daily call budget is exhausted'));
});

test('CircularBucketRateLimiter enforces global token limit of 1M per day', () => {
  let currentTime = Date.parse('2026-08-17T12:00:00Z');
  const limiter = createCircularBucketRateLimiter({
    userDailyCalls: 100,
    userDailyTokens: 100_000,
    globalDailyCalls: 1_000,
    globalDailyTokens: 1_000_000,
    now: () => currentTime,
  });

  // 10 users each consume 100,000 tokens -> total 1,000,000 tokens
  for (let u = 0; u < 10; u++) {
    const res = limiter.consume(`user-tokens-${u}`, { calls: 1, tokens: 100_000 });
    assert.equal(res.allowed, true);
  }

  // 11th user is blocked by global token limit
  const blocked = limiter.consume('user-tokens-11', { calls: 1, tokens: 100 });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, 'GLOBAL_TOKEN_LIMIT');
  assert.ok(blocked.message.includes('shared Gemini daily token budget is exhausted'));
});

test('CircularBucketRateLimiter slides smoothly across 24-hour circular window', () => {
  let currentTime = Date.parse('2026-08-17T00:00:00Z');
  const limiter = createCircularBucketRateLimiter({
    userDailyCalls: 10,
    userDailyTokens: 10_000,
    globalDailyCalls: 100,
    globalDailyTokens: 100_000,
    now: () => currentTime,
  });

  // Hour 0: use 5 calls
  for (let i = 0; i < 5; i++) {
    assert.equal(limiter.consume('user-sliding', { calls: 1, tokens: 100 }).allowed, true);
  }
  assert.equal(limiter.status('user-sliding').user.remainingCalls, 5);

  // Hour 6: use 5 more calls (total 10 in window -> max reached)
  currentTime += 6 * 3600 * 1000;
  for (let i = 0; i < 5; i++) {
    assert.equal(limiter.consume('user-sliding', { calls: 1, tokens: 100 }).allowed, true);
  }
  assert.equal(limiter.consume('user-sliding', { calls: 1, tokens: 100 }).allowed, false);

  // Hour 24 + 1 minute (Hour 0's 5 calls have expired, Hour 6's 5 calls still active)
  currentTime = Date.parse('2026-08-17T00:00:00Z') + (24 * 3600 * 1000) + 60_000;
  const statusMid = limiter.status('user-sliding');
  assert.equal(statusMid.user.calls, 5);
  assert.equal(statusMid.user.remainingCalls, 5);

  // Can make 5 more calls now
  for (let i = 0; i < 5; i++) {
    assert.equal(limiter.consume('user-sliding', { calls: 1, tokens: 100 }).allowed, true);
  }
  assert.equal(limiter.consume('user-sliding', { calls: 1, tokens: 100 }).allowed, false);

  // Hour 30 + 1 minute (Hour 6's 5 calls have expired, Hour 24's 5 calls still active)
  currentTime = Date.parse('2026-08-17T00:00:00Z') + (30 * 3600 * 1000) + 60_000;
  assert.equal(limiter.status('user-sliding').user.calls, 5);
  assert.equal(limiter.status('user-sliding').user.remainingCalls, 5);

  // Hour 49 (All previous calls have now expired)
  currentTime = Date.parse('2026-08-17T00:00:00Z') + (49 * 3600 * 1000);
  assert.equal(limiter.status('user-sliding').user.calls, 0);
  assert.equal(limiter.status('user-sliding').user.remainingCalls, 10);
});

test('CircularBucketRateLimiter refunds and reconciles tokens accurately', () => {
  let currentTime = Date.parse('2026-08-17T12:00:00Z');
  const limiter = createCircularBucketRateLimiter({
    userDailyCalls: 100,
    userDailyTokens: 100_000,
    globalDailyCalls: 1_000,
    globalDailyTokens: 1_000_000,
    now: () => currentTime,
  });

  // Pre-request consume
  const pre = limiter.consume('ip-recon', { calls: 1, tokens: 1000 });
  assert.equal(pre.allowed, true);
  assert.equal(pre.user.remainingCalls, 99);
  assert.equal(pre.user.remainingTokens, 99_000);

  // Upstream actually consumed 1500 tokens -> record 500 delta
  limiter.record('ip-recon', { calls: 0, tokens: 500 });
  const statusAfterAdd = limiter.status('ip-recon');
  assert.equal(statusAfterAdd.user.tokens, 1500);
  assert.equal(statusAfterAdd.user.remainingTokens, 98_500);

  // Upstream consumed less: refund 300 tokens
  limiter.refund('ip-recon', { calls: 0, tokens: 300 });
  const statusAfterRefundTokens = limiter.status('ip-recon');
  assert.equal(statusAfterRefundTokens.user.tokens, 1200);
  assert.equal(statusAfterRefundTokens.user.remainingTokens, 98_800);

  // Refund entire call on error
  limiter.refund('ip-recon', { calls: 1, tokens: 1200 });
  const statusRestored = limiter.status('ip-recon');
  assert.equal(statusRestored.user.calls, 0);
  assert.equal(statusRestored.user.tokens, 0);
  assert.equal(statusRestored.user.remainingCalls, 100);
  assert.equal(statusRestored.user.remainingTokens, 100_000);
});

test('extractGeminiTokenUsage extracts tokens from JSON, SSE streams, and fallbacks', () => {
  // 1. JSON with usageMetadata
  const jsonResp = {
    candidates: [{ content: { parts: [{ text: 'Hello' }] } }],
    usageMetadata: {
      promptTokenCount: 15,
      candidatesTokenCount: 35,
      totalTokenCount: 50,
    },
  };
  assert.equal(extractGeminiTokenUsage(jsonResp), 50);
  assert.equal(extractGeminiTokenUsage(JSON.stringify(jsonResp)), 50);

  // 2. Interactions API steps
  const stepsResp = {
    steps: [
      { usage: { prompt_tokens: 100, completion_tokens: 40, total_tokens: 140 } },
      { usage: { prompt_tokens: 120, completion_tokens: 60, total_tokens: 180 } },
    ],
  };
  assert.equal(extractGeminiTokenUsage(stepsResp), 320);

  // 3. SSE stream with multiple data chunks
  const sseChunk = `
data: {"candidates":[{"content":{"parts":[{"text":"Hi"}]}}],"usageMetadata":{"totalTokenCount":25}}

data: {"candidates":[{"content":{"parts":[{"text":" there"}]}}],"usageMetadata":{"totalTokenCount":65}}
`;
  assert.equal(extractGeminiTokenUsage(sseChunk), 65);

  // 4. Fallback text length estimation (1 token ~= 4 characters)
  assert.equal(extractGeminiTokenUsage('Just some plain error text with 40 chars', 40), 10);
  assert.equal(extractGeminiTokenUsage(null, 400), 100);
});

test('DEFAULT_GEMINI_OMNI_LIMITS exports correct default capacities and bucket counts', () => {
  assert.equal(DEFAULT_GEMINI_OMNI_LIMITS.userDailyCalls, 2);
  assert.equal(DEFAULT_GEMINI_OMNI_LIMITS.userDailyTokens, 100_000);
  assert.equal(DEFAULT_GEMINI_OMNI_LIMITS.globalDailyCalls, 10);
  assert.equal(DEFAULT_GEMINI_OMNI_LIMITS.globalDailyTokens, 1_000_000);
  assert.equal(DEFAULT_GEMINI_OMNI_LIMITS.bucketDurationMs, 5 * 60 * 1000);
  assert.equal(DEFAULT_GEMINI_OMNI_LIMITS.bucketCount, 288);
  assert.equal(DEFAULT_GEMINI_OMNI_LIMITS.windowMs, 24 * 60 * 60_000);
});

test('geminiOmniRateLimiter enforces user limit of 2 calls per day', () => {
  let currentTime = Date.parse('2026-08-17T12:00:00Z');
  const limiter = createCircularBucketRateLimiter({
    ...DEFAULT_GEMINI_OMNI_LIMITS,
    now: () => currentTime,
  });

  const call1 = limiter.consume('user-1', { calls: 1, tokens: 500 });
  assert.equal(call1.allowed, true);
  assert.equal(call1.user.remainingCalls, 1);

  const call2 = limiter.consume('user-1', { calls: 1, tokens: 500 });
  assert.equal(call2.allowed, true);
  assert.equal(call2.user.remainingCalls, 0);

  const call3 = limiter.consume('user-1', { calls: 1, tokens: 500 });
  assert.equal(call3.allowed, false);
  assert.equal(call3.reason, 'USER_CALL_LIMIT');

  // Another user can still call
  const user2Call = limiter.consume('user-2', { calls: 1, tokens: 500 });
  assert.equal(user2Call.allowed, true);
  assert.equal(user2Call.user.remainingCalls, 1);
});

test('geminiOmniRateLimiter enforces global limit of 10 calls per day', () => {
  let currentTime = Date.parse('2026-08-17T12:00:00Z');
  const limiter = createCircularBucketRateLimiter({
    ...DEFAULT_GEMINI_OMNI_LIMITS,
    now: () => currentTime,
  });

  // 5 users consume 2 calls each = 10 calls total
  for (let i = 1; i <= 5; i++) {
    assert.equal(limiter.consume(`user-${i}`, { calls: 1, tokens: 100 }).allowed, true);
    assert.equal(limiter.consume(`user-${i}`, { calls: 1, tokens: 100 }).allowed, true);
  }

  // 6th user is blocked due to GLOBAL_CALL_LIMIT
  const call11 = limiter.consume('user-6', { calls: 1, tokens: 100 });
  assert.equal(call11.allowed, false);
  assert.equal(call11.reason, 'GLOBAL_CALL_LIMIT');
});

test('geminiOmniRateLimiter slides window correctly after 24 hours', () => {
  let currentTime = Date.parse('2026-08-17T00:00:00Z');
  const limiter = createCircularBucketRateLimiter({
    ...DEFAULT_GEMINI_OMNI_LIMITS,
    now: () => currentTime,
  });

  // T=0: user consumes 2 calls
  assert.equal(limiter.consume('omni-slider', { calls: 1, tokens: 100 }).allowed, true);
  assert.equal(limiter.consume('omni-slider', { calls: 1, tokens: 100 }).allowed, true);
  assert.equal(limiter.consume('omni-slider', { calls: 1, tokens: 100 }).allowed, false);

  // T=12h: still blocked
  currentTime += 12 * 3600 * 1000;
  assert.equal(limiter.consume('omni-slider', { calls: 1, tokens: 100 }).allowed, false);

  // T=24h + 5min: bucket has rolled off, user can make 2 calls again
  currentTime = Date.parse('2026-08-17T00:00:00Z') + (24 * 3600 * 1000) + (5 * 60 * 1000);
  assert.equal(limiter.status('omni-slider').user.remainingCalls, 2);
  assert.equal(limiter.consume('omni-slider', { calls: 1, tokens: 100 }).allowed, true);
  assert.equal(limiter.consume('omni-slider', { calls: 1, tokens: 100 }).allowed, true);
  assert.equal(limiter.consume('omni-slider', { calls: 1, tokens: 100 }).allowed, false);
});

test('geminiOmniRateLimiter accurately refunds failed calls and reconciles token deltas', () => {
  let currentTime = Date.parse('2026-08-17T12:00:00Z');
  const limiter = createCircularBucketRateLimiter({
    ...DEFAULT_GEMINI_OMNI_LIMITS,
    now: () => currentTime,
  });

  // Initial consumption
  const consume = limiter.consume('user-omni-refund', { calls: 1, tokens: 1000 });
  assert.equal(consume.allowed, true);
  assert.equal(consume.user.remainingCalls, 1);
  assert.equal(consume.user.remainingTokens, 99_000);

  // Reconcile extra token usage (+500)
  limiter.record('user-omni-refund', { calls: 0, tokens: 500 });
  assert.equal(limiter.status('user-omni-refund').user.remainingTokens, 98_500);

  // Reconcile lower token usage (-300)
  limiter.refund('user-omni-refund', { calls: 0, tokens: 300 });
  assert.equal(limiter.status('user-omni-refund').user.remainingTokens, 98_800);

  // Refund entire call on upstream failure
  limiter.refund('user-omni-refund', { calls: 1, tokens: 1200 });
  const statusAfter = limiter.status('user-omni-refund');
  assert.equal(statusAfter.user.calls, 0);
  assert.equal(statusAfter.user.tokens, 0);
  assert.equal(statusAfter.user.remainingCalls, 2);
  assert.equal(statusAfter.user.remainingTokens, 100_000);
});

test('hosted Gemini health tracking records failure, blocks availability, and recovers', () => {
  resetHostedGeminiHealthForTesting();
  assert.equal(isHostedGeminiHealthy(), true);
  assert.equal(getHostedGeminiHealth().healthy, true);

  recordHostedGeminiFailure('quota_depleted');
  assert.equal(isHostedGeminiHealthy(), false);
  const health = getHostedGeminiHealth();
  assert.equal(health.healthy, false);
  assert.equal(health.reason, 'quota_depleted');
  assert.equal(typeof health.lastFailure, 'number');

  recordHostedGeminiSuccess();
  assert.equal(isHostedGeminiHealthy(), true);
  assert.equal(getHostedGeminiHealth().healthy, true);
  assert.equal(getHostedGeminiHealth().lastFailure, 0);

  resetHostedGeminiHealthForTesting();
});

test('DEFAULT_GEMINI_LIMITS exports $0.60 user and $5.00 global cost limits', () => {
  assert.equal(DEFAULT_GEMINI_LIMITS.userDailyCalls, 500);
  assert.equal(DEFAULT_GEMINI_LIMITS.userDailyCostMicros, 600_000); // $0.60 / day
  assert.equal(DEFAULT_GEMINI_LIMITS.globalDailyCalls, 5_000);
  assert.equal(DEFAULT_GEMINI_LIMITS.globalDailyCostMicros, 5_000_000); // $5.00 / day
});

test('calculateGeminiCostMicros applies accurate pricing and context caching discount', () => {
  // 1,000 uncached prompt tokens ($0.10 / 1M = 0.000100 -> 100 micro-dollars)
  const uncachedCost = calculateGeminiCostMicros({ promptTokens: 1000, cachedTokens: 0, candidateTokens: 0 });
  assert.equal(uncachedCost, 100);

  // 1,000 cached prompt tokens ($0.025 / 1M = 0.000025 -> 25 micro-dollars; 75% discount!)
  const cachedCost = calculateGeminiCostMicros({ promptTokens: 1000, cachedTokens: 1000, candidateTokens: 0 });
  assert.equal(cachedCost, 25);

  // 1,000 candidate tokens ($0.40 / 1M = 0.000400 -> 400 micro-dollars)
  const candidateCost = calculateGeminiCostMicros({ promptTokens: 0, cachedTokens: 0, candidateTokens: 1000 });
  assert.equal(candidateCost, 400);

  // Multi-turn turn with 10,000 total prompt tokens (8,000 cached + 2,000 new uncached), 500 candidate tokens:
  // Cached: 8000 * 0.025 = 200 micro-dollars
  // Uncached: (10000 - 8000) * 0.10 = 200 micro-dollars
  // Candidates: 500 * 0.40 = 200 micro-dollars
  // Total = 600 micro-dollars ($0.0006)
  const multiTurnCost = calculateGeminiCostMicros({ promptTokens: 10_000, cachedTokens: 8000, candidateTokens: 500 });
  assert.equal(multiTurnCost, 600);

  // Image generation ($0.03 = 30,000 micro-dollars)
  assert.equal(calculateGeminiCostMicros({ isImage: true }), 30_000);

  // Video generation ($0.20 = 200,000 micro-dollars)
  assert.equal(calculateGeminiCostMicros({ isVideo: true }), 200_000);
});

test('extractGeminiUsageAndCost accurately parses usageMetadata including cache counts', () => {
  const jsonResp = {
    candidates: [{ content: { parts: [{ text: 'Answer' }] } }],
    usageMetadata: {
      promptTokenCount: 10_000,
      cachedContentTokenCount: 8_000,
      candidatesTokenCount: 500,
      totalTokenCount: 10_500,
    },
  };
  const usage = extractGeminiUsageAndCost(jsonResp);
  assert.equal(usage.promptTokens, 10_000);
  assert.equal(usage.cachedTokens, 8000);
  assert.equal(usage.candidateTokens, 500);
  assert.equal(usage.totalTokens, 10_500);
  // Cost: ((10000 - 8000) * 0.10) + (8000 * 0.025) + (500 * 0.40) = 200 + 200 + 200 = 600 micro-dollars
  assert.equal(usage.costMicros, 600);

  // SSE Stream parsing
  const sseChunk = `
data: {"candidates":[{"content":{"parts":[{"text":"Part 1"}]}}],"usageMetadata":{"promptTokenCount":5000,"cachedContentTokenCount":4000,"candidatesTokenCount":100,"totalTokenCount":5100}}

data: {"candidates":[{"content":{"parts":[{"text":"Part 2"}]}}],"usageMetadata":{"promptTokenCount":5000,"cachedContentTokenCount":4000,"candidatesTokenCount":300,"totalTokenCount":5300}}
`;
  const sseUsage = extractGeminiUsageAndCost(sseChunk);
  assert.equal(sseUsage.promptTokens, 5000);
  assert.equal(sseUsage.cachedTokens, 4000);
  assert.equal(sseUsage.candidateTokens, 300);
  assert.equal(sseUsage.totalTokens, 5300);
  // Cost: ((5000 - 4000) * 0.10) + (4000 * 0.025) + (300 * 0.40) = 100 + 100 + 120 = 320 micro-dollars
  assert.equal(sseUsage.costMicros, 320);
});

test('CircularBucketRateLimiter enforces user cost limit ($0.60/day)', () => {
  let currentTime = Date.parse('2026-08-17T12:00:00Z');
  const limiter = createCircularBucketRateLimiter({
    userDailyCalls: 100,
    userDailyCostMicros: 600_000, // $0.60
    globalDailyCalls: 1_000,
    globalDailyCostMicros: 5_000_000, // $5.00
    now: () => currentTime,
  });

  // User consumes $0.50 (500,000 micro-dollars)
  const res1 = limiter.consume('cost-user-1', { calls: 1, costMicros: 500_000 });
  assert.equal(res1.allowed, true);
  assert.equal(res1.user.remainingCostMicros, 100_000);

  // User attempts to consume another $0.20 (200,000 micro-dollars) -> exceeds $0.60 cap
  const res2 = limiter.consume('cost-user-1', { calls: 1, costMicros: 200_000 });
  assert.equal(res2.allowed, false);
  assert.equal(res2.reason, 'USER_COST_LIMIT');
  assert.ok(res2.message.includes('Daily Gemini shared allowance reached ($0.60/day)'));

  // Another user can still make requests
  const otherUser = limiter.consume('cost-user-2', { calls: 1, costMicros: 200_000 });
  assert.equal(otherUser.allowed, true);
});

test('CircularBucketRateLimiter enforces global cost limit ($5.00/day)', () => {
  let currentTime = Date.parse('2026-08-17T12:00:00Z');
  const limiter = createCircularBucketRateLimiter({
    userDailyCalls: 100,
    userDailyCostMicros: 600_000, // $0.60
    globalDailyCalls: 1_000,
    globalDailyCostMicros: 5_000_000, // $5.00
    now: () => currentTime,
  });

  // 9 users each consume $0.50 -> 9 * $0.50 = $4.50 (4,500,000 micro-dollars)
  for (let i = 1; i <= 9; i++) {
    const res = limiter.consume(`user-global-${i}`, { calls: 1, costMicros: 500_000 });
    assert.equal(res.allowed, true);
  }

  // 10th user consumes $0.40 -> total $4.90
  const res10 = limiter.consume('user-global-10', { calls: 1, costMicros: 400_000 });
  assert.equal(res10.allowed, true);

  // 11th user attempts to consume $0.20 -> exceeds $5.00 global budget
  const blocked = limiter.consume('user-global-11', { calls: 1, costMicros: 200_000 });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, 'GLOBAL_COST_LIMIT');
  assert.ok(blocked.message.includes('The shared Gemini daily budget is exhausted ($5.00/day)'));
});

test('CircularBucketRateLimiter refunds and reconciles cost deltas accurately', () => {
  let currentTime = Date.parse('2026-08-17T12:00:00Z');
  const limiter = createCircularBucketRateLimiter({
    userDailyCalls: 100,
    userDailyCostMicros: 600_000,
    globalDailyCalls: 1_000,
    globalDailyCostMicros: 5_000_000,
    now: () => currentTime,
  });

  // Consume estimated cost: $0.05 (50,000 micro-dollars)
  const pre = limiter.consume('ip-cost-recon', { calls: 1, costMicros: 50_000 });
  assert.equal(pre.allowed, true);
  assert.equal(pre.user.remainingCostMicros, 550_000);

  // Actual cost was $0.08 (80,000 micro-dollars) -> record extra $0.03 (30,000 micro-dollars)
  limiter.record('ip-cost-recon', { calls: 0, costMicros: 30_000 });
  assert.equal(limiter.status('ip-cost-recon').user.costMicros, 80_000);
  assert.equal(limiter.status('ip-cost-recon').user.remainingCostMicros, 520_000);

  // Upstream consumed less: refund $0.02 (20,000 micro-dollars)
  limiter.refund('ip-cost-recon', { calls: 0, costMicros: 20_000 });
  assert.equal(limiter.status('ip-cost-recon').user.costMicros, 60_000);
  assert.equal(limiter.status('ip-cost-recon').user.remainingCostMicros, 540_000);

  // Refund entire call and cost on error
  limiter.refund('ip-cost-recon', { calls: 1, costMicros: 60_000 });
  assert.equal(limiter.status('ip-cost-recon').user.calls, 0);
  assert.equal(limiter.status('ip-cost-recon').user.costMicros, 0);
  assert.equal(limiter.status('ip-cost-recon').user.remainingCostMicros, 600_000);
});
