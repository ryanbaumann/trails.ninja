// scripts/lib/scheduled-publish.mjs: pure logic for the scheduled-deploy
// preflight gate (scripts/check-scheduled-publish.mjs).
//
// `parseFrontMatter` and the publish-time rule below are intentionally
// duplicated from portfolio/build.mjs's `parseFrontMatter` and `isPublished`
// (build.mjs is owned by another workstream and is a top-level script with
// build side effects, so it can't be imported here). If build.mjs's front
// matter or publishAt semantics ever change, update this file to match -
// otherwise a scheduled deploy could decide "nothing to publish" while the
// next real build would in fact publish something (or vice versa).
//
// build.mjs's `isPublished`:
//   if (entry.meta.draft === true) return false;
//   if (!entry.meta.publishAt) return true;
//   return new Date(entry.meta.publishAt).valueOf() <= BUILD_TIME.valueOf();

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Copied verbatim (structure and behavior) from portfolio/build.mjs.
export function parseFrontMatter(raw) {
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

// Copied verbatim from portfolio/build.mjs's isValidIsoTimestamp.
export function isValidIsoTimestamp(value) {
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

// Scans every collection directory directly under `contentDir`
// (portfolio/content/*/[!_]*.md), matching the file set build.mjs's
// loadCollection() considers for the collections that gate on publishAt
// (work, writing, talks). Also picks up `pages/`, which build.mjs never
// time-gates - a publishAt on a page would be a false "due" there, which is
// the safe direction (an unnecessary build), never a missed publish.
export function scanContentEntries(contentDir) {
  const entries = [];
  let collections;
  try {
    collections = readdirSync(contentDir);
  } catch {
    return entries;
  }
  for (const collection of collections) {
    const dir = join(contentDir, collection);
    let stat;
    try {
      stat = statSync(dir);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.md') || file.startsWith('_')) continue;
      const raw = readFileSync(join(dir, file), 'utf8');
      const { meta } = parseFrontMatter(raw);
      entries.push({ collection, file, meta });
    }
  }
  return entries;
}

// Returns the entries that would newly become published between `sinceMs`
// (exclusive) and `nowMs` (inclusive) - i.e. entries a fresh build would
// publish now but the last deploy did not. Entries with no publishAt are
// never time-gated (build.mjs publishes them unconditionally) so they can
// never be "newly due" here. An invalid publishAt is reported as due rather
// than silently skipped: build.mjs's own validation rejects invalid
// publishAt values, so surfacing it here just means an extra build runs
// (and fails loudly there) instead of the gate quietly deciding nothing
// changed.
export function findDueEntries({ entries, sinceMs, nowMs }) {
  const due = [];
  for (const entry of entries) {
    const { meta } = entry;
    if (meta.draft === true) continue;
    if (!meta.publishAt) continue;
    if (!isValidIsoTimestamp(meta.publishAt)) {
      due.push({ ...entry, reason: 'invalid-publishAt' });
      continue;
    }
    const publishMs = new Date(meta.publishAt).valueOf();
    const publishedAsOfSince = publishMs <= sinceMs;
    const publishedNow = publishMs <= nowMs;
    if (publishedNow && !publishedAsOfSince) {
      due.push({ ...entry, reason: 'newly-due' });
    }
  }
  return due;
}
