# learnings

## 2026-07-13 — Agent answers and evidence surfaces need separate ownership

Context: The first-run explorer rendered its deterministic fixture, ranking, weather, limitations, and repeated provenance as one long A2UI surface. Users saw cards but no recognizable Atlas answer and mistook Sample fixtures for a live agent result.
Learning: Keep the concise agent conclusion as a model transcript message and the deterministic A2UI graph as supporting evidence. Generate prose only from a bounded verified view, reject links or shortlist-foreign place names, and retain a deterministic fallback for keyless Sample runs. Sample provenance should be a single non-clickable disclosure; Google Maps attribution remains adjacent only for Live claims.
Use next time: Do not make a result surface carry both the conversational answer and every evidence detail. Preserve a clear answer/evidence hierarchy and ensure demo fixtures cannot leak repository or source links into user-facing results.

## 2026-07-09 — Gemini thinkingConfig Model Compatibility

Context: Implementing task-specific thinking configurations (medium, low, minimal) across the application.
Learning: The Gemini API throws a 400 Bad Request error if a `thinkingConfig` parameter is passed to models that do not support it (e.g. Gemini 2.0 Flash, Gemini 1.5 Pro, and specialized image, audio, or video models).
Evidence: Gemini API documentation, `@google/genai` typings (`ThinkingConfig`), and actual API schema behavior. Specifically:
  - Gemini 3/3.5 models (e.g., `gemini-3.5-flash-lite`) support `thinkingLevel`.
  - Gemini 2.5 models support `thinkingBudget`.
  - Older models (e.g., `gemini-1.5-flash`), standard 2.0 (e.g., `gemini-2.0-flash`), and non-text modalities (image, tts, omni video) do not support `thinkingConfig` fields.
Use next time: Use the `getThinkingConfig(model, level)` helper function to dynamically assign the configuration object or omit it for models that do not support reasoning config.

## 2026-07-10 — Copilot tool calls must run sequentially, not in parallel

Context: Debugging "a fair number of failed tool calls" — spurious `{ok:false, error:'Call set_campaign_business first.'}` in Ad Studio (same class of "call X first" guard exists in Scout).
Learning: The `CopilotEngine` tool loop (`src/ai/engine.ts`) originally executed all tool calls in a turn with `Promise.all`, but every journey's system prompt tells the model to *batch* independent tool calls in one turn. When the model batches a **prerequisite** call with a **dependent** call (e.g. `set_campaign_business` + `gather_campaign_facts`), parallel execution races: the dependent handler reads scenario-store state (`adstudio().business`) before the prerequisite's `await` (a `placeDetails` fetch) has written it, so the prerequisite guard fires falsely. This is NOT a model-tier problem — the copilot is already on `gemini-3.6-flash` at LOW thinking; a stronger model would still hit the race.
Evidence: `adstudio/controller.ts` guards check `adstudio().business` set by `setCampaignBusiness`, which writes state only after `await placeDetails(...)`. Reproduces whenever the model emits both calls in one function-call response.
Use next time: Keep the engine's per-turn tool execution **sequential, in the model's emission order** — the model emits prerequisites before dependents, so ordering holds and batched turns succeed. Do NOT reintroduce `Promise.all` there. Prefer scenario-store race safety over the marginal latency of parallelizing (turns are usually a single call anyway).

## 2026-07-10 — Follow-up suggestions must be grounded in the journey's real tools

Context: Fleet follow-up chips suggested actions the agent can't do (e.g. "show a traffic heatmap").
Learning: `suggestFollowups` (`src/ai/followups.ts`) fed the utility model only the journey title/tagline/transcript — no capability list — so it hallucinated features. The scenario's real capabilities are already available via `SCENARIOS[scenario].tools` (each `ToolDefinition.declaration` has a name + description).
Use next time: When adding/altering suggestion or planning prompts, ground them in `describeCapabilities(scenario)` (tool declarations minus UI plumbing like `render_surface`/`show_notice`) and forbid inventing unsupported features. A new tool automatically becomes a suggestable action; a removed tool stops being suggested.

## 2026-07-10 — A2UI render_surface failures are model near-misses, not model tier; normalize before validating

Context: "A ton of 'Rendering the response' failed chips" for A2UI cards. The copilot is already on `gemini-3.6-flash`; a bigger model wasn't the fix.
Learning: `render_surface` validated strictly (`validateMessages`) and returned `{ok:false}` on any deviation, which renders as an error chip with no card. Flash-family models routinely emit *near-valid* A2UI: omit `createSurface`, forget the `root` component, nest child component objects instead of a flat list, use a foreign `catalogId`/`version`, or return stringified JSON. These are deterministically repairable.
Use next time: `normalizeA2uiInput(raw, existingSurfaces)` (`src/genui/protocol.ts`) runs before `validateMessages` in the tool and repairs those near-misses (prepend `createSurface`, inject a synthetic `root` Column over top-level nodes, hoist nested children into the flat list, default catalogId/version, coerce string/`{messages}`/single-object). Keep `validateMessages` STRICT (its tests assert exact errors) and do the leniency in the normalize pass. For extra reliability on JSON-only helper calls (e.g. follow-ups) prefer a Gemini structured-output `responseJsonSchema` over trusting `responseMimeType:'application/json'` alone — it keeps the cheap flash-lite model parser-clean.

## 2026-07-10 — "Filming the tour" uses the omni VIDEO model, not flash-lite

Context: A user reported "Filming the tour" (and "Filming the walkthrough") failing and assumed flash-lite was to blame.
Learning: `generate_tour_video`/`walkthrough_video` → `generateVideo` (`src/ai/video.ts`) → `MODELS.omni` (`gemini-omni-flash-preview`), a VIDEO-generation model driven via the Interactions API. It is NOT flash-lite and CANNOT be replaced with `gemini-3.6-flash` (a text model). `MODELS.omni` is also **not** in the server base allowlist (`server/index.mjs`) — it must be added via `GENAI_EXTRA_MODELS`, and the feature is gated by `VITE_VIDEO_GEN_ENABLED` (on by default).
Use next time: If tour/walkthrough video "fails", the cause is the omni model being unavailable/unallowlisted, not the text model tier. To make it work, provide a real image→video model available to the project + allowlist it (`GENAI_EXTRA_MODELS`) and set `VITE_GEMINI_OMNI_MODEL`; to hide the CTAs, set `VITE_VIDEO_GEN_ENABLED=false`. Do not "fix" it by swapping to a text model.

## 2026-07-10 — A2UI text components must interpolate AND drop unresolved `{path}` tokens

Context: Ad Studio cards still rendered raw `{style}`, `{headline}`, `{body}`, `{cta}` placeholders even after the structured-output work — two AdCreative cards each showing literal mustache braces.
Learning: The A2UI catalog had an interpolation gap. `Text` and `StatGrid` resolved literal `{path}` tokens against the surface data model, but `AdCreative` (the only other text-bearing component) called `resolveDynamic` directly and rendered the resolved string verbatim — so a card built as a List template with `headline:"{headline}"` (the exact pattern `promptGuide.ts` teaches) leaked the raw token. Separately, ANY unresolved token (wrong key / missing data / template shell with no data model) leaked as raw `{token}` from every component, because `interpolate` deliberately leaves unresolvable tokens untouched (its tests assert that, and prose braces must survive).
Evidence: `src/genui/components/AdCreative.tsx` used `displayText(resolveDynamic(...))` with no `interpolate`; `Text.tsx`/`StatGrid.tsx` did interpolate. New `AdCreative.test.tsx` reproduces the leak (raw `{headline}` in the rendered markup) and proves the fix.
Use next time: Route every text-bearing component's string props through `resolveDisplayText(v, dataModel, scope)` (`src/genui/protocol.ts`) — it resolves the dynamic, interpolates `{path}` tokens for literals, then drops any binding-shaped token the data model never satisfied (`dropUnresolvedTokens`) so broken bindings render as empty, not raw braces. Keep `interpolate` strict; do the token-dropping in the component/`resolveDisplayText` layer only (never on bound data values — real data may legitimately contain braces). When adding a new catalog component with a text prop, use `resolveDisplayText`, and update the `promptGuide.ts` "tokens work in …" line to list it.

## 2026-07-10 — Headless CI can't render the WebGL vector / photorealistic 3D basemap

Context: The mission browser smoke (`scripts/mission-smoke.mjs`) and the Playwright MCP browser both log `Attempted to load a Vector Map, but failed. Falling back to Raster` and, in Cinema, `Attempted to load a 3D Map, but failed`, with the app's "Oops! Something went wrong" map notice on the 3D reveal.
Learning: This is an **environment** limitation (no GPU; `--use-gl=angle --use-angle=swiftshader` can't do the vector/3D basemap), not an app bug. Consequences for tests: (1) a raster fallback has **no sized `<canvas>`**, so asserting `canvas.width>0` is wrong — accept `.gm-style` / tile `<img>` too; (2) the 3D reveal cannot be screenshot-verified headless — verify the 2D reach/route instead and rely on the defensive feature-detect in `MissionReach3D` (it `customElements.get('gmp-polygon-3d')` + try/catch, so a missing maps3d vector element degrades to marker + orbit rather than throwing).
Use next time: For mission-flow smoke, run in demo mode (no creds needed for the flow), assert the map area via canvas OR `.gm-style` OR tiles, and gate horizontal-overflow checks on **visible** content (`left < viewport && right > viewport`) — the app pins `body{overflow:hidden}` and parks closed slide-overs fully off-canvas by design, so `documentElement.scrollWidth` is a false positive. Showcase screenshots that need the real basemap require a GPU-backed browser.

## 2026-07-10 — Terra Draw is the drawing-editor path (not the deprecated Drawing Library)

Context: The area/exclusion editor slice needed interactive polygon drawing on the Google map.
Learning: Use `terra-draw` + `terra-draw-google-maps-adapter`. Init inside a component under `<Map>` with `useMap()`: `new TerraDraw({ adapter: new TerraDrawGoogleMapsAdapter({ lib: google.maps, map }), modes: [new TerraDrawPolygonMode()] })`, then `draw.start()`, `draw.setMode('polygon')`, listen with `draw.on('finish', …)`, read `draw.getSnapshot()` (GeoJSON — coords are **[lng,lat]**, rings closed). The map instance is only reachable via `useMap()`/`useMap3D()` inside the React tree; controllers drive the map through the zustand store, never a map singleton.
Use next time: TS types ship with the package, so rely on `tsc` to validate the adapter/API rather than guessing. `npm audit` flags a pre-existing critical only in `vitest` (dev-only UI server), not in terra-draw.
# A2UI updates must be atomic and graph-valid

Agent-emitted surfaces are flat component graphs, so schema-valid messages can
still create missing children, cycles, unreachable controls, or an empty root
after a partial update. Validate the merged graph in O(nodes + edges), stage the
whole batch before committing, preserve the last valid surface on error, report
the error through `render_surface`, and prune unreachable stale subtrees after a
valid root replacement. Protocol-only validation cannot prove an incremental
patch is safe because it does not have the prior surface graph.

## 2026-07-13 — Normalize scoring inputs and separate human turns from orchestration

Context: The flagship mission stored priorities on a 0–100 UI scale while Scout fusion expected weights summing to 1, and app-owned kickoff/handoff prompts used the same transcript path as human messages.

Learning: Normalize rubric weights at the scoring boundary even when upstream callers normally normalize them; otherwise one raw UI-scale caller clamps every weighted total to 100. Application-owned agent instructions also need an explicit internal-send path: they may remain a model request, but must not be rendered or replayed as if the human typed them.

Use next time: Route scoring through `normalizeRubricWeights`, derive active-mission Scout weights with `prioritiesToRubric`, and use `sendInternalToCopilot` for controller-owned turns. Keep ordinary `sendToCopilot` for actual user actions. Validate every pinned source path at its exact ref with `npm run verify:sources`; never substitute a default branch when a declared path is missing.

## 2026-07-13 — Real-world facts cross a provider-neutral outcome boundary

Context: Preparing Places + Routes + Weather for a portable agent runtime without changing the current journeys.

Learning: SDK responses and REST payloads are translated at `src/world/` into JSON-safe facts and discriminated outcomes. Every outcome carries provider attribution, freshness, limitations, retention, and model-use policy—even empty, failed, or cancelled calls. Missing coordinates remain `null` instead of being fabricated at `(0,0)`, and unavailable route metrics remain `null` in normalized results instead of becoming zero or `NaN`. Direct Google Maps API content is default-deny for model context; a model-facing grounding adapter must establish its own product-compliant policy and keep sources adjacent.

Use next time: Add new real-world products through a port in `src/world/ports.ts`, return `ProviderResult<T>`, and keep SDK objects out of contracts and fixtures. Preserve old caller semantics in a compatibility adapter until the caller migrates. Include `gmp_git_agentskills_v1` in supported Maps SDK requests and the Weather solution-ID header.

## 2026-07-13 — Capability preflight and location consent must fail closed

Context: The cold open manually exposed Live/Demo and requested browser geolocation during app startup, before a user action.

Learning: `apiHealth: 'ok'` is not proof that a live mission can run: it does not establish browser Maps configuration or the server-side Maps and Gemini capabilities. Likewise, a visually covered shell is still keyboard- and screen-reader-reachable when it remains mounted behind an overlay. Exact location should not enter global state or trigger reverse geocoding merely because the user opened the browser consent prompt; otherwise “Remove” cannot truly stop app use of those coordinates.

Use next time: default to Sample, combine the same-origin content-free `/capabilities` response with browser-key, online, and API-health signals, and fall back on every unknown/error. Mount the operational shell only after landing dismissal. Keep coordinates local after **Use my location**, discard them on **Remove**, and create the session-only custom area only when the user launches while location remains selected.

## 2026-07-13 — Capability executors return effects; adapters own host mutation

Context: Extracting the first portable capability slice without rewriting the copilot engine or weakening Maps-content policy.

Learning: Serializable capability manifests, pure executors, typed host effects, and host adapters are separate layers. The executor returns data/effects and never imports Atlas state; the adapter alone projects effects into Zustand and exposes the legacy `ToolDefinition`. New turns must abort the prior shared signal before an awaited executor can project stale effects. Provider-backed tools cannot migrate merely for architectural symmetry when their evidence policy denies direct model context.

Use next time: Add capabilities to the versioned registry, generate declarations from the manifest, resolve the smallest prerequisite profile, replay effects in a fixture host, and keep engine calls sequential in model-emission order. Put new Maps-backed model tools behind a permitted grounding adapter rather than unwrapping direct provider facts.

## 2026-07-13 — Grounded explorer decisions separate evidence, ranking, and display geometry

Context: Building a one-prompt Places + Routes + Weather decision without returning ordinary Maps API content to the generic copilot model.

Learning: Maps Grounding Lite can own the structured, attributed decision evidence while deterministic code enforces hard route limits and produces the recommendation. A direct Routes provider may separately draw the selected polyline, but its `modelContext: denied` result stays inside the display-effect boundary. One fixed A2UI surface should be updated through every stage; local typed counterfactual actions must reuse the shortlist and atomically replace marker ranks and route state.

Use next time: keep Grounding Lite attribution title/URL and each place link adjacent to its supported claim, show the full WALK beta/sidewalk warning on every view containing walking data, reject unattributed grounded records, keep live results session-scoped, and expose only exact bounded argument schemas for the three read-only MCP tools through the same-origin server proxy. A server key alone is not readiness proof; require an explicit deployment opt-in after API enablement and key restrictions are verified.

## 2026-07-21 — Always pass --project geojson-bq-blog; never trust gcloud default

Context: A deploy attempt used the local gcloud default project (`gmp-demos-ryanbaumann`) instead of the correct project (`geojson-bq-blog`). The local default is set to a different project that `rsbaumann@gmail.com` does not even have permissions on, so the build failed with PERMISSION_DENIED — but if the account *had* access, it would have deployed to the wrong environment.
Learning: The local `gcloud config get-value project` is unreliable and returns the wrong project for this repo. Every `gcloud` command — builds, deploys, secrets, services, artifact repos — MUST include `--project geojson-bq-blog` explicitly. The forbidden project `gmp-demos-ryanbaumann` must never be targeted.
Use next time: Hardcoded in `AGENTS.md`. Always pass `--project geojson-bq-blog` on every gcloud invocation. Never omit `--project` and never use `gmp-demos-ryanbaumann`.
