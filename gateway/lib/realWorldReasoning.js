import {
  clientIp,
  geminiRateLimiter,
  geminiOmniRateLimiter,
  extractGeminiTokenUsage,
  extractGeminiUsageAndCost,
  recordHostedGeminiFailure,
  recordHostedGeminiSuccess,
  isHostedGeminiHealthy,
} from './rateLimit.js';

export const REAL_WORLD_REASONING_PREFIX = '/api/real-world-reasoning-agent/';
export const GMP_SOLUTION_ID = 'gmp_git_agentskills_v1';
export const GEMINI_BYOK_HEADER = 'x-atlas-gemini-key';

const isOmniModel = (m) => typeof m === 'string' && (/omni/i.test(m) || m.includes('gemini-omni'));

const BASE_GEMINI_MODELS = Object.freeze([
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.1-flash-tts-preview',
  'gemini-3.1-flash-lite-image',
  'gemini-omni-flash-preview',
]);
const REQUIRED_GEMINI_MODELS = Object.freeze([
  'gemini-3.7-flash',
]);
const METADATA_MAX_RECORDS = 500;
const MAX_RATE_BUCKETS = 10_000;
const PROXY_ENDPOINTS = new Set(['ai', 'gmp', 'gmp:tile', 'gmp:photo']);
const HEARTBEAT_MS = 10 * 60 * 1000;
const SOLUTION_HEADER_HOSTS = new Set([
  'maps.googleapis.com',
  'airquality.googleapis.com',
  'weather.googleapis.com',
  'pollen.googleapis.com',
  'solar.googleapis.com',
]);
const FORBIDDEN_METADATA = [
  /https?:\/\//i,
  /\bdata:/i,
  /@[\w.-]+\.[a-z]{2,}/i,
  /-?\d{1,3}\.\d{3,}/,
  /\{[a-zA-Z][\w.]*\}/,
  /place[_-]?id/i,
];
const ALLOWED_METADATA_KEYS = new Set([
  'scenario',
  'tool',
  'status',
  'category',
  'detailLabels',
  'tsBucket',
]);
const ALLOWED_METADATA_STATUS = new Set(['running', 'ok', 'error']);
const SAFE_UPSTREAM_RESPONSE_HEADERS = [
  'cache-control',
  'content-disposition',
  'content-type',
  'etag',
  'last-modified',
];

const headerValue = (headers, name) => {
  const value = headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
};

const stripToOrigin = (value) => {
  if (!value) return '';
  try {
    return new URL(value).origin;
  } catch {
    return '';
  }
};

const allowedGeminiModels = (extra = '') => new Set([
  ...BASE_GEMINI_MODELS,
  ...String(extra).split(',').map((value) => value.trim()).filter(Boolean),
]);

const isPlausibleGeminiKey = (value) =>
  typeof value === 'string' && /^[\x21-\x7e]{8,512}$/.test(value);

const selectGeminiCredential = (headers, hostedKey = '') => {
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
};

const capGenerateContentRequest = (raw, maxOutputTokens) => {
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
};

const validateGeminiCredential = async (key, fetchImpl) => {
  if (!isPlausibleGeminiKey(key)) return { ok: false, reason: 'invalid' };
  for (const model of REQUIRED_GEMINI_MODELS) {
    let upstream;
    try {
      upstream = await fetchImpl(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}`,
        {
          method: 'GET',
          headers: { 'x-goog-api-key': key, accept: 'application/json' },
          signal: AbortSignal.timeout(15_000),
        },
      );
    } catch {
      return { ok: false, reason: 'network' };
    }
    if (upstream.ok) continue;
    if (upstream.status === 401 || upstream.status === 403) return { ok: false, reason: 'invalid' };
    if (upstream.status === 404) return { ok: false, reason: 'model_unavailable', model };
    if (upstream.status === 429) return { ok: false, reason: 'quota' };
    return { ok: false, reason: 'upstream' };
  }
  return { ok: true };
};

const hasForbiddenMetadata = (text) =>
  FORBIDDEN_METADATA.some((pattern) => pattern.test(text));

export function validateRealWorldReasoningMetadata(payload) {
  if (!Array.isArray(payload)) return { ok: false, reason: 'expected an array of records' };
  if (payload.length > METADATA_MAX_RECORDS) return { ok: false, reason: 'too many records' };
  for (const record of payload) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      return { ok: false, reason: 'record must be an object' };
    }
    for (const key of Object.keys(record)) {
      if (!ALLOWED_METADATA_KEYS.has(key)) return { ok: false, reason: `unexpected key: ${key}` };
    }
    const { scenario, tool, status, category, detailLabels, tsBucket } = record;
    const token = (value) => typeof value === 'string' && /^[a-z0-9][a-z0-9:_-]{0,63}$/i.test(value);
    if (!token(scenario) || !token(tool) || !token(category)) {
      return { ok: false, reason: 'scenario/tool/category must be bounded tokens' };
    }
    if (!ALLOWED_METADATA_STATUS.has(status)) return { ok: false, reason: 'invalid status' };
    if (typeof tsBucket !== 'number' || !Number.isFinite(tsBucket)) {
      return { ok: false, reason: 'invalid tsBucket' };
    }
    if (
      detailLabels !== undefined
      && (
        !Array.isArray(detailLabels)
        || detailLabels.length > 10
        || detailLabels.some((label) => typeof label !== 'string' || !/^[a-z0-9][a-z0-9 _:-]{0,63}$/i.test(label))
      )
    ) return { ok: false, reason: 'detailLabels must be bounded structural labels' };
    if (hasForbiddenMetadata([scenario, tool, category, ...(detailLabels ?? [])].join(' '))) {
      return { ok: false, reason: 'forbidden content in metadata' };
    }
  }
  return { ok: true, count: payload.length };
}

const classifyProxyOutcome = (status) => {
  if (status === 429) return 'rate_limit';
  if (status === 403) return 'forbidden';
  if (status >= 500) return 'upstream_error';
  if (status >= 400) return 'bad_request';
  if (status >= 200 && status < 300) return 'ok';
  return 'other';
};

const toProxyDiagRecord = (endpoint, status, tsBucket = 0) => {
  if (!PROXY_ENDPOINTS.has(endpoint)) return null;
  const outcome = classifyProxyOutcome(status);
  const record = {
    scenario: 'proxy',
    tool: endpoint,
    status: outcome === 'ok' ? 'ok' : 'error',
    category: `proxy:${endpoint}:${outcome}`,
    detailLabels: [],
    tsBucket: typeof tsBucket === 'number' && Number.isFinite(tsBucket) ? tsBucket : 0,
  };
  return hasForbiddenMetadata([record.scenario, record.tool, record.category].join(' '))
    ? null
    : record;
};

const numberFromEnv = (env, name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const value = Number(env[name]);
  return Number.isFinite(value) && value >= min && value <= max
    ? Math.floor(value)
    : fallback;
};

const configFromEnv = (env) => ({
  aiLimit: numberFromEnv(env, 'RWR_AI_RATE_LIMIT', 120, { min: 1, max: 10_000 }),
  gmpLimit: numberFromEnv(env, 'RWR_GMP_RATE_LIMIT', 300, { min: 1, max: 10_000 }),
  gmpTileLimit: numberFromEnv(env, 'RWR_GMP_TILE_RATE_LIMIT', 3_000, { min: 1, max: 100_000 }),
  gmpPhotoLimit: numberFromEnv(env, 'RWR_GMP_PHOTO_RATE_LIMIT', 600, { min: 1, max: 20_000 }),
  mcpLimit: numberFromEnv(env, 'RWR_MCP_RATE_LIMIT', 120, { min: 1, max: 10_000 }),
  metadataLimit: numberFromEnv(env, 'RWR_METADATA_RATE_LIMIT', 60, { min: 1, max: 10_000 }),
  windowMs: numberFromEnv(env, 'RWR_RATE_LIMIT_WINDOW_MS', 15 * 60_000, { min: 1_000, max: 60 * 60_000 }),
  dailyAiCap: numberFromEnv(env, 'RWR_DAILY_AI_CAP', 1_000, { max: 100_000 }),
  dailyAiInputBytes: numberFromEnv(env, 'RWR_DAILY_AI_INPUT_BYTES', 1_400_000, { max: 100 * 1024 * 1024 }),
  dailyGmpCap: numberFromEnv(env, 'RWR_DAILY_GMP_CAP', 1_000, { min: 1, max: 100_000 }),
  dailyGmpTileCap: numberFromEnv(env, 'RWR_DAILY_GMP_TILE_CAP', 10_000, { min: 1, max: 1_000_000 }),
  dailyGmpPhotoCap: numberFromEnv(env, 'RWR_DAILY_GMP_PHOTO_CAP', 1_000, { min: 1, max: 100_000 }),
  dailyMcpCap: numberFromEnv(env, 'RWR_DAILY_MCP_CAP', 250, { min: 1, max: 100_000 }),
  hostedAiMaxOutputTokens: numberFromEnv(env, 'RWR_HOSTED_AI_MAX_OUTPUT_TOKENS', 2_048, { min: 1, max: 65_536 }),
  dailyVideoCap: numberFromEnv(env, 'RWR_DAILY_VIDEO_CAP', 0, { max: 10_000 }),
  bodyCap: numberFromEnv(env, 'RWR_BODY_CAP_BYTES', 1024 * 1024, { min: 1_024, max: 16 * 1024 * 1024 }),
  timeoutMs: numberFromEnv(env, 'RWR_UPSTREAM_TIMEOUT_MS', 60_000, { min: 1_000, max: 10 * 60_000 }),
  videoTimeoutMs: numberFromEnv(env, 'RWR_VIDEO_UPSTREAM_TIMEOUT_MS', 300_000, { min: 1_000, max: 15 * 60_000 }),
  heartbeatMs: numberFromEnv(env, 'RWR_PROXY_HEARTBEAT_MS', HEARTBEAT_MS, { max: 24 * 60 * 60_000 }),
  groundingLiteEnabled: env.RWR_GROUNDING_LITE_ENABLED === 'true',
  allowedModels: allowedGeminiModels(env.RWR_GENAI_EXTRA_MODELS),
});

const sameOrigin = (request) => {
  if (headerValue(request.headers, 'sec-fetch-site') === 'cross-site') return false;
  const host = headerValue(request.headers, 'x-forwarded-host') || headerValue(request.headers, 'host');
  const source = headerValue(request.headers, 'origin') || headerValue(request.headers, 'referer');
  if (!source) return true;
  try {
    return new URL(source).host === host;
  } catch {
    return false;
  }
};

const sendText = (response, status, body, headers = {}) => {
  response.writeHead(status, {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...headers,
  });
  response.end(body);
};

const sendJson = (response, status, value) => {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(JSON.stringify(value));
};

const readBody = async (request, cap) => {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > cap) throw Object.assign(new Error('body_too_large'), { statusCode: 413 });
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
};

const requestHeadersForUpstream = (request, target) => {
  const headers = {};
  const contentType = headerValue(request.headers, 'content-type');
  const accept = headerValue(request.headers, 'accept');
  const referer = stripToOrigin(headerValue(request.headers, 'referer'));
  const origin = stripToOrigin(headerValue(request.headers, 'origin'));
  if (contentType) headers['content-type'] = contentType;
  if (accept) headers.accept = accept;
  if (referer) headers.referer = referer;
  if (origin) headers.origin = origin;
  if (SOLUTION_HEADER_HOSTS.has(target.hostname)) {
    headers['X-Goog-Maps-Solution-ID'] = GMP_SOLUTION_ID;
  }
  return headers;
};

const appendKey = (target, key) => {
  target.searchParams.set('key', key);
  return target;
};

const pinnedTarget = (rest, searchParams, origin) => {
  if (!rest.startsWith('/') || rest.startsWith('//')) return null;
  const target = new URL(rest, origin);
  if (target.origin !== origin) return null;
  for (const [key, value] of searchParams) target.searchParams.append(key, value);
  return target;
};

const gmpTarget = (path, searchParams, gmpKey, method) => {
  const allowed = [
    ['GET', /^\/gmp\/geocode\/json$/],
    ['POST', /^\/gmp\/airquality\/v1\/currentConditions:lookup$/],
    ['GET', /^\/gmp\/airquality\/v1\/mapTypes\/US_AQI\/heatmapTiles\/\d+\/\d+\/\d+$/],
    ['GET', /^\/gmp\/weather\/v1\/currentConditions:lookup$/],
    ['GET', /^\/gmp\/pollen\/v1\/forecast:lookup$/],
    ['GET', /^\/gmp\/pollen\/v1\/mapTypes\/TREE_UPI\/heatmapTiles\/\d+\/\d+\/\d+$/],
    ['GET', /^\/gmp\/solar\/v1\/buildingInsights:findClosest$/],
    ['GET', /^\/gmp\/streetview\/maps\/api\/streetview(?:\/metadata)?$/],
    ['GET', /^\/gmp\/staticmap\/maps\/api\/staticmap$/],
  ];
  if (!allowed.some(([verb, pattern]) => verb === method && pattern.test(path))) return null;
  let origin = 'https://maps.googleapis.com';
  let rest = path;
  if (path.startsWith('/gmp/geocode')) {
    rest = `/maps/api/geocode${path.slice('/gmp/geocode'.length)}`;
  } else if (path.startsWith('/gmp/airquality')) {
    origin = 'https://airquality.googleapis.com';
    rest = path.slice('/gmp/airquality'.length);
  } else if (path.startsWith('/gmp/weather')) {
    origin = 'https://weather.googleapis.com';
    rest = path.slice('/gmp/weather'.length);
  } else if (path.startsWith('/gmp/pollen')) {
    origin = 'https://pollen.googleapis.com';
    rest = path.slice('/gmp/pollen'.length);
  } else if (path.startsWith('/gmp/solar')) {
    origin = 'https://solar.googleapis.com';
    rest = path.slice('/gmp/solar'.length);
  } else if (path.startsWith('/gmp/streetview')) {
    rest = path.slice('/gmp/streetview'.length);
  } else if (path.startsWith('/gmp/staticmap')) {
    rest = path.slice('/gmp/staticmap'.length);
  } else {
    return null;
  }
  const target = pinnedTarget(rest, searchParams, origin);
  if (!target) return null;
  appendKey(target, gmpKey);
  if (target.hostname === 'airquality.googleapis.com' && target.pathname.includes('/heatmapTiles/')) {
    target.searchParams.set('solution_id', GMP_SOLUTION_ID);
  }
  return target;
};

const allowedPhotoTarget = (raw, gmpKey) => {
  try {
    const target = new URL(raw);
    if (
      target.protocol !== 'https:'
      || target.hostname !== 'places.googleapis.com'
      || !/^\/v1\/places\/[^/]+\/photos\/[^/]+\/media$/.test(target.pathname)
    ) return null;
    for (const name of ['maxWidthPx', 'maxHeightPx']) {
      const value = target.searchParams.get(name);
      if (value !== null && (!/^\d{1,4}$/.test(value) || Number(value) > 1_600)) return null;
    }
    appendKey(target, gmpKey);
    return target;
  } catch {
    return null;
  }
};

const aiGenerateTarget = (path, searchParams, allowedModels) => {
  if (!path.startsWith('/ai/')) return null;
  if (!path.endsWith(':generateContent') && !path.endsWith(':streamGenerateContent')) return null;
  const match = path.match(/models\/([^/:]+)/);
  if (!match || !allowedModels.has(match[1])) return null;
  const target = pinnedTarget(
    path.replace(/^\/ai/, ''),
    searchParams,
    'https://generativelanguage.googleapis.com',
  );
  target?.searchParams.delete('key');
  return target;
};

const aiInteractionsTarget = (path, searchParams) => {
  if (!/^\/ai\/[^/]+\/interactions$/.test(path)) return null;
  const target = pinnedTarget(
    path.replace(/^\/ai/, ''),
    searchParams,
    'https://generativelanguage.googleapis.com',
  );
  target?.searchParams.delete('key');
  return target;
};

const upstreamResponseHeaders = (headers) => {
  const safe = { 'x-content-type-options': 'nosniff' };
  for (const name of SAFE_UPSTREAM_RESPONSE_HEADERS) {
    const value = headers.get(name);
    if (value) safe[name] = value;
  }
  return safe;
};

const internalPathFor = (pathname) => {
  if (!pathname.startsWith(REAL_WORLD_REASONING_PREFIX)) return null;
  const rest = pathname.slice(REAL_WORLD_REASONING_PREFIX.length);
  return rest ? `/${rest}` : '/';
};

export function createRealWorldReasoningHandler({
  now = () => Date.now(),
  logger = (line) => console.log(line),
  geminiLimiter = geminiRateLimiter,
  geminiOmniLimiter = geminiOmniRateLimiter,
} = {}) {
  const rateBuckets = new Map();
  const heartbeats = new Map();
  let daily = {
    day: new Date(now()).toISOString().slice(0, 10),
    ai: 0,
    inputBytes: 0,
    video: 0,
    gmp: 0,
    gmpTile: 0,
    gmpPhoto: 0,
    mcp: 0,
  };

  const rate = (request, kind, limit, windowMs) => {
    const key = `${kind}:${clientIp(request)}`;
    const timestamp = now();
    if (!rateBuckets.has(key) && rateBuckets.size >= MAX_RATE_BUCKETS) {
      rateBuckets.delete(rateBuckets.keys().next().value);
    }
    const recent = (rateBuckets.get(key) || []).filter((hit) => timestamp - hit < windowMs);
    recent.push(timestamp);
    rateBuckets.set(key, recent);
    return recent.length <= limit;
  };

  const resetDaily = () => {
    const day = new Date(now()).toISOString().slice(0, 10);
    if (daily.day !== day) {
      daily = {
        day,
        ai: 0,
        inputBytes: 0,
        video: 0,
        gmp: 0,
        gmpTile: 0,
        gmpPhoto: 0,
        mcp: 0,
      };
    }
  };

  const takeDaily = (kind, limit) => {
    resetDaily();
    if (daily[kind] >= limit) return false;
    daily[kind] += 1;
    return true;
  };

  const shouldHeartbeat = (endpoint, intervalMs) => {
    if (!(intervalMs > 0)) return false;
    const timestamp = now();
    const last = heartbeats.get(endpoint);
    if (last !== undefined && timestamp - last < intervalMs) return false;
    heartbeats.set(endpoint, timestamp);
    return true;
  };

  const logProxy = (endpoint, status, heartbeatMs) => {
    if (classifyProxyOutcome(status) === 'ok' && !shouldHeartbeat(endpoint, heartbeatMs)) return;
    const bucket = Math.floor(now() / 60_000) * 60_000;
    const record = toProxyDiagRecord(endpoint, status, bucket);
    if (!record) return;
    try {
      logger(JSON.stringify({ evt: 'proxy', ...record, at: new Date(now()).toISOString() }));
    } catch {
      // Telemetry must never affect the request path.
    }
  };

  const sendProxy = (response, endpoint, status, body, config, headers = {}) => {
    logProxy(endpoint, status, config.heartbeatMs);
    sendText(response, status, body, headers);
  };

  const proxy = async ({
    request,
    response,
    target,
    fetchImpl,
    config,
    endpoint,
    buffer,
    timeoutMs = config.timeoutMs,
    headers,
    rawHeaders,
    onComplete,
  }) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const abort = () => controller.abort();
    request.once?.('aborted', abort);
    const onClose = () => {
      if (!response.writableEnded) abort();
    };
    response.once?.('close', onClose);
    try {
      const body = buffer !== undefined
        ? buffer
        : (request.method === 'GET' || request.method === 'HEAD'
          ? undefined
          : await readBody(request, config.bodyCap));
      const upstream = await fetchImpl(target, {
        method: request.method,
        headers: rawHeaders ?? {
          ...requestHeadersForUpstream(request, target),
          ...headers,
        },
        body,
        signal: controller.signal,
      });
      response.writeHead(upstream.status, upstreamResponseHeaders(upstream.headers));
      if (endpoint) logProxy(endpoint, upstream.status, config.heartbeatMs);
      const chunks = [];
      if (upstream.body) {
        for await (const chunk of upstream.body) {
          response.write(chunk);
          if (onComplete) chunks.push(chunk);
        }
      }
      response.end();
      if (onComplete) {
        const fullBody = Buffer.concat(chunks).toString('utf8');
        onComplete({ status: upstream.status, bodyText: fullBody });
      }
    } catch (error) {
      const status = error?.statusCode === 413 || error?.message === 'body_too_large' ? 413 : 502;
      if (response.headersSent) {
        response.destroy(error);
      } else {
        sendText(response, status, 'Upstream request failed');
      }
      if (endpoint) logProxy(endpoint, status, config.heartbeatMs);
      if (onComplete) {
        onComplete({ status, error });
      }
    } finally {
      clearTimeout(timer);
      request.removeListener?.('aborted', abort);
      response.removeListener?.('close', onClose);
    }
  };

  return async function handleRealWorldReasoningApi({
    request,
    response,
    pathname,
    searchParams,
    env = process.env,
    fetchImpl = globalThis.fetch,
  }) {
    const path = internalPathFor(pathname);
    if (path === null) return false;

    const config = configFromEnv(env);
    const query = searchParams instanceof URLSearchParams
      ? new URLSearchParams(searchParams)
      : new URLSearchParams(searchParams || '');
    const gmpKey = String(env.GMP_SERVER_API_KEY || '').trim();
    const gmpMcpKey = String(env.GMP_MCP_KEY || '').trim() || gmpKey;
    const hostedGeminiKey = String(env.GEMINI_API_KEY || '').trim();

    if (path === '/capabilities') {
      if (request.method !== 'GET') {
        sendText(response, 405, 'Capabilities only accepts GET');
      } else {
        const byokHeader = headerValue(request.headers, GEMINI_BYOK_HEADER);
        const hasPersonalKey = Boolean(byokHeader && isPlausibleGeminiKey(byokHeader));
        const hostedHealthy = isHostedGeminiHealthy();
        const hostedAvailable = Boolean(hostedGeminiKey && hostedHealthy);
        const geminiAvailable = hasPersonalKey || hostedAvailable;
        sendJson(response, 200, {
          maps: Boolean(gmpKey),
          gemini: geminiAvailable,
          hostedGemini: hostedAvailable,
          mapsGrounding: geminiAvailable,
          groundingLite: geminiAvailable,
        });
      }
      return true;
    }

    if (path === '/metadata') {
      if (request.method !== 'POST') {
        sendText(response, 405, 'Metadata only accepts POST');
        return true;
      }
      if (!sameOrigin(request) || !rate(request, 'metadata', config.metadataLimit, config.windowMs)) {
        sendText(response, 429, 'The demo is busy right now — try again in a few minutes');
        return true;
      }
      if (headerValue(request.headers, 'x-atlas-consent') !== '1') {
        sendText(response, 403, 'Diagnostics consent required');
        return true;
      }
      let body;
      try {
        body = await readBody(request, config.bodyCap);
      } catch (error) {
        sendText(response, error?.statusCode === 413 ? 413 : 400, 'Invalid request body');
        return true;
      }
      let payload;
      try {
        payload = JSON.parse(body.toString('utf8'));
      } catch {
        sendText(response, 400, 'Invalid metadata JSON');
        return true;
      }
      const validation = validateRealWorldReasoningMetadata(payload);
      if (!validation.ok) {
        sendText(response, 400, `Rejected metadata: ${validation.reason}`);
        return true;
      }
      try {
        logger(JSON.stringify({
          evt: 'diag_batch',
          records: payload,
          at: new Date(now()).toISOString(),
        }));
      } catch {
        // Telemetry must never affect the request path.
      }
      sendText(response, 204, '');
      return true;
    }

    if (path.startsWith('/gmp/')) {
      if (!gmpKey) {
        sendText(response, 503, 'GMP server key is not configured');
        return true;
      }
      if (path === '/gmp/placephoto') {
        if (request.method !== 'GET') {
          sendProxy(response, 'gmp:photo', 405, 'Photo proxy only accepts GET', config);
          return true;
        }
        if (!sameOrigin(request) || !rate(request, 'gmp:photo', config.gmpPhotoLimit, config.windowMs)) {
          sendProxy(response, 'gmp:photo', 429, 'The demo is busy right now — try again in a few minutes', config);
          return true;
        }
        const target = allowedPhotoTarget(query.get('url') || '', gmpKey);
        if (!target) {
          sendProxy(response, 'gmp:photo', 400, 'Unsupported photo URL', config);
          return true;
        }
        if (!takeDaily('gmpPhoto', config.dailyGmpPhotoCap)) {
          sendProxy(response, 'gmp:photo', 429, 'The shared Maps daily budget is exhausted', config);
          return true;
        }
        await proxy({
          request,
          response,
          target,
          fetchImpl,
          config,
          endpoint: 'gmp:photo',
        });
        return true;
      }

      const isTile = path.includes('/heatmapTiles/')
        || path.includes('/streetview')
        || path.includes('/staticmap');
      const endpoint = isTile ? 'gmp:tile' : 'gmp';
      const limit = isTile ? config.gmpTileLimit : config.gmpLimit;
      if (!sameOrigin(request) || !rate(request, endpoint, limit, config.windowMs)) {
        sendProxy(response, endpoint, 429, 'The demo is busy right now — try again in a few minutes', config);
        return true;
      }
      const target = gmpTarget(path, query, gmpKey, request.method);
      if (!target) {
        sendProxy(response, endpoint, 404, 'Unknown GMP proxy route', config);
        return true;
      }
      const dailyKind = isTile ? 'gmpTile' : 'gmp';
      const dailyLimit = isTile ? config.dailyGmpTileCap : config.dailyGmpCap;
      if (!takeDaily(dailyKind, dailyLimit)) {
        sendProxy(response, endpoint, 429, 'The shared Maps daily budget is exhausted', config);
        return true;
      }
      await proxy({
        request,
        response,
        target,
        fetchImpl,
        config,
        endpoint,
      });
      return true;
    }

    if (path.startsWith('/ai/')) {
      resetDaily();
      if (request.method !== 'POST') {
        sendText(response, 405, 'AI proxy only accepts POST');
        return true;
      }
      if (!sameOrigin(request) || !rate(request, 'ai', config.aiLimit, config.windowMs)) {
        sendProxy(response, 'ai', 429, 'The demo is busy right now — try again in a few minutes', config);
        return true;
      }
      const credential = selectGeminiCredential(request.headers, hostedGeminiKey);
      if (credential.source === 'invalid') {
        sendProxy(response, 'ai', 401, 'Gemini key is invalid', config);
        return true;
      }
      if (credential.source === 'none') {
        sendProxy(response, 'ai', 503, 'Gemini key is not configured', config);
        return true;
      }
      if (credential.source === 'hosted' && !isHostedGeminiHealthy()) {
        sendProxy(
          response,
          'ai',
          503,
          'The shared Gemini allowance is temporarily unavailable. Add your own key to continue.',
          config,
        );
        return true;
      }

      if (path === '/ai/validate') {
        const clientKey = clientIp(request);
        let reserved = false;
        if (credential.source === 'hosted') {
          const check = geminiLimiter.consume(clientKey, { calls: 1, tokens: 50, timestamp: now() });
          if (!check.allowed) {
            sendProxy(response, 'ai', 429, check.message, config);
            return true;
          }
          reserved = true;
        }
        const result = await validateGeminiCredential(credential.key, fetchImpl);
        if (credential.source === 'hosted') {
          if (result.ok) {
            recordHostedGeminiSuccess();
          } else if (result.reason === 'quota' || result.reason === 'invalid') {
            recordHostedGeminiFailure(result.reason === 'quota' ? 'quota_depleted' : 'invalid_key');
          }
        }
        if (reserved) {
          if (!result.ok) {
            geminiLimiter.refund(clientKey, { calls: 1, tokens: 50, timestamp: now() });
          }
        }
        const status = result.ok ? 200
          : result.reason === 'invalid' ? 401
            : result.reason === 'quota' ? 429
              : result.reason === 'model_unavailable' ? 424
                : 502;
        sendJson(response, status, result);
        return true;
      }

      if (credential.source === 'hosted' && daily.ai >= config.dailyAiCap) {
        sendProxy(response, 'ai', 429, 'The demo is busy right now — try again in a few minutes', config);
        return true;
      }

      const interactionTarget = aiInteractionsTarget(path, query);
      if (interactionTarget) {
        let body;
        try {
          body = await readBody(request, config.bodyCap);
        } catch (error) {
          sendText(response, error?.statusCode === 413 ? 413 : 400, 'Invalid request body');
          return true;
        }
        let model;
        try {
          model = JSON.parse(body.toString('utf8'))?.model;
        } catch {
          sendText(response, 400, 'Invalid interactions request body');
          return true;
        }
        if (typeof model !== 'string' || !config.allowedModels.has(model)) {
          sendProxy(response, 'ai', 403, 'AI model or method is not allowed', config);
          return true;
        }
        if (credential.source === 'hosted' && daily.video >= config.dailyVideoCap) {
          sendProxy(
            response,
            'ai',
            429,
            'Video generation requires a personal Gemini API key on this demo',
            config,
          );
          return true;
        }
        if (
          credential.source === 'hosted'
          && daily.inputBytes + body.length > config.dailyAiInputBytes
        ) {
          sendProxy(
            response,
            'ai',
            429,
            'The hosted Gemini daily budget is exhausted — connect a personal key to continue',
            config,
          );
          return true;
        }
        const clientKey = clientIp(request);
        const estimatedTokens = Math.max(10, Math.ceil((body?.length || 100) / 4));
        const isOmni = isOmniModel(model);
        const estimatedCostMicros = isOmni ? 200_000 : Math.ceil(estimatedTokens * 0.15);
        if (credential.source === 'hosted') {
          if (isOmni) {
            const omniCheck = geminiOmniLimiter.consume(clientKey, {
              calls: 1,
              tokens: estimatedTokens,
              costMicros: 200_000,
              timestamp: now(),
            });
            if (!omniCheck.allowed) {
              sendProxy(
                response,
                'ai',
                429,
                omniCheck.message || 'Gemini Omni daily limit reached (2 requests/day per user, 10 globally). Connect your personal Gemini API key to continue.',
                config,
              );
              return true;
            }
          }
          const check = geminiLimiter.consume(clientKey, {
            calls: 1,
            tokens: estimatedTokens,
            costMicros: estimatedCostMicros,
            timestamp: now(),
          });
          if (!check.allowed) {
            if (isOmni) {
              geminiOmniLimiter.refund(clientKey, {
                calls: 1,
                tokens: estimatedTokens,
                costMicros: 200_000,
                timestamp: now(),
              });
            }
            sendProxy(response, 'ai', 429, check.message, config);
            return true;
          }
          daily.ai += 1;
          daily.video += 1;
          daily.inputBytes += body.length;
        }
        await proxy({
          request,
          response,
          target: interactionTarget,
          fetchImpl,
          config,
          endpoint: 'ai',
          buffer: body,
          timeoutMs: config.videoTimeoutMs,
          headers: { 'x-goog-api-key': credential.key },
          onComplete: ({ status: upstreamStatus, bodyText, error }) => {
            if (credential.source === 'hosted') {
              if (error || upstreamStatus < 200 || upstreamStatus >= 300) {
                if (
                  upstreamStatus === 429 ||
                  upstreamStatus === 401 ||
                  (bodyText && (bodyText.includes('RESOURCE_EXHAUSTED') || bodyText.includes('prepayment credits are depleted')))
                ) {
                  recordHostedGeminiFailure('quota_depleted');
                }
                geminiLimiter.refund(clientKey, { calls: 1, tokens: estimatedTokens, costMicros: estimatedCostMicros, timestamp: now() });
                if (isOmni) {
                  geminiOmniLimiter.refund(clientKey, { calls: 1, tokens: estimatedTokens, costMicros: 200_000, timestamp: now() });
                }
              } else {
                recordHostedGeminiSuccess();
                const usage = extractGeminiUsageAndCost(bodyText, body.length, { isVideo: isOmni });
                const deltaTokens = usage.totalTokens - estimatedTokens;
                const deltaCostMicros = usage.costMicros - estimatedCostMicros;
                if (deltaTokens > 0 || deltaCostMicros > 0) {
                  geminiLimiter.record(clientKey, {
                    calls: 0,
                    tokens: Math.max(0, deltaTokens),
                    costMicros: Math.max(0, deltaCostMicros),
                    timestamp: now(),
                  });
                  if (isOmni) {
                    geminiOmniLimiter.record(clientKey, {
                      calls: 0,
                      tokens: Math.max(0, deltaTokens),
                      costMicros: Math.max(0, deltaCostMicros),
                      timestamp: now(),
                    });
                  }
                } else if (deltaTokens < 0 || deltaCostMicros < 0) {
                  geminiLimiter.refund(clientKey, {
                    calls: 0,
                    tokens: Math.max(0, -deltaTokens),
                    costMicros: Math.max(0, -deltaCostMicros),
                    timestamp: now(),
                  });
                  if (isOmni) {
                    geminiOmniLimiter.refund(clientKey, {
                      calls: 0,
                      tokens: Math.max(0, -deltaTokens),
                      costMicros: Math.max(0, -deltaCostMicros),
                      timestamp: now(),
                    });
                  }
                }
              }
            }
          },
        });
        return true;
      }

      const target = aiGenerateTarget(path, query, config.allowedModels);
      if (!target) {
        sendProxy(response, 'ai', 403, 'AI model or method is not allowed', config);
        return true;
      }
      const targetModel = path.match(/models\/([^/:]+)/)?.[1] || '';
      let body;
      try {
        body = await readBody(request, config.bodyCap);
      } catch (error) {
        sendText(response, error?.statusCode === 413 ? 413 : 400, 'Invalid request body');
        return true;
      }
      if (credential.source === 'hosted') {
        if (daily.inputBytes + body.length > config.dailyAiInputBytes) {
          sendProxy(
            response,
            'ai',
            429,
            'The hosted Gemini daily budget is exhausted — connect a personal key to continue',
            config,
          );
          return true;
        }
        try {
          body = capGenerateContentRequest(body, config.hostedAiMaxOutputTokens);
        } catch {
          sendProxy(response, 'ai', 400, 'Invalid Gemini request body', config);
          return true;
        }
      }
      const clientKey = clientIp(request);
      const estimatedTokens = Math.max(10, Math.ceil((body?.length || 100) / 4));
      const isOmni = isOmniModel(targetModel);
      const estimatedCostMicros = isOmni ? 200_000 : Math.ceil(estimatedTokens * 0.15);
      if (credential.source === 'hosted') {
        if (isOmni) {
          const omniCheck = geminiOmniLimiter.consume(clientKey, {
            calls: 1,
            tokens: estimatedTokens,
            costMicros: 200_000,
            timestamp: now(),
          });
          if (!omniCheck.allowed) {
            sendProxy(
              response,
              'ai',
              429,
              omniCheck.message || 'Gemini Omni daily limit reached (2 requests/day per user, 10 globally). Connect your personal Gemini API key to continue.',
              config,
            );
            return true;
          }
        }
        const check = geminiLimiter.consume(clientKey, {
          calls: 1,
          tokens: estimatedTokens,
          costMicros: estimatedCostMicros,
          timestamp: now(),
        });
        if (!check.allowed) {
          if (isOmni) {
            geminiOmniLimiter.refund(clientKey, {
              calls: 1,
              tokens: estimatedTokens,
              costMicros: 200_000,
              timestamp: now(),
            });
          }
          sendProxy(response, 'ai', 429, check.message, config);
          return true;
        }
        daily.ai += 1;
        daily.inputBytes += body.length;
      }
      await proxy({
        request,
        response,
        target,
        fetchImpl,
        config,
        endpoint: 'ai',
        buffer: body,
        headers: { 'x-goog-api-key': credential.key },
        onComplete: ({ status: upstreamStatus, bodyText, error }) => {
          if (credential.source === 'hosted') {
            if (error || upstreamStatus < 200 || upstreamStatus >= 300) {
              if (
                upstreamStatus === 429 ||
                upstreamStatus === 401 ||
                (bodyText && (bodyText.includes('RESOURCE_EXHAUSTED') || bodyText.includes('prepayment credits are depleted')))
              ) {
                recordHostedGeminiFailure('quota_depleted');
              }
              geminiLimiter.refund(clientKey, { calls: 1, tokens: estimatedTokens, costMicros: estimatedCostMicros, timestamp: now() });
              if (isOmni) {
                geminiOmniLimiter.refund(clientKey, { calls: 1, tokens: estimatedTokens, costMicros: 200_000, timestamp: now() });
              }
            } else {
              recordHostedGeminiSuccess();
              const usage = extractGeminiUsageAndCost(bodyText, body.length, { isVideo: isOmni });
              const deltaTokens = usage.totalTokens - estimatedTokens;
              const deltaCostMicros = usage.costMicros - estimatedCostMicros;
              if (deltaTokens > 0 || deltaCostMicros > 0) {
                geminiLimiter.record(clientKey, {
                  calls: 0,
                  tokens: Math.max(0, deltaTokens),
                  costMicros: Math.max(0, deltaCostMicros),
                  timestamp: now(),
                });
                if (isOmni) {
                  geminiOmniLimiter.record(clientKey, {
                    calls: 0,
                    tokens: Math.max(0, deltaTokens),
                    costMicros: Math.max(0, deltaCostMicros),
                    timestamp: now(),
                  });
                }
              } else if (deltaTokens < 0 || deltaCostMicros < 0) {
                geminiLimiter.refund(clientKey, {
                  calls: 0,
                  tokens: Math.max(0, -deltaTokens),
                  costMicros: Math.max(0, -deltaCostMicros),
                  timestamp: now(),
                });
                if (isOmni) {
                  geminiOmniLimiter.refund(clientKey, {
                    calls: 0,
                    tokens: Math.max(0, -deltaTokens),
                    costMicros: Math.max(0, -deltaCostMicros),
                    timestamp: now(),
                  });
                }
              }
            }
          }
        },
      });
      return true;
    }

    sendJson(response, 404, { error: 'Not found' });
    return true;
  };
}

export const handleRealWorldReasoningApi = createRealWorldReasoningHandler();
