# Capability runtime boundary

`src/capabilities/` separates serializable capability metadata and typed host effects from Gemini declarations and Atlas state mutation.

The first migrated profile contains three local presentation capabilities: `fly_to`, `clear_map`, and `show_notice`. Their executors return data plus ordered effects and do not import Zustand, React, Gemini, browser APIs, or Maps SDK objects. `atlasAdapter.ts` is the compatibility edge that turns generated declarations back into the existing `ToolDefinition` shape and projects effects into the current store.

Provider-backed tools remain legacy in PR4. PR3 marks direct Maps API facts `modelContext: denied`; Places, Routes, and Weather cannot move into a new model-facing capability until PR5 supplies a product-compliant grounding path with adjacent evidence.

## Invariants

- Model-emitted calls still execute sequentially in emission order.
- A new turn aborts the superseded turn before delayed effects can project.
- Capability manifests are JSON-safe, versioned, and include prerequisites, host/provider features, consent, approval, side-effect, cost, latency, idempotency, presenter, retry, summarizer, and eval metadata.
- Minimal profiles resolve prerequisites deterministically and reject missing IDs, duplicate registrations, duplicate model names, and cycles.
- `add_markers` remains legacy until coordinate provenance can be enforced rather than merely described.
- Local presentation effects are not automatically retried.
- Fixture replay rebuilds from a clean checkpoint. Append effects are intentionally per-invocation and are not deduplicated onto an already-projected snapshot.

## Evaluation

The deterministic trace dataset remains the independent grader. Before and after this slice, all three golden traces pass all five stable dimensions (mission completion, tool order, grounding, surface ownership, and final/UI consistency); each of the six negative fixtures continues to fail only its intended dimension. No paid remote evaluator was invoked.
