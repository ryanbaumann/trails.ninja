#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function missingDeclaredPaths(treePaths, declaredPaths) {
  return declaredPaths.filter((declared) =>
    !treePaths.some((actual) => actual === declared || actual.startsWith(`${declared}/`)),
  );
}

export async function validateSkillSources(manifest, { fetchImpl = fetch } = {}) {
  const failures = [];
  for (const source of manifest.sources ?? []) {
    if (source.type === 'documentation') {
      const response = await fetchImpl(source.url, { redirect: 'follow' });
      if (!response.ok) failures.push(`${source.name} (${source.url}): HTTP ${response.status}`);
      continue;
    }
    if (source.type !== 'github') continue;

    const treeUrl = `https://api.github.com/repos/${source.repo}/git/trees/${source.ref}?recursive=1`;
    const response = await fetchImpl(treeUrl, {
      headers: { accept: 'application/vnd.github+json', 'user-agent': 'atlas-source-integrity-check' },
    });
    if (!response.ok) {
      failures.push(`${source.name} (${source.repo}@${source.ref}): HTTP ${response.status}`);
      continue;
    }
    const body = await response.json();
    if (body.truncated) {
      failures.push(`${source.name} (${source.repo}@${source.ref}): recursive tree was truncated`);
      continue;
    }
    const treePaths = Array.isArray(body.tree) ? body.tree.map((item) => item.path).filter(Boolean) : [];
    for (const path of missingDeclaredPaths(treePaths, source.paths ?? [])) {
      failures.push(`${source.name} (${source.repo}@${source.ref}): ${path}`);
    }
  }

  if (failures.length) {
    throw new Error(`Pinned source integrity check failed:\n${failures.map((failure) => `- ${failure}`).join('\n')}`);
  }
  return { checked: manifest.sources?.length ?? 0 };
}

async function main() {
  const manifestPath = new URL('../.agents/skill-sources.json', import.meta.url);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const result = await validateSkillSources(manifest);
  console.log(`SOURCE PINS PASS  ${result.checked} sources`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
