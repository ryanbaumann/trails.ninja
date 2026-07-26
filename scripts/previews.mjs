#!/usr/bin/env node
// scripts/previews.mjs — regenerate the homepage demo screenshots.
//
// Boots the gateway against the staged apps/ directory (run
// scripts/build-local.mjs with real VITE_ keys first, or set BASE_URL to a
// running instance — including https://ryanbaumann.dev) and captures one real
// screenshot per demo into portfolio/static/previews/<name>.jpg. Honest
// previews only: this replaces hand-made mockups with what the app actually
// looks like.
//
// Browser automation comes from demos/strava-explorer's Playwright dev dependency
// (no new root dependencies). One-time setup if the browser is missing:
//   cd demos/strava-explorer && npm install && npx playwright install chromium
//
// Usage:
//   node scripts/previews.mjs                       # boot local gateway from ./apps
//   BASE_URL=https://ryanbaumann.dev node scripts/previews.mjs   # shoot production
//   node scripts/previews.mjs --webp                # re-encode existing previews/assets to WebP (no gateway needed)
//
// --webp re-encodes the JPEG/PNG screenshots already on disk to WebP via
// Chromium's <canvas> (see convertToWebp/WEBP_MANIFEST below) — no sharp,
// cwebp, or imagemagick required, and no new root dependency. Run this
// after a normal `node scripts/previews.mjs` shoot so freshly captured
// screenshots also get a WebP sibling.

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PREVIEWS_DIR = join(REPO_ROOT, 'portfolio', 'static', 'previews');
const ASSETS_DIR = join(REPO_ROOT, 'portfolio', 'static', 'assets');

// Bundled headless-shell resolution is stale in this container; the real
// Chromium binary lives here instead (see docs/SITE_ASSESSMENT_2026-07.md
// section 6 and LEARNINGS.md for why this path is required).
const CHROMIUM_EXECUTABLE_PATH = '/opt/pw-browsers/chromium';

let chromium;
try {
  const requireFromStrava = createRequire(join(REPO_ROOT, 'demos', 'strava-explorer', 'package.json'));
  ({ chromium } = requireFromStrava('playwright-core'));
} catch {
  console.error('[previews] Playwright not found. Run: cd demos/strava-explorer && npm install');
  process.exit(1);
}

// --- WebP re-encoding -------------------------------------------------
//
// There is no sharp/cwebp/imagemagick in this environment and the repo
// stays zero-dependency, so this re-encodes JPEG/PNG screenshots to WebP
// using Chromium's own <canvas> (already a dependency via Playwright).
// Exported so other tooling can reuse it without shelling out to this
// file's CLI.
//
// `browser` must already be launched with CHROMIUM_EXECUTABLE_PATH.
export async function convertToWebp(browser, { inputPath, outputPath, width, quality = 0.78 }) {
  const ext = inputPath.split('.').pop().toLowerCase();
  const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
  const dataUrl = `data:${mime};base64,${readFileSync(inputPath).toString('base64')}`;

  const page = await browser.newPage();
  let result;
  try {
    result = await page.evaluate(async ({ dataUrl, width, quality }) => {
      const img = new Image();
      await new Promise((resolvePromise, reject) => {
        img.onload = resolvePromise;
        img.onerror = () => reject(new Error('image failed to decode'));
        img.src = dataUrl;
      });
      const targetWidth = Math.min(width, img.naturalWidth);
      const targetHeight = Math.round(img.naturalHeight * (targetWidth / img.naturalWidth));
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      return { dataUrl: canvas.toDataURL('image/webp', quality), width: targetWidth, height: targetHeight };
    }, { dataUrl, width, quality });
  } finally {
    await page.close();
  }

  const outBuffer = Buffer.from(result.dataUrl.split(',')[1], 'base64');
  writeFileSync(outputPath, outBuffer);
  return { width: result.width, height: result.height, bytes: outBuffer.length };
}

// Manifest of JPEG/PNG screenshots to re-encode as WebP. Previews render
// ~400px CSS wide, so 800px covers 2x DPR; the two devx-essay figures are
// full-prose-measure article images, so they keep 1200px.
const WEBP_MANIFEST = [
  { inputPath: join(PREVIEWS_DIR, 'isochrones.jpg'), outputPath: join(PREVIEWS_DIR, 'isochrones.webp'), width: 800 },
  { inputPath: join(PREVIEWS_DIR, 'real-world-reasoning-agent.jpg'), outputPath: join(PREVIEWS_DIR, 'real-world-reasoning-agent.webp'), width: 800 },
  { inputPath: join(PREVIEWS_DIR, 'aqi-map.jpg'), outputPath: join(PREVIEWS_DIR, 'aqi-map.webp'), width: 800 },
  { inputPath: join(PREVIEWS_DIR, 'infographic-agent.jpg'), outputPath: join(PREVIEWS_DIR, 'infographic-agent.webp'), width: 800 },
  { inputPath: join(PREVIEWS_DIR, 'strava-explorer.jpg'), outputPath: join(PREVIEWS_DIR, 'strava-explorer.webp'), width: 800 },
  { inputPath: join(PREVIEWS_DIR, 'fieldwork.jpg'), outputPath: join(PREVIEWS_DIR, 'fieldwork.webp'), width: 800 },
  { inputPath: join(ASSETS_DIR, 'devx-growth-header.png'), outputPath: join(ASSETS_DIR, 'devx-growth-header.webp'), width: 1200 },
  { inputPath: join(ASSETS_DIR, 'devx-eval-loop.png'), outputPath: join(ASSETS_DIR, 'devx-eval-loop.webp'), width: 1200 },
];

async function runWebpConversion() {
  const browser = await chromium.launch({ executablePath: CHROMIUM_EXECUTABLE_PATH });
  try {
    for (const entry of WEBP_MANIFEST) {
      if (!existsSync(entry.inputPath)) {
        console.warn(`[previews] skip (missing source): ${entry.inputPath}`);
        continue;
      }
      const before = statSync(entry.inputPath).size;
      const { width, height, bytes } = await convertToWebp(browser, entry);
      const pct = (100 * (1 - bytes / before)).toFixed(1);
      console.log(
        `[previews] ${entry.outputPath.replace(REPO_ROOT + '/', '')} ` +
        `${width}x${height} — ${before} B -> ${bytes} B (-${pct}%)`
      );
    }
  } finally {
    await browser.close();
  }
}

const apps = JSON.parse(readFileSync(join(REPO_ROOT, 'apps.json'), 'utf8'));
const demos = apps.filter((app) => app.path !== '/');

// Load .env (same simple format scripts/setup.mjs writes) for the gateway's
// server-side keys when booting locally.
function loadDotEnv() {
  const envPath = join(REPO_ROOT, '.env');
  if (!existsSync(envPath)) return {};
  const env = {};
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

let child = null;

async function startGateway() {
  const port = 8097;
  child = spawn(process.execPath, [join(REPO_ROOT, 'gateway', 'server.js')], {
    cwd: REPO_ROOT,
    env: { ...process.env, ...loadDotEnv(), PORT: String(port), APPS_ROOT: join(REPO_ROOT, 'apps') },
    stdio: 'ignore',
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  const start = Date.now();
  while (Date.now() - start < 15_000) {
    try {
      const response = await fetch(`${baseUrl}/api/healthz`);
      if (response.ok) return baseUrl;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('gateway did not become healthy');
}

async function main() {
  if (process.argv.includes('--webp')) {
    await runWebpConversion();
    return;
  }

  const baseUrl = process.env.BASE_URL || await startGateway();
  console.log(`[previews] shooting ${demos.length} demo(s) at ${baseUrl}`);

  const browser = await chromium.launch({ executablePath: CHROMIUM_EXECUTABLE_PATH });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
  });
  const page = await context.newPage();

  for (const demo of demos) {
    const url = `${baseUrl}${demo.path}`;
    await page.goto(url, { waitUntil: 'networkidle' });
    // Give maps/tiles a moment to actually paint.
    await page.waitForTimeout(6000);
    const outPath = join(PREVIEWS_DIR, `${demo.name}.jpg`);
    await page.screenshot({ path: outPath, type: 'jpeg', quality: 80 });
    console.log(`[previews] wrote portfolio/static/previews/${demo.name}.jpg`);
  }

  await browser.close();
  console.log('[previews] done — rebuild the portfolio to pick them up.');
}

main()
  .catch((err) => {
    console.error('[previews] failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => {
    if (child && !child.killed) child.kill();
  });
