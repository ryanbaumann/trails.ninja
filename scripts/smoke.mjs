#!/usr/bin/env node
// scripts/smoke.mjs
//
// Dependency-free smoke test for the Ryan Baumann portfolio gateway. Exercises a
// running instance with plain `fetch`: route liveness, HTML sanity, the
// apps.json <-> /api/apps contract, OAuth URL shape, a leaked-secret grep
// over every served asset, and keyless proxy behavior. See
// docs/ARCHITECTURE.md rule 4: "Smoke tests are dependency-free."
//
// Usage:
//   BASE_URL=https://ryanbaumann.dev node scripts/smoke.mjs   # test a running instance
//   node scripts/smoke.mjs                                  # build nothing; boot the
//                                                            # gateway against ./apps
//                                                            # (run `node scripts/build-local.mjs`
//                                                            # first) and test that

import { spawn } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APPS_JSON_PATH = join(REPO_ROOT, 'apps.json');
const APPS_STAGING_DIR = join(REPO_ROOT, 'apps');

const failures = [];
const passes = [];

function pass(name) {
  passes.push(name);
  console.log(`  ok  ${name}`);
}

function fail(name, detail) {
  failures.push({ name, detail });
  console.error(`FAIL  ${name}`);
  if (detail) console.error(`      ${String(detail).split('\n').join('\n      ')}`);
}

async function check(name, fn) {
  try {
    await fn();
    pass(name);
  } catch (err) {
    fail(name, err.stack || err.message || String(err));
  }
}

// ---------------------------------------------------------------------------
// Gateway lifecycle: reuse BASE_URL if given, else boot the gateway ourselves
// against the local apps/ staging directory produced by build-local.mjs.
// ---------------------------------------------------------------------------

let child = null;

async function waitForHealthz(baseUrl, timeoutMs = 15_000) {
  const start = Date.now();
  let lastError;
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/api/healthz`);
      if (response.ok) return;
    } catch (err) {
      lastError = err;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Gateway did not become healthy at ${baseUrl} within ${timeoutMs}ms: ${lastError}`);
}

async function startGateway() {
  const port = Number(process.env.SMOKE_PORT || 8099);
  const baseUrl = `http://127.0.0.1:${port}`;

  child = spawn(process.execPath, [join(REPO_ROOT, 'gateway', 'server.js')], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      APPS_ROOT: APPS_STAGING_DIR,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  child.on('exit', (code, signal) => {
    if (code !== null && code !== 0) {
      console.error(`[smoke] gateway process exited early with code ${code} (signal ${signal})\n${output}`);
    }
  });

  await waitForHealthz(baseUrl);
  return baseUrl;
}

function stopGateway() {
  if (child && !child.killed) {
    child.kill();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function listFilesRecursive(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFilesRecursive(full));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

// Matches src="..." / href="..." attribute values that look like local
// asset references (not http(s)/data/mailto/anchor links).
function extractAssetUrls(html) {
  const urls = new Set();
  const attrPattern = /\b(?:src|href)\s*=\s*["']([^"']+)["']/gi;
  let match;
  while ((match = attrPattern.exec(html))) {
    const value = match[1];
    if (!value) continue;
    if (/^(https?:)?\/\//i.test(value)) continue; // external
    if (/^(data|mailto|tel|javascript):/i.test(value)) continue;
    if (value.startsWith('#')) continue;
    urls.add(value);
  }
  return [...urls];
}

async function fetchText(url) {
  const response = await fetch(url);
  const text = await response.text();
  return { response, text };
}

// ---------------------------------------------------------------------------
// Secret-leak patterns. Each entry: [label, regex, note].
// ---------------------------------------------------------------------------

const SECRET_PATTERNS = [
  ['Strava/generic OAuth client_secret string', /client_secret/i],
  // Referrer-restricted Maps browser keys are expected in Vite bundles.
  // Server keys use non-VITE env vars and are never exposed to this scan.
  ['Stripe-style live secret key', /sk_live_[0-9A-Za-z]+/],
  ['PEM private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
];

function scanForSecrets(rootDirs) {
  const hits = [];
  const textExtensions = new Set(['.html', '.js', '.mjs', '.css', '.json', '.map', '.svg', '.txt', '.webmanifest']);
  for (const rootDir of rootDirs) {
    for (const filePath of listFilesRecursive(rootDir)) {
      if (!textExtensions.has(extname(filePath).toLowerCase())) continue;
      let content;
      try {
        content = readFileSync(filePath, 'utf8');
      } catch {
        continue;
      }
      const relPath = relative(REPO_ROOT, filePath);
      for (const [label, pattern] of SECRET_PATTERNS) {
        const match = content.match(pattern);
        if (match) {
          hits.push(`${label} in ${relPath}: "${match[0].slice(0, 60)}"`);
        }
      }
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const apps = JSON.parse(readFileSync(APPS_JSON_PATH, 'utf8'))
    .filter((app) => (app.visibility || 'public') === 'public');
  const startedOwnGateway = !process.env.BASE_URL;
  const baseUrl = process.env.BASE_URL || await startGateway();

  console.log(`[smoke] testing ${baseUrl}${startedOwnGateway ? ' (gateway started by this script)' : ' (external BASE_URL)'}`);

  try {
    await check('/api/healthz returns 200', async () => {
      const response = await fetch(`${baseUrl}/api/healthz`);
      if (response.status !== 200) throw new Error(`expected 200, got ${response.status}`);
      const data = await response.json();
      if (data.ok !== true) throw new Error(`expected ok: true, got ${JSON.stringify(data)}`);
    });

    await check('/ returns 200 text/html containing every app title', async () => {
      const { response, text } = await fetchText(`${baseUrl}/`);
      if (response.status !== 200) throw new Error(`expected 200, got ${response.status}`);
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) throw new Error(`expected text/html, got ${contentType}`);
      for (const app of apps) {
        if (app.hideOnHome) continue;
        if (!text.includes(app.title)) throw new Error(`landing page missing app title "${app.title}"`);
      }
    });

    await check('/api/apps returns JSON matching apps.json', async () => {
      const response = await fetch(`${baseUrl}/api/apps`);
      if (response.status !== 200) throw new Error(`expected 200, got ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.apps)) throw new Error('expected { apps: [...] }');
      if (data.apps.length !== apps.length) {
        throw new Error(`expected ${apps.length} apps, got ${data.apps.length}`);
      }
      for (const expected of apps) {
        const actual = data.apps.find((a) => a.name === expected.name);
        if (!actual) throw new Error(`apps.json app "${expected.name}" missing from /api/apps`);
        for (const field of ['title', 'description', 'path']) {
          if (actual[field] !== expected[field]) {
            throw new Error(`app "${expected.name}" field "${field}" mismatch: expected ${JSON.stringify(expected[field])}, got ${JSON.stringify(actual[field])}`);
          }
        }
      }
    });

    await check('/<app> (no trailing slash) redirects to /<app>/', async () => {
      const app = apps.find((a) => a.path !== '/' && !a.path.startsWith('http'));
      if (!app) throw new Error('no demo app (non-root path) in apps.json');
      const bare = app.path.slice(0, -1);
      const response = await fetch(`${baseUrl}${bare}`, { redirect: 'manual' });
      if (response.status !== 308) throw new Error(`expected 308 redirect for ${bare}, got ${response.status}`);
      const location = response.headers.get('location');
      if (location !== app.path) throw new Error(`expected redirect Location "${app.path}", got "${location}"`);
    });

    const servedTextAssets = new Map();
    for (const app of apps) {
      if (app.path.startsWith('http')) continue;
      await check(`${app.path} returns 200 HTML with resolving asset references`, async () => {
        const pageUrl = `${baseUrl}${app.path}`;
        const { response, text } = await fetchText(pageUrl);
        if (response.status !== 200) throw new Error(`expected 200, got ${response.status}`);
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('text/html')) throw new Error(`expected text/html, got ${contentType}`);
        if (!/<html/i.test(text)) throw new Error('response does not look like parseable HTML (no <html> tag)');
        servedTextAssets.set(pageUrl, text);

        const assetUrls = extractAssetUrls(text);
        if (assetUrls.length === 0) throw new Error('found no local asset references to verify');

        for (const assetUrl of assetUrls) {
          const resolved = new URL(assetUrl, pageUrl).href;
          const assetResponse = await fetch(resolved);
          if (assetResponse.status !== 200) {
            throw new Error(`asset ${assetUrl} (resolved: ${resolved}) returned ${assetResponse.status}`);
          }
          const assetType = assetResponse.headers.get('content-type') || '';
          if (/^(?:text\/|application\/(?:javascript|json))|image\/svg\+xml/.test(assetType)) {
            servedTextAssets.set(resolved, await assetResponse.text());
          }
        }
      });
    }

    await check('strava-explorer bundle uses the real Strava OAuth authorize URL', async () => {
      const strava = apps.find((a) => a.name === 'strava-explorer');
      if (!strava) throw new Error('strava-explorer missing from apps.json');
      const combined = [...servedTextAssets]
        .filter(([url]) => url.includes(strava.path))
        .map(([, content]) => content)
        .join('\n');
      if (!combined.includes('https://www.strava.com/oauth/authorize')) {
        throw new Error('did not find https://www.strava.com/oauth/authorize in the served bundle');
      }
      if (!/response_type=code/.test(combined)) {
        throw new Error('did not find response_type=code in the served bundle');
      }
    });

    // A Content-Security-Policy that blocks an origin the shipped bundle calls
    // is invisible to every check above: the page is 200, the assets resolve,
    // and the app still breaks in a browser. That is exactly how the Strava
    // demo shipped broken ("Failed to fetch activities") when the CSP landed
    // without a Strava origin in connect-src. Tie the served policy to the
    // served code: whatever Strava API base the bundle carries must be in the
    // connect-src the same response sent.
    await check('served CSP allows the Strava API origin the strava-explorer bundle calls', async () => {
      const strava = apps.find((a) => a.name === 'strava-explorer');
      if (!strava) throw new Error('strava-explorer missing from apps.json');
      const combined = [...servedTextAssets]
        .filter(([url]) => url.includes(strava.path))
        .map(([, content]) => content)
        .join('\n');
      const apiMatch = combined.match(/https:\/\/www\.strava\.com\/api\/v\d+/);
      if (!apiMatch) throw new Error('did not find a Strava API base URL in the served bundle');
      const apiOrigin = new URL(apiMatch[0]).origin;

      const response = await fetch(`${baseUrl}${strava.path}`);
      const csp = response.headers.get('content-security-policy');
      if (!csp) throw new Error(`no Content-Security-Policy header on ${strava.path}`);
      const connectSrc = csp.split(';').map((part) => part.trim())
        .find((part) => part === 'connect-src' || part.startsWith('connect-src '));
      if (!connectSrc) throw new Error(`CSP on ${strava.path} has no connect-src directive: ${csp}`);
      if (!connectSrc.split(/\s+/).slice(1).includes(apiOrigin)) {
        throw new Error(`CSP connect-src does not allow ${apiOrigin}: ${connectSrc}`);
      }
    });

    await check('no known secret pattern in any served asset', () => {
      const hits = [];
      for (const [url, content] of servedTextAssets) {
        for (const [label, pattern] of SECRET_PATTERNS) {
          if (pattern.test(content)) hits.push(`${label}: ${url}`);
        }
      }
      if (hits.length > 0) throw new Error(hits.join('\n'));
    });

    await check('secret-leak scan over staged apps', () => {
      const hits = scanForSecrets([APPS_STAGING_DIR]);
      if (hits.length > 0) throw new Error(hits.join('\n'));
    });

    await check('/portfolio/ permanently redirects to the root site', async () => {
      const response = await fetch(`${baseUrl}/portfolio/`, { redirect: 'manual' });
      if (response.status !== 308) throw new Error(`expected 308, got ${response.status}`);
      const location = response.headers.get('location');
      if (location !== '/') throw new Error(`expected Location "/", got "${location}"`);
      const deep = await fetch(`${baseUrl}/portfolio/work/`, { redirect: 'manual' });
      if (deep.status !== 308 || deep.headers.get('location') !== '/work/') {
        throw new Error(`expected /portfolio/work/ -> 308 /work/, got ${deep.status} ${deep.headers.get('location')}`);
      }
    });

    await check('site sections (/work/, /writing/, /talks/, /demos/, /about/) return 200', async () => {
      for (const path of ['/work/', '/writing/', '/talks/', '/demos/', '/about/']) {
        const response = await fetch(`${baseUrl}${path}`);
        if (response.status !== 200) throw new Error(`${path} returned ${response.status}`);
      }
    });

    await check('every page of the root site links back to home and demos', async () => {
      const { text } = await fetchText(`${baseUrl}/writing/`);
      if (!/href="\/"/.test(text)) throw new Error('/writing/ has no link back to the home page');
      if (!/href="\/demos\/"/.test(text)) throw new Error('/writing/ has no nav link to /demos/');
    });

    await check('every demo app links back to the home page', async () => {
      for (const app of apps.filter((a) => a.path !== '/' && !a.path.startsWith('http'))) {
        const { text } = await fetchText(`${baseUrl}${app.path}`);
        if (!/href=["']\/["']/.test(text)) {
          throw new Error(`${app.path} HTML has no href="/" link back to the home page`);
        }
      }
    });

    await check('POST /api/strava/token without code returns 4xx JSON', async () => {
      const response = await fetch(`${baseUrl}/api/strava/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (response.status < 400 || response.status >= 500) {
        throw new Error(`expected 4xx, got ${response.status}`);
      }
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) throw new Error(`expected JSON, got ${contentType}`);
      const data = await response.json();
      if (!data.error) throw new Error(`expected { error }, got ${JSON.stringify(data)}`);
    });

    await check('POST /api/isochrones with invalid body returns 400 with a validation message', async () => {
      const response = await fetch(`${baseUrl}/api/isochrones`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (response.status !== 400) throw new Error(`expected 400, got ${response.status}`);
      const data = await response.json();
      if (!data.error || typeof data.error !== 'string') throw new Error(`expected a validation message, got ${JSON.stringify(data)}`);
    });

  } finally {
    if (startedOwnGateway) stopGateway();
  }

  console.log(`\n[smoke] ${passes.length} passed, ${failures.length} failed`);
  if (failures.length > 0) {
    console.error('\n[smoke] FAILURES:');
    for (const failure of failures) {
      console.error(`  - ${failure.name}`);
      if (failure.detail) console.error(`    ${failure.detail.split('\n').join('\n    ')}`);
    }
    process.exitCode = 1;
  }
}

main().catch((err) => {
  stopGateway();
  console.error('[smoke] unexpected error:', err);
  process.exitCode = 1;
});
