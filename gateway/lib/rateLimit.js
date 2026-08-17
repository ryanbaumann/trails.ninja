// gateway/lib/rateLimit.js
//
// Simple in-memory sliding-window-ish (fixed window) per-key rate limiter,
// same shape as the one used in demos/strava-explorer/server/server.js. Good
// enough for a single-instance Cloud Run service; not shared across
// replicas, which is an accepted tradeoff for a portfolio demo.

export function createRateLimiter({ windowMs = 60_000, max = 30 } = {}) {
  const hits = new Map();

  const interval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      if (now - record.windowStart > windowMs) hits.delete(key);
    }
  }, windowMs);
  interval.unref?.();

  function check(key) {
    const now = Date.now();
    const record = hits.get(key);
    if (!record || now - record.windowStart > windowMs) {
      hits.set(key, { windowStart: now, count: 1 });
      return true;
    }
    record.count += 1;
    return record.count <= max;
  }

  function stop() {
    clearInterval(interval);
  }

  return { check, stop };
}

export function createDailyRateLimiter({ max = 5, maxKeys = 10_000, now = () => Date.now() } = {}) {
  const hits = new Map();

  function windowFor(timestamp) {
    const date = new Date(timestamp);
    const windowStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    return {
      windowStart,
      resetAt: new Date(windowStart + 24 * 60 * 60_000).toISOString(),
    };
  }

  function currentRecord(key) {
    const timestamp = now();
    const window = windowFor(timestamp);
    const existing = hits.get(key);
    if (existing?.windowStart === window.windowStart) {
      return { record: existing, ...window };
    }
    if (!hits.has(key) && hits.size >= maxKeys) {
      for (const [storedKey, stored] of hits) {
        if (stored.windowStart !== window.windowStart) hits.delete(storedKey);
      }
      while (hits.size >= maxKeys) hits.delete(hits.keys().next().value);
    }
    const record = { windowStart: window.windowStart, count: 0 };
    hits.set(key, record);
    return { record, ...window };
  }

  function status(key) {
    const { record, resetAt } = currentRecord(key);
    return {
      limit: max,
      remaining: Math.max(0, max - record.count),
      resetAt,
    };
  }

  function take(key) {
    const { record } = currentRecord(key);
    if (record.count >= max) return false;
    record.count += 1;
    return true;
  }

  function refund(key) {
    const { record } = currentRecord(key);
    record.count = Math.max(0, record.count - 1);
  }

  return { status, take, refund };
}

export class CircularBucket {
  constructor(bucketCount, bucketDurationMs) {
    this.bucketCount = bucketCount;
    this.bucketDurationMs = bucketDurationMs;
    this.slots = new Array(bucketCount);
    for (let i = 0; i < bucketCount; i += 1) {
      this.slots[i] = { bucketIndex: -1, calls: 0, tokens: 0 };
    }
  }

  _getSlot(timestamp) {
    const bucketIndex = Math.floor(timestamp / this.bucketDurationMs);
    const slotIndex = ((bucketIndex % this.bucketCount) + this.bucketCount) % this.bucketCount;
    const slot = this.slots[slotIndex];
    if (slot.bucketIndex !== bucketIndex) {
      slot.bucketIndex = bucketIndex;
      slot.calls = 0;
      slot.tokens = 0;
    }
    return slot;
  }

  getTotals(timestamp) {
    const currentBucketIndex = Math.floor(timestamp / this.bucketDurationMs);
    const minBucketIndex = currentBucketIndex - this.bucketCount + 1;
    let calls = 0;
    let tokens = 0;
    let oldestActiveBucketIndex = currentBucketIndex;
    let hasActivity = false;

    for (let i = 0; i < this.bucketCount; i += 1) {
      const slot = this.slots[i];
      if (slot.bucketIndex >= minBucketIndex && slot.bucketIndex <= currentBucketIndex) {
        calls += slot.calls;
        tokens += slot.tokens;
        if (slot.calls > 0 || slot.tokens > 0) {
          if (!hasActivity || slot.bucketIndex < oldestActiveBucketIndex) {
            oldestActiveBucketIndex = slot.bucketIndex;
            hasActivity = true;
          }
        }
      }
    }

    const resetTimestamp = (oldestActiveBucketIndex + this.bucketCount) * this.bucketDurationMs;
    return {
      calls,
      tokens,
      resetTimestamp,
      resetAt: new Date(resetTimestamp).toISOString(),
    };
  }

  add(timestamp, calls = 0, tokens = 0) {
    const slot = this._getSlot(timestamp);
    slot.calls += Math.max(0, calls);
    slot.tokens += Math.max(0, tokens);
  }

  refund(timestamp, calls = 0, tokens = 0) {
    const slot = this._getSlot(timestamp);
    slot.calls = Math.max(0, slot.calls - calls);
    slot.tokens = Math.max(0, slot.tokens - tokens);
  }

  reset() {
    for (let i = 0; i < this.bucketCount; i += 1) {
      this.slots[i] = { bucketIndex: -1, calls: 0, tokens: 0 };
    }
  }
}

export const DEFAULT_GEMINI_LIMITS = Object.freeze({
  userMaxCalls: 100,
  userMaxTokens: 100_000,
  globalMaxCalls: 1_000,
  globalMaxTokens: 1_000_000,
  windowMs: 24 * 60 * 60_000, // 24 hours (86,400,000 ms)
  bucketCount: 288, // 5 minutes per bucket
});

export const DEFAULT_GEMINI_OMNI_LIMITS = Object.freeze({
  userDailyCalls: 2,
  userDailyTokens: 100_000,
  globalDailyCalls: 10,
  globalDailyTokens: 1_000_000,
  bucketDurationMs: 5 * 60 * 1000, // 5 mins
  bucketCount: 288, // 24 hours
  windowMs: 24 * 60 * 60_000,
  label: 'Gemini Omni',
});

export class CircularBucketRateLimiter {
  constructor(options = {}) {
    this.label = options.label || options.serviceName || 'Gemini';
    this.userMaxCalls = Number(options.userMaxCalls ?? options.userDailyCalls ?? DEFAULT_GEMINI_LIMITS.userMaxCalls);
    this.userMaxTokens = Number(options.userMaxTokens ?? options.userDailyTokens ?? DEFAULT_GEMINI_LIMITS.userMaxTokens);
    this.globalMaxCalls = Number(options.globalMaxCalls ?? options.globalDailyCalls ?? DEFAULT_GEMINI_LIMITS.globalMaxCalls);
    this.globalMaxTokens = Number(options.globalMaxTokens ?? options.globalDailyTokens ?? DEFAULT_GEMINI_LIMITS.globalMaxTokens);
    this.bucketDurationMs = options.bucketDurationMs ? Number(options.bucketDurationMs) : undefined;
    this.bucketCount = Math.max(1, Math.floor(Number(options.bucketCount ?? DEFAULT_GEMINI_LIMITS.bucketCount)));
    this.windowMs = Number(options.windowMs ?? (this.bucketDurationMs ? this.bucketDurationMs * this.bucketCount : DEFAULT_GEMINI_LIMITS.windowMs));
    if (!this.bucketDurationMs) {
      this.bucketDurationMs = Math.max(1, Math.floor(this.windowMs / this.bucketCount));
    }
    this.maxKeys = options.maxKeys || 10_000;
    this.now = typeof options.now === 'function' ? options.now : () => Date.now();

    this.userBuckets = new Map();
    this.globalBucket = new CircularBucket(this.bucketCount, this.bucketDurationMs);
  }

  _getUserBucket(key, timestamp) {
    let bucket = this.userBuckets.get(key);
    if (!bucket) {
      if (this.userBuckets.size >= this.maxKeys) {
        this._prune(timestamp);
      }
      bucket = new CircularBucket(this.bucketCount, this.bucketDurationMs);
      this.userBuckets.set(key, bucket);
    }
    return bucket;
  }

  _prune(timestamp) {
    const minBucketIndex = Math.floor(timestamp / this.bucketDurationMs) - this.bucketCount + 1;
    for (const [key, bucket] of this.userBuckets.entries()) {
      let active = false;
      for (const slot of bucket.slots) {
        if (slot.bucketIndex >= minBucketIndex && (slot.calls > 0 || slot.tokens > 0)) {
          active = true;
          break;
        }
      }
      if (!active) {
        this.userBuckets.delete(key);
      }
    }
    while (this.userBuckets.size >= this.maxKeys) {
      this.userBuckets.delete(this.userBuckets.keys().next().value);
    }
  }

  check(key, { calls = 1, tokens = 0, timestamp = this.now() } = {}) {
    const userBucket = this._getUserBucket(key, timestamp);
    const userTotals = userBucket.getTotals(timestamp);
    const globalTotals = this.globalBucket.getTotals(timestamp);

    if (userTotals.calls + calls > this.userMaxCalls) return false;
    if (userTotals.tokens + tokens > this.userMaxTokens) return false;
    if (globalTotals.calls + calls > this.globalMaxCalls) return false;
    if (globalTotals.tokens + tokens > this.globalMaxTokens) return false;
    return true;
  }

  consume(key, { calls = 1, tokens = 0, timestamp = this.now() } = {}) {
    const userBucket = this._getUserBucket(key, timestamp);
    const userTotals = userBucket.getTotals(timestamp);
    const globalTotals = this.globalBucket.getTotals(timestamp);

    const userRemainingCalls = Math.max(0, this.userMaxCalls - userTotals.calls);
    const userRemainingTokens = Math.max(0, this.userMaxTokens - userTotals.tokens);
    const globalRemainingCalls = Math.max(0, this.globalMaxCalls - globalTotals.calls);
    const globalRemainingTokens = Math.max(0, this.globalMaxTokens - globalTotals.tokens);

    if (userTotals.calls + calls > this.userMaxCalls) {
      const retryAfterSeconds = Math.max(1, Math.ceil((userTotals.resetTimestamp - timestamp) / 1000));
      return {
        allowed: false,
        reason: 'USER_CALL_LIMIT',
        message: `Daily ${this.label} request limit reached (${this.userMaxCalls} calls/day). Please try again tomorrow.`,
        retryAfterSeconds,
        resetAt: userTotals.resetAt,
        user: {
          calls: userTotals.calls,
          tokens: userTotals.tokens,
          remainingCalls: userRemainingCalls,
          remainingTokens: userRemainingTokens,
          limitCalls: this.userMaxCalls,
          limitTokens: this.userMaxTokens,
        },
        global: {
          calls: globalTotals.calls,
          tokens: globalTotals.tokens,
          remainingCalls: globalRemainingCalls,
          remainingTokens: globalRemainingTokens,
          limitCalls: this.globalMaxCalls,
          limitTokens: this.globalMaxTokens,
        },
      };
    }

    if (userTotals.tokens + tokens > this.userMaxTokens) {
      const retryAfterSeconds = Math.max(1, Math.ceil((userTotals.resetTimestamp - timestamp) / 1000));
      return {
        allowed: false,
        reason: 'USER_TOKEN_LIMIT',
        message: `Daily ${this.label} token limit reached (${(this.userMaxTokens / 1000).toLocaleString()}k tokens/day). Please try again tomorrow.`,
        retryAfterSeconds,
        resetAt: userTotals.resetAt,
        user: {
          calls: userTotals.calls,
          tokens: userTotals.tokens,
          remainingCalls: userRemainingCalls,
          remainingTokens: userRemainingTokens,
          limitCalls: this.userMaxCalls,
          limitTokens: this.userMaxTokens,
        },
        global: {
          calls: globalTotals.calls,
          tokens: globalTotals.tokens,
          remainingCalls: globalRemainingCalls,
          remainingTokens: globalRemainingTokens,
          limitCalls: this.globalMaxCalls,
          limitTokens: this.globalMaxTokens,
        },
      };
    }

    if (globalTotals.calls + calls > this.globalMaxCalls) {
      const retryAfterSeconds = Math.max(1, Math.ceil((globalTotals.resetTimestamp - timestamp) / 1000));
      return {
        allowed: false,
        reason: 'GLOBAL_CALL_LIMIT',
        message: `The shared ${this.label} daily call budget is exhausted (${this.globalMaxCalls} calls/day). Add your own API key to continue.`,
        retryAfterSeconds,
        resetAt: globalTotals.resetAt,
        user: {
          calls: userTotals.calls,
          tokens: userTotals.tokens,
          remainingCalls: userRemainingCalls,
          remainingTokens: userRemainingTokens,
          limitCalls: this.userMaxCalls,
          limitTokens: this.userMaxTokens,
        },
        global: {
          calls: globalTotals.calls,
          tokens: globalTotals.tokens,
          remainingCalls: globalRemainingCalls,
          remainingTokens: globalRemainingTokens,
          limitCalls: this.globalMaxCalls,
          limitTokens: this.globalMaxTokens,
        },
      };
    }

    if (globalTotals.tokens + tokens > this.globalMaxTokens) {
      const retryAfterSeconds = Math.max(1, Math.ceil((globalTotals.resetTimestamp - timestamp) / 1000));
      return {
        allowed: false,
        reason: 'GLOBAL_TOKEN_LIMIT',
        message: `The shared ${this.label} daily token budget is exhausted (${(this.globalMaxTokens / 1000).toLocaleString()}k tokens/day). Add your own API key to continue.`,
        retryAfterSeconds,
        resetAt: globalTotals.resetAt,
        user: {
          calls: userTotals.calls,
          tokens: userTotals.tokens,
          remainingCalls: userRemainingCalls,
          remainingTokens: userRemainingTokens,
          limitCalls: this.userMaxCalls,
          limitTokens: this.userMaxTokens,
        },
        global: {
          calls: globalTotals.calls,
          tokens: globalTotals.tokens,
          remainingCalls: globalRemainingCalls,
          remainingTokens: globalRemainingTokens,
          limitCalls: this.globalMaxCalls,
          limitTokens: this.globalMaxTokens,
        },
      };
    }

    userBucket.add(timestamp, calls, tokens);
    this.globalBucket.add(timestamp, calls, tokens);

    return {
      allowed: true,
      resetAt: userTotals.resetAt,
      user: {
        calls: userTotals.calls + calls,
        tokens: userTotals.tokens + tokens,
        remainingCalls: Math.max(0, this.userMaxCalls - (userTotals.calls + calls)),
        remainingTokens: Math.max(0, this.userMaxTokens - (userTotals.tokens + tokens)),
        limitCalls: this.userMaxCalls,
        limitTokens: this.userMaxTokens,
      },
      global: {
        calls: globalTotals.calls + calls,
        tokens: globalTotals.tokens + tokens,
        remainingCalls: Math.max(0, this.globalMaxCalls - (globalTotals.calls + calls)),
        remainingTokens: Math.max(0, this.globalMaxTokens - (globalTotals.tokens + tokens)),
        limitCalls: this.globalMaxCalls,
        limitTokens: this.globalMaxTokens,
      },
    };
  }

  take(key, options) {
    const result = this.consume(key, options);
    return result.allowed === true;
  }

  record(key, { calls = 0, tokens = 0, timestamp = this.now() } = {}) {
    const userBucket = this._getUserBucket(key, timestamp);
    userBucket.add(timestamp, calls, tokens);
    this.globalBucket.add(timestamp, calls, tokens);
  }

  refund(key, { calls = 0, tokens = 0, timestamp = this.now() } = {}) {
    const userBucket = this._getUserBucket(key, timestamp);
    userBucket.refund(timestamp, calls, tokens);
    this.globalBucket.refund(timestamp, calls, tokens);
  }

  status(key, { timestamp = this.now() } = {}) {
    const userBucket = this._getUserBucket(key, timestamp);
    const userTotals = userBucket.getTotals(timestamp);
    const globalTotals = this.globalBucket.getTotals(timestamp);

    const userRemainingCalls = Math.max(0, this.userMaxCalls - userTotals.calls);
    const userRemainingTokens = Math.max(0, this.userMaxTokens - userTotals.tokens);
    const globalRemainingCalls = Math.max(0, this.globalMaxCalls - globalTotals.calls);
    const globalRemainingTokens = Math.max(0, this.globalMaxTokens - globalTotals.tokens);

    return {
      allowed: userRemainingCalls > 0 && userRemainingTokens > 0 && globalRemainingCalls > 0 && globalRemainingTokens > 0,
      resetAt: userTotals.resetAt,
      user: {
        calls: userTotals.calls,
        tokens: userTotals.tokens,
        remainingCalls: userRemainingCalls,
        remainingTokens: userRemainingTokens,
        limitCalls: this.userMaxCalls,
        limitTokens: this.userMaxTokens,
      },
      global: {
        calls: globalTotals.calls,
        tokens: globalTotals.tokens,
        remainingCalls: globalRemainingCalls,
        remainingTokens: globalRemainingTokens,
        limitCalls: this.globalMaxCalls,
        limitTokens: this.globalMaxTokens,
      },
    };
  }

  reset() {
    this.userBuckets.clear();
    this.globalBucket.reset();
  }
}

export function createCircularBucketRateLimiter(options = {}) {
  return new CircularBucketRateLimiter(options);
}

export function extractGeminiTokenUsage(body, fallbackTextLength = 0) {
  if (!body) {
    return Math.max(1, Math.ceil(Number(fallbackTextLength || 0) / 4));
  }
  let parsed = body;
  if (typeof body === 'string') {
    const trimmed = body.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        parsed = null;
      }
    } else if (trimmed.includes('data:')) {
      const lines = trimmed.split('\n');
      for (let i = lines.length - 1; i >= 0; i -= 1) {
        const line = lines[i].trim();
        if (line.startsWith('data:')) {
          try {
            const dataObj = JSON.parse(line.slice(5).trim());
            const meta = dataObj?.usageMetadata || dataObj?.usage_metadata;
            if (meta) {
              const total = Number(meta.totalTokenCount ?? meta.total_token_count);
              if (Number.isFinite(total) && total > 0) return total;
            }
          } catch {
            // Ignore parse errors on individual SSE frames
          }
        }
      }
    }
  }

  if (parsed && typeof parsed === 'object') {
    const meta = parsed.usageMetadata || parsed.usage_metadata;
    if (meta && typeof meta === 'object') {
      const total = Number(meta.totalTokenCount ?? meta.total_token_count);
      if (Number.isFinite(total) && total > 0) return total;
      const prompt = Number(meta.promptTokenCount ?? meta.prompt_token_count) || 0;
      const candidates = Number(meta.candidatesTokenCount ?? meta.candidates_token_count) || 0;
      if (prompt + candidates > 0) return prompt + candidates;
    }
    if (Array.isArray(parsed.steps)) {
      let stepTokens = 0;
      for (const step of parsed.steps) {
        if (step?.usage?.total_tokens) {
          stepTokens += Number(step.usage.total_tokens) || 0;
        }
      }
      if (stepTokens > 0) return stepTokens;
    }
  }

  const length = typeof body === 'string' ? body.length : (Number(fallbackTextLength) || 0);
  return Math.max(1, Math.ceil(length / 4));
}

export const geminiRateLimiter = createCircularBucketRateLimiter({
  userMaxCalls: process.env.GEMINI_USER_DAILY_CALLS_CAP || DEFAULT_GEMINI_LIMITS.userMaxCalls,
  userMaxTokens: process.env.GEMINI_USER_DAILY_TOKENS_CAP || DEFAULT_GEMINI_LIMITS.userMaxTokens,
  globalMaxCalls: process.env.GEMINI_GLOBAL_DAILY_CALLS_CAP || DEFAULT_GEMINI_LIMITS.globalMaxCalls,
  globalMaxTokens: process.env.GEMINI_GLOBAL_DAILY_TOKENS_CAP || DEFAULT_GEMINI_LIMITS.globalMaxTokens,
});

export const geminiOmniRateLimiter = createCircularBucketRateLimiter({
  ...DEFAULT_GEMINI_OMNI_LIMITS,
  userDailyCalls: process.env.GEMINI_OMNI_USER_DAILY_CALLS_CAP || DEFAULT_GEMINI_OMNI_LIMITS.userDailyCalls,
  userDailyTokens: process.env.GEMINI_OMNI_USER_DAILY_TOKENS_CAP || DEFAULT_GEMINI_OMNI_LIMITS.userDailyTokens,
  globalDailyCalls: process.env.GEMINI_OMNI_GLOBAL_DAILY_CALLS_CAP || DEFAULT_GEMINI_OMNI_LIMITS.globalDailyCalls,
  globalDailyTokens: process.env.GEMINI_OMNI_GLOBAL_DAILY_TOKENS_CAP || DEFAULT_GEMINI_OMNI_LIMITS.globalDailyTokens,
});

export function clientIp(request) {
  const forwarded = request.headers['x-forwarded-for'];
  if (forwarded) {
    const chain = String(forwarded).split(',').map((part) => part.trim()).filter(Boolean);
    // Cloud Run's trusted frontend appends the connecting client and proxy
    // addresses to any caller-supplied prefix. Use the address immediately
    // before the trusted proxy, never the spoofable first entry. A lone XFF
    // value is untrusted, so fall back to the socket address.
    if (chain.length >= 2) return chain.at(-2);
  }
  return request.socket?.remoteAddress || 'unknown';
}

export const RATE_LIMIT_POLICIES = Object.freeze({
  auth: Object.freeze({ windowMs: 60_000, max: 5 }),
  contact: Object.freeze({ windowMs: 60_000, max: 5 }),
  subscribe: Object.freeze({ windowMs: 60_000, max: 5 }),
  writer: Object.freeze({ windowMs: 60_000, max: 5 }),
  // Save is a plain form-submit "Save" button, not a keystroke-driven
  // autosave (see the writer dashboard markup in portfolio/build.mjs — one
  // <form action="/api/writer/save"> with no JS interval timer), but an
  // editor iterating on a draft plausibly clicks it more than 5 times a
  // minute. It's still gated behind the Google-authenticated writer
  // session, so a looser bucket doesn't open new abuse surface; sized to
  // match the existing `oauth` bucket rather than inventing a new number.
  writerSave: Object.freeze({ windowMs: 60_000, max: 20 }),
  oauth: Object.freeze({ windowMs: 60_000, max: 20 }),
  isochrones: Object.freeze({ windowMs: 60_000, max: 30 }),
  hairstyleText: Object.freeze({ windowMs: 60_000, max: 20 }),
  hairstyleByokImage: Object.freeze({ windowMs: 60_000, max: 20 }),
  photo: Object.freeze({ windowMs: 60_000, max: 120 }),
});

export function rateLimitPolicyForPath(pathname) {
  if (pathname === '/api/contact') return 'contact';
  if (pathname === '/api/subscribe') return 'subscribe';
  if (pathname === '/api/writer/publish' || pathname === '/api/writer/review' || pathname === '/api/writer/social') return 'writer';
  if (pathname === '/api/writer/save') return 'writerSave';
  if (pathname === '/api/isochrones') return 'isochrones';
  if (
    pathname === '/api/hairstyle-ai-studio/generate'
    || pathname === '/api/hairstyle-ai-studio/refine'
    || pathname === '/api/hairstyle-ai-studio/quota'
  ) return null;
  if (pathname.startsWith('/api/hairstyle-ai-studio/')) return 'hairstyleText';
  if (
    pathname === '/api/infographic-agent/prepare'
    || pathname === '/api/infographic-agent/render'
  ) return null;
  if (pathname.startsWith('/api/infographic-agent/')) return 'hairstyleText';
  if (pathname === '/api/photo-proxy' || pathname === '/api/strava/photo') return 'photo';
  if (pathname.startsWith('/api/strava/')) return 'oauth';
  return null;
}

let hostedGeminiHealthy = true;
let hostedGeminiFailureReason = null;
let hostedGeminiLastFailure = 0;
const HOSTED_GEMINI_COOLDOWN_MS = 5 * 60 * 1000;

export function recordHostedGeminiFailure(reason = 'quota_depleted') {
  hostedGeminiHealthy = false;
  hostedGeminiFailureReason = reason;
  hostedGeminiLastFailure = Date.now();
}

export function recordHostedGeminiSuccess() {
  hostedGeminiHealthy = true;
  hostedGeminiFailureReason = null;
  hostedGeminiLastFailure = 0;
}

export function isHostedGeminiHealthy() {
  if (hostedGeminiHealthy) return true;
  if (Date.now() - hostedGeminiLastFailure > HOSTED_GEMINI_COOLDOWN_MS) {
    return true;
  }
  return false;
}

export function getHostedGeminiHealth() {
  const healthy = isHostedGeminiHealthy();
  return {
    healthy,
    reason: healthy ? null : hostedGeminiFailureReason,
    lastFailure: hostedGeminiLastFailure,
  };
}

export function resetHostedGeminiHealthForTesting() {
  hostedGeminiHealthy = true;
  hostedGeminiFailureReason = null;
  hostedGeminiLastFailure = 0;
}
