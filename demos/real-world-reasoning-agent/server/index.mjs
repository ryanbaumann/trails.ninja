import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, normalize, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  allowedGeminiModels,
  capGenerateContentRequest,
  validateGeminiCredential,
  selectGeminiCredential,
  validateMetadata,
  toProxyDiagRecord,
  classifyProxyOutcome,
  shouldHeartbeat,
  HEARTBEAT_MS,
  upstreamHeaders,
} from './lib.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = normalize(join(__dirname, '..'));
const dist = join(root, 'dist');
const port = Number(process.env.PORT || 8080);
const gmpKey = (process.env.GMP_SERVER_KEY || '').trim();
const geminiKey = (process.env.GEMINI_KEY || '').trim();
const aiLimit = Number(process.env.AI_RATE_LIMIT || 36000);
const gmpLimit = Number(process.env.GMP_RATE_LIMIT || 180000);
const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
// Hosted-key budget guard. At current 3.6 Flash pricing, the defaults bound a
// UTC day's aggregate request payload to ~1.4 MB and model output to at most
// 50 * 2,048 tokens. This is intentionally conservative for a public demo.
// BYOK traffic uses the user's own project and bypasses these hosted spend caps.
const dailyAiCap = Number(process.env.DAILY_AI_CAP || 50);
const dailyAiInputBytes = Number(process.env.DAILY_AI_INPUT_BYTES || 1_400_000);
const hostedAiMaxOutputTokens = Number(process.env.HOSTED_AI_MAX_OUTPUT_TOKENS || 2_048);
const dailyVideoCap = Number(process.env.DAILY_VIDEO_CAP || 0);
const bodyCap = Number(process.env.BODY_CAP_BYTES || 1024 * 1024);
const timeoutMs = Number(process.env.UPSTREAM_TIMEOUT_MS || 60_000);
// Omni video generation (Interactions API) is far slower than a chat/vision turn,
// so its upstream call gets a longer, separately-tunable timeout.
const videoTimeoutMs = Number(process.env.VIDEO_UPSTREAM_TIMEOUT_MS || 300_000);
// Base allowlist plus any comma-separated ids in GENAI_EXTRA_MODELS, so a deployer
// can enable a heavier "omni" chat/image model without editing code.
const allowedModels = allowedGeminiModels(process.env.GENAI_EXTRA_MODELS);
const buckets = new Map();
// Min interval between `ok` proxy heartbeats per endpoint; 0 disables them.
const heartbeatMs = Number(process.env.PROXY_HEARTBEAT_MS ?? HEARTBEAT_MS);
const heartbeats = new Map();
let daily = { day: new Date().toISOString().slice(0, 10), ai: 0, inputBytes: 0, video: 0 };

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
// Cloud Run / GFE appends the real client IP as the LAST X-Forwarded-For hop.
// Trusting the first (client-supplied) hop lets callers forge a fresh bucket
// per request and defeat rate limiting, so use the last entry.
function ip(req) { const xff = (req.headers['x-forwarded-for'] || '').toString().split(',').map((s) => s.trim()).filter(Boolean); return xff.length ? xff[xff.length - 1] : (req.socket.remoteAddress || 'unknown'); }
function rate(req, kind, limit) { const key = `${kind}:${ip(req)}`; const now = Date.now(); const b = buckets.get(key) || []; const fresh = b.filter((t) => now - t < windowMs); fresh.push(now); buckets.set(key, fresh); return fresh.length <= limit; }
function sameOrigin(req) { const host = req.headers['x-forwarded-host'] || req.headers.host; const source = req.headers.origin || req.headers.referer; if (!source) return true; try { return new URL(source).host === host; } catch { return false; } }
function appendKey(url, key) { url.searchParams.set('key', key); return url; }
function send(res, status, body, headers = {}) { res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', ...security(), ...headers }); res.end(body); }
function sendJson(res, status, value) { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...security(), 'cache-control': 'no-store' }); res.end(JSON.stringify(value)); }
// Coarsen to the minute so proxy telemetry can't be used for fine-grained
// timing correlation (mirrors TS_BUCKET_MS in src/diagnostics/telemetry.ts).
function minuteBucket() { return Math.floor(Date.now() / 60_000) * 60_000; }
// Emit privacy-safe, structural proxy telemetry. FAILURES are always logged; a
// 2xx would otherwise be dropped (a tile stream would flood logs), so instead we
// emit a rate-limited `ok` HEARTBEAT — at most one per endpoint per interval — so
// the triage loop can tell a healthy, quiet service from a dead/undeployed one.
// Content-free by construction; toProxyDiagRecord fails closed if it ever isn't.
function logProxy(endpoint, status) {
  if (classifyProxyOutcome(status) === 'ok' && !shouldHeartbeat(heartbeats, endpoint, Date.now(), heartbeatMs)) return;
  const rec = toProxyDiagRecord(endpoint, status, minuteBucket());
  if (rec) console.log(JSON.stringify({ evt: 'proxy', ...rec, at: new Date().toISOString() }));
}
// Log the proxy outcome, then send the (usually error) response, in one call so
// gate rejections (429/403/…) become telemetry without repeating the log line.
function sendProxy(res, endpoint, status, body, headers = {}) { logProxy(endpoint, status); return send(res, status, body, headers); }
function security() {
  return {
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'x-frame-options': 'DENY',
    'permissions-policy': 'camera=(), microphone=(self), geolocation=(self)',
    'strict-transport-security': 'max-age=31536000; includeSubDomains',
    'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://maps.googleapis.com https://www.googletagmanager.com https://www.google-analytics.com; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://*.googleusercontent.com https://www.google-analytics.com https://www.google.com https://stats.g.doubleclick.net; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://www.googletagmanager.com https://www.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net https://www.google.com;"
  };
}
async function body(req) { const chunks = []; let total = 0; for await (const c of req) { total += c.length; if (total > bodyCap) throw new Error('body_too_large'); chunks.push(c); } return Buffer.concat(chunks); }
function resetDaily() { const day = new Date().toISOString().slice(0, 10); if (daily.day !== day) daily = { day, ai: 0, inputBytes: 0, video: 0 }; }
function allowedPhotoTarget(raw) {
  try {
    const target = new URL(raw);
    const ok = target.protocol === 'https:' && (target.hostname === 'places.googleapis.com' || target.hostname === 'googleusercontent.com' || target.hostname.endsWith('.googleusercontent.com'));
    if (!ok) return null;
    if (target.hostname === 'places.googleapis.com') appendKey(target, gmpKey);
    return target;
  } catch {
    return null;
  }
}

async function proxy(req, res, target, opts = {}) {
  const limit = opts.timeoutMs ?? timeoutMs;
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), limit);
  try {
    // Callers that must read the body first (e.g. to inspect the model) pass it
    // back in via opts.buffer so we don't try to consume the stream twice.
    const buf = opts.buffer !== undefined ? opts.buffer : (['GET','HEAD'].includes(req.method || '') ? undefined : await body(req));
    // Forward ORIGIN-ONLY referer/origin upstream: a replay link's raw ?prompt=
    // lives in the full Referer URL and must never reach Google (reliability §5).
    // rawHeaders bypasses upstreamHeaders entirely for server-to-server calls
    // that must NOT send browser referer/origin (e.g. MCP API-key auth).
    const hdrs = opts.rawHeaders ?? { ...upstreamHeaders(req.headers, target), ...opts.headers };
    const up = await fetch(target, { method: req.method, headers: hdrs, body: buf, signal: ctrl.signal });
    const headers = Object.fromEntries(up.headers); delete headers['content-encoding']; delete headers['content-length'];
    res.writeHead(up.status, { ...headers, ...security() });
    if (opts.endpoint) logProxy(opts.endpoint, up.status);
    if (up.body) { for await (const chunk of up.body) res.write(chunk); }
    res.end();
  } catch (e) {
    // Once the response has started streaming (headers sent) we can't send an
    // error body — a second writeHead throws and leaves the socket open, wedging
    // the client on a silent stream. Destroy it instead so the client sees a
    // failed read and can retry, rather than hanging forever.
    const status = e.message === 'body_too_large' ? 413 : 502;
    if (res.headersSent) res.destroy(e);
    else send(res, status, 'Upstream request failed');
    if (opts.endpoint) logProxy(opts.endpoint, res.headersSent ? 502 : status);
  }
  finally { clearTimeout(timer); }
}

// Build a target URL pinned to `host`. Rejects any `rest` that would let the
// WHATWG URL parser override the host — e.g. a protocol-relative `//evil.example`
// or an absolute `https://evil.example` — which would otherwise leak the API key
// to an attacker-controlled server (SSRF + key exfiltration).
function pinnedTarget(rest, query, host) {
  if (!rest.startsWith('/') || rest.startsWith('//')) return null;
  const target = new URL(rest + query, host);
  if (target.origin !== host) return null;
  return target;
}
function gmpTarget(path, query) {
  let host = 'https://maps.googleapis.com'; let rest = path;
  if (path.startsWith('/gmp/geocode')) rest = '/maps/api/geocode' + path.slice('/gmp/geocode'.length);
  else if (path.startsWith('/gmp/airquality')) { host = 'https://airquality.googleapis.com'; rest = path.slice('/gmp/airquality'.length); }
  else if (path.startsWith('/gmp/weather')) { host = 'https://weather.googleapis.com'; rest = path.slice('/gmp/weather'.length); }
  else if (path.startsWith('/gmp/pollen')) { host = 'https://pollen.googleapis.com'; rest = path.slice('/gmp/pollen'.length); }
  else if (path.startsWith('/gmp/solar')) { host = 'https://solar.googleapis.com'; rest = path.slice('/gmp/solar'.length); }
  else if (path.startsWith('/gmp/streetview')) rest = path.slice('/gmp/streetview'.length);
  else if (path.startsWith('/gmp/staticmap')) rest = path.slice('/gmp/staticmap'.length);
  else return null;
  const target = pinnedTarget(rest, query, host); if (!target) return null;
  return appendKey(target, gmpKey);
}
function aiTarget(path, query) {
  if (!path.startsWith('/ai/')) return null;
  if (!path.endsWith(':generateContent') && !path.endsWith(':streamGenerateContent')) return null;
  const m = path.match(/models\/([^/:]+)/); if (!m || !allowedModels.has(m[1])) return null;
  return pinnedTarget(path.replace(/^\/ai/, ''), query, 'https://generativelanguage.googleapis.com');
}
// The omni video model uses the Interactions API, which POSTs to
// `/{version}/interactions` — there is no `models/<id>` in the path, so the model
// to allowlist lives in the request BODY. This only matches the interactions
// collection endpoint (create); per-id sub-paths (/interactions/<id>...) are not
// exposed. The caller checks the body's `model` against allowedModels.
function aiInteractionsTarget(path, query) {
  if (!/^\/ai\/[^/]+\/interactions$/.test(path)) return null;
  return pinnedTarget(path.replace(/^\/ai/, ''), query, 'https://generativelanguage.googleapis.com');
}

createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/capabilities') {
    if (req.method !== 'GET') return send(res, 405, 'Capabilities only accepts GET');
    return sendJson(res, 200, {
      maps: Boolean(gmpKey),
      gemini: Boolean(geminiKey),
      mapsGrounding: Boolean(geminiKey),
      groundingLite: Boolean(geminiKey),
    });
  }
  if (url.pathname.startsWith('/gmp/')) {
    if (!gmpKey) return send(res, 500, 'GMP server key is not configured');
    if (url.pathname === '/gmp/placephoto') {
      if (!sameOrigin(req) || !rate(req, 'gmp', gmpLimit * 10)) return sendProxy(res, 'gmp:photo', 429, 'The demo is busy right now — try again in a few minutes');
      const target = allowedPhotoTarget(url.searchParams.get('url') || ''); if (!target) return sendProxy(res, 'gmp:photo', 400, 'Unsupported photo URL');
      return proxy(req, res, target, { endpoint: 'gmp:photo' });
    }
    const isTile = url.pathname.includes('/heatmapTiles/') || url.pathname.includes('/streetview') || url.pathname.includes('/staticmap');
    const endpoint = isTile ? 'gmp:tile' : 'gmp';
    const limit = isTile ? gmpLimit * 10 : gmpLimit;
    if (!sameOrigin(req) || !rate(req, 'gmp', limit)) return sendProxy(res, endpoint, 429, 'The demo is busy right now — try again in a few minutes');
    const target = gmpTarget(url.pathname, url.search); if (!target) return sendProxy(res, endpoint, 404, 'Unknown GMP proxy route');
    return proxy(req, res, target, { endpoint });
  }
  // Consent-gated browser metadata sink (reliability §5). Accepts ONLY strictly
  // validated, sanitized structural metadata AND only when the client asserts
  // consent (X-Atlas-Consent: 1). Nothing is forwarded to a third party; the
  // server just logs a structured, content-free counter. No consent -> 403.
  if (url.pathname === '/metadata') {
    if (req.method !== 'POST') return send(res, 405, 'Metadata only accepts POST');
    if (!sameOrigin(req) || !rate(req, 'gmp', gmpLimit)) return send(res, 429, 'The demo is busy right now — try again in a few minutes');
    if (req.headers['x-atlas-consent'] !== '1') return send(res, 403, 'Diagnostics consent required');
    let buf;
    try { buf = await body(req); } catch (e) { return send(res, e.message === 'body_too_large' ? 413 : 400, 'Invalid request body'); }
    let payload;
    try { payload = JSON.parse(buf.toString('utf8')); } catch { return send(res, 400, 'Invalid metadata JSON'); }
    const v = validateMetadata(payload);
    if (!v.ok) return send(res, 400, `Rejected metadata: ${v.reason}`);
    // Log the VALIDATED, content-free sanitized batch so the telemetry-triage job
    // can cluster it from production logs. validateMetadata has already proven the
    // payload is structural-only (no urls/coords/ids/prompt) — never its content.
    console.log(JSON.stringify({ evt: 'diag_batch', records: payload, at: new Date().toISOString() }));
    return send(res, 204, '');
  }
  if (url.pathname.startsWith('/ai/')) {
    resetDaily();
    if (req.method !== 'POST') return send(res, 405, 'AI proxy only accepts POST');
    if (!sameOrigin(req) || !rate(req, 'ai', aiLimit)) return sendProxy(res, 'ai', 429, 'The demo is busy right now — try again in a few minutes');
    const credential = selectGeminiCredential(req.headers, geminiKey);
    if (credential.source === 'invalid') return sendProxy(res, 'ai', 401, 'Gemini key is invalid');
    if (credential.source === 'none') return sendProxy(res, 'ai', 500, 'Gemini key is not configured');

    if (url.pathname === '/ai/validate') {
      const result = await validateGeminiCredential(credential.key);
      const status = result.ok ? 200
        : result.reason === 'invalid' ? 401
          : result.reason === 'quota' ? 429
            : result.reason === 'model_unavailable' ? 424
              : 502;
      return sendJson(res, status, result);
    }

    // The hosted demo has a shared spend cap. A personal key uses its owner's
    // project quota while remaining subject to this service's per-IP rate limit.
    if (credential.source === 'hosted' && daily.ai >= dailyAiCap) {
      return sendProxy(res, 'ai', 429, 'The demo is busy right now — try again in a few minutes');
    }
    // Interactions API (omni video): the model lives in the body, so buffer +
    // parse it, enforce the same allowlist, then forward with the longer video timeout.
    const interTarget = aiInteractionsTarget(url.pathname, url.search);
    if (interTarget) {
      let buf;
      try { buf = await body(req); } catch (e) { return send(res, e.message === 'body_too_large' ? 413 : 400, 'Invalid request body'); }
      let model;
      try { model = JSON.parse(buf.toString('utf8'))?.model; } catch { return send(res, 400, 'Invalid interactions request body'); }
      if (typeof model !== 'string' || !allowedModels.has(model)) return sendProxy(res, 'ai', 403, 'AI model or method is not allowed');
      if (credential.source === 'hosted' && daily.video >= dailyVideoCap) {
        return sendProxy(res, 'ai', 429, 'Video generation requires a personal Gemini API key on this demo');
      }
      if (credential.source === 'hosted' && daily.inputBytes + buf.length > dailyAiInputBytes) {
        return sendProxy(res, 'ai', 429, 'The hosted Gemini daily budget is exhausted — connect a personal key to continue');
      }
      if (credential.source === 'hosted') {
        daily.ai++;
        daily.video++;
        daily.inputBytes += buf.length;
      }
      return proxy(req, res, interTarget, {
        buffer: buf,
        timeoutMs: videoTimeoutMs,
        endpoint: 'ai',
        headers: { 'x-goog-api-key': credential.key },
      });
    }
    const target = aiTarget(url.pathname, url.search); if (!target) return sendProxy(res, 'ai', 403, 'AI model or method is not allowed');
    let buf;
    try { buf = await body(req); } catch (e) { return send(res, e.message === 'body_too_large' ? 413 : 400, 'Invalid request body'); }
    if (credential.source === 'hosted') {
      if (daily.inputBytes + buf.length > dailyAiInputBytes) {
        return sendProxy(res, 'ai', 429, 'The hosted Gemini daily budget is exhausted — connect a personal key to continue');
      }
      try { buf = capGenerateContentRequest(buf, hostedAiMaxOutputTokens); }
      catch { return sendProxy(res, 'ai', 400, 'Invalid Gemini request body'); }
      daily.ai++;
      daily.inputBytes += buf.length;
    }
    return proxy(req, res, target, { buffer: buf, endpoint: 'ai', headers: { 'x-goog-api-key': credential.key } });
  }
  let reqPath;
  try {
    let p = decodeURIComponent(url.pathname);
    if (p.startsWith('/labs/atlas')) p = p.slice('/labs/atlas'.length);
    reqPath = normalize(p === '' || p === '/' ? '/index.html' : p);
  }
  catch { return send(res, 400, 'Bad Request'); }
  const file = normalize(join(dist, reqPath));
  const safe = file === dist || file.startsWith(dist + sep); const finalFile = safe && existsSync(file) && statSync(file).isFile() ? file : join(dist, 'index.html');
  // Fall back to 404 if the SPA shell isn't built (e.g. tests run before `build`)
  // rather than serving a missing file — an unhandled stream error would crash
  // the whole process.
  if (!existsSync(finalFile)) return send(res, 404, 'Not found');
  const ext = extname(finalFile); const cache = ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable';
  res.writeHead(200, { ...security(), 'content-type': mime[ext] || 'application/octet-stream', 'cache-control': cache });
  const stream = createReadStream(finalFile);
  // A read error after headers are sent can't become an error response; destroy
  // the socket instead of letting the unhandled 'error' crash the process.
  stream.on('error', () => res.destroy());
  stream.pipe(res);
}).listen(port, () => console.log(`Atlas server listening on :${port}`));
