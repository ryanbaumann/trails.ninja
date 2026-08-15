#!/usr/bin/env node
// Generate factual 1200x627 social cards from existing portfolio assets.
//
// This script adds no production dependency. It uses the Playwright dev
// dependency already owned by demos/strava-explorer so Chromium can rasterize
// system-font HTML and the repository's real screenshots/artifact cards.
//
// Usage: node scripts/social-cards.mjs

import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'portfolio', 'static', 'social');
const WIDTH = 1200;
const HEIGHT = 627;

const CARDS = [
  {
    file: 'home.png',
    eyebrow: 'FIELDWORK · RYAN BAUMANN',
    title: 'Builder platforms for humans + agents.',
    summary: 'Tools · Evals · Reference apps',
    source: 'portfolio/static/previews/fieldwork.jpg',
    layout: 'screenshot',
  },
  {
    file: 'about.png',
    eyebrow: 'RYAN BAUMANN',
    title: 'Developer Experience Engineering leader and practitioner',
    summary: 'Developer tools · Evals · Open source · AI coding agents',
    source: 'portfolio/static/img/ryan-baumann-profile.jpg',
    layout: 'screenshot',
  },
  {
    file: 'resume.png',
    eyebrow: 'RYAN BAUMANN · RESUME',
    title: 'Builder platforms from strategy to working code',
    summary: 'Google · Mapbox · Instabase · Caterpillar',
    source: 'portfolio/static/img/ryan-baumann-profile.jpg',
    layout: 'screenshot',
  },
  {
    file: 'contact.png',
    eyebrow: 'START A CONVERSATION',
    title: 'Start with the thing you are trying to build',
    summary: 'Builder platforms · Content · Speaking',
    source: 'portfolio/static/img/ryan-baumann-profile.jpg',
    layout: 'screenshot',
  },
  {
    file: 'work-code-assist.png',
    eyebrow: 'WORK · GOOGLE MAPS PLATFORM',
    title: 'Code Assist',
    summary: 'Current official platform context inside AI coding agents.',
    source: 'portfolio/static/img/work/code-assist-docs.png',
    layout: 'screenshot',
  },
  {
    file: 'work-agent-skills.png',
    eyebrow: 'WORK · GOOGLE MAPS PLATFORM',
    title: 'Agent Skills',
    summary: 'Portable, tested workflows for AI coding agents.',
    source: 'portfolio/static/img/work/agent-skills.svg',
    layout: 'artifact',
  },
  {
    file: 'work-agentic-evals.png',
    eyebrow: 'WORK · GOOGLE MAPS PLATFORM',
    title: 'Agentic Eval Suite',
    summary: 'Task-based comparisons that turn quality into a launch decision.',
    source: 'portfolio/static/img/work/agentic-evals.svg',
    layout: 'artifact',
  },
  {
    file: 'work-agentic-growth.png',
    eyebrow: 'WORK · GOOGLE MAPS PLATFORM',
    title: 'OSS client-library growth',
    summary: 'From Mar 2025 to Mar 2026, our OSS client libraries more than doubled unique active users.',
    source: 'portfolio/static/img/work/agentic-growth.svg',
    layout: 'artifact',
  },
  {
    file: 'work-voice-of-developer.png',
    eyebrow: 'WORK · GOOGLE MAPS PLATFORM',
    title: 'Voice of Developer',
    summary: 'Repeated developer friction becomes roadmap evidence.',
    source: 'portfolio/static/img/work/voice-of-developer.svg',
    layout: 'artifact',
  },
  {
    file: 'work-geo-architecture-center.png',
    eyebrow: 'WORK · GOOGLE MAPS PLATFORM',
    title: 'Geo Architecture Center',
    summary: 'Reusable system patterns for repeated architecture questions.',
    source: 'portfolio/static/img/work/geo-architecture-center.svg',
    layout: 'artifact',
  },
  {
    file: 'work-intelligent-product-essentials.png',
    eyebrow: 'WORK · GOOGLE CLOUD',
    title: 'Intelligent Product Essentials',
    summary: 'A connected-product solution taken from zero to launch.',
    source: 'portfolio/static/img/work/intelligent-product-essentials.svg',
    layout: 'artifact',
  },
  {
    file: 'work-mapbox-boundaries-atlas.png',
    eyebrow: 'WORK · MAPBOX',
    title: 'Boundaries and Atlas',
    summary: 'Two enterprise mapping products taken from zero to one.',
    source: 'portfolio/static/img/work/mapbox-boundaries-atlas.svg',
    layout: 'artifact',
  },
  {
    file: 'work-mapbox-oss-datascience.png',
    eyebrow: 'WORK · MAPBOX',
    title: 'Maps inside data workflows',
    summary: 'mapboxgl-jupyter · mapboxgl-powerbi',
    source: 'portfolio/static/img/work/mapboxgl-jupyter.jpg',
    layout: 'screenshot',
  },
  {
    file: 'work-mapbox-uber-deckgl.png',
    eyebrow: 'WORK · MAPBOX × UBER',
    title: 'deck.gl and kepler.gl integration',
    summary: 'An open-source partnership built around deep integration.',
    source: 'portfolio/static/img/work/kepler-mapbox.jpg',
    layout: 'screenshot',
  },
  {
    file: 'work-demo-lab.png',
    eyebrow: 'WORK · DEMO LAB',
    title: 'Working reference apps',
    summary: 'Real APIs · Real constraints · Public source',
    source: 'portfolio/static/previews/strava-explorer.jpg',
    layout: 'screenshot',
  },
  {
    file: 'devx-growth-discipline.png',
    source: 'portfolio/static/social/devx-growth-discipline-final-source.jpg',
    layout: 'direct',
  },
  {
    file: 'developer-platforms-need-to-own-the-agent-feedback-loop.png',
    eyebrow: 'FIELD NOTES · DEVELOPER EXPERIENCE',
    title: 'Own the Agent Feedback Loop',
    summary: 'Context · Evals · Distribution · Outcomes',
    source: 'portfolio/static/img/writing/agent-feedback-loop-header.svg',
    layout: 'artifact',
  },
  {
    file: 'the-model-that-picks-your-platform-doesnt-write-the-code.png',
    eyebrow: 'FIELD NOTES · DEVELOPER EXPERIENCE',
    title: 'A Model Router Needs a Scoreboard',
    summary: 'A routing policy is a hypothesis until held-out tasks preserve quality and measure cost.',
    source: 'portfolio/static/img/writing/model-tiers-header.svg',
    layout: 'artifact',
  },
  {
    file: 'the-next-platform-interface-is-an-agent-session.png',
    eyebrow: 'WRITING · AGENT EXPERIENCE',
    title: 'I Asked Code Assist for a React Store Locator',
    summary: 'The first result from the React library ranked third. Retrieval was only the first decision.',
    source: 'portfolio/static/img/work/code-assist.svg',
    layout: 'artifact',
  },
  {
    file: 'evals-turn-ai-developer-experience-into-an-operating-system.png',
    eyebrow: 'WRITING · EVALS',
    title: 'An Eval Has to Lead Back to a Failed Run',
    summary: 'One paired review moved from 2/4 to 4/4. Missing outputs and reruns kept it from becoming a release gate.',
    source: 'portfolio/static/img/writing/evals-header.svg',
    layout: 'artifact',
  },
  {
    file: 'fine-tuning-was-the-easy-part.png',
    eyebrow: 'FIELD NOTES · FINE-TUNING',
    title: 'Fine-Tuning Was the Easy Part',
    summary: 'Tuning one adapter for one job worked. Distributing that fix across every job and model is the hard part.',
    source: 'portfolio/static/img/writing/fine-tuning-header.svg',
    layout: 'artifact',
  },
  {
    file: 'this-weeks-learnings.png',
    eyebrow: 'FIELD NOTES · LINKEDIN',
    title: 'Ryan Baumann on LinkedIn',
    summary: 'Short notes from traces reviewed, evals written, products dogfooded, and opinions revised.',
    source: 'portfolio/static/img/writing/this-weeks-learnings.svg',
    layout: 'artifact',
  },
  {
    file: 'vibing-with-maps.png',
    eyebrow: 'WRITING · SUBSTACK',
    title: 'Vibing with Maps: Practical Experiments',
    summary: 'What worked, what broke, and why curated context beats raw model knowledge for geo work.',
    source: 'portfolio/static/img/writing/vibing-with-maps.svg',
    layout: 'artifact',
  },
  {
    file: 'code-assist-launch.png',
    eyebrow: 'WRITING · GOOGLE MAPS PLATFORM',
    title: 'Bring Current Maps Guidance Into the Agent Session',
    summary: 'Official Maps documentation at task time, without waiting for a new model checkpoint.',
    source: 'portfolio/static/img/writing/code-assist-launch.svg',
    layout: 'artifact',
  },
  {
    file: 'coding-agent-loop.png',
    eyebrow: 'AGENT SCRIPTS · LOOP ENGINEERING',
    title: 'Loop Engineering Coding Agent',
    summary: 'One operating contract, four role overlays, a structural check, and 17 specified scenarios.',
    source: 'portfolio/static/img/scripts/coding-agent-loop.svg',
    layout: 'artifact',
  },
  {
    file: 'code-assist-video.png',
    eyebrow: 'FIRESIDE CHAT · GOOGLE MAPS PLATFORM',
    title: 'Grounding Agentic Solutions With Google Maps Platform',
    summary: 'Trustworthy real-world reasoning with grounded geographic context.',
    source: 'portfolio/static/img/talks/code-assist-video.svg',
    layout: 'artifact',
  },
  {
    file: 'agent-skills-video.png',
    eyebrow: 'FIRESIDE CHAT · GOOGLE MAPS PLATFORM',
    title: 'Build Maps With AI',
    summary: 'Current context, useful workflows, and checks for AI-assisted map building.',
    source: 'portfolio/static/img/talks/agent-skills-video.svg',
    layout: 'artifact',
  },
  {
    file: 'visgl-vibe-your-viz.png',
    eyebrow: 'TALK · VIS.GL SUMMIT',
    title: 'Vibe Your Viz: Growing With AI-Native Makers',
    summary: 'What open-source visualization libraries need from AI coding agents.',
    source: 'portfolio/static/img/talks/visgl-vibe-your-viz.svg',
    layout: 'artifact',
  },
  {
    file: 'geomob-vibing-with-maps.png',
    eyebrow: 'TALK · GEOMOB SF',
    title: 'Vibe With Maps: Concept to Prototype, Fast',
    summary: 'Three working demos and the context that makes them reliable.',
    source: 'portfolio/static/img/talks/geomob-vibing-with-maps.svg',
    layout: 'artifact',
  },
  {
    file: 'strava-explorer.png',
    eyebrow: 'DEMO · GOOGLE MAPS PLATFORM',
    title: 'Strava 3D Explorer',
    summary: 'Fly your Strava routes in Photorealistic 3D.',
    source: 'portfolio/static/previews/strava-explorer.jpg',
    layout: 'screenshot',
  },
  {
    file: 'aqi-map.png',
    eyebrow: 'DEMO · GOOGLE MAPS PLATFORM',
    title: 'Air Quality Map',
    summary: 'Live air-quality heatmap with pollutant detail.',
    source: 'portfolio/static/previews/aqi-map.jpg',
    layout: 'screenshot',
  },
  {
    file: 'isochrones.png',
    eyebrow: 'DEMO · GOOGLE MAPS PLATFORM',
    title: 'Isochrones',
    summary: 'Live reachability bands for delivery, commute, and response planning.',
    source: 'portfolio/static/previews/isochrones.jpg',
    layout: 'screenshot',
  },
  {
    file: 'can-i-build-an-ai-agent-that-doesnt-write-slop.png',
    eyebrow: 'FIELD NOTES · WRITING WITH AI',
    title: "Can I Build an AI Agent That Doesn't Write Slop?",
    summary: 'I tuned a 26B model on my own writing. Register transferred. Judgment did not.',
    source: 'portfolio/static/img/writing/can-i-build-an-ai-agent-that-doesnt-write-slop-header.svg',
    layout: 'artifact',
  },
];

const requestedFiles = new Set(process.argv.slice(2).map(f => f.replace(/\.png$/, '.jpg')));
for (const card of CARDS) {
  card.file = card.file.replace(/\.png$/, '.jpg');
}
const knownFiles = new Set(CARDS.map(({ file }) => file));
for (const file of requestedFiles) {
  if (!knownFiles.has(file)) throw new Error(`Unknown social card: ${file}`);
}
const selectedCards = requestedFiles.size === 0
  ? CARDS
  : CARDS.filter(({ file }) => requestedFiles.has(file));

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function imageDataUrl(path) {
  const extension = extname(path).toLowerCase();
  const mime = extension === '.svg' ? 'image/svg+xml' : extension === '.png' ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${readFileSync(path).toString('base64')}`;
}

function cardHtml(spec) {
  const assetPath = resolve(ROOT, spec.source);
  const image = imageDataUrl(assetPath);
  if (spec.layout === 'direct') {
    return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  html, body { width: ${WIDTH}px; height: ${HEIGHT}px; margin: 0; overflow: hidden; }
  img { display: block; width: 100%; height: 100%; object-fit: cover; }
</style></head><body><img src="${image}" alt=""></body></html>`;
  }
  const titleSize = spec.title.length > 64 ? 50 : spec.title.length > 56 ? 56 : spec.title.length > 42 ? 62 : 70;
  const screenshot = spec.layout === 'screenshot';

  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  html, body { width: ${WIDTH}px; height: ${HEIGHT}px; margin: 0; overflow: hidden; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; background: #f7f5f0; color: #172033; }
  .card { position: relative; width: 100%; height: 100%; background: #f7f5f0; }
  .visual { position: absolute; overflow: hidden; }
  .screenshot .visual { inset: 0 0 0 43%; }
  .artifact .visual { top: 68px; right: 58px; bottom: 68px; width: 47%; border: 1px solid #d9dde5; border-radius: 14px; background: #0b1220; }
  .visual img { display: block; width: 100%; height: 100%; object-fit: cover; }
  .artifact .visual img { object-fit: contain; }
  .screenshot .visual::after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, #f7f5f0 0%, rgba(247,245,240,.8) 12%, rgba(247,245,240,0) 38%); }
  .copy { position: absolute; z-index: 2; left: 68px; top: 64px; bottom: 58px; display: flex; flex-direction: column; justify-content: center; }
  .screenshot .copy { width: 545px; }
  .artifact .copy { width: 520px; }
  .eyebrow { margin: 0 0 27px; color: #1d5fd1; font: 700 19px/1.2 ui-monospace, "SFMono-Regular", Consolas, monospace; letter-spacing: 2.4px; }
  h1 { margin: 0; max-width: 530px; font-size: ${titleSize}px; line-height: .99; letter-spacing: -3.4px; font-weight: 760; text-wrap: balance; }
  .summary { margin: 28px 0 0; max-width: 500px; color: #505b6e; font-size: 25px; line-height: 1.35; text-wrap: balance; }
  .byline { position: absolute; left: 0; bottom: 0; width: 20rem; margin: 0; color: #697386; font: 600 18px/1.2 ui-monospace, "SFMono-Regular", Consolas, monospace; }
  .rule { position: absolute; z-index: 3; left: 0; right: 0; bottom: 0; height: 7px; background: #1d5fd1; }
</style></head><body>
  <main class="card ${escapeHtml(spec.layout)}">
    <div class="visual"><img src="${image}" alt=""></div>
    <div class="copy">
      <p class="eyebrow">${escapeHtml(spec.eyebrow)}</p>
      <h1>${escapeHtml(spec.title)}</h1>
      <p class="summary">${escapeHtml(spec.summary)}</p>
      <p class="byline">ryanbaumann.dev</p>
    </div>
    <div class="rule"></div>
  </main>
</body></html>`;
}

function assertJpg(path) {
  const bytes = readFileSync(path);
  const signature = Buffer.from([255, 216, 255]);
  if (bytes.length < 3 || !bytes.subarray(0, 3).equals(signature)) {
    throw new Error(`${relative(ROOT, path)} is not a JPEG`);
  }
}

function loadChromium() {
  try {
    const demoRequire = createRequire(join(ROOT, 'demos', 'strava-explorer', 'package.json'));
    return demoRequire('playwright').chromium;
  } catch (error) {
    throw new Error(
      'Social card generation needs the existing Playwright dev dependency. ' +
      'Run `npm install` in demos/strava-explorer, then retry.',
      { cause: error },
    );
  }
}

mkdirSync(OUT, { recursive: true });
const chromium = loadChromium();
let browser;

try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });

  for (const spec of selectedCards) {
    const outputPath = join(OUT, spec.file);
    await page.setContent(cardHtml(spec), { waitUntil: 'load' });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((image) => image.decode()));
      await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
    });
    await page.screenshot({ path: outputPath, type: 'jpeg', quality: 70 });
    assertJpg(outputPath);
    console.log(`[social-cards] wrote ${relative(ROOT, outputPath)} (${WIDTH}x${HEIGHT}, image/jpeg)`);
  }

  writeFileSync(
    join(OUT, 'sources.json'),
    `${JSON.stringify(
      Object.fromEntries(CARDS.map(({ file, source }) => [file, source])),
      null,
      2,
    )}\n`,
  );
  console.log(`[social-cards] wrote ${relative(ROOT, join(OUT, 'sources.json'))}`);
} catch (error) {
  if (/Executable doesn't exist|browserType\.launch/.test(String(error))) {
    throw new Error(
      'Playwright Chromium is unavailable. Run `npx playwright install chromium` from demos/strava-explorer, then retry.',
      { cause: error },
    );
  }
  throw error;
} finally {
  await browser?.close();
}
