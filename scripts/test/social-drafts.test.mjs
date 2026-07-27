import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildSocialDrafts, parseFrontMatter, parseReleaseDraft, stageBufferDraft } from '../lib/social-drafts.mjs';

const MARKDOWN = `---
title: Developer experience is a growth engine
summary: Better developer journeys improve activation and retention.
canonical: https://ryanbaumann.dev/writing/devex-growth/
draft: true
noindex: true
---
Body.`;

test('builds distinct tracked LinkedIn and X drafts for a new Field Note draft', () => {
  const drafts = buildSocialDrafts(parseFrontMatter(MARKDOWN), 'devex-growth', new Date('2026-07-18T12:00:00Z'));
  assert.equal(drafts.length, 2);
  assert.match(drafts[0].text, /utm_source=linkedin/);
  assert.match(drafts[0].text, /utm_campaign=fn_devex_growth_202607/);
  assert.match(drafts[0].text, /Better developer journeys/);
  assert.match(drafts[1].text, /utm_source=x/);
  assert.ok(drafts[1].text.length <= 280);
});

test('skips published, external, and opted-out Field Notes', () => {
  const base = parseFrontMatter(MARKDOWN);
  assert.deepEqual(buildSocialDrafts({ ...base, draft: false }, 'draft'), []);
  assert.deepEqual(buildSocialDrafts({ ...base, external: 'https://example.com' }, 'draft'), []);
  assert.deepEqual(buildSocialDrafts({ ...base, stageSocial: false }, 'draft'), []);
});

// `npm run new:post -- "Title" --schedule <timestamp>` writes draft: false with a
// future publishAt, which build.mjs treats as unpublished. Staging runs once, on
// the commit that adds the file, so a note skipped here never gets a draft at all.
test('stages drafts for a scheduled Field Note that has not published yet', () => {
  const meta = { ...parseFrontMatter(MARKDOWN), draft: false, publishAt: '2026-08-01T16:00:00Z' };
  const drafts = buildSocialDrafts(meta, 'devex-growth', new Date('2026-07-18T12:00:00Z'));
  assert.equal(drafts.length, 2);
  assert.match(drafts[0].text, /utm_source=linkedin/);
  assert.match(drafts[1].text, /utm_source=x/);
});

test('skips a Field Note whose publishAt has already passed', () => {
  const meta = { ...parseFrontMatter(MARKDOWN), draft: false, publishAt: '2026-07-01T16:00:00Z' };
  assert.deepEqual(buildSocialDrafts(meta, 'devex-growth', new Date('2026-07-18T12:00:00Z')), []);
});

test('validates a checked-in release social draft', () => {
  assert.deepEqual(
    parseReleaseDraft('{"channel":"linkedin","text":"A small product update."}'),
    { channel: 'linkedin', text: 'A small product update.' },
  );
  assert.throws(() => parseReleaseDraft('{"channel":"email","text":"Nope"}'), /channel/);
  assert.throws(() => parseReleaseDraft('{"channel":"x","text":""}'), /between 1 and 3,000/);
  assert.throws(
    () => parseReleaseDraft(JSON.stringify({ channel: 'x', text: 'x'.repeat(281) })),
    /at most 280/,
  );
});

test('stages an unpublished Buffer draft with variables instead of interpolated text', async () => {
  const calls = [];
  const fetchImpl = async (_url, options) => {
    calls.push(JSON.parse(options.body));
    return calls.length === 1
      ? { ok: true, json: async () => ({ data: { posts: { edges: [] } } }) }
      : { ok: true, json: async () => ({ data: { createPost: { post: { id: 'post-1' } } } }) };
  };
  const result = await stageBufferDraft({ apiKey: 'secret', organizationId: 'org', channelId: 'linkedin', text: 'Draft "copy"', fetchImpl });
  assert.deepEqual(result, { id: 'post-1', duplicate: false });
  assert.doesNotMatch(calls[1].query, /Draft "copy"/);
  assert.deepEqual(calls[1].variables.input, {
    text: 'Draft "copy"', channelId: 'linkedin', schedulingType: 'automatic', mode: 'addToQueue', saveToDraft: true, source: 'field-notes',
  });
});

test('reuses an exact current Buffer draft before creating another', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return { ok: true, json: async () => ({ data: { posts: { edges: [{ node: { id: 'existing', text: 'Same draft' } }] } } }) };
  };
  const result = await stageBufferDraft({ apiKey: 'secret', organizationId: 'org', channelId: 'x', text: 'Same draft', fetchImpl });
  assert.deepEqual(result, { id: 'existing', duplicate: true });
  assert.equal(calls, 1);
});

test('surfaces typed Buffer mutation errors', async () => {
  const fetchImpl = async (_url, options) => JSON.parse(options.body).query.includes('ExistingDrafts')
    ? { ok: true, json: async () => ({ data: { posts: { edges: [] } } }) }
    : { ok: true, json: async () => ({ data: { createPost: { message: 'Channel is unavailable.' } } }) };
  await assert.rejects(
    stageBufferDraft({ apiKey: 'secret', organizationId: 'org', channelId: 'x', text: 'Draft', fetchImpl }),
    /Channel is unavailable/,
  );
});
