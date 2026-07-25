#!/usr/bin/env node
// scripts/check-content.mjs: deterministic gate for the mechanically checkable
// subset of the portfolio content and writing rules.
//
//   node scripts/check-content.mjs            check every collection
//   node scripts/check-content.mjs --warnings-as-errors
//
// Exits non-zero when any error-severity finding remains. Taste, claims, links,
// and rendered output stay with the portfolio-review skill.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { checkDocument, checkStockPhrases } from './lib/content-rules.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const CONTENT = join(ROOT, 'portfolio', 'content');

function collect() {
  const documents = [];
  for (const collection of readdirSync(CONTENT)) {
    const dir = join(CONTENT, collection);
    if (!statSync(dir).isDirectory()) continue;
    for (const name of readdirSync(dir)) {
      // Underscore-prefixed files are templates; the build skips them too.
      if (!name.endsWith('.md') || name.startsWith('_')) continue;
      const path = join(dir, name);
      documents.push({ path: relative(ROOT, path), collection, raw: readFileSync(path, 'utf8') });
    }
  }
  return documents;
}

const strict = process.argv.includes('--warnings-as-errors');
const documents = collect();
const findings = [
  ...documents.flatMap((doc) => checkDocument(doc)),
  ...checkStockPhrases(documents.filter((doc) => doc.collection === 'writing')),
];

findings.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
for (const finding of findings) {
  console.log(`${finding.path}:${finding.line}: ${finding.severity.toUpperCase()} ${finding.rule}: ${finding.message}`);
}

const errors = findings.filter((finding) => finding.severity === 'error').length;
const warnings = findings.length - errors;
console.log(`[content] checked ${documents.length} entries: ${errors} errors, ${warnings} warnings`);
process.exit(errors > 0 || (strict && warnings > 0) ? 1 : 0);
