# Generative UI (A2UI) in Atlas

Atlas's copilot can render **interactive UI surfaces** in the chat dock, not just
text. It speaks the [Maps Agentic UI Toolkit](https://github.com/googlemaps/a2ui)
**A2UI v1.0** (and v0.9) wire protocol: Gemini emits protocol messages through a
`render_surface` tool, and Atlas renders them with a **native React catalog**
styled in its own glass design system.

Why native rather than the alpha Lit renderer? React 19 interop, theming, and
avoiding a second live map in the chat. To keep the wire format honest, the
official `@a2ui/web_core` zod schemas are a devDependency and
`src/genui/parity.test.ts` validates our envelopes against them in CI — so the
official toolkit renderer stays swappable later.

- Catalog ids: `atlas://maps-agentic-ui-catalog` (`ATLAS_CATALOG_ID`), `a2ui://maps-agentic-ui-catalog.json` (`MAUI_CATALOG_ID`)
- Core code: `src/genui/` — `protocol.ts` (types + validator), `store.ts`
  (surface state), `tool.ts` (`render_surface`), `catalog.tsx` + `components/`
  (renderers), `SurfaceView.tsx`, `actions.ts`, `images.ts`.

## Protocol

A surface is built by an **array of messages**, each with `version: "v1.0"` (or `"v0.9"`) and
operations:

| Message | Shape | Effect |
|---|---|---|
| `createSurface` | `{ surfaceId, catalogId, components?, dataModel?, surfaceProperties?, theme? }` | Declares a new surface (optionally embedding initial components/dataModel in v1.0). |
| `updateComponents` | `{ surfaceId, components: ComponentNode[] }` | Upserts nodes by `id` (last-writer-wins) on subsequent turns. |
| `updateDataModel` | `{ surfaceId, path?, value? }` | Sets `value` at a JSON-pointer `path` (omit `path` to replace the whole model). |
| `deleteSurface` | `{ surfaceId }` | Removes the surface. |

**Components are a flat list; children are referenced by `id`.** The root of a
surface is the component with `id: "root"`. To *update* a surface, re-send with
the **same `surfaceId`** rather than creating a new one.

### Dynamic values (data binding)

Any prop can be a literal, or a **binding** `{ "path": "/a/b" }` that reads from
the surface's data model. Arrays live in the data model and are rendered with a
`List` template. Inside a template, relative paths (`{ "path": "name" }`, no
leading `/`) resolve within the current item's scope. (The A2UI function-call
form `{call,args}` is intentionally unsupported in Atlas v1.)

Resolution lives in `resolveDynamic()` / `getAtPath()` (`src/genui/protocol.ts`).

## Catalog

Component names are whitelisted by `CATALOG_COMPONENT_NAMES`; an unknown
component renders a subtle "unsupported" chip rather than crashing.

The catalog below is the **Atlas A2UI v0.9 subset** — a documented subset of the
Maps Agentic UI Toolkit basic catalog (not the full basic-catalog semantics).
The lower group is the journey-proven additions (Scout / Ad Studio / Fleet /
Concierge / Insight / Cinema), each with a golden fixture in `__fixtures__/` and
a render test in `catalogSubset.test.tsx`.

| Component | Key props |
|---|---|
| `Column` / `Row` | `children: string[]`, `align?`, `gap?` |
| `Card` | `child: string` |
| `Text` | `text: Dynamic<string>`, `variant?: h1..h5 \| body \| caption` |
| `Image` | `url: Dynamic<string>`, `alt?`, `fit?: cover \| contain`, `aspect?` — only `https:`, `data:image/`, and same-origin `/gmp/…` allowed |
| `Button` | `child: string` (a component id), `variant?`, `action: { event: { name, context? } }` |
| `List` | `children: string[]` **or** template `{ componentId, path }`, `direction?: vertical \| horizontal` |
| `Divider` | — |
| `ChoicePicker` | `options: [{label,value}]`, `selection?: {path}`, `multi?`, `action?` |
| `StatGrid` | `items: Dynamic<[{ label, value, hint? }]>` |
| `PlaceCard` / `PlaceDetailsCompact` | `placeId: Dynamic<string>`, `orientation?: vertical \| horizontal` — fetches live Places details via Places UI Kit; shows Google data unaltered |
| `MapPreview` / `GoogleMap` | `center?`, `lat?`, `lng?`, `zoom?`, `markers?: [{lat,lng,color?,label?}]`, `anchorMarker?`, `label?` — a static/interactive map card, click flies the camera |
| `AdCreative` | `imageRef: Dynamic<string>`, `headline`, `body?`, `cta?`, `badge?` — always renders an "AI-generated" badge |
| `ProgressStatus` | `label`, `state?: running \| done \| error \| pending`, `detail?`, `step?`, `total?` — streaming step indicator (`role="status"`) |
| `RecoverableError` | `message`, `retryLabel?`, `action?` — error banner (`role="alert"`) with a Retry button; falls back to a `send_prompt` retry |
| `EvidenceSource` | `label`, `provenance?: observed \| computed \| inferred \| generated`, `url?`, `confidence?: 0..1` — grounded-source chip |
| `RouteItinerary` | `steps: Dynamic<[{ instruction, distance?, duration? }]>` — ordered turn-by-turn list |
| `EtaSummary` | `duration`, `distance?`, `mode?: walk \| drive \| transit \| bike` — compact ETA row |
| `ComparisonTable` | `columns: Dynamic<string[]>`, `rows: Dynamic<[{ label, values: string[], highlight? }]>`, `caption?` — decision matrix `<table>` |
| `ConfirmationResult` | `title`, `status?: success \| error`, `detail?`, `action?` — end-of-journey confirmation (`role="status"`) |

## Actions

A `Button`/`ChoicePicker` action fires `{ name, surfaceId, sourceComponentId,
timestamp, context }` into `dispatchSurfaceAction` (`src/genui/actions.ts`).
Built-in names are handled locally; **any other name is forwarded to the copilot
as a structured user turn**, so the model can define its own action names.

| Action | Context | Effect |
|---|---|---|
| `fly_to` | `{ lat, lng, zoom? }` | Flies the map camera. |
| `select_place` | `{ placeId }` | Selects + flies to a place. |
| `send_prompt` | `{ prompt }` | Sends a follow-up user turn to the copilot. |
| `open_url` | `{ url }` | Opens an `https:` URL. |
| `download_image` | `{ dataUrl \| src, filename? }` | Downloads an image. |
| *(anything else)* | *(any)* | Forwarded to the copilot as `[ui-action] …`. |

## Image registry

Generated creatives and inspected Street View frames are large base64 data URLs.
`src/genui/images.ts` stores them and hands back a short `img:<id>` reference;
data models and transcripts carry only the reference. `Image`/`AdCreative`
resolve refs back to data URLs via `getImage()` (non-refs pass through). The
registry is demo-session scoped (cleared when the tab closes).

## Adding a component

1. Add the name to `CATALOG_COMPONENT_NAMES` in `src/genui/protocol.ts`.
2. Add a renderer `FC<{ node, surface, scope? }>` in `src/genui/components/` and
   register it in `src/genui/catalog.tsx`. Resolve every prop through
   `resolveDynamic(node.prop, surface.dataModel, scope)`.
3. Document the props in the catalog table above and, if it should be part of the
   parity guarantee, add a fixture under `src/genui/__fixtures__/`.

## Worked example

The canonical place-carousel fixture (validated in `parity.test.ts`):

```json
[
  { "version": "v0.9", "createSurface": { "surfaceId": "espresso-1", "catalogId": "atlas://maps-agentic-ui-catalog" } },
  { "version": "v0.9", "updateComponents": { "surfaceId": "espresso-1", "components": [
    { "id": "root", "component": "Column", "children": ["title", "carousel", "chips"] },
    { "id": "title", "component": "Text", "variant": "h3", "text": "Top espresso near the Ferry Building" },
    { "id": "carousel", "component": "List", "direction": "horizontal", "children": { "componentId": "placeTpl", "path": "/places" } },
    { "id": "placeTpl", "component": "PlaceCard", "placeId": { "path": "placeId" } },
    { "id": "chips", "component": "ChoicePicker",
      "options": [{ "label": "Open now", "value": "open" }, { "label": "Walkable", "value": "walk" }],
      "action": { "event": { "name": "send_prompt", "context": { "prompt": "filter the espresso list: {selection}" } } } }
  ] } },
  { "version": "v0.9", "updateDataModel": { "surfaceId": "espresso-1", "path": "/places",
    "value": [{ "placeId": "PLACE_ID_1" }, { "placeId": "PLACE_ID_2" }] } }
]
```

See `src/genui/__fixtures__/` for the Ad Studio campaign and Scout evidence
surfaces as well.
