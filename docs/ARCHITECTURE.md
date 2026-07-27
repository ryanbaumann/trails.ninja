# Fieldwork and Lab Architecture

One Cloud Run service hosts Fieldwork, its
workspace Lab apps, and a zero-dependency Node gateway that routes between
them and brokers secret-bearing API calls. The shared `apps.json` manifest
can also list external experiments, which render as outbound links instead of
shipping in the container. The canonical public URL is
`https://ryanbaumann.dev/`. No access tokens or server API
secrets belong in browser bundles.

```text
┌────────────────────────────────────────────────────────────────────┐
│ Cloud Run service: fieldwork                                      │
│                                                                    │
│ https://ryanbaumann.dev/                                          │
│   └── gateway/server.js (node:20-slim, no deps)                    │
│       ├── /                → Fieldwork site                        │
│       │    /work/ /writing/ /talks/ /demos/ …                      │
│       │    built static by portfolio/build.mjs                     │
│       ├── /writer/         → private draft preview + controls       │
│       ├── /strava-explorer/→ static dist                           │
│       ├── /aqi-map/        → static dist                           │
│       ├── /isochrones/     → static dist                           │
│       ├── /hairstyle-ai-studio/ → static dist                      │
│       ├── /real-world-reasoning-agent/ → static dist               │
│       ├── /portfolio/*     → 308 redirect to /*                    │
│       └── /api/*           → secret proxy layer                    │
│            ├── /api/strava/*      (OAuth broker + photo proxy)     │
│            ├── /api/isochrones    (GMP server)                     │
│            ├── /api/hairstyle-ai-studio/* (shared + BYO Gemini)    │
│            ├── /api/real-world-reasoning-agent/* (Maps + Gemini)   │
│            ├── /api/subscribe     (Resend Contact + Segment/Topic) │
│            └── /api/writer/publish (authenticated GitHub update)   │
└────────────────────────────────────────────────────────────────────┘
                  ▲
  secrets via Cloud Run env / Secret Manager:
  STRAVA_CLIENT_SECRET, GMP_SERVER_API_KEY, GMP_MCP_KEY, GEMINI_API_KEY,
  RESEND_API_KEY,
  GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_SESSION_SECRET,
  GITHUB_CONTENT_TOKEN, GITHUB_REVIEW_TOKEN, BUFFER_API_KEY
```

Routing and builds are manifest-driven: `apps.json` lists each app's mount
`path`, `source` (`workspace`, immutable private `artifact`, or `external`), and `api`
(`none`, gateway-owned, or authenticated private upstream). The gateway matches the most specific path first, so
the root-mounted Fieldwork site (`path: "/"`) is the catch-all after every hosted app
path has had its chance.

Manifest entries default to `visibility: "public"`. `unlisted` apps remain
directly reachable but are omitted from the portfolio and `/api/apps`;
`private` apps are also omitted and require
`auth: { "type": "password", "envVar": "DEMO_PASSWORD" }`. The named env
variable is server-only. Missing or invalid private auth fails closed before
any static file is served. Optional `providers` entries contain registry names
such as `strava`, `isochrones`, or `resend`; env variable names and values live
only in `gateway/lib/config.js` and are never serialized to the browser.
Provider names document credential ownership; they do not make a global
`/api/*` route private. A future private demo that needs a private upstream
must add an authenticated app-scoped gateway route, not reuse a public proxy.
Private access cookies use the `__Host-` prefix and `Secure`; exercise the
password flow through HTTPS (production or an HTTPS local proxy), not the
plain-HTTP gateway development URL.

## Design rules

1. **Apps are registered build outputs.** A workspace package has a `package.json` whose
   `npm run build` emits static output, plus an `apps.json` entry, is an
   app; the gateway serves it at its manifest `path`. The same manifest
   feeds the homepage Ryan’s Lab section and nav (`portfolio/build.mjs`), the
   local staging build, and the smoke test. Adding a demo =
   `npm run labs:new -- <name>`; a reviewed public checkout uses
   `labs:import`; confidential source publishes a checksum-pinned artifact
   registered with `labs:attach`. See `docs/LABS_ONBOARDING.md`.
2. **Browser keys vs. server secrets.** Anything `VITE_`-prefixed is inlined
   into the browser bundle by Vite and must be public client config only:
   referrer-restricted browser keys (Maps JS / Air Quality / Places) and
   OAuth client IDs — that is their designed use. Anything unrestricted
   (Strava client secret, Google server API key) lives only in the gateway
   environment as non-`VITE_` vars, reachable only through `/api/*` with
   validation + rate limiting. A missing secret returns a JSON `503`, never
   a crash — the container always boots keyless.
   Hairstyle AI Studio uses a server-side `GEMINI_API_KEY` for five successful
   image generations per client IP per UTC day. A visitor can override that
   shared allowance with a personal Gemini key; React keeps it only in memory
   and sends it transiently in `X-Gemini-API-Key` to the same-origin gateway.
   The gateway validates personal keys without generating content and never
   stores, logs, or returns them. Gemini keys are never `VITE_` build variables.
3. **Same-origin by default.** In the container, clients call `/api/...` on
   their own origin — no CORS, no cross-origin token endpoints. OAuth redirect
   URIs derive from `window.location.origin` unless explicitly overridden.
4. **Smoke tests are dependency-free.** `scripts/smoke.mjs` uses plain `fetch`
   against a running gateway: route liveness, HTML sanity, navigation
   invariants (every hosted app and every site page links back home), the
   apps.json ↔ `/api/apps` contract, OAuth URL shape, and a leaked-secret
   grep over every built asset. No Playwright required; must pass keyless.
5. **CI never hands secrets to forks.** PR jobs build + smoke with dummy env
   only. Deploy runs on `main` pushes via Workload Identity Federation.
6. **Scheduled publishing rebuilds, gated.** Public content is immutable static output. A future `publishAt` stays out of detail pages, lists, RSS, and sitemap until a deploy rebuilds at or after that timestamp. The hourly cron trigger in `deploy.yml` first runs `scripts/check-scheduled-publish.mjs`, which compares every `publishAt` against the last successful deploy time; the Cloud Build + Cloud Run steps run only when something has newly come due, so the hourly tick is nearly always a no-op instead of a full image build. Pushes to `main` and `workflow_dispatch` always build. `/writer/` is a separate private static build; its publishing endpoint can only update known content files after Google OAuth, allowlisted-email, session, and same-origin checks pass.
7. **The Fieldwork site stays extractable.** `portfolio/` is a self-contained,
   zero-dependency static site (flat-file markdown CMS with small inline
   theme, analytics, and configured comments helpers).
   Its only tie to this repo is optional: when `../apps.json` exists, the
   build renders the Ryan’s Lab section and nav item; when it doesn't, they
   disappear cleanly.
8. **Hosted apps share privacy-limited analytics.** The root build passes the
   public `ANALYTICS_MEASUREMENT_ID` to each workspace demo. A shared browser
   helper loads GA4 only on the canonical production host (or an explicit
   debug session), removes arbitrary query parameters and cross-origin
   referrers from page views, and disables advertising storage and signals.
   Map interactions, coordinates, OAuth values, activity data, and form text
   are never analytics fields. External Lab destinations remain separate.

## Build

The root `Dockerfile` runs the manifest-driven `scripts/build-local.mjs`, then
copies only staged outputs and `gateway/` into `node:20-slim` and runs as the
non-root `node` user. Workspace additions therefore require no Docker edit.
Trusted deployment fetches and verifies declared private artifacts before the
image build; untrusted PR CI has no artifact credentials.

## Deploy

`.github/workflows/deploy.yml` builds the image with Cloud Build — public
`VITE_*` build args threaded through `cloudbuild.yaml` substitutions — and
deploys to Cloud Run on pushes to `main`, on `workflow_dispatch`, and on an
hourly cron gated by `scripts/check-scheduled-publish.mjs` (see design rule
6). `gcloud run deploy` pins `--max-instances 1`: the gateway's in-memory
per-IP rate limiters (private-demo auth, and the spend limits on
Isochrones/Gemini/Resend) are only correct with a single instance, since
Cloud Run's real default is 100. `--concurrency 80`, `--memory 512Mi`, and
`--cpu 1` are also pinned explicitly (Cloud Run's current defaults) so a
future platform default change can't silently change throughput or cost.
Required repo configuration:

| Kind    | Name                    | Purpose                              |
|---------|-------------------------|--------------------------------------|
| secret  | `GCP_WIF_PROVIDER`      | Workload Identity Federation provider|
| secret  | `GCP_SA_EMAIL`          | Deploy service account               |
| secret  | `VITE_GMP_API_KEY`      | Referrer-restricted Maps browser key |
| secret  | `VITE_ISOCHRONES_GMP_API_KEY` | Referrer-restricted Isochrones browser key |
| secret  | `VITE_STRAVA_CLIENT_ID` | Strava OAuth client ID (public)      |
| var     | `GCP_PROJECT_ID`        | Target project                       |
| var     | `GCP_REGION`            | Cloud Run region                     |
| var     | `ANALYTICS_MEASUREMENT_ID` | Optional public GA4 `G-...` stream ID |

Runtime secrets (`STRAVA_CLIENT_SECRET`, `GMP_SERVER_API_KEY`,
`RESEND_API_KEY`, `RESEND_SEGMENT_ID`, `RESEND_TOPIC_ID`, `CONTACT_TO_EMAIL`,
`GEMINI_API_KEY`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_SESSION_SECRET`,
`GITHUB_CONTENT_TOKEN`, `GITHUB_REVIEW_TOKEN`, and `BUFFER_API_KEY`) are set on the Cloud Run service
as Secret Manager references, never in the image or repo. `CONTACT_FROM_EMAIL`
is optional non-secret sender configuration and must use a sender accepted by
the mail provider. `GEMINI_API_KEY` powers Hairstyle AI Studio's shared daily
allowance and optional contact classification; create a Secret Manager secret
named `gemini-api-key` and map it to the Cloud Run environment as shown in
`deploy.yml`. Never create a `VITE_GEMINI_API_KEY`: Vite would expose it in the
browser bundle.

Real World Reasoning Agent shares `GMP_SERVER_API_KEY` and `GEMINI_API_KEY`
with the gateway. `GMP_MCP_KEY` may provide a separately restricted
server-to-server credential for Maps Grounding Lite; when omitted, the handler
falls back to `GMP_SERVER_API_KEY`. Set `RWR_GROUNDING_LITE_ENABLED=true` only after
the selected server key is enabled for that product. Browser Maps uses the
existing referrer-restricted `VITE_GMP_API_KEY`.

See [LABS_SECURITY.md](LABS_SECURITY.md) for the exact gateway assumptions,
CSP contract, key restrictions, cost ceilings, and regression checks.

## Paved paths

| I want to… | Run |
|---|---|
| Add a demo app | `npm run labs:new -- my-demo --template static` |
| Import public source | `npm run labs:import -- my-demo --from ../checkout --source-url <https-url> --ref <sha> --confirm-source-public` |
| Attach private build | `npm run labs:attach -- my-demo --artifact <tgz> --uri <content-addressed-gs-uri> --release <id>` |
| Add a blog post | `npm run new:post -- "Post title"` |
| Set up the email list or comments | `docs/EMAIL_LIST_AND_COMMENTS.md` |
| Move or configure the public domain | follow `docs/DOMAIN_MIGRATION.md` |
| Schedule a blog post | `npm run new:post -- "Post title" --schedule 2099-07-14T16:00:00Z` |
| Syndicate a Field Note | follow `docs/SYNDICATION.md` |
| Add a work entry / talk | copy the `_TEMPLATE.md` in `portfolio/content/<collection>/` |
| Regenerate demo screenshots | `npm run previews` (or `BASE_URL=https://ryanbaumann.dev npm run previews`) |
| Verify everything | `npm run build && npm run smoke` |
