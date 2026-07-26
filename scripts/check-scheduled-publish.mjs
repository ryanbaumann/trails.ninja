#!/usr/bin/env node
// scripts/check-scheduled-publish.mjs: preflight gate for the hourly
// scheduled deploy (see .github/workflows/deploy.yml). The cron trigger
// exists only so posts with a future `publishAt` go live on time; most
// hourly ticks publish nothing. This script decides whether the current
// tick has anything newly due, so the workflow can skip the Cloud Build +
// Cloud Run deploy when it doesn't.
//
// "Newly due" is measured against the timestamp of the last successful
// deploy (any trigger), not a locally cached value - there is no persistent
// state between workflow runs, and re-deriving it fresh each time means a
// missed or failed run can never cause a post to be silently skipped: the
// window just gets wider until a deploy actually succeeds.
//
// Env:
//   PUBLISH_CHECK_SINCE  ISO-8601 timestamp of the last successful deploy.
//                        If unset or unparsable, this script fails safe and
//                        reports `due=true` - an unnecessary build is an
//                        acceptable cost, a missed publish is not.
//   PUBLISH_CHECK_NOW    ISO-8601 timestamp to treat as "now" (defaults to
//                        the real current time). Override in tests only.
//   PUBLISH_CHECK_CONTENT_DIR  Content directory to scan (defaults to
//                        portfolio/content relative to the repo root).
//   GITHUB_OUTPUT        When set (as it is in Actions), this script
//                        appends `due=true`/`due=false` to it.
//
// Exit code is always 0: this script's job is to report, not to fail the
// workflow. Any unexpected error is caught and reported as due=true so the
// deploy proceeds instead of a bug here silently blocking publication.

import { appendFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { findDueEntries, scanContentEntries } from './lib/scheduled-publish.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function parseTimestamp(value) {
  if (!value) return null;
  const ms = new Date(value).valueOf();
  return Number.isNaN(ms) ? null : ms;
}

export function checkScheduledPublish(env = process.env) {
  const contentDir = env.PUBLISH_CHECK_CONTENT_DIR || resolve(REPO_ROOT, 'portfolio', 'content');
  const nowMs = parseTimestamp(env.PUBLISH_CHECK_NOW) ?? Date.now();
  const sinceMs = parseTimestamp(env.PUBLISH_CHECK_SINCE);

  if (sinceMs === null) {
    return {
      due: true,
      reason: 'missing-or-invalid-since',
      entries: [],
    };
  }

  const entries = scanContentEntries(contentDir);
  const due = findDueEntries({ entries, sinceMs, nowMs });
  return {
    due: due.length > 0,
    reason: due.length > 0 ? 'entries-newly-due' : 'nothing-due',
    entries: due.map(({ collection, file, meta, reason }) => ({
      collection,
      file,
      publishAt: meta.publishAt,
      reason,
    })),
  };
}

function main() {
  let result;
  try {
    result = checkScheduledPublish(process.env);
  } catch (error) {
    result = { due: true, reason: 'error', error: error.message, entries: [] };
  }

  console.log(JSON.stringify(result, null, 2));

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `due=${result.due}\n`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
