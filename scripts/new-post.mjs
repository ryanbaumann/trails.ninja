#!/usr/bin/env node
// scripts/new-post.mjs — one-command blog post scaffold.
//
// Creates portfolio/content/writing/<slug>.md with front matter filled in.
// The writing section is already designed and routed: the post is live on
// the next build. Zero dependencies.
//
// Usage:
//   npm run new:post -- "Developer experience is a growth engine"
//   npm run new:post -- "Launch post" --external https://example.com/launch
//   npm run new:post -- "My post" --summary "One-line summary for lists."
//   npm run new:post -- "Ready to publish" --publish
//   npm run new:post -- "Publish later" --schedule 2099-07-14T16:00:00Z
//
// Voice and structure guidance: .agents/skills/portfolio-writing/SKILL.md

import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WRITING_DIR = resolve(process.env.PORTFOLIO_WRITING_DIR || join(REPO_ROOT, 'portfolio', 'content', 'writing'));

const args = process.argv.slice(2);
const title = args[0];
if (!title || title.startsWith('-')) {
  console.error('[new-post] usage: npm run new:post -- "Post title" [--summary "..."] [--external <url>] [--publish | --schedule <UTC timestamp>]');
  process.exit(1);
}

function flag(name, fallback) {
  const index = args.indexOf(`--${name}`);
  return index !== -1 && args[index + 1] ? args[index + 1] : fallback;
}

const summary = flag('summary', 'One sentence: the claim and why the reader should care.');
const external = flag('external', null);
const publishNow = args.includes('--publish');
const publishAt = flag('schedule', null);
if (publishNow && publishAt) {
  console.error('[new-post] choose either --publish or --schedule, not both');
  process.exit(1);
}
function validFutureTimestamp(value) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?Z$/);
  if (!match) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf()) || parsed.valueOf() <= Date.now()) return false;
  const [, year, month, day, hour, minute, second = '0', fraction = '0'] = match;
  return parsed.getUTCFullYear() === Number(year)
    && parsed.getUTCMonth() + 1 === Number(month)
    && parsed.getUTCDate() === Number(day)
    && parsed.getUTCHours() === Number(hour)
    && parsed.getUTCMinutes() === Number(minute)
    && parsed.getUTCSeconds() === Number(second)
    && parsed.getUTCMilliseconds() === Number(fraction.padEnd(3, '0'));
}
if (publishAt && !validFutureTimestamp(publishAt)) {
  console.error('[new-post] --schedule must be a valid future UTC ISO-8601 timestamp ending in Z');
  process.exit(1);
}
const draft = !publishNow && !publishAt;
const tags = flag('tags', 'developer experience');

const slug = title
  .toLowerCase()
  .replace(/[^a-z0-9\s-]/g, '')
  .trim()
  .replace(/\s+/g, '-')
  .slice(0, 60);
const postPath = join(WRITING_DIR, `${slug}.md`);
if (existsSync(postPath)) {
  console.error(`[new-post] ${postPath} already exists`);
  process.exit(1);
}

const date = new Date().toISOString().slice(0, 10);
const canonical = external || `https://ryanbaumann.dev/writing/${slug}/`;
const tagList = tags.split(',').map((tag) => tag.trim()).filter(Boolean);

const body = external
  ? ''
  : `

State the thesis in the first paragraph: the claim and why the reader
should care. No throat-clearing.

Evidence from real work. Link the artifact every time.

End with what to do about it, not a summary.
`;

writeFileSync(postPath, `---
title: ${title}
summary: ${summary}
date: ${date}
updated: ${date}
canonical: ${canonical}
tags: ${JSON.stringify(tagList)}
draft: ${draft}
noindex: ${draft}
${publishAt ? `publishAt: ${publishAt}\n` : ''}${external ? `external: ${external}\n` : ''}${external ? '' : `# Required before publishing: three distinct visuals, each with its own alt text.
# Point every path at a real asset, then uncomment. Never a generic site preview.
# image: /img/writing/${slug}.jpg
# imageAlt: A specific description of the evidence shown in the article image
# socialImage: /social/${slug}.jpg
# shareTitle: A concise title for social previews
# shareSummary: One specific claim or reason to read.
# shareImageAlt: A literal description of the social preview image
`}---${body}`);

console.log(`[new-post] created portfolio/content/writing/${slug}.md`);
console.log('[new-post] preview:  cd portfolio && node build.mjs && node serve.mjs');
console.log('[new-post] voice:    .agents/skills/portfolio-writing/SKILL.md');
if (!external) {
  console.log('[new-post] visuals: replace the generic preview before publishing with a dedicated 1200x675 header, distinct 1200x627 social card, and at least one 1200x675 inline evidence image');
}
