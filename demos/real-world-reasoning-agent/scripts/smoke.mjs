// Broad shell smoke for all six journeys. This does not invoke Grounding Lite
// or Gemini, but it does mount the configured Google Maps JavaScript renderer
// and may incur project costs; require explicit operator acknowledgement.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';

const BASE = process.env.SMOKE_URL || 'http://localhost:8080';
const OUT = process.env.SMOKE_OUT || '/tmp/atlas-journey-smoke';
if (process.env.ALLOW_LIVE_MAPS_BROWSER !== '1') {
  throw new Error('Set ALLOW_LIVE_MAPS_BROWSER=1 to acknowledge that the configured Maps JavaScript renderer may incur costs.');
}
mkdirSync(OUT, { recursive: true });

const executablePath = process.env.CHROMIUM_PATH || [
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find(existsSync);
if (!executablePath) throw new Error('Chromium not found. Set CHROMIUM_PATH to an installed Chrome/Chromium executable.');

const journeys = [
  { id: 'concierge', label: 'Concierge' },
  { id: 'insight', label: 'Insight' },
  { id: 'fleet', label: 'Fleet' },
  { id: 'cinema', label: 'Cinema' },
  { id: 'adstudio', label: 'Ad Studio' },
  { id: 'scout', label: 'Scout' },
];
const ignored = [
  /Google Maps JavaScript API/i,
  /development purposes only/i,
  /Receiving end does not exist/i,
  /Vector Map.*Falling back to Raster/i,
  /map is initialized without a valid Map ID/i,
];
const errors = [];
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (message) => {
  if (message.type() === 'error' && !ignored.some((pattern) => pattern.test(message.text()))) errors.push(message.text());
});
page.on('pageerror', (error) => errors.push(error.message));

try {
  for (const journey of journeys) {
    const url = new URL(BASE);
    url.searchParams.set('scenario', journey.id);
    url.searchParams.set('landing', 'true');
    url.searchParams.set('drawer', 'false');
    await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    // The journey rail retired: recipes are chosen from the composer, and the
    // active one names itself on the picker trigger.
    await page.locator('.recipe-picker__trigger').waitFor({ timeout: 20_000 });
    await page.locator('.recipe-picker__name', { hasText: journey.label }).waitFor({ timeout: 10_000 });
    const mapMounted = await page.evaluate(() => Boolean(document.querySelector('.gm-style, canvas, gmp-map-3d')));
    if (!mapMounted) throw new Error(`${journey.label}: Maps renderer did not mount.`);
    await page.screenshot({ path: `${OUT}/${journey.id}.png`, animations: 'disabled' });
    console.log(`✓ ${journey.label}`);
  }
  if (errors.length) throw new Error(`Unexpected browser errors: ${errors.slice(0, 5).join(' | ')}`);
} finally {
  await browser.close();
}
