// gateway/lib/staticFiles.js
//
// Static file serving helpers: MIME lookup, cache-control policy, security
// headers, and a path-traversal-safe resolver.

import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { createGzip, createBrotliCompress, gzipSync, brotliCompressSync, constants as zlibConstants } from 'node:zlib';

export const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.avif', 'image/avif'],
  ['.ico', 'image/x-icon'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.ttf', 'font/ttf'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.xml', 'application/xml; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json'],
]);

export function mimeTypeFor(filePath) {
  return MIME_TYPES.get(extname(filePath).toLowerCase()) || 'application/octet-stream';
}

// Vite/Rollup and most bundlers embed a content hash directly in the
// filename, e.g. `index-D3xK9f2a.js`, `strava-explorer-gMKfxHCm.jpg`,
// `dist-D-g5X-d9.js` (real filenames Vite produced for this repo's apps).
// The segment right before the extension is treated as a hash if it's
// 6-14 chars from the filename-safe alphabet AND contains an uppercase
// letter: Vite/Rollup hashes are case-sensitive pseudo-random output, so an
// uppercase letter shows up in all but a vanishingly small fraction of real
// hashes, while ordinary hand-written lowercase names (`strava-explorer.jpg`,
// `not-found.html`, `bundle.js`) never trip it.
const HASHED_SEGMENT_PATTERN = /[.-]([A-Za-z0-9_-]{6,14})\.[a-z0-9]+$/i;

export function cacheControlFor(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (ext === '.html') {
    return 'no-cache';
  }
  const match = HASHED_SEGMENT_PATTERN.exec(filePath);
  if (match && /[A-Z]/.test(match[1])) {
    return 'public, max-age=31536000, immutable';
  }
  return 'public, max-age=3600';
}

export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // frame-ancestors in the CSP below supersedes this for browsers that
  // support it; kept for older browsers that don't.
  'X-Frame-Options': 'SAMEORIGIN',
  // The service only ever runs behind Cloud Run's TLS termination (and
  // local dev is plain HTTP on localhost, which browsers exempt from HSTS
  // upgrade-loop issues), so this is safe to send unconditionally.
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

// ---------------------------------------------------------------------------
// Content-Security-Policy
//
// Two policies, because one origin serves two different trust profiles:
//  - the portfolio (and every plain static app): a small, known
//    third-party surface — Google Analytics (googletagmanager.com,
//    google-analytics.com) and giscus comments (giscus.app) — so a tight
//    default-src 'self' policy fits.
//  - the three Google Maps Platform demos (strava-explorer, aqi-map,
//    isochrones, tagged "google-maps-platform" in apps.json): the Maps JS
//    API loader injects scripts, blob: workers, and tile/image requests
//    across the broad set of Google subdomains that Google's own CSP guide
//    enumerates (developers.google.com/maps/documentation/javascript/
//    content-security-policy). Locking those down to the portfolio's
//    policy would break the demos, so they get Google's documented
//    allowlist CSP instead — a per-app relaxation rather than a site-wide
//    one, since the risk (Google's own domains, and 'unsafe-eval' which
//    the loader needs) is scoped to the pages that need it.
//
// Both policies allow 'unsafe-inline' for script-src and style-src: the
// portfolio build inlines a theme-toggle script, an analytics bootstrap
// script, a giscus mount script, and a <style> block directly into static
// HTML served by a separate process from the build. There's no per-request
// nonce plumbing between the two, and wiring one up would mean a large
// refactor of the build pipeline — accepted as a known limitation rather
// than attempted here.
const CSP_DEFAULT = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://giscus.app",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://www.google-analytics.com",
  "connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com",
  "frame-src https://giscus.app",
  "font-src 'self'",
].join('; ');

const CSP_MAPS_DEMO = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.ggpht.com https://*.googleusercontent.com blob:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.googleusercontent.com",
  "connect-src 'self' https://*.googleapis.com https://*.google.com https://*.gstatic.com data: blob:",
  "worker-src 'self' blob:",
  "frame-src https://*.google.com",
  "font-src 'self' https://fonts.gstatic.com",
].join('; ');

export const CSP_POLICIES = Object.freeze({ default: CSP_DEFAULT, mapsDemo: CSP_MAPS_DEMO });

export function applySecurityHeaders(response, { csp = CSP_DEFAULT } = {}) {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.setHeader(key, value);
  }
  // A caller that needs to send its own CSP (the Strava photo-proxy binary
  // response sets `Content-Security-Policy: sandbox`) can still do so: Node
  // gives explicit writeHead() headers precedence over setHeader() values
  // for duplicate names, so setting a default here first is safe.
  response.setHeader('Content-Security-Policy', csp);
}

// ---------------------------------------------------------------------------
// Compression: brotli/gzip only (node:zlib, zero deps). Images, fonts, and
// other already-compressed formats are deliberately excluded — compressing
// them wastes CPU and rarely shrinks the body.
// ---------------------------------------------------------------------------

const COMPRESSIBLE_EXTENSIONS = new Set([
  '.html', '.js', '.mjs', '.css', '.json', '.map', '.svg', '.xml', '.txt', '.webmanifest',
]);

// Compressing a body smaller than this rarely pays for the CPU spent; gzip/
// brotli framing overhead can even make tiny bodies bigger.
const MIN_COMPRESSIBLE_BYTES = 1024;

export function isCompressibleType(filePath) {
  return COMPRESSIBLE_EXTENSIONS.has(extname(filePath).toLowerCase());
}

// Prefer brotli when the client offers it, else gzip, else no compression.
// This is a simple substring/word-boundary check, not full Accept-Encoding
// q-value parsing — good enough for a portfolio gateway with two candidate
// encodings.
export function pickEncoding(acceptEncodingHeader) {
  const header = String(acceptEncodingHeader || '').toLowerCase();
  if (/\bbr\b/.test(header)) return 'br';
  if (/\bgzip\b/.test(header)) return 'gzip';
  return null;
}

function compressionTransformFor(encoding) {
  if (encoding === 'br') {
    // Quality 5 (of 0-11): a good speed/ratio tradeoff for on-the-fly
    // compression under load; quality 11 (the brotli default) is far too
    // slow for a per-request transform.
    return createBrotliCompress({ params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 5 } });
  }
  if (encoding === 'gzip') return createGzip({ level: 6 });
  return null;
}

export function compressBuffer(buffer, encoding) {
  if (encoding === 'br') {
    return brotliCompressSync(buffer, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 5 } });
  }
  if (encoding === 'gzip') return gzipSync(buffer, { level: 6 });
  return buffer;
}

/**
 * Write a small in-memory response body (gateway-generated HTML/JSON, not a
 * static file), compressing it when the client's Accept-Encoding allows it
 * and the body is large enough to be worth compressing. Always sets `Vary:
 * Accept-Encoding` so caches don't serve the wrong encoding to the wrong
 * client.
 */
export function sendCompressibleBody(request, response, statusCode, headers, body) {
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(String(body), 'utf8');
  const finalHeaders = { ...headers, Vary: 'Accept-Encoding' };
  const encoding = buffer.length >= MIN_COMPRESSIBLE_BYTES
    ? pickEncoding(request?.headers?.['accept-encoding'])
    : null;

  if (encoding) {
    finalHeaders['Content-Encoding'] = encoding;
    response.writeHead(statusCode, finalHeaders);
    response.end(compressBuffer(buffer, encoding));
    return;
  }

  finalHeaders['Content-Length'] = buffer.length;
  response.writeHead(statusCode, finalHeaders);
  response.end(buffer);
}

// ---------------------------------------------------------------------------
// Conditional requests (ETag / Last-Modified) for static files only —
// gateway-generated dynamic responses never get one.
// ---------------------------------------------------------------------------

// Cheap weak ETag: content identity is size + mtime, not a real hash. Good
// enough to catch the common case (unchanged file) without reading the file.
function computeEtag(stat) {
  return `W/"${stat.size}-${Math.floor(stat.mtimeMs)}"`;
}

function requestIsNotModified(request, etag, lastModified) {
  const headers = request?.headers || {};
  const ifNoneMatch = headers['if-none-match'];
  if (ifNoneMatch !== undefined) {
    return ifNoneMatch.split(',').map((tag) => tag.trim()).includes(etag);
  }
  const ifModifiedSince = headers['if-modified-since'];
  if (ifModifiedSince) {
    const since = Date.parse(ifModifiedSince);
    // If-Modified-Since has 1-second resolution; truncate both sides.
    if (!Number.isNaN(since)) {
      return Math.floor(lastModified.getTime() / 1000) <= Math.floor(since / 1000);
    }
  }
  return false;
}

/**
 * Shared response-writer for a static file already resolved to a `filePath`
 * + `stat`: sets caching/conditional-request headers, handles 304s, and
 * compresses compressible types when the client allows it and the file is
 * big enough to bother.
 */
function sendStaticFile(filePath, stat, request, response, statusCode, { cacheControl, extraHeaders = {}, csp }) {
  applySecurityHeaders(response, { csp });

  const compressible = isCompressibleType(filePath);
  const etag = computeEtag(stat);
  const headers = {
    'Content-Type': mimeTypeFor(filePath),
    'Cache-Control': cacheControl,
    'Last-Modified': stat.mtime.toUTCString(),
    ETag: etag,
    ...extraHeaders,
  };
  if (compressible) headers.Vary = 'Accept-Encoding';

  if (requestIsNotModified(request, etag, stat.mtime)) {
    response.writeHead(304, headers);
    response.end();
    return true;
  }

  const encoding = compressible && stat.size >= MIN_COMPRESSIBLE_BYTES
    ? pickEncoding(request?.headers?.['accept-encoding'])
    : null;

  if (encoding) {
    headers['Content-Encoding'] = encoding;
    response.writeHead(statusCode, headers);
    createReadStream(filePath).pipe(compressionTransformFor(encoding)).pipe(response);
    return true;
  }

  headers['Content-Length'] = stat.size;
  response.writeHead(statusCode, headers);
  createReadStream(filePath).pipe(response);
  return true;
}

/**
 * Resolve `subPath` inside `baseDir`, refusing anything that would escape
 * `baseDir` (path traversal via `..` or an absolute path). Note this is a
 * lexical check on the resolved path string, not a symlink-safe jail:
 * `resolve()` does not follow or validate symlinks. That's an accepted
 * tradeoff here because `baseDir` only ever contains our own build output
 * (never user-uploaded content), so no symlink can point outside it.
 * Returns null if the resolved path escapes baseDir.
 */
export function safeResolve(baseDir, subPath) {
  const base = resolve(baseDir);
  const target = resolve(base, `.${sep}${subPath.replace(/^\/+/, '')}`);
  if (target !== base && !target.startsWith(base + sep)) {
    return null;
  }
  return target;
}

/**
 * Serve a static file (or that directory's index.html) from baseDir for the
 * given request subPath. Returns true if a response was sent, false if the
 * caller should fall through (e.g. to a 404 handler).
 */
export function serveFromDir(baseDir, subPath, request, response, options = {}) {
  let filePath = safeResolve(baseDir, subPath || '/');
  if (!filePath) {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Bad request path.');
    return true;
  }

  if (!existsSync(filePath)) {
    return false;
  }

  let stat = statSync(filePath);
  if (stat.isDirectory()) {
    filePath = join(filePath, 'index.html');
    if (!existsSync(filePath)) return false;
    stat = statSync(filePath);
  }

  return sendStaticFile(filePath, stat, request, response, 200, {
    cacheControl: options.private ? 'private, no-store' : cacheControlFor(filePath),
    extraHeaders: options.private ? { 'X-Robots-Tag': 'noindex, nofollow, noarchive' } : {},
    csp: options.csp,
  });
}

/**
 * Serve a single known file (an exact path, not resolved against a request
 * subPath) at an explicit status code. Used for serving the portfolio
 * build's static `404.html` with a 404 status rather than the 200 that
 * `serveFromDir` always sends. Returns true if a response was sent, false
 * if the caller should fall through (file missing or is a directory).
 */
export function serveFileWithStatus(filePath, request, response, statusCode, options = {}) {
  if (!existsSync(filePath)) return false;
  const stat = statSync(filePath);
  if (stat.isDirectory()) return false;

  return sendStaticFile(filePath, stat, request, response, statusCode, {
    cacheControl: options.cacheControl || 'no-store',
    csp: options.csp,
  });
}
