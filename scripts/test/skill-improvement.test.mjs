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

test('validates development and frozen selection eval coverage', () => {
  const root = mkdtempSync(join(tmpdir(), 'skill-improvement-'));
  try {
    const directory = join(root, 'example-skill');
    writeSkill(directory);
    mkdirSync(join(directory, 'evals'));
    writeFileSync(join(directory, 'evals', 'evals.json'), JSON.stringify({
      skill_name: 'example-skill',
      evals: [
        {
          id: 'D1',
          split: 'development',
          prompt: 'Exercise the behavior.',
          expected_output: 'The behavior is handled.',
          expectations: ['The response handles the behavior.'],
        },
        {
          id: 'S1',
          split: 'selection',
          prompt: 'Exercise a held-out variant.',
          expected_output: 'The held-out behavior is handled.',
          expectations: ['The response handles the held-out variant.'],
        },
      ],
    }));
    assert.deepEqual(validateSkillDirectory(directory), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rejects malformed eval suites and missing selection coverage', () => {
  const root = mkdtempSync(join(tmpdir(), 'skill-improvement-'));
  try {
    const directory = join(root, 'example-skill');
    writeSkill(directory);
    mkdirSync(join(directory, 'evals'));
    writeFileSync(join(directory, 'evals', 'evals.json'), JSON.stringify({
      skill_name: 'wrong-skill',
      evals: [
        {
          id: 'D1',
          split: 'development',
          prompt: 'Exercise the behavior.',
          expected_output: '',
          expectations: [],
        },
        {
          id: 'D1',
          split: 'candidate',
          prompt: '',
          expected_output: 'A result.',
          expectations: ['A check.'],
        },
      ],
    }));
    assert.deepEqual(validateSkillDirectory(directory), [
      'evals skill_name must equal directory name (example-skill)',
      'eval 1 must include expected_output',
      'eval 1 must include non-empty string expectations',
      'eval 2 id must be unique (D1)',
      'eval 2 split must be development or selection',
      'eval 2 must include a prompt',
      'evals/evals.json must preserve at least one frozen selection case',
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rejects non-object evals and suites without development coverage', () => {
  const root = mkdtempSync(join(tmpdir(), 'skill-improvement-'));
  try {
    const directory = join(root, 'example-skill');
    writeSkill(directory);
    mkdirSync(join(directory, 'evals'));
    writeFileSync(join(directory, 'evals', 'evals.json'), JSON.stringify({
      skill_name: 'example-skill',
      evals: [
        null,
        {
          id: 'S1',
          split: 'selection',
          prompt: 'Exercise a held-out variant.',
          expected_output: 'A result.',
          expectations: ['A check.'],
        },
      ],
    }));
    assert.deepEqual(validateSkillDirectory(directory), [
      'eval 1 must be an object',
      'evals/evals.json must contain at least one development case',
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
