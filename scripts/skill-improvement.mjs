#!/usr/bin/env node

import { relative, resolve } from 'node:path';

import { listSkillDirectories, validateSkillDirectory } from './lib/skill-improvement.mjs';

const root = resolve(import.meta.dirname, '..');
const skills = listSkillDirectories(resolve(root, '.agents/skills'));
const findings = skills.flatMap((directory) => validateSkillDirectory(directory)
  .map((message) => `${relative(root, directory)}: ${message}`));

for (const finding of findings) console.error(`[skills] ${finding}`);
if (findings.length) process.exit(1);

console.log(`[skills] validated ${skills.length} local skills`);
console.log('[skills] Next: mine only relevant LEARNINGS.md entries, add or update a case, and retain the change only when the held-out gate improves without a safety regression.');
