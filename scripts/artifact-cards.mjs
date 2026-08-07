#!/usr/bin/env node
// scripts/artifact-cards.mjs — regenerate the SVG artifact cards used where
// no honest screenshot exists (see .agents/skills/portfolio-design/SKILL.md).
//
// Rule: cards state only facts that already appear in the entry's copy
// (real commands, real published stats). Never mock a product UI.
//
// Usage: node scripts/artifact-cards.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'portfolio', 'static', 'img');

const CARDS = [
  {
    file: 'work/code-assist.svg',
    eyebrow: 'SHIPPED · GOOGLE MAPS PLATFORM',
    title: 'Code Assist',
    lines: ['agent ▸ tool call ▸ retrieval ▸ official docs'],
    footer: 'works with compatible MCP clients',
  },
  {
    file: 'work/agent-skills.svg',
    eyebrow: 'ONE-COMMAND INSTALL',
    title: 'Agent Skills',
    lines: ['$ npx skills add googlemaps/agent-skills'],
    mono: true,
    footer: 'Web · Android · iOS · Web Services',
  },
  {
    file: 'work/agentic-evals.svg',
    eyebrow: 'THE LAUNCH BAR',
    title: 'Agentic Evals',
    lines: ['task ▸ agent run ▸ score ▸ ship or hold'],
    footer: 'benchmarked against a no-context baseline',
  },
  {
    file: 'work/agentic-growth.svg',
    eyebrow: 'PUBLIC OSS REACH',
    title: '1M+ weekly downloads',
    lines: ['@vis.gl/react-google-maps'],
    footer: 'npm downloads API · verified July 14, 2026',
  },
  {
    file: 'work/voice-of-developer.svg',
    eyebrow: 'DEMAND SENSING',
    title: 'Voice of Developer',
    lines: ['Discord + Stack Overflow + issues + support', '▾', 'ranked roadmap priorities'],
    footer: 'AI does the reading',
  },
  {
    file: 'work/geo-architecture-center.svg',
    eyebrow: 'GEO ARCHITECTURE CENTER',
    title: 'Solution architectures',
    lines: ['public diagrams · guidance · reference implementations'],
    footer: 'developers.google.com/maps/architecture',
  },
  {
    file: 'work/intelligent-product-essentials.svg',
    eyebrow: 'GOOGLE CLOUD · MANUFACTURING',
    title: '0 → launch in 9 months',
    lines: ['Intelligent Product Essentials'],
    footer: 'launched with GE Appliances',
  },
  {
    file: 'work/mapbox-boundaries-atlas.svg',
    eyebrow: 'TWO PRODUCTS, ZERO TO ONE',
    title: 'Boundaries · Atlas',
    lines: ['global boundaries · self-hosted maps'],
    footer: 'both remain in the Mapbox product portfolio',
  },
  {
    file: 'talks/geomob-vibing-with-maps.svg',
    eyebrow: 'GEOMOB SF · APRIL 2025',
    title: 'Vibe with Maps',
    lines: ['concept to prototype, fast'],
    footer: 'three live demos, prompt to working map',
  },
  {
    file: 'talks/visgl-vibe-your-viz.svg',
    eyebrow: 'VIS.GL SUMMIT · SEATTLE · OCT 2025',
    title: 'Vibe your Viz',
    lines: ['growing with AI-native makers'],
    footer: 'deck.gl · kepler.gl · AI-native visualization',
  },
  {
    file: 'talks/code-assist-video.svg',
    eyebrow: 'FIRESIDE CHAT · GOOGLE MAPS PLATFORM',
    title: 'Grounding Agentic Solutions',
    lines: ['trustworthy reasoning with grounded geographic context'],
    footer: 'youtu.be/L2V58kKIHvc',
  },
  {
    file: 'talks/agent-skills-video.svg',
    eyebrow: 'FIRESIDE CHAT · GOOGLE MAPS PLATFORM',
    title: 'Build Maps With AI',
    lines: ['current context · useful workflows · checked results'],
    footer: 'youtu.be/NEk37sPlgaY',
  },
  {
    file: 'writing/this-weeks-learnings.svg',
    eyebrow: 'LINKEDIN FIELD NOTES',
    title: 'Ryan Baumann on LinkedIn',
    lines: ['traces reviewed · evals written · products dogfooded'],
    footer: 'linkedin.com/in/ryanbaumann',
  },
  {
    file: 'writing/vibing-with-maps.svg',
    eyebrow: 'SUBSTACK',
    title: 'Vibing with Maps',
    lines: ['practical experiments'],
    footer: 'ryanbaumann.substack.com',
  },
  {
    file: 'writing/code-assist-launch.svg',
    eyebrow: 'LAUNCH POST · GOOGLE MAPS PLATFORM',
    title: 'Announcing Code Assist',
    lines: ['official platform context for compatible coding agents'],
    footer: 'mapsplatform.google.com',
  },
];

const FLOWS = [
  {
    file: 'scripts/coding-agent-loop.svg',
    layout: 'routing',
    eyebrow: 'OPERATING CONTRACT',
    lead: 'Route by capability, then verify the result',
    routes: ['Tools', 'Fast', 'Balanced', 'Deep'],
    footer: 'explicit scope · one writer · integrated verification',
  },
  {
    file: 'writing/agent-session-diagnostic.svg',
    eyebrow: 'READ THE FIRST FAILURE',
    lead: 'Match the failure to the layer',
    steps: ['Wrong fact\nRetrieval', 'Wrong sequence\nSkill', 'Wrong result\nEval'],
    footer: 'fix one layer, then replay the same task',
  },
  {
    file: 'writing/evals-header.svg',
    eyebrow: 'QUALITY IS A COMPARISON',
    lead: 'Measure the developer task, not the demo',
    steps: ['Field signal', 'Task', 'Baseline', 'Change', 'Delta', 'Decision'],
    footer: 'ship only when the evidence supports it',
  },
  {
    file: 'writing/loop-engineering-evidence.svg',
    eyebrow: 'LOOP ENGINEERING',
    lead: 'Every agent task is a controlled cycle',
    steps: ['Define goal\n+ proof', 'Observe\n+ reproduce', 'Smallest\nchange', 'Nearest\ncheck', 'Integrate\nresults', 'Learn\nor stop'],
    footer: 'evidence decides what happens next',
  },
  {
    file: 'writing/evals-independent-checks.svg',
    eyebrow: 'INDEPENDENT EVALUATION',
    lead: 'One output, separate checks',
    steps: ['Agent output', 'Deterministic\nchecks', 'Separate\ngrader', 'Trace review', 'Ship or hold'],
    footer: 'the optimizer is never its only judge',
  },
];

// Bespoke, low-text art for individual posts. Unlike CARDS/FLOWS, each entry
// draws a purpose-built scene instead of the shared box-and-arrow template, so
// a post's images read as its own rather than one more copy of the house style.
const CUSTOM = [
  { file: 'writing/model-tiers-header.svg', render: 'asymmetry' },
  { file: 'writing/model-tiers-devx.svg', render: 'tierdrop' },
  { file: 'writing/agent-session-header.svg', render: 'retrievalRanking' },
  { file: 'writing/fine-tuning-distribution-pyramid.svg', render: 'distributionPyramid' },
];

const requestedFiles = new Set(process.argv.slice(2));
const knownFiles = new Set([...CARDS, ...FLOWS, ...CUSTOM].map(({ file }) => file));
for (const file of requestedFiles) {
  if (!knownFiles.has(file)) throw new Error(`Unknown artifact card: ${file}`);
}
const selected = ({ file }) => requestedFiles.size === 0 || requestedFiles.has(file);

const escape = (t) => String(t).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

function card({ eyebrow, title, lines, footer, mono }) {
  const W = 1200;
  const H = 675;
  const sans = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
  const monoStack = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";
  const lineCount = lines.length;
  const bodyFont = mono ? monoStack : sans;
  
  // Starting Y for vertical centering (shifted slightly up)
  const contentHeight = 40 /* eyebrow */ + 76 /* title */ + (lineCount * 58) /* lines */;
  const startY = (H - contentHeight) / 2 - 16;
  
  const body = lines
    .map((line, i) => `<text class="body" x="90" y="${startY + 135 + i * 58}" text-anchor="start" font-family="${bodyFont}" font-size="${mono ? 30 : 36}">${escape(line)}</text>`)
    .join('\n  ');

  // Exact tokens from style.css
  const styles = `
    :root {
      --bg: #faf9f6; --surface: #ffffff; --ink: #111827; --muted: #4b5563; --faint: #5f6875;
      --line: #e5e7eb; --accent: #3b82f6; --accent-ink: #2563eb;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #030712; --surface: #111827; --ink: #f9fafb; --muted: #9ca3af; --faint: #aeb7c4;
        --line: #1f2937; --accent: #60a5fa; --accent-ink: #93c5fd;
      }
    }
  `.trim();

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escape(`${eyebrow}: ${title}`)}">
  <style>${styles}
    .surface { fill: var(--surface); }
    .bg { fill: var(--bg); }
    .border { stroke: var(--line); }
    .eyebrow { fill: var(--accent-ink); }
    .title { fill: var(--ink); }
    .body { fill: var(--muted); }
    .footer { fill: var(--faint); }
  </style>
  <rect class="surface" width="${W}" height="${H}"/>
  
  <!-- Subtle schematic grid for infographic vibe -->
  <defs>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M 48 0 L 0 0 0 48" fill="none" class="border" stroke-width="1" opacity="0.35"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#grid)" />
  
  <!-- Subtle top accent -->
  <rect x="0" y="0" width="${W}" height="8" fill="var(--accent)"/>
  
  <!-- Outer border -->
  <rect class="border" x="0" y="0" width="${W}" height="${H}" fill="none" stroke-width="2"/>

  <!-- Content -->
  <text class="eyebrow" x="90" y="${startY + 20}" text-anchor="start" font-family="${monoStack}" font-size="28" font-weight="700" letter-spacing="2">${escape(eyebrow)}</text>
  <text class="title" x="90" y="${startY + 88}" text-anchor="start" font-family="${sans}" font-size="70" font-weight="750" letter-spacing="-2">${escape(title)}</text>
  
  ${body}
  
  <!-- Footer -->
  <line class="border" x1="90" y1="${H - 104}" x2="${W - 90}" y2="${H - 104}" stroke-width="2"/>
  <text class="footer" x="90" y="${H - 58}" text-anchor="start" font-family="${monoStack}" font-size="28">${escape(footer)}</text>
</svg>
`;
}

function flowDiagram({ eyebrow, lead, steps, footer }) {
  const W = 1200;
  const H = 675;
  const columns = steps.length >= 5 ? 3 : 2;
  const gap = columns === 3 ? 55 : 80;
  const nodeWidth = columns === 3 ? 310 : 460;
  const nodeHeight = 128;
  const rowY = [235, 430];
  const nodeFontSize = columns === 3 ? 34 : 40;
  const sans = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
  const mono = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";
  const positions = steps.map((_, index) => {
    const row = Math.floor(index / columns);
    const rowStart = row * columns;
    const count = Math.min(columns, steps.length - rowStart);
    const rowWidth = count * nodeWidth + (count - 1) * gap;
    return {
      row,
      x: (W - rowWidth) / 2 + (index - rowStart) * (nodeWidth + gap),
      y: rowY[row],
    };
  });
  const nodes = steps.map((step, index) => {
    const { row, x, y } = positions[index];
    const lines = step.split('\n');
    const text = lines.map((line, lineIndex) => `<tspan x="${x + nodeWidth / 2}" dy="${lineIndex === 0 ? 0 : 40}">${escape(line)}</tspan>`).join('');
    const next = positions[index + 1];
    let arrow = '';
    if (next?.row === row) {
      arrow = `<path d="M ${x + nodeWidth + 8} ${y + nodeHeight / 2} H ${next.x - 12}" fill="none" stroke="var(--accent)" stroke-width="4" marker-end="url(#arrow)"/>`;
    } else if (next) {
      arrow = `<path d="M ${x + nodeWidth / 2} ${y + nodeHeight + 8} C ${x + nodeWidth / 2} ${y + nodeHeight + 66}, ${next.x + nodeWidth / 2} ${next.y - 66}, ${next.x + nodeWidth / 2} ${next.y - 12}" fill="none" stroke="var(--accent)" stroke-width="4" marker-end="url(#arrow)"/>`;
    }
    return `<g>
      <rect x="${x}" y="${y}" width="${nodeWidth}" height="${nodeHeight}" rx="18" fill="var(--surface)" stroke="var(--line)" stroke-width="2"/>
      <circle cx="${x + 24}" cy="${y + 6}" r="22" fill="var(--accent)"/>
      <text x="${x + 24}" y="${y + 15}" text-anchor="middle" font-family="${mono}" font-size="26" font-weight="700" fill="var(--surface)">${index + 1}</text>
      <text x="${x + nodeWidth / 2}" y="${y + (lines.length === 1 ? 80 : 59)}" text-anchor="middle" font-family="${sans}" font-size="${nodeFontSize}" font-weight="700" fill="var(--ink)">${text}</text>${arrow ? `
      ${arrow}` : ''}
    </g>`;
  }).join('\n  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escape(`${lead}: ${steps.join(', ')}`)}">
  <style>
    :root { --bg: #faf9f6; --surface: #ffffff; --ink: #111827; --faint: #5f6875; --line: #d9dde5; --accent: #3b82f6; --accent-ink: #2563eb; }
    @media (prefers-color-scheme: dark) { :root { --bg: #030712; --surface: #111827; --ink: #f9fafb; --faint: #aeb7c4; --line: #334155; --accent: #60a5fa; --accent-ink: #93c5fd; } }
  </style>
  <defs>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M 48 0 L 0 0 0 48" fill="none" stroke="var(--line)" stroke-width="1" opacity="0.28"/></pattern>
    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent)"/></marker>
  </defs>
  <rect width="${W}" height="${H}" fill="var(--bg)"/>
  <rect width="${W}" height="${H}" fill="url(#grid)"/>
  <rect width="${W}" height="8" fill="var(--accent)"/>
  <text x="70" y="86" font-family="${mono}" font-size="28" font-weight="700" letter-spacing="2" fill="var(--accent-ink)">${escape(eyebrow)}</text>
  <text x="70" y="155" font-family="${sans}" font-size="42" font-weight="750" letter-spacing="-1" fill="var(--ink)">${escape(lead)}</text>
  ${nodes}
  <text x="${W / 2}" y="630" text-anchor="middle" font-family="${mono}" font-size="30" fill="var(--faint)">${escape(footer)}</text>
</svg>
`;
}

function routingDiagram({ eyebrow, lead, routes, footer }) {
  const W = 1200;
  const H = 675;
  const sans = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
  const mono = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";
  const routeNodes = routes.map((route, index) => {
    const y = 216 + index * 86;
    return `<g>
      <path d="M 366 358 C 410 358, 410 ${y + 33}, 460 ${y + 33}" fill="none" stroke="var(--accent)" stroke-width="4" marker-end="url(#arrow)"/>
      <rect x="472" y="${y}" width="290" height="66" rx="16" fill="var(--surface)" stroke="var(--line)" stroke-width="2"/>
      <text x="617" y="${y + 43}" text-anchor="middle" font-family="${sans}" font-size="29" font-weight="700" fill="var(--ink)">${escape(route)}</text>
      <path d="M 774 ${y + 33} C 820 ${y + 33}, 820 358, 862 358" fill="none" stroke="var(--accent)" stroke-width="4" marker-end="url(#arrow)"/>
    </g>`;
  }).join('\n  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escape(`${lead}: orchestrator routes to ${routes.join(', ')}, then integrated verification`)}">
  <style>
    :root { --bg: #faf9f6; --surface: #ffffff; --ink: #111827; --faint: #5f6875; --line: #d9dde5; --accent: #3b82f6; --accent-ink: #2563eb; }
    @media (prefers-color-scheme: dark) { :root { --bg: #030712; --surface: #111827; --ink: #f9fafb; --faint: #aeb7c4; --line: #334155; --accent: #60a5fa; --accent-ink: #93c5fd; } }
  </style>
  <defs>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M 48 0 L 0 0 0 48" fill="none" stroke="var(--line)" stroke-width="1" opacity="0.28"/></pattern>
    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent)"/></marker>
  </defs>
  <rect width="${W}" height="${H}" fill="var(--bg)"/>
  <rect width="${W}" height="${H}" fill="url(#grid)"/>
  <rect width="${W}" height="8" fill="var(--accent)"/>
  <text x="70" y="86" font-family="${mono}" font-size="28" font-weight="700" letter-spacing="2" fill="var(--accent-ink)">${escape(eyebrow)}</text>
  <text x="70" y="155" font-family="${sans}" font-size="42" font-weight="750" letter-spacing="-1" fill="var(--ink)">${escape(lead)}</text>
  <rect x="70" y="254" width="296" height="208" rx="22" fill="var(--surface)" stroke="var(--line)" stroke-width="2"/>
  <text x="218" y="370" text-anchor="middle" font-family="${sans}" font-size="35" font-weight="750" fill="var(--ink)">Orchestrator</text>
  ${routeNodes}
  <rect x="874" y="288" width="256" height="140" rx="22" fill="var(--surface)" stroke="var(--line)" stroke-width="2"/>
  <text x="1002" y="344" text-anchor="middle" font-family="${sans}" font-size="30" font-weight="750" fill="var(--ink)">Integrated</text>
  <text x="1002" y="383" text-anchor="middle" font-family="${sans}" font-size="30" font-weight="750" fill="var(--ink)">verification</text>
  <text x="${W / 2}" y="630" text-anchor="middle" font-family="${mono}" font-size="28" fill="var(--faint)">${escape(footer)}</text>
</svg>
`;
}

const THEME = `
    :root { --bg: #faf9f6; --surface: #ffffff; --ink: #111827; --faint: #5f6875; --line: #d9dde5; --accent: #3b82f6; --accent-ink: #2563eb; }
    @media (prefers-color-scheme: dark) { :root { --bg: #030712; --surface: #111827; --ink: #f9fafb; --faint: #aeb7c4; --line: #334155; --accent: #60a5fa; --accent-ink: #93c5fd; } }`;
const SANS = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

function frame(inner, aria) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" role="img" aria-label="${escape(aria)}">
  <style>${THEME}</style>
  <defs>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M 48 0 L 0 0 0 48" fill="none" stroke="var(--line)" stroke-width="1" opacity="0.28"/></pattern>
    <marker id="tip" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent)"/></marker>
  </defs>
  <rect width="1200" height="675" fill="var(--bg)"/>
  <rect width="1200" height="675" fill="url(#grid)"/>
  <rect width="1200" height="8" fill="var(--accent)"/>
  <rect x="1" y="1" width="1198" height="673" fill="none" stroke="var(--line)" stroke-width="2"/>
  ${inner.trimStart()}
</svg>
`;
}

// One routing policy fanning out to candidate capability profiles. The image
// describes the policy without claiming an unmeasured cost or quality result.
function asymmetryDiagram() {
  const bigCx = 240;
  const bigCy = 385;
  const cols = [770, 960];
  const rows = [250, 336, 422, 508];
  const nodeW = 160;
  const nodeH = 62;
  const workers = [];
  const links = [];
  rows.forEach((y) => cols.forEach((x) => {
    workers.push(`<rect x="${x}" y="${y}" width="${nodeW}" height="${nodeH}" rx="13" fill="var(--surface)" stroke="var(--accent)" stroke-width="2"/>
    <rect x="${x + 18}" y="${y + 26}" width="${nodeW - 36}" height="4" rx="2" fill="var(--accent)" opacity="0.55"/>
    <rect x="${x + 18}" y="${y + 38}" width="${nodeW - 74}" height="4" rx="2" fill="var(--accent)" opacity="0.3"/>`);
    const midY = y + nodeH / 2;
    links.push(`<path d="M 410 ${bigCy} C 560 ${bigCy}, 590 ${midY}, ${x - 10} ${midY}" fill="none" stroke="var(--accent)" stroke-width="2.5" opacity="0.55" marker-end="url(#tip)"/>`);
  }));
  const inner = `
  <text x="70" y="86" font-family="${MONO}" font-size="28" font-weight="700" letter-spacing="2" fill="var(--accent-ink)">ROUTING IS A HYPOTHESIS</text>
  <text x="70" y="152" font-family="${SANS}" font-size="46" font-weight="750" letter-spacing="-1.5" fill="var(--ink)">The policy assigns. The scoreboard decides.</text>

  <text x="240" y="238" text-anchor="middle" font-family="${MONO}" font-size="28" font-weight="700" letter-spacing="1.5" fill="var(--accent-ink)">1 ROUTING POLICY</text>
  ${links.join('\n  ')}
  <rect x="110" y="288" width="260" height="194" rx="26" fill="var(--ink)"/>
  <text x="${bigCx}" y="378" text-anchor="middle" font-family="${SANS}" font-size="46" font-weight="750" fill="var(--bg)">ASSIGN</text>
  <text x="${bigCx}" y="420" text-anchor="middle" font-family="${SANS}" font-size="28" fill="var(--bg)" opacity="0.82">a capability profile</text>

  <text x="865" y="238" text-anchor="middle" font-family="${MONO}" font-size="28" font-weight="700" letter-spacing="1.5" fill="var(--accent-ink)">CANDIDATE RUNS</text>
  ${workers.join('\n  ')}

  <text x="600" y="628" text-anchor="middle" font-family="${MONO}" font-size="28" fill="var(--faint)">measure success · attempts · latency · tokens · cost</text>`;
  return frame(inner, 'One routing policy assigns bounded tasks to candidate capability profiles before success, attempts, latency, tokens, and cost are measured.');
}

// Equal candidate lanes feed the same quality gate and scoreboard. No lane is
// taller, shorter, or visually preferred because no benchmark exists yet.
function tierdropDiagram() {
  const lanes = ['Deep', 'Balanced', 'Fast'].map((label, index) => {
    const y = 278 + index * 104;
    return `<rect x="95" y="${y}" width="250" height="72" rx="16" fill="var(--surface)" stroke="var(--line)" stroke-width="2"/>
    <text x="220" y="${y + 47}" text-anchor="middle" font-family="${SANS}" font-size="30" font-weight="750" fill="var(--ink)">${label}</text>
    <path d="M 357 ${y + 36} H 476" fill="none" stroke="var(--accent)" stroke-width="3" marker-end="url(#tip)"/>`;
  }).join('\n  ');
  const inner = `
  <text x="70" y="86" font-family="${MONO}" font-size="28" font-weight="700" letter-spacing="2" fill="var(--accent-ink)">THE ROUTING SCOREBOARD</text>
  <text x="70" y="152" font-family="${SANS}" font-size="46" font-weight="750" letter-spacing="-1" fill="var(--ink)">Cheaper only counts when quality holds</text>
  <text x="95" y="224" font-family="${SANS}" font-size="28" font-weight="700" fill="var(--faint)">same held-out task · same acceptance checks</text>
  ${lanes}
  <rect x="490" y="316" width="250" height="176" rx="22" fill="var(--surface)" stroke="var(--accent)" stroke-width="3"/>
  <text x="615" y="388" text-anchor="middle" font-family="${MONO}" font-size="28" font-weight="700" fill="var(--accent-ink)">QUALITY</text>
  <text x="615" y="430" text-anchor="middle" font-family="${SANS}" font-size="34" font-weight="750" fill="var(--ink)">Pass or stop</text>
  <path d="M 752 404 H 820" fill="none" stroke="var(--accent)" stroke-width="3" marker-end="url(#tip)"/>
  <rect x="834" y="300" width="280" height="208" rx="22" fill="var(--ink)"/>
  <text x="974" y="358" text-anchor="middle" font-family="${MONO}" font-size="28" font-weight="700" fill="var(--bg)">MEASURE</text>
  <text x="974" y="405" text-anchor="middle" font-family="${SANS}" font-size="29" fill="var(--bg)">retries · latency</text>
  <text x="974" y="449" text-anchor="middle" font-family="${SANS}" font-size="29" fill="var(--bg)">tokens · cost</text>
  <text x="600" y="628" text-anchor="middle" font-family="${MONO}" font-size="28" fill="var(--faint)">publish only after repeated runs clear the quality bar</text>`;
  return frame(inner, 'The same held-out task runs across Deep, Balanced, and Fast profiles while success, retries, latency, tokens, and cost are measured.');
}

function retrievalRankingDiagram() {
  const results = [
    { x: 95, rank: '1', source: 'ECL', score: '0.7244', accent: false },
    { x: 460, rank: '2', source: 'ECL', score: '0.7125', accent: false },
    { x: 825, rank: '3', source: 'REACT', score: '0.7090', accent: true },
  ];
  const cards = results.map(({ x, rank, source, score, accent }) => `<rect x="${x}" y="270" width="280" height="230" rx="22" fill="var(--surface)" stroke="${accent ? 'var(--accent)' : 'var(--line)'}" stroke-width="${accent ? 4 : 2}"/>
  <circle cx="${x + 42}" cy="312" r="25" fill="var(--accent)" opacity="${accent ? 1 : 0.16}"/>
  <text x="${x + 42}" y="322" text-anchor="middle" font-family="${MONO}" font-size="28" font-weight="700" fill="${accent ? 'var(--bg)' : 'var(--accent-ink)'}">${rank}</text>
  <text x="${x + 140}" y="390" text-anchor="middle" font-family="${SANS}" font-size="42" font-weight="750" fill="var(--ink)">${source}</text>
  <text x="${x + 140}" y="445" text-anchor="middle" font-family="${MONO}" font-size="30" fill="var(--faint)">${score}</text>`).join('\n  ');
  const inner = `
  <text x="70" y="86" font-family="${MONO}" font-size="28" font-weight="700" letter-spacing="2" fill="var(--accent-ink)">ONE PUBLIC RETRIEVAL</text>
  <text x="70" y="152" font-family="${SANS}" font-size="46" font-weight="750" letter-spacing="-1" fill="var(--ink)">The first React-library result ranked third</text>
  <text x="95" y="224" font-family="${SANS}" font-size="28" fill="var(--faint)">official sources · current status · no code generated</text>
  ${cards}
  <text x="600" y="628" text-anchor="middle" font-family="${MONO}" font-size="28" fill="var(--faint)">retrieval supplied context · selection still required</text>`;
  return frame(inner, 'One public retrieval ranked two Extended Component Library results first and second and the first React library result third; no code was generated.');
}

function distributionPyramidDiagram() {
  const levels = [
    { y: 210, left: 480, right: 720, label: 'CONTEXT + TOOLS', detail: 'current · controlled · opt-in' },
    { y: 300, left: 385, right: 815, label: 'OWNED ADAPTER', detail: 'learned · model-specific' },
    { y: 390, left: 290, right: 910, label: 'OPEN TRACES + DATA', detail: 'reusable · adoption required' },
    { y: 480, left: 195, right: 1005, label: 'HELD-OUT BENCHMARK', detail: 'comparable · does not train alone' },
  ];
  const shapes = levels.map((level, index) => {
    const next = levels[index + 1] || { left: 100, right: 1100 };
    const fill = index === 0 ? 'var(--ink)' : 'var(--surface)';
    const labelFill = index === 0 ? 'var(--bg)' : 'var(--ink)';
    const detailFill = index === 0 ? 'var(--bg)' : 'var(--faint)';
    return `<path d="M ${level.left} ${level.y} H ${level.right} L ${next.right} ${level.y + 82} H ${next.left} Z" fill="${fill}" stroke="var(--accent)" stroke-width="3"/>
    <text x="600" y="${level.y + 35}" text-anchor="middle" font-family="${MONO}" font-size="28" font-weight="700" fill="${labelFill}">${level.label}</text>
    <text x="600" y="${level.y + 68}" text-anchor="middle" font-family="${SANS}" font-size="28" fill="${detailFill}">${level.detail}</text>`;
  }).join('\n  ');
  const inner = `
  <text x="70" y="76" font-family="${MONO}" font-size="28" font-weight="700" letter-spacing="2" fill="var(--accent-ink)">DEVELOPER-PLATFORM DISTRIBUTION</text>
  <text x="70" y="142" font-family="${SANS}" font-size="46" font-weight="750" letter-spacing="-1" fill="var(--ink)">One API lesson, four distribution paths</text>
  ${shapes}
  <text x="70" y="628" font-family="${MONO}" font-size="28" fill="var(--faint)">MORE DIRECT CONTROL ↑</text>
  <text x="1130" y="628" text-anchor="end" font-family="${MONO}" font-size="28" fill="var(--faint)">MORE POTENTIAL REACH ↓</text>`;
  return frame(inner, 'A four-level developer-platform distribution pyramid moves from context and tools through an owned adapter and open traces to a held-out benchmark, trading direct control for potential reach and dependence on adoption.');
}

const CUSTOM_RENDER = {
  asymmetry: asymmetryDiagram,
  tierdrop: tierdropDiagram,
  retrievalRanking: retrievalRankingDiagram,
  distributionPyramid: distributionPyramidDiagram,
};

for (const spec of CARDS.filter(selected)) {
  const path = join(OUT, spec.file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, card(spec));
  console.log(`[artifact-cards] wrote portfolio/static/img/${spec.file}`);
}

for (const spec of CUSTOM.filter(selected)) {
  const path = join(OUT, spec.file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, CUSTOM_RENDER[spec.render]());
  console.log(`[artifact-cards] wrote portfolio/static/img/${spec.file}`);
}

for (const spec of FLOWS.filter(selected)) {
  const path = join(OUT, spec.file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, spec.layout === 'routing' ? routingDiagram(spec) : flowDiagram(spec));
  console.log(`[artifact-cards] wrote portfolio/static/img/${spec.file}`);
}
