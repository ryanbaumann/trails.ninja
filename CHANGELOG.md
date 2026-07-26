# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Security
- Added a Content-Security-Policy to every gateway response. The portfolio gets a tight `default-src 'self'` policy allowing only the analytics and comments origins it actually uses; the three Google Maps Platform demos get Google's documented Maps allowlist, scoped per app so the looser policy never applies to pages that do not need it. `frame-ancestors 'self'` supersedes `X-Frame-Options`, which stays for older browsers. Inline scripts still require `'unsafe-inline'`: the static HTML is built by a different process than the one serving it, so there is no request-time nonce to bind.
- Stopped the subscribe endpoint from clearing a contact's global `unsubscribed` flag when the address already exists. A 409 from the mail provider only means the address is known, not that the person wants back in, so forcing the flag to false let anyone who knew an address silently re-subscribe someone who had opted out. Repeat submissions now only re-opt into the topic and segment.
- Added the same-origin check the writer endpoints already had to the Strava OAuth POST routes, and gave the three previously unlimited writer endpoints (`save`, `review`, `social`) rate-limit policies.
- Pinned the Cloud Run service to `--max-instances 1`. The gateway's in-memory per-IP rate limiters (private-demo auth brute-force, and the spend limits in front of Isochrones, Gemini, and Resend) are only correct on a single instance, but the deploy passed no instance cap and Cloud Run's default is 100, so under load every limit silently became per-instance. Also pinned `--concurrency`, `--memory`, and `--cpu` at their current defaults so a platform default change cannot raise cost or dilute the limits again.

### Added
- Added `llms.txt` and per-note markdown mirrors (`/writing/<slug>/index.md`) to the build, so answer engines and coding agents can read the site without paying to parse HTML. Both follow the same publish filters as the sitemap and are omitted from the private writer build.
- Hardened the RSS feed with an `atom:link` self reference, `language`, `lastBuildDate`, and full `content:encoded` bodies rendered by the same markdown renderer the detail pages use, with relative URLs absolutized.
- Added `lastmod` to the sitemap's homepage and collection index entries, `BreadcrumbList` JSON-LD and `mainEntityOfPage`/`keywords` on detail pages, and `og:locale` plus scheme-aware `theme-color` tags read from the stylesheet rather than hardcoded.

### Changed
- Converted the Labs preview screenshots and the two inline essay diagrams to WebP, cutting the Labs page from 3.29 MB of images to 269 KB. The build learned to read WebP dimensions so images keep their explicit width and height and the layout stays stable. The original JPG/PNG files stay as generation sources for the social cards, which composite them at a larger size than the WebP renditions carry.
- Gated the hourly scheduled deploy on whether a `publishAt` timestamp has actually come due since the last successful run. The cron trigger exists only to make scheduled posts go live, but it rebuilt and redeployed the container every hour regardless, roughly 720 no-op image builds a month. Pushes to `main` and manual dispatches still always deploy, and every failure path (missing deploy history, unparsable timestamp, unexpected error) reports "due" so an extra build is possible but a missed publish is not.
- Updated the portfolio homepage: simplified the role title to "DevX at Google Maps Platform", tightened the intro sub headline around AI products and growth, and further reduced vertical padding between the hero section and the first content block.
- Refined the homepage hero section by removing redundant call-to-action buttons (Read Field Notes, Selected Work, Contact) to embrace a cleaner, content-first layout, and tightened the vertical whitespace between the hero introduction and the Field Notes list.
- Applied UI/UX layout enhancements: increased macro whitespace around hero and main sections, implemented responsive typography scaling for headers and stats. Card interaction stays the documented border accent and 2px lift.
- Updated SSG sorting logic for Field Notes, Labs, and Selected Work. All collections now default to chronological order globally. The homepage logic now supports pinning a specific entry (via `order` metadata) for all three sections while correctly rendering the newest remaining entries automatically.
- Fixed theme-aware SVGs failing to respond to explicit light/dark toggles by injecting `color-scheme` into the host `html[data-theme]` block, bypassing system-level media queries on `<img>` tags.
- Updated `infographic-agent` skill, documentation, CLI wrapper, and prompt metadata to use `gemini-3.6-flash` for the research orchestrator (standardizing Flash on 3.6 while Flash-Lite uses 3.5).
- Updated `AGENTS.md` to document the primary `google-maps-platform` skill, `frontend-responsive-design`, `infographic-agent`, and repository-specific `portfolio-*` skills under Local Skills.
- Rewrote the "The Model That Picks Your Platform Doesn't Write the Code" Field Note to open on the cheap-execution stakes (GLM 5.2, Kimi K3) and the moat question, cut AI-tell phrasing, and replaced its two templated flow diagrams with bespoke per-post art (a one-decides-many-build asymmetry header and a descending-tier staircase). Recorded the copy-and-image taste rules in the portfolio-writing skill and LEARNINGS.
- Showed four Field Notes on the homepage (one featured plus three) so a new post no longer pushes an entry off the page.

### Fixed
- Restored the Strava 3D Explorer, which stopped loading rides after the Content-Security-Policy shipped. Only the OAuth exchange and the photo proxy are same-origin `/api/strava/*` calls; the demo reads activities, activity detail, streams, and photo metadata straight from `https://www.strava.com/api/v3` in the browser, and the Maps allowlist has no Strava origin in `connect-src`, so every read was blocked and the app showed "Failed to fetch activities". The demo now gets its own policy, `"csp": "maps-strava"` in apps.json: the Maps policy plus the Strava API origin in `connect-src` and the two image hosts it loads without the proxy (the athlete avatar, and the placeholder photos in the signed-out demo tour) in `img-src`. The other Maps demos and the portfolio are unchanged and carry no Strava origin. Policies are now composed from directive maps instead of copy-pasted strings, so a per-app relaxation can only widen a directive the base policy already declares.

### Removed
- Cleaned up `.agents/skills/` by removing redundant or globally available skills (`geocoding-api-web-api`, `google-maps-environment-apis`, `google-maps-js-2d`, `google-maps-js-3d`, `maps-javascript-api-javascript`, `places-api-web-api`, `pollen-api-web-api`, `setup-local-environment`, `weather-api-web-api`).

### Added
- Added the private Field Note “AI Saves the Hour. Spend It on Judgment.” arguing that AI moves engineering work up to judgment and systems thinking with users, the way simulation did in 2009, with the agentic eval loop and two original visuals.
- Added the Field Note “The Model That Picks Your Platform Doesn't Write the Code” on tiered coding agents and where a developer platform's DevX strategy should focus, with a header flow diagram, an inline two-readers diagram, and a generated social card.
- Added OAuth-admin staging of editable, unpublished LinkedIn and X drafts beside each Field Note, plus first-attempt merge staging for newly added drafts, with tracked starter copy, opt-out metadata, side-effect-free workflow reruns, and secret-safe configuration.
- Completed the Writer edit flow with focused direct-branch saves, in-dashboard errors, and a GitHub merge link when a protected workflow uses a separate publishing branch.
- Paginated the Writer dashboard's Field Notes section to five entries at a time with accessible previous, next, and page-status controls.
- Added the private Field Note “Builder Platforms Grow by Owning the Agent Loop,” with four original diagrams explaining the DevX growth loop, training stack, and eval design.
- Added a production domain-migration runbook for mapping `ryanbaumann.dev`, preserving deep-link redirects from the old domain, and updating dependent services.
- Added a site-first Field Notes syndication runbook covering manual Substack excerpts, Buffer-managed LinkedIn, X, and future channel drafts, consent-safe list migration, UTM attribution, practical channel experiments, and a phased path to private writer integration.
- Added permanent `/lab/` and `/labs/` redirects to the canonical `/demos/` route.
- Added an `apple-touch-icon.png` and explicit `thumbnail` meta tag to the site `<head>` for better crawler visual citation and brand previews.
- Enhanced the `sitemap.xml` generator to output `<image:image>` and `<image:loc>` nodes for pages with cover images to optimize visual search indexing.
- Recorded the voice moves the writing skill could not previously produce (quoted-objection openings, definition by negative space, the colon pivot, vantage-point evidence, era-based credit), replaced its unreachable external rhythm calibration with three in-repo hand-written entries, scoped the outcome-first rule so it stops contradicting the work-entry structure, and reframed every prescribed phrasing as a meaning rather than a string to paste.
- Added `npm run check:content`, a zero-dependency gate for the mechanically checkable subset of the writing and content rules: em-dashes, banned phrases, hype adjectives, the three-asset essay contract, `shareSummary` duplicating `summary`, alt-text distinctness, tag vocabulary and count, and distinctive phrases repeated across entries. Errors block, taste warnings advise, code fences and `<!-- lint-ignore -->` lines are exempt, and it runs in CI beside `check:labs`.

### Fixed
- Stopped cropping thumbnails. Card, row, and demo previews rendered 16:9 source art in a 16:10 box with `object-fit: cover`, which took the crop out of the sides and cut label text off artifact cards.
- Restored the dark-mode text hierarchy. `--faint` was brighter than `--muted` (9.94:1 against 7.93:1), so metadata outshone summaries. It is now 5.33:1, dimmest of the three and matching light mode's relationship, in both the `prefers-color-scheme` and `data-theme` blocks.
- Raised the mobile navigation floor from 10.56px to 12px. The one-line header rule still holds at 390px, verified with all five links on a single row and no horizontal scroll.
- Stopped emitting an empty `<p class="eyebrow">` for homepage sections that pass no eyebrow.
- Returned the card hover to its documented behavior, a border accent and a 2px lift, and removed the resting and hover drop shadows. The previous 2px accent ring matched the `:focus-visible` ring closely enough that a hovered card and a focused card were indistinguishable, and its hardcoded black shadows rendered only against the light background, so the two color schemes shipped different hover states.
- Staged Buffer social drafts for scheduled Field Notes. `buildSocialDrafts` gated on the `draft` flag alone, so a note created with `--schedule` (which writes `draft: false` with a future `publishAt`) published with no social draft, silently and permanently, because staging runs only on the commit that adds the file.
- Aligned `npm run new:post` with the rules it points authors at: no em-dash in the scaffolded body, no generic site preview as a post header, and the full social and image contract emitted as commented placeholders matching `_TEMPLATE.md`.

### Changed
- Refined the homepage hero section by removing redundant call-to-action buttons (Read Field Notes, Selected Work, Contact) to embrace a cleaner, content-first layout, and tightened the vertical whitespace between the hero introduction and the Field Notes list.
- Rewrote the site's interface copy after a copy audit. The hero headline drops the Title-Case product-marketing line for "Developer friction is a growth problem." Dead `tagline` and `aboutTeaser` keys are deleted. The positioning noun list ("builder platforms, developer tools, evals, AI coding agents") no longer repeats across the contact, resume, about, writing, and Labs surfaces; each now says something specific to its page. Section notes, empty states, the subscribe line, the contact lede, and the 404 stop narrating what the reader is already looking at.
- Standardized on "Labs" as the name in prose, replacing "Ryan's Lab" on the about and privacy pages. The `/demos/` route is unchanged.
- Gave `shareSummary` its own hook on the two Field Notes where it was a byte-identical copy of `summary`, which meant their staged LinkedIn posts repeated the card text.
- Cut the homepage closing call to action down to a question and a button. It carried a long abstract sentence about working backwards from a growth hypothesis; the section now reads "Building something in this space?" with a "Reach out to collab" button.
- Shortened the profile headline to "Head of DevX · Google Maps".
- Removed the `google-maps-platform` skill's orphaned local index mirror, which still pointed at the per-product sub-skill copies deleted earlier, and recorded in `AGENTS.md` that the skill is a runtime entry point whose sub-skills are fetched from the GMP Skills Index and must never be vendored back into the repo.
- Made vendor-neutral `manifest.json` the source of truth for skill interface metadata, demoted the OpenAI adapter to one projection of it, and added a check that fails when a skill ships an adapter without a manifest or the two drift.
- Renamed the site and repository identity to Fieldwork, aligned package, CI, GitHub, Artifact Registry, and Cloud Run names, refreshed the favicon and social/home previews, and documented a backward-compatible service and repository migration.
- Removed Resume from the primary header, kept it linked from About and the footer, kept Fieldwork, Notes, Work, Talks, Labs, About, and the theme control on one non-scrolling mobile header line, and tightened the visual rhythm between titles and explanatory subheads.
- Cut `ryanbaumann.dev` over to the new `fieldwork` service and restored strict public-origin manifest verification after the migration compatibility window.
- Encoded a conversational prose-to-code rhythm and outcome-based deterministic review loop in the portfolio writing, design, and review skills.
- Restored visible Air Quality heatmap tiles, added large Places UI Kit details above selected Isochrones results, and renamed the DevX Field Note to “DevX Is a Growth Function.”
- Fixed the Air Quality demo's PM2.5 selector so it requests the supported pollutant heatmap tiles and renders them over the map, and restored the Isochrones demo's Places autocomplete with a dedicated referrer-restricted browser key.
- Fixed CI workflow secret scanning by running the open-source Gitleaks Docker image directly instead of using the proprietary Gitleaks Action wrapper that requires a commercial license.
- Fixed tar command compatibility in archive verification and test suite to support both GNU and BSD tar output formats, ensuring tests pass locally on macOS as well as in CI.
- Extended the portfolio writing guidance, examples, content workflow, presentation workflow, and review gate with an honest curiosity, retention, title, social packaging, and visual preview framework for posts, headlines, naming, talks, and social cards.
- Reframed the DevX growth Field Note around the misconception that DevX is a docs queue, with updated title, summary, social copy, opening, and closing.
- Reworked the Air Quality demo into a mobile-first location check with a collapsible map sheet, current US AQI, pollutant context, and health guidance; rebuilt Isochrones as a two-person meet-in-the-middle finder using shared travel areas and real Places; and corrected the homepage “Explore Labs” link to open `/labs/` instead of Atlas.
- Updated homepage hero copy and adjusted CSS `max-width` on the hero container and text to allow the headline and intro to stretch across a single line on desktop screens.
- Simplified the homepage role, headline, introduction, calls to action, and social card; made Field Notes the first primary navigation link and first homepage section; moved Ryan’s Lab after it; and reduced the mobile header to one compact row with visible overflow.
- Restored Work, Talks, and Resume to the primary header navigation, corrected the homepage introduction, made writing and talk rows fully clickable across their image, title, summary, and metadata, and repaired the Ryan’s Lab card destination on `/work/`.
- Extended the portfolio's privacy-limited Google Analytics configuration to every hosted Ryan’s Lab workspace app while keeping external experiments outside the shared build.
- Made `https://ryanbaumann.dev/` the canonical site origin across metadata, RSS, sitemap, analytics, Lab apps, deployment checks, generated posts, and documentation; legacy and www hosts now permanently redirect to the matching apex `.dev` URL.
- Regenerated the portfolio social cards with the new domain, corrected Lab social-image metadata to the published JPEG assets, and expanded production smoke coverage for canonicals, redirects, feeds, sitemaps, and social images.
- Aligned the contact gateway's accepted intent with the updated “Developer platform discussion” form option.
- Reworked the site hierarchy around Field Notes first, Contact second, and Ryan’s Lab as the featured project surface, with a quieter theme control and clearer mobile/desktop calls to action.
- Simplified and refreshed the About, Resume, Contact, Privacy, homepage, and Lab copy; removed the duplicate resume portrait; and corrected stale availability, hosting, and project claims.
- Kept analytics enabled by default on the canonical production host, documented that behavior on the Privacy page, restricted campaign parameters to allowlisted UTM values, and added confirmed subscription conversion tracking.
- Migrated Field Notes subscriptions from Resend's retired Audience API to Contacts with a dedicated Segment and Topic, including safe resubscription behavior and updated setup/deployment documentation.
- Standardized reader-facing references to “Ryan’s Lab” while retaining `/demos/` and `labs:*` as technical route and command names.
- Changed "Google Maps Platform" to "Google Maps" in the job titles and profile headlines across the site (`site.json`, `about.md`, `resume.md`).
- Optimized above-the-fold Largest Contentful Paint (LCP) by setting hero images to `loading="eager"`.
- Shifted the social card generator (`social-cards.mjs`) to output compressed `.jpg` files at 70% quality instead of `.png`.
- Updated the `portfolio-review` skill to mandate optimized JPEG social preview images under 200KB.
- Converted all existing social preview images to compressed JPEGs, dropping file sizes from up to 1.3MB down to under 200KB, and updated all corresponding references in the content files.
- Updated `portfolio/build.mjs` to support standard `1200x630` social share images alongside the previous `1200x627` format, maintaining backward compatibility.
- Injected `meta.summary` as a visible `.lede` paragraph on detail pages and standalone pages to enhance DOM readability and AI discoverability (AEO).
- Simplified the gateway's three writer form endpoints (publish/save/review) onto one shared handler with the same auth, origin, and redirect behavior, and generalized the contact-form HTML response page for reuse by the subscribe route.
- Deduplicated the three hero-image render blocks in `portfolio/build.mjs` into a single `heroImage` helper.
- Fixed the portfolio test script for newer Node 22 minors: `node --test test/` no longer accepts a bare directory, so it now uses an explicit glob (see LEARNINGS.md 2026-07-17).
- Updated the Atlas demo URL in apps.json to the new Cloud Run instance.
- Added a copyable self-install task packet for the Loop Engineering Coding Agent, clarified when each optional role overlay applies, and made its structural check work without ripgrep.
- Reframed the Loop Engineering Coding Agent page around token-efficient orchestration, lower-cost worker agents, and the evidence loop behind the system prompt.
- Rewrote the Loop Engineering Coding Agent page for a more direct, evidence-based explanation of its boundaries, package contents, and evaluation limits.
- Reviewed copy and claims across the site for a humble, durable dev-brand voice: qualitative framing for recent internal growth figures, generalized third-party agent tools to first-party surfaces, and team-credited leader-practitioner phrasing.
- Encoded the copy taste rules into `portfolio-writing`, `portfolio-review`, and the evidence ledger so future work follows them.

## [1.0.0] - 2026-07-15

### Added
- Initial public release of the Ryan Baumann portfolio and demo lab.
