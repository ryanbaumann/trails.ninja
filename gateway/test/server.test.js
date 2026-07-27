import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { server, publicApps, appsByPathLength, apps } from '../server.js';
import { toPublicApp } from '../lib/apps.js';
import { CSP_POLICIES, CSP_MANIFEST_POLICIES, cspForApp } from '../lib/staticFiles.js';
import { AUTH_COOKIE_NAME, setAuthCookie } from '../lib/auth.js';

function request(port, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: 'localhost', port, path, headers }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ res, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
  });
}

function postForm(port, path, form, extraHeaders = {}) {
  const body = new URLSearchParams(form).toString();
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
        ...extraHeaders,
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ res, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.end(body);
  });
}

function postJson(port, path, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...extraHeaders,
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ res, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.end(body);
  });
}

test('server includes CORS headers on photo proxy binary response', async () => {
  server.listen(0);
  const port = server.address().port;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    return {
      ok: true,
      status: 200,
      headers: new Headers({
        'content-type': 'image/jpeg',
        'content-length': '10',
      }),
      arrayBuffer: async () => new ArrayBuffer(10),
    };
  };

  try {
    const res = await new Promise((resolve) => {
      http.get(`http://localhost:${port}/api/strava/photo?url=https://dgtzuqphqg23d.cloudfront.net/test.jpg`, resolve);
    });
    
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['access-control-allow-origin'], '*');
    assert.equal(res.headers['cross-origin-resource-policy'], 'cross-origin');
    // Regression: applySecurityHeaders() sets a default Content-Security-Policy
    // earlier in the same handler (via applySecurityHeaders(response) before
    // writeHead), but this binary response needs its own sandboxed CSP. Node
    // gives writeHead()'s own headers precedence over setHeader() for
    // duplicate names, so the sandbox value here must win, not the default.
    assert.equal(res.headers['content-security-policy'], 'sandbox');

  } finally {
    globalThis.fetch = originalFetch;
    await new Promise((resolve) => server.close(resolve));
  }
});

test('Strava token endpoints reject a mismatched Origin but allow same-origin and originless POSTs', async () => {
  const previous = { STRAVA_CLIENT_ID: process.env.STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET: process.env.STRAVA_CLIENT_SECRET };
  process.env.STRAVA_CLIENT_ID = 'test-client-id';
  process.env.STRAVA_CLIENT_SECRET = 'test-client-secret';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ access_token: 'abc' }) });
  server.listen(0);
  const port = server.address().port;

  try {
    // Cross-site: Origin present and does not match Host -> rejected.
    const crossSite = await postJson(port, '/api/strava/token', { code: 'abc' }, { Origin: 'https://evil.example' });
    assert.equal(crossSite.res.statusCode, 403);
    assert.match(crossSite.body, /Invalid request origin/);

    // Same-origin, as the strava-explorer client always calls it -> allowed.
    const sameOrigin = await postJson(port, '/api/strava/token', { code: 'abc' }, { Origin: `http://localhost:${port}` });
    assert.equal(sameOrigin.res.statusCode, 200);

    // No Origin header at all (non-browser API caller) -> allowed, not rejected.
    const noOrigin = await postJson(port, '/api/strava/refresh', { refresh_token: 'abc' });
    assert.equal(noOrigin.res.statusCode, 200);

    // The photo GET route is untouched by the origin check.
    globalThis.fetch = async () => ({
      ok: true, status: 200,
      headers: new Headers({ 'content-type': 'image/jpeg', 'content-length': '3' }),
      arrayBuffer: async () => new ArrayBuffer(3),
    });
    const photo = await new Promise((resolve) => {
      http.get({
        hostname: 'localhost', port,
        path: '/api/strava/photo?url=https://dgtzuqphqg23d.cloudfront.net/test.jpg',
        headers: { Origin: 'https://evil.example' },
      }, resolve);
    });
    assert.equal(photo.statusCode, 200);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await new Promise((resolve) => server.close(resolve));
  }
});

test('Hairstyle AI routes use the hosted key by default and never fall back from a malformed personal key', async () => {
  const originalFetch = globalThis.fetch;
  const previousGeminiKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'hosted-test-key-with-enough-characters';
  globalThis.fetch = async (_url, init) => {
    assert.ok([
      'hosted-test-key-with-enough-characters',
      'personal-test-key-with-enough-characters',
    ].includes(init.headers['x-goog-api-key']));
    return {
      ok: true,
      status: 200,
      json: async () => ({
        steps: [{
          type: 'model_output',
          content: [{ type: 'text', text: '{"recommendedStyleId":null}' }],
        }],
      }),
    };
  };
  server.listen(0);
  const port = server.address().port;
  const payload = {
    base64Image: 'data:image/jpeg;base64,YWJj',
    availableStyles: [],
  };

  try {
    const crossSite = await postJson(port, '/api/hairstyle-ai-studio/analyze', payload, {
      Origin: 'https://evil.example',
      'X-Gemini-API-Key': 'test-key-with-enough-characters',
    });
    assert.equal(crossSite.res.statusCode, 403);

    const hosted = await postJson(port, '/api/hairstyle-ai-studio/analyze', payload, {
      Origin: `http://localhost:${port}`,
    });
    assert.equal(hosted.res.statusCode, 200);

    const malformed = await postJson(port, '/api/hairstyle-ai-studio/analyze', payload, {
      Origin: `http://localhost:${port}`,
      'X-Gemini-API-Key': 'bad',
    });
    assert.equal(malformed.res.statusCode, 401);
    assert.equal(JSON.parse(malformed.body).code, 'INVALID_GEMINI_KEY');

    const personal = await postJson(port, '/api/hairstyle-ai-studio/analyze', payload, {
      Origin: `http://localhost:${port}`,
      'X-Gemini-API-Key': 'personal-test-key-with-enough-characters',
    });
    assert.equal(personal.res.statusCode, 200);
    assert.deepEqual(JSON.parse(personal.body), { recommendedStyleId: null });
  } finally {
    globalThis.fetch = originalFetch;
    if (previousGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousGeminiKey;
    await new Promise((resolve) => server.close(resolve));
  }
});

test('Hairstyle AI gives each IP five successful daily image generations while personal keys bypass that spend cap', async () => {
  const originalFetch = globalThis.fetch;
  const previousGeminiKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'hosted-test-key-with-enough-characters';
  const upstreamKeys = [];
  globalThis.fetch = async (_url, init) => {
    upstreamKeys.push(init.headers['x-goog-api-key']);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        steps: [{
          type: 'model_output',
          content: [{ type: 'image', mime_type: 'image/jpeg', data: 'ZmluYWw=' }],
        }],
      }),
    };
  };
  server.listen(0);
  const port = server.address().port;
  const origin = `http://localhost:${port}`;
  const visitorHeaders = {
    Origin: origin,
    'X-Forwarded-For': '203.0.113.177, 169.254.1.1',
  };
  const payload = {
    images: { front: 'data:image/jpeg;base64,YWJj' },
    styleDescription: 'Textured bob',
  };

  try {
    for (let index = 0; index < 5; index += 1) {
      const response = await postJson(port, '/api/hairstyle-ai-studio/generate', payload, visitorHeaders);
      assert.equal(response.res.statusCode, 200);
      assert.equal(JSON.parse(response.body).freeTier.remaining, 4 - index);
    }

    const exhausted = await postJson(port, '/api/hairstyle-ai-studio/generate', payload, visitorHeaders);
    assert.equal(exhausted.res.statusCode, 429);
    assert.equal(JSON.parse(exhausted.body).code, 'FREE_TIER_EXHAUSTED');

    const personal = await postJson(port, '/api/hairstyle-ai-studio/generate', payload, {
      ...visitorHeaders,
      'X-Gemini-API-Key': 'personal-test-key-with-enough-characters',
    });
    assert.equal(personal.res.statusCode, 200);
    assert.equal(upstreamKeys.filter((key) => key === 'hosted-test-key-with-enough-characters').length, 5);
    assert.equal(upstreamKeys.at(-1), 'personal-test-key-with-enough-characters');

    const quota = await request(port, '/api/hairstyle-ai-studio/quota', visitorHeaders);
    assert.equal(quota.res.statusCode, 200);
    assert.deepEqual(JSON.parse(quota.body), {
      enabled: true,
      limit: 5,
      remaining: 0,
      resetAt: JSON.parse(exhausted.body).freeTier.resetAt,
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (previousGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousGeminiKey;
    await new Promise((resolve) => server.close(resolve));
  }
});

test('Real World Reasoning capability preflight is mounted under its Fieldwork API namespace', async () => {
  const previous = {
    GMP_SERVER_API_KEY: process.env.GMP_SERVER_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    RWR_GROUNDING_LITE_ENABLED: process.env.RWR_GROUNDING_LITE_ENABLED,
  };
  process.env.GMP_SERVER_API_KEY = 'maps-server-test-key';
  process.env.GEMINI_API_KEY = 'gemini-server-test-key';
  process.env.RWR_GROUNDING_LITE_ENABLED = 'true';
  server.listen(0);
  const port = server.address().port;

  try {
    const response = await request(port, '/api/real-world-reasoning-agent/capabilities');
    assert.equal(response.res.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), {
      maps: true,
      gemini: true,
      groundingLite: true,
    });
    assert.match(response.res.headers['content-security-policy'], /default-src 'self'/);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await new Promise((resolve) => server.close(resolve));
  }
});

test('writer publishing requires the private writer session and same-origin form', async () => {
  const originalByPath = [...appsByPathLength];
  const originalFetch = globalThis.fetch;
  const previous = {
    PORTFOLIO_WRITER_PASSWORD: process.env.PORTFOLIO_WRITER_PASSWORD,
    GITHUB_CONTENT_TOKEN: process.env.GITHUB_CONTENT_TOKEN,
  };
  const writer = {
    name: 'fieldwork-writer', title: 'Writer', description: 'Writer', path: '/writer/',
    visibility: 'private', auth: { type: 'password', envVar: 'PORTFOLIO_WRITER_PASSWORD' },
    dir: null, available: false,
  };
  appsByPathLength.splice(0, appsByPathLength.length, writer, ...originalByPath);
  process.env.PORTFOLIO_WRITER_PASSWORD = 'writer-secret';
  process.env.GITHUB_CONTENT_TOKEN = 'github-test-token';
  const essay = `---\ntitle: Draft\nsummary: Test\ndate: 2026-07-13\ndraft: true\nnoindex: true\n---\nBody.`;
  globalThis.fetch = async (_url, options) => options.method === 'PUT'
    ? { ok: true, json: async () => ({}) }
    : { ok: true, json: async () => ({ sha: 'abc123', content: Buffer.from(essay).toString('base64') }) };
  server.listen(0);
  const port = server.address().port;
  const form = { collection: 'writing', sourceSlug: 'draft', action: 'publish-now', publishAt: '' };

  try {
    assert.equal((await postForm(port, '/api/writer/publish', form)).res.statusCode, 401);
    const cookieResponse = { setHeader(_name, value) { this.value = value; } };
    setAuthCookie(cookieResponse, 'fieldwork-writer', 'writer-secret');
    const cookie = cookieResponse.value[0].split(';', 1)[0];
    assert.equal((await postForm(port, '/api/writer/social', { sourceSlug: 'draft', channel: 'x', text: 'Draft' }, {
      Cookie: cookie,
      Origin: `http://localhost:${port}`,
    })).res.statusCode, 401);
    assert.equal((await postForm(port, '/api/writer/publish', form, { Cookie: cookie })).res.statusCode, 403);
    const result = await postForm(port, '/api/writer/publish', form, {
      Cookie: cookie,
      Origin: `http://localhost:${port}`,
    });
    assert.equal(result.res.statusCode, 303);
    assert.equal(result.res.headers.location, '/writer/?updated=draft');
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    appsByPathLength.splice(0, appsByPathLength.length, ...originalByPath);
    await new Promise((resolve) => server.close(resolve));
  }
});

test('server enforces public, unlisted, and private manifest behavior before static serving', async () => {
  const root = mkdtempSync(join(tmpdir(), 'gateway-visibility-'));
  const makeApp = (name, visibility, auth) => {
    const dir = join(root, name);
    mkdirSync(dir);
    writeFileSync(join(dir, 'index.html'), `${name} index`);
    writeFileSync(join(dir, 'asset.js'), `${name} asset`);
    return {
      name, title: name, description: name, path: `/${name}/`, visibility, auth, dir, available: true,
      redirects: name === 'public-demo' ? { '/public-demo/old/': '/public-demo/new/' } : {},
    };
  };
  const injected = [
    makeApp('public-demo', 'public'),
    makeApp('unlisted-demo', 'unlisted'),
    makeApp('private-demo', 'private', { type: 'password', envVar: 'TEST_PRIVATE_DEMO_PASSWORD' }),
  ];
  const originalByPath = [...appsByPathLength];
  const originalPublic = [...publicApps];
  const previousSecret = process.env.TEST_PRIVATE_DEMO_PASSWORD;
  process.env.TEST_PRIVATE_DEMO_PASSWORD = 'test-secret';
  appsByPathLength.splice(0, appsByPathLength.length, ...injected);
  publicApps.splice(0, publicApps.length, toPublicApp(injected[0]));
  server.listen(0);
  const port = server.address().port;

  try {
    assert.equal((await request(port, '/public-demo/')).res.statusCode, 200);
    const redirect = await request(port, '/public-demo/old/?source=essay');
    assert.equal(redirect.res.statusCode, 308);
    assert.equal(redirect.res.headers.location, '/public-demo/new/?source=essay');
    const slashlessRedirect = await request(port, '/public-demo/old?source=essay');
    assert.equal(slashlessRedirect.res.statusCode, 308);
    assert.equal(slashlessRedirect.res.headers.location, '/public-demo/new/?source=essay');
    assert.equal((await request(port, '/unlisted-demo/')).res.statusCode, 200);
    assert.equal((await request(port, '/private-demo/')).res.statusCode, 401);
    assert.equal((await request(port, '/private-demo/asset.js')).res.statusCode, 401);
    const appsResponse = await request(port, '/api/apps');
    assert.equal(appsResponse.res.statusCode, 200);
    assert.deepEqual(JSON.parse(appsResponse.body).apps.map((app) => app.name), ['public-demo']);

    const cookieResponse = { setHeader(_name, value) { this.value = value; } };
    setAuthCookie(cookieResponse, 'private-demo', 'test-secret');
    const cookie = cookieResponse.value[0].split(';', 1)[0];
    assert.ok(cookie.startsWith(`${AUTH_COOKIE_NAME}=`));
    const privateAsset = await request(port, '/private-demo/asset.js', { Cookie: cookie });
    assert.equal(privateAsset.res.statusCode, 200);
    assert.equal(privateAsset.res.headers['cache-control'], 'private, no-store');
    assert.equal(privateAsset.res.headers['x-robots-tag'], 'noindex, nofollow, noarchive');

    delete process.env.TEST_PRIVATE_DEMO_PASSWORD;
    assert.equal((await request(port, '/private-demo/')).res.statusCode, 503);
  } finally {
    if (previousSecret === undefined) delete process.env.TEST_PRIVATE_DEMO_PASSWORD;
    else process.env.TEST_PRIVATE_DEMO_PASSWORD = previousSecret;
    appsByPathLength.splice(0, appsByPathLength.length, ...originalByPath);
    publicApps.splice(0, publicApps.length, ...originalPublic);
    await new Promise((resolve) => server.close(resolve));
    rmSync(root, { recursive: true, force: true });
  }
});

test('contact delivery validates intent and marks only provider-confirmed success', async () => {
  const previousEnv = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    CONTACT_TO_EMAIL: process.env.CONTACT_TO_EMAIL,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  };
  const originalFetch = globalThis.fetch;
  const delivered = [];
  process.env.RESEND_API_KEY = 'test-resend-key';
  process.env.CONTACT_TO_EMAIL = 'ryan@example.com';
  delete process.env.GEMINI_API_KEY;
  globalThis.fetch = async (_url, options) => {
    delivered.push(JSON.parse(options.body));
    return { ok: true, status: 200 };
  };
  server.listen(0);
  const port = server.address().port;
  const valid = {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    message: 'I am building a developer platform and would like to compare notes.',
    human: '1',
  };

  try {
    const missingIntent = await postForm(port, '/api/contact', valid);
    assert.equal(missingIntent.res.statusCode, 400);
    assert.match(missingIntent.body, /data-contact-delivery="failure"/);
    assert.match(missingIntent.body, /role="alert"/);
    assert.doesNotMatch(missingIntent.body, /data-contact-delivery="success"/);

    const invalidIntent = await postForm(port, '/api/contact', { ...valid, intent: 'Executive opportunity' });
    assert.equal(invalidIntent.res.statusCode, 400);
    assert.doesNotMatch(invalidIntent.body, /data-contact-delivery="success"/);

    const invalidMessage = await postForm(port, '/api/contact', {
      ...valid,
      intent: 'Other',
      message: 'Too short',
    });
    assert.equal(invalidMessage.res.statusCode, 400);
    assert.match(invalidMessage.body, /message with at least 20 characters/);
    assert.doesNotMatch(invalidMessage.body, /data-contact-delivery="success"/);

    const success = await postForm(port, '/api/contact', {
      ...valid,
      intent: 'Developer platform discussion',
    });
    assert.equal(success.res.statusCode, 303);
    assert.equal(success.res.headers.location, '/contact-success/?delivered=1');
    assert.equal(success.body, '');
    assert.equal(delivered.length, 1);
    assert.equal(delivered[0].subject, '[Developer platform discussion] Portfolio contact from Ada Lovelace');
    assert.match(delivered[0].text, /^Intent: Developer platform discussion\nName: Ada Lovelace\nEmail: ada@example\.com\n\n/);

    const spamRegexMatch = await postForm(port, '/api/contact', {
      ...valid,
      intent: 'Other',
      message: 'Hello, I want to sell you SEO services to get you on the 1st page of google!',
    }, { 'x-forwarded-for': '1.1.1.1, proxy' });
    assert.equal(spamRegexMatch.res.statusCode, 303);
    assert.equal(spamRegexMatch.res.headers.location, '/contact-success/?delivered=1');
    assert.equal(delivered.length, 2);
    assert.match(delivered[1].subject, /^\[Likely advertising\]/);

    const spamSeoConsultingMatch = await postForm(port, '/api/contact', {
      ...valid,
      intent: 'Content collaboration',
      email: 'daniel.websolution012@gmail.com',
      message: 'We recently ran a backend analysis of your website, and the results show that several important SEO (Search Engine Optimization) steps are incomplete.',
    }, { 'x-forwarded-for': '1.1.1.2, proxy' });
    assert.equal(spamSeoConsultingMatch.res.statusCode, 303);
    assert.equal(spamSeoConsultingMatch.res.headers.location, '/contact-success/?delivered=1');
    assert.equal(delivered.length, 3);
    assert.match(delivered[2].subject, /^\[Likely advertising\]/);

    const spamDotTrickMatch = await postForm(port, '/api/contact', {
      ...valid,
      intent: 'Other',
      email: 'a.b.c.d.e@gmail.com',
      message: 'This is a normal message, but the email has too many dots for a legit sender.',
    }, { 'x-forwarded-for': '2.2.2.2, proxy' });
    assert.equal(spamDotTrickMatch.res.statusCode, 303);
    assert.equal(spamDotTrickMatch.res.headers.location, '/contact-success/?delivered=1');
    assert.equal(delivered.length, 4); // Dotted Gmail addresses are not evidence of spam.

    const missingHumanCheck = await postForm(port, '/api/contact', {
      ...valid,
      intent: 'Other',
      human: '',
    }, { 'x-forwarded-for': '2.2.2.3, proxy' });
    assert.equal(missingHumanCheck.res.statusCode, 400);
    assert.equal(delivered.length, 4);

    const honeypotMatch = await postForm(port, '/api/contact', {
      ...valid,
      intent: 'Other',
      company_fax_number: '555-0100',
    }, { 'x-forwarded-for': '2.2.2.4, proxy' });
    assert.equal(honeypotMatch.res.statusCode, 303);
    assert.equal(honeypotMatch.res.headers.location, '/contact-success/');
    assert.equal(delivered.length, 4);

    globalThis.fetch = async () => ({ ok: false, status: 500 });
    const rejected = await postForm(port, '/api/contact', {
      ...valid,
      intent: 'Speaking opportunity',
    }, { 'x-forwarded-for': '3.3.3.3, proxy' });
    assert.equal(rejected.res.statusCode, 502);
    assert.match(rejected.body, /data-contact-delivery="failure"/);
    assert.doesNotMatch(rejected.body, /data-contact-delivery="success"/);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await new Promise((resolve) => server.close(resolve));
  }
});

test('subscribe route validates email, honors the honeypot, and requires provider config', async () => {
  const previousEnv = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_SEGMENT_ID: process.env.RESEND_SEGMENT_ID,
    RESEND_TOPIC_ID: process.env.RESEND_TOPIC_ID,
  };
  const originalFetch = globalThis.fetch;
  const stored = [];
  process.env.RESEND_API_KEY = 'test-resend-key';
  process.env.RESEND_SEGMENT_ID = 'test-segment-id';
  process.env.RESEND_TOPIC_ID = 'test-topic-id';
  globalThis.fetch = async (url, options) => {
    stored.push({ url: String(url), method: options.method, body: options.body ? JSON.parse(options.body) : null });
    return { ok: true, status: 201 };
  };
  server.listen(0);
  const port = server.address().port;

  try {
    const methodNotAllowed = await request(port, '/api/subscribe');
    assert.equal(methodNotAllowed.res.statusCode, 405);

    const invalidEmail = await postForm(port, '/api/subscribe', { email: 'not-an-email' });
    assert.equal(invalidEmail.res.statusCode, 400);
    assert.match(invalidEmail.body, /valid email address/);
    assert.equal(stored.length, 0);

    const honeypotHit = await postForm(port, '/api/subscribe', {
      email: 'bot@example.com',
      company_fax_number: '555-0100',
    }, { 'x-forwarded-for': '4.4.4.1, proxy' });
    assert.equal(honeypotHit.res.statusCode, 303);
    assert.equal(honeypotHit.res.headers.location, '/subscribed/');
    assert.equal(stored.length, 0);

    const success = await postForm(port, '/api/subscribe', { email: 'ada@example.com' }, { 'x-forwarded-for': '4.4.4.2, proxy' });
    assert.equal(success.res.statusCode, 303);
    assert.equal(success.res.headers.location, '/subscribed/?ok=1');
    assert.equal(stored.length, 1);
    assert.equal(stored[0].url, 'https://api.resend.com/contacts');
    assert.deepEqual(stored[0].body, {
      email: 'ada@example.com',
      unsubscribed: false,
      segments: [{ id: 'test-segment-id' }],
      topics: [{ id: 'test-topic-id', subscription: 'opt_in' }],
    });

    const retryCalls = [];
    globalThis.fetch = async (url, options) => {
      retryCalls.push({ url: String(url), method: options.method, body: options.body ? JSON.parse(options.body) : null });
      if (retryCalls.length === 1) return { ok: false, status: 409 };
      return { ok: true, status: 200 };
    };
    const alreadySubscribed = await postForm(port, '/api/subscribe', { email: 'ada@example.com' }, { 'x-forwarded-for': '4.4.4.3, proxy' });
    assert.equal(alreadySubscribed.res.statusCode, 303);
    assert.equal(alreadySubscribed.res.headers.location, '/subscribed/?ok=1');
    // Regression: a 409 (contact already exists) must re-opt the topic and
    // segment but must NOT PATCH the contact's own `unsubscribed` flag —
    // that PATCH is what silently re-subscribed someone who had opted out.
    assert.deepEqual(retryCalls.map((call) => [call.method, call.url]), [
      ['POST', 'https://api.resend.com/contacts'],
      ['PATCH', 'https://api.resend.com/contacts/ada%40example.com/topics'],
      ['POST', 'https://api.resend.com/contacts/ada%40example.com/segments/test-segment-id'],
    ]);
    assert.ok(
      !retryCalls.some((call) => call.url === 'https://api.resend.com/contacts/ada%40example.com'),
      'must never PATCH the bare contact resource on a 409 (that is the unsubscribed:false re-opt-in call)',
    );
    // retryCalls[0] is the initial create POST, which legitimately sets
    // unsubscribed:false for a brand-new contact; only the 409 follow-up
    // calls (topics, segments) must never touch that field.
    assert.ok(
      !retryCalls.slice(1).some((call) => call.body && Object.prototype.hasOwnProperty.call(call.body, 'unsubscribed')),
      'no follow-up request on the 409 retry path may set `unsubscribed`',
    );

    globalThis.fetch = async () => ({ ok: false, status: 500 });
    const providerError = await postForm(port, '/api/subscribe', { email: 'ada@example.com' }, { 'x-forwarded-for': '4.4.4.4, proxy' });
    assert.equal(providerError.res.statusCode, 502);
    assert.match(providerError.body, /data-contact-delivery="failure"/);

    delete process.env.RESEND_TOPIC_ID;
    const keyless = await postForm(port, '/api/subscribe', { email: 'ada@example.com' }, { 'x-forwarded-for': '4.4.4.5, proxy' });
    assert.equal(keyless.res.statusCode, 503);
    assert.match(keyless.body, /RESEND_TOPIC_ID/);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await new Promise((resolve) => server.close(resolve));
  }
});

test('unknown static path serves a styled HTML 404 with a home link', async () => {
  // The portfolio app is mounted at "/", so it matches every pathname and an
  // unknown path normally 404s inside that app. In CI the portfolio isn't
  // built, which would hit the "not built" 503 branch instead — so drop the
  // root app for this test to exercise the catch-all 404 path regardless of
  // local build state.
  const originalByPath = [...appsByPathLength];
  appsByPathLength.splice(0, appsByPathLength.length, ...originalByPath.filter((app) => app.path !== '/'));
  server.listen(0);
  const port = server.address().port;

  try {
    const { res, body } = await request(port, '/this-path-should-not-exist-ever/');
    assert.equal(res.statusCode, 404);
    assert.match(res.headers['content-type'], /text\/html/);
    assert.match(body, /href="\/"/);
    assert.doesNotMatch(body, /^Not found\.$/);
  } finally {
    appsByPathLength.splice(0, appsByPathLength.length, ...originalByPath);
    await new Promise((resolve) => server.close(resolve));
  }
});

test('legacy and www site hosts permanently redirect to the canonical .dev URL', async () => {
  server.listen(0);
  const port = server.address().port;

  try {
    for (const host of ['www.ryanbaumann.dev', 'ryanbaumann-portfolio.com', 'www.ryanbaumann-portfolio.com']) {
      const { res } = await request(port, '/writing/example/?utm_source=legacy', { Host: host });
      assert.equal(res.statusCode, 308);
      assert.equal(res.headers.location, 'https://ryanbaumann.dev/writing/example/?utm_source=legacy');
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('unknown /api/ path still returns a JSON 404', async () => {
  server.listen(0);
  const port = server.address().port;

  try {
    const { res, body } = await request(port, '/api/this-route-does-not-exist');
    assert.equal(res.statusCode, 404);
    assert.match(res.headers['content-type'], /application\/json/);
    assert.deepEqual(JSON.parse(body), { error: 'Not found' });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('private app with unset password env serves a styled 503 with the unavailable message and a home link', async () => {
  const originalByPath = [...appsByPathLength];
  const envVar = 'TEST_UNSET_PRIVATE_DEMO_PASSWORD';
  const injected = {
    name: 'private-unset-demo',
    title: 'private-unset-demo',
    description: 'private-unset-demo',
    path: '/private-unset-demo/',
    visibility: 'private',
    auth: { type: 'password', envVar },
    dir: null,
    available: false,
  };
  const previousSecret = process.env[envVar];
  delete process.env[envVar];
  appsByPathLength.splice(0, appsByPathLength.length, injected, ...originalByPath);
  server.listen(0);
  const port = server.address().port;

  try {
    const { res, body } = await request(port, '/private-unset-demo/');
    assert.equal(res.statusCode, 503);
    assert.match(res.headers['content-type'], /text\/html/);
    assert.match(body, /This demo is not currently available\./);
    assert.match(body, /href="\/"/);
  } finally {
    if (previousSecret === undefined) delete process.env[envVar];
    else process.env[envVar] = previousSecret;
    appsByPathLength.splice(0, appsByPathLength.length, ...originalByPath);
    await new Promise((resolve) => server.close(resolve));
  }
});

// The gateway serves the relaxed Maps CSP based on the manifest's explicit
// `csp` field, never on the display `tags`. Someone rewriting tags for
// presentation or SEO must not be able to change a security policy as a side
// effect, and a new Maps demo that forgets the field must fail validation
// rather than ship with a CSP that blocks the Maps loader.
test('Maps CSP selection is driven by the manifest csp field, not display tags', () => {
  const manifestValues = Object.keys(CSP_MANIFEST_POLICIES);
  const mapsApps = apps.filter((app) => manifestValues.includes(app.csp));
  assert.ok(mapsApps.length >= 1, 'expected at least one app declaring a maps csp');

  // Every non-external app tagged google-maps-platform must declare the
  // field. This is the invariant scripts/validate-apps.mjs enforces; asserting
  // it here too means the gateway's own suite fails if the manifest drifts.
  const taggedMapsApps = apps.filter(
    (app) => app.tags?.includes('google-maps-platform') && !app.path.startsWith('http'),
  );
  for (const app of taggedMapsApps) {
    assert.ok(
      manifestValues.includes(app.csp),
      `${app.name} is tagged google-maps-platform but declares csp: ${JSON.stringify(app.csp)}`,
    );
  }

  // An app carrying the tag but no csp field must NOT get the Maps policy —
  // proving selection reads the field, not the tag.
  const tagOnly = { name: 'tag-only', tags: ['google-maps-platform'], path: '/tag-only/' };
  assert.equal(cspForApp(tagOnly), CSP_POLICIES.default);
});

// Regression for the deploy that followed #137: strava-explorer was served the
// plain Maps CSP, whose connect-src has no Strava origin, so the demo failed
// with "Failed to fetch activities" as soon as a visitor connected an account.
// The manifest, the policy table, and the header the gateway actually writes
// all have to agree, so this asserts the real response.
test('strava-explorer is served the Strava CSP and other demos are not', () => {
  const stravaApp = apps.find((app) => app.name === 'strava-explorer');
  assert.ok(stravaApp, 'strava-explorer missing from apps.json');
  assert.equal(stravaApp.csp, 'maps-strava');
  assert.equal(cspForApp(stravaApp), CSP_POLICIES.stravaDemo);
  assert.match(cspForApp(stravaApp), /connect-src [^;]*https:\/\/www\.strava\.com/);

  // Scoping: the relaxation is per-app, so the other Maps demos and the
  // portfolio keep policies with no Strava origin in them at all.
  for (const app of apps.filter((app) => app.name !== 'strava-explorer')) {
    assert.doesNotMatch(cspForApp(app), /strava\.com/, `${app.name} must not inherit the Strava CSP`);
  }
});

test('server sends the Strava CSP on strava-explorer static files', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'strava-csp-'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>strava</title>');
  const stravaApp = apps.find((app) => app.name === 'strava-explorer');
  const originalByPath = [...appsByPathLength];
  const originalDir = stravaApp.dir;
  const originalAvailable = stravaApp.available;

  stravaApp.dir = dir;
  stravaApp.available = true;
  if (!appsByPathLength.includes(stravaApp)) appsByPathLength.unshift(stravaApp);
  server.listen(0);
  const port = server.address().port;

  try {
    const { res } = await request(port, '/strava-explorer/index.html');
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['content-security-policy'], CSP_POLICIES.stravaDemo);
    assert.match(res.headers['content-security-policy'], /connect-src [^;]*https:\/\/www\.strava\.com/);
    // The Maps sources the demo still needs must survive the extension.
    assert.match(res.headers['content-security-policy'], /script-src [^;]*https:\/\/\*\.googleapis\.com/);
  } finally {
    stravaApp.dir = originalDir;
    stravaApp.available = originalAvailable;
    appsByPathLength.splice(0, appsByPathLength.length, ...originalByPath);
    rmSync(dir, { recursive: true, force: true });
    await new Promise((resolve) => server.close(resolve));
  }
});
