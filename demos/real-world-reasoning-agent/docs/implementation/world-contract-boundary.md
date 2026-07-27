# World contract boundary

`src/world/` is the provider-neutral boundary for Places, Routes, and environment facts. New consumers use the discriminated `ProviderResult<T>` and must preserve its evidence alongside the value. The evidence records attribution, freshness, limitations, credential path, regional/product-term references, retention policy, and model-use policy for every outcome, including empty and failed calls.

Direct Google Maps API content is marked `modelContext: denied`. A future model-facing adapter may use only a product path whose terms explicitly permit that use (for example, a supported grounding product), and must keep its sources adjacent to the designed output. `modelImprovement: denied` is invariant.

## Temporary compatibility exception

The existing `searchText`, `searchNearby`, `placeDetails`, `computeRoute`, `computeMatrix`, and `environmentSnapshot` exports intentionally unwrap normalized outcomes so the six current journeys do not change in PR3. Some existing AI tools already return those legacy values to Gemini. PR3 does not expand that behavior, but it also cannot enforce the new deny policy at those old call sites without violating its no-behavior-change scope.

PR4 must migrate model-facing callers to normalized results before removing these adapters. Until then:

- new model-facing code must not call a legacy value adapter;
- new provider work must implement a port in `src/world/ports.ts`;
- fixtures must contain synthetic data only;
- compatibility wrappers must preserve their previous success, empty, and failure behavior.
