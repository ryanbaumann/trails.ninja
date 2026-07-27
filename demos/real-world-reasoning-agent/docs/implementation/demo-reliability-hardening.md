# Demo reliability hardening

## Goal

Make the Scout-to-Ad-Studio hero journey unambiguous, testable, and resilient;
harden the Atlas A2UI v0.9 subset before adding only journey-proven components;
and establish privacy-safe quality and diagnostic loops.

## Delivery checklist

### 1. Hero journey reliability

- [x] Make one viewport-appropriate mission action authoritative; secondary
  representations are status-only.
- [x] Ensure rail navigation closes or safely layers the Scout context drawer.
- [x] Show a brief, explicit approval-to-Ad-Studio transition.
- [x] Fix mobile overflow, stacking, and scenario-state transitions.
- [x] Update the mission smoke to the automatic campaign flow with uniquely
  scoped locators.
- [x] Verify landing -> demo launch -> approve -> creative -> reveal at desktop
  and 390 x 844, with no stale content or horizontal overflow.

### 2. A2UI hardening

- [x] Reject malformed catalog-node props with actionable validation errors.
- [x] Give PlaceCard, Image, Video, MapPreview, and AdCreative visible loading,
  empty, error, and retry states.
- [x] Resolve and drop unresolved display tokens for every text and alt/label
  prop.
- [x] Keep AdCreative's AI-generated disclosure non-overridable.
- [x] Add the Google Maps internal usage attribution ID to PlaceCard while
  retaining Google attribution.
- [ ] Make exactly one layer responsible for Scout comparison surfaces.
  (Deferred: needs an architectural decision on Scout vs. catalog ownership.)
- [x] Raise catalog button and chip targets to 44 x 44 on coarse pointers.
- [x] Surface catalog action failures through a visible toast or status event.

### 3. Journey-proven catalog subset

- [x] Add fixtures first, then the smallest reusable components required by
  journey output: ProgressStatus, RecoverableError, EvidenceSource,
  RouteItinerary/EtaSummary, ComparisonTable, and ConfirmationResult.
- [x] Add a golden hero fixture and browser render test for every journey, plus
  loading, empty, error, and update fixtures.
- [x] Describe the implemented contract as the "Atlas A2UI v0.9 subset" until
  full basic-catalog semantics exist.

### 4. Deterministic quality gates

- [x] Cover invalid keys, model stream failure/recovery states, tool ordering,
  missing media, invalid A2UI, action failures, session/offline behavior, and
  keyboard/coarse-pointer navigation. (Tool ordering and invalid A2UI were
  already strong; this pass adds the zero-coverage gaps — server abuse gates
  [429/daily-cap/cross-origin/missing-key], the stream retry/recovery loop, and
  the >=44px coarse-pointer hit targets. Invalid keys, missing media, and action
  failures retain their existing partial coverage.)
- [x] Create a trace dataset and independent evaluation of mission completion,
  tool order, grounding, surface ownership, and UI/final-response consistency.
  (`eval/traces.json` + `src/ai/traceEval.ts`, grader kept separate from the
  optimizer; `fail.*` fixtures isolate each dimension.)
- [x] Require human approval before a paid remote evaluation and compare
  before/after deltas for prompt or tool changes. (`scripts/eval-remote.ts`
  gates the paid AutoRater behind `EVAL_REMOTE_APPROVED=1`; always runs the free
  local eval and reports per-dimension deltas vs `.eval/baseline.json`.)

### 5. Minimal privacy-safe telemetry and replay

- [x] Remove raw prompts from query strings and prevent full-referrer forwarding.
  (Proxy forwards ORIGIN-ONLY referer/origin upstream via `stripToOrigin`; the
  app scrubs `prompt`/`mission` from the address bar on mount via
  `scrubReplayParams`.)
- [x] Add bounded in-memory/session diagnostics with Export and Clear controls.
  (Per-scenario telemetry stays bounded; Admin panel exports SANITIZED JSON and
  `clearAllTelemetry` clears it.)
- [x] Emit only structured, sanitized server metadata and add a strict,
  consent-gated browser metadata endpoint. (`POST /metadata` requires
  `X-Atlas-Consent: 1`, strictly validates an allowlisted sanitized payload, logs
  a content-free counter, and forwards nothing to third parties.)
- [x] Build a local telemetry report that validates, fingerprints, deduplicates,
  clusters, and creates deterministic replay fixtures. (`src/diagnostics/
  telemetry.ts` + `scripts/telemetry-report.ts`; fails loudly on forbidden
  content.)
- [x] Keep Maps content and personal data out of telemetry; do not use Maps
  content for training. Gate raw diagnostic bundles on regional/EEA review.
  (`sanitizeDiagnostic` drops all content; only structural metadata is exported;
  raw/unsanitized bundles are not produced here — gated on regional review.)

## Commit sequence

1. This plan and draft PR.
2. Hero action ownership, drawer/rail behavior, transition, and mission smoke.
3. A2UI validation, resilient component states, display text, attribution, and
   action feedback.
4. Journey fixtures and the minimal proven catalog additions.
5. Deterministic browser/evaluation matrix.
6. Privacy-safe diagnostics and replay tooling.

Each implementation commit must include its focused verifier. Deferred work is
left unchecked so this PR remains a useful resume point if execution pauses.

## Constraints

- Preserve the sequential tool-call execution invariant in `src/ai/engine.ts`.
- Do not let suggestion prompts advertise tools unavailable to the scenario.
- Do not record raw prompts, transcripts, tool data, Maps content, identifiers,
  locations, URLs, headers, cookies, or credentials.
- Treat Agentic UI Toolkit behavior as experimental/pre-GA and retain existing
  browser/server key restrictions and quota controls.
