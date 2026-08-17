#!/usr/bin/env node
// gateway/server.js
//
// Zero-npm-dependency Node ES-module server that is the single entry point
// for the Ryan Baumann portfolio container: it serves the site at the root
// path, every demo app's static build under its own path, and brokers all
// secret-bearing API calls same-origin under /api/*. See
// docs/ARCHITECTURE.md for the full picture.

import { createServer } from 'node:http';
import { join } from 'node:path';

import { loadApps, toPublicApp, appVisibility } from './lib/apps.js';
import { applySecurityHeaders, serveFromDir, serveFileWithStatus, sendCompressibleBody, cspForApp } from './lib/staticFiles.js';
import {
  createDailyRateLimiter,
  createRateLimiter,
  clientIp,
  RATE_LIMIT_POLICIES,
  rateLimitPolicyForPath,
  geminiRateLimiter,
  extractGeminiTokenUsage,
} from './lib/rateLimit.js';
import { resolveProvider } from './lib/config.js';
import {
  verifyAuthCookie,
  loginPageHtml,
  handleAuthRequest,
} from './lib/auth.js';
import { handleStravaApi } from './lib/strava.js';
import { handleIsochronesApi } from './lib/isochrones.js';
import { handleHairstyleAiApi, validateHairstyleApiKey } from './lib/hairstyleAi.js';
import { handleInfographicAgentApi, validateInfographicApiKey } from './lib/infographicAgent.js';
import {
  createRealWorldReasoningHandler,
} from './lib/realWorldReasoning.js';
import { publishWritingUpdate, requestWritingReview, saveWritingDraft } from './lib/writer.js';
import { stageWriterSocialDraft } from './lib/buffer.js';
import { beginGoogleLogin, finishGoogleLogin, googleLoginPage, hasGoogleSession } from './lib/googleAuth.js';
import { classifyContactSubmission } from './lib/contactSpam.js';
import { errorPageHtml } from './lib/errorPage.js';
import { proxyUpstream } from './lib/upstream.js';

const PORT = Number(process.env.PORT || 8080);
const JSON_BODY_LIMIT_BYTES = 16 * 1024;
const FORM_BODY_LIMIT_BYTES = 32 * 1024;
const CANONICAL_SITE_ORIGIN = 'https://ryanbaumann.dev';
const REDIRECT_SITE_HOSTS = new Set([
  'www.ryanbaumann.dev',
  'ryanbaumann-portfolio.com',
  'www.ryanbaumann-portfolio.com',
]);
const CONTACT_INTENTS = Object.freeze([
  'Developer platform discussion',
  'Content collaboration',
  'Speaking opportunity',
  'Other',
]);

const { apps } = loadApps(process.env);
// Only public-visibility apps appear in /api/apps and /healthz.
// toPublicApp returns null for unlisted/private apps.
const publicApps = apps.map(toPublicApp).filter(Boolean);

// Most-specific path first, so the root-mounted portfolio ("/") acts as the
// catch-all only after every demo app path has had its chance to match.
const appsByPathLength = [...apps].sort((a, b) => b.path.length - a.path.length);

// Token/refresh/deauthorize and isochrones are all low-volume,
// one-request-per-user-action calls, so a shared conservative bucket is
// fine. The photo proxy is different: a single Strava tour can render
// dozens of photo billboards, each firing its own GET, so it gets its own
// more generous limiter to avoid 429s on ordinary page loads.
const routeRateLimiters = Object.fromEntries(
  Object.entries(RATE_LIMIT_POLICIES).map(([name, policy]) => [name, createRateLimiter(policy)]),
);

// Route-aware rate limiter for private-demo auth attempts.
// Deliberately tight (5 attempts/min per IP) to discourage brute-force.
//
// CLOUD RUN SINGLE-INSTANCE TRADEOFF:
// These in-memory rate limiters only track counts within the current process,
// so they are correct only while the service runs as a single instance.
// That is not Cloud Run's default (which is max-instances=100) — it is
// pinned explicitly by `--max-instances 1` in .github/workflows/deploy.yml.
// Raising that cap silently converts every limit below into a per-instance
// limit an attacker can round-robin across, so it must not be changed
// without replacing these with a shared store.  For distributed rate
// limiting consider:
//   - Google Cloud Armor rate-limiting policies (Layer 7, no code change)
//   - Redis or Memorystore counters (requires a dependency)
//   - Firestore increment-based counters (serverless, but adds latency)
// For a portfolio site the single-instance limiter is the right trade-off.
const authRateLimiter = routeRateLimiters.auth;
const upstreamRateLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });
const hairstyleFreeRateLimiter = createDailyRateLimiter({ max: 5 });
const hairstyleGlobalFreeRateLimiter = createDailyRateLimiter({ max: 100 });
const infographicFreeRateLimiter = createDailyRateLimiter({ max: 5 });
const infographicGlobalFreeRateLimiter = createDailyRateLimiter({ max: 100 });
const handleRealWorldReasoningApi = createRealWorldReasoningHandler();

function sendJson(request, response, statusCode, payload) {
  applySecurityHeaders(response);
  sendCompressibleBody(request, response, statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  }, JSON.stringify(payload));
}

function sendRaw(request, response, statusCode, body, contentType) {
  applySecurityHeaders(response);
  sendCompressibleBody(request, response, statusCode, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
  }, body);
}


function readTextBody(request, limitBytes = FORM_BODY_LIMIT_BYTES) {
  return new Promise((resolve, reject) => {
    let body = '';
    let bytesRead = 0;
    request.on('data', (chunk) => {
      bytesRead += chunk.length;
      if (bytesRead > limitBytes) {
        reject(Object.assign(new Error('Payload too large'), { statusCode: 413 }));
        request.destroy();
        return;
      }
      body += chunk;
    });
    request.on('end', () => {
      if (bytesRead <= limitBytes) resolve(body);
    });
    request.on('error', reject);
  });
}

function sendHtml(request, response, statusCode, body) {
  applySecurityHeaders(response);
  sendCompressibleBody(request, response, statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  }, body);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formResponsePage(title, message, statusCode = 200, { backHref = '/contact/', backLabel = 'Contact' } = {}) {
  const delivered = statusCode >= 200 && statusCode < 300;
  const deliveryState = delivered ? 'success' : 'failure';
  const liveRole = delivered ? 'status' : 'alert';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="contact-delivery" content="${deliveryState}"><title>${escapeHtml(title)}</title><style>body{font-family:system-ui,sans-serif;max-width:42rem;margin:4rem auto;padding:0 1.25rem;line-height:1.6;color:#111827;background:#faf9f6}a{color:inherit}</style></head><body><header><nav aria-label="${escapeHtml(backLabel)}"><a href="${escapeHtml(backHref)}">← ${escapeHtml(backLabel)}</a></nav></header><main data-contact-delivery="${deliveryState}"><h1>${escapeHtml(title)}</h1><p role="${liveRole}" aria-live="${delivered ? 'polite' : 'assertive'}">${escapeHtml(message)}</p></main></body></html>`;
}

const contactResponsePage = (title, message, statusCode = 200) => formResponsePage(title, message, statusCode);
const subscribeResponsePage = (title, message, statusCode = 200) => formResponsePage(title, message, statusCode, { backHref: '/writing/', backLabel: 'Notes' });

// POST /api/subscribe — add an email address to the Resend global Contacts
// model, the internal Field Notes segment, and its user-facing Topic. Sends
// are composed and scheduled from the Resend dashboard.
// Same anti-bot posture as the contact form: honeypot field + rate limit.
// Repeat submissions re-opt the address into the Field Notes topic and
// segment. They deliberately do NOT touch the contact's global `unsubscribed`
// flag: a 409 only means "this email already exists in Resend," not "this
// person wants back in" — Resend gives no signal either way — so forcing it
// to false would let anyone who knows an address silently re-subscribe
// someone who previously unsubscribed. Someone who never unsubscribed stays
// subscribed either way; someone who did stays unsubscribed until they
// opt in again themselves.
async function handleSubscribeRequest(request, response) {
  if (request.method !== 'POST') {
    sendJson(request, response, 405, { error: 'Method not allowed' });
    return;
  }

  let rawBody;
  try {
    rawBody = await readTextBody(request);
  } catch (err) {
    sendHtml(request, response, err.statusCode || 400, subscribeResponsePage('Not subscribed', err.message, err.statusCode || 400));
    return;
  }

  const contentType = request.headers['content-type'] || '';
  const params = contentType.includes('application/x-www-form-urlencoded')
    ? new URLSearchParams(rawBody)
    : new URLSearchParams();
  const email = String(params.get('email') || '').trim().slice(0, 200);
  const honeypot = String(params.get('company_fax_number') || '').trim();

  if (!email || !email.includes('@') || email.startsWith('@') || email.endsWith('@')) {
    sendHtml(request, response, 400, subscribeResponsePage('Not subscribed', 'Please enter a valid email address.', 400));
    return;
  }

  if (honeypot) {
    // Bots get the same success redirect as humans, without touching the list.
    applySecurityHeaders(response);
    response.writeHead(303, { Location: '/subscribed/', 'Cache-Control': 'no-store' });
    response.end();
    return;
  }

  const { apiKey: resendApiKey, segmentId, topicId } = resolveProvider('resend', process.env);
  if (!resendApiKey || !segmentId || !topicId) {
    sendHtml(request, response, 503, subscribeResponsePage('Subscriptions are not configured yet', 'The backend route is live, but RESEND_API_KEY, RESEND_SEGMENT_ID, and RESEND_TOPIC_ID must be set before it can store subscribers.', 503));
    return;
  }

  let upstream;
  try {
    upstream = await fetch('https://api.resend.com/contacts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        unsubscribed: false,
        segments: [{ id: segmentId }],
        topics: [{ id: topicId, subscription: 'opt_in' }],
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (upstream.status === 409) {
      const encodedEmail = encodeURIComponent(email);
      const providerHeaders = {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      };
      // No PATCH to /contacts/<email> here: that's the call that used to
      // force `unsubscribed: false`. Opting into the topic and segment is
      // enough for a genuine returning subscriber; the contact's own
      // unsubscribed flag is left exactly as Resend already has it.
      const [topicUpdate, segmentUpdate] = await Promise.all([
        fetch(`https://api.resend.com/contacts/${encodedEmail}/topics`, {
          method: 'PATCH',
          headers: providerHeaders,
          body: JSON.stringify([{ id: topicId, subscription: 'opt_in' }]),
          signal: AbortSignal.timeout(10_000),
        }),
        fetch(`https://api.resend.com/contacts/${encodedEmail}/segments/${encodeURIComponent(segmentId)}`, {
          method: 'POST',
          headers: providerHeaders,
          signal: AbortSignal.timeout(10_000),
        }),
      ]);
      const segmentAccepted = segmentUpdate.ok || segmentUpdate.status === 409;
      upstream = { ok: topicUpdate.ok && segmentAccepted, status: topicUpdate.status };
    }
  } catch {
    sendHtml(request, response, 502, subscribeResponsePage('Not subscribed', 'The mail provider could not be reached. Please try again later.', 502));
    return;
  }

  if (!upstream.ok) {
    sendHtml(request, response, 502, subscribeResponsePage('Not subscribed', 'The mail provider did not accept the address. Please try again later.', 502));
    return;
  }

  applySecurityHeaders(response);
  response.writeHead(303, { Location: '/subscribed/?ok=1', 'Cache-Control': 'no-store' });
  response.end();
}

async function handleContactRequest(request, response) {
  if (request.method !== 'POST') {
    sendJson(request, response, 405, { error: 'Method not allowed' });
    return;
  }

  let rawBody;
  try {
    rawBody = await readTextBody(request);
  } catch (err) {
    sendHtml(request, response, err.statusCode || 400, contactResponsePage('Message not sent', err.message, err.statusCode || 400));
    return;
  }

  const contentType = request.headers['content-type'] || '';
  const params = contentType.includes('application/x-www-form-urlencoded')
    ? new URLSearchParams(rawBody)
    : new URLSearchParams();
  const name = String(params.get('name') || '').trim().slice(0, 120);
  const email = String(params.get('email') || '').trim().slice(0, 200);
  const message = String(params.get('message') || '').trim().slice(0, 5000);
  const intent = String(params.get('intent') || '').trim();
  const humanConfirmed = params.get('human') === '1';
  const honeypot = String(params.get('company_fax_number') || '').trim();

  if (!name || !email || !message || !email.includes('@') || message.length < 20) {
    sendHtml(request, response, 400, contactResponsePage('Message not sent', 'Please include your name, a valid email, and a message with at least 20 characters.', 400));
    return;
  }

  if (!CONTACT_INTENTS.includes(intent)) {
    sendHtml(request, response, 400, contactResponsePage('Message not sent', 'Please choose one of the available conversation types.', 400));
    return;
  }

  if (!humanConfirmed) {
    sendHtml(request, response, 400, contactResponsePage('Message not sent', 'Please confirm that you are a person before sending your note.', 400));
    return;
  }

  const { apiKey: geminiApiKey } = resolveProvider('gemini', process.env);
  const classification = honeypot
    ? { decision: 'reject', category: 'advertising', confidence: 1, source: 'honeypot' }
    : await classifyContactSubmission({ intent, message, geminiApiKey });

  if (classification.decision === 'reject') {
    // Give automated senders a neutral success response without recording a
    // delivered lead. Only provider-confirmed mail receives delivered=1.
    applySecurityHeaders(response);
    response.writeHead(303, {
      Location: '/contact-success/',
      'Cache-Control': 'no-store',
    });
    response.end();
    return;
  }

  const { apiKey: resendApiKey, toEmail, fromEmail: configuredFromEmail } = resolveProvider('resend', process.env);
  const fromEmail = configuredFromEmail || 'Portfolio Contact <onboarding@resend.dev>';
  if (!resendApiKey || !toEmail) {
    sendHtml(request, response, 503, contactResponsePage('Contact form is not configured yet', 'The backend route is live, but RESEND_API_KEY and CONTACT_TO_EMAIL must be set before it can deliver messages.', 503));
    return;
  }

  let upstream;
  try {
    upstream = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        reply_to: email,
        subject: `${classification.decision === 'review' ? '[Likely advertising] ' : ''}[${intent}] Portfolio contact from ${name}`,
        text: `Intent: ${intent}\nName: ${name}\nEmail: ${email}\n\n${message}`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    sendHtml(request, response, 502, contactResponsePage('Message not sent', 'The mail provider could not be reached. Please try again later.', 502));
    return;
  }

  if (!upstream.ok) {
    sendHtml(request, response, 502, contactResponsePage('Message not sent', 'The mail provider did not accept the message. Please try again later.', 502));
    return;
  }

  applySecurityHeaders(response);
  response.writeHead(303, {
    Location: '/contact-success/?delivered=1',
    'Cache-Control': 'no-store',
  });
  response.end();
}

// Shared plumbing for the writer form endpoints (publish/save/review/social):
// POST-only, authenticated writer session, same-origin form, urlencoded body,
// then a 303 redirect back to /writer/ with the action's query string.
// `allowPasswordCookie` exists because publish predates the Google login and
// still honors the password-cookie session when the app is configured for it.
async function handleWriterFormRequest(request, response, { allowPasswordCookie = false } = {}, action) {
  if (request.method !== 'POST') return sendJson(request, response, 405, { error: 'Method not allowed' });
  const writerApp = appsByPathLength.find((app) => app.name === 'fieldwork-writer');
  const authenticated = allowPasswordCookie && writerApp?.auth?.type !== 'google-oauth'
    ? writerApp?.auth?.envVar && verifyAuthCookie(request, writerApp.name, process.env[writerApp.auth.envVar])
    : hasGoogleSession(request);
  if (!writerApp || !authenticated) return sendJson(request, response, 401, { error: 'Writer authentication required.' });
  try {
    const origin = new URL(String(request.headers.origin || ''));
    if (origin.host !== request.headers.host) throw new Error('origin mismatch');
  } catch {
    sendJson(request, response, 403, { error: 'Invalid request origin.' });
    return;
  }
  try {
    const params = new URLSearchParams(await readTextBody(request));
    const query = await action(params);
    applySecurityHeaders(response);
    response.writeHead(303, { Location: `/writer/?${query}`, 'Cache-Control': 'no-store' });
    response.end();
  } catch (error) {
    applySecurityHeaders(response);
    response.writeHead(303, { Location: `/writer/?error=${encodeURIComponent(error.message)}`, 'Cache-Control': 'no-store' });
    response.end();
  }
}

const handleWriterPublishRequest = (request, response) => handleWriterFormRequest(request, response, { allowPasswordCookie: true }, async (params) => {
  const result = await publishWritingUpdate({
    collection: String(params.get('collection') || ''),
    sourceSlug: String(params.get('sourceSlug') || ''),
    action: String(params.get('action') || ''),
    publishAt: String(params.get('publishAt') || ''),
  });
  return `updated=${encodeURIComponent(result.sourceSlug)}${result.mergeUrl ? `&merge=${encodeURIComponent(result.mergeUrl)}` : ''}`;
});

const handleWriterSaveRequest = (request, response) => handleWriterFormRequest(request, response, {}, async (params) => {
  const result = await saveWritingDraft({
    collection: String(params.get('collection') || ''),
    sourceSlug: String(params.get('sourceSlug') || ''),
    markdown: String(params.get('markdown') || ''),
  });
  return `saved=${encodeURIComponent(result.sourceSlug)}${result.mergeUrl ? `&merge=${encodeURIComponent(result.mergeUrl)}` : ''}`;
});

const handleWriterReviewRequest = (request, response) => handleWriterFormRequest(request, response, {}, async (params) => {
  const result = await requestWritingReview({
    collection: String(params.get('collection') || ''),
    sourceSlug: String(params.get('sourceSlug') || ''),
    comment: String(params.get('comment') || ''),
  });
  return `review=${encodeURIComponent(result.sourceSlug)}&issue=${encodeURIComponent(result.issueUrl)}`;
});

const handleWriterSocialRequest = (request, response) => handleWriterFormRequest(request, response, {}, async (params) => {
  const sourceSlug = String(params.get('sourceSlug') || '');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(sourceSlug)) throw Object.assign(new Error('Invalid slug.'), { statusCode: 400 });
  const result = await stageWriterSocialDraft({
    channel: String(params.get('channel') || ''),
    text: String(params.get('text') || ''),
  });
  return `social=${encodeURIComponent(sourceSlug)}&channel=${encodeURIComponent(result.channel)}&draft=${encodeURIComponent(result.id)}&duplicate=${result.duplicate ? '1' : '0'}`;
});

function readJsonBody(request, limitBytes = JSON_BODY_LIMIT_BYTES) {
  return new Promise((resolve, reject) => {
    let body = '';
    let bytesRead = 0;
    request.on('data', (chunk) => {
      bytesRead += chunk.length;
      if (bytesRead > limitBytes) {
        reject(Object.assign(new Error('Payload too large'), { statusCode: 413 }));
        request.destroy();
        return;
      }
      body += chunk;
    });
    request.on('end', () => {
      if (bytesRead > limitBytes) return;
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(Object.assign(new Error('Invalid JSON request body.'), { statusCode: 400 }));
      }
    });
    request.on('error', reject);
  });
}

function findAppForPath(pathname) {
  return appsByPathLength.find((app) => pathname === app.path.slice(0, -1) || pathname.startsWith(app.path));
}

// Styled 404 for any static-path miss (never for /api/* — those stay JSON,
// see handleApi below). Prefers the portfolio build's own 404.html (served
// from the root app's dir, path "/", at runtime) so the branded site 404
// shows up whenever the portfolio has been built. Falls back to a minimal
// inline HTML page — for keyless dev or a portfolio build that hasn't run
// yet — so a visitor never sees a bare "Not found." text response.
function send404Page(request, response) {
  const rootApp = appsByPathLength.find((entry) => entry.path === '/');
  if (rootApp?.dir) {
    const notFoundPath = join(rootApp.dir, '404.html');
    if (serveFileWithStatus(notFoundPath, request, response, 404, { cacheControl: 'no-cache' })) return;
  }
  sendHtml(request, response, 404, errorPageHtml({
    title: 'Page not found',
    message: 'The page you were looking for does not exist.',
  }));
}

async function handleApi(request, response, pathname, searchParams) {
  const ip = clientIp(request);

  if (pathname === '/healthz' || pathname === '/api/healthz') {
    sendJson(request, response, 200, { ok: true, apps: publicApps.map((app) => app.name) });
    return;
  }

  if (pathname === '/api/apps') {
    sendJson(request, response, 200, { apps: publicApps });
    return;
  }

  // /api/photo-proxy is a compatibility alias for /api/strava/photo: the
  // strava-explorer client (and its standalone Cloud Run broker in
  // demos/strava-explorer/server/) both speak /api/photo-proxy, so the gateway
  // accepts both without requiring a client change.
  const isPhotoRoute = pathname === '/api/strava/photo' || pathname === '/api/photo-proxy';
  const isStravaRoute = pathname.startsWith('/api/strava/') || isPhotoRoute;
  const policyName = rateLimitPolicyForPath(pathname);
  if (policyName && !routeRateLimiters[policyName].check(`${policyName}:${ip}`)) {
    response.setHeader('Retry-After', String(Math.ceil(RATE_LIMIT_POLICIES[policyName].windowMs / 1000)));
    sendJson(request, response, 429, { error: 'Too many requests. Please try again later.' });
    return;
  }

  if (pathname.startsWith('/api/real-world-reasoning-agent/')) {
    applySecurityHeaders(response);
    await handleRealWorldReasoningApi({
      request,
      response,
      pathname,
      searchParams,
      env: process.env,
    });
    return;
  }

  if (pathname === '/api/contact') {
    await handleContactRequest(request, response);
    return;
  }

  if (pathname === '/api/subscribe') {
    await handleSubscribeRequest(request, response);
    return;
  }

  if (pathname === '/api/writer/publish') {
    await handleWriterPublishRequest(request, response);
    return;
  }
  if (pathname === '/api/writer/save') {
    await handleWriterSaveRequest(request, response);
    return;
  }
  if (pathname === '/api/writer/review') {
    await handleWriterReviewRequest(request, response);
    return;
  }
  if (pathname === '/api/writer/social') {
    await handleWriterSocialRequest(request, response);
    return;
  }

  if (isStravaRoute) {
    // Same-origin check as the writer form endpoints (handleWriterFormRequest):
    // the strava-explorer client served by this gateway always calls these
    // relative to its own origin (demos/strava-explorer/src/strava.js), so a
    // mismatched Origin can only mean a cross-site POST. Only checked when
    // Origin is present — browsers always send it on a POST, but non-browser
    // callers (curl, server-to-server refresh) often don't, and rejecting
    // those would break legitimate keyless-friendly API use for no security
    // gain (this never touches the photo GET route, which has no POST body
    // to forge). The standalone Cloud Run broker
    // (demos/strava-explorer/server/broker.js) is a different deployment and
    // a different file, so this check does not affect it.
    if (request.method === 'POST') {
      const originHeader = request.headers.origin;
      if (originHeader) {
        let originHost;
        try {
          originHost = new URL(originHeader).host;
        } catch {
          originHost = null;
        }
        if (originHost !== request.headers.host) {
          sendJson(request, response, 403, { error: 'Invalid request origin.' });
          return;
        }
      }
    }

    const normalizedPathname = pathname === '/api/photo-proxy' ? '/api/strava/photo' : pathname;
    let body = {};
    if (request.method === 'POST') {
      try {
        body = await readJsonBody(request);
      } catch (err) {
        sendJson(request, response, err.statusCode || 400, { error: err.message });
        return;
      }
    }
    const result = await handleStravaApi({
      pathname: normalizedPathname,
      method: request.method,
      body,
      authHeader: request.headers.authorization,
      searchParams,
    });
    if (result.binary) {
      applySecurityHeaders(response);
      response.writeHead(200, {
        'Content-Type': result.binary.contentType,
        'Content-Length': result.binary.body.byteLength,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'Content-Security-Policy': 'sandbox',
        'Access-Control-Allow-Origin': '*',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      });
      response.end(Buffer.from(result.binary.body));
      return;
    }
    sendJson(request, response, result.statusCode, result.json);
    return;
  }

  if (pathname === '/api/isochrones') {
    if (request.method !== 'POST') {
      sendJson(request, response, 405, { error: 'Method not allowed' });
      return;
    }
    let body;
    try {
      body = await readJsonBody(request);
    } catch (err) {
      sendJson(request, response, err.statusCode || 400, { error: err.message });
      return;
    }
    const result = await handleIsochronesApi(body);
    if (result.rawJson !== undefined) {
      sendRaw(request, response, result.statusCode, result.rawJson, result.contentType);
      return;
    }
    sendJson(request, response, result.statusCode, result.json);
    return;
  }

  if (pathname.startsWith('/api/hairstyle-ai-studio/')) {
    const freeTierKey = `hairstyle-free:${ip}`;
    if (pathname === '/api/hairstyle-ai-studio/quota') {
      if (request.method !== 'GET') {
        sendJson(request, response, 405, { error: 'Method not allowed' });
        return;
      }
      sendJson(request, response, 200, {
        enabled: Boolean(validateHairstyleApiKey(process.env.GEMINI_API_KEY)),
        ...hairstyleFreeRateLimiter.status(freeTierKey),
      });
      return;
    }

    if (request.method !== 'POST') {
      sendJson(request, response, 405, { error: 'Method not allowed' });
      return;
    }
    const originHeader = request.headers.origin;
    if (originHeader) {
      let originHost;
      try {
        originHost = new URL(originHeader).host;
      } catch {
        originHost = null;
      }
      if (originHost !== request.headers.host) {
        sendJson(request, response, 403, { error: 'Invalid request origin.' });
        return;
      }
    }

    const hasPersonalKeyHeader = Object.hasOwn(request.headers, 'x-gemini-api-key');
    const personalApiKey = hasPersonalKeyHeader
      ? validateHairstyleApiKey(request.headers['x-gemini-api-key'])
      : null;
    if (hasPersonalKeyHeader && !personalApiKey) {
      sendJson(request, response, 401, {
        error: 'Enter a valid Gemini API key to continue.',
        code: 'INVALID_GEMINI_KEY',
      });
      return;
    }
    if (pathname === '/api/hairstyle-ai-studio/validate-key' && !personalApiKey) {
      sendJson(request, response, 401, {
        error: 'Enter a Gemini API key to validate.',
        code: 'INVALID_GEMINI_KEY',
      });
      return;
    }
    const credentialSource = personalApiKey ? 'byok' : 'hosted';
    const apiKey = personalApiKey || validateHairstyleApiKey(process.env.GEMINI_API_KEY);
    if (!apiKey) {
      sendJson(request, response, 503, {
        error: 'The shared Gemini allowance is not configured. Add your own key to continue.',
        code: 'FREE_TIER_UNAVAILABLE',
      });
      return;
    }

    const isImageRequest = pathname === '/api/hairstyle-ai-studio/generate'
      || pathname === '/api/hairstyle-ai-studio/refine';
    const estimatedTokens = isImageRequest ? 1500 : 1000;
    let freeTierReserved = false;
    let globalFreeTierReserved = false;
    let geminiReserved = false;

    if (credentialSource === 'hosted') {
      const geminiCheck = geminiRateLimiter.consume(ip, { calls: 1, tokens: estimatedTokens });
      if (!geminiCheck.allowed) {
        response.setHeader('Retry-After', String(geminiCheck.retryAfterSeconds));
        sendJson(request, response, 429, {
          error: geminiCheck.message,
          code: geminiCheck.reason,
          retryAfter: geminiCheck.retryAfterSeconds,
        });
        return;
      }
      geminiReserved = true;
    }

    if (isImageRequest && credentialSource === 'byok') {
      const policy = RATE_LIMIT_POLICIES.hairstyleByokImage;
      if (!routeRateLimiters.hairstyleByokImage.check(`hairstyle-byok:${ip}`)) {
        response.setHeader('Retry-After', String(Math.ceil(policy.windowMs / 1000)));
        sendJson(request, response, 429, {
          error: 'Too many generation requests. Please wait a moment and try again.',
          code: 'SITE_ABUSE_LIMIT',
        });
        return;
      }
    } else if (isImageRequest) {
      freeTierReserved = hairstyleFreeRateLimiter.take(freeTierKey);
      if (!freeTierReserved) {
        if (geminiReserved) geminiRateLimiter.refund(ip, { calls: 1, tokens: estimatedTokens });
        const quota = hairstyleFreeRateLimiter.status(freeTierKey);
        response.setHeader('Retry-After', String(Math.max(1, Math.ceil((Date.parse(quota.resetAt) - Date.now()) / 1000))));
        sendJson(request, response, 429, {
          error: 'You have used today’s 5 free generations. Add your own Gemini API key to continue.',
          code: 'FREE_TIER_EXHAUSTED',
          freeTier: quota,
        });
        return;
      }
      globalFreeTierReserved = hairstyleGlobalFreeRateLimiter.take('hairstyle-global');
      if (!globalFreeTierReserved) {
        if (geminiReserved) geminiRateLimiter.refund(ip, { calls: 1, tokens: estimatedTokens });
        hairstyleFreeRateLimiter.refund(freeTierKey);
        freeTierReserved = false;
        sendJson(request, response, 429, {
          error: 'The shared daily generation budget is exhausted. Add your own Gemini API key to continue.',
          code: 'FREE_TIER_EXHAUSTED',
        });
        return;
      }
    }

    let body;
    try {
      body = await readJsonBody(request, 12 * 1024 * 1024);
    } catch (err) {
      if (geminiReserved) geminiRateLimiter.refund(ip, { calls: 1, tokens: estimatedTokens });
      if (freeTierReserved) hairstyleFreeRateLimiter.refund(freeTierKey);
      if (globalFreeTierReserved) hairstyleGlobalFreeRateLimiter.refund('hairstyle-global');
      sendJson(request, response, err.statusCode || 400, { error: err.message });
      return;
    }
    const upstreamAbort = new AbortController();
    const abortUpstream = () => upstreamAbort.abort();
    request.once('aborted', abortUpstream);
    response.once('close', () => {
      if (!response.writableEnded) abortUpstream();
    });
    const result = await handleHairstyleAiApi({
      pathname,
      method: request.method,
      body,
      apiKey,
      credentialSource,
      signal: upstreamAbort.signal,
    });
    if (geminiReserved) {
      if (result.statusCode < 200 || result.statusCode >= 300) {
        geminiRateLimiter.refund(ip, { calls: 1, tokens: estimatedTokens });
      } else {
        const actualTokens = extractGeminiTokenUsage(result.json, JSON.stringify(body || {}).length);
        if (actualTokens > estimatedTokens) {
          geminiRateLimiter.record(ip, { calls: 0, tokens: actualTokens - estimatedTokens });
        } else if (actualTokens < estimatedTokens) {
          geminiRateLimiter.refund(ip, { calls: 0, tokens: estimatedTokens - actualTokens });
        }
      }
    }
    if (freeTierReserved && (result.statusCode < 200 || result.statusCode >= 300)) {
      hairstyleFreeRateLimiter.refund(freeTierKey);
      hairstyleGlobalFreeRateLimiter.refund('hairstyle-global');
    } else if (freeTierReserved) {
      result.json.freeTier = hairstyleFreeRateLimiter.status(freeTierKey);
    }
    if (!response.destroyed && !response.writableEnded) {
      sendJson(request, response, result.statusCode, result.json);
    }
    return;
  }

  if (pathname.startsWith('/api/infographic-agent/')) {
    const freeTierKey = `infographic-free:${ip}`;
    if (pathname === '/api/infographic-agent/quota') {
      if (request.method !== 'GET') {
        sendJson(request, response, 405, { error: 'Method not allowed' });
        return;
      }
      sendJson(request, response, 200, {
        enabled: Boolean(validateInfographicApiKey(process.env.GEMINI_API_KEY)),
        ...infographicFreeRateLimiter.status(freeTierKey),
      });
      return;
    }

    if (request.method !== 'POST') {
      sendJson(request, response, 405, { error: 'Method not allowed' });
      return;
    }
    const originHeader = request.headers.origin;
    if (originHeader) {
      let originHost;
      try {
        originHost = new URL(originHeader).host;
      } catch {
        originHost = null;
      }
      if (originHost !== request.headers.host) {
        sendJson(request, response, 403, { error: 'Invalid request origin.' });
        return;
      }
    }

    const hasPersonalKeyHeader = Object.hasOwn(request.headers, 'x-gemini-api-key');
    const personalApiKey = hasPersonalKeyHeader
      ? validateInfographicApiKey(request.headers['x-gemini-api-key'])
      : null;
    if (hasPersonalKeyHeader && !personalApiKey) {
      sendJson(request, response, 401, {
        error: 'Enter a valid Gemini API key to continue.',
        code: 'INVALID_GEMINI_KEY',
      });
      return;
    }
    if (pathname === '/api/infographic-agent/validate-key' && !personalApiKey) {
      sendJson(request, response, 401, {
        error: 'Enter a Gemini API key to validate.',
        code: 'INVALID_GEMINI_KEY',
      });
      return;
    }
    const credentialSource = personalApiKey ? 'byok' : 'hosted';
    const apiKey = personalApiKey || validateInfographicApiKey(process.env.GEMINI_API_KEY);
    if (!apiKey) {
      sendJson(request, response, 503, {
        error: 'The shared Gemini allowance is not configured. Add your own key to continue.',
        code: 'FREE_TIER_UNAVAILABLE',
      });
      return;
    }

    const isImageRequest = pathname === '/api/infographic-agent/render';
    const estimatedTokens = isImageRequest ? 1500 : 1000;
    let freeTierReserved = false;
    let globalFreeTierReserved = false;
    let geminiReserved = false;

    if (credentialSource === 'hosted') {
      const geminiCheck = geminiRateLimiter.consume(ip, { calls: 1, tokens: estimatedTokens });
      if (!geminiCheck.allowed) {
        response.setHeader('Retry-After', String(geminiCheck.retryAfterSeconds));
        sendJson(request, response, 429, {
          error: geminiCheck.message,
          code: geminiCheck.reason,
          retryAfter: geminiCheck.retryAfterSeconds,
        });
        return;
      }
      geminiReserved = true;
    }

    if (isImageRequest && credentialSource === 'byok') {
      const policy = RATE_LIMIT_POLICIES.hairstyleByokImage;
      if (!routeRateLimiters.hairstyleByokImage.check(`infographic-byok:${ip}`)) {
        response.setHeader('Retry-After', String(Math.ceil(policy.windowMs / 1000)));
        sendJson(request, response, 429, {
          error: 'Too many generation requests. Please wait a moment and try again.',
          code: 'SITE_ABUSE_LIMIT',
        });
        return;
      }
    } else if (isImageRequest) {
      freeTierReserved = infographicFreeRateLimiter.take(freeTierKey);
      if (!freeTierReserved) {
        if (geminiReserved) geminiRateLimiter.refund(ip, { calls: 1, tokens: estimatedTokens });
        const quota = infographicFreeRateLimiter.status(freeTierKey);
        response.setHeader('Retry-After', String(Math.max(1, Math.ceil((Date.parse(quota.resetAt) - Date.now()) / 1000))));
        sendJson(request, response, 429, {
          error: 'You have used today’s 5 free generations. Add your own Gemini API key to continue.',
          code: 'FREE_TIER_EXHAUSTED',
          freeTier: quota,
        });
        return;
      }
      globalFreeTierReserved = infographicGlobalFreeRateLimiter.take('infographic-global');
      if (!globalFreeTierReserved) {
        if (geminiReserved) geminiRateLimiter.refund(ip, { calls: 1, tokens: estimatedTokens });
        infographicFreeRateLimiter.refund(freeTierKey);
        freeTierReserved = false;
        sendJson(request, response, 429, {
          error: 'The shared daily generation budget is exhausted. Add your own Gemini API key to continue.',
          code: 'FREE_TIER_EXHAUSTED',
        });
        return;
      }
    }

    let body;
    try {
      body = await readJsonBody(request, 12 * 1024 * 1024);
    } catch (err) {
      if (geminiReserved) geminiRateLimiter.refund(ip, { calls: 1, tokens: estimatedTokens });
      if (freeTierReserved) infographicFreeRateLimiter.refund(freeTierKey);
      if (globalFreeTierReserved) infographicGlobalFreeRateLimiter.refund('infographic-global');
      sendJson(request, response, err.statusCode || 400, { error: err.message });
      return;
    }
    const upstreamAbort = new AbortController();
    const abortUpstream = () => upstreamAbort.abort();
    request.once('aborted', abortUpstream);
    response.once('close', () => {
      if (!response.writableEnded) abortUpstream();
    });
    const result = await handleInfographicAgentApi({
      pathname,
      method: request.method,
      body,
      apiKey,
      credentialSource,
      signal: upstreamAbort.signal,
    });
    if (geminiReserved) {
      if (result.statusCode < 200 || result.statusCode >= 300) {
        geminiRateLimiter.refund(ip, { calls: 1, tokens: estimatedTokens });
      } else {
        const actualTokens = extractGeminiTokenUsage(result.json, JSON.stringify(body || {}).length);
        if (actualTokens > estimatedTokens) {
          geminiRateLimiter.record(ip, { calls: 0, tokens: actualTokens - estimatedTokens });
        } else if (actualTokens < estimatedTokens) {
          geminiRateLimiter.refund(ip, { calls: 0, tokens: estimatedTokens - actualTokens });
        }
      }
    }
    if (freeTierReserved && (result.statusCode < 200 || result.statusCode >= 300)) {
      infographicFreeRateLimiter.refund(freeTierKey);
      infographicGlobalFreeRateLimiter.refund('infographic-global');
    } else if (freeTierReserved) {
      result.json.freeTier = infographicFreeRateLimiter.status(freeTierKey);
    }
    if (!response.destroyed && !response.writableEnded) {
      sendJson(request, response, result.statusCode, result.json);
    }
    return;
  }

  const upstreamApp = apps.find((app) => app.api?.type === 'upstream' && pathname.startsWith(app.api.prefix));
  if (upstreamApp) {
    const secret = process.env[upstreamApp.auth.envVar];
    if (!secret) {
      sendJson(request, response, 503, { error: 'Private demo is not configured.' });
      return;
    }
    if (!verifyAuthCookie(request, upstreamApp.name, secret)) {
      sendJson(request, response, 401, { error: 'Private demo authentication required.' });
      return;
    }
    if (!upstreamRateLimiter.check(`${upstreamApp.name}:${ip}`)) {
      response.setHeader('Retry-After', '60');
      sendJson(request, response, 429, { error: 'Too many requests. Please try again later.' });
      return;
    }
    applySecurityHeaders(response);
    const result = await proxyUpstream({ request, response, pathname, search: searchParams.size ? `?${searchParams}` : '', app: upstreamApp });
    if (result) sendJson(request, response, result.statusCode, result.json);
    return;
  }

  sendJson(request, response, 404, { error: 'Not found' });
}

const server = createServer(async (request, response) => {
  let requestUrl;
  try {
    requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  } catch {
    sendJson(request, response, 400, { error: 'Bad request URL.' });
    return;
  }

  const { pathname, searchParams } = requestUrl;

  try {
    if (pathname === '/auth/google') {
      const location = beginGoogleLogin(request, response);
      applySecurityHeaders(response);
      response.writeHead(303, { Location: location, 'Cache-Control': 'no-store' });
      response.end();
      return;
    }
    if (pathname === '/auth/google/callback') {
      await finishGoogleLogin(request, response, searchParams);
      applySecurityHeaders(response);
      response.writeHead(303, { Location: '/writer/', 'Cache-Control': 'no-store' });
      response.end();
      return;
    }
    if (pathname === '/healthz' || pathname.startsWith('/api/')) {
      await handleApi(request, response, pathname, searchParams);
      return;
    }

    // Private-demo auth POST: /<app-path>__auth
    // Handled before the GET/HEAD method gate so that form submissions work.
    if (request.method === 'POST' && pathname.endsWith('__auth')) {
      const appPath = pathname.slice(0, -'__auth'.length);
      const app = findAppForPath(appPath);
      if (app && appVisibility(app) === 'private') {
        const ip = clientIp(request);
        await handleAuthRequest(request, response, app, process.env, applySecurityHeaders, authRateLimiter, ip);
        return;
      }
      sendJson(request, response, 404, { error: 'Not found' });
      return;
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      sendJson(request, response, 405, { error: 'Method not allowed' });
      return;
    }

    // Keep one public URL owner. The optional www host and the previous
    // portfolio domain remain mapped during the migration, but every page
    // permanently redirects to the same path and query on the apex .dev host.
    if (REDIRECT_SITE_HOSTS.has(requestUrl.hostname.toLowerCase())) {
      applySecurityHeaders(response);
      response.writeHead(308, { Location: `${CANONICAL_SITE_ORIGIN}${pathname}${requestUrl.search}` });
      response.end();
      return;
    }

    // The portfolio used to be mounted at /portfolio/; it now lives at the
    // root. Permanently redirect old links (search results, LinkedIn posts)
    // to the same page at the root path.
    if (pathname === '/portfolio' || pathname.startsWith('/portfolio/')) {
      applySecurityHeaders(response);
      // Collapse leading slashes so /portfolio//host can't become a
      // protocol-relative ("//host") open redirect.
      const target = pathname.slice('/portfolio'.length).replace(/^\/+/, '/') || '/';
      response.writeHead(308, { Location: target + requestUrl.search });
      response.end();
      return;
    }

    const app = findAppForPath(pathname);
    if (app) {
      // Redirect the trailing-slash-less form (`/aqi-map`) to the canonical
      // directory URL (`/aqi-map/`). Apps use root-relative or
      // directory-relative asset URLs that assume they're served from
      // their own "directory"; without the slash the browser resolves
      // `./bundle.js` against `/` instead of `/aqi-map/` and 404s.
      if (pathname === app.path.slice(0, -1)) {
        applySecurityHeaders(response);
        response.writeHead(308, { Location: app.path + requestUrl.search });
        response.end();
        return;
      }

      // ── Private-demo auth gate ──────────────────────────────────
      // Authorization MUST be checked before serveFromDir so that
      // static assets are never leaked to unauthenticated visitors.
      if (appVisibility(app) === 'private') {
        if (app.auth?.type === 'google-oauth') {
          if (!hasGoogleSession(request)) {
            applySecurityHeaders(response);
            response.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
            response.end(googleLoginPage());
            return;
          }
        } else {
          const secret = process.env[app.auth.envVar];
          if (!secret) {
          // Password env var not configured — refuse to serve.
          sendHtml(request, response, 503, errorPageHtml({
            title: 'Demo not available',
            message: 'This demo is not currently available.',
          }));
          return;
        }
          if (!verifyAuthCookie(request, app.name, secret)) {
          applySecurityHeaders(response);
          response.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' });
          response.end(loginPageHtml(app));
            return;
          }
        }
      }

      const redirectPath = pathname.endsWith('/') ? pathname : `${pathname}/`;
      const permanentRedirect = app.redirects?.[redirectPath];
      if (permanentRedirect) {
        applySecurityHeaders(response);
        response.writeHead(308, { Location: permanentRedirect + requestUrl.search });
        response.end();
        return;
      }

      if (!app.available) {
        sendHtml(request, response, 503, errorPageHtml({
          title: 'Demo not built',
          message: `${app.name} is not built. Run scripts/build-local.mjs first.`,
        }));
        return;
      }

      const subPath = pathname.slice(app.path.length - 1);
      const csp = cspForApp(app);
      if (serveFromDir(app.dir, subPath, request, response, { private: appVisibility(app) === 'private', csp })) return;
      send404Page(request, response);
      return;
    }

    send404Page(request, response);
  } catch (error) {
    console.error('Unhandled gateway error:', error);
    if (!response.headersSent) {
      sendJson(request, response, 500, { error: 'Internal server error' });
    } else {
      response.end();
    }
  }
});

// Never start listening under the node:test runner: a listening socket keeps
// the process alive after the tests pass, which hangs `node --test` (and hung
// CI for up to 6 hours per run before this guard). NODE_TEST_CONTEXT is set
// by the test runner itself, so this holds even when NODE_ENV is forgotten.
if (process.env.NODE_ENV !== 'test' && !process.env.NODE_TEST_CONTEXT) {
  server.listen(PORT, () => {
    console.log(`Ryan Baumann portfolio gateway listening on :${PORT}`);
    console.log(`Apps: ${publicApps.map((app) => `${app.name}${app.available ? '' : ' (unbuilt)'}`).join(', ') || '(none found in apps.json)'}`);
  });
}

export {
  server,
  apps,
  publicApps,
  appsByPathLength,
  authRateLimiter,
  routeRateLimiters,
  hairstyleFreeRateLimiter,
  hairstyleGlobalFreeRateLimiter,
  infographicFreeRateLimiter,
  infographicGlobalFreeRateLimiter,
  CONTACT_INTENTS,
};
