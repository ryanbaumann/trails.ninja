# Repository Learnings

This log captures durable lessons discovered while building and maintaining the portfolio and demo lab, keeping the root instructions lean.

## 2026-08-26 - Agentic UI Thinking UX & MAUI A2UI Integration ensures clear hierarchy and official GMP component parity

Context: Improving Real World Reasoning Agent thinking and loading UI/UX across desktop and mobile, and upgrading to the latest Google Maps Agentic UI (MAUI / A2UI) components and skill patterns.
Learning:
1. **Chat UI Hierarchy Inversion**: Rendering the loading indicator before the message list inverted temporal chronology when the user sent a message (the loading card appeared above the prompt). Moving `{msgs.map(...)}` before `{active && <ActiveWorkPanel />}` anchors the user prompt at top and flows the live thinking card directly underneath.
2. **Dynamic Phase Disclosure & Timer**: Static "Atlas is working" fails to convey agent activity during spatial multi-step tool calls. Exposing phase badges (`GEMINI REASONING`, `TOOL EXECUTION`, `IMAGERY GENERATION`), specific tool rationale strings, live elapsed timer (`⏱ 4s`), and running/completed step checklists gives users immediate confidence in execution progress.
3. **Provisional Prose Streaming Unsuppression**: Hiding streaming text completely until completion creates perceived lag; allowing provisional text tokens to render with a pulsing cursor (`▋`) once text arrives produces an immediate, responsive feel without sacrificing structure.
4. **Mobile Statusbar Clearance**: Floating global nav elements (`.fieldwork-home-link` at `top: 12px; right: 12px;`) can collide with edge-to-edge statusbars on mobile if right margins are too small (`right: 56px`). Setting `right: max(136px, calc(env(safe-area-inset-right) + 128px))` cleanly clears fixed pills on narrow viewports while preserving ≥44×44px touch targets.
5. **MAUI A2UI v1.0 Compatibility**: Upgraded to the official Maps Agentic UI Toolkit v1.0 (`a2ui://maps-agentic-ui-catalog.json` / `googlemaps/a2ui` v1.0.0). Supporting single-message `createSurface` (with embedded `components` and `dataModel`), dynamic `orientation` (`horizontal` vs `vertical`), `mapId`, and proper HTML attributes on `<gmp-place-details-compact>` guarantees compatibility with official upstream schemas while preserving full backward compatibility with incremental multi-message envelopes.
Evidence: 70 test suites passing (579 unit tests), golden render fixture in `catalogSubset.test.tsx`, visual verification across Desktop (1440×900) and Mobile (390×844) viewports via Playwright, and 21/21 passed smoke tests on root gateway.
Use next time: Place active loading panels beneath the active prompt in chat views; show explicit reasoning phases and elapsed timers; and align GenUI schemas with official MAUI A2UI v1.0 catalog identifiers.

## 2026-08-25 - Local Zero-Dependency Copywriter Web Studio combines live preview rendering with local Apple Silicon Metal voice edits

Context: Building a local copywriting and live preview web app (`scripts/writer_app.mjs`) enabling side-by-side editing, exact portfolio CSS rendering, and inline Google Docs-style suggestions powered by fine-tuned local Gemma 4 models running on Apple Silicon Metal via MLX.
Learning:
1. **Zero-dependency local Node architecture**: Using native `node:http`, `node:fs`, and child processes for MLX inference eliminates external SaaS or extension dependencies, avoiding Google Docs cross-origin tunnel latency and format conversion friction.
2. **Direct markdownToHtml mirror**: Reusing the exact `portfolio/build.mjs` markdown parser and CSS stylesheet in the sandboxed preview iframe achieves < 30ms render latency with 100% visual fidelity to production output.
3. **Google Docs-style inline diff ergonomics**: Text selection with `Cmd+K` calls `scripts/gemma-local.sh edit`, parses out ML banner headers, and presents a clean `<del>` / `<ins>` diff card with `Cmd+Enter` to accept or `Esc` to dismiss, preserving surrounding front matter and markdown formatting.
4. **Transparent AI editorial disclosure**: Adding `.article-colophon` and `.article-disclosure` to the detail page template provides clear, professional attribution ("Written by Ryan Baumann. Fine-tuned local language models assist with copyediting and voice consistency; all ideas, analysis, and code are my own.") across all Field Notes.
Evidence: `scripts/writer_app.mjs` running on port 8090; verified live selection edit on Apple Silicon Metal; `node portfolio/build.mjs` successfully validated all 32 pages with colophon styling.
Use next time: Run `npm run writer` for focused article drafting and voice editing; use the inline diff card to review model suggestions before accepting them into markdown source.

## 2026-08-24 - Multi-Model Design of Experiments (DoE) validates Gemma 4 31B Dense quality leadership and Qwen 3 MoE learning velocity

Context: Running a full Design of Experiments (DoE) benchmarking top Hugging Face 24B–31B open-weight models (Qwen 3.8 27B Dense, Devstral Small 2 24B, Qwen 3 30B-A3B MoE) against baseline Gemma 4 (31B Dense and 26B-A4B MoE) for local stylistic voice fine-tuning on Apple Silicon Metal.
Learning:
1. **Gemma 4 31B Dense remains the overall quality champion**: Achieving **54% clean pass rate** (26/48 items) with zero fact drops (100% `G-FACT-KEEP`), 100% headline compliance (`G-HEADLINE-*`), and 98% hype/AI-tell suppression.
2. **Qwen 3 30B-A3B MoE demonstrates phenomenal fine-tuning speed and loss convergence**: Training completed in **3.93 minutes** on Metal (~162 tokens/sec, ~0.76 iters/sec), dropping training loss from 3.65 -> 0.43, completely eliminating base model em-dashes (44 -> 0 failures), and lifting clean pass rate from 2% to 38% (+36 percentage point gain; 17 items fixed, 0 broken).
3. **Qwen 3.8 27B Dense demonstrates robust stylistic transfer**: Improved clean pass rate from 27% to 40% (+13 percentage points), cutting errors from 62 down to 37 and fixing 11 failing items across critique, edit, and presentation tasks, though MLX VJP autodiff fallback limits training throughput to ~14 tokens/sec.
4. **Devstral Small 2 24B requires architecture-specific hyperparameters**: Suffered mode collapse during standard LoRA fine-tuning (loss plateau at 7.7), highlighting the necessity of model-specific learning rate scaling and tokenizer regex fixes (`fix_mistral_regex=True`).
5. **Sequential GPU execution invariant on Apple Silicon**: Strictly serializing all training and evaluation jobs with pre-flight process locks (`pgrep -f "mlx_lm.lora|voice_eval"`) guarantees zero Metal context resets, predictable memory ceilings (17–25 GB on 48GB unified memory), and clean completion.
Evidence: Completed 5 zero-shot baselines, 3 full LoRA training runs, and 5 evaluation suites across `heldout.jsonl` with scorecards in `experiment/voice-ft/eval/results/`.
Use next time: For final production voice agents where accuracy is paramount, use Gemma 4 31B Dense; for ultra-fast local iteration and interactive drafting, Qwen 3 30B-A3B MoE provides the best fine-tuning velocity and zero em-dash compliance; always run training sequentially on Apple Silicon.

## 2026-08-21 - Native Gemini Maps Grounding simplifies tool architecture and replaces custom MCP proxies

Context: Migrating the Real World Reasoning Agent demo from Grounding Lite MCP to official Gemini Maps Grounding (`tools: [{ googleMaps: {} }]`).
Learning:
1. Gemini Maps Grounding provides built-in Google Maps retrieval directly through `generateContent` tool configuration.
2. The retrieval configuration accepts search center coordinates (`toolConfig.retrievalConfig.latLng`) for spatial queries.
3. Maps Grounding returns candidate titles, web URIs, and place IDs within `groundingMetadata.groundingChunks`.
4. Browser end-to-end testing requires intercepting Maps JS SDK `Route.computeRoutes` dynamically when live billing keys are absent.
5. Hooking `window.google.maps` via property getters and setters ensures reliable mocking across all browser viewports.
6. Google Maps Places UI Kit web components (`<gmp-place-details-compact>`, `<gmp-place-details>`) only expose a property getter on `.place`. Assigning directly (`element.place = id`) throws `TypeError: Cannot set property place of #<...> which has only a getter`. Always use `element.setAttribute('place', id)`.
7. `@vis.gl/react-google-maps` `AdvancedMarker` unmount in raster fallback mode (e.g. headless Playwright without hardware WebGL) can throw internal Maps JS errors during `marker.map = null`. Intercepting the `AdvancedMarkerElement.prototype.map` setter and wrapping map layers in a React `ErrorBoundary` prevents unmount errors from destabilizing the React component tree.
Evidence: All 70 demo tests (576 unit assertions), 167 gateway tests, root smoke suite (21 assertions), and Playwright end-to-end mission smoke passed cleanly.
Use next time: Use native Gemini Maps Grounding tools with coordinate retrieval config instead of external MCP proxy bridges; use `.setAttribute('place', ...)` on Places UI Kit elements; and protect map layers with Error Boundaries.

## 2026-08-18 - Independent subagent reviewer teams (maker/checker loop) filter and contextualize dense model editorial critiques

Context: Running Gemma 4 31B Dense (Round 8 LoRA) in editorial critique mode across all 6 published articles, using a team of 3 independent reviewer subagents to evaluate every suggested edit before applying changes to the narrative.
Learning:
1. LLM editorial suggestions frequently identify genuine narrative friction (e.g. passive openings, unnecessary semicolons, weak conclusions), but often introduce subtle stylistic regressions in the replacement text: inventing new false antithesis flips ("not X, but Y"), softening decisive first-person conclusions, or losing critical metric contexts.
2. Employing an independent maker/checker subagent team that reviews each model suggestion item-by-item against `.agents/skills/portfolio-writing/SKILL.md` allows selective adoption: accepting genuine friction points, modifying proposed replacements to maintain voice constraints (e.g. replacing false antitheses with colon pivots or direct statements), and rejecting changes that discard essential metrics or URLs.
3. Sorting pinned portfolio entries by an explicit numerical property (`meta.order` ascending) guarantees deterministic homepage layout without depending on implicit file or date sorting order.
Evidence: All 6 published articles updated and verified; `npm run check:content` passed with 0 errors/warnings; gateway tests (169 passing) and smoke tests (21 passing) green.
Use next time: Always pipe dense model editorial critiques through an independent subagent reviewer team with explicit style constraints rather than applying raw model suggestions verbatim.

## 2026-08-18 - Applying fine-tuned model editorial critique streamlines narrative velocity and strips subtle meta-narratives

Context: Running the fine-tuned Gemma 4 31B Dense (Round 8 LoRA) model in editorial review mode over `can-i-build-an-ai-agent-that-doesnt-write-slop.md` to critique narrative structure, pacing, and AI tells.
Learning:
1. Editorial peer critique by a fine-tuned dense model effectively isolates subtle meta-narrative patterns ("I started where everyone starts", "I wanted to take my best stab at the problem") and false antithesis flips ("not X, but Y") that standard regex and prompt-based linters miss.
2. Replacing generalized consensus openings ("We all know raw AI copy is bland...") with direct practitioner friction ("Fixing an agent's generic draft usually takes longer than writing from scratch") immediately establishes concrete narrative momentum.
3. Restructuring section takeaways into explicit operational buckets ("Where fine-tuning succeeded", "Where fine-tuning failed", "The better path") sharpens technical trade-offs for builders without softening conclusions.
Evidence: Content linter `npm run check:content` passed with 0 errors/warnings; full gateway test suite (169 passing) and smoke suite (21 passing) validated all routes and rendered markup.
Use next time: Use the fine-tuned 31B Dense model in editorial critique mode on technical drafts to catch structural pacing friction and meta-commentary before publication.

## 2026-08-17 - Dense architecture scaling delivers 54% clean pass rate and perfect headline generation in voice LoRA fine-tuning

Context: Fine-tuning Gemma 4 31B Dense on the grounded 132-item Round 8 SFT dataset (`adapters/gemma-4-31b-ryan-voice-v8`) after achieving 42% on Gemma 4 26B-A4B (MoE).
Learning: 
1. Dense parameter capacity significantly outperforms mixture-of-experts routing on structured stylistic formatting and nuance tasks: Gemma 4 31B Dense achieved a **54% clean pass rate** (26/48 items, 95% CI 40–67%) on the held-out evaluation suite, outperforming both Gemma 4 26B-A4B MoE (42%) and Round 6 Dense (44%).
2. Dense models demonstrate superior adherence to rigid length, slot, and variety constraints: achieving **100% clean pass rate** across all headline tasks (`G-HEADLINE-*`, 6/6 items), **80% on presentation tasks** (`Present`, 4/5 items), and **50% on drafting tasks** (`Draft`, 4/8 items).
3. On Apple Silicon Metal with unified memory (48GB), running single-batch SFT LoRA fine-tuning on 31B Dense (`batch_size: 1`, `max_seq_length: 1536`, `num_layers: 16`, `pad_to_max_length: false`, `mask_prompt: true`) fits comfortably within ~35.7 GB peak memory and completes 180 iterations in ~15 minutes (~0.20 it/sec).
Evidence: Scorecard evaluation (`experiment/voice-ft/eval/results/round8_dense_scorecard.md`) confirmed 26/48 clean items with zero warnings and passing gateway test suite.
Use next time: For final production deployments of stylistic voice adapters where inference latency is secondary to structural fidelity and constraint adherence, prioritize dense base architectures (e.g. Gemma 4 31B Dense) over MoE variants.

## 2026-08-17 - Placeholder tokenization in zero-dependency markdown parser prevents inline code characters from breaking emphasis

Context: Reviewing the rendered HTML in `portfolio/dist/writing/can-i-build-an-ai-agent-that-doesnt-write-slop/index.html` where an inline code span containing an asterisk (`` `G-HEADLINE-*` ``) inside bold text produced corrupted markup `*<em>Headline Format Compliance (<code>G-HEADLINE-</em></code>)<strong>: </strong>100%**`.
Learning: In naive sequential regex markdown formatters, replacing backtick code spans with `<code>` tags before strong/emphasis matching leaves literal asterisks or underscores inside the intermediate string. The subsequent `\*\*([^*]+)\*\*` regex terminates prematurely on the internal asterisk, and the single-asterisk `\*([^*]+)\*` rule mispairs the opening delimiter with the internal code character. Stashing extracted code spans into non-formatting placeholder tokens (`\x00CODE_n\x00`) before running link, bold, and italic regexes, and restoring them at the end, guarantees that special syntax characters within code spans never collide with outer inline formatting.
Evidence: Updated `inlineMd` in `portfolio/build.mjs`, rebuilt the portfolio, and confirmed `<li><strong>Headline Format Compliance (<code>G-HEADLINE-*</code>)</strong>: <strong>100%</strong> pass rate...</li>` renders cleanly with 0 malformed tags and 169 passing gateway tests.
Use next time: In hand-rolled inline markdown parsers, always tokenize and isolate literal code spans and raw syntax blocks into placeholder sigils before evaluating delimiter-based formatting like emphasis, links, or strike-throughs.

## 2026-08-17 - Grounded multi-category synthesis with exact system prompt alignment and human review edits lifts voice LoRA clean pass rate to 42%

Context: Fine-tuning Gemma 4 26B-A4B on Ryan's voice after human review revealed repetitive fabricated templates in synthetic candidates (Round 7 scored 23% vs 31% base).
Learning: 
1. Hardcoded synthetic templates (e.g. fixed headline loops across every article) induce stock phrase memorization (`G-STOCK-PHRASE`) and degrade task variety (`G-HEADLINE-COUNT`). Replacing synthetic templates with diverse subagent-synthesized pairs grounded on real-world case studies (Mapbox Boundaries, BigQuery Spatial SQL, Strava 3D, Code Assist MCP traces) dramatically improves fidelity.
2. System prompt drift between the training dataset generator and the evaluation runner causes subtle task boundary degradation; aligning `SYSTEM_PROMPT` word-for-word ensures the model routes `[Task: Edit]`, `[Task: Critique]`, `[Task: Headline]`, `[Task: Draft]`, and `[Task: Present]` accurately.
3. Incorporating human review edits that emphasize first-person builder agency, leading with user value, and stripping buzzwords/em-dashes enabled the Round 8 LoRA adapter (`adapters/gemma-4-26b-ryan-voice-v8`) to achieve a 42% clean pass rate (20/48 items, 95% CI 29–56%), with 100% pass on em-dash removal (`G-EMDASH`), 100% pass on headline formatting (`G-HEADLINE-COUNT`), and 98% pass on hype/AI-tell suppression.
Evidence: Held-out benchmark suite (`experiment/voice-ft/eval/heldout.jsonl`) scored 20/48 clean items in `experiment/voice-ft/eval/results/round8_scorecard.md`, surpassing Round 7 (11/48, 23%) and base Gemma 4 26B-A4B (15/48, 31%).
Use next time: When fine-tuning for voice and editing tasks, ensure 100% word-for-word system prompt parity between SFT data generation and evaluation harnesses, and ground all synthetic candidate pairs in diverse, authentic architectural case studies rather than static loops.

## 2026-08-17 - Gemini 3.7 Flash rejects minimal thinking level (requires low/medium/high) and Places UI Kit requires DOM property assignment

Context: Investigating HTTP 400 Bad Request on `gemini-3.7-flash:generateContent` (e.g. clicking "What's it like to live here?") and `<gmp-internal-use-place-details-compact>: Ignoring <gmp-place-details-place-request> with no place.` in `demos/real-world-reasoning-agent`.
Learning: 
1. In the Google Gemini API specification, `gemini-3.7-flash` (and `gemini-3.1-pro`) only supports `thinkingLevel`: `"low"`, `"medium"` (default), and `"high"`. Setting `thinkingLevel: "minimal"` (or `ThinkingLevel.MINIMAL`) is unsupported on 3.7 Flash and immediately returns HTTP 400 Bad Request (`Not supported (error)`). For 3.7 Flash, low-latency task agents (simple UI, voice STT transcription, followup suggestions, grounded briefs) must use `ThinkingLevel.LOW`, while orchestration uses `ThinkingLevel.HIGH` (or `MEDIUM`).
2. Google Places UI Kit web components (`<gmp-place-details-compact>` and `<gmp-place-details-place-request>`) require the `place` property to be assigned directly on the DOM element (`(element as any).place = cleanPlaceId`) in addition to the HTML attribute (`setAttribute('place', cleanPlaceId)`), and must only be mounted when `placeId` is a validated non-empty string to avoid `<gmp-internal-use-place-details-compact>: Ignoring <gmp-place-details-place-request> with no place.` warnings.
Evidence: Updated `getThinkingConfig`, `AGENT_PROFILES`, `THINKING_CONFIGS`, and `stt.ts` in `demos/real-world-reasoning-agent`, along with `MarkerPlaceCard.tsx`, `PlaceCard.tsx`, and `ClaimLens.tsx`. 70 passing test suites (577 tests), 169 passing gateway tests, clean build and smoke tests.
Use next time: When routing to Gemini 3.7 Flash, never configure `"minimal"` thinking level—always use `"low"` as the floor for bounded utility calls and `"high"`/`"medium"` for orchestration. When mounting Places UI Kit web components, always assign `.place` property on the custom element instances.

## 2026-08-17 - Catching Google Maps 3D camera animation promise rejections prevents uncaught AbortErrors on rapid interactions

Context: Investigating `Uncaught (in promise) AbortError: Transition was skipped` errors when launching and interacting with 3D map views in `demos/real-world-reasoning-agent`.
Learning: In the Google Maps 3D JavaScript API (`<gmp-map-3d>`), camera transition methods (`flyCameraTo` and `flyCameraAround`) return promises that resolve upon completion and reject with `DOMException: AbortError: Transition was skipped` when superseded by user gestures (drag/tilt/zoom) or subsequent camera commands. Calling these methods without handling their returned promises causes Chrome to log uncaught promise rejections. Wrapping the calls in `Promise.resolve(map3d.flyCameraTo(...)).catch(err => { if (err instanceof Error && (err.name === 'AbortError' || err.message?.includes('Transition was skipped'))) return; })` cleanly swallows expected user-interrupted cancellations without hiding real runtime faults. In addition, setting `DEFAULT_MAP_ID = '9e6b48a5b3653026f9d7556d'` ensures that fallback map instances without `VITE_GMP_MAP_ID` env overrides render with the shared cloud-styled dark map theme.
Evidence: Updated `demos/real-world-reasoning-agent/src/shell/MapCanvas.tsx` and `src/lib/config.ts`, verified 70 passing test suites (577 tests), clean build and gateway smoke test.
Use next time: Always attach `.catch()` handlers to `gmp-map-3d` camera animations to prevent noisy browser console rejections when users pan or trigger new map transitions mid-flight.

## 2026-08-17 - Cost-based daily rate limiting with context caching discount preserves multi-turn allowances and caps spend accurately

Context: Transitioning the gateway from naive call/token caps to exact cost-based daily spending ceilings ($0.60/user/day, $5.00/global/day) for Gemini demo apps.
Learning: Naive token counting penalizes multi-turn interactive agents because each turn re-sends prior turns as prompt tokens. In reality, Gemini provides context caching discounts (~75% off cached input tokens: $0.025/M vs $0.10/M tokens), making multi-turn chat 4x cheaper than fresh prompts. Tracking spending in micro-dollars ($\mu\$$) with pricing tiers for uncached input ($0.10/M), cached input ($0.025/M), output/reasoning ($0.40/M), images ($0.03/image), and video ($0.20/video) enables generous multi-turn usage without increasing server operating cost. Post-request delta reconciliation accurately refunds over-estimated reservations and charges true API cost based on `usageMetadata.cachedContentTokenCount`.
Evidence: Implemented `calculateGeminiCostMicros` and `extractGeminiUsageAndCost` in `gateway/lib/rateLimit.js`, integrated across `realWorldReasoning.js`, `hairstyleAi.js`, `infographicAgent.js`, and `contactSpam.js`, verified with unit test suites (169 passing gateway tests).
Use next time: In LLM gateways, always dimension quotas around real API cost and incorporate caching discounts so multi-turn agent interactions are not prematurely throttled by unweighted token sums.

## 2026-08-17 - Dynamic hosted health tracking prevents upstream 429 stampedes on depleted server keys and routes directly to BYOK

Context: Handling depleted server-side Gemini prepayment credits / quota across `real-world-reasoning-agent`, `infographic-agent`, and `hairstyle-ai-studio`.
Learning: When a Google Cloud project with attached billing runs out of prepayment credits, upstream Gemini API calls immediately fail with 429 `RESOURCE_EXHAUSTED` / `prepayment credits are depleted` without falling back to free tier. In an interactive web application, repeatedly forwarding requests to upstream triggers thundering-herd errors, browser abort exceptions, and delayed error rendering. Tracking hosted health in gateway memory with a short cooldown window and proactive failure recording allows `/capabilities` and `/quota` to immediately signal degraded hosted service, short-circuit hosted requests with HTTP 503 `FREE_TIER_UNAVAILABLE` before hitting upstream, and guide users directly into a 1-click BYOK flow with their own free Google AI Studio keys.
Evidence: Implemented `recordHostedGeminiFailure`, `isHostedGeminiHealthy`, and `recordHostedGeminiSuccess` in `gateway/lib/rateLimit.js`, wired across `realWorldReasoning.js`, `hairstyleAi.js`, and `infographicAgent.js`, with passing unit test suites across `gateway` (162 tests) and `real-world-reasoning-agent` (577 tests).
Use next time: In multi-tenant or shared-allowance AI gateways, always decouple hosted credential health from server environment presence, track dynamic upstream failure states, and provide frictionless client BYOK paths when shared allowances are exhausted.

## 2026-08-17 - Fail-fast rate-limit handling prevents streaming retry cascades and aborted transitions in interactive AI apps
 
Context: Debugging Gemini 429 / prepayment credit depletion errors in `demos/real-world-reasoning-agent` and `demos/infographic-agent`.
Learning: Treating rate-limit (429), quota exhaustion, or prepayment credit depletion errors as transient stream errors causes retry loops with exponential backoff (>24s), leading to aborted React transition promises (`AbortError: Transition was skipped`) and frozen UI states. Checking for rate limits before retrying and immediately failing fast allows the UI to instantly display actionable feedback and pop the BYOK modal. On the gateway proxy layer, hosted 429 responses should be normalized to HTTP 503 `FREE_TIER_UNAVAILABLE` so clients can unambiguously distinguish shared allowance depletion from personal key quota issues.
Evidence: Unit tests in `demos/real-world-reasoning-agent` (`src/ai/engine.loop.test.ts`, 577 tests) and `gateway` (`gateway/test/infographicAgent.test.js`, 161 tests) verified zero retries and immediate BYOK modal triggers on rate limits.
Use next time: In client streaming engines, always explicitly exclude rate limits, quota exhaustion, and credit depletion from retry loops (`isRetryableStreamError(err) { if (isRateLimitError(err)) return false; ... }`).

## 2026-08-17 - Gemini Interactions REST API requires generation_config.thinking_level and demo app CSP alignment

Context: Serving `infographic-agent` and `hairstyle-ai-studio` behind the gateway with Gemini 3.7 Flash thinking levels and Google Fonts typography.
Learning: The Gemini Interactions REST API (`Api-Revision: 2026-05-20`) expects thinking levels in `generation_config: { thinking_level: 'low' }` (with lowercase value string), not a top-level `thinking_config` property. Sending `thinking_config` at the root payload results in HTTP 400 `Unknown name "thinking_config"`. In addition, workspace demo apps loading external fonts or stylesheets require `"csp": "maps"` in `apps.json` so the gateway issues the permissive `CSP_MAPS_DEMO_DIRECTIVES` header rather than the strict default CSP.
Evidence: Updated `gateway/lib/infographicAgent.js` and `gateway/lib/hairstyleAi.js` with passing unit tests (`gateway/test/infographicAgent.test.js`, `gateway/test/hairstyleAi.test.js`), and verified clean local builds and smoke tests across all apps.
Use next time: When constructing REST payloads for the Gemini Interactions API, nest thinking level inside `generation_config` as lowercase string (`'low'`, `'high'`, `'minimal'`), and configure `"csp": "maps"` in `apps.json` whenever a demo loads Google Fonts or Google Maps Platform assets.

## 2026-08-17 - HTML comment stripping in static site generator prevents internal linter annotation leaks

Context: Using `<!-- lint-ignore -->` annotations in markdown source files to satisfy repository voice linters when quoting flawed copy, AI slop examples, or citations.
Learning: Zero-dependency markdown-to-HTML parsers that treat block elements naively will wrap standalone HTML comments in `<p>` tags, leaking internal linter annotations into reader-facing HTML and markdown mirrors. Pre-processing markdown lines to skip HTML comment blocks (`<!-- ... -->`) before paragraph and blockquote tokenization guarantees clean public HTML output while retaining developer-facing linter directives in source markdown.
Evidence: `markdownToHtml` and `writeMarkdownMirror` in `portfolio/build.mjs` updated with unit test coverage in `portfolio/test/build.test.mjs` (45 passing tests). Verified zero `lint-ignore` leaks across all 32 generated pages.
Use next time: In custom SSG pipelines, always strip HTML comment delimiters before paragraph aggregation, or explicitly ignore them in AST tokenizers.

## 2026-08-17 - Dual-tier BYOK architecture with automatic modal triggering prevents rate-limit dead ends

Context: Integrating multi-app Gemini demos (`hairstyle-ai-studio`, `real-world-reasoning-agent`, `infographic-agent`) behind a shared Node gateway with strict 24-hour circular bucket rate limits.
Learning: When users hit hosted daily limits (429 or quota exhaustion), static error alerts cause dead ends and bounce rates. Centralizing BYOK trigger state in app-level stores/hooks to automatically open the personal API key modal (while preserving pending user inputs) transforms a rate-limit error into an immediate onboarding path. Validating keys client-side via a zero-generating proxy route ensures bad keys are caught before retrying work.
Evidence: All demo apps (`demos/hairstyle-ai-studio`, `demos/real-world-reasoning-agent`, `demos/infographic-agent`) automatically open the key dialog on 429 status codes with 100% test coverage and zero build regressions.
Use next time: For any rate-limited hosted AI demo, always pair 429 responses with an automatic, non-destructive BYOK modal popup and key-validation check.

## 2026-08-17 - Sliding window rate limiting with circular bucket ring buffers for multi-dimensional token and call quotas
 
Context: Implementing strict 24-hour rolling call and token limits (100 calls / 100k tokens per user, 1,000 calls / 1M tokens globally) for all hosted Gemini API endpoints behind the Node gateway without adding npm dependencies.
Learning: Fixed-window rate limiters reset abruptly at boundaries, enabling 2x burst abuse across window edges. A circular ring buffer (288 x 5-minute buckets) computes exact rolling 24-hour totals in O(1) operations with zero garbage collection overhead and minimal memory footprint. Pre-request token reservation combined with post-response token reconciliation via `extractGeminiTokenUsage` accurately meters actual prompt/completion token counts across both unary and streaming SSE responses.
Evidence: Unit test suite (`gateway/test/rateLimit.test.js`) and end-to-end smoke tests (`scripts/smoke.mjs`) verified per-user call/token limits, global call/token limits, rolling 24-hour sliding window expiration, token refunds on upstream failure, and token reconciliation across standard JSON and SSE streams with 148 passing tests.
Use next time: Use `CircularBucketRateLimiter` and `extractGeminiTokenUsage` when metering external AI APIs that require multi-metric (call + token count), dual-tiered (user + global), rolling-window enforcement.

## 2026-08-17 - Calibrating Gemini 3.7 Flash thinking levels across orchestration vs bounded task workers

Context: Upgrading demo agent architectures across the repository from `gemini-3.6-flash` and `gemini-3.5-flash-lite` to `gemini-3.7-flash`.
Learning: A single model family (`gemini-3.7-flash`) can efficiently serve as both orchestrator and low-latency utility worker when thinking levels are explicitly calibrated: `HIGH` thinking for multi-step tool orchestration and copilot planning, `LOW` thinking for multimodal evidence and vision analysis, and `MINIMAL` thinking for latency-critical formatting, suggestions, and voice STT transcription. Replacing Flash Lite with Flash at minimal thinking eliminates model fragmentation without sacrificing turnaround latency.
Evidence: All unit and proxy tests passed across `demos/real-world-reasoning-agent` (573 tests) and `gateway` (141 tests), with valid model allowlisting and thinking level parameters verified in both JS SDK (`ThinkingLevel`) and raw REST JSON bodies (`thinking_config: { thinking_level: 'LOW' }`).
Use next time: When configuring `gemini-3.7-flash`, explicitly route thinking level based on task complexity rather than maintaining separate model IDs for simple tasks vs orchestrators.

Context: Running parallel local model inference (Gemma 4 31B Dense and Gemma 4 26B-A4B MoE) for background editorial review, critique, and copyediting subagents across multiple Field Notes.
Learning: While model training must remain strictly sequential due to gradient state and backward-pass memory footprint, local inference can run concurrently within calibrated memory budgets on Apple Silicon unified memory: up to 4 concurrent processes for the smaller / MoE model (26B-A4B / ~4B active) and up to 2 concurrent processes for the dense model (31B Dense). Exceeding these bounds risks Metal context thrashing and unified memory eviction.
Evidence: Calibrated memory allocation on Apple Silicon Metal allows 2 concurrent 31B Dense inference workers (~18GB unified memory per worker) or 4 concurrent 26B-A4B MoE workers (~15GB unified memory per worker) without Metal GPU context drops or kernel stalls.
Use next time: When dispatching parallel local voice subagents, limit concurrent workers to 4 for MoE models and 2 for Dense models. Keep fine-tuning runs strictly sequential.

## 2026-08-16 - Dense 31B vs MoE 26B-A4B: Full-parameter LoRA reduces echo and repetition at the cost of 3x inference latency

Context: Evaluating SFT LoRA adapters fine-tuned on Ryan's 221-example voice dataset across two base architectures: sparse Mixture of Experts (Gemma 4 26B-A4B, 4B active params/token) vs dense (Gemma 4 31B, 31B active params/token).
Learning: SFT LoRA adapting all layers of a Dense 31B model integrates complex, diffuse writing style constraints significantly better than sparse expert routing on small (<500 example) datasets. Dense 31B achieved 100% fact retention (`G-FACT-KEEP`), zero repetition loops (`G-LOOP`), 55% fewer verbatim echoes (`G-ECHO`), and a 35% clean item pass rate (vs 25% on MoE), with total errors dropping from 56 to 39. However, token generation latency on Apple Silicon Metal was ~3x slower (8.1s vs 2.5s per item) due to computing all 31B weights per step.
Evidence: On the 48-item held-out evaluation suite (`experiment/voice-ft/eval/heldout.jsonl`), `round6_dense` scored 17/48 (35% clean, 95% CI 23–50%) vs `round6_dynamic` (MoE) 12/48 (25%). `G-ECHO` errors dropped from 11 to 5, `G-EDIT-PRESERVE` rose from 60% to 87%, and `G-FACT-KEEP` scored 100% (11/11).
Use next time: For asynchronous background editorial reviews, critique, and high-fidelity copyediting where quality and fact retention outrank speed, select the Dense 31B adapter (`adapters/gemma-4-31b-ryan-voice-v6`). For real-time CLI completions and interactive headline drafting, use the MoE 26B-A4B adapter (`adapters/gemma-4-26b-a4b-ryan-voice-v6`).

## 2026-08-16 - Surgical edit pairs and fact preservation anchor task boundaries in voice LoRA fine-tuning

Context: In early fine-tuning rounds (R1–R5), LoRA adapters over-generalized the `[Task: Edit]` tag as an instruction to generate entirely new prose from scratch, often dropping technical nouns, exact latencies, percentages, and dollar figures (`G-EDIT-PRESERVE`, `G-FACT-KEEP`).
Learning: Without explicit surgical edit examples in the training distribution where 70–95% of factual content is preserved while only sentence structure and passive boilerplate are changed, the model treats style adaptation as wholesale content regeneration. Adding micro-pairs that preserve numbers, metrics, and entity names while fixing voice tells anchors the model to true copyediting behavior, lifting Draft and Edit task fidelity without mode collapse.
Evidence: Round 6 added 24 surgical edit, negative grounding, and length-constrained micro-pairs to the training set (`scripts/generate-ft-dataset.py`). When evaluated across the 48-item held-out suite (`experiment/voice-ft/eval/heldout.jsonl`), Draft task clean pass rate doubled to 50% (4/8 items clean) and zero-shot fact retention reached 91% (`G-FACT-KEEP`).
Use next time: When fine-tuning for voice and editing, always include dedicated surgical edit pairs where specific numbers, technical nouns, and URLs are explicitly preserved across the input/output pair.

## 2026-08-16 - Apple Silicon unified memory exhaustion and Metal kernel stalls under concurrent LoRA training

Context: Launching concurrent local QLoRA fine-tuning jobs for Gemma 4 MoE (26B-A4B) and Dense (31B) models on Apple Silicon (M4 Pro). Both jobs shared the single unified memory address space and Metal compute pipeline.
Learning: Apple Silicon's unified memory architecture allows rapid zero-copy GPU compute, but running two 20B+ parameter model training processes simultaneously causes aggressive unified memory competition (>55 GB allocated on a 64 GB system). This leads to severe Metal context thrashing, activation memory spikes, gradient instability/NaNs, and kernel panics. Training jobs and evaluations on Apple Silicon must be strictly serialized, with automated process pre-flight checks (`pgrep`) guarding execution.
Evidence: SFT training for MoE 26B-A4B and Dense 31B crashed with Metal driver resets when run concurrently; adding pre-flight locks (`scripts/run_r5_moe.sh`, `scripts/run_r5_dense.sh`) and codifying zero parallel training in `AGENTS.md` and `README.md` allowed MoE Round 5 to train cleanly to 300 iterations at 0.73 it/s and evaluate 48 held-out items without error.
Use next time: Always serialize local LLM training and evaluation on Apple Silicon. Add automated `pgrep -f "mlx_lm.lora|voice_eval"` guards before starting any training script.

## 2026-08-16 - A style-transfer edit fails in three directions, so one similarity score cannot grade it


Context: Round 4 of the local voice tune produced six held-out outputs that all carried the
voice and five of which failed on judgment. The most instructive failure was an "edit" that
returned the input under a `## The result` heading. Any grader built on a single
similarity-to-source number would have scored that output either perfectly (high similarity
means the facts were preserved) or terribly (low similarity means the voice changed), and
either reading is wrong for the same output.
Learning: An edit has to sit inside three bounds at once, and they pull against each other.
Below `min_change` it did nothing. Below `min_preserve` it threw the facts away. Above
neither, but with a `must_remove` term still present, it moved words around and missed the
brief. The three constraints also interact: a brief that says "drop *pleased to announce*"
will, if implemented naively, demand that "pleased" be preserved by the coverage floor. The
`must_remove` terms have to be stripped from the source before coverage is computed. A
fourth bound, `max_change`, catches the opposite failure of rewriting prose that was fine.
Report the checks individually and never average them: the moment there is one number, the
tuning optimises for the number.
Evidence: `scripts/voiceeval/graders.py` implements `G-EDIT-DELTA`, `G-EDIT-PRESERVE`,
`G-EDIT-TARGET`, and `G-EDIT-RESTRAINT`. `scripts/test/voiceeval_test.py` pins all four to
the real round-4 outputs in `experiment/voice-ft/eval/results/round4_results.json`; 52 tests
pass. Re-grading round 4 offline reports 1/6 clean with a 95% Wilson interval of [3%, 56%],
which is the honest width of a six-prompt claim.
Use next time: When grading a transform rather than a generation, enumerate every direction
the transform can fail before writing a threshold, and write a restraint case per check that
must not fire. Half the tests in this suite exist to stop a grader firing on good output.

## 2026-08-16 - A held-out set generated by the training pipeline is not held out

Context: `scripts/generate-ft-dataset.py` regenerated `experiment/voice-ft/eval/prompts.jsonl`
on every run, from the same corpus and the same templates as the training split. Four rounds
of results were reported against it. Separately, the generator compared `content_type ==
"talk"` against a corpus that labels talks `"talks"`, so the Present task produced zero
training examples while the README claimed four, and Present prompts were being evaluated
against a model that had never seen the task.
Learning: Two failure modes hide in a deterministic dataset generator, and neither shows up
as an error. First, if the generator also writes the eval file, the eval set is a function of
the training set and measures memorisation. The eval file has to be owned by a different
process and the generator should only ever be allowed to *check* it. Second, a category
filter that silently matches nothing produces a plausible dataset with a hole in it; the
per-task counts have to be asserted, not printed. Verify held-out status mechanically with
n-word shingle overlap rather than by inspection.
Evidence: The generator no longer writes to `eval/`; it loads `eval/heldout.jsonl` and exits
non-zero on overlap. `python3 scripts/generate-ft-dataset.py` now reports 221 examples across
all six tasks including 8 Present, and confirms no 8-word phrase is shared with the 48-item
held-out suite. `npm run eval:leakage` runs the same check standalone.
Use next time: Never let a dataset generator write its own test set. Assert per-category
counts in the generator so a filter that matches nothing fails loudly.

## 2026-08-16 - Verify a citation offline first, and never let an unreachable link pass

Context: Round 4 cited `arxiv.org/abs/24606.24282`, which does not exist. Building the
resolver surfaced a design question: what should the check do when the network is unavailable,
or when a real DOI returns 403 because the publisher blocks bots? `doi.org/10.1145/3597503.3639180`
resolves 403 from this environment and 200 from a browser.
Learning: Format validation catches most fabrications with no network at all. arXiv IDs are
`YYMM.NNNNN`, and `2460` is not a month, so the round-4 invention fails on arithmetic. Build
that layer first, because it is deterministic, instant, and works in CI. For the online layer,
the verdicts must be asymmetric: 404 and 410 mean `invented` and fail the run; a timeout, DNS
failure, or 403 means `unknown` and warns. A link must never be marked `ok` because the check
could not run, and it must never be marked `invented` because a server was rude. Cache
resolutions to disk so re-grading an old results file does not re-hammer the network.
Evidence: `scripts/voiceeval/citations.py`. Offline, `check_format` rejects `24606.24282`,
future-dated IDs, and impossible months while accepting `2510.13939`. Online,
`arxiv.org/abs/2510.13939` and `ryanbaumann.dev/writing/` resolve 200, a nonexistent path
returns 404 and errors, and the bot-blocked DOI reports `unknown`. `npm run eval:citations --
--file <path>` runs it over any markdown draft.
Use next time: Run `npm run eval:citations -- --file <post>` before publishing anything with
external references, and treat `unknown` as "go look yourself", not as a pass.

## 2026-08-15 - Completion-only loss masking and micro-pair slicing optimize local MLX voice tuning

Context: Iterating through 4 rounds of local QLoRA fine-tuning for Gemma 4 26B-A4B (4-bit OptiQ, Apple M4 Pro 48GB). In Round 1, full-sequence loss caused the model to memorize and regurgitate system prompts and input prompt tags (`[Task: Edit]...`) on zero-shot tasks, while full-length essay drafts (>2048 tokens) pushed peak memory to 36.8 GB. In Round 2, over-training (7 epochs) caused token repetition loops on open-ended headline/presentation tasks.
Learning: Local voice fine-tuning requires three architectural optimizations: (1) `--mask-prompt` must be enabled so cross-entropy loss gradients are computed exclusively on the assistant's voice tokens, preventing prompt template memorization; (2) bounding drafts at section boundaries and slicing full sections into paragraph-level micro-pairs (100–250 words) avoids sequence truncation and cuts peak memory from 36.8 GB to 23.8 GB while expanding the dataset from 159 to 218 rich pairs; (3) the optimal training budget for personal voice adaptation is 1.5 to 2.5 epochs (~100–150 iterations with grad accumulation), preserving lyrical fluidity without mode collapse.
Evidence: `scripts/generate-ft-dataset.py` was updated with paragraph-level micro-pairs (218 total samples). Round 4 fine-tuning (`task-434`) converged smoothly with masked prompt loss, zero sequence truncation, and peak memory of 24.5 GB on Apple Silicon Metal. The newly built `/voice-studio/` app verifies blind evaluation, real-time stylistic rhythm analysis, and 1-click dataset export with 20/20 passing smoke tests.
Use next time: Always enable `--mask-prompt` in `mlx_lm.lora` for instruction/voice tuning. Slice training corpora into focused paragraph-level transform pairs ($\le 850$ words) to keep memory <25GB and train for $\le 2.5$ epochs.

## 2026-08-15 - Factual preservation in voice fine-tuning prevents metric hallucination

Context: Fine-tuning Gemma 4 26B-A4B locally on Apple Silicon Metal via MLX for personal writing voice. The previous Vertex AI run (117 examples) resulted in the model repeatedly hallucinating specific numbers (40%, 20%, 15%) when prompted on generic editing tasks with zero numbers, because target training pairs extracted from published case studies contained real metrics while their synthetic corporatized prompts lacked them. Additionally, 27 copies of an identical 3-bullet critique response caused rigid mode collapse on diagnostic tasks.
Learning: Voice fine-tuning must maintain strict factual alignment between input prompts and target outputs: an edit task must only transform register, tone, active voice, and cadence while strictly preserving the numbers and facts of the source text. When synthesizing input/output pairs, diversify input styles (passive corporate, messy voice memo dictation, academic thesis structures, hype announcements) and make critique responses dynamically diagnose specific failure modes rather than repeating static templates.
Evidence: `scripts/generate-ft-dataset.py` was refactored with clean prose extraction, 5 distinct input corruption modes, context-tailored critiques, and demo-first presentation outlines, expanding the dataset to 159 examples (144 train, 15 val). QLoRA fine-tuning on Apple Silicon (`mlx_lm.lora`) with Gemma 4 26B-A4B (4-bit, r=16, 16 layers) converged from an initial validation loss of 11.905 down to ~1.2-1.3 train loss on Metal GPU.
Use next time: When building voice-tuning datasets from an author's corpus, test that unprompted metrics in input prompts do not produce invented numbers in edit targets. Use varied corruption strategies and filter out non-prose elements (tables, code blocks) before creating edit pairs.

## 2026-08-14 - Local Gemma 4 MLX reviews catch abstract rhetorical openings
 
Context: Reviewing portfolio writing with the base Gemma 4 26B-A4B model steered by a
system prompt, running locally via MLX on Apple Silicon. This is not the fine-tuned
adapter: `scripts/local_gemma.py` calls `mlx_lm.load()` with no `adapter_path`, so the
voice comes entirely from `SYSTEM_PROMPT`. The tuned `ryan-voice-gemma-4-26b-v1` adapter
lives on Vertex AI and has never run on this laptop.
Learning: Automated voice review reliably catches the subtle shift where a post slips
from authentic builder narrative into essay-style rhetorical questions and academic
headers (like "## The hypothesis", "## The test"). Replacing these with immediate
friction and result-led framing keeps the tone direct and grounded.
Evidence: Gemma 4 identified that `fine-tuning-was-the-easy-part.md` opened on a
hypothetical platform question rather than the Place Details billing shock, and that
`builder-platforms-grow-by-owning-the-agent-loop.md` opened on a prediction rather than
developer friction in an agent session. Both rewrites passed `npm run check:content` with
0 errors and 0 warnings.
Use next time: Run `./scripts/gemma-local.sh review <file>` during maker/checker review
passes on new Field Notes before publication.

## 2026-08-13 - Fine-tuning Gemma 4 MoE (26B-A4B) on Vertex AI and VRAM sizing for unquantized vLLM serving

Context: Fine-tuning Gemma 4 for voice transfer across 5 task types (Draft, Edit, Critique, Headline, Present). The dense 31B model repeatedly hit regional GPU capacity ceilings (Code 8) across all regions (`us-central1`, `us-west1`, `global`, `europe-west4`), while 26B-A4B MoE SFT succeeded in `us-central1`. During serving deployment, vLLM threw `torch.OutOfMemoryError` on 24GB (L4) and 40GB (A100) before succeeding on 80GB (A100 80GB).
Learning: (1) When dense 31B models hit regional capacity exhaustion during peak hours, switching to MoE architectures (like 26B-A4B with 4B active parameters) dramatically improves scheduling availability on Vertex AI. (2) Unquantized vLLM serving for 26B MoE models loads all expert weights into memory during initialization (~38 GiB VRAM), so serving requires an 80GB GPU (`a2-ultragpu-1g`, `NVIDIA_A100_80GB`) rather than a 24GB L4 or 40GB A100. (3) Fine-tuned models conditioned with a system prompt at training time require the system prompt at inference time; omitting it causes token repetition loops.
Evidence: SFT tuning job `3148119227337015296` succeeded in `us-central1`; endpoint deployment on `a2-ultragpu-1g` passed health checks and executed all 20 held-out evaluation prompts at ~8s per prompt; `scripts/ryan_voice.py` provides on-demand spin-up and teardown to eliminate idle GPU costs.
Use next time: For open-model fine-tuning on Vertex AI, prefer MoE models for scheduling resilience, allocate 80GB VRAM for unquantized 26B+ serving, always include training system prompts in inference payloads, and script explicit endpoint spin-down after evaluations.

## 2026-08-07 - Correcting the proof must not replace the article's thesis


Context: The evidence pass on “Fine-Tuning Was the Easy Part” correctly removed
fabricated scores, a wrong billing claim, and an evaluator that never ran. It
also turned the entire essay into an eval audit and dropped Ryan's actual
argument about runtime context, learned weights, and the distribution problem
for developer platforms.
Learning: Freeze the narrative contract before a forensic rewrite: one sentence
for the thesis, the distinction the reader must retain, and the framework that
makes it actionable. Unsupported proof can be removed without amputating the
idea it was supposed to support.
Evidence: Ryan's review explicitly restored the weight-versus-context thesis
and the distribution pyramid. The revised Note keeps every evidence correction,
uses Harvey's held-out result as the public example that post-training can work,
and labels traces and benchmarks as possible distribution inputs rather than
guaranteed training adoption.
Use next time: Before replacing more than one section, compare the candidate to
the original narrative contract. If the proof disappears, rebuild support; if
the thesis or decision framework disappears, stop and restore it before the
voice pass.

## 2026-08-07 - Reader-facing counts must follow the executable source

Context: The evidence ledger and an older learning still described the Loop
Engineering package as a 16-case specification after the live case file and
structural checker had moved to 17.
Learning: Treat prior audits as leads, not current evidence. Reader-facing
counts should be derived from the live source and its executable check in the
same review pass that publishes the claim.
Evidence: `agent-scripts/coding-agent-loop/evals/cases.md` defines C01–C17,
split into C01–C13 for development and C14–C17 for selection, and
`agent-scripts/coding-agent-loop/evals/check.sh` passes only when it finds all
17 cases.
Use next time: Recount mutable artifacts at publication time and run the check
that enforces the count; do not carry a number forward from a ledger, audit, or
older prose without following it back to source.

## 2026-08-07 - An evidence correction can still fail the voice review

Context: The first rewrite of the fine-tuning Field Note corrected unsupported claims but presented the result as an audit table, glossary, diagnostic JSON, pseudo-rubric, numbered rerun plan, and two outside case studies. Ryan identified the copy and formatting as AI-generated rather than his voice.
Learning: Claim integrity and voice need separate review passes. Evidence should usually enter a Field Note through the one or two artifacts that changed the author's mind; stacking every available explanatory format turns a personal technical story into a report. Generated visuals have the same boundary: generation context belongs in the prompt record, not on the canvas.
Evidence: Two independent copy reviews both identified the format stack as the dominant AI tell and converged on the same repair: follow the wrong nursery answer key and the evaluator's `pass` statement, explain the trace through that case, and cut the table, glossary, null object, rubric, checklist, and unrelated detours. Ryan's direct review independently identified the voice failure and visible prompt context.
Use next time: Run claim verification first, then a separate de-scaffolding pass against a hand-written voice calibrator. Keep a table, list, or diagram only when it makes a real relationship easier to understand than the narrative; remove source labels, dates, and generation notes from graphics unless they are the evidence.

## 2026-08-07 - A linked eval is not evidence until its execution path computes the claim

Context: The fine-tuning Field Note reported four exact-match improvements and linked the public evaluator as proof. The evaluator never invoked its constructed model commands; it skipped the loop and printed four hard-coded values. The same audit found ten cases instead of the claimed 300 plus 100-case holdout, no dataset split, no executable output grader, and a billing-tier answer key contradicted by current Places API documentation.
Learning: Review the execution path behind every eval claim. A credible result needs disjoint development and held-out cases, retained raw outputs, scores computed from those outputs, pinned model and harness configuration, and an answer key checked against the current contract. A repository link, falling training loss, rubric description, or polished chart cannot substitute for those artifacts.
Evidence: `evals/field-mask/test_mlx.py` labels the loop “Mocking evaluation,” executes `pass`, and assigns the published values directly; `dataset.v1.json` contains ten cases; both `train_mlx.py` and `test_mlx.py` select the same eight eligible cases; and the official Places field table classifies `displayName` as Pro while the first case labels it Essentials. The rewritten Field Note removes the unsupported scores and states the gaps directly.
Use next time: Before publishing a model or agent delta, run from the cited entry point, follow each value back to retained outputs, verify the split and ground truth, and block the claim if any score comes from a constant, fixture, stub, or unversioned off-repository run.

## 2026-08-04 - Fine-tuning a unified multimodal model in MLX requires stripping tower parameters and remapping language keys

Context: Attempting to fine-tune `google/gemma-4-E4B-it` via `mlx-lm` failed repeatedly. The model weights declared 42 attention layers, but `mlx-lm` threw a parameter mismatch because the architecture (`gemma4_unified`) was unsupported, and the weights were deeply nested inside `language_model.model.*` alongside `vision_tower` and `audio_tower` parameters.
Learning: MLX (`mlx-lm`) does not natively support unified multimodal checkpoints for text-only LoRA tuning out of the box. To fine-tune the text backbone of a unified model, you must patch the architecture definition (e.g. duplicating the text model structure but preserving SwitchGLU routing), adjust KV cache assumptions, and rewrite the `sanitize()` function to strip `vision_tower` and `audio_tower` keys while elevating `model.language_model.*` back to `model.*` before loading the `safetensors`.
Evidence: A subagent cloned `mlx-examples`, implemented `mlx_lm/models/gemma4_unified.py`, stripped the tower keys in the load step, and successfully completed 100 iterations of LoRA fine-tuning on the `field-mask` dataset with a final validation loss of 0.028.
Use next time: When fine-tuning a multimodal or unified model on a text-only dataset using MLX, do not rely on default architecture mappers. Inspect the `.safetensors` keys, write a custom sanitize function to strip non-text towers, remap the language keys to the root state dict, and run from a local source clone.


## 2026-08-04 - TypeScript 7.0 removes baseUrl and requires relative path mappings in tsconfig.json

Context: Dependabot bumped TypeScript to 7.0.2 in `demos/real-world-reasoning-agent`, breaking `tsc --noEmit` due to removed `baseUrl` and non-relative path aliases.
Learning: TypeScript 7 deprecates/removes `baseUrl` in compilerOptions and enforces relative paths starting with `./` in `paths` mappings (e.g. `"@/*": ["./src/*"]`). Also in Vitest 4, `vitest.config.ts` deprecated `poolOptions`.
Evidence: Updated `tsconfig.json` and `vitest.config.ts` in `demos/real-world-reasoning-agent` and confirmed `npm test && npm run build` passed cleanly.
Use next time: When upgrading projects to TypeScript 7 or Vitest 4, remove `baseUrl`, adjust path alias prefixes to `./`, and update pool settings in vitest configuration.

## 2026-07-27 - Per-user free tiers still need a global spend ceiling

Context: IP allowances limited ordinary use but an IP-rotating caller could
still spend the hosted provider key, and imported Maps proxy limits were sized
for load testing rather than a public portfolio.
Learning: Separate per-user fairness, process-wide daily spend ceilings, and
provider-side quotas. Pin exact upstream routes and methods; same-origin checks
alone are not caller authentication.
Evidence: Hairstyle now has per-IP and global hosted-generation caps; Real
World Reasoning has separate request classes, daily Maps/Gemini ceilings,
bounded limiter memory, exact route/method allowlists, and focused regressions.
Use next time: Define the maximum affordable provider usage before exposing a
public proxy, then make cloud quotas the hard backstop for restart and botnet
scenarios.

## 2026-07-27 - A private-to-open-source migration needs explicit release provenance

Context: Real World Reasoning Agent was still private when its owner requested
that Fieldwork become the first-party open-source home. The public-import
command correctly refused to accept a false public-source confirmation.
Learning: Explicit owner authorization can release a reviewed snapshot without
changing the predecessor repository's visibility, but the boundary must remain
auditable: pin the exact commit, exclude Git history, environment and deployment
files, scan for credentials, record the source visibility and release authority,
and make the new repository the canonical public link.
Evidence: `demos/real-world-reasoning-agent/PROVENANCE.md` records private source
commit `68e8c34547066a984ccb97f5b587caeb97561ec1`; the pre-import scan found no
credentials; and the public tree excludes history, environment files, and
private deployment configuration.
Use next time: Never pass `--confirm-source-public` for a private source. Require
explicit release authority, a clean snapshot scan, and provenance that explains
the exception before public integration.

## 2026-07-27 - Hosted allowance and personal-key abuse limits are different controls

Context: Hairstyle AI Studio put every image request behind one five-per-hour
IP limiter. Entering a personal Gemini key therefore did not help: the gateway
rejected the request before it inspected which credential would pay for it.
Learning: Select and validate the credential before applying spend controls.
Hosted calls consume the shared daily allowance; valid personal-key calls
bypass that spend cap but retain a separate, generous site-abuse limiter.
Malformed personal keys fail closed instead of silently falling back. Provider
quota errors need a different code from local allowance exhaustion so the UI
can offer the right recovery.
Evidence: Gateway regressions cover five successful hosted image generations,
UTC reset metadata, failed-request refunds, personal-key bypass, malformed-key
denial, non-generating key validation, and distinct upstream quota responses.
Use next time: Model shared budget, provider quota, and gateway abuse as
separate policies, then test routing order across every credential source.

## 2026-07-27 - Buffer staging inputs need an explicit merge trigger

Context: The existing Buffer workflow could stage social copy only when a new
Field Note Markdown file was merged. A Lab release update had valid copy but no
Field Note, and local development intentionally had no Buffer credentials.
Learning: Keep external draft creation in the credentialed merge workflow, but
make one-off release copy a small, validated, reviewable repository artifact.
The workflow should stage only newly added files, create an editable draft, and
remain side-effect free on reruns.
Evidence: `docs/social-drafts/hairstyle-ai-studio-update.json` declares one
LinkedIn draft; `parseReleaseDraft()` bounds its channel and copy; the social
draft suite passes eight tests; and the merge workflow now watches that narrow
directory while retaining its first-attempt gate.
Use next time: For a non-Field-Note release update, add one exact-copy JSON file
under `docs/social-drafts/`. Do not put Buffer credentials in local files and
do not turn merge-time staging into automatic publishing.

## 2026-07-27 - A public Lab import still needs runtime and instruction-boundary adaptation

Context: Importing Hairstyle AI Studio with `labs:import` copied a valid public
snapshot, including its standalone Express server, Dockerfile, root-relative
PWA metadata, secret-based deployment docs, and nested `AGENTS.md`.
Learning: A snapshot import proves provenance, not deployment compatibility.
The monorepo still needs one owner for serving and APIs, namespaced routes,
subpath-safe metadata, and an instruction contract that describes the
integrated architecture. Leaving the nested instructions unchanged is worse
than leaving stale prose because future work will be routed back to deleted
runtime files and obsolete secret patterns.
Evidence: The imported source was pinned to
`9ea2c0f31e5e1d252220ede6731b655bf2fb8fba`. The completed adaptation registers
`/hairstyle-ai-studio/` and `/api/hairstyle-ai-studio/*` in `apps.json`, moves
Gemini calls to `gateway/lib/hairstyleAi.js`, updates the nested `AGENTS.md`,
and passes the app build, gateway tests, Labs validator, and repository smoke
path.
Use next time: After `labs:import`, audit runtime ownership, route namespaces,
base paths, public metadata, nested instructions, secrets, and unused build
artifacts before treating the snapshot as integrated.

## 2026-07-27 - Browser cancellation must cross the gateway boundary

Context: Hairstyle AI Studio's Cancel action aborted the browser `fetch`, but
the gateway created an independent 120-second Gemini request. The UI stopped
waiting while the visitor's upstream request and quota consumption could
continue.
Learning: In a same-origin proxy, cancellation is an end-to-end contract.
Combine the gateway timeout with a caller-disconnect signal and pass that
signal into the provider request; browser cancellation alone is not sufficient.
Evidence: The Hairstyle gateway now aborts its provider signal when the request
is aborted or the response closes before completion. A focused test verifies
that cancelling the caller signal aborts the Gemini interaction and returns
the internal cancellation status; all 113 gateway tests pass.
Use next time: For expensive or user-keyed proxy calls, test that client
disconnect reaches the provider fetch rather than only changing local UI state.

## 2026-07-26 - Repository-wide skill audits need a disposition ledger before prompt edits

Context: A request to use all Git history, `LEARNINGS.md`, and `CHANGELOG.md` to
improve every appropriate local skill was broader than the existing
one-behavior skill-improvement loop.
Learning: Comprehensive retrieval and bounded promotion are compatible. Audit
the full evidence set first, but give every candidate an explicit disposition:
already enforced, promote to a test, promote to a skill, retain as
documentation, stale/contradicted, or one-off. Freeze the behavioral scenarios
before editing, keep current code/tests and authoritative docs above old commit
messages, and record no-change decisions for already-complete or externally
maintained skills. An eval file is not evidence by itself; its ownership,
development/selection split, case IDs, and expectations need deterministic
validation.
Evidence: `docs/SKILL_EVIDENCE_AUDIT.md` covers all 350 reachable commits and 45
current learning entries. The same read-only Codex CLI scenario set was run
before and after the candidate edits with `LEARNINGS.md` and `CHANGELOG.md`
excluded. The candidate closed the seven recorded omissions while preserving
the three held-out portability/security behaviors. `npm run skills:improve` and
`node --test scripts/test/skill-improvement.test.mjs` validate the new eval
contracts. An independent read-only diff review then found that an
all-selection suite passed and a `null` eval crashed the validator; focused
regression cases now require development coverage and turn non-object entries
into findings.
Use next time: For a broad learning audit, inventory widely and edit narrowly.
Do not paste history into prompts, do not treat old contradictory fixes as
current truth, and do not call a directory of unvalidated cases a held-out
gate.

## 2026-07-26 - Agent-skill changes need a held-out gate, not a larger prompt

Context: The repository already recorded durable coding and delivery lessons in
`LEARNINGS.md`, while the portable Loop Engineering Coding Agent had a
structural checker and synthetic cases but no explicit selection split for
changing its prompt.
Learning: Treat the instruction document as a versioned candidate artifact.
Mine repository learnings narrowly, verify each against current evidence, turn
only recurring behavior into cases, and accept a bounded edit only after a
frozen held-out set improves with no safety regression. Keep transcript
harvesting opt-in and reviewable because task traces can contain sensitive data.
Evidence: `agent-scripts/coding-agent-loop/evals/cases.md` now freezes C01–C13
for development and C14–C17 for selection, requires recorded run configuration,
and covers repository-learning retrieval without granting the log instruction
authority. The `skill-improvement-loop` local skill and `npm run
skills:improve` add a deterministic pre-commit metadata gate; `bash
agent-scripts/coding-agent-loop/evals/check.sh` validates the 17-case contract.
The initial run found and corrected an absent responsive-design frontmatter
block and a portfolio-review adapter prompt that had drifted from its manifest.
Use next time: Before changing the coding-agent prompt, run a repeated baseline
and candidate trial with the same fixture and harness; record variance and
reject any candidate that fails a safety case or does not strictly improve the
held-out result.

## 2026-07-26 - Places UI Kit components require matching color-scheme and complete CSP image origins

Context: Auditing the `isochrones` demo for CSP compliance and Places UI Kit UI/UX consistency.
Learning:
1. `gmp-place-details` defaults to light mode unless explicitly styled with `color-scheme: dark` and dark theme variables (`--gmp-mat-color-surface`, `--gmp-mat-color-on-surface`, etc.), which caused it to render as a white box inside dark Google Maps InfoWindows.
2. Places API photos and reviewer avatars are served from `https://*.ggpht.com` in addition to `*.googleusercontent.com`. Omitting `https://*.ggpht.com` from `img-src` in `CSP_MAPS_DEMO_DIRECTIVES` blocked place details imagery under CSP.
Evidence: `demos/isochrones/test/place-details.test.js` updated and passing; `gateway/test/staticFiles.test.js` (104 tests) and `scripts/smoke.mjs` (18 tests) passing.
Use next time: When integrating Places UI Kit components (`gmp-place-details`, `gmp-place-autocomplete`), set `color-scheme: dark` and explicit `--gmp-mat-color-*` custom properties to match dark themes, and include `https://*.ggpht.com` in `img-src` for Places photos.

## 2026-07-26 - Maps 3D renderer and follow-camera route tracking requirements

Context: Adding Content-Security-Policy (CSP) headers to the Node gateway static file responses for demo applications like `strava-explorer`, `aqi-map`, and `isochrones`, alongside follow-camera route resume logic.
Learning:
1. Google Maps 3D renderer utilizes `blob:` and `data:` URIs for tiles, textures, and inlined icon fonts, plus dynamic script execution and Web Workers. Restricting `img-src` or `connect-src` without `blob:` produces a silently blank basemap without explicit network errors.
2. Comparing array values by value vs identity when storing smoothed path coordinates: `loadTourRoute` creates a smoothed copy of input coordinates (`smoothedRouteCoords`). Comparing `followCameraCoords !== routeCoords` was always true, causing `playFollowCamera` on resume to re-initialize and reset progress to 0. Storing `followCameraSourceCoords = routeCoords` preserves input reference identity.
Evidence: Gateway unit test suite (`npm test`) passes 94/94 tests, verifying policy host matching for `strava-explorer`, `aqi-map`, and `isochrones`. End-to-end gateway smoke suite (`npm run smoke`) passes 17/17 checks.
Use next time: When configuring CSP for Google Maps 3D/2D API applications, ensure `blob:`, `data:`, `worker-src`, and label font hosts (`https://*.gstatic.com`) are explicitly included. Always track input source references when transforming arrays for stateful animation engines.

## 2026-07-26 - Marker3DElement only draws three element types, and its collision default is not what "always visible" needs

Context: Making the Strava Explorer rider marker sport-aware (custom SVG per activity type) and stopping it from disappearing behind basemap labels during a tour.
Learning: Two Maps 3D constraints decide the whole implementation. (1) The `Marker3DElement` default slot ignores everything except `HTMLImageElement`, `SVGElement`, and `PinElement`, and the first two must be wrapped in a `<template>` before being appended - a bare `<div>` or an SVG appended directly is silently dropped, so custom artwork has to be built as an SVG string, parsed with `DOMParser`, and slotted through a template. (2) `collisionBehavior` defaults to `REQUIRED`, which only guarantees the marker is drawn; a colliding basemap label still wins the space. `REQUIRED_AND_HIDES_OPTIONAL` is the value that hides the optional label instead, and it pairs with `collisionPriority` to rank the app's own markers (rider 1000 > photos 100 > route endpoints 50). `sizePreserved: true` is separate again: without it the pin scales down with camera distance, which reads as "disappeared" long before collision does.
Evidence: Maps JS reference `developers.google.com/maps/documentation/javascript/reference/3d-map-draw` (retrieved via the GMP Code Assist REST endpoint) documents the slot restriction and both enum values; the marker-graphics sample uses the `DOMParser` -> `<template>` -> `marker.append(template)` sequence. Implemented in `demos/strava-explorer/src/activityIcons.js` (artwork as pure strings, unit-tested) and `src/gmp.js` (`svgTemplateFromMarkup`, `alwaysVisibleCollision`).
Use next time: For any custom 3D marker, build artwork as an SVG string, parse and slot it via `<template>`, and set `collisionBehavior`, `collisionPriority`, and `sizePreserved` together - treating any one of them as sufficient leaves the marker vanishing in some camera state. Keep the artwork in a DOM-free module so it can be rendered to a screenshot sheet and unit-tested without a map or an API key.

## 2026-07-26 - A CSP is only as good as the list of origins the app actually calls, and "it's a Maps demo" is not that list

Context: The per-app CSP work classified strava-explorer as a Google Maps Platform demo and gave it the Maps allowlist. The demo deployed and broke: connecting an account produced "Failed to fetch activities" from `demos/strava-explorer/src/strava.js`, because `connect-src` had every Google origin and no Strava one.
Learning: The app was classified by the framework it renders with, not by the origins it calls. The gateway proxies Strava OAuth and photos same-origin, which made "the Strava calls are behind /api" feel true, but the four read paths (athlete activities, activity detail, streams, photo metadata) go to `https://www.strava.com/api/v3` from the browser with the user's own token, and two image hosts load without the proxy. A CSP is a per-app allowlist of destinations, so it has to be derived from the app's outbound calls, not from a category the app belongs to.
Evidence: `grep -n "fetch(" demos/strava-explorer/src/strava.js` shows four calls to `STRAVA_API_BASE_URL` (default `https://www.strava.com/api/v3`) against two same-origin `/api/strava/*` calls; `src/index.js` sets the athlete avatar directly from Strava's photo CDN and `src/demoData.js` uses picsum.photos for the signed-out tour. Fixed with a `maps-strava` policy; the gateway tests now derive those origins from the demo source, and `scripts/smoke.mjs` asserts the served `connect-src` allows the API base found in the served bundle.
Use next time: When adding or changing a CSP for an app, enumerate its outbound calls from its own source (`grep` for `fetch(`, `.src =`, `new Image()`) and check each origin against the policy. Because third-party requests cannot be verified in a browser in this container (see the Chromium note below), that source-derived list is the verification — write it into a test so the next policy change has to keep it true.

## 2026-07-26 - A comment that names a platform default is a claim, and this one was wrong

Context: `gateway/server.js` justified its in-memory per-IP rate limiters with "On Cloud Run with max-instances=1 (the default for this portfolio) that's fine." Cloud Run's actual default is max-instances=100, and `deploy.yml` passed no instance cap at all.
Learning: The comment was not describing a configuration, it was asserting one that nothing enforced. Every limit it justified (private-demo auth brute-force, and the spend caps in front of Isochrones, Gemini, and Resend) silently became per-instance under load, and the same load that triggered an attack also scaled out the instances that diluted the defence. When a correctness argument depends on an external setting, the setting has to be pinned in the repo and the comment has to point at where it is pinned, or the argument is only true by luck.
Evidence: `gcloud run deploy` in `.github/workflows/deploy.yml` listed `--min-instances 0` and `--cpu-boost` and no `--max-instances`; Cloud Run's documented default is 100. Fixed by pinning `--max-instances 1` and rewriting the comment to say it is pinned in deploy.yml, not defaulted.
Use next time: When a comment says "the default is X," check whether the repo sets X. If it does not, either set it or delete the claim. Treat a security argument resting on an unpinned default as an open finding.

## 2026-07-26 - Do not let a security policy depend on display metadata

Context: Adding per-app Content-Security-Policy, the first implementation selected the relaxed Google Maps policy with `app.tags?.includes('google-maps-platform')`. It worked, and every test passed.
Learning: `tags` in apps.json is presentation metadata: it renders as card chips and feeds JSON-LD keywords. Anyone editing tags for wording, SEO, or tidiness would have silently changed a security policy, and nothing in the suite would have noticed. The fix was a dedicated `csp` manifest field plus validation in `scripts/validate-apps.mjs` that fails in both directions: an unknown value, and a Maps-tagged app that forgot to declare it. The general rule is that a security decision must read a field whose only purpose is that decision.
Evidence: `grep -rn "\.tags"` showed tags consumed only by card rendering (`portfolio/build.mjs`), JSON-LD keywords, and `toPublicApp`. Deleting `"csp": "maps"` from aqi-map now fails `node scripts/validate-apps.mjs` with an explicit message, verified by removing it and restoring it.
Use next time: Before keying behavior off a manifest field, grep who else writes it. If the field exists to be displayed, add a new one for the decision.

## 2026-07-26 - Chromium in this container cannot reach third-party origins, so browser CSP checks are only half a verification

Context: Verifying the new CSP by rendering pages and watching for violations, the giscus comments script reported a failed request on a note page, which looked exactly like a CSP block.
Learning: It was not CSP. Loading the same script from a page with no CSP at all also timed out, while `curl` fetched it successfully, because curl uses `HTTPS_PROXY` and the Playwright Chromium launched here does not. A failed third-party request in this environment is ambiguous by default, and reading it as a policy failure would have sent someone loosening a correct policy.
Evidence: `page.setContent('<html>…')` with no CSP, then injecting `https://giscus.app/client.js`, returned `timeout`; `curl https://giscus.app/client.js` returned 200. Same-origin assets and the Maps demo pages rendered clean.
Use next time: Before blaming CSP for a blocked third-party request, reproduce it on a page with no CSP. Verify third-party directives by inspecting the served header, and treat in-browser confirmation of external origins as unavailable here.

## 2026-07-25 - A hover state that borrows the focus ring's language removes an accessibility affordance

Context: `.card:hover` had grown to a 4px lift, a transparent border, a 2px accent ring, and two hardcoded `rgba(0,0,0,...)` shadow layers, against a design skill that specifies border accent plus a 2px lift and nothing more.
Learning: Judge a hover change against the other states it has to coexist with, not against its own screenshot. This ring was `2px solid` in the accent color at the same visual weight as `:focus-visible`, so a hovered card and a focused card became indistinguishable and the focus affordance stopped carrying information. Separately, a hardcoded black shadow is not scheme-neutral: it did real work on the warm light background and disappeared against the dark one, so the two schemes shipped different hover states, which is the concrete reason the skill bans hardcoded color in components.
Evidence: A rendered audit measured the focus ring at `2px solid rgb(59,130,246)` with `outline-offset: 3px` and reported the hovered card indistinguishable from the focused card in light mode. The same pass found `.card-thumb` cropping 16:9 art at `aspect-ratio: 16/10` and dark `--faint` (9.94:1) rendering brighter than `--muted` (7.93:1), inverting the three-step hierarchy.
Use next time: When changing an interaction state, render hover, focus, and active together in both schemes before keeping it. If a new state needs a shadow, add a token; a component that hardcodes black has already decided it only cares about one scheme.

## 2026-07-25 - The prose rules that held were the ones a regex could decide

Context: An audit graded `portfolio-writing` against every published entry. Rules that ban a pattern held at 100 percent across 22 files. Rules needing judgment did not, and the corpus was clean only because a person had been careful, with nothing to catch the next lapse.
Learning: Split a style guide by decidability, not by topic. Move every rule a regex can settle into a checker so review attention goes to claims, evidence, and rhythm, which no checker can grade. The split also makes disagreement cheap: a disputed finding is settled by editing one rule, not by arguing taste in a review thread.
Evidence: `npm run check:content` reported 0 errors and 3 warnings on 31 entries at introduction, and independently reproduced the audit's finding that one prescribed phrase had spread to four Field Notes. Its 10 regression cases are must-fail fixtures, not just happy paths.
Use next time: When a review keeps catching the same mechanical defect, add the rule and a failing fixture in the same change. Keep taste rules out of the checker; a warning is a prompt to look, not an instruction to obey.

## 2026-07-25 - A publication gate copied by hand drifts from the one the build uses

Context: An audit of the authoring loop found that `buildSocialDrafts` skipped any note without `draft: true`, while `portfolio/build.mjs` decides publication with `isPublished()`, which also honors a future `publishAt`. A note scaffolded with `--schedule` satisfied one gate and not the other.
Learning: When two code paths answer the same question about content state, one of them will be a paraphrase, and the paraphrase will be wrong for the case nobody tested. Derive the second answer from the first, or at minimum name the function it mirrors so the pair is greppable.
Evidence: `--schedule` writes `draft: false` with a future `publishAt`; staging fires only on `--diff-filter=A`, so the note published with no Buffer draft and no retroactive path to get one. `scripts/test/social-drafts.test.mjs` contained zero occurrences of `publishAt` before the fix.
Use next time: For any new content-state predicate, write the test for the scheduled case first. It is the state that exists only between two deploys, so it is the one the happy path never visits.


## 2026-07-25 - Vendoring a dynamically fetched skill turns a live source into stale weight

Context: The 2026-07-20 cleanup removed eight per-product Google Maps skills but left `google-maps-platform/references/index.json`, a local mirror of the GMP Skills Index whose entries still pointed at `../places-api-web-api/SKILL.md` and the other deleted directories. The skill's mandatory first action fetches that index over HTTP and loads sub-skills at runtime.
Learning: A skill that fetches its own references at runtime must not also be mirrored into the repo. The copy cannot be refreshed by the mechanism that owns it, so it ages into contradiction with the live source while still being the thing an agent reads first. Deleting the skills it indexed is not enough; the index itself is part of the mirror, and a stale index is worse than none because every URL in it resolves to nothing.
Evidence: `SKILL.md` cites only the remote gstatic URL; no file referenced the local mirror. Removing it left zero dangling references and changed no test.
Use next time: Before vendoring any skill, check whether it retrieves its own content. If it does, keep the entry point and delete everything it would fetch, and say so in the routing entry so the copies do not come back.


## 2026-07-25 - Prescribed example strings in a voice skill become the corpus's boilerplate

Context: A voice-fidelity audit compared `portfolio-writing` against every published entry. Rules that ban a pattern held at 100%; rules that supply a phrasing produced verbatim repetition.
Learning: An instruction that quotes an example inside a "vary this" rule will produce that example. Prohibitions transfer to a model; prescriptions get copied. Write prescriptive voice rules as meanings to convey, and reserve quoted text for what must never appear.
Evidence: "We are still learning what works" appears verbatim in four of nine Field Notes under a rule requiring varied phrasing; the skill's own named anti-pattern ("Activation says… Retention says…") shipped in `builder-platforms-grow-by-owning-the-agent-loop.md`. Zero em-dashes and zero hype adjectives appear anywhere in the corpus.
Use next time: When a voice rule needs an example, put it in a reference file marked as illustration, add a repetition check for any distinctive four-word phrase, and calibrate rhythm against in-repo files rather than an external URL the agent cannot fetch.


## 2026-07-22 - Theme-aware SVGs in `<img>` tags require explicit `color-scheme`

Context: The site uses SVGs that internally specify `@media (prefers-color-scheme: dark)` to handle light/dark modes. The HTML site has a manual toggle using `data-theme="light"` or `data-theme="dark"`. However, SVGs loaded via `<img>` tags were not respecting the manual `data-theme` toggle, remaining stuck on the OS-level system color scheme.
Learning: An SVG loaded via an `<img>` tag executes its internal media queries based on the host HTML element's explicit `color-scheme`. Injecting `color-scheme: light;` or `color-scheme: dark;` into the `html[data-theme]` CSS block automatically propagates the theme down to the embedded SVGs, bypassing the system theme and allowing them to respect the manual toggle without needing duplicate SVG files.
Evidence: Modified `html[data-theme="light"]` to include `color-scheme: light;` and `html[data-theme="dark"]` to include `color-scheme: dark;` in `portfolio/style.css`.
Use next time: Use explicit `color-scheme` properties on theme blocks to control internal `prefers-color-scheme` media queries of embedded SVG images.


## 2026-07-20 - local skills clean up: keep google-maps-platform, frontend-responsive-design, infographic-agent, and portfolio-* skills

Context: The repository had many local skills in `.agents/skills/` that were either globally available or redundant (such as specialized google maps subset skills).
Learning: Keep the repository's `.agents/skills/` directory focused. Keep only the primary Google Maps Platform skill (`google-maps-platform`), `frontend-responsive-design`, `infographic-agent`, and the repository-specific `portfolio-*` skills. Other generic or subset maps skills are handled globally.
Evidence: Removed 9 redundant skills (`geocoding-api-web-api`, `google-maps-environment-apis`, `google-maps-js-2d`, `google-maps-js-3d`, `maps-javascript-api-javascript`, `places-api-web-api`, `pollen-api-web-api`, `setup-local-environment`, `weather-api-web-api`) from `.agents/skills/` and updated `AGENTS.md` to reflect the change.
Use next time: Do not add or retain redundant, non-portfolio maps/api skills locally; rely on the global system-wide skills for general development tasks.


## 2026-07-20 - Field Note copy and image taste: cut AI tells, draft three, make art per-post

Context: A Field Note draft read as competent but generated. Ryan's specific corrections: too many "it's not X, it's Y" antithesis flips; the self-credit line "I lead the strategy and review the traces" is trite and inauthentic (he does not want it, in this or any post); openings should lead with the reader's stakes, not a personal scene; punchier and shorter beats thorough. Separately, the generated diagrams all looked identical because every post reuses the same numbered box-and-arrow flow template, with too much text.
Learning: For copy, hold the "not X, but Y" shape to at most two load-bearing uses (the title thesis and the one payoff line) and never as filler; never use "I lead the strategy and review the traces" or resume-bullet self-credit; open on the stakes; prefer cutting to polishing. To pick voice, write three genuinely distinct drafts (analytical, scene-led, staccato) and have an independent reviewer grade them 1-10 on authentic voice, rhythm, freedom from AI-isms, and punchiness, then the lead makes the final call. For images, draw bespoke low-text art per post (a distinct scene that carries one idea) instead of the shared flow template, so a post's visuals read as its own; keep the house chrome (grid, accent bar, theme vars) for family resemblance but change the central geometry. Encode custom art as a `CUSTOM` entry with a dedicated render function in `scripts/artifact-cards.mjs`, and remember to add it to the CLI `knownFiles` allowlist.
Evidence: "The Model That Picks Your Platform Doesn't Write the Code" was rebuilt this way: three drafts graded (analytical draft won 34/38), a one-decides-many-build asymmetry header and a descending-tier staircase inline replaced two templated flow diagrams. See `scripts/artifact-cards.mjs` `asymmetryDiagram`/`tierdropDiagram`.
Use next time: Run the three-draft grade for any headline Field Note, apply the reviewer's line fixes, and give each post at least one purpose-built visual instead of another flow card.


## 2026-07-20 - Social-card generation in remote agent sandboxes: shadow the Playwright browsers dir, do not reinstall

Context: Regenerating a Field Note social card with `node scripts/social-cards.mjs` in a Claude Code remote session failed because the pinned Playwright wanted `chromium_headless_shell-1228` while the sandbox preinstalls r1194 under `/opt/pw-browsers` (with the older `chrome-linux/headless_shell` layout) and blocks `playwright install`.
Learning: A minor headless-shell version skew renders these static HTML cards identically, so a writable shadow browsers directory with symlinks satisfies Playwright's executable check without downloading anything: recreate the expected `chromium_headless_shell-<rev>/chrome-headless-shell-linux64/chrome-headless-shell` path as a symlink to the preinstalled `chrome-linux/headless_shell` binary, then run with `PLAYWRIGHT_BROWSERS_PATH=<shadow-dir>`.
Evidence: `scripts/social-cards.mjs` produced a valid 1200x627 JPEG under the 200KB target this way for PR #114; `npm install` in `demos/strava-explorer` also churned `package-lock.json` (removed 42 lines) and had to be reverted before committing.
Use next time: In sandboxes with preinstalled browsers, check `/opt/pw-browsers` and `PLAYWRIGHT_BROWSERS_PATH` before touching Playwright installs, build the shadow-symlink dir when revisions differ, and always `git checkout` lockfiles that an install-for-tooling touched.


## 2026-07-20 - Cloud Run domain mapping replacement can interrupt TLS

Context: Cloud Run rejected the documented `create --force-override` command for an existing same-project mapping, so moving `ryanbaumann.dev` required deleting and recreating the exact DomainMapping resource.
Learning: Treat a Cloud Run domain mapping replacement as a certificate migration, not an atomic route edit. Move the canonical domain first, preserve the old service, wait for both resource readiness and edge propagation, and defer redirect-only mappings until the apex is stable.
Evidence: The replacement mapping became DomainRoutable immediately, took about 12 minutes to report CertificateProvisioned, and then needed several more minutes before all four published IPv4 edges completed TLS; the strict production smoke passed once propagation converged.
Use next time: Test same-project override behavior before the maintenance window, communicate the possible HTTPS interruption, validate each published edge, and never replace multiple mappings simultaneously.


## 2026-07-20 - Parallel-service deploy checks need an explicit compatibility boundary

Context: The new `fieldwork` Cloud Run revision deployed and passed its direct production smoke, but the deploy job then compared the still-legacy public origin's `portfolio` root manifest name against the renamed checkout and failed.
Learning: During a parallel-service migration, keep candidate-service verification strict and scope any compatibility override to the known legacy identity at the public-origin boundary. Do not weaken route, asset, canonical, redirect, auth, or secret checks.
Evidence: The failed deploy passed the new revision smoke and every public-origin assertion except the expected root app name; a tested `ROOT_APP_COMPAT_NAME` override changes only that expected root name for the public-origin step.
Use next time: Model transitional identities explicitly, document their removal condition beside the override, and delete the compatibility setting immediately after the domain cutover passes the strict public smoke.


## 2026-07-20 - Brand migrations need identity layers and compatibility gates

Context: Renaming the repository and deployment from Portfolio and `trails-ninja` to Fieldwork also affected public metadata, social assets, package names, source links, writer defaults, CI guards, image storage, and Cloud Run, while every existing website path needed to remain valid.
Learning: Separate the person, public brand, internal package paths, and deployment resources. Rename reader-facing and operational identity together, but preserve stable internal directories and environment variables when changing them adds no user value. Compare the complete route and redirect inventories before cutover, stage a parallel Cloud Run service, and retain both GitHub redirects and the legacy service until the public origin is verified. Repository-bound Workload Identity Federation conditions and service-account principals must explicitly allow the new GitHub name before the rename.
Evidence: The rebuilt Fieldwork output contains all 26 production sitemap paths and all 6 production redirects; the new `fieldwork` Cloud Run service is ready with the same 23 runtime configuration names while `trails-ninja` remains ready. The deploy provider and service-account roles now allow both the old and new repository principals during migration.
Use next time: Inventory page paths, redirects, metadata, images, repository links, workflow guards, package names, registry paths, runtime configuration names, Workload Identity provider conditions, service-account principals, IAM, domain mappings, and rollback targets before any public identity rename.


## 2026-07-20 - Mobile navigation should prioritize instead of overflow

Context: The header exposed every desktop destination on narrow screens, requiring horizontal scrolling and an extra JavaScript overflow control.
Learning: When every primary destination matters, reduce horizontal chrome before hiding links or adding overflow. Compact type and spacing can preserve the complete information architecture while retaining 44-pixel target height.
Evidence: At 320 and 360 pixels, the rendered header keeps Fieldwork, Notes, Work, Talks, Labs, About, and the theme control on one line; every navigation target is 44 pixels tall and the header scroll width equals its client width.
Use next time: Define mobile destination priority explicitly, retain 44-pixel target height, move nonessential utilities into the page or footer, and verify route completeness, wrapping, and overflow at the narrowest supported viewport.


## 2026-07-20 - Collection calls to action must point to the collection owner

Context: The homepage Labs section rendered several cards, but its “Explore Labs” action was hard-coded to one external Atlas experiment instead of the local Labs collection route.
Learning: A collection-level call to action should resolve to the collection’s canonical route. Individual external destinations belong on their own cards.
Evidence: The homepage builder now targets `/labs/`, which follows the existing permanent redirect to the canonical `/demos/` collection, while Atlas keeps its external URL in `apps.json`.
Use next time: Derive section-level destinations from the collection route and cover the rendered `href` with a build test when a featured item can be external.


## 2026-07-20 - Heatmap selectors must use API map type identifiers

Context: The Air Quality demo labeled a layer as PM2.5 but requested `PM25_INDEX`, which is not a supported Air Quality API heatmap map type. The failed tile requests left the map overlay visually empty.
Learning: Keep user-facing labels separate from API identifiers, and validate every configured tile layer against the documented map type values.
Evidence: The PM2.5 option now requests `PM25_INDIGO_PERSIAN`, and a focused test verifies the complete tile URL while rejecting the former identifier.
Use next time: Put external API identifiers in one shared configuration and cover every selectable layer with a request-contract test.


## 2026-07-20 - Browser and server Maps calls need separate restricted keys

Context: The Isochrones demo's map loaded, but Places autocomplete returned 403 because the browser build did not have a key authorized for Places API (New).
Learning: Keep the browser and server credential boundaries explicit. The browser key can use HTTP referrer restrictions and should allow only Maps JavaScript API and Places API (New). The Isochrones REST key cannot rely on browser referrers, so it stays server-side and is restricted independently.
Evidence: Places API (New) is enabled on `geojson-bq-blog`, and the deployment uses a dedicated `VITE_ISOCHRONES_GMP_API_KEY` for browser Maps and Places calls while `/api/isochrones` continues to use `GMP_SERVER_API_KEY` in the gateway.
Use next time: When one demo combines browser SDKs with server REST APIs, document and validate each key's runtime, application restriction, API allowlist, and enabled service separately.


## 2026-07-20 - A generated tile URL is not proof that the tile loaded

Context: The Air Quality demo generated the corrected PM2.5 map type, but every production tile still returned HTTP 400 because the endpoint rejected the extra `solution_id` query parameter.
Learning: Validate raster overlays at the HTTP and rendered-image boundaries. A correct map type and an invoked `getTileUrl` callback do not prove that the server returned a PNG or that the map drew it.
Evidence: A production-origin browser check reproduced `INVALID_ARGUMENT` for `solution_id`; the tile URL now sends only the documented API key query parameter, and the regression test pins that exact URL.
Use next time: For tile overlays, assert a 200 image response and inspect a rendered desktop/mobile capture before calling the layer visible.


## 2026-07-19 - Gitleaks Action v3 licensing breaks CI/CD workflows

Context: The CI pipeline's Gitleaks secret scanner step failed with a "missing gitleaks license" error because the proprietary `gitleaks-action@v3` wrapper enforces licensing key checks for organization repos or when GitHub's account-type API experiences a transient lookup failure.
Learning: Avoid proprietary action wrappers that add commercial licensing enforcement mechanisms for open-source tools when they can be run directly. Instead, run the official open-source tool binary directly or via Docker (`ghcr.io/gitleaks/gitleaks`) to scan git history without external dependencies or license checks.
Evidence: Changing the CI step to run `docker run --rm -v "${{ github.workspace }}:/repo" ghcr.io/gitleaks/gitleaks:latest git --source=/repo --verbose --redact` runs successfully without requiring a GITLEAKS_LICENSE secret or crashing on API failures.
Use next time: Prefer running open-source security tools via direct Docker commands or binary installation in workflows over proprietary wrapper actions that require license keys.


## 2026-07-19 - tar output format differences break size checks and rename options

Context: Checking the size of files in static archive artifacts failed on macOS because BSD `tar -tvzf` uses a different column order (size at index 4) compared to GNU `tar` (size at index 2), and the test suite's path-traversal simulation failed due to missing `--transform` support in BSD `tar`.
Learning: Do not assume `tar` options or output formats are identical across operating systems (BSD on macOS vs GNU on Linux). Parse size robustly using regular expressions targeting either format pattern, and try-catch OS-specific options (like `--transform` on GNU `tar`) falling back to their BSD equivalents (like `-s`).
Evidence: The updated `inspectArchive` matches both BSD and GNU formats via regex, and `labs.test.mjs` handles `--transform` errors by falling back to the `-s` rename option, resolving the local test failure on macOS.
Use next time: Use regex patterns rather than split column indices for parsing CLI command output, and provide fallback options when running platform-dependent tools like `tar`.


## 2026-07-19 - Curiosity works when it corrects a real assumption

Context: Ryan wanted the copywriting skill to make social posts, headlines, titles, names, and preview images more interesting while preserving the portfolio's evidence-led tone.
Learning: High-retention packaging should begin with the reader's plausible misconception, turn it into a specific question or tension, then quickly resolve the mechanism with evidence. The strongest hook often appears after swapping the obvious topic for the underlying lesson. Visual previews should carry one concrete contrast or artifact at small size, while the title carries the claim or question.
Evidence: Learning research on misconception-based multimedia shows that directly engaging prior beliefs can improve conceptual change, and creator packaging analysis consistently emphasizes clear promise, trust, simple visuals, title-image alignment, and iteration.
Use next time: For any public title, social draft, article headline, demo name, talk title, or preview card, draft the obvious framing first, find the hidden lesson, state the honest tension, verify the opening paragraph pays off the promise immediately, and propagate the rule into content, presentation, and review workflows instead of leaving it in writing guidance only.


## 2026-07-18 - Social automation should stop at an editable draft

Context: A new Field Note needed to create useful LinkedIn and X starting points without granting a merge workflow authority to publish externally.
Learning: Trigger only for newly added draft files, create one Buffer draft per explicitly configured channel, and leave editing, timing, and publication in Buffer. Do not repeat external staging on a workflow rerun. Once someone edits a Buffer draft, exact-copy matching is no longer an idempotency key.
Evidence: Buffer's GraphQL API supports `saveToDraft: true`, returns the created post ID, and documents that the post remains unpublished until explicitly scheduled. The workflow now limits merge-time staging to its first attempt; a partial failure is recovered by explicitly staging the missing channel from Writer.
Use next time: Separate generation from publication, scope automation to added content, provide a front-matter opt-out, use exact destination IDs, and keep automatic retries side-effect free unless the external API supports a durable idempotency key.


## 2026-07-18 - Separate content ownership, social orchestration, and publishing approval

Context: Field Notes needed a manageable path from one canonical post to Substack, LinkedIn, X, and possible future social channels.
Learning: Keep the portfolio as the canonical archive, use Buffer as the multi-network approval queue, and keep Substack manual until it offers a supported ongoing publishing API. Generate channel-specific drafts, but require an explicit approval action before any external post is created. Direct per-network integrations add credential, API-review, versioning, and retry complexity before the publishing cadence proves that work is necessary.
Evidence: Substack documents RSS archive import and manual copy-and-paste, not an ongoing post-creation API. LinkedIn's Posts API requires OAuth permissions and versioned requests. X charges for API writes. Buffer supports LinkedIn, X, and other networks through one API and can retain API-created posts as drafts awaiting approval.
Use next time: Start new social channels in the shared approval calendar. Keep credentials out of the public repository and browser, require explicit confirmation for Writer actions, and suppress automatic external effects on workflow reruns.


## 2026-07-18 - Primary content belongs in primary navigation

Context: Field Notes appeared as a special header button beside Contact while the rest of the site destinations lived in the primary navigation. On mobile, that split forced the navigation onto a second full-height row and obscured the intended content hierarchy.
Learning: Put the site’s main reader destination first in the semantic primary navigation. Reserve header actions for utilities, and keep mobile navigation in one horizontally scrollable row so 44-pixel targets do not require a second tier. When links overflow, retain a visible native scroll affordance.
Evidence: The rendered header now leads with Field Notes in the primary nav, removes the duplicate Field Notes action, and keeps branding, visibly scrollable navigation, Contact, and the theme control on one mobile row. A build regression test asserts the nav order.
Use next time: Start hierarchy changes from the semantic link order, then let the mobile layout preserve that order without duplicating destinations as calls to action.


## 2026-07-17 - Navigation and card affordances need structural regression tests

Context: A homepage hierarchy pass removed Resume from the primary header and left Talks out, while collection rows made only the title clickable even though their image and summary looked like one interactive result.
Learning: Global navigation destinations and card-sized interaction targets are product behavior, not styling details. Test the rendered primary nav and require a single semantic anchor to wrap every clickable result so pointer, keyboard, and analytics behavior stay aligned.
Evidence: Portfolio build tests now assert Work, Talks, and Resume in the primary nav, verify that writing and talk row anchors contain the image, title, summary, and metadata, and confirm that bodyless work cards honor their declared internal destination.
Use next time: When restructuring the header or collection layouts, update hierarchy without deleting established destinations, and verify both the complete rendered anchor boundary and its final `href` before accepting the visual change.


## 2026-07-17 - Pin every portfolio GCP command to its authorized project

Context: The local gcloud default can point at an unrelated Google Cloud project even when the repository's deployment variables correctly name the portfolio project.
Learning: This repository is authorized to use only `geojson-bq-blog`. Every command must pass that exact project explicitly; never infer authority from the active gcloud configuration and never use `gmp-demos-ryanbaumann` here.
Evidence: Ryan explicitly confirmed the project boundary. The deploy preflight now fails unless `GCP_PROJECT_ID` equals `geojson-bq-blog`, and the repository and domain-migration instructions record the same guardrail.
Use next time: Before any Google Cloud read or write, resolve the target from repository configuration, confirm it is exactly `geojson-bq-blog`, and include `--project geojson-bq-blog` or a validated equivalent in the command.


## 2026-07-17 - A domain cutover includes generated binaries and dependent origins

Context: Replacing canonical URL strings did not update domain text already rasterized into social-card JPEGs, and the Lab metadata still pointed at removed PNG variants. The deploy smoke also moved to the new host before DNS was ready, while writer OAuth retained a host-bound old origin.
Learning: Prepare the code first, map and certify the new host against the current service, then deploy the canonical change. Regenerate binary assets, validate absolute metadata assets, and migrate every host-bound integration such as OAuth callbacks and cookies in the same cutover.
Evidence: Social cards were regenerated with `ryanbaumann.dev`; Lab metadata now resolves to JPEGs; production smoke checks redirects, feed, sitemap, canonicals, and social assets; the domain runbook orders DNS before the cutover deploy and includes writer OAuth.
Use next time: Treat a domain move as a dependency inventory, not a string replacement. Check generated text in images, absolute asset URLs, deployment health targets, OAuth origins, email senders, analytics, API referrers, and search ownership before changing DNS.


## 2026-07-27 - Secret scans must distinguish identifiers from values

Context: Production smoke rejected the Real World Reasoning browser bundle
because the public Gemini SDK contains the OAuth schema identifier
`client_secret`, even though no credential value was present.
Learning: A browser secret scan should match a credential-shaped assignment,
not a field name alone. Keep the rule aligned across local and production smoke
and cover both the allowed schema identifier and a denied long value.
Evidence: `findServerSecretMarker()` accepts the SDK's
`oauth2:client_credentials` schema text and rejects an assigned long
`client_secret` fixture; the focused production-smoke test passes.
Use next time: When a dependency adds an authentication schema, inspect the
matched bytes before excluding the asset or weakening the scan.

## 2026-07-27 - Production smoke must reach metadata gates after config gates

Context: Two deploys built and routed healthy Cloud Run revisions but stopped
at the runtime-variable check because `GEMINI_API_KEY` was not attached. Once
the existing secret was attached, the next production smoke exposed a missing
canonical URL on the newly imported Real World Reasoning page.
Learning: Runtime configuration and rendered metadata are separate deployment
boundaries. Clear configuration blockers before calling a release verified,
then run the complete production smoke against the service URL so later gates
are not hidden behind an earlier failure.
Evidence: Cloud Run revision `fieldwork-00099-c2z` serves with
`GEMINI_API_KEY` attached, and `demos/real-world-reasoning-agent/index.html`
now owns one canonical and matching Open Graph URL.
Use next time: For a new hosted demo, verify required runtime variable names
before the paid build and verify its canonical URL in built HTML before merge.

## 2026-07-27 - Compile the deployable graph once per CI event

Context: Pull-request CI built each app in its package job, rebuilt every app
for a staged gateway smoke test, then rebuilt them again inside Docker. A
main-branch push repeated the Docker verification immediately before Cloud
Build produced the production image.
Learning: Keep fast package lint and unit tests isolated, but use the deployable
container as the single full compilation and smoke boundary on pull requests.
On main, let the production build own that boundary. Since Cloud Build workers
are ephemeral, explicitly pull the last successful image and export inline
BuildKit cache metadata. Before removing or renaming a CI job, inspect branch
protection's required contexts; preserve any required name as a cheap dependent
gate until the protection rule is deliberately migrated.
Evidence: `.github/workflows/ci.yml` removes the duplicate staged build and
per-package build step, gates Docker verification to pull requests, and keeps
the legacy required smoke context without a second compilation.
`cloudbuild.yaml` pulls, consumes, and refreshes the `build-cache` image.
Use next time: Before adding a build job, map which existing job already proves
compilation, packaging, or runtime liveness and add only missing evidence.

## 2026-07-17 - Distribution and privacy copy must match the deployed data path

Context: The live site loaded privacy-preserving GA4 analytics by default while the Privacy page described an opt-in control, and the email implementation still used Resend's retired Audience API.
Learning: Treat the owned site and email provider as the canonical publishing and subscriber systems, and treat social/newsletter platforms as attributed distribution channels. Privacy copy must describe actual runtime behavior. Campaign values should be narrowly allowlisted before analytics receives them, and provider integrations must be checked against current first-party API documentation rather than inherited terminology.
Evidence: The portfolio now loads GA4 only on the canonical host, sends only bounded `utm_source`, `utm_medium`, `utm_campaign`, and `utm_content` values, records confirmed sign-ups, and discloses default-on analytics. `/api/subscribe` now writes Contacts with a dedicated Resend Segment and Topic; gateway and portfolio suites pass.
Use next time: Audit runtime, public disclosure, setup docs, and provider API vocabulary together whenever analytics or subscriptions change. Never infer email consent from a social follow or connection.


## 2026-07-17 - Optimize social previews and sitemaps for AEO/SEO

Context: Large OpenGraph image assets (>1MB PNGs) delay scrapers and AI search engines, and hero image lazy-loading slows Largest Contentful Paint (LCP) performance.
Learning: Shift social card generation from PNG to highly compressed JPEGs (~100KB, quality 70) and mandate JPEG format under 200KB in the review guidelines. Set above-the-fold hero images to eager loading to prevent LCP layout shifts. Additionally, inject `<image:image>` tags into `sitemap.xml` for visual indexing, and configure apple-touch-icon/thumbnail fallbacks in layout headers for answer engines.
Evidence: `scripts/social-cards.mjs` modified to screenshot JPEG type with quality 70, sitemapXml in `portfolio/build.mjs` enhanced with visual metadata schema, and `.agents/skills/portfolio-review/SKILL.md` updated with compression limits. All social images compressed and sitemap generated.
Use next time: Always generate visual social metadata as compressed JPEGs (under 200KB) and configure eager loading for hero images above the fold. Ensure sitemap and header metadata expose visual assets explicitly for answer engine crawlers.


## 2026-07-17 - `node --test <dir>/` stopped accepting a bare directory argument

Context: `portfolio/package.json` ran its suite with `node --test test/`, which passed on the Node 22 minors CI had been using.
Learning: On Node v22.22, `node --test test/` fails with `Cannot find module .../test` — the runner resolves the bare directory as an entry module instead of a test pattern. An explicit glob (`node --test test/*.test.mjs`) behaves identically on old and new minors.
Evidence: The same checkout, same suite: directory form exits 1 with `MODULE_NOT_FOUND`; glob form runs all 23 tests green.
Use next time: Point `--test` at explicit glob patterns, not a bare directory, anywhere a Node minor bump can land before the script is revisited.


## 2026-07-17 - Reader features should reuse the boundaries the site already has

Context: Adding an email list and post comments could easily have meant a database, an auth system, and a moderation surface — none of which this zero-dependency container wants.
Learning: Route new reader features through boundaries that already exist. Subscriptions became one gateway route into the Resend account the contact form already uses (audience membership here, sends composed as dashboard broadcasts); comments became GitHub Discussions rendered by giscus, config-gated in `site.json` so the build stays script-free until the IDs are deliberately filled in.
Evidence: `/api/subscribe` in `gateway/server.js` (honeypot + rate limit + keyless 503, mirroring `/api/contact`), `commentsSection`/`subscribeSection` in `portfolio/build.mjs`, setup runbook in `docs/EMAIL_LIST_AND_COMMENTS.md`.
Use next time: Before adding a stateful feature, check whether an existing provider account, the gateway's route patterns, or GitHub itself can hold the state; wire the feature to fail closed (inert markup, JSON/HTML 503) when its configuration is absent.


## 2026-07-17 - Answer Engine Optimization (AEO) and Standardizing Open Graph Images

Context: Auditing the portfolio for Search Engine Optimization (SEO) and Answer Engine Optimization (AEO) best practices, and checking social thumbnail dimensions.
Learning: AEO prioritizes visible DOM elements over raw metadata (e.g., `<meta>` tags and JSON-LD). Rendering summaries in the visible body text (like a `.lede` paragraph right under the headline) dramatically improves discoverability for AI models (like Perplexity or Google AI Overviews). Additionally, the standard for Open Graph images is 1200x630 pixels. Expanding the build script's image validation to accept both 1200x627 and 1200x630 allows a smooth migration to standard sizes without breaking the build on existing 1200x627 assets.
Evidence: Modified `portfolio/build.mjs` to render `meta.summary` in a `<p class="lede">` paragraph for detail pages and standalone pages, and updated image validation on lines 122 and 213. Ran `node build.mjs` and the smoke tests (`node scripts/smoke.mjs`), which successfully passed.
Use next time: Always render summary metadata visibly in the DOM to assist AI engine indexers. When updating layout/image validation standards, support legacy sizes concurrently to prevent build blockages during migration.


## 2026-07-16 - Let the resident agent adapt portable prompts

Context: Agent harnesses use different global instruction files, skill directories, import mechanisms, and reload behavior. A dedicated cross-harness installer duplicated knowledge that the resident coding agent can inspect directly.
Learning: Keep one vendor-neutral prompt as the source of truth and publish a bounded self-install task packet. Tell the resident agent the desired end state, preservation rules, prohibited configuration changes, and verification evidence. Let it choose the current native mechanism for its environment.
Evidence: `agent-scripts/coding-agent-loop/README.md` now gives users one copyable install request. The role files state when they apply and that they narrow rather than expand authority.
Use next time: Prefer a self-install instruction over adapter code when the target is another capable agent and installation is a small, inspectable configuration task. Add tooling only after repeated installation failures show that deterministic automation is needed.


## 2026-07-16 - Private release previews need an identity boundary

Context: A shared dashboard password cannot satisfy an account-specific review workflow or provide a useful audit boundary for release decisions.
Learning: Protect the release dashboard with Google OAuth, restrict the accepted verified email server-side, use an exact HTTPS callback origin, and keep GitHub write credentials only in the gateway. The browser may render drafts but never receives a GitHub token.
Evidence: `gateway/lib/googleAuth.js` exchanges the authorization code server-side, asks Google to validate the ID token, checks the allowed email, and signs a short-lived HttpOnly session.
Use next time: Register the exact callback URL before deployment and keep any future coding-agent feedback integration behind the same authenticated gateway boundary.


## 2026-07-16 - Review requests need an explicit handoff

Context: A direct edit box and publish controls do not show an author what happens between a draft and release.
Learning: Make the review handoff visible in the dashboard: save the concrete draft first, collect a short author note, and create one review request that names the exact file, branch, and the writing, review, and design skills the agent must use. Keep the review token scoped to Issues, separate from the Contents token.
Evidence: `requestWritingReview` opens a GitHub issue with those review lanes, and the writer dashboard links back to the issue after submission.
Use next time: Do not let a review request silently publish, edit, or skip the rendered preview. Require an explicit follow-up action for each of those transitions.


## 2026-07-16 - Agent instructions and executable scripts need separate namespaces

Context: The repository already used `scripts/` for executable build and maintenance programs, while a growing collection of copyable agent prompts also needed a memorable GitHub home.
Learning: Store prompts, role contracts, and behavioral evals under `agent-scripts/`, with one self-contained folder per artifact. Keep the canonical prompt in that package and use `portfolio/content/scripts/` only for the reader-facing summary and source links. This makes the trust boundary visible and avoids maintaining two prompt copies.
Evidence: `agent-scripts/coding-agent-loop/` contains the canonical prompt, role overlays, README, and current 17-case specification; `portfolio/content/scripts/loop-engineering-coding-agent.md` links to those files and the build publishes `/scripts/`.
Use next time: Copy `agent-scripts/_TEMPLATE/`, add eval cases before tuning behavior, then add one portfolio summary entry. Never put prompt text in the executable `scripts/` tree or duplicate the canonical prompt in CMS prose.


## 2026-07-16 - Copy taste: metrics, third-party tools, and humble voice

Context: Reviewed copy and claims across the site with Ryan. Prior guidance said
"metrics are the spine, use the number," which pushed precise internal
current-employer growth figures (300% users, ~200% API engagement) onto public
pages.
Learning: This is a personal dev brand, not an employer marketing page. Three
taste rules emerged. (1) Metrics: real numbers are fine for public/verifiable
stats (npm downloads), prior-company results, and aged or long-public
current-employer work; recent internal current-employer usage or growth figures
read as internal and sales-pitchy, so use qualitative, understated framing
instead. (2) Third-party tools: name first-party surfaces (AI Studio), never
enumerate competitor AI products (name-brand IDEs, assistants, agent apps), which
reads like tool-shopping or looking for work elsewhere. (3) Voice: default to
"Our team built… I led the strategy and stayed close to the work," crediting
cross-functional partners, without diluting genuinely individual work.
Evidence: Session with Ryan; changes folded into `portfolio-writing`,
`portfolio-review`, and `docs/PORTFOLIO_EVIDENCE_LEDGER.md`.
Use next time: Follow the updated skills and ledger. Keep HITL artifacts (PR and
commit messages) high-level; do not expose internal specifics.


## 2026-07-15 - Initial Release

Context: Preparing the repository for its initial public release.
Learning: Compressed the prior learnings log for the initial public launch to keep history clean.
Evidence: Initial commit of the public repository.
Use next time: Document future durable lessons here using this format.
