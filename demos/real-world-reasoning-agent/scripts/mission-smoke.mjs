// Grounding Lite, route drawing, and Gemini are deterministic fixtures. The
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
  await page.route('**/api/real-world-reasoning-agent/capabilities', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ maps: true, gemini: true, groundingLite: true }),
  }));
  await page.route('**/api/real-world-reasoning-agent/gmp/grounding-lite/mcp', async (route) => {
    const request = route.request().postDataJSON();
    const name = request?.params?.name;
    const args = request?.params?.arguments ?? {};
    let value;
    if (name === 'search_places') {
      value = {
        places: places.map((place) => ({
          id: place.id,
          location: { latitude: place.latitude, longitude: place.longitude },
          googleMapsLinks: { placeUrl: `https://example.test/places/${place.id}` },
          attribution: source('place'),
        })),
        summary: 'Three browser-test candidates were returned by the intercepted provider.',
      };
    } else if (name === 'compute_routes') {
      const id = args.destination?.place_id;
      const minutes = args.travel_mode === 'DRIVE' ? driveMinutes[id] : walkMinutes[id];
      value = { routes: [{ distanceMeters: minutes * 75, duration: `${minutes * 60}s`, attribution: source('route') }] };
    } else if (name === 'lookup_weather') {
      value = {
        weatherCondition: { description: { text: 'Partly cloudy' } },
        temperature: { degrees: 12, unit: 'CELSIUS' },
        precipitation: { probability: { percent: 20 } },
        attribution: source('weather'),
      };
    } else {
      return route.fulfill({ status: 400, body: `Unexpected fixture tool: ${name}` });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: mcpResult(value) });
  });
  // The evidence run remains Live mode, but no paid route drawing or Gemini
  // summarization request may leave the browser during deterministic smoke.
  await page.route('**://routes.googleapis.com/**', (route) => route.fulfill({ status: 503, body: '{}' }));
  await page.route('**/api/real-world-reasoning-agent/ai/**', (route) => route.request().method() === 'POST'
    ? route.fulfill({ status: 503, body: '{}' })
    : route.continue());
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
  await page.locator('.mission-launch').waitFor({ state: 'visible', timeout: 15_000 });
  assert(await page.locator('textarea').count() === 1, 'Cold open must have one prompt.');
  assert(await page.locator('.mission-launch').count() === 1, 'Cold open must have one primary action.');
  assert(/live/i.test(await page.locator('.mission-capability').innerText()), 'Landing must clearly identify Live mode.');
  assert(await page.getByText(/Sample preview|Sample mission/i).count() === 0, 'Landing must not expose a Sample mode.');
  const startedAt = Date.now();
  await page.locator('.mission-launch').click();
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
