import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { safeResolve, cacheControlFor, mimeTypeFor, applySecurityHeaders, CSP_POLICIES, CSP_MANIFEST_POLICIES, cspForApp } from '../lib/staticFiles.js';

const DEMO_SRC = join(dirname(fileURLToPath(import.meta.url)), '../../demos/strava-explorer/src');

// Minimal CSP source-list matcher: enough to answer "would a browser let this
// app reach this URL under this policy", including the `https://*.host` form
// the Maps allowlist uses. Deliberately not a full CSP implementation — the
// policies here only ever use scheme-less host sources and keywords.
function cspSources(policy, directive) {
  const found = policy.split('; ').find((part) => part === directive || part.startsWith(`${directive} `));
  return found ? found.split(' ').slice(1) : [];
}

function cspAllows(policy, directive, url) {
  const { protocol, hostname } = new URL(url);
  if (protocol !== 'https:') return false;
  return cspSources(policy, directive).some((source) => {
    if (!source.startsWith('https://')) return false;
    const pattern = source.slice('https://'.length);
    // `*.example.com` matches subdomains only, never the bare apex.
    return pattern.startsWith('*.') ? hostname.endsWith(pattern.slice(1)) : hostname === pattern;
  });
}

function fakeResponse() {
  const headers = new Map();
  return {
    headers,
    setHeader(name, value) { headers.set(name.toLowerCase(), value); },
    getHeader(name) { return headers.get(name.toLowerCase()); },
  };
}

test('safeResolve refuses to escape the base directory', () => {
  assert.equal(safeResolve('/srv/app', '../../etc/passwd'), null);
  assert.equal(safeResolve('/srv/app', '/../../etc/passwd'), null);
});

test('safeResolve resolves normal subpaths inside the base directory', () => {
  assert.equal(safeResolve('/srv/app', '/assets/app.js'), '/srv/app/assets/app.js');
  assert.equal(safeResolve('/srv/app', '/'), '/srv/app');
});

test('cacheControlFor uses no-cache for HTML', () => {
  assert.equal(cacheControlFor('/srv/app/index.html'), 'no-cache');
});

test('cacheControlFor uses immutable caching for hashed asset filenames', () => {
  // Real filenames Vite produced for this repo's apps.
  assert.equal(cacheControlFor('/srv/app/assets/index-D3xK9f2a.js'), 'public, max-age=31536000, immutable');
  assert.equal(cacheControlFor('/srv/app/assets/dist-D-g5X-d9.js'), 'public, max-age=31536000, immutable');
  assert.equal(cacheControlFor('/srv/app/assets/strava-explorer-gMKfxHCm.jpg'), 'public, max-age=31536000, immutable');
});

test('cacheControlFor falls back to a conservative default for unhashed files', () => {
  assert.equal(cacheControlFor('/srv/app/bundle.js'), 'public, max-age=3600');
  // Regression: an all-lowercase hand-written filename must not be mistaken
  // for a content hash just because its final hyphenated segment is long.
  assert.equal(cacheControlFor('/srv/app/previews/strava-explorer.jpg'), 'public, max-age=3600');
  assert.equal(cacheControlFor('/srv/app/not-found.txt'), 'public, max-age=3600');
});

test('mimeTypeFor maps common extensions', () => {
  assert.equal(mimeTypeFor('a.js'), 'text/javascript; charset=utf-8');
  assert.equal(mimeTypeFor('a.css'), 'text/css; charset=utf-8');
  assert.equal(mimeTypeFor('a.unknownext'), 'application/octet-stream');
});

test('applySecurityHeaders sends a locked-down default CSP with X-Frame-Options as backup', () => {
  const response = fakeResponse();
  applySecurityHeaders(response);
  const csp = response.getHeader('content-security-policy');
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /base-uri 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'self'/);
  assert.match(csp, /googletagmanager\.com/);
  assert.match(csp, /giscus\.app/);
  // Not the Maps allowlist — the default policy should stay tight.
  assert.doesNotMatch(csp, /googleapis\.com/);
  assert.equal(response.getHeader('x-frame-options'), 'SAMEORIGIN');
});

test('applySecurityHeaders accepts the Maps demo CSP override for demo app static assets', () => {
  const response = fakeResponse();
  applySecurityHeaders(response, { csp: CSP_POLICIES.mapsDemo });
  const csp = response.getHeader('content-security-policy');
  assert.match(csp, /maps.*googleapis\.com|\*\.googleapis\.com/);
  assert.match(csp, /blob:/);
  assert.match(csp, /frame-ancestors 'self'/);
});

// ---------------------------------------------------------------------------
// strava-explorer CSP regression tests.
//
// The Maps CSP shipped in #137 has no Strava origin in connect-src, so every
// browser call in demos/strava-explorer/src/strava.js to the Strava v3 API was
// blocked and the app surfaced "Failed to fetch activities: Failed to fetch".
// Only the OAuth token exchange and the photo proxy are same-origin; the read
// paths are not. These tests derive the origins from the demo's own source so
// that adding a host there without widening the policy fails here first.

test('the strava-explorer policy allows the Strava API host the demo actually calls', () => {
  const source = readFileSync(join(DEMO_SRC, 'strava.js'), 'utf8');
  const match = source.match(/VITE_STRAVA_API_BASE_URL\s*\|\|\s*'([^']+)'/);
  assert.ok(match, 'could not find the STRAVA_API_BASE_URL default in the demo source');

  assert.ok(
    cspAllows(CSP_POLICIES.stravaDemo, 'connect-src', match[1]),
    `strava-explorer CSP connect-src must allow ${match[1]}`,
  );
  // The regression: the plain Maps policy does not, which is why the demo
  // needs its own. aqi-map and isochrones must not inherit Strava access.
  assert.ok(!cspAllows(CSP_POLICIES.mapsDemo, 'connect-src', match[1]));
  assert.ok(!cspAllows(CSP_POLICIES.default, 'connect-src', match[1]));
});

test('the strava-explorer policy allows every image host the demo loads without the proxy', () => {
  // The athlete avatar (index.js, athlete.profile_medium) is loaded straight
  // from Strava's photo CDN — only activity photos go through /api/photo-proxy.
  const photoHost = readFileSync(join(DEMO_SRC, 'photoUrl.js'), 'utf8')
    .match(/STRAVA_PHOTO_HOST\s*=\s*'([^']+)'/);
  assert.ok(photoHost, 'could not find STRAVA_PHOTO_HOST in the demo source');
  assert.ok(
    cspAllows(CSP_POLICIES.stravaDemo, 'img-src', `https://${photoHost[1]}/avatar.jpg`),
    `strava-explorer CSP img-src must allow https://${photoHost[1]}`,
  );

  // The signed-out demo tour renders placeholder photos before any auth; a
  // blocked img-src there breaks the first thing a visitor sees.
  const demoHosts = new Set(
    [...readFileSync(join(DEMO_SRC, 'demoData.js'), 'utf8').matchAll(/"(https:\/\/[^"]+)"/g)]
      .map((m) => m[1]),
  );
  assert.ok(demoHosts.size > 0, 'expected demo photo URLs in demoData.js');
  for (const url of demoHosts) {
    assert.ok(cspAllows(CSP_POLICIES.stravaDemo, 'img-src', url), `strava-explorer CSP img-src must allow ${url}`);
  }
});

test('the strava-explorer policy is the Maps policy plus additions, never a divergent copy', () => {
  // Extending by directive map (not by copying a policy string) means the
  // Strava policy cannot silently drop a Maps source or a hardening directive.
  for (const part of CSP_POLICIES.mapsDemo.split('; ')) {
    const [directive, ...sources] = part.split(' ');
    const stravaSources = cspSources(CSP_POLICIES.stravaDemo, directive);
    for (const source of sources) {
      assert.ok(stravaSources.includes(source), `strava-explorer CSP dropped ${directive} ${source}`);
    }
  }
  assert.match(CSP_POLICIES.stravaDemo, /frame-ancestors 'self'/);
  assert.match(CSP_POLICIES.stravaDemo, /object-src 'none'/);
});

test('cspForApp maps manifest values to policies and falls back to the strict default', () => {
  assert.equal(cspForApp({ csp: 'maps' }), CSP_POLICIES.mapsDemo);
  assert.equal(cspForApp({ csp: 'maps-strava' }), CSP_POLICIES.stravaDemo);
  assert.equal(cspForApp({}), CSP_POLICIES.default);
  assert.equal(cspForApp(undefined), CSP_POLICIES.default);
  // An unknown value must not inherit a relaxed policy; validate-apps.mjs
  // rejects it at build time, and the gateway degrades closed if it slips past.
  assert.equal(cspForApp({ csp: 'maps-typo' }), CSP_POLICIES.default);
  assert.deepEqual(Object.keys(CSP_MANIFEST_POLICIES), ['maps', 'maps-strava']);
});

test('applySecurityHeaders sets Content-Security-Policy via setHeader (not writeHead)', () => {
  // applySecurityHeaders only ever calls setHeader(), never writeHead(), so
  // a caller further down the same request handler (the Strava photo-proxy
  // binary response) can still pass its own Content-Security-Policy directly
  // to writeHead() and have it win — Node gives writeHead()'s own headers
  // precedence over setHeader() for duplicate names. Proven end-to-end
  // against a real server in server.test.js
  // ("server includes CORS headers on photo proxy binary response").
  const response = fakeResponse();
  applySecurityHeaders(response);
  assert.equal(response.getHeader('content-security-policy'), CSP_POLICIES.default);
});
