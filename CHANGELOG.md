# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Local Synthetic Review Web App & Multi-Agent Dataset Pipeline (`scripts/review_app.mjs`, `scripts/generate_review_candidates.py`)**:
  - Interactive local A/B review web app with keyboard shortcuts (`1` for option A, `2` for option B, `R` to remove, `E` for custom surgical edits).
  - Grounded candidate generator extracting real-world writing patterns, architectural case studies, and talk outlines from `portfolio/content/`.
  - Multi-category subagent synthesis pipeline creating diverse, non-duplicative training pairs across `Draft`, `Edit`, `Critique`, `Headline`, `Present`, and `Abstention` tasks.
  - Round 8 SFT LoRA fine-tuning on Gemma 4 26B-A4B (`adapters/gemma-4-26b-ryan-voice-v8`), achieving a **42% clean pass rate** (20/48 items) on the held-out benchmark suite (up from 23% in Round 7 and 31% base), with 100% em-dash elimination (`G-EMDASH`), 100% headline count adherence (`G-HEADLINE-COUNT`), and 98% hype suppression (`G-HYPE`).

### Fixed
- Fixed Gemini rate limiting, quota exhaustion, and prepayment credit depletion handling across demo apps:
  - `gateway/lib/rateLimit.js`: Added hosted Gemini health probe state tracking (`recordHostedGeminiFailure`, `recordHostedGeminiSuccess`, `isHostedGeminiHealthy`, `getHostedGeminiHealth`) with 5-minute cooldown and recovery on successful requests/validations.
  - `gateway/lib/rateLimit.js`: Transitioned daily Gemini rate limiting to a cost-based model ($0.60/user/day, $5.00/global/day) with Gemini context caching discount tracking (~75% reduction on cached prompt tokens: $0.025/M tokens vs $0.10/M uncached tokens, $0.40/M candidate tokens), multi-turn delta cost reconciliation, and clear dollar-denominated limit messages.
  - `gateway/lib/realWorldReasoning.js`: Added cost estimation and dynamic usage/cost reconciliation for streaming and interactions endpoints via `extractGeminiUsageAndCost`.
  - `gateway/server.js`: Added cost estimation and usage reconciliation for Hairstyle AI Studio, Infographic Agent, and Contact spam classification.
  - `gateway/lib/realWorldReasoning.js`: Dynamically reports `gemini: false` and `hostedGemini: false` in `/capabilities` when the server-hosted quota is depleted, while allowing personal BYOK keys to immediately restore live reasoning; short-circuits hosted `/ai/*` proxy requests with HTTP 503 `FREE_TIER_UNAVAILABLE` when unhealthy, and records health transitions on upstream 429/401 responses.
  - `gateway/server.js`: Updated `/api/hairstyle-ai-studio/quota` and `/api/infographic-agent/quota` to report `hostedAvailable: Boolean` dynamically based on health state, and short-circuits hosted image generation/refinement requests with HTTP 503 `FREE_TIER_UNAVAILABLE` when the hosted key is depleted.
  - `demos/real-world-reasoning-agent`: Excluded rate limit and credit exhaustion errors from stream retry loops to eliminate 24+ second hangs and unhandled transition rejections (`AbortError: Transition was skipped`); expanded error matcher to detect `RESOURCE_EXHAUSTED`, `prepayment credit`, `status: 429`, and gateway error codes to instantly trigger the BYOK key dialog and set degraded state; updated `Landing.tsx` so the main CTA button remains active and opens the Gemini key modal with "Connect Gemini to continue" when hosted quota is depleted.
  - `gateway/lib/infographicAgent.js`: Mapped upstream 429 errors under hosted credentials to HTTP 503 `FREE_TIER_UNAVAILABLE` (matching `hairstyleAi.js`) and personal key 429 to `GEMINI_QUOTA_EXHAUSTED`.
  - `demos/infographic-agent`: Updated response error handler to recognize HTTP 503 and unavailable/exhausted codes as rate limits and automatically pop the BYOK modal.
  - `gateway/lib/realWorldReasoning.js`: Corrected default `dailyAiCap` in `configFromEnv` to 1,000 (matching `DEFAULT_GEMINI_LIMITS.globalMaxCalls`).
- Fixed Google Maps 3D camera transition promise rejections (`AbortError: Transition was skipped`) in `demos/real-world-reasoning-agent` by wrapping `map3d.flyCameraTo` and `map3d.flyCameraAround` calls to cleanly catch superseded animation aborts.
- Fixed `gemini-3.7-flash:generateContent` HTTP 400 Bad Request errors by removing unsupported `minimal` thinking level on `gemini-3.7-flash` (and `gemini-3.1-pro`) and standardizing on **LOW** thinking (`ThinkingLevel.LOW`) for simple UI, utility, voice STT, and fast workers across `demos/real-world-reasoning-agent`.
- Fixed Places UI Kit console warnings (`<gmp-internal-use-place-details-compact>: Ignoring <gmp-place-details-place-request> with no place.`) across `MarkerPlaceCard.tsx`, `PlaceCard.tsx`, and `ClaimLens.tsx` by validating non-empty place IDs and assigning both property and attribute on custom elements.
- Configured real dark styled Map ID (`9e6b48a5b3653026f9d7556d`) as `DEFAULT_MAP_ID` in `demos/real-world-reasoning-agent/src/lib/config.ts` matching other portfolio Maps demos.
- Fixed CSP violation in `infographic-agent` by configuring `"csp": "maps"` in `apps.json`, allowing Google Fonts stylesheets and font files.
- Fixed Gemini Interactions API 400 Bad Request errors in `gateway/lib/infographicAgent.js` and `gateway/lib/hairstyleAi.js` by structuring `generation_config: { thinking_level: 'low' }` according to REST API specification instead of top-level `thinking_config`.
- Added canonical URL and OpenGraph / Twitter social metadata tags to `demos/infographic-agent/index.html` to pass production smoke test deployment assertions.

### Changed
- Refined editorial essay rendering and stripped HTML comment cruft in `portfolio/build.mjs`:
  - Updated `markdownToHtml` and `writeMarkdownMirror` to cleanly strip HTML comments (`<!-- ... -->`) such as `<!-- lint-ignore -->` from rendered HTML output and markdown mirrors.
  - Enhanced blockquote parser to support multiline quote formatting separated by empty `>` lines.
  - Refined model comparison outputs in `can-i-build-an-ai-agent-that-doesnt-write-slop.md` with styled typography, bold pipeline headers, and high-contrast SVG figures.
- Upgraded agent-driven demo models and thinking level configurations across the repository to `gemini-3.7-flash`:
  - **Atlas Real-World Reasoning Agent (`demos/real-world-reasoning-agent`)**:
    - Upgraded primary orchestration model to `gemini-3.7-flash` with **HIGH** thinking (`ThinkingLevel.HIGH`, tunable to `MEDIUM`/`LOW`).
    - Routed bounded task agents (formatting, dynamic follow-up chips, grounded briefs, voice STT transcription) to `gemini-3.7-flash` with **LOW** thinking (`ThinkingLevel.LOW`), guarding against unsupported `minimal` thinking.
    - Routed multimodal reasoning and vision analysis to `gemini-3.7-flash` with **LOW** thinking (`ThinkingLevel.LOW`).
    - Updated gateway and demo server proxy allowlists, Admin panel model switcher, and validation suites.
  - **Hairstyle AI Studio (`demos/hairstyle-ai-studio`)**:
    - Upgraded opt-in hairstyle recommendation analysis in gateway (`gateway/lib/hairstyleAi.js`) to `gemini-3.7-flash` with **LOW** thinking (`{ thinking_level: 'LOW' }`).
  - **Infographic Agent (`.agents/skills/infographic-agent`)**:
    - Upgraded research orchestrator to `gemini-3.7-flash` across skill script, CLI runner, package metadata, and documentation.

### Added
- Brought **Infographic Agent (`demos/infographic-agent`)** in-house as a first-party workspace demo app:
  - Deployed alongside portfolio and demo apps in the unified Cloud Run gateway.
  - Zero-npm-dependency backend handler (`gateway/lib/infographicAgent.js`) mounted at `/api/infographic-agent/*` (`/prepare`, `/render`, `/validate-key`).
  - Web demo defaults to `gemini-3.7-flash` for structured research analysis and `gemini-3.1-flash-lite-image` for high-throughput image rendering, with tab-memory personal key override for high-res `gemini-3.1-flash-image`.
  - Skill (`.agents/skills/infographic-agent`) standardized on `gemini-3.7-flash` and `gemini-3.1-flash-image`.
- Added **Gemini Omni Rate Limiting (`geminiOmniRateLimiter` in `gateway/lib/rateLimit.js`)**:
  - Enforces strict rolling 24-hour limits on expensive Omni models in Atlas Real-World Reasoning Agent: **2 requests/day per user** and **10 requests/day globally**.
- Implemented **Automatic "Bring Your Own Key" (BYOK) Triggering** on rate limits across all demos:
  - `demos/hairstyle-ai-studio`: opens key dialog and displays actionable connect button in error alerts on 429 or quota exhaustion.
  - `demos/real-world-reasoning-agent`: dispatches global key dialog on 429 across chat engine, image generation, and video generation pipelines.
  - `demos/infographic-agent`: auto-opens personal key modal on 429 / daily limit exhaustion with seamless key validation and retry.
- Implemented **Circular Bucket Rate Limiter (`gateway/lib/rateLimit.js`)** for all hosted Gemini API gateway traffic:
  - Enforced personal user / IP rolling 24-hour caps (**100 calls/day** or **100,000 tokens/day**) and shared global rolling 24-hour caps (**1,000 calls/day** or **1,000,000 tokens/day**).
  - Designed as a zero-dependency 24-hour ring buffer of 288 five-minute buckets with O(1) mutations and rolling window sum.
  - Integrated across `/api/hairstyle-ai-studio/*` (generate, refine, analyze), `/api/real-world-reasoning-agent/*` (`/ai/*` interactions, `/ai/validate`, and generateContent/streamGenerateContent routes), `/api/infographic-agent/*` (prepare, render), and `/api/contact` (spam classification).
  - Added token extraction and reconciliation (`extractGeminiTokenUsage`) handling standard JSON responses (`usageMetadata`), streaming SSE chunk feeds, Interactions API step responses, and text fallbacks with pre-request token reservation and refunding on upstream failure.
- Fine-tuned and evaluated **Round 6 Gemma 4 31B Dense** adapter (`adapters/gemma-4-31b-ryan-voice-v6`) across the 48-item held-out suite:
  - Lifted clean item pass rate to **35% (17/48 items clean, 95% CI [23%–50%])**, up from 25% on MoE 26B-A4B.
  - Reduced total error-level failures from 56 down to **39** (30% error reduction).
  - Achieved **100% fact retention** (`G-FACT-KEEP` 11/11 passed), **zero repetition loops** (`G-LOOP` 48/48 passed), **87% edit preservation** (`G-EDIT-PRESERVE`), and cut verbatim echo failures by 55% (`G-ECHO` down to 5 failures).
  - Higher voice fidelity and semantic stability across `Critique` (33% clean), `Present` (60% clean), and `OOD` (67% clean).
- Fine-tuned and evaluated **Round 6 MoE 26B-A4B** adapter (`adapters/gemma-4-26b-ryan-voice-v6`) across the 48-item held-out suite:
  - 245 micro-pairs (221 train, 24 val) adding surgical edits, fact preservation pairs, negative grounding abstentions, and strict length bounds.
  - Achieved **50% clean pass rate on Draft tasks** (4/8 items clean), 98% pass on `G-EMDASH` (47/48), 98% pass on `G-AI-TELLS` (47/48), 100% on `G-ANNOUNCE`, `G-SCAFFOLD`, and `G-WEAK`.
  - Added dynamic task-specific generation token budgeting (`Headline: 512`, `Draft/Present: 1024`, `Critique: 800`, `Edit: 512`, `OOD: 768`) in `scripts/voiceeval/suite.py` and `scripts/voice_eval.py`, eliminating truncation artifacts (`G-TRUNCATED` 100% pass).
  - Wired local Gemma 4 voice model into npm workflows (`npm run voice:review`, `npm run voice:edit`, `npm run voice:headline`, `npm run voice:social`, `npm run voice:eval`) and documented the local editorial aide workflow in `docs/WRITER_WORKFLOW.md`.
- Evaluated **Round 5 MoE 26B-A4B** adapter (`adapters/gemma-4-26b-ryan-voice-v5`) on the 48-item held-out suite: 12/48 clean items (25.0%, 95% CI [15%–39%]), passing G-AI-TELLS (98%), G-EMDASH (96%), and G-ANNOUNCE (96%).
- Added **Apple Silicon Metal Hardware & Concurrency Rules** (`AGENTS.md`, `README.md`) enforcing strictly serial execution of local ML fine-tuning and evals, with automated `pgrep` pre-flight guards in `scripts/run_r5_moe.sh` and `scripts/run_r5_dense.sh`.
- Added **Dense 31B Round 5 Memory Optimizations** (`experiment/voice-ft/config_r5_dense.yaml`) tuning `max_seq_length: 1280` and `num_layers: 20` to prevent unified memory exhaustion and activation spikes during local training.
- Built `scripts/voiceeval/`, a grading harness for local voice-model output, closing the three gaps named in "Can I Build an AI Agent That Doesn't Write Slop?":
  - **48-item held-out suite** (`experiment/voice-ft/eval/heldout.jsonl`), up from 6 (Edit 14, Critique 9, Draft 8, Headline 6, OOD 6, Present 5). Every item carries a `why` field naming the failure it targets. `scripts/voice_eval.py leakage` proves zero 8-word shingle overlap with the 221-example training set, and `run` refuses to proceed on leakage without `--allow-leakage`.
  - **An edit-delta grader** that grades whether an edit changed anything. An edit fails in three directions: `G-EDIT-DELTA` (did nothing), `G-EDIT-PRESERVE` (threw the facts away), `G-EDIT-TARGET` (the word the brief said to remove survived), plus `G-EDIT-RESTRAINT` for rewriting prose that was already fine. `must_remove` terms are excluded from the preservation floor so the two checks cannot contradict each other.
  - **A citation resolver** (`scripts/voiceeval/citations.py`) that fails the run on an invented source. Round 4's `arxiv.org/abs/24606.24282` is rejected with the network off, because arXiv IDs are `YYMM.NNNNN` and `2460` is not a month. Online resolution is deliberately asymmetric: 404/410 is `invented` and errors; a timeout, DNS failure, or publisher 403 is `unknown` and warns. A link is never marked `ok` because the check could not run.
- Added `scripts/lib/voice-lexicon.json` as the single source of truth for hype, announcement, AI-tell, and scaffold patterns, read by both `scripts/lib/content-rules.mjs` (published prose) and `scripts/voiceeval/lexicon.py` (model output), so the site linter and the model graders cannot drift.
- Added repetition, truncation, typo, fabricated-number, abstention, and headline-slot graders; pass rates are reported with a 95% Wilson interval, which reports 1/6 as `[3%, 56%]`. Findings are listed individually and never averaged into a score.
- Added `scripts/voiceeval/judge.py`, an advisory LLM-as-judge that never sets the exit code: every verdict must quote a literal span (verdicts whose quotes are not in the draft are downgraded) and pairwise runs both orders, returning `no_preference` unless the winner survives the swap.
- Added `scripts/test/voiceeval_test.py`, 52 stdlib `unittest` cases pinned to the real round-4 outputs, plus restraint cases that must not fire. `npm run test:voice`.
- Added `experiment/voice-ft/config_r5.yaml` and `config_r5_dense.yaml` (20-step warmup and cosine decay to 1e-6, the most likely fix for round 4's repetition loops) and npm scripts `test:voice`, `eval:grade`, `eval:citations`, `eval:leakage`.

### Changed
- Applied Round 6 Gemma 4 31B Dense local copyeditor reviews in Ryan's voice across all 5 published public Field Notes (`builder-platforms-grow-by-owning-the-agent-loop.md`, `devex-is-a-growth-discipline.md`, `fine-tuning-was-the-easy-part.md`, `loop-engineering-coding-agent.md`, `the-model-that-picks-your-platform-doesnt-write-the-code.md`), tightening active first-person phrasing, replacing corporate abstraction with concrete developer tasks, removing em-dashes, and sharpening community discussion endings.
- Refined and updated [`portfolio/content/writing/can-i-build-an-ai-agent-that-doesnt-write-slop.md`](file:///Users/ryanbaumann/projects/portfolio/portfolio/content/writing/can-i-build-an-ai-agent-that-doesnt-write-slop.md) with empirical findings, architectural design insights, and local workflow routing:
  - Synthesized system design principles (masked prompt loss, 100–250 word micro-pairs, surgical edit pairs, multi-dimensional grader bounds, offline arithmetic citation checks).
  - Contrasted Gemma 4 31B Dense (35% clean pass rate, 100% fact retention, zero repetition loops, 55% fewer echoes) against Gemma 4 26B-A4B MoE (~2.5s latency, 3.2x faster on Apple Silicon Metal).
  - Articulated the core divide: stylistic register transferred cleanly, but editorial judgment remains human-owned.
  - Documented practical dual-model local routing and the 4-step local writing and verification loop.

### Fixed
- Fixed `scripts/generate-ft-dataset.py` comparing `content_type == "talk"` against a corpus that labels talks `"talks"`, which meant the **Present task produced zero training examples across all four rounds** while the README claimed four. Present prompts were being evaluated against a model that had never seen one. Now 8.
- Stopped `scripts/generate-ft-dataset.py` overwriting `experiment/voice-ft/eval/prompts.jsonl` on every run, which made the held-out set a function of the training set. It now reports leakage against the held-out suite and exits non-zero on overlap instead of writing to it.
- Fixed `NUMBER_RE` in the fabricated-number grader using a trailing `\b`, which never matches after `%`, so `40%` was invisible to the check. Same bug fixed in the `must_remove` / `must_preserve` term matcher.
- Stopped the lexicon's `abstain` category being graded as a lexical violation. A match there is the good outcome; it is scored by the citation grader.
- Fixed Giscus comment widget layout constraints on portfolio field notes by setting an explicit `100%` width and a `400px` `min-height` on the iframe, preventing height collapse or squished rendering on narrow viewports.

### Added
- Added interactive **Voice & Editorial Studio** web app (`/voice-studio/`, `demos/voice-studio`) providing a blind evaluation arena (Model Alpha vs Model Beta), real-time stylistic rhythm and buzzword analysis, a voice memo scrubber, and 1-click JSONL pair export for local fine-tuning datasets.
- Created automated local evaluation harness (`scripts/eval_local.py`) testing base models and LoRA adapters on Apple Silicon Metal across held-out task prompts, measuring sentence length variance, zero em-dash compliance, corporate buzzword suppression, and unprompted metric hallucination.
- Implemented 4-round QLoRA fine-tuning progression on Apple Silicon Metal via MLX for Gemma 4 26B-A4B:
  - **Round 1:** 159 examples, full-sequence loss ($r=8, \alpha=20$, 468 iters, 36.8 GB RAM), converging loss from 11.905 down to 0.437. Identified prompt template replication caused by unmasked prompt loss.
  - **Round 2:** 159 pre-chunked examples ($\le 850$ words) with `--mask-prompt` (completion-only loss, $r=16, \alpha=32$, 250 iters, accum=4), dropping peak memory by 13 GB to 23.8 GB and eliminating prompt replication.
  - **Round 3:** 159 pre-chunked examples, 100 iters (2.5 epochs, $lr=5\text{e-}5$, accum=2, 29.8 GB RAM), identifying the goldilocks adaptation window preserving stylistic flexibility without mode collapse.
  - **Round 4:** 218 paragraph-level micro-pairs (111 Edits, 54 Drafts, 30 Critiques, 19 Headlines) with native chat template (150 iters, $lr=8\text{e-}5$, accum=2, 24.5 GB RAM), achieving 0 metric hallucinations, 0 em-dashes, and natural sentence length standard deviation (6.4–7.9 stdev).
- Committed reproducible training data, dataset generator (`scripts/generate-ft-dataset.py`), held-out evaluation suite (`experiment/voice-ft/eval/prompts.jsonl`), ephemeral evaluation runner (`scripts/run_ephemeral_eval.py`), and on-demand assistant/subagent CLI (`scripts/ryan_voice.py`) for the Gemma 4 26B-A4B voice fine-tuning experiment.

### Changed
- Rewrote the voice fine-tuning Field Note as "Can I Build an AI Agent That
  Doesn't Write Slop?"
  (`portfolio/content/writing/can-i-build-an-ai-agent-that-doesnt-write-slop.md`, renamed from
  `why-i-fine-tuned-a-26b-model-on-my-laptop-instead-of-prompting-frontier-apis.md`
  with an alias redirect). The note now answers its own question against the six
  retained held-out results: register transferred on all six, judgment failed on
  five, including an invented arXiv ID. It opens on why prose is the harder case
  (code ships into compilers, type checkers, tests, and a runtime; a paragraph
  ships into a person), lands on the two jobs that survived (rough first drafts
  from dictation, and editing copy I already wrote), and stays in first person
  throughout. Replaced the fabricated University of Michigan statistics
  (*Dhillon et al., 2026*, "82.7%", "62%") with the real preregistered study,
  [arXiv:2510.13939](https://arxiv.org/abs/2510.13939), and its reported odds
  ratios of 0.16 prompted and 8.16 fine-tuned. Cut the Voice & Editorial Studio
  section and deleted `portfolio/static/img/writing/voice-studio-ui.jpg`, an
  AI-generated screenshot of an interface that was never photographed. Rebuilt
  all three inline SVGs at 1200x675 around the argument (code has graders, gates
  in front of judgment, register versus judgment) and regenerated the share card,
  which had been carrying another post's artwork.
- Stopped counting URLs toward `W-STOCK-PHRASE` in `scripts/lib/content-rules.mjs`.
  Three notes linking the same repo file is evidence, not boilerplate, so link
  targets are stripped before shingling. Covered by a new case in
  `scripts/test/check-content.test.mjs`.
- Wrapped `pre` blocks below 640px in `portfolio/style.css` so a command longer
  than the phone reading column wraps instead of opening a horizontal scroll
  gutter inside the article.
- Integrated the local Gemma 4 runner (`scripts/gemma-local.sh` and `scripts/local_gemma.py`)
  into `.agents/skills/portfolio-review/SKILL.md` as an automated voice and cadence critique
  step in the maker/checker loop, with full 4096-token generation support.
- Corrected the local-runner attribution in `LEARNINGS.md`: the review pass that
  produced the PR #212 edits ran the base model steered by `SYSTEM_PROMPT`, not
  the tuned adapter. `scripts/local_gemma.py` calls `mlx_lm.load()` with no
  `adapter_path`, and the `ryan-voice-gemma-4-26b-v1` adapter has never run
  locally.
- Refined writing and voice across all public and draft Field Notes using local Gemma 4 26B-A4B editorial review, stripping academic rhetorical question openings, aligning narrative flow to growth-backwards framing (Result $\rightarrow$ Shipped $\rightarrow$ Lesson), enforcing 0 em-dashes, and varying closing CTAs to achieve 0 stock phrase collisions.
- Added 1-command local Gemma 4 runner (`scripts/gemma-local.sh` and `scripts/local_gemma.py`) powered by Apple Silicon MLX and Metal acceleration with gitignored local weight caching in `models/`.
- Updated the Loop Engineering coding agent operating contract (`agent-scripts/coding-agent-loop/SYSTEM_PROMPT.md`), role overlays (`roles/`), and public Field Note (`portfolio/content/writing/loop-engineering-coding-agent.md`) with Practical Loop Engineering best practices:
  - Formally codified the loop taxonomy across five primitives: single-turn agentic loops, goal-based loops with deterministic finish lines, interval loops, proactive cloud routines, and composed loops with parallel worktrees and adversarial judge review.
  - Enforced the discipline of keeping human architectural judgment, adding explicit accidental complexity guards against bloated solutions.
  - Enforced strict author-verifier separation, requiring an independent verifier subagent to validate empirical outcomes.
  - Integrated the 4-step frontend change verification standard (dev server, control interaction with visual proof, zero console errors, performance/Core Web Vitals trace).
  - Added 3-strike loop spinning limits on unchanged commands and progress requirements (aborting when two consecutive turns yield zero metric improvement).
- Rebuilt “I Fine-Tuned the Model Before I Built the Test” around the two
  artifacts the original story missed: a wrong billing label and an evaluator
  that never called a model. The note removes unsupported scores, the false
  four-times billing hook, and report-style formatting; it now explains the
  trace mechanics through one real case while restoring the original argument:
  context steers a run, post-training changes learned behavior, and distribution
  is the harder developer-platform problem. A new evidence-bounded pyramid,
  three forensic visuals, the social copy, evidence ledger, and
  publication-review loop carry the same standard without exposing generation
  context on the canvas.
- Rewrote four separate Field Notes around the evidence each one can actually
  show: a retained 2/4-to-4/4 editorial trial, an unmeasured routing policy, a
  17-scenario operating contract, and one public Code Assist retrieval trace.
  Updated their artifact and social graphics to carry the same bounded claims,
  and kept the Code Assist launch card as its own entry.
- Consolidated open Dependabot dependency updates across demo apps into a single PR (upgrading `vite`, `lucide-react`, `postcss`, `@types/react`, `@types/google.maps`, `@playwright/test`, `terra-draw`, `typescript`, `@deck.gl/google-maps`, `@deck.gl/layers`, `@vitejs/plugin-react`, and `vitest`), superseding PRs #164, #165, #166, #167, #168, #172, #173, #174, #175, #176, #177, #178, #179, #180, #181.

### Security
- Documented and enforced the Lab gateway's key boundaries, CSP assumptions,
  conservative per-IP and process-wide daily Maps/Gemini ceilings, bounded
  limiter memory, privacy-limited analytics, and production Grounding Lite
  configuration.
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
- Fine-tuned Gemma 4 26B-A4B on Ryan Baumann's published writing across 5 core task types (Draft, Edit, Critique, Headline, Present). Added `scripts/ryan_voice.py` as an on-demand lifecycle manager and copy review tool that can spin up the Vertex AI endpoint for interactive reviews or subagent workflows and cleanly spin down to zero idle cost.
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
- Consolidated the pending Dependabot updates across Atlas, Hairstyle AI
  Studio, Strava Explorer, Isochrones, and Air Quality Map, including the
  required Tailwind 4 PostCSS compatibility update for Hairstyle AI Studio.
- Reduced CI/CD duplication so pull requests compile the complete application
  once in the deployable Docker image, while package jobs retain isolated lint
  and unit tests. Main-branch pushes now rely on the production Cloud Build
  instead of rebuilding the same container in GitHub Actions, and Cloud Build
  reuses the last successful image as an inline BuildKit cache. The historical
  required smoke-check name remains as a lightweight gate over the Docker job
  so branch protection does not wait for a removed status.
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
- Kept production secret scanning strict without treating the public
  `@google/genai` SDK's OAuth schema field name as a leaked credential. The
  smoke test now requires a value-shaped `client_secret` assignment before
  failing, matching the container smoke scanner.
- Added the missing canonical and Open Graph URLs to the Real World Reasoning
  Agent page so production metadata verification recognizes
  `https://ryanbaumann.dev/real-world-reasoning-agent/` as its sole owner.
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
