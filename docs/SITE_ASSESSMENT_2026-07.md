# Fieldwork assessment: UI/UX, architecture, security, cost, AEO/SEO

Date: 2026-07-26. Method: full read of `gateway/`, `portfolio/build.mjs`,
`apps.json`, `Dockerfile`, `cloudbuild.yaml`, `deploy.yml`; local build;
rendered desktop and mobile screenshots of home, a Field Note, and Labs;
mechanical sweeps of the built HTML; all test suites run (91 gateway tests,
27 script tests, `check:content` clean, all passing).

## Verdict up front

The architecture is genuinely simple and agent-maintainable: one manifest,
one zero-dependency gateway, paved-path scripts, deterministic gates, and
docs that match the code (I verified `docs/ARCHITECTURE.md` claims against
the source line by line). The copy is clean: zero em-dashes, zero hype
adjectives, and only two "not just a" flips across all 30 rendered pages.
The security posture is above average for a personal site. The findings
below are ranked; the first one is the only thing I'd call urgent.

## 1. Security and cost

### 1.1 Rate limiting assumes one instance; the deploy doesn't pin one (high)

`gateway/server.js:68` documents the tradeoff: in-memory per-IP limiters are
fine "on Cloud Run with max-instances=1 (the default for this portfolio)".
But Cloud Run's actual default is max-instances=100, and the
`gcloud run deploy` step in `.github/workflows/deploy.yml` passes no
`--max-instances`. Under load the service fans out, and every limit becomes
per-instance: the auth brute-force limit (5/min, `rateLimit.js:51`) and the
isochrones/Gemini/Resend spend limits multiply by instance count. An
attacker who generates load simultaneously scales the service out and
dilutes the limits that were supposed to stop them, while running up the
bill.

Fix: add `--max-instances 1` (or 2 with the caveat accepted) to the deploy
step. One flag closes the security gap and caps worst-case cost at the same
time.

### 1.2 Hourly rebuilds burn Cloud Build minutes for nothing (medium, cost)

`deploy.yml` runs a full Docker build and Cloud Run deploy every hour
(`cron: '17 * * * *'`) so scheduled `publishAt` posts go live. That is
~720 image builds and revisions per month, nearly all of them no-ops. Add a
preflight step to the scheduled path that scans
`portfolio/content/*/[!_]*.md` for a `publishAt` between the last deploy and
now, and exits early when there is none. Same publishing behavior, a
fraction of the build spend.

### 1.3 No Content-Security-Policy on HTML (medium)

`staticFiles.js:60` sends nosniff, Referrer-Policy, X-Frame-Options, and
HSTS, but no CSP. The site's external surface is small and known: GA
(`googletagmanager.com`, `google-analytics.com`) and giscus
(`giscus.app`). A CSP with `default-src 'self'`, the two script/frame
origins, and `'unsafe-inline'` for the small inline theme/analytics scripts
would fence in any future injected markup. `frame-ancestors 'self'` also
supersedes X-Frame-Options. Not urgent, cheap to add, one place to add it.

### 1.4 Strava broker endpoints skip the Origin check (low)

The writer form endpoints verify same-origin (`server.js:362`), but
`/api/strava/token`, `/refresh`, and `/deauthorize` accept a POST from
anywhere. Browser CSRF exposure is minimal (JSON bodies force a preflight
that fails without CORS headers) and non-browser abuse is bounded by the
20/min limiter, but the same three-line Origin check the writer routes use
would make the posture uniform.

### 1.5 What already holds up

- Photo proxy (`strava.js`): single-host allowlist, https-only URL
  validation that rejects credentials and odd ports, capped redirect chain
  re-validated per hop under one deadline, 8 MB size cap enforced while
  streaming, MIME allowlist, and `Content-Security-Policy: sandbox` on the
  response. This is how an SSRF-prone endpoint should look.
- Private-demo auth (`auth.js`): constant-time compares, HMAC cookie with
  `__Host-` prefix, fail-closed when the env var is missing, per-IP 5/min.
- Writer auth (`googleAuth.js`): signed state cookie, token verified via
  Google's tokeninfo (not decoded and trusted), email allowlist, aud/iss/exp
  checks, HMAC session.
- Upstream proxy (`upstream.js`): https-only origin, path-traversal and
  origin-escape checks on the target URL, identity token from metadata,
  request and response size caps, same-origin check on writes.
- `clientIp` (`rateLimit.js:37`) takes the address before the trusted Cloud
  Run proxy rather than the spoofable first XFF entry. Correct.
- Secrets discipline: VITE_-prefix rule documented in three places, smoke
  test greps built assets for leaks, CI never hands secrets to fork PRs,
  every proxy 503s keyless instead of crashing.

## 2. Email filtering

The contact pipeline (`contactSpam.js`) is layered the right way around:
honeypot (hard reject, fake success), deterministic SEO/backlink regexes
(demote to review), then the Gemini classifier. Two defaults worth keeping
exactly as they are: the classifier fails open (`model_error` allows), and
a model "reject" is demoted to "review" so a false positive never silently
drops a real person (`safeModelDecision`, `contactSpam.js:36`). The prompt
treats visitor text as data, and output is parsed and validated against
enum + range before use. Rejected mail gets a neutral success redirect and
never records a `delivered=1` lead. This is well designed.

One real gap, in subscribe rather than contact: `handleSubscribeRequest`
(`server.js:207`) re-enables `unsubscribed: false` and re-opts the topic on
a 409. Anyone who knows an address can therefore re-subscribe a person who
unsubscribed, with no confirmation step. Fix: enable double opt-in on the
Resend topic, or stop forcing `unsubscribed: false` on the 409 path and let
only the topic re-opt-in stand. Minor: subscribe email validation is
`includes('@')`; fine for a proxy to Resend, which does the real check.

Also noted: only `/api/writer/publish` maps to the writer rate-limit policy
(`rateLimit.js:63`); save/review/social have none. They sit behind the
Google session so it's theoretical, but the one-line additions keep the
policy table honest.

## 3. UI/UX

Rendered output is clean on desktop and mobile: system font stack, one
accent color, one reading column at `--prose` (~44rem), lazy images with
explicit width/height, skip link, `aria-current` nav, reduced-motion
respected, keyboard-visible focus styles, three-state theme toggle with a
descriptive aria-label that updates on each state. The left-aligned reading
measure with a wide right gutter is per the design skill ("one column,
generous whitespace"), not a defect.

Two observations, no code defects found:

- Labs preview images are the heaviest thing on the site (next section).
  On a mid-tier phone the Labs page pays for ~3.8 MB of JPEG.
- The featured-note card plus three-card grid on home reads well at both
  breakpoints; card hover, tags, and "Launch demo" affordances are
  consistent across Labs and home.

## 4. Copy

Swept all 30 built pages mechanically: zero em-dashes, zero occurrences of
cutting-edge/revolutionary/world-class/passionate/excited-to-announce/
empower/seamless/delve, and the antithesis flip appears twice in the whole
corpus, in different pieces (within the two-per-piece budget). Interface
copy is concrete and unbranded: "Read the note", "Launch demo", "All
notes", "One email when something ships. One-click unsubscribe." The hero
("Builder platforms for humans and agents.") and the collaborate CTA
("Growing a developer platform, or getting one ready for agents?") are
on-voice. Claims on home are the safe-metric kind (npm downloads, dated
eras, qualitative current-employer framing). No copy changes recommended.

## 5. AEO/SEO

Already in place and verified in the build: canonicals on every page with a
build-time validation gate (`validateMetadata`), OG/Twitter cards with image
dimensions and MIME type, JSON-LD for Person/WebSite/ProfilePage/BlogPosting/
CreativeWork/Article, `answerEngineSummary` feeding descriptions, robots.txt
plus image-extension sitemap, RSS autodiscovery, 308 redirect ownership of
one canonical host, and per-entry alias redirects with collision checks.
That is a stronger baseline than most commercial sites.

Ranked additions, all build-time and zero-dependency:

1. **`llms.txt`.** The site optimizes for answer engines but doesn't ship
   the one file agents look for first. Generate it in `build.mjs` from the
   collections: site summary (reuse `answerEngineSummary`), then linked
   lists of notes, work, and talks with one-line summaries.
2. **Markdown mirrors.** The CMS is already markdown; emit each published
   note at `/writing/<slug>/index.md` next to the HTML and link them from
   `llms.txt`. Agents ingest markdown at a fraction of the token cost of
   HTML, and it costs one `writeFileSync` per entry.
3. **RSS hardening.** `feed.xml` lacks `<atom:link rel="self">` and full
   `content:encoded` bodies. Full-content feeds get quoted by aggregators
   and answer engines; the HTML is already rendered at that point in the
   build.
4. **Sitemap `<lastmod>` for index and standalone pages.** Detail pages
   have it; `/`, `/writing/`, `/work/` and pages don't. Use the max child
   date.
5. **JSON-LD details.** Add `mainEntityOfPage` and `keywords` (from tags)
   to BlogPosting, and a BreadcrumbList on detail pages.
6. Minor: `og:locale`, `theme-color` meta.

## 6. Performance and hosting cost

The serving path is already close to optimal for cheap-and-fast: brotli/gzip
with a size floor, weak ETags plus Last-Modified with 304 handling,
immutable caching for hash-named assets, no-cache HTML, inlined CSS (9.3 KB
brotli as part of a 44 KB home page that compresses to ~9 KB), system
fonts, no framework. Cloud Run with `--min-instances 0` and `--cpu-boost`
means the idle cost is zero and cold starts are tolerable. Do not move
hosting; cap instances (finding 1.1) and fix the images:

- `previews/isochrones.jpg` 864 KB, `real-world-reasoning-agent.jpg`
  830 KB, `aqi-map.jpg` 656 KB, `infographic-agent.jpg` 531 KB, at
  1264-1376px wide for a card rendered ~400px. Re-encode at ~800px WebP
  (quality ~75): roughly 10x smaller, biggest single UX win available.
- `assets/devx-growth-header.png` 823 KB and `devx-eval-loop.png` 704 KB
  are screenshots stored as PNG; WebP takes them under 100 KB each.
- Non-hashed images get `max-age=3600` (`staticFiles.js:57`); with hourly
  scheduled deploys that's consistent, and safe to raise to a day for
  `/previews/` and `/social/` if the rebuild cadence drops.

## 7. Architecture and agent maintainability

Strengths worth preserving: apps.json as the single source of truth for
routing, build, CI matrix, and smoke; the keyless-boot 503 convention; the
`labs:new`/`new:post` paved paths; the CHANGELOG/LEARNINGS/skills memory
loop; deterministic content gates (`check:content`) in front of taste
review; and zero npm dependencies in both the gateway and the site build,
which means no dependabot churn and no supply-chain surface for an agent to
break.

Two watch items, neither worth acting on yet:

- `portfolio/build.mjs` is 1,710 lines in one file. It is well sectioned
  and every function is short, so agents navigate it fine today. If it
  crosses ~2,000 lines, split along the existing section comments
  (validation, markdown, layout, JSON-LD, feeds) into `portfolio/lib/`.
- `gateway/lib/strava.js` and `demos/strava-explorer/server/broker.js` are
  kept in sync by hand (documented in both headers). Acceptable while the
  standalone deploy exists; delete the standalone server if it ever stops
  being deployed rather than letting them drift.

## Priority list

1. `--max-instances 1` on the Cloud Run deploy (security + cost, one line).
2. Skip the hourly rebuild when no `publishAt` is pending (cost).
3. Re-encode `/previews/` and `/assets/` images to ~800px WebP (UX + cost).
4. Ship `llms.txt` + markdown mirrors from the build (AEO).
5. Stop re-enabling unsubscribed contacts on subscribe 409; prefer double
   opt-in (email trust).
6. Add CSP to `SECURITY_HEADERS` (defense in depth).
7. RSS self-link + full content; sitemap lastmod for index pages (SEO).
8. Same-origin check on Strava broker POSTs; rate-limit policies for the
   three unmapped writer endpoints (consistency).
