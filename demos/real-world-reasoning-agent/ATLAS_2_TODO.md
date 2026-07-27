# Atlas 2.0 completion plan

Imported planning note from the source snapshot. Current development and review
now happen in the Fieldwork repository.

Target: `main` via `fix/a2ui-adcreative-image-reactivity`

Baseline SHA: `4d8159f7e62e99765736ee67954225748e9bc501`

## Outcome and scope

Land one truthful flagship mission:

**Brief → grounded Scout → evidence-backed comparison → approval → real Ad
Studio campaign → shareable result → mission-specific 3D/audio payoff**

Existing Flash reasoning, tap-to-talk, TTS, image generation, and optional Omni
are composed. A new Live/WebSocket architecture, generic Places UI replacement,
Fleet/Insight refactors, and production deployment are out of scope.

## Invariants

- Copilot tools execute sequentially in emission order.
- Every A2UI text prop resolves bindings through `resolveDisplayText` (or the
  equivalent interpolate/drop pair).
- Live place facts and geometry come from current Google Maps Platform calls.
  Demo fixtures are deterministic and visibly labeled; modeled reach is never
  called an isochrone or real route.
- Share payloads contain only application-owned inputs and decisions, never
  cached Google Maps content.
- Reveal is unavailable until a successful campaign artifact exists.
- Pinned guidance in `.agents/skill-sources.json` is applied to Maps, Gemini,
  eval, and A2UI changes.

## Execution gates

### Wave 0 — source of truth

- [x] Audit local branch and PR metadata (clean/mergeable/CI green at baseline).
- [x] Replace the stale slice handoff with this decision-complete plan.
- [x] Pin Agentic UI Toolkit, Gemini skills, Google eval skill, and A2UI sources.
- [ ] Commit/push plan and confirm remote SHA.
- [ ] Update PR body with exact evidence; distinguish Demo, credentialed Live,
  reranker consistency, agent eval, and GPU/manual verification.

### Wave 1 — truthful, state-safe behavior

- [x] Event-driven lifecycle covers launch/observe/compare/approve/invalidate/
  create/complete/undo/partial/resume/failure.
- [x] Scout candidates/evidence merge by ID without losing geometry/selection.
- [x] Area/priority changes invalidate approval and downstream artifacts.
- [ ] Spatial constraints have center + normalized outer/exclusion rings, edit
  rehydration, prompt serialization, and candidate filtering.
- [x] Live approval uses Routes API geometry; Demo route/reach stays labeled.
- [ ] Current evidence and What-if are separated; missing hours/weather/traffic
  disable controls; `openOnly` requires valid hours; scoring uses mission weights.
- [x] ChoicePicker binding regression is fixed and tested.
- [x] Required usage attribution is present on supported 2D/3D surfaces.

### Wave 2 — flagship workspace

- [ ] Active missions suppress generic scenario intro drawers.
- [ ] Mobile uses coordinated safe-area sheets, 44px targets, visible focus, and
  no ribbon/editor/lens/panel overlap.
- [x] Preference Passport is behind “Tune my passport”; launch remains near the
  initial mobile viewport.
- [x] Claim Lens co-locates evidence, confidence, limitations, and
  Places UI Kit detail with loading/unavailable/retry states.
- [ ] Dark/light and reduced-motion modes are truthful and accessible.

### Wave 3 — action, payoff, sharing, developer story

- [x] Demo populates real Scout and Ad Studio stores with labeled fixtures.
- [x] Live typed handoff creates campaign readiness only after a visible creative.
- [ ] Mission finale shows winner/evidence/route/creative/3D orbit, a 2D/static
  fallback, and Back to decision state restoration.
- [ ] Final narration is opt-in; image generation is visible; Omni is optional
  unless configured/authorized, with honest unavailable/fallback state.
- [ ] Versioned allowlisted mission share is encoded without Maps content;
  exact-once replay restoration remains open.
- [ ] Stage-aware developer X-ray lists real tools/products/models/policies,
  provenance, source entrypoints, and share/fork CTAs.

## Verification gates

Run on Node 22+:

```bash
git diff --check
npm test
npm run build
npm run eval
npm run mission-smoke
```

Browser gates must auto-detect installed Chromium and split deterministic Demo,
credentialed Live, injected failure/fallback, all-recipes, and GPU/manual runs.
Demo coverage targets 320×568, 390×844, 768×1024, 1440×900, and 1920×1080 in
light/dark and reduced-motion. Unexpected console/page/network errors fail.

Credentialed Live, paid agent evaluation, Omni, and GPU runs require explicit
cost/environment authority. Never print `.env` values. The reranker fixture is a
consistency contract, not agent-quality evidence. Agent-quality merge thresholds:
zero critical grounding/attribution/privacy/unsupported-claim failures, ≥90%
mission success, ≥95% tool-order/handoff integrity, and ≤5-point broad-quality
regression, with at most two repair cycles and an evaluator distinct from the
optimizer.

## Landing gate

Resolve every P0/P1 and explicitly defer accepted P2s. Re-run GMP compliance,
secret scan, full tests/build, latest-SHA CI, independent review, and GPU/manual
showcase where authorized. Document 3D/Omni preview status, billing/key
restrictions, EEA/prohibited-territory review, and no Maps-content persistence or
training. Squash-merge PR #36 only when these gates are evidenced; no deployment
is implied.

## Current verification log

- 2026-07-11 baseline `npm run build`: PASS (Vite build, 3,238 modules).
- 2026-07-11 baseline `npm test`: interrupted by the in-progress Wave 1 writer;
  200 tests passed and `src/ai/engine.test.ts` exposed the expected caller update
  from `setStatus` to the new transition API. Re-run after integration.
- 2026-07-11 integrated `npm test`: PASS, 35 files / 215 tests.
- 2026-07-11 integrated `npm run build`: PASS, 3,238 modules.
- 2026-07-11 `npm run eval`: PASS, 3 reranker consistency tests (not agent quality).
- 2026-07-11 deterministic `npm run mission-smoke`: PASS on Chrome at 1440×900
  and 390×844, including real Demo creative and headless raster fallback.
- 2026-07-11 credentialed Live, paid agent eval, axe/theme/viewport matrix, and
  real-GPU/Omni showcase: NOT RUN; approval/environment gates remain.

## Rollback and stop rules

Keep each wave as a focused commit. Do not merge partial lifecycle contracts,
fabricated Live route/condition claims, decorative campaign artifacts, or share
payloads containing Maps content. Stop as `PARTIAL_BLOCKED` when a paid/credentialed
or legal gate lacks approval; do not relabel it as passed.
