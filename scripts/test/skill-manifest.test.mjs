import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const SKILLS_DIR = resolve(import.meta.dirname, '..', '..', '.agents', 'skills');

const FIELDS = [
  ['displayName', 'display_name'],
  ['shortDescription', 'short_description'],
  ['defaultPrompt', 'default_prompt'],
  ['allowImplicitInvocation', 'allow_implicit_invocation'],
];

// The adapters are flat two-level YAML holding four scalars. Reading them with a
// few regexes keeps this check zero-dependency, like the rest of the repo.
function readAdapterValue(yaml, key) {
  const match = new RegExp(`^\\s*${key}:\\s*(.+)$`, 'm').exec(yaml);
  if (!match) return undefined;
  const raw = match[1].trim();
  if (raw === 'true' || raw === 'false') return raw === 'true';
  return raw.replace(/^"(.*)"$/, '$1');
}

function skillsWithAdapters() {
  return readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => existsSync(join(SKILLS_DIR, name, 'agents')));
}

// Vendor-neutral metadata is the source of truth: any harness can read
// manifest.json, and a vendor adapter is one optional projection of it.
// See agent-scripts/AGENTS.md, "Keep evergreen prompts vendor-neutral."
test('every skill with a vendor adapter has a neutral manifest', () => {
  for (const skill of skillsWithAdapters()) {
    assert.ok(
      existsSync(join(SKILLS_DIR, skill, 'manifest.json')),
      `${skill} ships a vendor adapter with no manifest.json; vendor files must never be the only copy`,
    );
  }
});

test('vendor adapters match the neutral manifest', () => {
  for (const skill of skillsWithAdapters()) {
    const manifest = JSON.parse(readFileSync(join(SKILLS_DIR, skill, 'manifest.json'), 'utf8'));
    const adapterDir = join(SKILLS_DIR, skill, 'agents');
    for (const file of readdirSync(adapterDir).filter((name) => /\.ya?ml$/.test(name))) {
      const yaml = readFileSync(join(adapterDir, file), 'utf8');
      for (const [neutralKey, adapterKey] of FIELDS) {
        const adapterValue = readAdapterValue(yaml, adapterKey);
        if (adapterValue === undefined && manifest[neutralKey] === undefined) continue;
        assert.deepEqual(
          adapterValue,
          manifest[neutralKey],
          `${skill}/agents/${file}: ${adapterKey} drifted from manifest.json ${neutralKey}`,
        );
      }
    }
  }
});
