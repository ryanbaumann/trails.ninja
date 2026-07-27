// UI/UX audit for the default one-prompt Live-first explorer. Grounding Lite,
// route drawing, and Gemini are intercepted. The configured Google Maps
// JavaScript renderer remains live and may incur project costs.
//
//   npm start & CHROMIUM_PATH=/usr/bin/google-chrome node scripts/uiux-audit.mjs
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.SMOKE_URL || 'http://localhost:8080';
const OUT = (process.env.AUDIT_OUT || '/tmp/atlas-audit').replace(/\/$/, '');
if (process.env.ALLOW_LIVE_MAPS_BROWSER !== '1') {
  throw new Error('Set ALLOW_LIVE_MAPS_BROWSER=1 to acknowledge that the configured Maps JavaScript renderer may incur costs.');
}
mkdirSync(OUT, { recursive: true });
const EXEC = process.env.CHROMIUM_PATH || [
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find(existsSync);
if (!EXEC) throw new Error('Chromium not found. Set CHROMIUM_PATH to an installed Chrome/Chromium executable.');

const VIEWPORTS = [
  { key: 'xs', width: 320, height: 568 },
  { key: 'sm', width: 390, height: 844 },
  { key: 'md', width: 768, height: 1024 },
  { key: 'lg', width: 1440, height: 900 },
  { key: 'xl', width: 1920, height: 1080 },
];
const IGNORE = [
  /Google Maps JavaScript API/i,
  /development purposes only/i,
  /Receiving end does not exist/i,
  /Vector Map.*Falling back to Raster/i,
  /map is initialized without a valid Map ID/i,
  /Failed to load resource.*503/i,
];
const severe = (text) => !IGNORE.some((pattern) => pattern.test(text));

const places = [
  { id: 'browser-fixture-a', latitude: 37.797, longitude: -122.395, walk: 9 },
  { id: 'browser-fixture-b', latitude: 37.792, longitude: -122.401, walk: 13 },
  { id: 'browser-fixture-c', latitude: 37.789, longitude: -122.407, walk: 18 },
];
const source = (kind) => ({ title: `Deterministic ${kind} fixture`, url: `https://example.test/${kind}` });
const mcpResult = (value) => JSON.stringify({ jsonrpc: '2.0', id: 1, result: { structuredContent: value } });

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
      };
    } else if (name === 'compute_routes') {
      const place = places.find((candidate) => candidate.id === args.destination?.place_id);
      value = { routes: [{ distanceMeters: place.walk * 75, duration: `${place.walk * 60}s`, attribution: source('route') }] };
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
  await page.route('**://routes.googleapis.com/**', (route) => route.fulfill({ status: 503, body: '{}' }));
  await page.route('**/api/real-world-reasoning-agent/ai/**', (route) => route.request().method() === 'POST'
    ? route.fulfill({ status: 503, body: '{}' })
    : route.continue());
}

// In-page DOM audit. Map-internal nodes are excluded because their layout and
// labels belong to the Google Maps renderer rather than this app shell.
const DOM_AUDIT = () => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const out = {
    viewport: { vw, vh },
    docScrollW: document.documentElement.scrollWidth,
    horizontalScroll: document.documentElement.scrollWidth > vw + 1,
    overflowers: [],
    offViewport: [],
    tinyTapTargets: [],
    unlabeledControls: [],
  };
  const desc = (element) => {
    const cls = typeof element.className === 'string' ? element.className.split(/\s+/).filter(Boolean).slice(0, 3).join('.') : '';
    const label = element.getAttribute?.('aria-label');
    return `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${cls ? `.${cls}` : ''}${label ? `[aria-label="${label}"]` : ''}`;
  };
  for (const element of document.querySelectorAll('body *')) {
    if (element.closest('.gm-style, gmp-map-3d')) continue;
    const box = element.getBoundingClientRect();
    if (!box.width || !box.height) continue;
    const style = getComputedStyle(element);
    if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) continue;
    if (box.right > vw + 2 && box.width < vw + 40 && box.left >= 0) {
      out.overflowers.push({ el: desc(element), right: Math.round(box.right), width: Math.round(box.width) });
    }
    const interactive = element.matches('button, a, input, [role="button"], select, textarea, [tabindex]');
    const insideBoundedScroll = Boolean(element.closest('.agent-canvas__scroll'));
    if (interactive && !insideBoundedScroll && (box.right < 4 || box.left > vw - 4 || box.bottom < 4 || box.top > vh - 4)) {
      out.offViewport.push({ el: desc(element), rect: [Math.round(box.left), Math.round(box.top), Math.round(box.right), Math.round(box.bottom)] });
    }
    if (interactive && box.top < vh && box.bottom > 0 && box.left < vw && box.right > 0
      && (box.width < 44 || box.height < 44) && element.offsetParent !== null) {
      const text = (element.getAttribute('aria-label') || element.textContent || '').trim().slice(0, 30);
      out.tinyTapTargets.push({ el: desc(element), w: Math.round(box.width), h: Math.round(box.height), text });
    }
    if (element.matches('button, a[href], input, [role="button"]')) {
      const name = (element.getAttribute('aria-label') || element.getAttribute('title') || element.textContent || '').trim();
      if (!name && !element.querySelector('img[alt]:not([alt=""])')) out.unlabeledControls.push({ el: desc(element) });
    }
  }
  for (const key of ['overflowers', 'offViewport', 'tinyTapTargets', 'unlabeledControls']) out[key] = out[key].slice(0, 25);
  return out;
};

const report = { base: BASE, mode: 'live-with-intercepted-providers', screens: [] };
const browser = await chromium.launch({
  executablePath: EXEC,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
});

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await installProviderFixtures(page);
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error' && severe(message.text())) errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.locator('.atlas-cold-open').waitFor({ state: 'attached', timeout: 20_000 });
    await page.locator('.mission-launch').waitFor({ state: 'visible', timeout: 20_000 });

    const landingGate = await page.evaluate(() => {
      const prompt = document.querySelector('textarea')?.getBoundingClientRect();
      const launch = document.querySelector('.mission-launch')?.getBoundingClientRect();
      return {
        prompts: document.querySelectorAll('textarea').length,
        primaryActions: document.querySelectorAll('.mission-launch').length,
        promptVisible: Boolean(prompt && prompt.top >= 0 && prompt.bottom <= innerHeight),
        launchVisible: Boolean(launch && launch.top >= 0 && launch.bottom <= innerHeight),
        operationalShellHidden: !document.querySelector('.atlas-statusbar, .copilot-dock, .agent-canvas'),
        sampleModeVisible: /sample (?:preview|mission)/i.test(document.body.innerText),
      };
    });
    if (landingGate.prompts !== 1 || landingGate.primaryActions !== 1 || !landingGate.promptVisible
      || !landingGate.launchVisible || !landingGate.operationalShellHidden || landingGate.sampleModeVisible) {
      throw new Error(`one-prompt Live landing gate failed: ${JSON.stringify(landingGate)}`);
    }
    await page.screenshot({ path: `${OUT}/${viewport.key}-landing.png`, animations: 'disabled' });
    report.screens.push({ viewport: viewport.key, screen: 'landing', dims: [viewport.width, viewport.height], audit: await page.evaluate(DOM_AUDIT), errors: [...errors] });

    await page.locator('.mission-launch').click();
    await page.getByText(/Rank 1 · .* · 9 min · inside limit/).waitFor({ timeout: 20_000 });
    await page.getByText(/Partly cloudy · 12°C/i).waitFor({ timeout: 15_000 });
    if (await page.locator('.genui-surface').count() !== 1) throw new Error('Explorer must own exactly one evidence surface.');
    if (await page.locator('.genui-grounding-source').count() < 5) throw new Error('Live evidence must keep provider sources visible.');
    await page.screenshot({ path: `${OUT}/${viewport.key}-explorer.png`, animations: 'disabled' });
    report.screens.push({ viewport: viewport.key, screen: 'explorer', dims: [viewport.width, viewport.height], audit: await page.evaluate(DOM_AUDIT), errors: [...errors] });
    console.log(`✓ ${viewport.key} / landing → Live explorer`);
  } catch (error) {
    console.error(`✗ ${viewport.key}: ${error.message}`);
    report.screens.push({ viewport: viewport.key, screen: 'ERROR', error: error.message, errors });
    process.exitCode = 1;
  } finally {
    await context.close();
  }
}

await browser.close();
writeFileSync(`${OUT}/audit.json`, JSON.stringify(report, null, 2));

console.log('\n=== DOM AUDIT SUMMARY ===');
const blockingDefects = [];
for (const screen of report.screens) {
  if (!screen.audit) continue;
  const audit = screen.audit;
  const flags = [];
  if (audit.horizontalScroll) flags.push(`H-SCROLL(${audit.docScrollW}>${audit.viewport.vw})`);
  if (audit.overflowers.length) flags.push(`overflow:${audit.overflowers.length}`);
  if (audit.offViewport.length) flags.push(`offscreen:${audit.offViewport.length}`);
  if (audit.tinyTapTargets.length) flags.push(`tinytap:${audit.tinyTapTargets.length}`);
  if (audit.unlabeledControls.length) flags.push(`unlabeled:${audit.unlabeledControls.length}`);
  if (screen.errors?.length) flags.push(`console:${screen.errors.length}`);
  if (flags.length) console.log(`  ${screen.viewport}/${screen.screen}: ${flags.join(' ')}`);
  const mobile = screen.dims?.[0] <= 820;
  if (audit.horizontalScroll || audit.overflowers.length || audit.offViewport.length
    || audit.unlabeledControls.length || screen.errors?.length || (mobile && audit.tinyTapTargets.length)) {
    blockingDefects.push(`${screen.viewport}/${screen.screen}: ${flags.join(' ')}`);
  }
}
if (blockingDefects.length) {
  process.exitCode = 1;
  console.error('\nBlocking UI defects:\n', blockingDefects.join('\n'));
}
console.log('\nWrote', `${OUT}/audit.json`, 'and PNGs to', OUT);
