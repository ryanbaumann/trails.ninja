# Atlas GenUI — Future Work

Follow-ups identified in the end-to-end self-review of the A2UI generative-UI +
Ad Studio + Scout release (PR #3). None of these block that PR; they are the
next round of hardening and polish. Roughly ordered by value.

## 1. Keyed end-to-end verification (highest value)

The build sandbox has no live Google Maps Platform / Gemini keys, so only
key-free paths were exercised (typecheck, 72 unit tests, production build). Before
a production deploy, run with real keys:

- Ad Studio: full campaign — resolve a real business → `gather_campaign_facts`
  → `generate_ad_creatives` (confirm photo-conditioned image gen and the
  text-only fallback) → `set_geo_targeting` ring → export surface.
- Scout: `scout_area` → inspect 2+ candidates (confirm multi-heading Street View
  frames actually load and vision returns parseable JSON) → `score_candidates`
  → `show_evidence` surface.
- `npm run preview` + `ALLOW_LIVE_MAPS_BROWSER=1 CHROMIUM_PATH=… SMOKE_OUT=docs/screens npm run smoke`
  for all six journeys when intentionally regenerating the committed screenshots.

## 2. A2UI renderer parity & streaming (longer-term)

- Parity tests currently assert **envelope-level** conformance against
  `@a2ui/web_core`; component-prop parity is best-effort. If/when the toolkit
  exposes per-component schemas, tighten the tests.
- Surfaces render only after the `render_surface` tool completes. Incremental /
  streaming surface updates would make long campaign/scout outputs feel live.
- Evaluate swapping in the official `@googlemaps/a2ui` renderer behind a flag
  once its React 19 story is settled.

## 3. Real-time voice (Live API)

Voice input ships as **tap-to-talk**: record → transcribe (`MODELS.stt`, MINIMAL
thinking) → fill the composer.

**Streaming TTS shipped** — `src/ai/tts.ts` uses `generateContentStream` and
schedules PCM segments on a gapless cursor as they arrive. Measured against
`gemini-3.1-flash-tts-preview` for ~10s of narration: time-to-first-audio fell
from **9.8s (whole-clip) to 1.2s (first streamed frame)**. Remaining follow-up:

- **Live API bidirectional voice.** Real-time speech-in/speech-out (and
  [live translation](https://ai.google.dev/gemini-api/docs/live-api/live-translate),
  `gemini-3.5-live-translate-preview`) uses a **WebSocket** transport
  (`wss://…BidiGenerateContent`) with 16 kHz PCM input / 24 kHz PCM output and
  **ephemeral tokens** for browser clients — not the REST `generateContent` the
  `/ai` proxy speaks today. Shipping it needs a WebSocket proxy + ephemeral-token
  minting route in `server/index.mjs`; it does not fit the current REST seam.

## 4. Demo affordances

- Consider persisting the last campaign/scout run to a shareable deep link.

## Completed

- **Video generation with Gemini omni** (flag-gated, `VITE_VIDEO_GEN_ENABLED`):
  image→video via the `@google/genai` Interactions API (`src/ai/video.ts`, now the
  typed `ai.interactions.create` call) is wired into two surfaces — Cinema
  "Generate a video of this tour" (seeds omni with the current stop's Street View
  still, plays inline in the panel) and Scout "Walkthrough video of the winning
  site" (seeds with the top candidate's Street View frame, renders a deterministic
  A2UI surface via the new `Video` catalog component). The `/ai` proxy forwards the
  Interactions endpoint with the model allowlist enforced from the request body and
  a longer `VIDEO_UPSTREAM_TIMEOUT_MS`. Still off by default and requires
  `gemini-omni-1.1-flash-preview` in `GENAI_EXTRA_MODELS`. **Not yet keyed-verified**
  end-to-end (no live omni access in the sandbox) — belongs in the §1 keyed pass.
- Scout is now an explicit **site-selection** journey: inspection grounds each
  candidate in Street View **plus an overhead satellite frame**, and a
  `compare_sites` decision matrix ranks sites and recommends a winner.
- Second UI/UX pass: tool-call popovers dismiss cleanly (click-away/Escape),
  tall A2UI surfaces scroll, heading/caption markdown no longer leaks raw
  tokens, ad-preview images show in full with clamped overlays, cinema audio no
  longer bleeds across stops, and the postcard/itinerary scroll chains are fixed.
- Ad Studio generation UX: prefetched conditioning image, per-tile staged
  progress + elapsed timer + fallback indicator, error-tile retry, and a
  non-blocking copilot turn.
- End-to-end copy refresh framing Atlas as a real-world reasoning agent.

- ChoicePicker `{selection}` interpolation now substitutes selected chip values
  before `send_prompt`, with focused unit coverage.
- Vite now splits deck.gl, Gemini, Maps, and shared vendor chunks.
- Ad Studio routes Places photo conditioning through `/gmp/placephoto` and marks
  generated creatives that fell back to text-only generation.
- Vitest now uses `test.projects` for separate `node` and `jsdom` projects.
- Ad Studio and Scout boards now show remaining session budget.
