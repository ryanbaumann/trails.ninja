// Maps Grounding, route drawing, and Gemini are deterministic fixtures. The
// Google Maps JavaScript renderer remains live and may incur project costs, so
// every run requires an explicit operator acknowledgement.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';

const BASE = process.env.SMOKE_URL || 'http://localhost:8080';
const OUT = process.env.MISSION_SMOKE_OUT || '/tmp/atlas-mission-smoke';
if (process.env.ALLOW_LIVE_MAPS_BROWSER !== '1') {
  throw new Error('Set ALLOW_LIVE_MAPS_BROWSER=1 to acknowledge that the configured Maps JavaScript renderer may incur costs.');
}
mkdirSync(OUT, { recursive: true });
const EXEC = process.env.CHROMIUM_PATH || [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find(existsSync);
if (!EXEC) throw new Error('Chromium not found. Set CHROMIUM_PATH to an installed Chrome/Chromium executable.');

const ignored = [
  /Google Maps JavaScript API/i,
  /development purposes only/i,
  /Receiving end does not exist/i,
  /Vector Map.*Falling back to Raster/i,
  /map is initialized without a valid Map ID/i,
  /Failed to load resource.*503/i,
];
const errors = [];
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const places = [
  { id: 'browser-fixture-a', latitude: 37.797, longitude: -122.395 },
  { id: 'browser-fixture-b', latitude: 37.792, longitude: -122.401 },
  { id: 'browser-fixture-c', latitude: 37.789, longitude: -122.407 },
];
const walkMinutes = { 'browser-fixture-a': 9, 'browser-fixture-b': 13, 'browser-fixture-c': 18 };
const driveMinutes = { 'browser-fixture-a': 8, 'browser-fixture-b': 5, 'browser-fixture-c': 6 };
const source = (kind) => ({ title: `Deterministic ${kind} fixture`, url: `https://example.test/${kind}` });

function mcpResult(value) {
  return JSON.stringify({ jsonrpc: '2.0', id: 1, result: { structuredContent: value } });
}

async function installProviderFixtures(page) {
  await page.addInitScript(() => {
    let internalGoogle;
    function wrapMaps(maps) {
      if (!maps || maps._routesHooked) return;
      const originalImport = maps.importLibrary;
      if (typeof originalImport === 'function') {
        maps.importLibrary = async function(name, ...args) {
          const lib = await originalImport.call(this, name, ...args);
          if (name === 'routes' && lib?.Route) {
            lib.Route.computeRoutes = async function(request) {
              const dest = request?.destination?.placeId || request?.destination?.location;
              const mode = request?.travelMode;
              let minutes = 9;
              if (mode === 'DRIVING') {
                if (dest === 'browser-fixture-b' || (dest && typeof dest === 'object' && Math.abs(dest.lat - 37.792) < 0.001)) {
                  minutes = 5;
                } else if (dest === 'browser-fixture-c' || (dest && typeof dest === 'object' && Math.abs(dest.lat - 37.789) < 0.001)) {
                  minutes = 6;
                } else {
                  minutes = 8;
                }
              } else {
                if (dest === 'browser-fixture-b' || (dest && typeof dest === 'object' && Math.abs(dest.lat - 37.792) < 0.001)) {
                  minutes = 13;
                } else if (dest === 'browser-fixture-c' || (dest && typeof dest === 'object' && Math.abs(dest.lat - 37.789) < 0.001)) {
                  minutes = 18;
                }
              }
              return {
                routes: [{
                  distanceMeters: minutes * 75,
                  durationMillis: minutes * 60 * 1000,
                  path: [{ lat: 37.795, lng: -122.394 }, { lat: 37.797, lng: -122.395 }],
                  legs: [],
                }],
              };
            };
          }
          return lib;
        };
      }
      maps._routesHooked = true;
    }

    function attachGoogle(val) {
      if (val && typeof val === 'object') {
        let internalMaps = val.maps;
        if (internalMaps) wrapMaps(internalMaps);
        try {
          Object.defineProperty(val, 'maps', {
            configurable: true,
            get() { return internalMaps; },
            set(mapsVal) {
              internalMaps = mapsVal;
              if (mapsVal) wrapMaps(mapsVal);
            },
          });
        } catch {}
      }
      return val;
    }

    if (window.google) attachGoogle(window.google);
    Object.defineProperty(window, 'google', {
      configurable: true,
      get() { return internalGoogle; },
      set(val) {
        internalGoogle = attachGoogle(val);
      },
    });
  });

  await page.route('**/api/real-world-reasoning-agent/capabilities', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ maps: true, gemini: true, mapsGrounding: true }),
  }));
  await page.route('**/api/real-world-reasoning-agent/ai/**', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [
          {
            content: {
              parts: [{
                text: 'Three browser-test candidates:\n1. Deterministic café A (37.797, -122.395)\n2. Deterministic café B (37.792, -122.401)\n3. Deterministic café C (37.789, -122.407)',
              }],
            },
            groundingMetadata: {
              groundingChunks: [
                { maps: { title: 'Deterministic café A', uri: 'https://maps.google.com/?cid=browser-fixture-a', placeId: 'browser-fixture-a' } },
                { maps: { title: 'Deterministic café B', uri: 'https://maps.google.com/?cid=browser-fixture-b', placeId: 'browser-fixture-b' } },
                { maps: { title: 'Deterministic café C', uri: 'https://maps.google.com/?cid=browser-fixture-c', placeId: 'browser-fixture-c' } },
              ],
            },
          },
        ],
      }),
    });
  });
  await page.route('**://routes.googleapis.com/**', (route) => {
    const postData = route.request().postDataJSON();
    const lat = postData?.destination?.location?.latLng?.latitude;
    let minutes = 9;
    if (lat && Math.abs(lat - 37.792) < 0.001) minutes = 13;
    if (lat && Math.abs(lat - 37.789) < 0.001) minutes = 18;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        routes: [{
          distanceMeters: minutes * 75,
          duration: `${minutes * 60}s`,
          polyline: { encodedPolyline: '_p~iF~ps|U_ulLnqP_mqN' },
        }],
      }),
    });
  });
  await page.route('**/api/real-world-reasoning-agent/gmp/weather/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      weatherCondition: { description: { text: 'Partly cloudy' } },
      temperature: { degrees: 12, unit: 'CELSIUS' },
      precipitation: { probability: { percent: 20 } },
    }),
  }));
}

async function horizontalSpillers(page) {
  return page.evaluate(() => {
    const out = [];
    for (const element of document.querySelectorAll('body *')) {
      if (element.closest('.gm-style, gmp-map-3d')) continue;
      const box = element.getBoundingClientRect();
      if (box.width && box.height && box.left < innerWidth - 1 && box.right > innerWidth + 5) out.push(element.tagName.toLowerCase());
    }
    return [...new Set(out)].slice(0, 5);
  });
}

async function launchLiveExplorer(page) {
  await installProviderFixtures(page);
  page.on('console', (message) => {
    if (message.type() === 'error' && !ignored.some((pattern) => pattern.test(message.text()))) errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.locator('.atlas-cold-open').waitFor({ state: 'attached', timeout: 15_000 });
  await page.locator('.mission-launch:not([disabled])').waitFor({ state: 'visible', timeout: 15_000 });
  assert(await page.locator('textarea').count() === 1, 'Cold open must have one prompt.');
  assert(await page.locator('.mission-launch').count() === 1, 'Cold open must have one primary action.');
  assert(/ready|live/i.test(await page.locator('.mission-capability').innerText()), 'Landing must clearly identify Live mode.');
  assert(await page.getByText(/Sample preview|Sample mission/i).count() === 0, 'Landing must not expose a Sample mode.');
  const startedAt = Date.now();
  await page.locator('.mission-launch:not([disabled])').click();
  await page.locator('.genui-surface').waitFor({ timeout: 15_000 });
  await page.getByText(/Rank 1 · .* · 9 min · inside limit/).waitFor({ timeout: 15_000 });
  return Date.now() - startedAt;
}

const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] });
try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const firstEvidenceMs = await launchLiveExplorer(desktop);
  await desktop.getByRole('heading', { name: 'Evidence' }).waitFor();
  await desktop.getByText(/Partly cloudy · 12°C/i).waitFor();
  await desktop.locator('.copilot-message').filter({ hasText: /9-minute walk/i }).waitFor({ timeout: 15_000 });
  assert(await desktop.locator('.genui-surface').count() === 1, 'Explorer must own exactly one surface.');
  const evidenceTop = await desktop.getByRole('heading', { name: 'Evidence' }).evaluate((heading) => {
    const messages = heading.closest('.agent-canvas__scroll');
    if (!messages) return false;
    const headingBox = heading.getBoundingClientRect();
    const messagesBox = messages.getBoundingClientRect();
    return headingBox.top >= messagesBox.top && headingBox.bottom <= messagesBox.bottom;
  });
  assert(evidenceTop, 'The first payoff must open at the Evidence heading.');
  // The composer is now the session's single, always-available input rather than
  // per-journey chrome that had to be hidden during the first run. What must not
  // happen is a SECOND agent surface competing with the evidence one.
  assert(await desktop.locator('.copilot-dock__composer:visible').count() === 1, 'There must be exactly one composer.');
  assert(await desktop.locator('.agent-canvas').count() === 1, 'There must be exactly one agent canvas.');
  assert(await desktop.locator('.context-drawer').count() === 0, 'The competing context drawer must be gone.');
  assert(await desktop.locator('.genui-grounding-source').count() >= 5, 'Live evidence must render provider source links.');
  assert(await desktop.locator('.genui-grounding-source').first().getAttribute('translate') !== 'yes', 'Grounding attribution must remain unmodified.');
  assert(await desktop.getByRole('button', { name: /Resume/i }).count() === 0, 'First run must not require Resume.');
  assert(!/tools\/call|render_surface|system prompt/i.test(await desktop.locator('.genui-surface').innerText()), 'Internal orchestration leaked into the surface.');
  await desktop.screenshot({ path: `${OUT}/01-explorer-ready.png`, animations: 'disabled' });

  await desktop.locator('.genui-surface').evaluate((surface) => { surface.dataset.smokeIdentity = 'canonical'; });
  await desktop.locator('.genui-surface button').filter({ hasText: /driv/i }).click();
  await desktop.getByText(/Rank 1 · .* · 5 min · inside limit/).waitFor({ timeout: 15_000 });
  assert(await desktop.locator('.genui-surface').count() === 1, 'Counterfactual created a second surface.');
  assert(await desktop.locator('.genui-surface').getAttribute('data-smoke-identity') === 'canonical', 'Counterfactual replaced rather than updated the canonical surface.');
  await desktop.screenshot({ path: `${OUT}/02-explorer-drive-counterfactual.png`, animations: 'disabled' });
  await desktop.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await launchLiveExplorer(mobile);
  await mobile.getByText(/Partly cloudy · 12°C/i).waitFor({ timeout: 15_000 });
  const spillers = await horizontalSpillers(mobile);
  assert(spillers.length === 0, `Visible app content overflowed mobile: ${spillers.join(', ')}`);
  const unlabeled = await mobile.evaluate(() => [...document.querySelectorAll('button, a[href], [role="button"]')]
    .filter((element) => {
      const box = element.getBoundingClientRect();
      return box.width && box.height && !(element.getAttribute('aria-label') || element.textContent?.trim() || element.querySelector('img[alt]:not([alt=""])'));
    }).length);
  assert(unlabeled === 0, 'Visible mobile controls need accessible names.');
  await mobile.screenshot({ path: `${OUT}/03-explorer-mobile.png`, animations: 'disabled' });
  await mobile.close();

  assert(firstEvidenceMs <= 25_000, `First evidence exceeded the provisional evidence gate (${firstEvidenceMs}ms).`);
  assert(errors.length === 0, `Unexpected browser errors: ${errors.slice(0, 5).join(' | ')}`);
  console.log(JSON.stringify({ status: 'PASS', firstEvidenceMs, mode: 'live-with-intercepted-providers', surfaces: 1, screenshots: OUT }, null, 2));
} finally {
  await browser.close();
}
