import { afterEach, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Server proxy quality gates (reliability plan §4, area 7: session/offline).
 * These exercise the /ai proxy's abuse controls END TO END — starting the real
 * server/index.mjs as a child process — so the 429 "busy" gate, the daily cap,
 * the cross-origin block, and the missing-key guard are covered deterministically
 * with NO network and NO real API keys:
 *  - A dummy GEMINI_KEY is enough to pass the key guard; the rate/cap/origin
 *    checks all fire BEFORE any upstream fetch.
 *  - Requests target a NON-allowlisted model so aiTarget() returns null (403)
 *    without ever calling Google — they still consume a rate-limit slot, which is
 *    exactly what lets us prove the Nth request flips to 429.
 */

const here = dirname(fileURLToPath(import.meta.url));
const SERVER = join(here, 'index.mjs');
const DISALLOWED = '/ai/v1beta/models/not-a-real-model:generateContent';
const ALLOWED = '/ai/v1beta/models/gemini-3.8-flash:generateContent';

let child: ChildProcess | null = null;
// Cumulative stdout+stderr of the most recently started child, so tests can
// assert the structured telemetry lines it logs (evt:diag_batch / evt:proxy).
let readOutput: () => string = () => '';

/** Poll the child's cumulative output until `re` matches, or throw on timeout. */
async function waitForLog(re: RegExp, timeoutMs = 5_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const out = readOutput();
    const line = out.split('\n').find((l) => re.test(l));
    if (line) return line;
    if (Date.now() > deadline) throw new Error(`no log line matched ${re} within ${timeoutMs}ms. Output:\n${out || '(none)'}`);
    await new Promise((r) => setTimeout(r, 25));
  }
}

/**
 * Start server/index.mjs on an ephemeral port with the given env. Resolves once
 * the server logs that it is listening — waiting for the actual "listening" line
 * (not polling fetch) is deterministic and robust on a slow, concurrent CI box.
 * On early exit or timeout the child's captured output is surfaced in the error.
 */
async function startServer(env: Record<string, string>): Promise<number> {
  const port = 8100 + Math.floor(Math.random() * 800);
  const proc = spawn('node', [SERVER], {
    env: { ...process.env, PORT: String(port), ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child = proc;
  let out = '';
  readOutput = () => out;
  proc.stdout?.on('data', (d) => { out += d.toString(); });
  proc.stderr?.on('data', (d) => { out += d.toString(); });

  return new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`server did not start in time. Output:\n${out || '(none)'}`));
    }, 20_000);
    const onData = () => {
      if (/listening on :\d+/.test(out)) {
        cleanup();
        resolve(port);
      }
    };
    const onExit = (code: number | null) => {
      cleanup();
      reject(new Error(`server exited early (code ${code}) before listening. Output:\n${out || '(none)'}`));
    };
    function cleanup() {
      clearTimeout(timer);
      proc.stdout?.off('data', onData);
      proc.stderr?.off('data', onData);
      proc.off('exit', onExit);
    }
    proc.stdout?.on('data', onData);
    proc.stderr?.on('data', onData);
    proc.on('exit', onExit);
  });
}

function post(port: number, path: string, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ contents: [{ parts: [{ text: 'hi' }] }] }),
  });
}

afterEach(() => {
  child?.kill('SIGKILL');
  child = null;
});

describe('/ai proxy quality gates', () => {
  it('returns the friendly 429 "busy" message once the per-IP AI rate limit is exceeded', async () => {
    const port = await startServer({ GEMINI_KEY: 'dummy', AI_RATE_LIMIT: '2', DAILY_AI_CAP: '1000' });
    // First two consume the window (403: model not allowlisted, but no upstream call);
    // the third trips the limiter BEFORE the model check.
    const r1 = await post(port, DISALLOWED);
    const r2 = await post(port, DISALLOWED);
    const r3 = await post(port, DISALLOWED);
    expect([r1.status, r2.status]).toEqual([403, 403]);
    expect(r3.status).toBe(429);
    expect(await r3.text()).toMatch(/busy/i);
  }, 25_000);

  it('gates every AI request with 429 once the daily cap is reached', async () => {
    const port = await startServer({ GEMINI_KEY: 'dummy', DAILY_AI_CAP: '0', AI_RATE_LIMIT: '1000' });
    const r = await post(port, DISALLOWED);
    expect(r.status).toBe(429);
  }, 25_000);

  it('never accepts a visitor key from the URL', async () => {
    const port = await startServer({ GEMINI_KEY: 'host-key', DAILY_AI_CAP: '0', AI_RATE_LIMIT: '1000' });
    const r = await post(port, `${DISALLOWED}?key=visitor-key`);
    expect(r.status).toBe(429);
  }, 25_000);

  it('rejects cross-origin AI requests (CSRF/abuse) with 429', async () => {
    const port = await startServer({ GEMINI_KEY: 'dummy', AI_RATE_LIMIT: '1000', DAILY_AI_CAP: '1000' });
    const r = await post(port, DISALLOWED, { origin: 'http://evil.example', host: `127.0.0.1:${port}` });
    expect(r.status).toBe(429);
  }, 25_000);

  it('fails closed with 500 when the Gemini key is not configured', async () => {
    // Explicit empty overrides any GEMINI_KEY inherited from the shell env.
    const port = await startServer({ GEMINI_KEY: '', AI_RATE_LIMIT: '1000', DAILY_AI_CAP: '1000' });
    const r = await post(port, DISALLOWED);
    expect(r.status).toBe(500);
    expect(await r.text()).toMatch(/not configured/i);
  }, 25_000);

  it('rejects a malformed personal key without silently falling back to hosted auth', async () => {
    const port = await startServer({ GEMINI_KEY: 'hosted-test-key', AI_RATE_LIMIT: '1000', DAILY_AI_CAP: '1000' });
    const r = await post(port, DISALLOWED, { 'x-atlas-gemini-key': 'bad key' });
    expect(r.status).toBe(401);
    expect(await r.text()).toMatch(/invalid/i);
  }, 25_000);

  it('keeps personal-key calls outside the hosted daily spend cap', async () => {
    const port = await startServer({ GEMINI_KEY: 'hosted-test-key', DAILY_AI_CAP: '0', AI_RATE_LIMIT: '1000' });
    const r = await post(port, DISALLOWED, { 'x-atlas-gemini-key': 'personal-test-key' });
    // It reaches the model allowlist (403) instead of the hosted-spend cap (429),
    // and the disallowed model guarantees no upstream network request occurs.
    expect(r.status).toBe(403);
  }, 25_000);

  it('rejects malformed hosted requests before contacting Gemini', async () => {
    const port = await startServer({ GEMINI_KEY: 'hosted-test-key', DAILY_AI_CAP: '1000', AI_RATE_LIMIT: '1000' });
    const r = await fetch(`http://127.0.0.1:${port}${ALLOWED}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });
    expect(r.status).toBe(400);
    expect(await r.text()).toMatch(/invalid gemini/i);
  }, 25_000);

  it('keeps hosted video disabled by default while allowing BYOK to reach the allowlist', async () => {
    const port = await startServer({ GEMINI_KEY: 'hosted-test-key', AI_RATE_LIMIT: '1000', DAILY_AI_CAP: '1000' });
    const path = '/ai/v1beta/interactions';
    const hosted = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'gemini-omni-1.1-flash-preview' }),
    });
    expect(hosted.status).toBe(429);
    expect(await hosted.text()).toMatch(/personal gemini api key/i);

    const byok = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-atlas-gemini-key': 'personal-test-key' },
      body: JSON.stringify({ model: 'not-a-real-model' }),
    });
    expect(byok.status).toBe(403);
  }, 25_000);

  it('rejects a disallowed model with 403 (never forwarding it upstream)', async () => {
    const port = await startServer({ GEMINI_KEY: 'dummy', AI_RATE_LIMIT: '1000', DAILY_AI_CAP: '1000' });
    const r = await post(port, DISALLOWED);
    expect(r.status).toBe(403);
    expect(await r.text()).toMatch(/not allowed/i);
  }, 25_000);

  it('survives a static request when the SPA is not built (no crash on missing file)', async () => {
    // Regression: tests run before `build`, so dist/index.html is absent. A read
    // error on the fallback file must NOT crash the process. Prove the server is
    // still responsive after a static request by making a second request.
    const port = await startServer({ GEMINI_KEY: 'dummy', GMP_RATE_LIMIT: '1000' });
    const first = await fetch(`http://127.0.0.1:${port}/some/app/route`);
    expect([200, 404]).toContain(first.status);
    const second = await fetch(`http://127.0.0.1:${port}/metadata`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '[]',
    });
    expect(second.status).toBe(403); // still alive: consent gate responds
  }, 25_000);
});

describe('/capabilities preflight', () => {
  it('reports only whether live server capabilities are configured', async () => {
    const port = await startServer({ GEMINI_KEY: 'dummy', GMP_SERVER_KEY: 'dummy', GMP_RATE_LIMIT: '1000' });
    const response = await fetch(`http://127.0.0.1:${port}/capabilities`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ maps: true, gemini: true, mapsGrounding: true, groundingLite: true });
  }, 25_000);

  it('fails closed when either server capability is absent', async () => {
    const port = await startServer({ GEMINI_KEY: '', GMP_SERVER_KEY: '', GMP_RATE_LIMIT: '1000' });
    const response = await fetch(`http://127.0.0.1:${port}/capabilities`);
    expect(await response.json()).toEqual({ maps: false, gemini: false, mapsGrounding: false, groundingLite: false });
  }, 25_000);
});

describe('/metadata consent-gated sink', () => {
  const record = {
    scenario: 'adstudio',
    tool: 'generate_ad_creatives',
    status: 'error',
    category: 'error:generate_ad_creatives',
    detailLabels: ['Business'],
    tsBucket: 1_700_000_040_000,
  };
  const send = (port: number, body: unknown, headers: Record<string, string> = {}) =>
    fetch(`http://127.0.0.1:${port}/metadata`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });

  it('rejects without the consent header (403)', async () => {
    const port = await startServer({ GEMINI_KEY: 'dummy', GMP_RATE_LIMIT: '1000' });
    const r = await send(port, [record]);
    expect(r.status).toBe(403);
    expect(await r.text()).toMatch(/consent/i);
  }, 25_000);

  it('accepts a clean sanitized batch with consent (204)', async () => {
    const port = await startServer({ GEMINI_KEY: 'dummy', GMP_RATE_LIMIT: '1000' });
    const r = await send(port, [record], { 'x-atlas-consent': '1' });
    expect(r.status).toBe(204);
  }, 25_000);

  it('logs the validated batch as a structured diag_batch line (triage signal)', async () => {
    const port = await startServer({ GEMINI_KEY: 'dummy', GMP_RATE_LIMIT: '1000' });
    const r = await send(port, [record], { 'x-atlas-consent': '1' });
    expect(r.status).toBe(204);
    const line = await waitForLog(/"evt":"diag_batch"/);
    const parsed = JSON.parse(line);
    expect(parsed.records).toHaveLength(1);
    expect(parsed.records[0].category).toBe('error:generate_ad_creatives');
    expect(parsed.at).toBeTypeOf('string');
  }, 25_000);

  it('rejects consented-but-dirty content (unknown key or forbidden value) with 400', async () => {
    const port = await startServer({ GEMINI_KEY: 'dummy', GMP_RATE_LIMIT: '1000' });
    const withExtra = await send(port, [{ ...record, summary: 'Blue Bottle Coffee' }], { 'x-atlas-consent': '1' });
    expect(withExtra.status).toBe(400);
    const withUrl = await send(port, [{ ...record, category: 'http://leak.example' }], { 'x-atlas-consent': '1' });
    expect(withUrl.status).toBe(400);
  }, 25_000);
});

describe('proxy telemetry', () => {
  it('emits a structural proxy line on a disallowed-model 403 (no path/url logged)', async () => {
    const port = await startServer({ GEMINI_KEY: 'dummy', AI_RATE_LIMIT: '1000', DAILY_AI_CAP: '1000' });
    const r = await post(port, DISALLOWED);
    expect(r.status).toBe(403);
    const line = await waitForLog(/"evt":"proxy"/);
    const parsed = JSON.parse(line);
    expect(parsed.category).toBe('proxy:ai:forbidden');
    expect(parsed.scenario).toBe('proxy');
    // The raw request path must never appear in telemetry.
    expect(line).not.toContain('not-a-real-model');
    expect(line).not.toContain('generateContent');
  }, 25_000);

  it('emits proxy:ai:rate_limit when the AI limiter trips', async () => {
    const port = await startServer({ GEMINI_KEY: 'dummy', AI_RATE_LIMIT: '0', DAILY_AI_CAP: '1000' });
    const r = await post(port, DISALLOWED);
    expect(r.status).toBe(429);
    const line = await waitForLog(/proxy:ai:rate_limit/);
    expect(JSON.parse(line).category).toBe('proxy:ai:rate_limit');
  }, 25_000);
});
