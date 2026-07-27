# Default first-run experience review plan

## Goal

Make the default path from the landing page to the first terminal Atlas result
feel obvious, fast, trustworthy, and visually calm on desktop and mobile. Every
suggested landing prompt must produce an experience that matches its promise,
uses real grounded evidence in Live mode, fails honestly, and leaves one clear
next action.

This plan covers the cold open, mission launch, streaming/progress state, map
updates, the first evidence surface, the concise agent answer, and the first
follow-up. It does not redesign all six recipe journeys.

## Current baseline on `main`

Baseline inspected at `dc6dd96`.

- Focused landing/explorer/follow-up suite: 33 tests passed.
- `npm run typecheck`: passed.
- Landing DOM audit passed at 320x568, 390x844, 768x1024, 1440x900, and
  1920x1080: no overflow, off-screen controls, sub-44px targets, unlabeled
  controls, or browser errors.
- The landing is structurally simple: one prompt, one primary action, three
  examples, and optional geolocation.

The checks above do not prove the Live journey. The current deterministic eval
uses fictional fixtures and exercises only the quiet-work-cafe prompt family.

## Blocking findings to resolve before qualitative polish

1. **Live readiness is asserted, not proven.** `Landing.tsx` always displays
   "Live services are configured" and always starts Live, even though the
   existing capability preflight can detect missing Maps, Grounding Lite,
   offline, or degraded states.
2. **One suggestion violates the runtime contract.** "Find a nearby errand stop
   with the shortest drive" still launches a fixed 15-minute `WALK` run.
3. **The headline over-promises the outcome.** The first explorer recommends a
   place and checks weather; it does not "launch" anything or ask for approval.
4. **Quietness is not measured.** The runtime explicitly discloses that search
   relevance is not a quietness score, but the default prompt leads with
   "quiet-work cafe."
5. **Live candidate identity is too generic.** The Grounding Lite adapter labels
   results "Grounded candidate 1/2/3," so the result cannot yet feel like a
   confident real-place recommendation.
6. **Browser gates are stale.** `scripts/smoke.mjs`,
   `scripts/mission-smoke.mjs`, and `scripts/uiux-audit.mjs` still target the
   removed Sample CTA and old flagship mission controller.
7. **The latest engine behavior conflicts with the repo invariant.** Same-name
   tool calls now use `Promise.all`, while `AGENTS.md` requires all copilot tool
   calls to run sequentially in emission order. Restore the invariant before
   using copilot traces as quality evidence.
8. **Small-screen text is legally visible but not excellent.** At 320px the
   example chips and privacy copy render at 9px; the audit catches geometry,
   not readability or hierarchy.
9. **Stored screenshots are stale.** `docs/screens/00-landing.png` shows the old
   journey-card landing and cannot serve as current review evidence.

## Product contract to lock first

Use one honest first-run promise:

> Describe the place you need. Atlas finds up to three real candidates, verifies
> the requested walk or drive limit, checks current weather when relevant, and
> recommends one with evidence.

Unless the first journey is expanded to perform a real downstream action,
replace "launch" language with "find," "compare," or "choose." Do not add new
capabilities merely to preserve marketing copy.

Each landing example must map to explicit typed inputs: place intent, travel
mode, travel-time limit, and whether weather is requested. Unsupported
qualities such as quietness must either gain a grounded signal or be removed
from the promise.

## Review and implementation sequence

### 1. Restore a trustworthy test harness

- Update smoke and UI-audit selectors to the current landing and explorer.
- Keep a deterministic, network-intercepted browser path for CI; add a separate
  opt-in Live path that never silently falls back to fixtures.
- Restore strictly sequential copilot tool execution and add a regression test
  for consecutive same-name calls that mutate shared scenario state.
- Make the landing capability state truthful: checking, Live-ready, or an
  actionable unavailable state. Never label fixtures or missing credentials as
  Live.

Gate: deterministic browser tests can launch, reach one terminal surface, and
capture current evidence without paid calls or credentials.

### 2. Verify every suggested prompt against the capability contract

Add cases for the default prompt and all three examples. For each case assert:

- requested travel mode and limit reach the route provider;
- a real place name/identity from Google Maps data appears in the result;
- only route-verified candidates can win;
- weather/jacket advice appears only when current weather was verified;
- unsupported qualities are disclosed and never used as ranking facts;
- evidence, final answer, markers, and winner route agree;
- source attribution is adjacent and Google Maps attribution remains visible;
- empty, partial, denied-location, offline, and provider-error states give one
  useful recovery action instead of a dead end.

The smallest likely correction is to make the examples describe what the
runtime already proves. If product intent requires walk/drive parsing or a new
quality signal, implement that as a separate behavior change with its own eval.

### 3. Simplify the operational shell for the first result

Review the post-launch screen as a progressive disclosure sequence:

1. map plus one compact "Atlas is working" state;
2. markers as soon as grounded candidates arrive;
3. one concise recommendation plus a compact evidence surface;
4. one primary counterfactual or follow-up.

During the first run, hide or subordinate recipe navigation, developer chrome,
duplicate tool chips, sharing, and the context drawer unless they directly help
the current decision. Do not show the same conclusion in competing panels.

Desktop gates:

- the map remains the dominant visual surface;
- only one primary action is visually dominant at each stage;
- dock, drawer, header, and map controls never compete or overlap;
- terminal evidence is scannable without covering most of the map.

Mobile gates at 320x568 and 390x844:

- no horizontal overflow or clipped/floating controls;
- all touch targets are at least 44x44;
- body text is readable without 9px prompt chips or legal copy;
- the result behaves like one bounded sheet with an obvious collapse/expand
  control and preserves useful map context;
- keyboard, focus order, reduced motion, safe areas, and Maps attribution pass.

### 4. Run the Agent Quality Flywheel

Expand `eval/explorer/cases.json` from the current fixture-heavy five cases to a
versioned dataset covering the four landing prompts plus constraint mismatch,
no results, missing routes, missing weather, denied location, offline, and
provider failure.

Keep the evaluator independent from the prompt/code change. Add stable custom
measures for:

- promise fidelity;
- requested travel-mode fidelity;
- grounded place specificity;
- source integrity and unsupported-claim rate;
- UI/final/map consistency;
- terminal usefulness and recovery;
- time to first map evidence and time to useful terminal result.

Require 100% on deterministic contract/safety gates and no regression in the
existing dimensions. Use before/after deltas, not an absolute vibe score.
Remote inference, AutoRaters, and paid Live evaluation require explicit human
approval before execution.

### 5. Perform the Live acceptance pass

After deterministic gates are green, run the default and all three examples
against configured Live services in the default city. Run one consented
device-location case separately. Capture sanitized traces and screenshots at
1440x900 and 390x844 without storing raw prompts, precise user location, Maps
content, credentials, or provider payloads in telemetry.

Live pass criteria:

- all four prompts reach an honest terminal result or a clear recoverable
  provider state;
- the first grounded map evidence appears within 3 seconds after the place
  search returns, with a provisional end-to-end target of 25 seconds;
- place identity, route mode/time, weather, recommendation, sources, and map
  agree;
- no raw A2UI tokens, internal tool names, stale spinners, duplicate surfaces,
  or severe console errors appear;
- a human reviewer can state the recommendation, why it won, and the next
  action after a five-second scan.

### 6. Ship in small reviewable changes

1. Harness, capability truthfulness, sequential-tool invariant, and current
   screenshots.
2. Prompt/capability alignment and expanded deterministic eval dataset.
3. First-result shell simplification and responsive/accessibility polish.
4. Opt-in Live evidence pass and final before/after report.

Each change includes its focused test, browser evidence, eval delta, and a
compliance review. Stop if a change improves one showcased prompt but regresses
another case or weakens grounding.

## Google Maps / privacy / cost guardrails

- All names, locations, routes, conditions, and other place facts must come
  from active Google Maps Platform or Grounding responses; never invent them.
- Preserve Google attribution and do not obscure map legal controls.
- Keep precise location opt-in, revocable, and scoped to the launched mission.
- Before Live release, confirm the billing region and intended audience, apply
  EEA-specific terms where relevant, and exclude prohibited territories.
- Do not use Google Maps content for model training, telemetry, or persistent
  diagnostic fixtures.
- Live calls may incur Google Maps Platform and Gemini costs. Use deterministic
  fixtures for CI and require approval for paid remote evals or repeated Live
  runs. A Maps Demo Key is available for supported zero-cost prototyping, but
  is not for production.
- Treat Agentic UI Toolkit behavior as pre-GA unless current pinned guidance
  proves otherwise. Re-fetch the pinned sources in `.agents/skill-sources.json`
  before changing Maps, Gemini, eval, or A2UI behavior.

## Definition of done

The first experience is done only when the landing promise, all suggested
prompts, runtime behavior, agent answer, evidence surface, map, and recovery
states agree; deterministic gates are green; the approved Live pass is green;
desktop/mobile screenshots show one calm visual hierarchy; and an independent
reviewer signs off on clarity, grounding, and simplicity.

## Execution status (2026-07-14)

Completed deterministic implementation waves:

- all copilot tool calls execute sequentially in model emission order;
- Live launch fails closed until Maps and Grounding Lite readiness is verified;
- suggested walk, drive, and optional-weather prompts map to deterministic
  runtime intent, and unrequested weather calls are omitted;
- the explorer evaluator covers seven deterministic cases with stable prompt
  fidelity and grounded-specificity dimensions (7/7 perfect candidate run);
- the first result uses focused shell chrome, retains a Home escape, fixes the
  closed-drawer overflow class, and raises compact mobile text/touch targets;
- browser harnesses intercept Grounding Lite, route drawing, and Gemini, write
  artifacts only to `/tmp`, and require an explicit cost acknowledgement
  because the configured Maps JavaScript renderer remains live.

The configured Grounding Lite/Gemini Live acceptance pass remains intentionally
unexecuted. It requires separate approval because it invokes external services
and can incur Google Maps Platform and Gemini costs. Browser screenshots used
the configured live Maps JavaScript renderer with deterministic app-provider
fixtures; they are not evidence that production Grounding Lite/Gemini
credentials, provider response shapes, or provider latency were verified.
