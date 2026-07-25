#!/usr/bin/env node
// build.mjs - the entire CMS.
//
// Zero dependencies. Reads flat files from content/ (markdown with a small
// front-matter block, plus site.json), renders static HTML into dist/, and
// copies static/ verbatim. Adding content is adding a file; adding a content
// type is adding an entry to COLLECTIONS below.
//
// Usage:
//   node build.mjs                 # build into dist/
//   BASE_PATH=/portfolio/ node build.mjs   # build for a subpath mount

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)));
const CONTENT_DIR = resolve(process.env.PORTFOLIO_CONTENT_DIR || join(ROOT, 'content'));
const STATIC_DIR = resolve(process.env.PORTFOLIO_STATIC_DIR || join(ROOT, 'static'));
const OUTPUT_DIR = resolve(process.env.PORTFOLIO_DIST_DIR || join(ROOT, 'dist'));
const DIST_DIR = `${OUTPUT_DIR}.building-${process.pid}`;
const BASE = (process.env.BASE_PATH || '/').endsWith('/')
  ? (process.env.BASE_PATH || '/')
  : `${process.env.BASE_PATH}/`;
const WRITER_MODE = process.env.PORTFOLIO_WRITER_MODE === 'true';
const BUILD_TIME = new Date(process.env.PORTFOLIO_BUILD_TIME || Date.now());

if (Number.isNaN(BUILD_TIME.valueOf())) {
  throw new Error('PORTFOLIO_BUILD_TIME must be a valid ISO-8601 timestamp.');
}

// Each collection is a folder of markdown files. Files starting with "_"
// (templates, drafts) are skipped. `listPage` controls whether the
// collection gets its own index page; `detailPages` controls whether
// entries with a body get their own page at /<name>/<slug>/.
const COLLECTIONS = [
  { name: 'work', label: 'Work', listPage: true, detailPages: true },
  { name: 'writing', label: 'Notes', listPage: true, detailPages: true },
  { name: 'talks', label: 'Talks', listPage: true, detailPages: true },
];

const site = JSON.parse(readFileSync(join(CONTENT_DIR, 'site.json'), 'utf8'));
const brand = site.brand || site.name;
const headerBrand = site.headerBrand || brand;
const brandShort = site.brandShort || brand.slice(0, 1);

const validationErrors = [];

function failValidation(message) {
  validationErrors.push(message);
}

function isValidIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function isValidIsoTimestamp(value) {
  if (typeof value !== 'string') return false;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?Z$/);
  if (!match) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return false;
  const [, year, month, day, hour, minute, second = '0', fraction = '0'] = match;
  return parsed.getUTCFullYear() === Number(year)
    && parsed.getUTCMonth() + 1 === Number(month)
    && parsed.getUTCDate() === Number(day)
    && parsed.getUTCHours() === Number(hour)
    && parsed.getUTCMinutes() === Number(minute)
    && parsed.getUTCSeconds() === Number(second)
    && parsed.getUTCMilliseconds() === Number(fraction.padEnd(3, '0'));
}

function isPublished(entry) {
  if (entry.meta.draft === true) return false;
  if (!entry.meta.publishAt) return true;
  return new Date(entry.meta.publishAt).valueOf() <= BUILD_TIME.valueOf();
}

function isValidUrl(value) {
  if (typeof value !== 'string') return false;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'mailto:';
  } catch {
    return false;
  }
}

function pagePathForInternalHref(href) {
  const clean = href.split('#')[0].split('?')[0];
  if (demos.some((demo) => demo.path === clean || demo.path === `${clean}/`)) return null;
  if (!clean || !clean.startsWith('/') || clean.startsWith('//')) return null;
  if (/\.[a-z0-9]+$/i.test(clean)) return join(STATIC_DIR, clean.slice(1));
  return join(DIST_DIR, clean.slice(1), 'index.html');
}

function collectMarkdownLinks(markdown) {
  const links = [];
  const pattern = /!?\[[^\]]*\]\(([^)\s]+)\)/g;
  let match;
  while ((match = pattern.exec(markdown))) links.push(match[1]);
  return links;
}

function validateInternalHref(id, href) {
  if (!href?.startsWith('/')) return;
  const path = pagePathForInternalHref(href);
  if (path && !existsSync(path)) failValidation(`${id}: broken internal link ${href}`);
}

function validateSocialImage(id, meta) {
  if (!meta.socialImage) return;
  if (!meta.shareTitle || !meta.shareSummary || !meta.shareImageAlt) {
    failValidation(`${id}: socialImage requires shareTitle, shareSummary, and shareImageAlt`);
  }
  const imagePath = meta.socialImage.startsWith('/') ? join(STATIC_DIR, meta.socialImage.slice(1)) : null;
  if (!imagePath || !existsSync(imagePath)) {
    failValidation(`${id}: social image asset not found: ${meta.socialImage}`);
    return;
  }
  const { width, height } = getImageDimensions(imagePath);
  if (/\.(png|jpe?g)$/i.test(meta.socialImage) && (width !== 1200 || (height !== 627 && height !== 630))) {
    failValidation(`${id}: raster social image must be 1200x627 or 1200x630: ${meta.socialImage}`);
  }
}

function validateEntry(collection, entry, seenSlugs) {
  const id = `${collection.name}/${entry.slug}`;
  if (seenSlugs.has(id)) failValidation(`${id}: duplicate slug`);
  seenSlugs.add(id);
  const { meta } = entry;
  if (meta.aliases !== undefined) {
    if (!Array.isArray(meta.aliases) || meta.aliases.length === 0) {
      failValidation(`${id}: aliases must be a non-empty array`);
    } else {
      for (const alias of meta.aliases) {
        if (typeof alias !== 'string' || !/^\/[a-z0-9/-]+\/$/.test(alias) || alias.includes('//')) {
          failValidation(`${id}: alias must be a clean root-relative path ending in /: ${alias}`);
        }
      }
    }
    if (meta.external || !hasDetailPage(entry)) {
      failValidation(`${id}: aliases require a generated internal detail page`);
    }
  }
  for (const field of ['title', 'summary']) {
    if (!meta[field] || typeof meta[field] !== 'string') failValidation(`${id}: missing required ${field}`);
  }
  if (meta.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(meta.slug)) failValidation(`${id}: slug must be lowercase kebab-case`);
  if (meta.draft !== undefined && typeof meta.draft !== 'boolean') failValidation(`${id}: draft must be a boolean`);
  if (meta.noindex !== undefined && typeof meta.noindex !== 'boolean') failValidation(`${id}: noindex must be a boolean`);
  if (meta.draft === true && meta.noindex !== true) failValidation(`${id}: drafts must set noindex: true`);
  if (meta.publishAt && !isValidIsoTimestamp(meta.publishAt)) failValidation(`${id}: publishAt must be a UTC ISO-8601 timestamp ending in Z`);
  if (meta.draft !== true && meta.noindex === true && meta.canonical) failValidation(`${id}: published noindex entries should not also set canonical`);
  if (['writing', 'scripts'].includes(collection.name) && !isValidIsoDate(meta.date)) {
    failValidation(`${id}: ${collection.name} date must be YYYY-MM-DD`);
  }
  for (const field of ['external', 'canonical']) {
    if (meta[field] && !isValidUrl(meta[field])) failValidation(`${id}: ${field} must be an https, mailto, or root-relative URL`);
  }
  if (!WRITER_MODE && meta.canonical && !meta.external && hasDetailPage(entry) && meta.canonical.startsWith(site.siteUrl)) {
    const expectedCanonical = absoluteUrl(entryUrl(collection.name, entry));
    if (meta.canonical !== expectedCanonical) {
      failValidation(`${id}: same-site canonical must match the generated detail URL: ${expectedCanonical}`);
    }
  }
  if (meta.image) {
    if (!meta.imageAlt) failValidation(`${id}: imageAlt is required when image is set`);
    const imagePath = meta.image.startsWith('/') ? join(STATIC_DIR, meta.image.slice(1)) : join(CONTENT_DIR, collection.name, meta.image);
    if (!existsSync(imagePath)) failValidation(`${id}: image asset not found: ${meta.image}`);
  }
  validateSocialImage(id, meta);
  if (meta.tags && !Array.isArray(meta.tags)) failValidation(`${id}: tags must be a JSON array`);
  if (meta.updated && !isValidIsoDate(meta.updated)) failValidation(`${id}: updated must be YYYY-MM-DD`);
  for (const link of meta.links || []) {
    if (!link.label || !isValidUrl(link.url)) failValidation(`${id}: links entries require label and valid url`);
    else validateInternalHref(id, link.url);
  }
  for (const href of collectMarkdownLinks(entry.body)) validateInternalHref(id, href);
}

function validatePage(slug, meta, body) {
  const id = `pages/${slug}`;
  for (const field of ['title', 'summary']) {
    if (!meta[field] || typeof meta[field] !== 'string') failValidation(`${id}: missing required ${field}`);
  }
  if (meta.image) {
    if (!meta.imageAlt) failValidation(`${id}: imageAlt is required when image is set`);
    const imagePath = meta.image.startsWith('/') ? join(STATIC_DIR, meta.image.slice(1)) : join(CONTENT_DIR, 'pages', meta.image);
    if (!existsSync(imagePath)) failValidation(`${id}: image asset not found: ${meta.image}`);
  }
  validateSocialImage(id, meta);
  for (const href of collectMarkdownLinks(body)) validateInternalHref(id, href);
}

function validateSite() {
  for (const field of ['name', 'role', 'description', 'siteUrl', 'canonicalHost', 'defaultShareImage']) {
    if (!site[field] || typeof site[field] !== 'string') failValidation(`site.json: missing required ${field}`);
  }
  if (!isValidUrl(site.siteUrl)) failValidation('site.json: siteUrl must be an https URL');
  if (site.siteUrl) {
    try {
      if (new URL(site.siteUrl).host !== site.canonicalHost) failValidation('site.json: canonicalHost must match siteUrl');
    } catch {
      // The URL-specific error above is more useful.
    }
  }
  if (site.defaultShareImage) {
    const imagePath = join(STATIC_DIR, site.defaultShareImage.replace(/^\//, ''));
    if (!existsSync(imagePath)) failValidation(`site.json: defaultShareImage asset not found: ${site.defaultShareImage}`);
    else {
      const { width, height } = getImageDimensions(imagePath);
      if (/\.(png|jpe?g)$/i.test(site.defaultShareImage) && (width !== 1200 || (height !== 627 && height !== 630))) {
        failValidation('site.json: raster defaultShareImage must be 1200x627 or 1200x630');
      }
    }
  }
}

function assertValidBuild() {
  if (!validationErrors.length) return;
  console.error('[portfolio] content validation failed:');
  for (const error of validationErrors) console.error(`- ${error}`);
  rmSync(DIST_DIR, { recursive: true, force: true });
  process.exit(1);
}


// Live demo apps. The manifest is the repo-root apps.json (the same file the
// gateway routes from), so a demo added there shows up here on the next
// build with zero portfolio changes. When this site is extracted into its
// own repo (no ../apps.json), the demos section and nav item simply
// disappear - nothing else breaks.
function loadDemos() {
  const manifestPath = resolve(process.env.PORTFOLIO_APPS_MANIFEST || join(ROOT, '..', 'apps.json'));
  if (!existsSync(manifestPath)) return [];
  try {
    const entries = JSON.parse(readFileSync(manifestPath, 'utf8'));
    // The portfolio itself is listed in the manifest (it's how the gateway
    // mounts this site at "/"); everything else is a demo.
    return entries.filter((entry) =>
      entry.path !== '/' && entry.name !== 'fieldwork' && (entry.visibility || 'public') === 'public');
  } catch {
    return [];
  }
}

const demos = loadDemos();

// ---------------------------------------------------------------------------
// Front matter: a leading block delimited by --- lines, one `key: value` per
// line. Values that parse as JSON (arrays, objects, booleans, numbers) are
// used as-is; everything else is a string.
// ---------------------------------------------------------------------------

function parseFrontMatter(raw) {
  const meta = {};
  if (!raw.startsWith('---')) return { meta, body: raw.trim() };
  const end = raw.indexOf('\n---', 3);
  if (end === -1) return { meta, body: raw.trim() };
  const block = raw.slice(raw.indexOf('\n') + 1, end);
  for (const line of block.split('\n')) {
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (!key) continue;
    try {
      meta[key] = JSON.parse(value);
    } catch {
      meta[key] = value;
    }
  }
  return { meta, body: raw.slice(end + 4).trim() };
}

// ---------------------------------------------------------------------------
// Markdown: the small subset the content actually uses - headings, bold,
// italic, inline code, links, images, lists, blockquotes, fenced code, hr.
// ---------------------------------------------------------------------------

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

// Content authors write site-internal links root-relative (`/work/`,
// `/decks/foo.pdf`); rebase them onto BASE_PATH so the same content works
// at the domain root and mounted under a subpath.
function rebase(href) {
  if (href.startsWith('/') && !href.startsWith('//')) return BASE + href.slice(1);
  return href;
}

function inlineMd(text) {
  let html = escapeHtml(text);
  html = html.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => {
    const localPath = src.startsWith('/') ? join(STATIC_DIR, src.slice(1)) : null;
    const { width, height } = localPath && existsSync(localPath) ? getImageDimensions(localPath) : { width: 960, height: 600 };
    return `<img src="${rebase(src)}" alt="${alt}" loading="lazy" width="${width}" height="${height}" />`;
  });
  html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
    const external = /^https?:\/\//.test(href);
    return `<a href="${rebase(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>`;
  });
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return html;
}

function markdownToHtml(markdown) {
  const lines = markdown.split('\n');
  const out = [];
  let index = 0;
  const headingIds = new Set();

  function headingId(rawHeading) {
    const explicit = rawHeading.match(/\s+\{#([a-z][a-z0-9-]*)\}\s*$/i);
    const label = explicit ? rawHeading.slice(0, explicit.index).trim() : rawHeading.trim();
    const base = explicit?.[1].toLowerCase()
      || label.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/[\s-]+/g, '-')
      || 'section';
    let id = base;
    let suffix = 2;
    while (headingIds.has(id)) id = `${base}-${suffix++}`;
    headingIds.add(id);
    return { id, label };
  }

  while (index < lines.length) {
    const line = lines[index];

    if (line.startsWith('```')) {
      const language = line.slice(3).trim().replace(/[^a-z0-9_-]/gi, '');
      const code = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith('```')) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1;
      out.push(`<pre><code${language ? ` class="language-${language}"` : ''}>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      const level = Math.min(Math.max(heading[1].length, 2), 5); // page h1 is the title
      const { id, label } = headingId(heading[2]);
      out.push(`<h${level} id="${id}"><a class="heading-anchor" href="#${id}" aria-label="Link to this section">${inlineMd(label)}</a></h${level}>`);
      index += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      out.push('<hr />');
      index += 1;
      continue;
    }

    if (line.includes('|') && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1] || '')) {
      const cells = (value) => value.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
      const headers = cells(line);
      index += 2;
      const rows = [];
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
        rows.push(cells(lines[index]));
        index += 1;
      }
      out.push(`<div class="table-scroll"><table><thead><tr>${headers.map((cell) => `<th>${inlineMd(cell)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((_, cellIndex) => `<td>${inlineMd(row[cellIndex] || '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        items.push(`<li>${inlineMd(lines[index].replace(/^\s*[-*]\s+/, ''))}</li>`);
        index += 1;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(`<li>${inlineMd(lines[index].replace(/^\s*\d+\.\s+/, ''))}</li>`);
        index += 1;
      }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    if (line.startsWith('> ')) {
      const quote = [];
      while (index < lines.length && lines[index].startsWith('> ')) {
        quote.push(inlineMd(lines[index].slice(2)));
        index += 1;
      }
      out.push(`<blockquote><p>${quote.join('<br />')}</p></blockquote>`);
      continue;
    }

    if (line.trim() === '') {
      index += 1;
      continue;
    }

    const paragraph = [];
    while (index < lines.length && lines[index].trim() !== '' && !/^(#{1,4}\s|```|>\s|\s*[-*]\s|\s*\d+\.\s)/.test(lines[index])) {
      paragraph.push(lines[index]);
      index += 1;
    }
    out.push(`<p>${inlineMd(paragraph.join(' '))}</p>`);
  }

  return out.join('\n');
}

// ---------------------------------------------------------------------------
// Content loading
// ---------------------------------------------------------------------------

function loadCollection(name) {
  const dir = join(CONTENT_DIR, name);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.endsWith('.md') && !file.startsWith('_'))
    .map((file) => {
      const fileSlug = file.replace(/\.md$/, '');
      const raw = readFileSync(join(dir, file), 'utf8');
      const { meta, body } = parseFrontMatter(raw);
      const slug = meta.slug || fileSlug;
      return { slug, sourceSlug: fileSlug, meta, body, raw, collection: name };
    })
    .sort((a, b) => {
      return String(b.meta.date || '').localeCompare(String(a.meta.date || ''));
    });
}

function entryUrl(collection, entry) {
  if (entry.meta.external) return entry.meta.external;
  return `${BASE}${collection}/${entry.slug}/`;
}

function hasDetailPage(entry) {
  return !entry.meta.external && entry.body.length > 0;
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

const CSS = readFileSync(join(ROOT, 'style.css'), 'utf8');

function layout({ title, description, content, active = '', canonical, ogImage, ogImageAlt, shareTitle, shareSummary, ogType, articleDate, articleUpdated, robots, jsonLd, contactDelivery }) {
  const navItems = [
    { href: `${BASE}writing/`, label: 'Notes', key: 'writing' },
    { href: `${BASE}work/`, label: 'Work', key: 'work' },
    { href: `${BASE}talks/`, label: 'Talks', key: 'talks' },
    ...(demos.length ? [{ href: `${BASE}demos/`, label: 'Labs', key: 'demos' }] : []),
    { href: `${BASE}about/`, label: 'About', key: 'about' },
  ];
  const nav = navItems
    .map((item) => `<a href="${item.href}" class="nav-${item.key}"${item.key === active ? ' aria-current="page"' : ''}>${item.label}</a>`)
    .join('');

  const resolvedCanonical = canonical || absoluteUrl('/');
  const resolvedImage = absoluteUrl(ogImage || site.defaultShareImage);
  const resolvedImageAlt = escapeHtml(ogImage
    ? (ogImageAlt || `${site.name} - ${site.role}`)
    : (site.defaultShareImageAlt || `${site.name} - ${site.role}`));
  const resolvedShareTitle = shareTitle || title;
  const resolvedShareSummary = shareSummary || description;
  const resolvedOgType = ogType || 'website';
  const socialHandle = site.socialHandle || '';
  const twitterCardType = 'summary_large_image';
  const localImage = ogImage || site.defaultShareImage;
  const localImagePath = localImage?.startsWith('/') ? join(STATIC_DIR, localImage.slice(1)) : null;
  const imageDimensions = localImagePath && existsSync(localImagePath) ? getImageDimensions(localImagePath) : null;
  const imageMime = localImage?.endsWith('.png') ? 'image/png' : localImage?.match(/\.jpe?g$/i) ? 'image/jpeg' : localImage?.endsWith('.webp') ? 'image/webp' : localImage?.endsWith('.svg') ? 'image/svg+xml' : null;

  const canonicalTag = `<link rel="canonical" href="${escapeHtml(resolvedCanonical)}" />`;
  const ogUrlTag = `<meta property="og:url" content="${escapeHtml(resolvedCanonical)}" />`;
  const ogImageTag = `<meta property="og:image" content="${escapeHtml(resolvedImage)}" />`;
  const ogImageAltTag = `<meta property="og:image:alt" content="${resolvedImageAlt}" />`;
  const ogImageDetails = [
    imageDimensions ? `<meta property="og:image:width" content="${imageDimensions.width}" />` : '',
    imageDimensions ? `<meta property="og:image:height" content="${imageDimensions.height}" />` : '',
    imageMime ? `<meta property="og:image:type" content="${imageMime}" />` : '',
  ].filter(Boolean).join('\n');

  const twitterTags = [
    `<meta name="twitter:card" content="${twitterCardType}" />`,
    socialHandle ? `<meta name="twitter:site" content="${escapeHtml(socialHandle)}" />` : '',
    `<meta name="twitter:title" content="${escapeHtml(resolvedShareTitle)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(resolvedShareSummary)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(resolvedImage)}" />`,
    `<meta name="twitter:image:alt" content="${resolvedImageAlt}" />`,
  ].filter(Boolean).join('\n');

  const articleTags = resolvedOgType === 'article'
    ? [
        articleDate ? `<meta property="article:published_time" content="${escapeHtml(articleDate)}T00:00:00Z" />` : '',
        articleUpdated ? `<meta property="article:modified_time" content="${escapeHtml(articleUpdated)}T00:00:00Z" />` : '',
        `<meta property="article:author" content="${escapeHtml(site.name)}" />`,
      ].filter(Boolean).join('\n')
    : '';

  const robotsTag = WRITER_MODE
    ? '<meta name="robots" content="noindex, nofollow" />'
    : robots ? `<meta name="robots" content="${escapeHtml(robots)}" />` : '';

  const jsonLdTag = jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : '';
  const contactDeliveryTag = contactDelivery ? `<meta name="contact-delivery" content="${escapeHtml(contactDelivery)}" />` : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
${canonicalTag}
<meta property="og:title" content="${escapeHtml(resolvedShareTitle)}" />
<meta property="og:description" content="${escapeHtml(resolvedShareSummary)}" />
<meta property="og:site_name" content="${escapeHtml(brand)}" />
<meta property="og:type" content="${escapeHtml(resolvedOgType)}" />
${ogUrlTag}
${ogImageTag}
${ogImageAltTag}
${ogImageDetails}
${twitterTags}
${articleTags ? articleTags + '\n' : ''}<link rel="icon" href="${BASE}favicon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="${BASE}apple-touch-icon.png" />
<meta name="thumbnail" content="${BASE}img/ryan-baumann-profile.jpg" />
<link rel="alternate" type="application/rss+xml" title="${escapeHtml(site.name)} Writing" href="${absoluteUrl('/feed.xml')}" />
${robotsTag ? robotsTag + '\n' : ''}${contactDeliveryTag ? contactDeliveryTag + '\n' : ''}${jsonLdTag ? jsonLdTag + '\n' : ''}<script>try{const t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;}catch{}</script>
<style>${CSS}</style>
${analyticsMarkup()}
</head>
<body id="top">
<a class="skip-link" href="#main">Skip to content</a>
${WRITER_MODE ? '<div class="writer-banner" role="status">Private writer preview. Nothing here is indexed.</div>' : ''}
<header class="site-header">
  <div class="site-branding">
  <a class="site-name" href="${BASE}" aria-label="${escapeHtml(brand)} home"><span class="site-name-full">${escapeHtml(headerBrand)}</span><span class="site-name-short" aria-hidden="true">${escapeHtml(brandShort)}</span></a>
  </div>
  <div class="site-nav-frame">
    <nav class="site-nav" aria-label="Primary">
    ${nav}
    </nav>
  </div>
  <div class="header-actions">
    <a class="header-contact${active === 'contact' ? ' is-active' : ''}" href="${BASE}contact/"${active === 'contact' ? ' aria-current="page"' : ''}>Contact</a>
    <button class="theme-toggle" type="button" aria-label="Color theme: system. Activate to use light."><span aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="13" rx="2"></rect><path d="M8 21h8M12 17v4"></path></svg></span></button>
  </div>
</header>
<main id="main" class="site-main">
${content}
</main>
<footer class="site-footer">
  <p>&copy; <span>${new Date().getFullYear()}</span> ${escapeHtml(site.brandByline || `${brand} by ${site.name}`)}</p>
  <p class="footer-links">
    <a href="${site.links.github}" target="_blank" rel="noopener noreferrer">GitHub</a>
    <a href="${site.links.linkedin}" target="_blank" rel="noopener noreferrer">LinkedIn</a>
    ${site.links.x ? `<a href="${site.links.x}" target="_blank" rel="noopener noreferrer">X</a>` : ''}
    ${site.links.substack ? `<a href="${site.links.substack}" target="_blank" rel="noopener noreferrer">Substack</a>` : ''}
    <a href="${BASE}talks/">Talks</a>
    ${demos.length ? `<a href="${BASE}demos/">Labs</a>` : ''}
    <a href="${BASE}resume/">Resume</a>
    <a href="${BASE}privacy/">Privacy</a>
    <a href="${BASE}contact/">Contact</a>
  </p>
</footer>
<script>(()=>{const b=document.querySelector('.theme-toggle');if(!b)return;const states=['system','light','dark'];const icons={system:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="13" rx="2"></rect><path d="M8 21h8M12 17v4"></path></svg>',light:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"></path></svg>',dark:'<svg viewBox="0 0 24 24"><path d="M20.5 14.1A8.5 8.5 0 0 1 9.9 3.5a8.5 8.5 0 1 0 10.6 10.6Z"></path></svg>'};const sync=()=>{const current=document.documentElement.dataset.theme||'system';const next=states[(states.indexOf(current)+1)%states.length];b.querySelector('span').innerHTML=icons[current];b.setAttribute('aria-label','Color theme: '+current+'. Activate to use '+next+'.')};b.addEventListener('click',()=>{const current=document.documentElement.dataset.theme||'system';const next=states[(states.indexOf(current)+1)%states.length];if(next==='system'){delete document.documentElement.dataset.theme;localStorage.removeItem('theme')}else{document.documentElement.dataset.theme=next;localStorage.setItem('theme',next)}sync()});sync()})();</script>
</body>
</html>
`;
}

function analyticsMarkup() {
  if (WRITER_MODE) return '';
  const measurementId = String(process.env.ANALYTICS_MEASUREMENT_ID || site.analyticsMeasurementId || '');
  if (!measurementId) return '';
  const canonicalHost = String(site.canonicalHost || '');
  return `<!-- Google tag (gtag.js) -->
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}

  const canonicalHost=${JSON.stringify(canonicalHost)};
  const debug=new URLSearchParams(location.search).get('analytics_debug')==='1';
  const hostAllowed=location.hostname===canonicalHost||debug;

  if (hostAllowed) {
    const analyticsScript=document.createElement('script');
    analyticsScript.async=true;
    analyticsScript.src='https://www.googletagmanager.com/gtag/js?id=${measurementId}';
    document.head.appendChild(analyticsScript);
    gtag('js', new Date());
    gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'granted'});
    gtag('set','ads_data_redaction',true);
    gtag('config', '${measurementId}', {send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false});
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!hostAllowed) return;

    const sanitizedLocation=location.origin+location.pathname;
    const sanitizedReferrer=()=>{try{const value=new URL(document.referrer);return value.origin===location.origin?value.origin+value.pathname:''}catch{return ''}};
    const event=(name,params)=>{if(window.gtag)window.gtag('event',name,params||{})};
    const cleanCampaignValue=(value)=>/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(value||'')?value.toLowerCase():'';
    const query=new URLSearchParams(location.search);
    const campaign={campaign_source:cleanCampaignValue(query.get('utm_source')),campaign_medium:cleanCampaignValue(query.get('utm_medium')),campaign_name:cleanCampaignValue(query.get('utm_campaign')),campaign_content:cleanCampaignValue(query.get('utm_content'))};
    for(const key of Object.keys(campaign)){if(!campaign[key])delete campaign[key]}

    event('page_view',{page_location:sanitizedLocation,page_referrer:sanitizedReferrer(),...campaign});

    const delivered=document.querySelector('meta[name="contact-delivery"][content="success"]')&&new URLSearchParams(location.search).get('delivered')==='1';
    if(delivered&&!sessionStorage.getItem('contact-lead-recorded')){
      event('generate_lead',{currency:'USD',value:0});
      sessionStorage.setItem('contact-lead-recorded','1');
    }
    const subscribed=location.pathname.endsWith('/subscribed/')&&query.get('ok')==='1';
    if(subscribed&&!sessionStorage.getItem('field-notes-sign-up-recorded')){
      event('sign_up',{method:'field_notes'});
      sessionStorage.setItem('field-notes-sign-up-recorded','1');
    }

    let formStarted=false;
    document.querySelector('.contact-form')?.addEventListener('focusin',()=>{if(!formStarted){formStarted=true;event('form_start',{form_id:'portfolio_contact'})}});
    document.querySelector('.contact-form')?.addEventListener('submit',()=>event('form_submit',{form_id:'portfolio_contact'}));

    document.addEventListener('click',(click)=>{
      const link=click.target.closest('[data-analytics-type][data-analytics-id]');
      if(link)event('select_content',{content_type:link.dataset.analyticsType,content_id:link.dataset.analyticsId});
      const share=click.target.closest('[data-analytics-share]');
      if(share)event('share',{method:share.dataset.analyticsShare,content_type:'page',item_id:location.pathname});
    });
  });
</script>`;
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function metaLine(parts) {
  return parts.filter(Boolean).map((part) => escapeHtml(part)).join(' · ');
}

function linkChips(links = []) {
  if (!links.length) return '';
  const chips = links
    .map((link) => {
      const external = link.url.startsWith('http');
      return `<a class="chip" href="${rebase(link.url)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escapeHtml(link.label)} ↗</a>`;
    })
    .join('');
  return `<p class="chips">${chips}</p>`;
}

function getImageDimensions(imagePath) {
  if (!imagePath) return { width: 960, height: 600 };
  
  if (imagePath.endsWith('.svg')) {
    try {
      const content = readFileSync(imagePath, 'utf8');
      const viewBoxMatch = content.match(/viewBox=["']\d+\s+\d+\s+(\d+)\s+(\d+)["']/i);
      if (viewBoxMatch) {
        return { width: parseInt(viewBoxMatch[1], 10), height: parseInt(viewBoxMatch[2], 10) };
      }
      const widthMatch = content.match(/width=["'](\d+)["']/i);
      const heightMatch = content.match(/height=["'](\d+)["']/i);
      if (widthMatch && heightMatch) {
        return { width: parseInt(widthMatch[1], 10), height: parseInt(heightMatch[2], 10) };
      }
    } catch (e) {
      console.warn(`[build.mjs] failed to parse SVG dimensions for ${imagePath}:`, e.message);
    }
    return { width: 960, height: 600 };
  }

  if (imagePath.endsWith('.jpg') || imagePath.endsWith('.jpeg')) {
    try {
      const buffer = readFileSync(imagePath);
      let offset = 2;
      while (offset < buffer.length - 8) {
        const markerType = buffer.readUInt16BE(offset);
        if ((markerType & 0xFF00) !== 0xFF00 || markerType === 0xFFFF) {
          offset += 1;
          continue;
        }
        offset += 2;
        if (markerType === 0xFFD9 || markerType === 0xFFDA) {
          break;
        }
        const length = buffer.readUInt16BE(offset);
        if (markerType === 0xFFC0 || markerType === 0xFFC2) {
          const height = buffer.readUInt16BE(offset + 3);
          const width = buffer.readUInt16BE(offset + 5);
          return { width, height };
        }
        offset += length;
      }
    } catch (e) {
      console.warn(`[build.mjs] failed to parse JPG dimensions for ${imagePath}:`, e.message);
    }
  }

  if (imagePath.endsWith('.png')) {
    try {
      const buffer = readFileSync(imagePath);
      const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
      if (buffer.length >= 24 && buffer.subarray(0, 8).equals(signature)) {
        return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
      }
    } catch (e) {
      console.warn(`[build.mjs] failed to parse PNG dimensions for ${imagePath}:`, e.message);
    }
  }

  return { width: 960, height: 600 };
}

function gridCard(collection, entry) {
  const { meta } = entry;
  const imagePath = meta.image ? join(STATIC_DIR, meta.image.replace(/^\//, '')) : '';
  const imageSize = meta.image ? getImageDimensions(imagePath) : null;
  const url = meta.external
    ? rebase(meta.external)
    : hasDetailPage(entry)
      ? entryUrl(collection, entry)
      : rebase(meta.links?.[0]?.url || `${BASE}${collection}/`);
  const external = !hasDetailPage(entry) && /^https?:/.test(url);
  const formattedDate = meta.date ? formatLongDate(meta.date) : meta.period;
  const cardMeta = `<p class="card-meta">${metaLine([meta.venue || meta.org, meta.type, formattedDate])}</p>
  <h3>${escapeHtml(meta.title)}</h3>
  <p>${escapeHtml(meta.summary || '')}</p>
  ${meta.tags ? `<p class="card-tags">${meta.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</p>` : ''}`;
  if (meta.image) {
    return `<a class="card grid-card has-thumb" href="${url}" data-analytics-type="${escapeHtml(collection)}" data-analytics-id="${escapeHtml(entry.slug)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>
  <img class="card-thumb" src="${rebase(meta.image)}" alt="${escapeHtml(meta.imageAlt || meta.title)}" loading="lazy" width="${imageSize.width}" height="${imageSize.height}" />
  <div class="card-body">
  ${cardMeta}
  </div>
</a>`;
  }
  return `<a class="card" href="${url}" data-analytics-type="${escapeHtml(collection)}" data-analytics-id="${escapeHtml(entry.slug)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>
  ${cardMeta}
</a>`;
}

function listRow(collection, entry) {
  const { meta } = entry;
  const url = entryUrl(collection, entry);
  const external = Boolean(meta.external);
  const clickable = external || hasDetailPage(entry);
  const title = `${escapeHtml(meta.title)}${external ? ' ↗' : ''}`;
  const imagePath = meta.image ? join(STATIC_DIR, meta.image.replace(/^\//, '')) : '';
  const imageSize = meta.image ? getImageDimensions(imagePath) : null;
  const thumb = meta.image
    ? `<img class="row-thumb" src="${rebase(meta.image)}" alt="${escapeHtml(meta.imageAlt || meta.title)}" loading="lazy" width="${imageSize.width}" height="${imageSize.height}" />`
    : '';
  const rowContent = `${thumb}
  <div>
    <p class="row-title">${title}</p>
    <p class="row-summary">${escapeHtml(meta.summary || '')}</p>
    ${linkChips(clickable ? [] : meta.links)}
  </div>
  <p class="row-meta">${metaLine([meta.venue || meta.org, meta.type, meta.date || meta.period])}</p>`;
  if (clickable) {
    return `<li>
  <a class="row" href="${url}" data-analytics-type="${escapeHtml(collection)}" data-analytics-id="${escapeHtml(entry.slug)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>
  ${rowContent}
  </a>
</li>`;
  }
  return `<li class="row">
  ${rowContent}
</li>`;
}

function demoCard(demo) {
  const tags = (demo.tags || []).length
    ? `<p class="card-tags">${demo.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</p>`
    : '';
  const previewPath = demo.preview ? join(STATIC_DIR, demo.preview.replace(/^\//, '')) : null;
  const previewSize = previewPath && existsSync(previewPath) ? getImageDimensions(previewPath) : { width: 960, height: 600 };
  const preview = demo.preview
    ? `<img class="demo-preview" src="${rebase(demo.preview)}" alt="Screenshot of ${escapeHtml(demo.title)}" loading="lazy" width="${previewSize.width}" height="${previewSize.height}" />`
    : '';
  const external = demo.path.startsWith('http');
  return `<a class="card demo-card" href="${rebase(demo.path)}" data-analytics-type="demo" data-analytics-id="${escapeHtml(demo.name)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>
  ${preview}
  <div class="demo-body">
    <h3>${escapeHtml(demo.title)}</h3>
    <p>${escapeHtml(demo.description || '')}</p>
    ${tags}
    <span class="demo-action">Launch demo →</span>
  </div>
</a>`;
}

function formatLongDate(isoDate) {
  if (!isoDate) return '';
  const parsed = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf())) return '';
  return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

// Featured Field Note: a single large card (image left, text right) for the
// latest essay on the homepage. Falls back to the row list for a plain link.
function featuredNote(entry) {
  const { meta } = entry;
  const url = entryUrl('writing', entry);
  const external = Boolean(meta.external);
  const image = meta.socialImage || meta.image;
  const imagePath = image ? join(STATIC_DIR, image.replace(/^\//, '')) : '';
  const { width, height } = image && existsSync(imagePath) ? getImageDimensions(imagePath) : { width: 1200, height: 627 };
  const longDate = formatLongDate(meta.date);
  const thumb = image
    ? `<img class="featured-note-thumb" src="${rebase(image)}" alt="${escapeHtml(meta.shareImageAlt || meta.imageAlt || meta.title)}" loading="lazy" width="${width}" height="${height}" />`
    : '';
  return `<a class="featured-note" href="${url}" data-analytics-type="writing" data-analytics-id="${escapeHtml(entry.slug)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>
  ${thumb}
  <div class="featured-note-body">
    <p class="featured-note-meta">${longDate ? `Featured · ${escapeHtml(longDate)}` : 'Featured'}</p>
    <h3>${escapeHtml(meta.title)}${external ? ' ↗' : ''}</h3>
    <p>${escapeHtml(meta.summary || '')}</p>
    <span class="featured-note-action">Read the note →</span>
  </div>
</a>`;
}

function sectionHeader(eyebrow, title, moreHref, moreLabel) {
  return `<div class="section-header">
  <div>${eyebrow ? `<p class="eyebrow">${escapeHtml(eyebrow)}</p>` : ''}${title ? `<h2>${escapeHtml(title)}</h2>` : ''}</div>
  ${moreHref ? `<a class="more" href="${moreHref}">${escapeHtml(moreLabel)} →</a>` : ''}
</div>`;
}

function shareLinks(pageUrl, title) {
  const encodedUrl = encodeURIComponent(pageUrl);
  const encodedTitle = encodeURIComponent(title);
  const linkedIn = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
  const email = `mailto:?subject=${encodedTitle}&body=${encodedUrl}`;
  return `<p class="share-links">
  <span class="share-label">Share</span>
  <a class="chip" href="${linkedIn}" target="_blank" rel="noopener noreferrer" aria-label="Share on LinkedIn" data-analytics-share="linkedin">LinkedIn</a>
  <a class="chip" href="${email}" aria-label="Share via email" data-analytics-share="email">Email</a>
</p>`;
}

// Email-list signup. Plain form POST to the gateway's /api/subscribe route
// (Resend contact, segment, and topic) — works with zero client JavaScript. Sends go out from
// the Resend dashboard whenever there is something worth announcing.
function subscribeSection() {
  return `<section class="subscribe" aria-labelledby="subscribe-title">
  <p class="eyebrow">Email list</p>
  <h2 id="subscribe-title">Get new field notes by email</h2>
  <p>One email when a new essay, talk, or Labs project ships. No noise, and every send has a one-click unsubscribe.</p>
  <form class="subscribe-form" action="${BASE}api/subscribe" method="post">
    <label for="subscribe-email">Email address</label>
    <div class="subscribe-controls">
      <input id="subscribe-email" name="email" type="email" autocomplete="email" maxlength="200" placeholder="you@example.com" required />
      <button class="button button-primary" type="submit">Subscribe</button>
    </div>
    <div class="contact-honeypot" aria-hidden="true">
      <label>Company fax number <input name="company_fax_number" tabindex="-1" autocomplete="off" /></label>
    </div>
  </form>
  <p class="section-note">The address is stored only to deliver these updates. See <a href="${BASE}privacy/">Privacy</a>.</p>
</section>`;
}

// Reader comments on field notes via giscus, which stores each thread as a
// GitHub Discussion on the portfolio repo — readers sign in with GitHub
// inside the widget. Renders nothing until site.json's comments block has
// the repoId/categoryId values from https://giscus.app, so the site stays
// inert (and script-free) until comments are deliberately switched on.
// This is the one sanctioned third-party embed; see the portfolio-design
// skill before adding others. Skipped in the private writer preview.
function commentsSection() {
  const comments = site.comments || {};
  const configured = comments.provider === 'giscus'
    && comments.repo && comments.repoId && comments.category && comments.categoryId;
  if (!configured || WRITER_MODE) return '';
  const config = {
    'data-repo': comments.repo,
    'data-repo-id': comments.repoId,
    'data-category': comments.category,
    'data-category-id': comments.categoryId,
    'data-mapping': 'pathname',
    'data-strict': '0',
    'data-reactions-enabled': '1',
    'data-emit-metadata': '0',
    'data-input-position': 'bottom',
    'data-lang': 'en',
    'data-loading': 'lazy',
  };
  const configJson = JSON.stringify(config).replaceAll('<', '\\u003c');
  return `<section class="comments" aria-labelledby="comments-title">
  <p class="eyebrow">Discussion</p>
  <h2 id="comments-title">Comments</h2>
  <p class="section-note">Comments are GitHub Discussions rendered by <a href="https://giscus.app" target="_blank" rel="noopener noreferrer">giscus</a>. Sign in with GitHub inside the widget to post or react.</p>
  <div class="giscus"></div>
  <script>(()=>{const config=${configJson};const theme=()=>({light:'light',dark:'dark'})[document.documentElement.dataset.theme]||'preferred_color_scheme';const mount=document.querySelector('.giscus');const script=document.createElement('script');script.src='https://giscus.app/client.js';script.async=true;script.crossOrigin='anonymous';for(const [key,value] of Object.entries(config))script.setAttribute(key,value);script.setAttribute('data-theme',theme());mount.appendChild(script);new MutationObserver(()=>{const frame=document.querySelector('iframe.giscus-frame');if(frame)frame.contentWindow.postMessage({giscus:{setConfig:{theme:theme()}}},'https://giscus.app')}).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']})})();</script>
</section>`;
}

function jsonLdPerson() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: site.name,
    jobTitle: site.role,
    url: absoluteUrl('/'),
    description: site.answerEngineSummary || site.description,
    knowsAbout: [
      'developer platforms',
      'developer experience',
      'developer experience engineering',
      'developer product leadership',
      'agent-ready documentation',
      'model context protocol',
      'agentic evals',
      'AI-native developer tools',
      'Google Maps Platform',
      'geospatial applications',
    ],
    sameAs: [
      site.links.github,
      site.links.linkedin,
      site.links.x,
      site.links.substack,
    ].filter(Boolean),
    image: absoluteUrl(site.profileImage || site.defaultShareImage),
  };
}

function jsonLdWebSite() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: brand,
    url: absoluteUrl('/'),
    description: site.answerEngineSummary || site.description,
    author: { '@type': 'Person', name: site.name },
  };
}

function jsonLdHomePage() {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    name: site.brandByline || `${brand} by ${site.name}`,
    url: absoluteUrl('/'),
    description: site.answerEngineSummary || site.description,
    about: { '@type': 'Person', name: site.name, url: absoluteUrl('/') },
    mainEntity: jsonLdPerson(),
  };
}

function jsonLdBlogPosting(entry, pageUrl) {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: entry.meta.title,
    description: entry.meta.summary || '',
    url: pageUrl,
    author: { '@type': 'Person', name: site.name, url: absoluteUrl('/') },
    publisher: { '@type': 'Person', name: site.name },
  };
  if (entry.meta.date) ld.datePublished = `${entry.meta.date}T00:00:00Z`;
  if (entry.meta.updated) ld.dateModified = `${entry.meta.updated}T00:00:00Z`;
  if (entry.meta.image) ld.image = absoluteUrl(entry.meta.image);
  return ld;
}

function jsonLdCreativeWork(entry, pageUrl) {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: entry.meta.title,
    description: entry.meta.summary || '',
    url: pageUrl,
    author: { '@type': 'Person', name: site.name, url: absoluteUrl('/') },
  };
  if (entry.meta.date) ld.datePublished = `${entry.meta.date}T00:00:00Z`;
  if (entry.meta.updated) ld.dateModified = `${entry.meta.updated}T00:00:00Z`;
  if (entry.meta.org) ld.sourceOrganization = { '@type': 'Organization', name: entry.meta.org };
  if (entry.meta.image) ld.image = absoluteUrl(entry.meta.image);
  return ld;
}

function jsonLdArticle(entry, pageUrl) {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: entry.meta.title,
    description: entry.meta.summary || '',
    url: pageUrl,
    author: { '@type': 'Person', name: site.name, url: absoluteUrl('/') },
  };
  if (entry.meta.date) ld.datePublished = `${entry.meta.date}T00:00:00Z`;
  if (entry.meta.venue) ld.publisher = { '@type': 'Organization', name: entry.meta.venue };
  if (entry.meta.image) ld.image = absoluteUrl(entry.meta.image);
  return ld;
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

function writePage(outPath, html) {
  const target = join(DIST_DIR, outPath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, html);
}

function detailPage(collection, entry, activeKey) {
  const { meta } = entry;
  const pageUrl = meta.canonical || absoluteUrl(entryUrl(collection.name, entry));
  const isWriting = collection.name === 'writing';
  const isTalk = collection.name === 'talks';
  const isWork = collection.name === 'work';
  const isScript = collection.name === 'scripts';

  let jsonLd;
  if (isWriting) jsonLd = jsonLdBlogPosting(entry, pageUrl);
  else if (isWork || isScript) jsonLd = jsonLdCreativeWork(entry, pageUrl);
  else if (isTalk) jsonLd = jsonLdArticle(entry, pageUrl);

  const content = `<article class="prose">
  <p class="eyebrow">${escapeHtml(collection.label)}</p>
  <h1>${escapeHtml(meta.title)}</h1>
  <p class="article-meta">${metaLine([meta.org || meta.venue, meta.role, meta.period || meta.date])}</p>
  ${meta.summary ? `<p class="lede">${escapeHtml(meta.summary)}</p>` : ''}
  ${linkChips(meta.links)}
  ${heroImage(meta, collection.name)}
  ${markdownToHtml(entry.body)}
  ${shareLinks(pageUrl, meta.title)}
  <p class="back"><a href="${BASE}${collection.name}/">← All ${collection.label.toLowerCase()}</a></p>
</article>${isWriting ? `\n${subscribeSection()}\n${commentsSection()}` : ''}`;
  writePage(join(collection.name, entry.slug, 'index.html'), layout({
    title: `${meta.title} - ${brand}`,
    description: meta.summary || site.description,
    content,
    active: activeKey,
    canonical: pageUrl,
    ogImage: meta.socialImage || meta.image || null,
    ogImageAlt: meta.shareImageAlt || meta.imageAlt || meta.title,
    shareTitle: meta.shareTitle || null,
    shareSummary: meta.shareSummary || null,
    ogType: (isWriting || isTalk) ? 'article' : 'website',
    articleDate: meta.date || null,
    articleUpdated: meta.updated || null,
    robots: meta.noindex ? 'noindex, follow' : null,
    jsonLd,
  }));
}

function writerDashboard(entries) {
  const grouped = { pages: [], writing: [], work: [], talks: [], scripts: [] };
  for (const entry of entries) {
    const col = entry.collection;
    if (!grouped[col]) grouped[col] = [];
    grouped[col].push(entry);
  }

  const rows = [];
  for (const col of ['writing', 'work', 'talks', 'scripts', 'pages']) {
    if (!grouped[col] || grouped[col].length === 0) continue;
    rows.push(`<section class="writer-group" data-writer-group="${escapeHtml(col)}">
  <h2>${escapeHtml(col.charAt(0).toUpperCase() + col.slice(1))}</h2>`);
    rows.push(grouped[col].map((entry) => {
      const isPub = isPublished(entry);
      const status = entry.meta.draft === true ? 'Draft' : (isPub ? 'Published' : `Scheduled ${entry.meta.publishAt}`);
      const previewUrl = entry.collection === 'pages' ? `${BASE}${entry.slug}/` : `${BASE}${entry.collection}/${entry.slug}/`;
      const canonical = entry.meta.canonical || absoluteUrl(`/writing/${entry.slug}/`);
      const campaign = `fn_${entry.slug.replaceAll('-', '_')}_${BUILD_TIME.toISOString().slice(0, 7).replace('-', '')}`;
      const tracked = (source) => {
        const url = new URL(canonical);
        url.searchParams.set('utm_source', source);
        url.searchParams.set('utm_medium', 'organic_social');
        url.searchParams.set('utm_campaign', campaign);
        url.searchParams.set('utm_content', 'post_hook_a');
        return url.toString();
      };
      const socialTitle = String(entry.meta.shareTitle || entry.meta.title || '').trim();
      const socialSummary = String(entry.meta.shareSummary || entry.meta.summary || '').trim();
      const linkedInCopy = `${socialTitle}\n\n${socialSummary}\n\n${tracked('linkedin')}`;
      const xUrl = tracked('x');
      const xSuffix = `\n\n${xUrl}`;
      const xCopy = `${socialTitle}${xSuffix}`.length <= 280
        ? `${socialTitle}${xSuffix}`
        : `${socialTitle.slice(0, 279 - xSuffix.length).trimEnd()}…${xSuffix}`;
      const socialControls = entry.collection === 'writing' && !entry.meta.external ? `<details class="writer-social">
    <summary>Social drafts</summary>
    <p class="field-note">Edit the starter copy, then stage one unpublished Buffer draft. Finish editing, scheduling, and publishing in Buffer.</p>
    <form class="writer-form" method="post" action="/api/writer/social" data-social-form>
      <input type="hidden" name="sourceSlug" value="${escapeHtml(entry.sourceSlug)}" />
      <input type="hidden" name="channel" value="linkedin" />
      <label>LinkedIn copy
        <textarea name="text" rows="7" maxlength="3000" required>${escapeHtml(linkedInCopy)}</textarea>
      </label>
      <button class="button" type="submit">Stage LinkedIn draft</button>
    </form>
    <form class="writer-form writer-social-channel" method="post" action="/api/writer/social" data-social-form>
      <input type="hidden" name="sourceSlug" value="${escapeHtml(entry.sourceSlug)}" />
      <input type="hidden" name="channel" value="x" />
      <label>X copy
        <textarea name="text" rows="5" maxlength="280" required>${escapeHtml(xCopy)}</textarea>
      </label>
      <button class="button" type="submit">Stage X draft</button>
    </form>
  </details>` : '';
      return `<article class="writer-entry" data-writer-item>
  <div>
    <p class="eyebrow">${escapeHtml(status)}</p>
    <h2><a href="${previewUrl}">${escapeHtml(entry.meta.title)}</a></h2>
    <p>${escapeHtml(entry.meta.summary || '')}</p>
    <p class="writer-preview"><a href="${previewUrl}">Open private preview</a></p>
  </div>
  <details class="writer-edit">
    <summary>Edit and review</summary>
    <form class="writer-form" method="post" action="/api/writer/save">
      <input type="hidden" name="collection" value="${escapeHtml(entry.collection)}" />
      <input type="hidden" name="sourceSlug" value="${escapeHtml(entry.sourceSlug)}" />
      <label>Source Markdown
        <textarea name="markdown" rows="18" required>${escapeHtml(entry.raw)}</textarea>
      </label>
      <button class="button" type="submit">Save draft</button>
    </form>
    <form class="writer-form writer-review" method="post" action="/api/writer/review">
      <input type="hidden" name="collection" value="${escapeHtml(entry.collection)}" />
      <input type="hidden" name="sourceSlug" value="${escapeHtml(entry.sourceSlug)}" />
      <label>Note for the review agent <span>Optional. Tell the agent what changed or what feels uncertain.</span>
        <textarea name="comment" rows="4" maxlength="4000" placeholder="Check the opening claim and whether the examples support it."></textarea>
      </label>
      <p class="field-note">Save first. The agent reviews the committed draft against the writing, review, and design skills.</p>
      <button class="button" type="submit">Request agent review</button>
    </form>
  </details>
  ${socialControls}
  <details class="writer-publish">
    <summary>Publishing controls</summary>
    <form class="writer-form" method="post" action="/api/writer/publish" data-writer-form>
      <input type="hidden" name="collection" value="${escapeHtml(entry.collection)}" />
      <input type="hidden" name="sourceSlug" value="${escapeHtml(entry.sourceSlug)}" />
      <input type="hidden" name="publishAt" value="${escapeHtml(entry.meta.publishAt || '')}" />
      <label>Publish time in your timezone
        <input type="datetime-local" name="publishAtLocal" data-publish-at="${escapeHtml(entry.meta.publishAt || '')}" />
      </label>
      <div class="writer-actions">
        <button class="button" type="submit" name="action" value="draft">Keep draft</button>
        <button class="button" type="submit" name="action" value="schedule">Schedule</button>
        <button class="button" type="submit" name="action" value="publish-now">Publish now</button>
      </div>
    </form>
  </details>
</article>`;
    }).join('\n'));
    if (col === 'writing') {
      rows.push(`<nav class="writer-pagination" aria-label="Field Notes pages" data-writer-pagination hidden>
  <button class="button" type="button" data-page-previous>Previous</button>
  <span data-page-status aria-live="polite"></span>
  <button class="button" type="button" data-page-next>Next</button>
</nav>`);
    }
    rows.push('</section>');
  }

  const content = `<section class="writer-dashboard">
  <p class="eyebrow">Private publishing</p>
  <h1>Release dashboard</h1>
  <p class="lede">Edit a draft, save it, ask an agent for a structured review, then publish only when the preview is ready. Every save creates one focused commit on the configured publishing branch. Direct updates need no pull request; protected workflows return a merge link.</p>
  <p class="writer-status" hidden role="status"></p>
  ${rows.length > 0 ? rows.join('\n') : '<p class="empty-state">No content found.</p>'}
</section>
<script>(()=>{const params=new URLSearchParams(location.search);const status=document.querySelector('.writer-status');const addLink=(href,label)=>{const link=document.createElement('a');link.href=href;link.textContent=label;link.rel='noopener';link.target='_blank';status.append(link)};const error=params.get('error');if(error&&status){status.textContent=error;status.hidden=false}const changed=params.get('updated')||params.get('saved');if(changed&&status){status.replaceChildren('Saved '+changed+'. GitHub is starting the next deploy. ');const merge=params.get('merge');if(merge)addLink(merge,'Open merge request');status.hidden=false}const review=params.get('review');const issue=params.get('issue');if(review&&status){status.replaceChildren('Review requested for '+review+'. ');if(issue)addLink(issue,'Open review request');status.hidden=false}const social=params.get('social');const channel=params.get('channel');if(social&&channel&&status){status.replaceChildren((params.get('duplicate')==='1'?'Reused the existing ':'Staged an editable ')+channel+' draft for '+social+'. ');addLink('https://publish.buffer.com/all-channels','Open Buffer');status.hidden=false}const writing=document.querySelector('[data-writer-group="writing"]');if(writing){const items=[...writing.querySelectorAll('[data-writer-item]')];const pagination=writing.querySelector('[data-writer-pagination]');const total=Math.max(1,Math.ceil(items.length/5));let page=Math.min(total,Math.max(1,Number.parseInt(params.get('writingPage')||'1',10)||1));const render=()=>{items.forEach((item,index)=>item.hidden=index<(page-1)*5||index>=page*5);pagination.hidden=total<=1;pagination.querySelector('[data-page-status]').textContent='Page '+page+' of '+total;pagination.querySelector('[data-page-previous]').disabled=page===1;pagination.querySelector('[data-page-next]').disabled=page===total;const nextUrl=new URL(location.href);if(page===1)nextUrl.searchParams.delete('writingPage');else nextUrl.searchParams.set('writingPage',String(page));history.replaceState(null,'',nextUrl)};pagination.querySelector('[data-page-previous]').addEventListener('click',()=>{if(page>1){page-=1;render();writing.scrollIntoView({block:'start'})}});pagination.querySelector('[data-page-next]').addEventListener('click',()=>{if(page<total){page+=1;render();writing.scrollIntoView({block:'start'})}});render()}const localValue=(iso)=>{if(!iso)return'';const d=new Date(iso);const part=(value)=>String(value).padStart(2,'0');return d.getFullYear()+'-'+part(d.getMonth()+1)+'-'+part(d.getDate())+'T'+part(d.getHours())+':'+part(d.getMinutes())};document.querySelectorAll('[data-social-form]').forEach((form)=>form.addEventListener('submit',(event)=>{const channel=form.elements.channel.value;if(!window.confirm('Stage this '+channel+' copy as an unpublished Buffer draft?'))event.preventDefault()}));document.querySelectorAll('[data-writer-form]').forEach((form)=>{const field=form.elements.publishAtLocal;field.value=localValue(field.dataset.publishAt);form.addEventListener('submit',(event)=>{const action=event.submitter?.value;if(action==='publish-now'&&!window.confirm('Publish this essay now? This commits directly to the publishing branch.')){event.preventDefault();return}if(action!=='schedule')return;const local=field.value;if(!local){event.preventDefault();field.focus();return}const scheduled=new Date(local);if(Number.isNaN(scheduled.valueOf())||scheduled.valueOf()<=Date.now()){event.preventDefault();field.setCustomValidity('Choose a future publish time.');field.reportValidity();return}field.setCustomValidity('');form.elements.publishAt.value=scheduled.toISOString()})})})();</script>`;

  writePage('index.html', layout({
    title: `Writer dashboard - ${site.name}`,
    description: 'Private draft and scheduled essay administration.',
    content,
    active: 'writing',
    canonical: absoluteUrl('/writer/'),
    robots: 'noindex, nofollow',
  }));
}

function buildHome(collections) {
  const bySlug = (collection, slug) => collections[collection].find((entry) => entry.slug === slug);
  const pinnedWork = collections.work.find((e) => e.meta.order !== undefined) || collections.work[0];
  const otherWork = collections.work.filter((e) => e !== pinnedWork);
  const selectedWork = [pinnedWork, ...otherWork].filter(Boolean).slice(0, 3);

  const pinnedWriting = collections.writing.find((e) => e.meta.order !== undefined) || collections.writing[0];
  const otherWriting = collections.writing.filter((e) => e !== pinnedWriting);
  const writingEntries = [pinnedWriting, ...otherWriting].filter(Boolean).slice(0, 4);

  const visibleDemos = demos.filter((d) => !d.hideOnHome);
  const pinnedDemo = visibleDemos.find((d) => d.order !== undefined) || visibleDemos[0];
  const otherDemos = visibleDemos.filter((d) => d !== pinnedDemo);
  const homeDemos = [pinnedDemo, ...otherDemos].filter(Boolean).slice(0, 3);
  const demosSection = homeDemos.length
    ? `
<section>
  ${sectionHeader('', 'Labs', '/labs/', 'Explore Labs')}
  <p class="section-note">${escapeHtml(site.sectionIntros?.demos || '')}</p>
  <div class="grid demo-grid">
    ${homeDemos.map(demoCard).join('\n')}
  </div>
</section>
`
    : '';

  const stats = (site.heroStats || []).length
    ? `<dl class="hero-stats">
    ${site.heroStats.map((stat) => `<div>
      <dt>${escapeHtml(stat.label)}</dt>
      <dd>${escapeHtml(stat.value)}</dd>
    </div>`).join('\n')}
  </dl>`
    : '';

  const featured = writingEntries[0];
  const fieldNotesBody = featured
    ? `${featuredNote(featured)}\n<div class="grid home-work-grid">${writingEntries.slice(1).map((entry) => gridCard('writing', entry)).join('\n')}</div>`
    : `<div class="grid home-work-grid"></div>`;

  const content = `
<section class="hero">
  <div class="hero-profile">
    ${site.profileImage ? `<img class="profile-image" src="${rebase(site.profileImage)}" alt="${escapeHtml(site.profileImageAlt || site.name)}" width="460" height="460" />` : ''}
    <div>
      <p class="hero-role">${escapeHtml(site.profileHeadline || site.role)}</p>
      <p class="hero-location">${escapeHtml(site.location)}</p>
    </div>
  </div>

  <h1>${escapeHtml(site.heroHeadline || site.name)}</h1>
  <p class="lede">${escapeHtml(site.intro)}</p>
  ${stats}
</section>

<section>
  ${sectionHeader('', 'Notes', `${BASE}writing/`, 'All notes')}
  <p class="section-note">Learnings from users</p>
  ${fieldNotesBody}
</section>

${demosSection}
<section>
  ${sectionHeader('', 'Selected work', `${BASE}work/`, 'All work')}
  <div class="grid home-work-grid">${selectedWork.map((entry) => gridCard('work', entry)).join('\n')}</div>
</section>

<section class="build-section home-close">
  <div>
    <p class="eyebrow">Collaborate</p>
    <h2>Building something in this space?</h2>
  </div>
  <div>
    <a class="button button-primary" href="${BASE}contact/">Reach out to collab</a>
  </div>
</section>
`;

  writePage('index.html', layout({
    title: site.brandByline || `${brand} by ${site.name}`,
    description: site.description,
    content,
    canonical: absoluteUrl('/'),
    ogImage: site.defaultShareImage,
    ogImageAlt: site.defaultShareImageAlt,
    jsonLd: [jsonLdHomePage(), jsonLdWebSite()],
  }));
}

function buildDemosPage() {
  if (!demos.length) return;
  const content = `<section>
  <h1>Labs</h1>
  <p class="lede">${escapeHtml(site.sectionIntros?.demos || '')}</p>
  <div class="grid demo-grid">
    ${demos.map(demoCard).join('\n')}
  </div>
  <p class="section-note">Labs combines open-source reference apps hosted with Fieldwork and selected external experiments. <a href="${site.links.github}/fieldwork" target="_blank" rel="noopener noreferrer">Read the source</a>.</p>
</section>`;

  writePage(join('demos', 'index.html'), layout({
    title: `Labs - ${brand}`,
    description: site.sectionIntros?.demos || site.description,
    content,
    active: 'demos',
    canonical: absoluteUrl('/demos/'),
  }));
}

function buildCollectionIndex(collection, entries) {
  const isEmpty = entries.length === 0;
  const emptyState = `<div class="empty-state">
  <h2>Coming soon</h2>
  <p>This section is designed, built, and waiting for its first entry. Drop a markdown file into <code>content/${collection.name}/</code> and rebuild.</p>
</div>`;

  let body;
  if (collection.name === 'work') {
    body = `<div class="grid">${entries.map((entry) => gridCard('work', entry)).join('\n')}</div>`;
  } else if (collection.name === 'writing') {
    const owned = entries.filter((entry) => !entry.meta.external);
    const elsewhere = entries.filter((entry) => entry.meta.external);
    body = `<div class="collection-group">
  <ul class="rows">${owned.map((entry) => listRow(collection.name, entry)).join('\n')}</ul>
</div>
${elsewhere.length ? `<div class="collection-group">
  <h2>Elsewhere</h2>
  <ul class="rows">${elsewhere.map((entry) => listRow(collection.name, entry)).join('\n')}</ul>
</div>` : ''}
${subscribeSection()}`;
  } else {
    body = `<ul class="rows">${entries.map((entry) => listRow(collection.name, entry)).join('\n')}</ul>`;
  }

  const intro = site.sectionIntros?.[collection.name]
    ? `<p class="lede">${escapeHtml(site.sectionIntros[collection.name])}</p>`
    : '';

  const content = `<section>
  <h1>${escapeHtml(collection.label)}</h1>
  ${intro}
  ${isEmpty ? emptyState : body}
</section>`;

  writePage(join(collection.name, 'index.html'), layout({
    title: `${collection.label} - ${brand}`,
    description: site.sectionIntros?.[collection.name] || site.description,
    content,
    active: collection.name,
    canonical: absoluteUrl(`/${collection.name}/`),
  }));
}


// Shared hero-image renderer for detail pages and standalone pages. Relative
// image paths resolve against the entry's own content folder; absolute paths
// resolve against static/. Exact dimensions come from the file so the HTML
// never causes layout shift (portfolio-design rule 6).
function heroImage(meta, sourceDirName, extraClass = '') {
  if (!meta.image) return '';
  const imagePath = meta.image.startsWith('/') ? join(STATIC_DIR, meta.image.slice(1)) : join(CONTENT_DIR, sourceDirName, meta.image);
  const { width, height } = getImageDimensions(imagePath);
  return `<img class="article-hero${escapeHtml(extraClass)}" src="${rebase(meta.image)}" alt="${escapeHtml(meta.imageAlt || meta.title)}" loading="eager" width="${width}" height="${height}" />`;
}

function resumePageContent(meta, body) {
  return `<section class="resume-shell">
  <div class="resume-header">
    <div>
      <p class="eyebrow">Resume</p>
      <h1>${escapeHtml(site.name)}</h1>
      <p class="lede">${escapeHtml(site.positioning || site.role)}</p>
    </div>
    <p class="resume-meta">${escapeHtml(site.location)} · <a href="${site.links.linkedin}" target="_blank" rel="noopener noreferrer">LinkedIn</a> · <a href="${site.links.github}" target="_blank" rel="noopener noreferrer">GitHub</a></p>
  </div>
  ${pageActions()}
  <div class="resume-body">${markdownToHtml(body)}</div>
</section>`;
}

function pageActions() {
  return `<p class="hero-actions page-actions">
    <a class="button button-primary" href="${BASE}writing/">Read Field Notes</a>
    <a class="button button-secondary" href="${BASE}contact/">Contact Ryan</a>
  </p>`;
}

function contactPageContent(meta) {
  return `<section class="contact-shell">
  <p class="eyebrow">Contact</p>
  <h1>Start a conversation.</h1>
  <p class="lede">Choose what you want to discuss, then share enough context for a useful first reply.</p>
  <form id="contact-form" class="contact-form" action="${BASE}api/contact" method="post">
    <fieldset class="intent-options"><legend>What is this about?</legend>
      ${['Developer platform discussion', 'Content collaboration', 'Speaking opportunity', 'Other'].map((intent) => `<label><input type="radio" name="intent" value="${intent}" required /> <span>${intent}</span></label>`).join('')}
    </fieldset>
    <label>What would you like to discuss?
      <textarea name="message" rows="6" required minlength="20" maxlength="5000" placeholder="A few sentences about the idea, audience, timing, and useful next step."></textarea>
    </label>
    <label>Name <input name="name" autocomplete="name" maxlength="120" required /></label>
    <label>Email <input name="email" type="email" autocomplete="email" maxlength="200" required /></label>
    <div class="contact-honeypot" aria-hidden="true">
      <label>Company fax number <input name="company_fax_number" tabindex="-1" autocomplete="off" /></label>
    </div>
    <label class="human-check"><input name="human" type="checkbox" value="1" required /> <span>I am a person, and this is not an unsolicited sales pitch.</span></label>
    <button class="button" type="submit">Send note</button>
  </form>
  <p class="section-note">The server uses your details only to deliver the note and reply. See <a href="${BASE}privacy/">Privacy</a>.</p>
  <script>(()=>{const value=new URLSearchParams(location.search).get('intent');const intents={platform:'Developer platform discussion',content:'Content collaboration',speaking:'Speaking opportunity',other:'Other'};const selected=intents[value];if(!selected)return;const input=[...document.querySelectorAll('input[name="intent"]')].find((item)=>item.value===selected);if(input)input.checked=true})();</script>
</section>`;
}

function loadPages() {
  const dir = join(CONTENT_DIR, 'pages');
  if (!existsSync(dir)) return [];
  const pages = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.md') || file.startsWith('_')) continue;
    const sourceSlug = file.replace(/\.md$/, '');
    const raw = readFileSync(join(dir, file), 'utf8');
    const { meta, body } = parseFrontMatter(raw);
    const slug = meta.slug || sourceSlug;
    pages.push({ slug, sourceSlug, meta, body, raw, collection: 'pages' });
  }
  return pages;
}

function buildStandalonePages(pages) {
  for (const page of pages) {
    const { slug, meta, body } = page;
    const customContent = slug === 'resume' ? resumePageContent(meta, body) : slug === 'contact' ? contactPageContent(meta) : null;
    const content = customContent || `<article class="prose">
  <p class="eyebrow">${escapeHtml(meta.eyebrow || site.name)}</p>
  <h1>${escapeHtml(meta.title)}</h1>
  ${meta.summary ? `<p class="lede">${escapeHtml(meta.summary)}</p>` : ''}
  ${slug === 'about' ? pageActions() : ''}
  ${heroImage(meta, 'pages', slug === 'about' ? ' profile-portrait' : '')}
  ${markdownToHtml(body)}
</article>`;
    writePage(join(slug, 'index.html'), layout({
      title: `${meta.title} - ${brand}`,
      description: meta.summary || site.description,
      content,
      active: slug,
      canonical: absoluteUrl(`/${slug}/`),
      ogImage: meta.socialImage || meta.image || null,
      ogImageAlt: meta.shareImageAlt || meta.imageAlt || meta.title,
      shareTitle: meta.shareTitle || null,
      shareSummary: meta.shareSummary || null,
      robots: meta.noindex ? 'noindex, follow' : null,
      contactDelivery: meta.contactDelivery || null,
    }));
  }
  for (const page of pages) validatePage(page.slug, page.meta, page.body);
}


function buildNotFoundPage() {
  const content = `<section class="prose">
  <p class="eyebrow">404</p>
  <h1>Page not found</h1>
  <p>I couldn't find that page. It may have moved, or the link is out of date.</p>
  <p class="hero-actions">
    <a class="button button-primary" href="${BASE}">Home</a>
    <a href="${BASE}work/">Work</a>
    <a href="${BASE}writing/">Notes</a>
    ${demos.length ? `<a href="${BASE}demos/">Labs</a>` : ''}
  </p>
</section>`;
  writePage('404.html', layout({
    title: `Page not found - ${brand}`,
    description: 'The page you were looking for could not be found.',
    content,
    canonical: absoluteUrl('/404.html'),
    robots: 'noindex, nofollow',
  }));
}

function absoluteUrl(pathOrUrl) {
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
  return new URL(pathOrUrl.replace(/^\//, ''), site.siteUrl || BASE).toString();
}

function rssFeed(entries) {
  const items = entries
    .filter((entry) => !entry.meta.noindex)
    .map((entry) => `<item>
      <title>${escapeHtml(entry.meta.title)}</title>
      <link>${escapeHtml(absoluteUrl(entryUrl('writing', entry)))}</link>
      <guid>${escapeHtml(absoluteUrl(entry.meta.canonical || entryUrl('writing', entry)))}</guid>
      <pubDate>${new Date(`${entry.meta.date}T00:00:00Z`).toUTCString()}</pubDate>
      <description>${escapeHtml(entry.meta.summary || '')}</description>
    </item>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>${escapeHtml(brand)} by ${escapeHtml(site.name)}</title>
<link>${escapeHtml(absoluteUrl('/writing/'))}</link>
<description>${escapeHtml(site.sectionIntros?.writing || site.description)}</description>
${items}
</channel></rss>`;
}

function sitemapXml(collections) {
  const urls = [];

  // Homepage
  urls.push({ loc: absoluteUrl('/'), priority: '1.0' });

  // Collection index pages
  for (const col of COLLECTIONS) {
    urls.push({ loc: absoluteUrl(`/${col.name}/`), priority: '0.8' });
  }

  // Demos index
  if (demos.length) {
    urls.push({ loc: absoluteUrl('/demos/'), priority: '0.7' });
  }

  // Detail pages
  for (const col of COLLECTIONS) {
    for (const entry of collections[col.name]) {
      if (!hasDetailPage(entry)) continue;
      if (entry.meta.noindex) continue;
      const loc = absoluteUrl(entryUrl(col.name, entry));
      const lastmod = entry.meta.updated || entry.meta.date || null;
      let image = null;
      if (entry.meta.image) {
        image = entry.meta.image.startsWith('/') ? absoluteUrl(rebase(entry.meta.image)) : loc + entry.meta.image;
      }
      urls.push({ loc, lastmod, priority: '0.6', image });
    }
  }

  // Standalone pages
  const pagesDir = join(CONTENT_DIR, 'pages');
  if (existsSync(pagesDir)) {
    for (const file of readdirSync(pagesDir)) {
      if (!file.endsWith('.md') || file.startsWith('_')) continue;
      const slug = file.replace(/\.md$/, '');
      const { meta } = parseFrontMatter(readFileSync(join(pagesDir, file), 'utf8'));
      if (meta.noindex) continue;
      const loc = absoluteUrl(`/${slug}/`);
      let image = null;
      if (meta.image) {
        image = meta.image.startsWith('/') ? absoluteUrl(rebase(meta.image)) : loc + meta.image;
      }
      urls.push({ loc, priority: '0.5', image });
    }
  }

  const entries = urls.map((u) => {
    const lastmod = u.lastmod ? `\n  <lastmod>${u.lastmod}</lastmod>` : '';
    const imageNode = u.image ? `\n  <image:image>\n    <image:loc>${escapeHtml(u.image)}</image:loc>\n  </image:image>` : '';
    return `<url>\n  <loc>${escapeHtml(u.loc)}</loc>${lastmod}${imageNode}\n  <priority>${u.priority}</priority>\n</url>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${entries}\n</urlset>`;
}

function robotsTxt() {
  return `User-agent: *\nAllow: /\n\nSitemap: ${absoluteUrl('/sitemap.xml')}\n`;
}

function permanentRedirects(collections) {
  if (WRITER_MODE) return {};
  const redirects = demos.length ? { '/lab/': '/demos/', '/labs/': '/demos/', '/atlas/': 'https://atlas-demo-561209038703.us-central1.run.app/', '/labs/atlas/': 'https://atlas-demo-561209038703.us-central1.run.app/', '/demos/atlas/': 'https://atlas-demo-561209038703.us-central1.run.app/' } : {};
  const canonicalPaths = new Set(['/', '/demos/', ...COLLECTIONS.filter((item) => item.listPage).map((item) => `/${item.name}/`)]);
  for (const collection of COLLECTIONS) {
    for (const entry of collections[collection.name]) {
      if (hasDetailPage(entry)) canonicalPaths.add(entryUrl(collection.name, entry));
    }
  }
  const pagesDir = join(CONTENT_DIR, 'pages');
  if (existsSync(pagesDir)) {
    for (const file of readdirSync(pagesDir)) {
      if (file.endsWith('.md') && !file.startsWith('_')) canonicalPaths.add(`/${file.replace(/\.md$/, '')}/`);
    }
  }
  for (const collection of COLLECTIONS) {
    for (const entry of collections[collection.name]) {
      if (!hasDetailPage(entry) || entry.meta.external) continue;
      const target = entryUrl(collection.name, entry);
      for (const alias of entry.meta.aliases || []) {
        if (alias === target) failValidation(`${collection.name}/${entry.slug}: alias duplicates its canonical path: ${alias}`);
        if (redirects[alias]) failValidation(`${collection.name}/${entry.slug}: duplicate alias: ${alias}`);
        if (canonicalPaths.has(alias)) failValidation(`${collection.name}/${entry.slug}: alias collides with a generated canonical path: ${alias}`);
        redirects[alias] = target;
      }
    }
  }
  return redirects;
}

function validateMetadata() {
  const htmlFiles = readdirSync(DIST_DIR, { recursive: true })
    .filter((file) => String(file).endsWith('.html'));
  const errors = [];
  const descriptions = new Map();

  for (const file of htmlFiles) {
    const filePath = join(DIST_DIR, String(file));
    const html = readFileSync(filePath, 'utf8');
    const id = String(file);

    if (!html.includes('<link rel="canonical"')) errors.push(`${id}: missing canonical link`);
    if (!html.includes('og:url')) errors.push(`${id}: missing og:url`);
    if (!html.includes('og:image')) errors.push(`${id}: missing og:image`);
    if (!html.includes('twitter:card')) errors.push(`${id}: missing twitter:card`);
    if (!html.includes('name="description"')) errors.push(`${id}: missing meta description`);
    if (!html.includes('og:title')) errors.push(`${id}: missing og:title`);
    if (!html.includes('og:description')) errors.push(`${id}: missing og:description`);
    if (!html.includes('twitter:title')) errors.push(`${id}: missing twitter:title`);
    if (!html.includes('twitter:description')) errors.push(`${id}: missing twitter:description`);
    if (!html.includes('twitter:image')) errors.push(`${id}: missing twitter:image`);
    if (!html.includes('twitter:image:alt')) errors.push(`${id}: missing twitter:image:alt`);
    if (!html.includes('og:image:width')) errors.push(`${id}: missing og:image:width`);
    if (!html.includes('og:image:height')) errors.push(`${id}: missing og:image:height`);
    if (!html.includes('og:image:type')) errors.push(`${id}: missing og:image:type`);
    const description = html.match(/<meta name="description" content="([^"]+)"/i)?.[1];
    if (description) {
      if (descriptions.has(description)) errors.push(`${id}: duplicate description also used by ${descriptions.get(description)}`);
      descriptions.set(description, id);
    }
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/i)?.[1];
    if (!canonical || !/^https:\/\//.test(canonical)) errors.push(`${id}: canonical must be an absolute https URL`);
  }

  if (errors.length) {
    console.error('[portfolio] metadata validation failed:');
    for (const error of errors) console.error(`- ${error}`);
    rmSync(DIST_DIR, { recursive: true, force: true });
    process.exit(1);
  }
  console.log(`[portfolio] metadata validation passed for ${htmlFiles.length} pages`);
}

function publishOutput() {
  const backupDir = `${OUTPUT_DIR}.previous-${process.pid}`;
  rmSync(backupDir, { recursive: true, force: true });
  const hadPreviousOutput = existsSync(OUTPUT_DIR);
  if (hadPreviousOutput) renameSync(OUTPUT_DIR, backupDir);
  try {
    renameSync(DIST_DIR, OUTPUT_DIR);
    rmSync(backupDir, { recursive: true, force: true });
  } catch (error) {
    if (hadPreviousOutput && !existsSync(OUTPUT_DIR) && existsSync(backupDir)) {
      renameSync(backupDir, OUTPUT_DIR);
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

rmSync(DIST_DIR, { recursive: true, force: true });
mkdirSync(DIST_DIR, { recursive: true });

validateSite();

const collections = {};
const allCollections = {};
for (const collection of COLLECTIONS) {
  const allEntries = loadCollection(collection.name);
  const entries = WRITER_MODE ? allEntries : allEntries.filter(isPublished);
  allCollections[collection.name] = allEntries;
  collections[collection.name] = entries;
  buildCollectionIndex(collection, entries);
  if (collection.detailPages) {
    for (const entry of entries) {
      if (hasDetailPage(entry)) detailPage(collection, entry, collection.name);
    }
  }
}

const allPages = loadPages();
if (WRITER_MODE) {
  const allContent = [...allPages];
  for (const collection of COLLECTIONS) {
    allContent.push(...allCollections[collection.name]);
  }
  writerDashboard(allContent);
} else {
  buildHome(collections);
}
buildDemosPage();
buildStandalonePages(allPages);
buildNotFoundPage();

const seenSlugs = new Set();
for (const collection of COLLECTIONS) {
  for (const entry of allCollections[collection.name]) validateEntry(collection, entry, seenSlugs);
}
const redirects = permanentRedirects(collections);
assertValidBuild();
writePage('feed.xml', rssFeed(collections.writing));
writePage('sitemap.xml', sitemapXml(collections));
writePage('robots.txt', robotsTxt());
writePage('redirects.json', `${JSON.stringify(redirects, null, 2)}\n`);

if (existsSync(STATIC_DIR)) {
  cpSync(STATIC_DIR, DIST_DIR, { recursive: true });
}

const pageCount = readdirSync(DIST_DIR, { recursive: true }).filter((file) => String(file).endsWith('index.html')).length;
validateMetadata();
publishOutput();
console.log(`[portfolio] built ${pageCount} pages into ${OUTPUT_DIR} (base: ${BASE})`);
