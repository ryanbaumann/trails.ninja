import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const PORTFOLIO_ROOT = resolve(import.meta.dirname, '..');
const BUILD_SCRIPT = join(PORTFOLIO_ROOT, 'build.mjs');

function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'portfolio-build-'));
  const content = join(root, 'content');
  const staticDir = join(root, 'static');
  const dist = join(root, 'dist');
  const manifest = join(root, 'apps.json');
  for (const collection of ['work', 'writing', 'talks', 'scripts', 'pages']) mkdirSync(join(content, collection), { recursive: true });
  write(join(staticDir, 'share.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630"></svg>');
  write(join(content, 'site.json'), JSON.stringify({
    name: 'Test Person',
    role: 'Builder',
    tagline: 'Build things',
    location: 'Test City',
    intro: 'A test portfolio.',
    headline: 'Selected work.',
    description: 'A test portfolio used to verify the static build.',
    aboutTeaser: 'A short background.',
    positioning: 'Build things.',
    answerEngineSummary: 'Test Person builds things.',
    sectionIntros: { work: 'Work.', writing: 'Writing.', talks: 'Talks.', scripts: 'Reusable agent instructions.', demos: 'Demos.' },
    links: { github: 'https://github.com/example', linkedin: 'https://www.linkedin.com/in/example/' },
    siteUrl: 'https://example.com/',
    canonicalHost: 'example.com',
    defaultShareImage: '/share.svg',
    defaultShareImageAlt: 'Test Person portfolio preview.',
  }));
  write(manifest, JSON.stringify([
    { name: 'fieldwork', title: 'Test Site', description: 'Home', path: '/', dev_build_dir: 'portfolio/dist' },
    { name: 'public-demo', title: 'Public demo', description: 'Visible', path: '/public/', visibility: 'public' },
    { name: 'private-demo', title: 'Private demo', description: 'Hidden', path: '/private/', visibility: 'private', auth: { type: 'password', envVar: 'PRIVATE_DEMO_PASSWORD' } },
  ]));
  return { root, content, staticDir, dist, manifest };
}

function build(paths, env = {}) {
  return spawnSync(process.execPath, [BUILD_SCRIPT], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PORTFOLIO_CONTENT_DIR: paths.content,
      PORTFOLIO_STATIC_DIR: paths.staticDir,
      PORTFOLIO_DIST_DIR: paths.dist,
      PORTFOLIO_APPS_MANIFEST: paths.manifest,
      ...env,
    },
  });
}

test('build keeps drafts and future writing out of public output', () => {
  const paths = fixture();
  write(join(paths.content, 'writing', 'draft.md'), `---\ntitle: Draft essay\nsummary: Private draft\ndate: 2026-07-13\ndraft: true\nnoindex: true\n---\nDraft.`);
  write(join(paths.content, 'writing', 'scheduled.md'), `---\ntitle: Scheduled essay\nsummary: Future essay\ndate: 2026-07-14\npublishAt: 2026-07-14T12:00:00Z\n---\nScheduled.`);
  const result = build(paths, { PORTFOLIO_BUILD_TIME: '2026-07-13T12:00:00Z' });
  assert.equal(result.status, 0, result.stderr);
  const writing = readFileSync(join(paths.dist, 'writing', 'index.html'), 'utf8');
  const feed = readFileSync(join(paths.dist, 'feed.xml'), 'utf8');
  const sitemap = readFileSync(join(paths.dist, 'sitemap.xml'), 'utf8');
  assert.doesNotMatch(writing, /Draft essay|Scheduled essay/);
  assert.doesNotMatch(feed, /Draft essay|Scheduled essay/);
  assert.doesNotMatch(sitemap, /writing\/(draft|scheduled)/);
  assert.throws(() => readFileSync(join(paths.dist, 'writing', 'draft', 'index.html')), /ENOENT/);
  assert.throws(() => readFileSync(join(paths.dist, 'writing', 'scheduled', 'index.html')), /ENOENT/);
});

test('writer build previews drafts and future writing with a noindex dashboard', () => {
  const paths = fixture();
  write(join(paths.content, 'writing', 'draft.md'), `---\ntitle: Draft essay\nsummary: Private draft\ndate: 2026-07-13\ndraft: true\nnoindex: true\n---\n## Draft section\nDraft.`);
  write(join(paths.content, 'writing', 'scheduled.md'), `---\ntitle: Scheduled essay\nsummary: Future essay\ndate: 2026-07-14\npublishAt: 2026-07-14T12:00:00Z\n---\nScheduled.`);
  const result = build(paths, {
    BASE_PATH: '/writer/',
    PORTFOLIO_WRITER_MODE: 'true',
    PORTFOLIO_BUILD_TIME: '2026-07-13T12:00:00Z',
  });
  assert.equal(result.status, 0, result.stderr);
  const dashboard = readFileSync(join(paths.dist, 'index.html'), 'utf8');
  const draft = readFileSync(join(paths.dist, 'writing', 'draft', 'index.html'), 'utf8');
  assert.match(dashboard, /Writer dashboard/);
  assert.match(dashboard, /Draft essay/);
  assert.match(dashboard, /Scheduled essay/);
  assert.match(dashboard, /name="publishAt"/);
  assert.match(dashboard, /name="sourceSlug" value="draft"/);
  assert.match(dashboard, /action="\/api\/writer\/social"/);
  assert.match(dashboard, /Stage LinkedIn draft/);
  assert.match(dashboard, /Stage X draft/);
  assert.match(dashboard, /utm_source=linkedin/);
  assert.match(dashboard, /utm_source=x/);
  assert.match(dashboard, /maxlength="280"/);
  assert.match(dashboard, /data-writer-pagination/);
  assert.match(dashboard, /aria-label="Field Notes pages"/);
  assert.match(dashboard, /Math\.ceil\(items\.length\/5\)/);
  assert.ok(dashboard.indexOf('value="draft"') < dashboard.indexOf('value="publish-now"'));
  assert.match(dashboard, /window\.confirm\('Publish this essay now\?/);
  assert.match(dashboard, /unpublished Buffer draft\?/);
  assert.match(draft, /<meta name="robots" content="noindex, nofollow"/);
});

test('build publishes scheduled writing once its timestamp is due', () => {
  const paths = fixture();
  write(join(paths.content, 'writing', 'scheduled.md'), `---\ntitle: Scheduled essay\nsummary: Due essay\ndate: 2026-07-14\npublishAt: 2026-07-14T12:00:00Z\n---\nScheduled.`);
  const result = build(paths, { PORTFOLIO_BUILD_TIME: '2026-07-14T12:00:01Z' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(join(paths.dist, 'writing', 'index.html'), 'utf8'), /Scheduled essay/);
  assert.match(readFileSync(join(paths.dist, 'feed.xml'), 'utf8'), /Scheduled essay/);
});

test('build emits published aliases and omits redirects from writer previews', () => {
  const paths = fixture();
  write(join(paths.content, 'writing', 'source.md'), `---\ntitle: Renamed essay\nsummary: Redirect fixture\ndate: 2026-07-14\nslug: current\naliases: ["/writing/previous/"]\ncanonical: https://example.com/writing/current/\n---\nPublished.`);
  let result = build(paths);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(readFileSync(join(paths.dist, 'redirects.json'), 'utf8')), {
    '/lab/': '/demos/',
    '/labs/': '/demos/',
    '/atlas/': '/real-world-reasoning-agent/',
    '/labs/atlas/': '/real-world-reasoning-agent/',
    '/demos/atlas/': '/real-world-reasoning-agent/',
    '/writing/previous/': '/writing/current/',
  });

  result = build(paths, { BASE_PATH: '/writer/', PORTFOLIO_WRITER_MODE: 'true' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(readFileSync(join(paths.dist, 'redirects.json'), 'utf8')), {});
});

test('build rejects aliases that collide with canonical pages and stale same-site canonicals', () => {
  const paths = fixture();
  write(join(paths.content, 'writing', 'first.md'), `---\ntitle: First\nsummary: First fixture\ndate: 2026-07-14\naliases: ["/writing/second/"]\ncanonical: https://example.com/writing/stale/\n---\nFirst.`);
  write(join(paths.content, 'writing', 'second.md'), `---\ntitle: Second\nsummary: Second fixture\ndate: 2026-07-13\n---\nSecond.`);
  const result = build(paths);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /alias collides with a generated canonical path/);
  assert.match(result.stderr, /same-site canonical must match the generated detail URL/);
});

test('build rejects aliases on external and bodyless entries', () => {
  const paths = fixture();
  write(join(paths.content, 'writing', 'external.md'), `---\ntitle: External\nsummary: External fixture\ndate: 2026-07-14\nexternal: https://example.org/post\naliases: ["/writing/old-external/"]\n---`);
  write(join(paths.content, 'work', 'bodyless.md'), `---\ntitle: Bodyless\nsummary: Bodyless fixture\naliases: ["/work/old-bodyless/"]\n---`);
  const result = build(paths);
  assert.notEqual(result.status, 0);
  assert.equal((result.stderr.match(/aliases require a generated internal detail page/g) || []).length, 2);
});

test('markdown headings get stable deep-link ids and explicit ids are preserved', () => {
  const paths = fixture();
  write(join(paths.content, 'writing', 'anchors.md'), `---\ntitle: Anchors\nsummary: Heading links\ndate: 2026-07-13\n---\n## Hello, World!\n\n## Custom heading {#chosen-id}\n\n| Option | Result |\n| --- | --- |\n| A | Works |`);
  const result = build(paths);
  assert.equal(result.status, 0, result.stderr);
  const html = readFileSync(join(paths.dist, 'writing', 'anchors', 'index.html'), 'utf8');
  assert.match(html, /<h2 id="hello-world"><a class="heading-anchor" href="#hello-world"/);
  assert.match(html, /<h2 id="chosen-id"><a class="heading-anchor" href="#chosen-id"/);
  assert.match(html, /<table><thead><tr><th>Option<\/th><th>Result<\/th>/);
});

test('build lists public demos without disclosing private demos', () => {
  const paths = fixture();
  const result = build(paths);
  assert.equal(result.status, 0, result.stderr);
  const demos = readFileSync(join(paths.dist, 'demos', 'index.html'), 'utf8');
  assert.match(demos, /Public demo/);
  assert.doesNotMatch(demos, /Private demo/);
});

test('homepage Labs action opens the Labs collection instead of a featured demo', () => {
  const paths = fixture();
  const result = build(paths);
  assert.equal(result.status, 0, result.stderr);
  const home = readFileSync(join(paths.dist, 'index.html'), 'utf8');
  assert.match(home, /<a class="more" href="\/labs\/">Explore Labs/);
});

test('shared primary navigation leads with Notes and keeps the resume under About', () => {
  const paths = fixture();
  write(join(paths.content, 'pages', 'about.md'), `---\ntitle: About\nsummary: About this person\n---\n[View the resume](/resume/)`);
  write(join(paths.content, 'pages', 'resume.md'), `---\ntitle: Resume\nsummary: Resume page\n---\nExperience.`);
  const result = build(paths);
  assert.equal(result.status, 0, result.stderr);
  const home = readFileSync(join(paths.dist, 'index.html'), 'utf8');
  const primaryNav = home.match(/<nav class="site-nav" aria-label="Primary">([\s\S]*?)<\/nav>/)?.[1] || '';
  assert.match(primaryNav, /^\s*<a href="\/writing\/"[^>]*>Notes<\/a>/);
  assert.match(primaryNav, /href="\/work\/"[^>]*>Work<\/a>/);
  assert.match(primaryNav, /href="\/talks\/"[^>]*>Talks<\/a>/);
  assert.match(primaryNav, /href="\/about\/"[^>]*>About<\/a>/);
  assert.doesNotMatch(primaryNav, /href="\/resume\/"/);
  assert.doesNotMatch(home, /nav-overflow-cue|Show more navigation links/);

  const about = readFileSync(join(paths.dist, 'about', 'index.html'), 'utf8');
  assert.match(about, /href="\/resume\/"[^>]*>View the resume<\/a>/);
});

test('site brand and person identity stay distinct in visible and structured metadata', () => {
  const paths = fixture();
  const sitePath = join(paths.content, 'site.json');
  const site = JSON.parse(readFileSync(sitePath, 'utf8'));
  write(sitePath, JSON.stringify({ ...site, brand: 'Fieldwork', headerBrand: 'Test Person’s Fieldwork', brandShort: 'Fieldwork', brandByline: 'Fieldwork by Test Person' }));
  const result = build(paths);
  assert.equal(result.status, 0, result.stderr);
  const home = readFileSync(join(paths.dist, 'index.html'), 'utf8');
  assert.match(home, /<title>Fieldwork by Test Person<\/title>/);
  assert.match(home, /<meta property="og:site_name" content="Fieldwork" \/>/);
  assert.match(home, /<span class="site-name-full">Test Person’s Fieldwork<\/span><span class="site-name-short" aria-hidden="true">Fieldwork<\/span>/);
  assert.match(home, /&copy; <span>\d{4}<\/span> Fieldwork by Test Person/);
  assert.match(home, /"@type":"WebSite","name":"Fieldwork"/);
  assert.match(home, /"@type":"Person","name":"Test Person"/);
});

test('clickable writing and talk rows link the image, title, and summary as one target', () => {
  const paths = fixture();
  write(join(paths.staticDir, 'row.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675"></svg>');
  write(join(paths.content, 'writing', 'linked.md'), `---\ntitle: Linked essay\nsummary: Click anywhere on this row\ndate: 2026-07-13\nimage: /row.svg\nimageAlt: Example row image.\n---\nEssay body.`);
  write(join(paths.content, 'talks', 'linked.md'), `---\ntitle: Linked talk\nsummary: Click anywhere on this talk\ndate: 2026-07-12\nimage: /row.svg\nimageAlt: Example talk image.\n---\nTalk body.`);
  const result = build(paths);
  assert.equal(result.status, 0, result.stderr);
  const writing = readFileSync(join(paths.dist, 'writing', 'index.html'), 'utf8');
  const talks = readFileSync(join(paths.dist, 'talks', 'index.html'), 'utf8');
  assert.match(writing, /<li>\s*<a class="row" href="\/writing\/linked\/"[\s\S]*?<img class="row-thumb"[\s\S]*?Linked essay[\s\S]*?Click anywhere on this row[\s\S]*?<\/a>\s*<\/li>/);
  assert.match(talks, /<li>\s*<a class="row" href="\/talks\/linked\/"[\s\S]*?<img class="row-thumb"[\s\S]*?Linked talk[\s\S]*?Click anywhere on this talk[\s\S]*?<\/a>\s*<\/li>/);
});

test('bodyless work cards honor their declared internal destination', () => {
  const paths = fixture();
  write(join(paths.content, 'work', 'lab.md'), `---\ntitle: Demo lab\nsummary: Working demos\nexternal: /demos/\n---`);
  const result = build(paths);
  assert.equal(result.status, 0, result.stderr);
  const work = readFileSync(join(paths.dist, 'work', 'index.html'), 'utf8');
  assert.match(work, /<a class="card" href="\/demos\/"[^>]*>[\s\S]*?Demo lab[\s\S]*?<\/a>/);
});


test('build rejects impossible ISO dates and unsafe drafts', () => {
  const paths = fixture();
  write(join(paths.content, 'writing', 'bad.md'), `---\ntitle: Bad date\nsummary: Invalid fixture\ndate: 2026-02-30\ndraft: true\n---\nDraft.`);
  const result = build(paths);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /drafts must set noindex: true/);
  assert.match(result.stderr, /writing date must be YYYY-MM-DD/);
});

test('build rejects duplicate slugs and broken standalone-page links', () => {
  const paths = fixture();
  write(join(paths.content, 'work', 'one.md'), `---\ntitle: One\nsummary: First\nslug: same\n---`);
  write(join(paths.content, 'work', 'two.md'), `---\ntitle: Two\nsummary: Second\nslug: same\n---`);
  write(join(paths.content, 'pages', 'about.md'), `---\ntitle: About\nsummary: About page\n---\n[Missing](/missing/)`);
  const result = build(paths);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /duplicate slug/);
  assert.match(result.stderr, /broken internal link \/missing\//);
});

test('build rejects duplicate page descriptions without publishing invalid output', () => {
  const paths = fixture();
  write(join(paths.content, 'pages', 'one.md'), `---\ntitle: One\nsummary: Duplicate summary\n---`);
  write(join(paths.content, 'pages', 'two.md'), `---\ntitle: Two\nsummary: Duplicate summary\n---`);
  const result = build(paths);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /duplicate description/);
  assert.throws(() => readFileSync(join(paths.dist, 'one', 'index.html')), /ENOENT/);
});

test('build omits the analytics script entirely when no measurement id is configured', () => {
  const paths = fixture();
  const result = build(paths);
  assert.equal(result.status, 0, result.stderr);
  const home = readFileSync(join(paths.dist, 'index.html'), 'utf8');
  assert.doesNotMatch(home, /gtag\/js\?id="/);
  assert.doesNotMatch(home, /Google tag \(gtag\.js\)/);
});

test('configured analytics is host-gated, campaign-limited, and records subscriptions', () => {
  const paths = fixture();
  const result = build(paths, { ANALYTICS_MEASUREMENT_ID: 'G-TEST123' });
  assert.equal(result.status, 0, result.stderr);
  const home = readFileSync(join(paths.dist, 'index.html'), 'utf8');
  assert.match(home, /hostAllowed/);
  assert.match(home, /document\.createElement\('script'\)/);
  assert.match(home, /campaign_source:cleanCampaignValue/);
  assert.match(home, /campaign_content:cleanCampaignValue/);
  assert.match(home, /event\('sign_up',\{method:'field_notes'\}\)/);
});

test('default social images keep their real alt text and resume stays compact without a portrait', () => {
  const paths = fixture();
  write(join(paths.staticDir, 'portrait.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 460"></svg>');
  write(join(paths.content, 'pages', 'privacy.md'), `---\ntitle: Privacy\nsummary: Privacy page\n---\nPrivacy details.`);
  write(join(paths.content, 'pages', 'resume.md'), `---\ntitle: Resume\nsummary: Resume page\nimage: /portrait.svg\nimageAlt: Test Person headshot.\n---\nExperience.`);
  const result = build(paths);
  assert.equal(result.status, 0, result.stderr);
  const privacy = readFileSync(join(paths.dist, 'privacy', 'index.html'), 'utf8');
  const resume = readFileSync(join(paths.dist, 'resume', 'index.html'), 'utf8');
  const home = readFileSync(join(paths.dist, 'index.html'), 'utf8');
  assert.match(home, /<meta property="og:image:alt" content="Test Person portfolio preview\."/);
  assert.match(privacy, /<meta property="og:image:alt" content="Test Person portfolio preview\."/);
  assert.doesNotMatch(resume, /article-hero profile-portrait/);
  assert.match(resume, /class="hero-actions page-actions"/);
  assert.match(resume, /Read Field Notes/);
});

test('build writes a styled 404 page with a link home', () => {
  const paths = fixture();
  const result = build(paths);
  assert.equal(result.status, 0, result.stderr);
  const notFound = readFileSync(join(paths.dist, '404.html'), 'utf8');
  assert.match(notFound, /<h1>Page not found<\/h1>/);
  assert.match(notFound, /<a[^>]*href="\/"[^>]*>Home<\/a>/);
  assert.match(notFound, /<meta name="robots" content="noindex, nofollow"/);
  assert.match(notFound, /class="site-header"/);
});

test('build rejects missing root-relative assets in frontmatter links', () => {
  const paths = fixture();
  write(join(paths.content, 'talks', 'missing-deck.md'), `---\ntitle: Missing deck\nsummary: Invalid fixture\nlinks: [{"label":"Slides","url":"/decks/missing.pdf"}]\n---`);
  const result = build(paths);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /broken internal link \/decks\/missing\.pdf/);
});

// --- llms.txt (task 1) -------------------------------------------------

test('llms.txt reuses the answer engine summary and links published notes, work, talks, and labs', () => {
  const paths = fixture();
  write(join(paths.content, 'writing', 'published.md'), `---\ntitle: Published note\nsummary: A published note summary\ndate: 2026-07-13\n---\nBody.`);
  write(join(paths.content, 'writing', 'draft.md'), `---\ntitle: Draft note\nsummary: Hidden\ndate: 2026-07-13\ndraft: true\nnoindex: true\n---\nDraft.`);
  write(join(paths.content, 'writing', 'scheduled.md'), `---\ntitle: Scheduled note\nsummary: Hidden\ndate: 2026-07-14\npublishAt: 2026-07-14T12:00:00Z\n---\nScheduled.`);
  write(join(paths.content, 'writing', 'external.md'), `---\ntitle: External note\nsummary: Elsewhere\ndate: 2026-07-12\nexternal: https://example.org/post\n---`);
  write(join(paths.content, 'work', 'case-study.md'), `---\ntitle: Case study\nsummary: A work summary\n---\nBody.`);
  write(join(paths.content, 'talks', 'talk.md'), `---\ntitle: A talk\nsummary: A talk summary\ndate: 2026-06-01\n---\nBody.`);
  const result = build(paths, { PORTFOLIO_BUILD_TIME: '2026-07-13T12:00:00Z' });
  assert.equal(result.status, 0, result.stderr);
  const llmsTxt = readFileSync(join(paths.dist, 'llms.txt'), 'utf8');
  assert.match(llmsTxt, /^# Test Person\n\n> Test Person builds things\.\n\n/);
  assert.match(llmsTxt, /## Notes\n\n- \[Published note\]\(https:\/\/example\.com\/writing\/published\/index\.md\): A published note summary/);
  assert.match(llmsTxt, /\[External note\]\(https:\/\/example\.org\/post\): Elsewhere/);
  assert.match(llmsTxt, /## Work\n\n- \[Case study\]\(https:\/\/example\.com\/work\/case-study\/\): A work summary/);
  assert.match(llmsTxt, /## Talks\n\n- \[A talk\]\(https:\/\/example\.com\/talks\/talk\/\): A talk summary/);
  assert.match(llmsTxt, /## Labs\n\n- \[Public demo\]\(https:\/\/example\.com\/public\/\): Visible/);
  assert.doesNotMatch(llmsTxt, /Draft note|Scheduled note|Private demo/);
});

test('llms.txt is not emitted in writer mode', () => {
  const paths = fixture();
  const result = build(paths, { BASE_PATH: '/writer/', PORTFOLIO_WRITER_MODE: 'true' });
  assert.equal(result.status, 0, result.stderr);
  assert.throws(() => readFileSync(join(paths.dist, 'llms.txt')), /ENOENT/);
});

// --- markdown mirrors (task 2) ------------------------------------------

test('published notes get a clean markdown mirror with absolute links and no front matter', () => {
  const paths = fixture();
  write(join(paths.staticDir, 'img', 'diagram.png'), 'not a real image, only existence is checked');
  write(join(paths.content, 'writing', 'mirrored.md'), `---\ntitle: Mirrored note\nsummary: A mirrored note summary\ndate: 2026-07-13\n---\nSee [the work page](/work/) and ![a diagram](/img/diagram.png).`);
  const result = build(paths);
  assert.equal(result.status, 0, result.stderr);
  const mirror = readFileSync(join(paths.dist, 'writing', 'mirrored', 'index.md'), 'utf8');
  assert.match(mirror, /^# Mirrored note\n\nJuly 13, 2026\n\nA mirrored note summary\n\n/);
  assert.match(mirror, /\[the work page\]\(https:\/\/example\.com\/work\/\)/);
  assert.match(mirror, /!\[a diagram\]\(https:\/\/example\.com\/img\/diagram\.png\)/);
  assert.doesNotMatch(mirror, /^---/);
  assert.doesNotMatch(mirror, /title: Mirrored note/);
});

test('draft, scheduled, noindex, and external notes get no markdown mirror; work and talks get none either', () => {
  const paths = fixture();
  write(join(paths.content, 'writing', 'draft.md'), `---\ntitle: Draft note\nsummary: Hidden\ndate: 2026-07-13\ndraft: true\nnoindex: true\n---\nDraft.`);
  write(join(paths.content, 'writing', 'hidden.md'), `---\ntitle: Hidden note\nsummary: Hidden\ndate: 2026-07-13\nnoindex: true\n---\nHidden.`);
  write(join(paths.content, 'writing', 'external.md'), `---\ntitle: External note\nsummary: Elsewhere\ndate: 2026-07-12\nexternal: https://example.org/post\n---`);
  write(join(paths.content, 'work', 'case-study.md'), `---\ntitle: Case study\nsummary: A work summary\n---\nBody.`);
  write(join(paths.content, 'talks', 'talk.md'), `---\ntitle: A talk\nsummary: A talk summary\ndate: 2026-06-01\n---\nBody.`);
  const result = build(paths, { PORTFOLIO_BUILD_TIME: '2026-07-13T12:00:00Z' });
  assert.equal(result.status, 0, result.stderr);
  assert.throws(() => readFileSync(join(paths.dist, 'writing', 'draft', 'index.md')), /ENOENT/);
  assert.throws(() => readFileSync(join(paths.dist, 'writing', 'hidden', 'index.md')), /ENOENT/);
  assert.throws(() => readFileSync(join(paths.dist, 'writing', 'external', 'index.md')), /ENOENT/);
  assert.throws(() => readFileSync(join(paths.dist, 'work', 'case-study', 'index.md')), /ENOENT/);
  assert.throws(() => readFileSync(join(paths.dist, 'talks', 'talk', 'index.md')), /ENOENT/);
});

test('markdown mirrors are not emitted in writer mode', () => {
  const paths = fixture();
  write(join(paths.content, 'writing', 'mirrored.md'), `---\ntitle: Mirrored note\nsummary: A mirrored note summary\ndate: 2026-07-13\n---\nBody.`);
  const result = build(paths, { BASE_PATH: '/writer/', PORTFOLIO_WRITER_MODE: 'true' });
  assert.equal(result.status, 0, result.stderr);
  assert.throws(() => readFileSync(join(paths.dist, 'writing', 'mirrored', 'index.md')), /ENOENT/);
});

// --- RSS hardening (task 3) ----------------------------------------------

test('feed.xml declares atom/content namespaces, a self link, language, lastBuildDate, and full content:encoded bodies', () => {
  const paths = fixture();
  write(join(paths.staticDir, 'img', 'x.png'), 'not a real image, only existence is checked');
  write(join(paths.content, 'writing', 'full.md'), `---\ntitle: Full post\nsummary: Full post summary\ndate: 2026-07-13\n---\nSee [work](/work/) and ![alt](/img/x.png).`);
  write(join(paths.content, 'writing', 'linkout.md'), `---\ntitle: Link out\nsummary: No body\ndate: 2026-07-12\nexternal: https://example.org/elsewhere\n---`);
  const result = build(paths, { PORTFOLIO_BUILD_TIME: '2026-07-13T12:00:00Z' });
  assert.equal(result.status, 0, result.stderr);
  const feed = readFileSync(join(paths.dist, 'feed.xml'), 'utf8');
  assert.match(feed, /<rss version="2\.0" xmlns:atom="http:\/\/www\.w3\.org\/2005\/Atom" xmlns:content="http:\/\/purl\.org\/rss\/1\.0\/modules\/content\/">/);
  assert.match(feed, /<atom:link href="https:\/\/example\.com\/feed\.xml" rel="self" type="application\/rss\+xml" \/>/);
  assert.match(feed, /<language>en-us<\/language>/);
  assert.match(feed, /<lastBuildDate>[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4} [\d:]{8} GMT<\/lastBuildDate>/);
  assert.match(feed, /<content:encoded><!\[CDATA\[<p>See <a href="https:\/\/example\.com\/work\/">work<\/a>/);
  assert.match(feed, /<img src="https:\/\/example\.com\/img\/x\.png"/);
  assert.doesNotMatch(feed, /<content:encoded><!\[CDATA\[\]\]><\/content:encoded>.*Link out/s);
});

// --- sitemap lastmod (task 4) ---------------------------------------------

test('sitemap sets lastmod on the homepage and collection indexes from their newest entry, and omits it for dateless standalone pages', () => {
  const paths = fixture();
  write(join(paths.content, 'writing', 'older.md'), `---\ntitle: Older\nsummary: Older\ndate: 2026-06-01\n---\nBody.`);
  write(join(paths.content, 'writing', 'newer.md'), `---\ntitle: Newer\nsummary: Newer\ndate: 2026-07-20\n---\nBody.`);
  write(join(paths.content, 'work', 'updated-case.md'), `---\ntitle: Updated case\nsummary: Updated\ndate: 2026-01-01\nupdated: 2026-08-01\n---\nBody.`);
  write(join(paths.content, 'pages', 'about.md'), `---\ntitle: About\nsummary: About this person\n---\nNo date here.`);
  const result = build(paths, { PORTFOLIO_BUILD_TIME: '2026-08-15T00:00:00Z' });
  assert.equal(result.status, 0, result.stderr);
  const sitemap = readFileSync(join(paths.dist, 'sitemap.xml'), 'utf8');
  assert.match(sitemap, /<loc>https:\/\/example\.com\/<\/loc>\s*<lastmod>2026-08-01<\/lastmod>/);
  assert.match(sitemap, /<loc>https:\/\/example\.com\/writing\/<\/loc>\s*<lastmod>2026-07-20<\/lastmod>/);
  assert.match(sitemap, /<loc>https:\/\/example\.com\/work\/<\/loc>\s*<lastmod>2026-08-01<\/lastmod>/);
  assert.match(sitemap, /<loc>https:\/\/example\.com\/about\/<\/loc>\s*<priority>0\.5<\/priority>/);
  assert.doesNotMatch(sitemap.match(/<loc>https:\/\/example\.com\/about\/<\/loc>[\s\S]{0,80}/)[0], /lastmod/);
});

// --- JSON-LD detail (task 5) ------------------------------------------

test('detail pages get mainEntityOfPage, keywords, and a Home > Collection > Entry BreadcrumbList', () => {
  const paths = fixture();
  write(join(paths.content, 'writing', 'tagged.md'), `---\ntitle: Tagged note\nsummary: A tagged note\ndate: 2026-07-13\ntags: ["agents","evals"]\n---\nBody.`);
  const result = build(paths);
  assert.equal(result.status, 0, result.stderr);
  const html = readFileSync(join(paths.dist, 'writing', 'tagged', 'index.html'), 'utf8');
  const jsonLd = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
  assert.ok(Array.isArray(jsonLd));
  const blogPosting = jsonLd.find((item) => item['@type'] === 'BlogPosting');
  assert.equal(blogPosting.mainEntityOfPage['@id'], 'https://example.com/writing/tagged/');
  assert.equal(blogPosting.keywords, 'agents, evals');
  const breadcrumb = jsonLd.find((item) => item['@type'] === 'BreadcrumbList');
  assert.deepEqual(breadcrumb.itemListElement.map((item) => item.name), ['Test Person', 'Notes', 'Tagged note']);
  assert.deepEqual(breadcrumb.itemListElement.map((item) => item.item), [
    'https://example.com/',
    'https://example.com/writing/',
    'https://example.com/writing/tagged/',
  ]);
});

test('layout emits og:locale and light/dark theme-color meta tags', () => {
  const paths = fixture();
  const result = build(paths);
  assert.equal(result.status, 0, result.stderr);
  const home = readFileSync(join(paths.dist, 'index.html'), 'utf8');
  assert.match(home, /<meta property="og:locale" content="en_US" \/>/);
  assert.match(home, /<meta name="theme-color" content="#[0-9a-f]{6}" media="\(prefers-color-scheme: light\)" \/>/);
  assert.match(home, /<meta name="theme-color" content="#[0-9a-f]{6}" media="\(prefers-color-scheme: dark\)" \/>/);
});

// --- WebP dimension parsing (task 6) --------------------------------------

function riffWebp(fourCc, chunkSize, payload) {
  const header = Buffer.alloc(20);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(4 + 8 + payload.length, 4);
  header.write('WEBP', 8, 'ascii');
  header.write(fourCc, 12, 'ascii');
  header.writeUInt32LE(chunkSize, 16);
  return Buffer.concat([header, payload]);
}

function makeVp8xFixture(width, height) {
  const payload = Buffer.alloc(10);
  payload[0] = 0x00; // flags
  payload.writeUIntLE(width - 1, 4, 3);
  payload.writeUIntLE(height - 1, 7, 3);
  return riffWebp('VP8X', payload.length, payload);
}

function makeVp8lFixture(width, height) {
  const payload = Buffer.alloc(5);
  payload[0] = 0x2f; // VP8L signature byte
  const packed = (((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14)) >>> 0;
  payload.writeUInt32LE(packed, 1);
  return riffWebp('VP8L', payload.length, payload);
}

function makeVp8Fixture(width, height) {
  const payload = Buffer.alloc(10);
  payload[0] = 0x10; payload[1] = 0x00; payload[2] = 0x00; // frame tag (not decoded)
  payload[3] = 0x9d; payload[4] = 0x01; payload[5] = 0x2a; // VP8 key-frame start code
  payload.writeUInt16LE(width & 0x3fff, 6);
  payload.writeUInt16LE(height & 0x3fff, 8);
  return riffWebp('VP8 ', payload.length, payload);
}

for (const [label, make, width, height] of [
  ['VP8X (extended)', makeVp8xFixture, 500, 400],
  ['VP8L (lossless)', makeVp8lFixture, 640, 360],
  ['VP8 (lossy)', makeVp8Fixture, 800, 600],
]) {
  test(`getImageDimensions reads real ${label} WebP byte fixtures`, () => {
    const paths = fixture();
    write(join(paths.staticDir, 'photo.webp'), make(width, height));
    write(join(paths.content, 'work', 'has-image.md'), `---\ntitle: Has image\nsummary: Has an image\nimage: /photo.webp\nimageAlt: A photo.\n---\nBody.`);
    const result = build(paths);
    assert.equal(result.status, 0, result.stderr);
    const html = readFileSync(join(paths.dist, 'work', 'has-image', 'index.html'), 'utf8');
    assert.match(html, new RegExp(`src="/photo\\.webp" alt="A photo\\." loading="eager" width="${width}" height="${height}"`));
  });
}
