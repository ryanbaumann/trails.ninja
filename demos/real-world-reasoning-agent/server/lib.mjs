// Pure, testable server helpers (no side effects on import — unlike index.mjs,
// which starts listening). Kept separate so server/lib.test.ts can exercise the
// privacy logic without spawning a server. Reliability plan §5.

/**
 * Reduce a possibly-full URL (path + query, e.g. a replay link carrying
 * `?prompt=<raw user prompt>`) to its ORIGIN only. Used to sanitize the Referer/
 * Origin the /ai and /gmp proxies forward upstream, so a raw prompt sitting in
 * the address bar is never leaked to Google. Returns '' for empty/invalid input.
 */
export function stripToOrigin(value) {
  if (!value) return '';
  try {
    return new URL(value).origin;
  } catch {
    return '';
  }
}

export const GMP_SOLUTION_ID = 'gmp_git_agentskills_v1';

/** Private, same-origin-only header used for a tab-scoped user Gemini key. */
export const GEMINI_BYOK_HEADER = 'x-atlas-gemini-key';

/** Production proxy allowlist. Keep in sync with src/lib/config.ts. */
export const BASE_GEMINI_MODELS = Object.freeze([
  'gemini-3.7-flash',
  'gemini-3.7-pro',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.1-flash-tts-preview',
  'gemini-3.1-flash-lite-image',
  'gemini-3.1-flash-image',
  'gemini-3.1-pro-preview',
  'gemini-3.1-pro',
  'gemini-3-flash-preview',
  'gemini-3-pro-preview',
  'gemini-omni-flash-preview',
]);

/** Models a key must be able to see before Atlas reports it as connected. */
export const REQUIRED_GEMINI_MODELS = Object.freeze([
  'gemini-3.7-flash',
]);

export function allowedGeminiModels(extra = '') {
  return new Set([
    ...BASE_GEMINI_MODELS,
    ...String(extra).split(',').map((value) => value.trim()).filter(Boolean),
  ]);
}

function headerValue(headers, name) {
  const value = headers?.[name];
  return Array.isArray(value) ? value[0] : value;
}

/** Keys are opaque; enforce only safe printable bounds rather than a brittle prefix. */
export function isPlausibleGeminiKey(value) {
  return typeof value === 'string' && /^[\x21-\x7e]{8,512}$/.test(value);
}

/** Select a user key explicitly supplied for this request, else the hosted key. */
export function selectGeminiCredential(headers, hostedKey = '') {
  const supplied = String(headerValue(headers, GEMINI_BYOK_HEADER) ?? '').trim();
  if (supplied) {
    return isPlausibleGeminiKey(supplied)
      ? { source: 'byok', key: supplied }
      : { source: 'invalid', key: '' };
  }
  const hosted = String(hostedKey).trim();
  return hosted
    ? { source: 'hosted', key: hosted }
    : { source: 'none', key: '' };
}

/**
 * Parse a generateContent request and clamp its output budget for hosted-key
 * traffic. Personal-key traffic bypasses this helper and keeps the caller's
 * requested budget. Throws on malformed/non-object JSON so the proxy fails
 * closed before contacting Gemini.
 */
export function capGenerateContentRequest(raw, maxOutputTokens) {
  const request = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf8'));
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw new Error('invalid_generate_content_body');
  }
  const configured = Number(request.generationConfig?.maxOutputTokens);
  const safeMax = Math.max(1, Math.floor(Number(maxOutputTokens)));
  request.generationConfig = {
    ...(request.generationConfig && typeof request.generationConfig === 'object'
      ? request.generationConfig
      : {}),
    maxOutputTokens: Number.isFinite(configured) && configured > 0
      ? Math.min(Math.floor(configured), safeMax)
      : safeMax,
  };
  return Buffer.from(JSON.stringify(request));
}

/**
 * Validate authentication and both required model routes without generating
 * billable content. The key is sent only in an upstream header and never in a URL.
 */
export async function validateGeminiCredential(key, fetchImpl = fetch) {
  if (!isPlausibleGeminiKey(key)) return { ok: false, reason: 'invalid' };
  for (const model of REQUIRED_GEMINI_MODELS) {
    let response;
    try {
      response = await fetchImpl(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}`,
        { method: 'GET', headers: { 'x-goog-api-key': key, accept: 'application/json' } },
      );
    } catch {
      return { ok: false, reason: 'network' };
    }
    if (response.ok) continue;
    if (response.status === 401 || response.status === 403) return { ok: false, reason: 'invalid' };
    if (response.status === 404) return { ok: false, reason: 'model_unavailable', model };
    if (response.status === 429) return { ok: false, reason: 'quota' };
    return { ok: false, reason: 'upstream' };
  }
  return { ok: true };
}

/** Build the deliberately small upstream header allowlist for proxy requests. */
export function upstreamHeaders(incoming, target) {
  const headers = {
    'content-type': incoming['content-type'] || '',
    accept: incoming.accept || '*/*',
    referer: stripToOrigin(incoming.referer),
    origin: stripToOrigin(incoming.origin),
  };
  const host = target instanceof URL ? target.hostname : new URL(target).hostname;
  if (host === 'weather.googleapis.com') {
    headers['X-Goog-Maps-Solution-ID'] = GMP_SOLUTION_ID;
  }
  return headers;
}

// Only these keys may appear in a browser metadata record; anything else is
// rejected so the endpoint can't be used to smuggle content off-device.
const ALLOWED_KEYS = new Set(['scenario', 'tool', 'status', 'category', 'detailLabels', 'tsBucket']);
const ALLOWED_STATUS = new Set(['running', 'ok', 'error']);
// Content that must never appear in accepted metadata (urls, coords, emails,
// unresolved tokens, place ids). Mirrors src/diagnostics/telemetry FORBIDDEN.
const FORBIDDEN = [
  /https?:\/\//i,
  /\bdata:/i,
  /@[\w.-]+\.[a-z]{2,}/i,
  /-?\d{1,3}\.\d{3,}/,
  /\{[a-zA-Z][\w.]*\}/,
  /place[_-]?id/i,
];

function hasForbidden(text) {
  return FORBIDDEN.some((re) => re.test(text));
}

/** Max metadata records accepted in a single POST. */
export const METADATA_MAX_RECORDS = 500;

/**
 * Strictly validate a browser metadata payload (array of sanitized diagnostic
 * records). Returns `{ ok: true, count }` or `{ ok: false, reason }`. Rejects
 * unknown keys, bad types, oversize batches, and any forbidden content — the
 * server accepts ONLY structural metadata, never Maps content or PII.
 */
export function validateMetadata(payload) {
  if (!Array.isArray(payload)) return { ok: false, reason: 'expected an array of records' };
  if (payload.length > METADATA_MAX_RECORDS) return { ok: false, reason: 'too many records' };
  for (const rec of payload) {
    if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return { ok: false, reason: 'record must be an object' };
    for (const k of Object.keys(rec)) if (!ALLOWED_KEYS.has(k)) return { ok: false, reason: `unexpected key: ${k}` };
    const { scenario, tool, status, category, detailLabels, tsBucket } = rec;
    if (typeof scenario !== 'string' || typeof tool !== 'string' || typeof category !== 'string') {
      return { ok: false, reason: 'scenario/tool/category must be strings' };
    }
    if (!ALLOWED_STATUS.has(status)) return { ok: false, reason: 'invalid status' };
    if (typeof tsBucket !== 'number' || !Number.isFinite(tsBucket)) return { ok: false, reason: 'invalid tsBucket' };
    if (detailLabels !== undefined) {
      if (!Array.isArray(detailLabels) || detailLabels.some((l) => typeof l !== 'string')) {
        return { ok: false, reason: 'detailLabels must be a string array' };
      }
    }
    const scan = [scenario, tool, category, ...(detailLabels ?? [])].join(' ');
    if (hasForbidden(scan)) return { ok: false, reason: 'forbidden content in metadata' };
  }
  return { ok: true, count: payload.length };
}

// --- Proxy telemetry (reliability §5 / telemetry-triage) --------------------
// The /ai and /gmp proxies emit privacy-safe, structural failure signal so the
// triage job can cluster reliability issues from production logs. The ONLY thing
// logged is a coarse endpoint LABEL + a derived failure CLASS — never a path,
// query, url, prompt, or any Maps content.

/** Fixed, coarse endpoint labels allowed in proxy telemetry. Never a path/query. */
export const PROXY_ENDPOINTS = new Set(['ai', 'gmp', 'gmp:tile', 'gmp:photo']);

/** Map an HTTP status to a coarse, content-free failure class. */
export function classifyProxyOutcome(status) {
  if (status === 429) return 'rate_limit';
  if (status === 403) return 'forbidden';
  if (status >= 500) return 'upstream_error';
  if (status >= 400) return 'bad_request';
  if (status >= 200 && status < 300) return 'ok';
  return 'other';
}

/**
 * Project a proxy outcome into a SanitizedDiagnostic-shaped record so the triage
 * reducer treats proxy signal and client diagnostics through ONE pipeline. The
 * endpoint must be one of the fixed coarse labels. Returns null if the label is
 * unknown OR the derived record trips the FORBIDDEN guard — a leak fails closed
 * (belt-and-suspenders; labels are fixed strings so this should never fire).
 */
export function toProxyDiagRecord(endpoint, status, tsBucket = 0) {
  if (!PROXY_ENDPOINTS.has(endpoint)) return null;
  const cls = classifyProxyOutcome(status);
  const record = {
    scenario: 'proxy',
    tool: endpoint,
    status: cls === 'ok' ? 'ok' : 'error',
    category: `proxy:${endpoint}:${cls}`,
    detailLabels: [],
    tsBucket: typeof tsBucket === 'number' && Number.isFinite(tsBucket) ? tsBucket : 0,
  };
  if (hasForbidden([record.scenario, record.tool, record.category].join(' '))) return null;
  return record;
}

// --- OK heartbeat -----------------------------------------------------------
// The proxy logs only on failure by design (a 2xx tile stream would flood
// logs). The downside: a totally healthy service and a dead/misconfigured one
// both produce ZERO proxy lines, so the triage loop can't tell "quiet and well"
// from "not running / telemetry not deployed". A rate-limited `ok` heartbeat
// closes that gap: at most one `ok` sample per endpoint per interval, emitted on
// a successful proxy. It proves the telemetry path is wired end-to-end and gives
// the triage window a positive "traffic flowed" signal. It never becomes an
// issue — buildTriage only proposes ERROR clusters.

/** Default min interval between `ok` heartbeat samples per endpoint (ms). */
export const HEARTBEAT_MS = 10 * 60 * 1000;

/**
 * Decide whether to emit an `ok` heartbeat for `endpoint` at `now`, given a Map
 * of last-emit timestamps. Returns true (and records `now`) at most once per
 * `intervalMs` per endpoint; returns false in between. `intervalMs <= 0` disables
 * heartbeats entirely (always false). Mutating the map here keeps the caller a
 * one-liner and the throttle testable without a live server.
 */
export function shouldHeartbeat(state, endpoint, now, intervalMs = HEARTBEAT_MS) {
  if (!(intervalMs > 0)) return false;
  const last = state.get(endpoint);
  if (last !== undefined && now - last < intervalMs) return false;
  state.set(endpoint, now);
  return true;
}
