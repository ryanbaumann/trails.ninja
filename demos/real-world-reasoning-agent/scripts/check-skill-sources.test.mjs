import assert from 'node:assert/strict';
import test from 'node:test';
import { missingDeclaredPaths, validateSkillSources } from './check-skill-sources.mjs';

test('missingDeclaredPaths accepts a declared directory represented by descendants', () => {
  const tree = ['client/web/src/index.ts', 'agent/schema/catalog.json'];
  assert.deepEqual(missingDeclaredPaths(tree, ['client/web', 'agent/schema']), []);
  assert.deepEqual(missingDeclaredPaths(tree, ['specification']), ['specification']);
});

test('validateSkillSources fails loudly with the source, ref, and missing path', async () => {
  const manifest = {
    sources: [{ name: 'a2ui', type: 'github', repo: 'example/a2ui', ref: 'abc123', paths: ['missing/path'] }],
  };
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ truncated: false, tree: [{ path: 'present/path/file.ts' }] }),
  });

  await assert.rejects(
    validateSkillSources(manifest, { fetchImpl }),
    /a2ui \(example\/a2ui@abc123\): missing\/path/,
  );
});
