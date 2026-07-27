#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildSocialDrafts, parseFrontMatter, parseReleaseDraft, stageBufferDraft } from './lib/social-drafts.mjs';

const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const flag = (name) => args[args.indexOf(`--${name}`) + 1];
const before = flag('before');
const after = flag('after');

if (!/^[a-f0-9]{40}$/.test(before || '') || !/^[a-f0-9]{40}$/.test(after || '')) {
  console.error('[social-drafts] usage: node scripts/stage-social-drafts.mjs --before <sha> --after <sha>');
  process.exit(1);
}

const required = ['BUFFER_API_KEY', 'BUFFER_ORGANIZATION_ID', 'BUFFER_LINKEDIN_CHANNEL_ID', 'BUFFER_X_CHANNEL_ID'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`[social-drafts] missing configuration: ${missing.join(', ')}`);
  process.exit(1);
}

const fieldNoteFiles = execFileSync('git', [
  'diff', '--name-only', '--diff-filter=A', before, after, '--', 'portfolio/content/writing/*.md',
], { cwd: REPO_ROOT, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const releaseDraftFiles = execFileSync('git', [
  'diff', '--name-only', '--diff-filter=A', before, after, '--', 'docs/social-drafts/*.json',
], { cwd: REPO_ROOT, encoding: 'utf8' }).trim().split('\n').filter(Boolean);

if (fieldNoteFiles.length === 0 && releaseDraftFiles.length === 0) {
  console.log('[social-drafts] no newly added drafts to stage');
  process.exit(0);
}

async function stage(draft, label) {
  const channelId = draft.channel === 'linkedin'
    ? process.env.BUFFER_LINKEDIN_CHANNEL_ID
    : process.env.BUFFER_X_CHANNEL_ID;
  const result = await stageBufferDraft({
    apiKey: process.env.BUFFER_API_KEY,
    organizationId: process.env.BUFFER_ORGANIZATION_ID,
    channelId,
    text: draft.text,
  });
  console.log(`[social-drafts] ${result.duplicate ? 'reused' : 'staged'} ${draft.channel} draft for ${label} (${result.id})`);
}

for (const file of fieldNoteFiles) {
  const slug = file.split('/').at(-1).replace(/\.md$/, '');
  const meta = parseFrontMatter(readFileSync(resolve(REPO_ROOT, file), 'utf8'));
  const drafts = buildSocialDrafts(meta, slug);
  if (drafts.length === 0) {
    console.log(`[social-drafts] skipped ${slug}; it is published, external, or opted out`);
    continue;
  }
  for (const draft of drafts) {
    await stage(draft, slug);
  }
}

for (const file of releaseDraftFiles) {
  const label = file.split('/').at(-1).replace(/\.json$/, '');
  const draft = parseReleaseDraft(readFileSync(resolve(REPO_ROOT, file), 'utf8'));
  await stage(draft, label);
}
