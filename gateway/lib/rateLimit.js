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

export function createDailyRateLimiter({ max = 5, now = () => Date.now() } = {}) {
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
  if (pathname === '/api/photo-proxy' || pathname === '/api/strava/photo') return 'photo';
  if (pathname.startsWith('/api/strava/')) return 'oauth';
  return null;
}
