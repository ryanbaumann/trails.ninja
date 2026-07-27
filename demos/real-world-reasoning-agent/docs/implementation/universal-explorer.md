# Universal explorer vertical slice

The first-run shell now launches one bounded decision: find a relevant place near the selected area, verify the hard travel-time limit, and check current weather. The Sample path uses fictional deterministic records; Live uses the three read-only Maps Grounding Lite MCP tools through a same-origin, body-capped, rate-limited server proxy with exact tool argument allowlists. Live additionally requires the explicit `GROUNDING_LITE_ENABLED=true` readiness opt-in.

## Runtime boundary

- `search_places` produces the session-scoped shortlist and the first marker/fit effects.
- `compute_routes` runs sequentially for at most three candidates. The deterministic ranker excludes unverified or over-limit routes and chooses the shortest verified trip; every view containing walking data says that WALK routes are beta and may sometimes lack clear sidewalks or pedestrian paths.
- `lookup_weather` runs only after a route-backed winner exists. Weather failure produces a partial decision and no jacket claim. Verified weather is followed by a visibly labeled deterministic Atlas jacket inference.
- The direct Routes provider is display-only: it draws the winner polyline but never enters Gemini context or the grounded narrative.
- A fixed `universal-explorer` A2UI surface owns progress, compact evidence, sources, limitations, and the typed Walk/Drive counterfactual. The model does not author this component graph. A separate concise Atlas answer is derived from the verified runtime state; Live may refine it with Gemini, while invalid, linked, ungrounded, or keyless output keeps the deterministic answer.
- Sample mode is a visibly fictional preview. It renders no clickable fixture provenance and never exposes repository links in the answer or evidence surface; the repository link remains only in the demo header.

Grounding Lite records fail closed unless coordinates, required attribution, and the Google Maps place link are present. Attribution titles remain unmodified and untruncated, both the title and `Google Maps` are marked `translate="no"`, and both the required source URL and place link are available immediately beside the claim.

The representative departure-time/rain counterfactual remains outside this slice. Grounding Lite requires location-local date/hour inputs for hourly Weather, while this minimal profile has no timezone capability; its route tool also does not expose the departure-time traffic semantics needed for an honest “leave 20 minutes later” comparison. This PR therefore ships a typed Walk/Drive shortlist rerun and does not fabricate a time-based answer.

## Eval delta

`eval/explorer/baseline.json` locks the PR4 no-runtime baseline and `eval/explorer/cases.json` is an executable five-case dataset (flagship, ambiguity, empty, partial Weather, and Drive counterfactual). `npm run eval:explorer` computes the before/after report: the PR5 candidate passes all five cases, with positive deltas across task completion, rendered source integrity, constraint fidelity, candidate differentiation, dependency order, surface ownership, UI/map consistency, explanation proxy, first-map-effect SLO, recovery, counterfactual coherence, and minimal capability profile. The deterministic trace p75 is 0 ms under its injected clock. The production-browser Sample smoke independently gates first attributed evidence at 25 seconds, updates the same surface for Drive, and captures desktop/mobile evidence in `docs/implementation/evidence/pr5-browser/`.

The explanation score is an automated structural proxy, not proof of human comprehension. No five-person comprehension study was run.

No paid remote evaluator or live Maps trace was used. Synthetic fixtures contain no captured Google Maps names, addresses, URLs, imagery, or user prompts.
