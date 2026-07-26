import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { listSkillDirectories, validateSkillDirectory } from '../lib/skill-improvement.mjs';

function writeSkill(directory, { name = 'example-skill', description = 'Use for example work.', body = '# Example\n' } = {}) {
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'SKILL.md'), `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}`);
}

test('discovers and validates a complete skill', () => {
  const root = mkdtempSync(join(tmpdir(), 'skill-improvement-'));
  try {
    const directory = join(root, 'example-skill');
    writeSkill(directory);
    assert.deepEqual(listSkillDirectories(root), [directory]);
    assert.deepEqual(validateSkillDirectory(directory), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rejects template metadata, mismatched names, and stale agent metadata', () => {
  const root = mkdtempSync(join(tmpdir(), 'skill-improvement-'));
  try {
    const directory = join(root, 'example-skill');
    writeSkill(directory, { name: 'wrong-name', description: '[TODO: describe this skill]', body: '# TODO: Finish\n' });
    mkdirSync(join(directory, 'agents'));
    writeFileSync(join(directory, 'agents', 'openai.yaml'), 'interface:\n  default_prompt: "Use a different skill."\n');
    assert.deepEqual(validateSkillDirectory(directory), [
      'frontmatter name must equal directory name (example-skill)',
      'frontmatter description must be a completed trigger description',
      'remove template TODO markers before publishing a skill',
      'skills with agents/openai.yaml must include a vendor-neutral manifest.json',
      'agents/openai.yaml default prompt must name the skill',
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
