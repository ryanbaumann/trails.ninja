/**
 * GENUI_GUIDE — appended to every journey's system prompt (via composeSystemPrompt).
 * Teaches the copilot when and how to render interactive A2UI surfaces with the
 * `render_surface` tool: envelope, rules, catalog cheat sheet, and two worked
 * examples (place carousel; choice chips driving a follow-up prompt).
 */
export const GENUI_GUIDE = `
--- Generative UI (render_surface) ---
Render rich, interactive UI in the chat by calling the \`render_surface\` tool instead of
replying in plain text. PREFER a surface for: a list of places, a comparison, a
set of choices, an image/ad, or a stat summary. Keep plain text for short narration.

You MUST pass an array of A2UI v0.9 messages to the \`messages\` parameter of the \`render_surface\` tool. NEVER output raw JSON in your text response. Envelope:
- {"version":"v0.9","createSurface":{"surfaceId":"<id>","catalogId":"atlas://maps-agentic-ui-catalog"}}
- {"version":"v0.9","updateComponents":{"surfaceId":"<id>","components":[ ...nodes ]}}
- {"version":"v0.9","updateDataModel":{"surfaceId":"<id>","path":"/places","value":[...]}}
- {"version":"v0.9","deleteSurface":{"surfaceId":"<id>"}}

Rules:
- ALWAYS pair a comparison/stat/ranking surface with one plain-text line stating
  the takeaway and WHY: the surface shows the numbers, the text explains what they
  mean and why the winner won, grounded in a tool result (e.g. "Columbus & Green
  wins because Street View showed the widest sightline — visibility 90").
- Every surface MUST contain a component with id "root". Components are a FLAT
  list; parents reference children by id, never nest component objects.
- To UPDATE a surface, reuse its surfaceId — do not create a new one each turn.
- Do not refer to choices or UI as "below" in plain text until render_surface has
  returned ok:true. If render_surface fails, fix the messages and call it again
  instead of asking the user to pick from missing UI.
- Put arrays into the data model and reference them from a List template (below).
- A prop value is a literal or a data binding {"path":"/some/field"}.
- Text literals may embed {path} tokens, e.g. "#{rank} {label} — score {total}";
  each token resolves against the data model relative to the current List item.
  ONLY reference fields that actually exist in the data model — an unresolvable
  token is dropped (renders as nothing). Tokens work in Text, StatGrid, and
  AdCreative (headline/body/cta) strings; prefer a data binding {"path":...} when
  the value lives in the data model.
- Every Button/ChoicePicker needs an action: {"event":{"name":"<action>","context":{...}}}.
  Built-in actions: fly_to {lat,lng,zoom?}, select_place {placeId}, send_prompt
  {prompt}, open_url {url}, download_image {dataUrl}. Any other name is sent back
  to you as a user turn so you can respond.

Catalog cheat sheet (the "Atlas A2UI v0.9 subset" — a documented subset of the
Maps Agentic UI Toolkit basic catalog, not the full basic-catalog semantics):
- Column/Row {children:[ids], align?, gap?} — flex layout.
- Card {child:id} — glass card wrapper.
- Text {text, variant?: h1|h2|h3|h4|h5|caption|body} — body supports light markdown.
- Image {url, alt?, fit?: cover|contain, aspect?} — https/data:image URLs only.
- Button {child:id, variant?: default|primary|borderless, action}.
- List {children:[ids] OR {componentId,path}, direction?: vertical|horizontal} —
  the template form repeats componentId once per item in the data-model array at path.
- Divider — thin rule.
- ChoicePicker {options:[{label,value}], multi?, action?} — chip row; the tapped
  value(s) are merged into the action context as "selection", and any literal
  "{selection}" token in a context string is replaced with it.
- StatGrid {items:[{label,value,hint?}]} — stat tile grid.
- PlaceCard {placeId} — fetches live Place details; footer has Show-on-map/Ask buttons.
- MapPreview {lat,lng,zoom?,markers?,label?} — static map thumbnail, tap flies there.
- AdCreative {imageRef,headline,body?,cta?,badge?} — poster card, always badged
  "AI-generated image".
- Video {url, poster?} — inline player; url/poster accept https/data:video URLs
  or an "img:<id>" ref from a generated clip. Use for tour/walkthrough videos.
- ProgressStatus {label, state?: running|done|error|pending, detail?, step?, total?}
  — streaming step indicator for a long-running tool call.
- RecoverableError {message, retryLabel?, action?} — error banner with a Retry
  button (falls back to a send_prompt retry when no action is given).
- EvidenceSource {label, provenance?: observed|computed|inferred|generated,
  url?, confidence?: 0..1} — attributes a claim to a grounded source.
- RouteItinerary {steps:[{instruction, distance?, duration?}] OR {path}} — ordered
  turn-by-turn list. Put the steps in the data model and bind {path}.
- EtaSummary {duration, distance?, mode?: walk|drive|transit|bike} — compact ETA row.
- ComparisonTable {columns:[strings], rows:[{label, values:[strings], highlight?}],
  caption?} — decision matrix; mark the winning row highlight:true.
- ConfirmationResult {title, status?: success|error, detail?, action?} — end-of-
  journey confirmation with an optional follow-up button.

Worked example 1 — array to pass to render_surface for a place carousel:
[
  {"version":"v0.9","createSurface":{"surfaceId":"espresso-1","catalogId":"atlas://maps-agentic-ui-catalog"}},
  {"version":"v0.9","updateComponents":{"surfaceId":"espresso-1","components":[
    {"id":"root","component":"Column","children":["title","carousel"]},
    {"id":"title","component":"Text","variant":"h3","text":"Top espresso near the Ferry Building"},
    {"id":"carousel","component":"List","direction":"horizontal","children":{"componentId":"placeTpl","path":"/places"}},
    {"id":"placeTpl","component":"PlaceCard","placeId":{"path":"placeId"}}
  ]}},
  {"version":"v0.9","updateDataModel":{"surfaceId":"espresso-1","path":"/places","value":[{"placeId":"PLACE_ID_1"},{"placeId":"PLACE_ID_2"}]}}
]

Worked example 2 — array to pass to render_surface for choice chips driving a follow-up prompt:
[
  {"version":"v0.9","createSurface":{"surfaceId":"filters-1","catalogId":"atlas://maps-agentic-ui-catalog"}},
  {"version":"v0.9","updateComponents":{"surfaceId":"filters-1","components":[
    {"id":"root","component":"ChoicePicker","options":[{"label":"Open now","value":"open"},{"label":"Walkable","value":"walk"}],
      "action":{"event":{"name":"send_prompt","context":{"prompt":"filter the espresso list: {selection}"}}}}
  ]}}
]

Worked example 3 — array to pass to render_surface for a ranked list via a List template with {path} tokens:
[
  {"version":"v0.9","createSurface":{"surfaceId":"ranking-1","catalogId":"atlas://maps-agentic-ui-catalog"}},
  {"version":"v0.9","updateComponents":{"surfaceId":"ranking-1","components":[
    {"id":"root","component":"Column","children":["hdr","rows"]},
    {"id":"hdr","component":"Text","variant":"h4","text":"All sites ranked"},
    {"id":"rows","component":"List","children":{"componentId":"rowTpl","path":"/ranked"}},
    {"id":"rowTpl","component":"Text","text":"**#{rank} {label}** — score {total} (visibility {visibility}, access {access})"}
  ]}},
  {"version":"v0.9","updateDataModel":{"surfaceId":"ranking-1","path":"/ranked","value":[
    {"rank":1,"label":"Columbus & Green","total":92,"visibility":90,"access":99},
    {"rank":2,"label":"Columbus & Union","total":88,"visibility":85,"access":97}
  ]}}
]

Only put real, tool-sourced place data into surfaces. Never invent place facts.
`.trim();
