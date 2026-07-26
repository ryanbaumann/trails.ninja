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
- Added `STRAVA_AVATAR_HOSTS` allowlist and `athleteAvatarUrl()` in `strava-explorer` to safely validate athlete profile URLs against allowed CDNs.
- Added gateway test coverage verifying that all external image, font, and avatar hosts loaded by demo apps are permitted by their respective CSP policies.

### Changed
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
- Cleaned up `.agents/skills/` by removing redundant or globally available skills (`geocoding-api-web-api`, `google-maps-environment-apis`, `google-maps-js-2d`, `google-maps-js-3d`, `maps-javascript-api-javascript`, `places-api-web-api`, `pollen-api-web-api`, `setup-local-environment`, `weather-api-web-api`).

## [1.0.0] - 2026-07-15

### Added
- Initial public release of the Ryan Baumann portfolio and demo lab.
