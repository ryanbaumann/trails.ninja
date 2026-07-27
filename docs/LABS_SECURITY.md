# Lab gateway security

This is the production contract for Hairstyle AI Studio and Real World
Reasoning Agent.

## Gateway assumptions and cost controls

- Cloud Run is pinned to one instance. Per-IP and daily counters are in memory,
  reset on restart, and are not a distributed billing control.
- `clientIp()` trusts Cloud Run's penultimate forwarded hop, not a lone
  caller-supplied value. Same-origin checks are a browser signal, not caller
  authentication.
- Upstream hosts, methods, Gemini models, and Grounding Lite tools are
  allowlisted. URL keys are stripped; bodies and upstream time are bounded.
- Real World Reasoning rate defaults per IP per 15 minutes are 120 AI, 300
  general Maps, 3,000 Maps image/tile, 600 photo, 120 Grounding Lite, and 60
  diagnostics requests. Rate-bucket memory is capped at 10,000 entries.
- Its process-wide UTC-day ceilings are 50 hosted Gemini calls, 1.4 MB hosted
  Gemini input, no hosted video, 1,000 general Maps, 10,000 image/tile, 1,000
  photo, and 250 Grounding Lite calls.
- Hairstyle permits five successful hosted image generations per IP and 100
  total hosted generations per process per UTC day, refunding failed
  reservations. A personal key bypasses shared spend limits but retains a
  separate abuse limit.

Restarts and distributed clients can bypass in-memory counters. Set per-API
Google Cloud/Gemini quotas as the hard backstop and Cloud Billing budgets as
alerts; budgets alone do not stop spend.

## Keys and restrictions

| Name | Exposure and restriction |
|---|---|
| `VITE_GMP_API_KEY` | Public browser key. HTTP-referrer restrict to `https://ryanbaumann.dev/*` and explicit local origins; API-restrict to Maps JavaScript, Places (New), Routes, and Map Tiles. |
| `VITE_ISOCHRONES_GMP_API_KEY` | Separate public, referrer-restricted Isochrones browser key; allow only its browser APIs. |
| `GMP_SERVER_API_KEY` | Secret Manager only. API-restrict to enabled server routes: Geocoding, Air Quality, Weather, Pollen, Solar, Maps Static, Street View Static, and Places photo media. Add an IP restriction only with verified fixed Cloud Run egress. |
| `GMP_MCP_KEY` | Preferred separate Secret Manager key, restricted to Maps Grounding Lite and verified fixed egress when available. Otherwise the gateway falls back to `GMP_SERVER_API_KEY`. |
| `GEMINI_API_KEY` | Secret Manager only, restricted to Gemini API. Never create `VITE_GEMINI_API_KEY`. |
| `X-Gemini-API-Key` / `X-Atlas-Gemini-Key` | Visitor keys held only in tab memory and a transient same-origin header; never logged, stored, returned, placed in URLs, or sent to analytics. |
| `ANALYTICS_MEASUREMENT_ID` | Public configuration, not a secret. Shared analytics loads only on the canonical host, denies ad signals, and removes arbitrary query data and cross-origin referrers. |

Restriction guidance:
<https://docs.cloud.google.com/api-keys/docs/add-restrictions-api-keys>.

## CSP

Only apps marked `csp: "maps"` receive the Maps policy. It keeps
`default-src 'self'`, `base-uri 'self'`, `object-src 'none'`, and
`frame-ancestors 'self'`, then allows the Google Maps/Places and analytics
origins those apps use. Gemini remains same-origin through the gateway.
`'unsafe-eval'` is scoped to Maps apps for the Maps loader; `'unsafe-inline'`
remains for static generated bootstraps and styles. The portfolio and non-Maps
apps keep the tighter default policy.

## Required checks

```text
cd gateway && npm test
cd demos/hairstyle-ai-studio && npm test && npm run build
cd demos/real-world-reasoning-agent && npm test && npm run build
npm run labs:check
npm run build
npm run smoke
```

The gateway suite covers trusted IP selection, fail-closed key routing, hosted
versus BYOK budgets, daily Maps ceilings, pinned targets, allowlists, body
caps, and CSP selection. Smoke scans staged/served text assets for known
high-risk secret patterns and verifies routes, assets, and home links. When
local secrets are available, also compare their exact values against tracked
files and built assets without printing those values.
