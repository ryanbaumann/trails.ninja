import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeResolve, cacheControlFor, mimeTypeFor, applySecurityHeaders, CSP_POLICIES } from '../lib/staticFiles.js';

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
