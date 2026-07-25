// Deterministic checks for the subset of the portfolio writing, content, and
// design rules that a regex can decide. Taste stays with portfolio-review; this
// only catches what a reviewer should never have to spend attention on.
//
// Each rule cites the skill that owns it, so a disputed finding is settled by
// editing one file rather than by arguing with the linter.

export const CORE_TAGS = new Set([
  'developer experience', 'ai', 'growth', 'distribution', 'evals', 'open source',
  'product', 'developer tools', 'architecture', 'research', 'maps',
]);

// "a small number of domain-specific terms" (portfolio-content). Listing them
// keeps the door open without letting a synonym in by accident.
export const DOMAIN_TAGS = new Set([
  'field notes', '0→1', 'bigquery', 'code assist', 'data science', 'enterprise',
  'geospatial', 'industry solutions', 'mcp', 'partnerships', 'reference apps',
  'technical writing',
]);

const HYPE = /\b(cutting[- ]edge|revolutionary|innovative|world[- ]class|passionate)\b/i;
const ANNOUNCE = /we(?:'|’)?re\s+excited\s+to\s+announce/i;
const PROSE_META_FIELDS = ['title', 'summary', 'shareTitle', 'shareSummary'];

function parseScalar(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function parseDocument(raw) {
  const lines = raw.split('\n');
  if (lines[0] !== '---') return { meta: {}, metaLines: {}, body: lines, bodyOffset: 0 };
  const end = lines.indexOf('---', 1);
  if (end < 0) return { meta: {}, metaLines: {}, body: lines, bodyOffset: 0 };
  const meta = {};
  const metaLines = {};
  for (let i = 1; i < end; i += 1) {
    const line = lines[i];
    if (line.trimStart().startsWith('#')) continue;
    const separator = line.indexOf(':');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    meta[key] = parseScalar(line.slice(separator + 1).trim());
    metaLines[key] = i + 1;
  }
  return { meta, metaLines, body: lines.slice(end + 1), bodyOffset: end + 1 };
}

// Prose rules must not fire on sample code. A post about writing style can also
// quote a banned word deliberately; `<!-- lint-ignore -->` on the line above
// exempts it.
function prosePassages(body, bodyOffset) {
  const passages = [];
  let inFence = false;
  for (let i = 0; i < body.length; i += 1) {
    const line = body[i];
    if (/^\s*```/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    if (i > 0 && /<!--\s*lint-ignore\s*-->/.test(body[i - 1])) continue;
    passages.push({ text: line, line: bodyOffset + i + 1 });
  }
  return passages;
}

function isHostedEssay(collection, meta, body) {
  return collection === 'writing' && !meta.external && body.join('').trim().length > 0;
}

export function checkDocument({ path, collection, raw }) {
  const findings = [];
  const add = (line, rule, severity, message) => findings.push({ path, line, rule, severity, message });
  const { meta, metaLines, body, bodyOffset } = parseDocument(raw);
  const passages = prosePassages(body, bodyOffset);

  const proseUnits = [
    ...passages,
    ...PROSE_META_FIELDS
      .filter((field) => typeof meta[field] === 'string')
      .map((field) => ({ text: meta[field], line: metaLines[field] })),
  ];

  for (const unit of proseUnits) {
    if (unit.text.includes('—')) {
      add(unit.line, 'W-EMDASH', 'error', 'Em-dash. Use a period, a comma, or a colon (portfolio-writing).');
    }
    if (ANNOUNCE.test(unit.text)) {
      add(unit.line, 'W-ANNOUNCE', 'error', '"We\'re excited to announce" is on the never-write list (portfolio-writing).');
    }
    const hype = HYPE.exec(unit.text);
    if (hype) {
      add(unit.line, 'W-HYPE', 'error', `Hype adjective "${hype[0]}". The evidence carries the excitement (portfolio-writing).`);
    }
  }

  if (collection === 'writing' && typeof meta.image === 'string' && meta.image.startsWith('/previews/')) {
    add(metaLines.image, 'C-GENERIC-PREVIEW', 'error', 'A generic site preview is not a post header. Use a dedicated 1200x675 image (portfolio-content).');
  }

  // shareTitle and shareSummary are concatenated into the staged LinkedIn post
  // (scripts/lib/social-drafts.mjs). A shareSummary copied from summary means the
  // social post ships with no hook of its own.
  if (meta.shareSummary && meta.shareSummary === meta.summary) {
    add(metaLines.shareSummary, 'C-SHARE-DUP', 'error', 'shareSummary repeats summary. It becomes the social post, so give it its own hook (portfolio-writing).');
  }

  if (meta.imageAlt && meta.imageAlt === meta.shareImageAlt) {
    add(metaLines.shareImageAlt, 'C-ALT-DISTINCT', 'error', 'Header and social alt text are identical. Write asset-specific alt text (portfolio-content).');
  }

  if (Array.isArray(meta.tags)) {
    if (meta.tags.length > 3) {
      add(metaLines.tags, 'C-TAGS-COUNT', 'warn', `${meta.tags.length} tags. Use at most three unless a fourth materially improves discovery (portfolio-content).`);
    }
    for (const tag of meta.tags) {
      if (!CORE_TAGS.has(tag) && !DOMAIN_TAGS.has(tag)) {
        add(metaLines.tags, 'C-TAGS-VOCAB', 'warn', `Tag "${tag}" is outside the vocabulary. Reuse an existing tag or add it to DOMAIN_TAGS deliberately (portfolio-content).`);
      }
    }
  }

  if (isHostedEssay(collection, meta, body)) {
    for (const key of ['image', 'imageAlt', 'socialImage', 'shareTitle', 'shareSummary', 'shareImageAlt']) {
      if (!meta[key]) {
        add(1, 'C-ASSETS', 'error', `Hosted essay is missing "${key}". Every essay needs a thesis header, a social card, and their copy (portfolio-content).`);
      }
    }
    const inline = passages.flatMap(({ text }) => [...text.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((m) => m[1]));
    if (!inline.some((src) => src !== meta.image)) {
      add(1, 'C-ASSETS', 'error', 'Hosted essay has no inline evidence image distinct from its header (portfolio-content).');
    }
  }

  return findings;
}

// A distinctive phrase that recurs across posts reads as boilerplate, which is
// how prescribed example strings in the writing skill leaked into the corpus.
const SHINGLE = 6;
const STOCK_PHRASE_FILES = 3;

function shingles(text) {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const out = new Set();
  for (let i = 0; i + SHINGLE <= words.length; i += 1) out.add(words.slice(i, i + SHINGLE).join(' '));
  return out;
}

export function checkStockPhrases(documents) {
  const seen = new Map();
  for (const doc of documents) {
    const { body, bodyOffset } = parseDocument(doc.raw);
    const text = prosePassages(body, bodyOffset).map((p) => p.text).join(' ');
    for (const phrase of shingles(text)) {
      if (!seen.has(phrase)) seen.set(phrase, new Set());
      seen.get(phrase).add(doc.path);
    }
  }
  const findings = [];
  for (const [phrase, files] of seen) {
    if (files.size < STOCK_PHRASE_FILES) continue;
    findings.push({
      path: [...files].sort()[0],
      line: 1,
      rule: 'W-STOCK-PHRASE',
      severity: 'warn',
      message: `"${phrase}" appears in ${files.size} entries. Prescribed phrasings are meanings, not text; vary it (portfolio-writing).`,
    });
  }
  return findings;
}
