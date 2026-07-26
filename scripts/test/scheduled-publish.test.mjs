import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { checkScheduledPublish } from '../check-scheduled-publish.mjs';
import { findDueEntries, isValidIsoTimestamp, parseFrontMatter, scanContentEntries } from '../lib/scheduled-publish.mjs';

function entry(publishAt, extra = '') {
  return `---\ntitle: A note\ndraft: false\n${publishAt ? `publishAt: ${publishAt}\n` : ''}${extra}---\nBody.`;
}

test('parseFrontMatter matches build.mjs semantics for a scheduled entry', () => {
  const { meta, body } = parseFrontMatter(entry('2026-08-01T16:00:00Z'));
  assert.equal(meta.title, 'A note');
  assert.equal(meta.draft, false);
  assert.equal(meta.publishAt, '2026-08-01T16:00:00Z');
  assert.equal(body, 'Body.');
});

test('isValidIsoTimestamp rejects non-UTC and malformed timestamps', () => {
  assert.equal(isValidIsoTimestamp('2026-08-01T16:00:00Z'), true);
  assert.equal(isValidIsoTimestamp('2026-08-01T16:00:00'), false);
  assert.equal(isValidIsoTimestamp('2026-08-01'), false);
  assert.equal(isValidIsoTimestamp('not-a-date'), false);
});

test('findDueEntries: nothing due when no publishAt entries exist', () => {
  const entries = [{ collection: 'writing', file: 'a.md', meta: { title: 'x', draft: false } }];
  const due = findDueEntries({ entries, sinceMs: Date.parse('2026-07-01T00:00:00Z'), nowMs: Date.parse('2026-07-26T00:00:00Z') });
  assert.deepEqual(due, []);
});

test('findDueEntries: nothing due when publishAt was already published as of the last deploy', () => {
  const entries = [{ collection: 'writing', file: 'a.md', meta: { publishAt: '2026-07-01T00:00:00Z', draft: false } }];
  const due = findDueEntries({ entries, sinceMs: Date.parse('2026-07-10T00:00:00Z'), nowMs: Date.parse('2026-07-26T00:00:00Z') });
  assert.deepEqual(due, []);
});

test('findDueEntries: nothing due when publishAt is still in the future', () => {
  const entries = [{ collection: 'writing', file: 'a.md', meta: { publishAt: '2099-01-01T00:00:00Z', draft: false } }];
  const due = findDueEntries({ entries, sinceMs: Date.parse('2026-07-01T00:00:00Z'), nowMs: Date.parse('2026-07-26T00:00:00Z') });
  assert.deepEqual(due, []);
});

test('findDueEntries: due when publishAt falls between the last deploy and now', () => {
  const entries = [{ collection: 'writing', file: 'a.md', meta: { publishAt: '2026-07-20T00:00:00Z', draft: false } }];
  const due = findDueEntries({ entries, sinceMs: Date.parse('2026-07-01T00:00:00Z'), nowMs: Date.parse('2026-07-26T00:00:00Z') });
  assert.equal(due.length, 1);
  assert.equal(due[0].reason, 'newly-due');
});

test('findDueEntries: a draft entry is never due regardless of publishAt', () => {
  const entries = [{ collection: 'writing', file: 'a.md', meta: { publishAt: '2026-07-20T00:00:00Z', draft: true } }];
  const due = findDueEntries({ entries, sinceMs: Date.parse('2026-07-01T00:00:00Z'), nowMs: Date.parse('2026-07-26T00:00:00Z') });
  assert.deepEqual(due, []);
});

test('findDueEntries: an invalid publishAt is reported as due (fail safe, build.mjs will reject it loudly)', () => {
  const entries = [{ collection: 'writing', file: 'a.md', meta: { publishAt: 'not-a-real-timestamp', draft: false } }];
  const due = findDueEntries({ entries, sinceMs: Date.parse('2026-07-01T00:00:00Z'), nowMs: Date.parse('2026-07-26T00:00:00Z') });
  assert.equal(due.length, 1);
  assert.equal(due[0].reason, 'invalid-publishAt');
});

test('scanContentEntries reads collections and skips underscore-prefixed template files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'scheduled-publish-'));
  try {
    const writingDir = join(dir, 'writing');
    mkdirSync(writingDir);
    writeFileSync(join(writingDir, 'a.md'), entry('2026-07-20T00:00:00Z'));
    writeFileSync(join(writingDir, '_TEMPLATE.md'), entry('2026-07-20T00:00:00Z'));
    writeFileSync(join(dir, 'site.json'), '{}');
    const entries = scanContentEntries(dir);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].file, 'a.md');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('checkScheduledPublish fails safe (due=true) when PUBLISH_CHECK_SINCE is missing', () => {
  const result = checkScheduledPublish({});
  assert.equal(result.due, true);
  assert.equal(result.reason, 'missing-or-invalid-since');
});

test('checkScheduledPublish fails safe (due=true) when PUBLISH_CHECK_SINCE is unparsable', () => {
  const result = checkScheduledPublish({ PUBLISH_CHECK_SINCE: 'garbage' });
  assert.equal(result.due, true);
  assert.equal(result.reason, 'missing-or-invalid-since');
});

test('checkScheduledPublish end to end: nothing due against real repo content with a since of "now"', () => {
  const result = checkScheduledPublish({ PUBLISH_CHECK_SINCE: new Date().toISOString() });
  assert.equal(result.due, false);
  assert.deepEqual(result.entries, []);
});

test('checkScheduledPublish end to end: reports due against a fixture with a newly-due entry', () => {
  const dir = mkdtempSync(join(tmpdir(), 'scheduled-publish-e2e-'));
  const writingDir = join(dir, 'writing');
  mkdirSync(writingDir);
  try {
    writeFileSync(join(writingDir, 'due.md'), entry('2026-07-20T00:00:00Z'));
    const result = checkScheduledPublish({
      PUBLISH_CHECK_CONTENT_DIR: dir,
      PUBLISH_CHECK_SINCE: '2026-07-01T00:00:00Z',
      PUBLISH_CHECK_NOW: '2026-07-26T00:00:00Z',
    });
    assert.equal(result.due, true);
    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0].publishAt, '2026-07-20T00:00:00Z');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Drift canary. LEARNINGS.md 2026-07-25 ("A publication gate copied by hand
// drifts from the one the build uses") records this exact failure mode: two
// code paths answering the same question about content state, where the copy
// silently goes wrong for the case nobody tested.
//
// findDueEntries() reimplements portfolio/build.mjs's isPublished() because
// build.mjs cannot be imported (it is a top-level script with build side
// effects, and design rule 7 keeps portfolio/ extractable, so it must not
// import from scripts/). This test pins the source text of isPublished so any
// edit to it fails here loudly instead of silently desynchronising the
// scheduled-deploy gate — which would mean a post never going live.
test('build.mjs isPublished has not drifted from findDueEntries reimplementation', () => {
  const buildSource = readFileSync(
    new URL('../../portfolio/build.mjs', import.meta.url),
    'utf8',
  );
  const match = buildSource.match(/function isPublished\(entry\) \{([\s\S]*?)\n\}/);
  assert.ok(match, 'could not find isPublished() in portfolio/build.mjs');

  const normalized = match[1].split('\n').map((line) => line.trim()).filter(Boolean).join(' ');
  assert.equal(
    normalized,
    "if (entry.meta.draft === true) return false; if (!entry.meta.publishAt) return true; return new Date(entry.meta.publishAt).valueOf() <= BUILD_TIME.valueOf();",
    'portfolio/build.mjs isPublished() changed. Update findDueEntries() in '
    + 'scripts/lib/scheduled-publish.mjs to match, then update this expected string.',
  );
});
