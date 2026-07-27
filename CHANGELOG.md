# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Security
- Added a same-origin, BYO-key Gemini gateway for Hairstyle AI Studio. Visitor
  keys stay in React memory, pass transiently in a request header, and are
  never stored or included in analytics. The gateway validates image data and
  prompt bounds, opts out of Gemini interaction storage, sanitizes provider
  errors, and applies separate per-IP text and image rate limits.
- Added a Content-Security-Policy to every gateway response. The portfolio gets a tight `default-src 'self'` policy allowing only the analytics and comments origins it actually uses; the three Google Maps Platform demos get Google's documented Maps allowlist, scoped per app so the looser policy never applies to pages that do not need it. `frame-ancestors 'self'` supersedes `X-Frame-Options`, which stays for older browsers. Inline scripts still require `'unsafe-inline'`: the static HTML is built by a different process than the one serving it, so there is no request-time nonce to bind.
- Stopped the subscribe endpoint from clearing a contact's global `unsubscribed` flag when the address already exists. A 409 from the mail provider only means the address is known, not that the person wants back in, so forcing the flag to false let anyone who knew an address silently re-subscribe someone who had opted out. Repeat submissions now only re-opt into the topic and segment.
- Added the same-origin check the writer endpoints already had to the Strava OAuth POST routes, and gave the three previously unlimited writer endpoints (`save`, `review`, `social`) rate-limit policies.
- Pinned the Cloud Run service to `--max-instances 1`. The gateway's in-memory per-IP rate limiters (private-demo auth brute-force, and the spend limits in front of Isochrones, Gemini, and Resend) are only correct on a single instance, but the deploy passed no instance cap and Cloud Run's default is 100, so under load every limit silently became per-instance. Also pinned `--concurrency`, `--memory`, and `--cpu` at their current defaults so a platform default change cannot raise cost or dilute the limits again.

### Added
- Released Real World Reasoning Agent as a first-party open-source Fieldwork Lab from the explicitly authorized private snapshot at `68e8c34547066a984ccb97f5b587caeb97561ec1`. The reviewed source, tests, eval fixtures, guarded Maps/Gemini proxy logic, and provenance now live under `demos/real-world-reasoning-agent/`; the old repository's visibility and settings were not changed.
- Imported Hairstyle AI Studio from its public upstream repository at
  `9ea2c0f31e5e1d252220ede6731b655bf2fb8fba`, hosted it at
  `/hairstyle-ai-studio/`, and placed it third in the homepage Labs order.
- Added privacy-limited analytics for the makeover funnel, a memory-only
  bring-your-own-key setup, explicit opt-in style recommendations, and gateway
  coverage for validation, model routing, stateless requests, and provider
  failures.
- Added a release-ready social update draft for Hairstyle AI Studio, centered
  on its explicit recommendation step, one-call makeover path, and improved
  mobile selection flow. The existing merge-time Buffer workflow now accepts
  validated one-off release drafts and stages them for approval without
  publishing.
- Added a follow-up Buffer draft for the five-free-generations tier and the
  corrected personal-key fallback. It remains editable and unpublished.
- Added frozen development/selection eval suites for responsive design,
  portfolio content/design/review, Google Maps Platform, and the skill
  improvement workflow. The deterministic gate now validates eval ownership,
  object shape, IDs, split labels, required expectations, and both development
  and selection coverage.
- Added a complete local-skill evidence audit over all 350 reachable commits,
  all 45 learning entries, the changelog, current code, tests, and live Maps
  skill sources, with explicit promote/already-enforced/document/stale
  dispositions.
- Added a SkillOpt-inspired validation protocol to the Loop Engineering Coding
  Agent: a fixed development/held-out case split, repeated-trial evidence
  requirements, strict held-out improvement gate, and a repository-learning
  retrieval regression case. This is local, reviewable prompt evaluation; it
  does not harvest agent transcripts or send repository history to a provider.
- Added the repository-local `skill-improvement-loop` skill and `npm run
  skills:improve` gate for validating local skill metadata before committing
  agent-skill or instruction changes.
- Completed frontmatter for the responsive-design skill and aligned the
  portfolio-review Codex adapter with its vendor-neutral manifest, so the new
  skill gate can validate every local skill consistently.
- Added `llms.txt` and per-note markdown mirrors (`/writing/<slug>/index.md`) to the build, so answer engines and coding agents can read the site without paying to parse HTML. Both follow the same publish filters as the sitemap and are omitted from the private writer build.
- Hardened the RSS feed with an `atom:link` self reference, `language`, `lastBuildDate`, and full `content:encoded` bodies rendered by the same markdown renderer the detail pages use, with relative URLs absolutized.
- Added `lastmod` to the sitemap's homepage and collection index entries, `BreadcrumbList` JSON-LD and `mainEntityOfPage`/`keywords` on detail pages, and `og:locale` plus scheme-aware `theme-color` tags read from the stylesheet rather than hardcoded.
- Added `STRAVA_AVATAR_HOSTS` allowlist and `athleteAvatarUrl()` in `strava-explorer` to safely validate athlete profile URLs against allowed CDNs.
- Added gateway test coverage verifying that all external image, font, and avatar hosts loaded by demo apps are permitted by their respective CSP policies.

### Changed
- Reworked Hairstyle AI Studio's Gemini access to match the proven hosted-plus-BYOK pattern: each client IP receives five successful image generations per UTC day, recommendation analysis stays outside that spend cap, and a validated memory-only personal key bypasses the shared allowance while retaining a separate abuse guard. The UI now opens directly into the studio, shows remaining free generations, and distinguishes shared exhaustion from personal-key provider quota.
- Updated Hairstyle AI Studio to current compatible dependencies with a clean
  audit, routed optional recommendations to `gemini-3.5-flash-lite`, retained
  `gemini-3.1-flash-lite-image` for image-capable generation, and replaced
  model-generated titles with local four-word titles so a normal makeover uses
  one model call instead of three.
- Refined the Hairstyle AI Studio funnel with touch- and keyboard-selectable
  style cards, truthful loading status, explicit photo-analysis consent,
  responsive safe-area handling, reduced-motion behavior, system fonts, and
  clearer privacy and error states. Added visible routes back to Fieldwork and
  linked source code to the app's canonical directory in the Fieldwork
  repository. Recommendations no longer infer demographic attributes, and
  cancelling a generation now aborts the in-flight Gemini request instead of
  only dismissing the browser's wait state.
- Removed 6.73 MiB of unused imported raster duplicates and aligned saved/shared
  result filenames with their returned image MIME type.
- Refined six local skills with verified gaps from repository history:
  interaction-state distinction and mobile map viewport/gesture rules,
  canonical scheduled-publication parity, embedded-SVG theme propagation,
  controlled browser/CSP diagnosis, current Maps 3D marker composition and
  Places/CSP boundaries, and a bounded protocol for repository-wide skill
  audits. Writing, presenting, and the externally maintained infographic skill
  were left unchanged after explicit no-change review.
- Enhanced `strava-explorer` activity sport type resolution with title pattern matching and added a distinct trail run emoji (`🏃🌲`) to both activity selection dropdowns and the stats panel header.
- Updated `demos/isochrones` Places UI Kit integration (`gmp-place-details` and `gmp-place-autocomplete`) to use dark color scheme (`color-scheme: dark`) and dark Material theme variables (`--gmp-mat-color-surface`, `--gmp-mat-color-on-surface`, `--gmp-mat-color-primary`), matching the dark aesthetic of the app and map InfoWindow.
- Updated `gateway/lib/staticFiles.js` `CSP_MAPS_DEMO_DIRECTIVES` to include `https://*.ggpht.com` under `img-src` (allowing Google Places photos and avatar thumbnails) and `https://*.gstatic.com` / `https://*.googleapis.com` under `style-src` for Maps demo applications.
- Strava Explorer mobile and marker pass: the bottom-sheet drawer opens taller (peek 24% / half 64% of the viewport, up from 18% / 56%) so the onboarding CTA and the player controls are reachable without a second drag. The rider marker is now a sport-aware SVG advanced marker — 17 sport variants (road/mountain/gravel/e-bike, run/trail run, hike, walk, ski, snowboard, swim, paddle, and a fallback) drawn as a high-contrast pin (white halo, saturated body, near-black outline and glyph) that reads against satellite imagery, sized in screen pixels via `sizePreserved` and pinned above basemap labels with `collisionBehavior: REQUIRED_AND_HIDES_OPTIONAL` so it can no longer be culled. Route start/finish and photo markers get the same collision treatment at lower priority. Photo popovers were rebuilt as a card with a fixed-aspect media frame (no layout shift), skeleton and error states, tap-to-toggle cover/contain, caption and date, and gallery navigation by buttons, dots, arrow keys, and swipe.
- Updated `followCamera.js` in `strava-explorer` to maintain camera update rates, altitude clamping (240 m/s), heading yaw rate (95 deg/s), and LERP smoothing frame-rate-independently using `frameSeconds` delta time.
- Fixed follow-camera route tracking by storing caller source array identity (`followCameraSourceCoords`), preventing pause-and-play actions from silently restarting tours from the trailhead.
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
- Removed Hairstyle AI Studio's redundant Express server, standalone Docker
  deployment, stale secret-based deployment docs, unused model helper scripts,
  and raw duplicate source images. The upstream commit remains the recoverable
  provenance source.
- Cleaned up `.agents/skills/` by removing redundant or globally available skills (`geocoding-api-web-api`, `google-maps-environment-apis`, `google-maps-js-2d`, `google-maps-js-3d`, `maps-javascript-api-javascript`, `places-api-web-api`, `pollen-api-web-api`, `setup-local-environment`, `weather-api-web-api`).

## [1.0.0] - 2026-07-15

### Added
- Initial public release of the Ryan Baumann portfolio and demo lab.
