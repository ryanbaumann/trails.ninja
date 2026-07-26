#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateManifestEntries } from '../gateway/lib/apps.js';
import { CSP_MANIFEST_POLICIES } from '../gateway/lib/staticFiles.js';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APPS_PATH = join(REPO_ROOT, 'apps.json');
const DOCKERFILE = readFileSync(join(REPO_ROOT, 'Dockerfile'), 'utf8');
const DEPENDABOT = readFileSync(join(REPO_ROOT, '.github/dependabot.yml'), 'utf8');
const GATEWAY_SERVER = readFileSync(join(REPO_ROOT, 'gateway/server.js'), 'utf8');
const TAG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Read from the gateway rather than re-listed here, so a policy added there is
// automatically accepted (and one removed is automatically rejected).
const CSP_MANIFEST_VALUES = Object.keys(CSP_MANIFEST_POLICIES);

const errors = [];
const fail = (message) => errors.push(message);

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`${label} is not valid JSON: ${error.message}`);
    return null;
  }
}

const apps = readJson(APPS_PATH, 'apps.json') || [];
try {
  validateManifestEntries(apps);
} catch (error) {
  fail(error.message);
}

const manifestDemoDirs = new Set();

for (const app of apps) {
  const label = app.name || '(unnamed app)';
  if (typeof app.title !== 'string' || !app.title.trim()) fail(`${label}: title is required`);
  if (typeof app.description !== 'string' || !app.description.trim()) fail(`${label}: description is required`);
  if (!Array.isArray(app.tags)) fail(`${label}: tags must be an array`);
  else {
    if (new Set(app.tags).size !== app.tags.length) fail(`${label}: tags must be unique`);
    if (app.tags.some((tag) => typeof tag !== 'string' || !TAG_PATTERN.test(tag))) {
      fail(`${label}: tags must be lowercase kebab-case`);
    }
  }

  // The gateway picks a Content-Security-Policy from this field, never from
  // `tags` (see the comment at the CSP selection in gateway/server.js). Both
  // directions are checked: an unknown value would silently fall back to the
  // strict default policy and break the app, and a Maps demo that forgets the
  // field would be served a CSP that blocks the Maps JS API loader.
  if (app.csp !== undefined && !CSP_MANIFEST_VALUES.includes(app.csp)) {
    fail(`${label}: csp must be one of ${CSP_MANIFEST_VALUES.map((value) => JSON.stringify(value)).join(', ')} when present (got ${JSON.stringify(app.csp)})`);
  }
  if (app.tags?.includes('google-maps-platform') && !app.path.startsWith('http') && !CSP_MANIFEST_VALUES.includes(app.csp)) {
    fail(`${label}: apps loading the Maps JS API must declare a maps CSP (${CSP_MANIFEST_VALUES.join(' or ')}) so the gateway serves the Maps CSP`);
  }

  if (app.api?.type === 'gateway') {
    const route = app.api.path || app.api.prefix;
    if (!GATEWAY_SERVER.includes(route)) fail(`${label}: declared gateway API is not registered in gateway/server.js (${route})`);
  }
  const isExternal = app.path.startsWith('http');
  const isHostedDemo = app.path !== '/' && app.name !== 'fieldwork-writer' && !isExternal;
  if (isHostedDemo && app.path !== `/${app.name}/`) fail(`${label}: hosted demo path must be /${app.name}/`);
  if (isHostedDemo && !app.tags?.length) fail(`${label}: hosted demos need at least one tag`);
  if (app.source?.type === 'artifact') {
    if ((app.visibility || 'public') !== 'private') fail(`${label}: external artifacts must be private by default`);
    continue;
  }

  if (typeof app.dev_build_dir !== 'string' || !app.dev_build_dir) continue;
  if (isAbsolute(app.dev_build_dir)) { fail(`${label}: dev_build_dir must be repo-relative`); continue; }

  const outputDir = resolve(REPO_ROOT, app.dev_build_dir);
  if (relative(REPO_ROOT, outputDir).startsWith('..')) {
    fail(`${label}: dev_build_dir escapes the repository`);
    continue;
  }
  const packageDir = dirname(outputDir);
  const packageJsonPath = join(packageDir, 'package.json');
  const packageJson = existsSync(packageJsonPath) ? readJson(packageJsonPath, `${label} package.json`) : null;
  if (!packageJson) fail(`${label}: missing package.json beside build output`);
  else {
    if (!packageJson.scripts?.build) fail(`${label}: package.json needs a build script`);
    if (!packageJson.scripts?.test) fail(`${label}: package.json needs a deterministic test script`);
    if (!packageJson.engines?.node) fail(`${label}: package.json must declare engines.node`);
  }

  const packagePath = relative(REPO_ROOT, packageDir).replaceAll('\\', '/');
  if (!packagePath.startsWith('demos/')) continue;
  manifestDemoDirs.add(packagePath);

  if (!existsSync(join(packageDir, 'package-lock.json'))) fail(`${label}: hosted demos need package-lock.json`);
  if (!DOCKERFILE.includes('scripts/build-local.mjs')) fail('Dockerfile must use the manifest-driven build');
  if (!DEPENDABOT.includes(`directory: "/${packagePath}"`)) fail(`${label}: missing Dependabot entry`);

  if ((app.visibility || 'public') === 'public') {
    if (typeof app.preview !== 'string' || !app.preview.startsWith('/previews/')) {
      fail(`${label}: public demos need a /previews/ image`);
    } else if (!existsSync(join(REPO_ROOT, 'portfolio/static', app.preview.slice(1)))) {
      fail(`${label}: preview asset does not exist (${app.preview})`);
    }
  }
}

for (const dirent of readdirSync(join(REPO_ROOT, 'demos'), { withFileTypes: true })) {
  if (!dirent.isDirectory()) continue;
  const packagePath = `demos/${dirent.name}`;
  if (existsSync(join(REPO_ROOT, packagePath, 'package.json')) && !manifestDemoDirs.has(packagePath)) {
    fail(`${packagePath}: package exists but is missing from apps.json`);
  }
}

if (errors.length) {
  console.error('[labs] validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const demos = apps.filter((app) => app.path !== '/' && app.name !== 'fieldwork-writer');
console.log(`[labs] validated ${demos.length} hosted demos and ${apps.length} manifest entries`);
