/**
 * A2UI v0.9 protocol — the subset Atlas speaks. This is a native, dependency-free
 * TypeScript model of the Maps Agentic UI Toolkit wire format (googlemaps/a2ui).
 * Gemini emits these messages through the `render_surface` tool; the genui store
 * applies them and the React catalog renders them. The message envelope is kept
 * wire-compatible with `@a2ui/web_core`'s v0.9 zod schemas (verified in tests) so
 * the official Lit renderer stays swappable later.
 */

export const ATLAS_CATALOG_ID = 'atlas://maps-agentic-ui-catalog';

/** Data-model binding: read the value at a JSON-pointer-ish path. */
export interface DataBinding {
  path: string;
}

/**
 * A dynamic value is either a literal, or a `{path}` binding into the surface
 * data model. (A2UI also defines a `{call, args}` function form — intentionally
 * unsupported in Atlas v1 to keep the renderer simple.)
 */
export type Dynamic<T> = T | DataBinding;

/** A component node in the flat component list. `id` is required in Atlas's dialect. */
export interface ComponentNode {
  component: string;
  id: string;
  [prop: string]: unknown;
}

export interface CreateSurfaceMsg {
  version: 'v0.9';
  createSurface: { surfaceId: string; catalogId: string; theme?: unknown; sendDataModel?: boolean };
}
export interface UpdateComponentsMsg {
  version: 'v0.9';
  updateComponents: { surfaceId: string; components: ComponentNode[] };
}
export interface UpdateDataModelMsg {
  version: 'v0.9';
  updateDataModel: { surfaceId: string; path?: string; value?: unknown };
}
export interface DeleteSurfaceMsg {
  version: 'v0.9';
  deleteSurface: { surfaceId: string };
}

export type A2uiMessage =
  | CreateSurfaceMsg
  | UpdateComponentsMsg
  | UpdateDataModelMsg
  | DeleteSurfaceMsg;

/** A user-initiated action reported back to the agent (client→server). */
export interface A2uiAction {
  name: string;
  surfaceId: string;
  sourceComponentId: string;
  timestamp: string;
  context: Record<string, unknown>;
}

/** The component names the Atlas catalog knows how to render. */
export const CATALOG_COMPONENT_NAMES = new Set<string>([
  'Text',
  'Image',
  'Button',
  'Card',
  'Row',
  'Column',
  'List',
  'Divider',
  'ChoicePicker',
  'StatGrid',
  'PlaceCard',
  'MapPreview',
  'AdCreative',
  'Video',
  // Journey-proven "Atlas A2UI v0.9 subset" additions (see promptGuide.ts).
  'ProgressStatus',
  'RecoverableError',
  'EvidenceSource',
  'RouteItinerary',
  'EtaSummary',
  'ComparisonTable',
  'ConfirmationResult',
  'GroundingAttribution',
]);

const ROOT_ID = 'root';

/**
 * Per-component prop specs used by {@link validateMessages} to turn malformed
 * catalog-node props into actionable, model-facing errors instead of a silent
 * empty render. A prop is only flagged when it is a REQUIRED prop that is
 * entirely absent, or a PRESENT prop whose value is none of: a data binding
 * `{ path }`, a string carrying a mustache `{token}`, or the declared primitive
 * type. Bindings and mustache strings therefore always pass — so nothing that
 * renders fine today is rejected. Required props are chosen because the
 * component renders NOTHING without them (so an error beats a blank surface).
 *
 * Note: `Button` requires `child` (a component id) — the Atlas dialect renders a
 * Button's label from its `child` node, so a Button without one renders empty.
 */
export type PropPrimitive = 'string' | 'number' | 'array' | 'object';
export interface PropSpec {
  type: PropPrimitive;
  required?: boolean;
}
export const COMPONENT_PROP_SPEC: Record<string, Record<string, PropSpec>> = {
  Text: { text: { type: 'string', required: true } },
  Image: { url: { type: 'string', required: true }, alt: { type: 'string' } },
  Video: { url: { type: 'string', required: true } },
  PlaceCard: { placeId: { type: 'string', required: true } },
  MapPreview: {
    lat: { type: 'number', required: true },
    lng: { type: 'number', required: true },
    zoom: { type: 'number' },
    label: { type: 'string' },
  },
  Button: { child: { type: 'string', required: true } },
  AdCreative: {
    imageRef: { type: 'string' },
    headline: { type: 'string' },
    body: { type: 'string' },
    cta: { type: 'string' },
  },
  // Atlas A2UI v0.9 subset additions — each requires the one prop it renders
  // nothing without, so a malformed node reports an error instead of a blank.
  ProgressStatus: { label: { type: 'string', required: true } },
  RecoverableError: { message: { type: 'string', required: true } },
  EvidenceSource: { label: { type: 'string', required: true } },
  RouteItinerary: { steps: { type: 'array', required: true } },
  EtaSummary: { duration: { type: 'string', required: true } },
  ComparisonTable: {
    columns: { type: 'array', required: true },
    rows: { type: 'array', required: true },
  },
  ConfirmationResult: { title: { type: 'string', required: true } },
  GroundingAttribution: {
    title: { type: 'string', required: true },
    url: { type: 'string', required: true },
    placeUrl: { type: 'string' },
    provider: { type: 'string' },
  },
};

/** A string carrying at least one mustache `{token}` (a model near-miss that
 *  resolveDisplayText/resolveMediaRef interpolate at render time). */
const MUSTACHE_TOKEN = /\{[^}]+\}/;

export interface ComponentGraphResult {
  errors: string[];
  /** Components not reachable from root. Safe for the store to discard. */
  orphanIds: string[];
  reachableIds: Set<string>;
}

/**
 * Return the structural component references understood by Atlas's catalog.
 * Keeping this centralized makes graph validation linear in nodes + edges and
 * prevents the validator and recursive renderer from drifting apart.
 */
export function componentChildIds(node: ComponentNode): string[] {
  const refs: string[] = [];
  if (typeof node.child === 'string') refs.push(node.child);
  if (Array.isArray(node.children)) {
    for (const child of node.children) if (typeof child === 'string') refs.push(child);
  } else if (isRecord(node.children) && typeof node.children.componentId === 'string') {
    refs.push(node.children.componentId);
  }
  return refs;
}

/**
 * The top-level (unreferenced) component ids in a flat component map — the nodes
 * a synthesized "root" should wrap so the whole tree stays reachable. `root`
 * itself is excluded. Falls back to every id when every node is referenced (e.g.
 * a fully-connected batch or a cycle) so a synthesized root is never childless.
 */
export function topLevelComponentIds(components: Record<string, ComponentNode>): string[] {
  const referenced = new Set<string>();
  for (const node of Object.values(components)) {
    for (const childId of componentChildIds(node)) referenced.add(childId);
  }
  const ids = Object.keys(components).filter((id) => id !== ROOT_ID);
  const topLevel = ids.filter((id) => !referenced.has(id));
  return topLevel.length ? topLevel : ids;
}

/** Validate root reachability, missing references, and cycles in O(n + e). */
export function validateComponentGraph(
  components: Record<string, ComponentNode>,
  surfaceId = 'surface',
): ComponentGraphResult {
  const errors: string[] = [];
  const reachableIds = new Set<string>();
  const root = components[ROOT_ID];
  if (!root) {
    return {
      errors: [`surface "${surfaceId}": missing component "${ROOT_ID}"`],
      orphanIds: Object.keys(components),
      reachableIds,
    };
  }

  // 0 = unseen, 1 = visiting, 2 = complete. Iterative DFS avoids call-stack
  // failures on model-generated trees near the renderer's depth limit.
  const state = new Map<string, 0 | 1 | 2>();
  const stack: Array<{ id: string; exit: boolean }> = [{ id: ROOT_ID, exit: false }];
  while (stack.length) {
    const frame = stack.pop()!;
    if (frame.exit) {
      state.set(frame.id, 2);
      continue;
    }
    const status = state.get(frame.id) ?? 0;
    if (status === 2) continue;
    if (status === 1) {
      errors.push(`surface "${surfaceId}": cycle detected at component "${frame.id}"`);
      continue;
    }
    const node = components[frame.id];
    if (!node) continue;
    reachableIds.add(frame.id);
    state.set(frame.id, 1);
    stack.push({ id: frame.id, exit: true });
    for (const childId of componentChildIds(node)) {
      if (!components[childId]) {
        errors.push(`surface "${surfaceId}": component "${frame.id}" references missing child "${childId}"`);
      } else if ((state.get(childId) ?? 0) === 1) {
        errors.push(`surface "${surfaceId}": cycle detected at component "${childId}"`);
      } else {
        stack.push({ id: childId, exit: false });
      }
    }
  }

  return {
    errors: [...new Set(errors)],
    orphanIds: Object.keys(components).filter((id) => !reachableIds.has(id)),
    reachableIds,
  };
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  messages: A2uiMessage[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isBinding(v: unknown): v is DataBinding {
  return isRecord(v) && typeof v.path === 'string';
}

/** A prop value is acceptable when it's a binding, a mustache string, or the
 *  declared primitive type. Bindings and mustache tokens resolve at render time,
 *  so they always pass regardless of the declared type. */
function propValueOk(value: unknown, type: PropPrimitive): boolean {
  if (isBinding(value)) return true;
  if (typeof value === 'string' && MUSTACHE_TOKEN.test(value)) return true;
  if (type === 'array') return Array.isArray(value);
  // A record (not an array) — `isRecord` already excludes arrays and null.
  if (type === 'object') return isRecord(value);
  return typeof value === type;
}

/** Human hint describing what a prop accepts, reused by both the "required" and
 *  "wrong type" messages so the model sees a consistent, actionable shape. */
function propHint(prop: string, type: PropPrimitive): string {
  if (type === 'number') return 'a number or a {"path":"…"} binding';
  if (type === 'array') return 'an array or a {"path":"…"} binding';
  if (type === 'object') return 'an object or a {"path":"…"} binding';
  if (prop === 'url' || prop === 'imageRef') {
    return 'a string URL, an "img:<id>" ref, or a {"path":"…"} binding';
  }
  return 'a string or a {"path":"…"} binding';
}

/**
 * Validate a single catalog node's props against COMPONENT_PROP_SPEC, returning
 * actionable error strings (empty when the component has no spec or all props are
 * acceptable). `at`/`j` locate the node for the model, matching the surrounding
 * validateMessages error style.
 */
function validateComponentProps(c: Record<string, unknown>, at: string, j: number): string[] {
  const spec = typeof c.component === 'string' ? COMPONENT_PROP_SPEC[c.component] : undefined;
  if (!spec) return [];
  const errors: string[] = [];
  for (const [prop, ps] of Object.entries(spec)) {
    const present = prop in c && c[prop] !== undefined;
    if (!present) {
      if (ps.required) {
        errors.push(`${at}.components[${j}] (${c.component}): "${prop}" is required — ${propHint(prop, ps.type)}`);
      }
      continue;
    }
    if (!propValueOk(c[prop], ps.type)) {
      errors.push(`${at}.components[${j}] (${c.component}): "${prop}" must be ${propHint(prop, ps.type)}`);
    }
  }
  return errors;
}

/**
 * Structural validator for an array of A2UI messages. Returns readable error
 * strings that are fed back to Gemini so it can self-correct on the next hop.
 * `known` tracks surfaceIds already created earlier in the SAME batch so that
 * "component list before createSurface" is flagged; callers that update an
 * already-existing surface across batches should pass it in `existingSurfaces`.
 */
export function validateMessages(raw: unknown, existingSurfaces?: Set<string>): ValidationResult {
  const errors: string[] = [];
  const messages: A2uiMessage[] = [];
  const known = new Set<string>(existingSurfaces ?? []);
  const rootedSurfaces = new Set<string>();
  const batchComponents = new Map<string, Record<string, ComponentNode>>();

  if (!Array.isArray(raw)) {
    return { ok: false, errors: ['messages must be a JSON array of A2UI v0.9 messages'], messages: [] };
  }

  raw.forEach((m, i) => {
    const at = `message[${i}]`;
    if (!isRecord(m)) {
      errors.push(`${at}: must be an object`);
      return;
    }
    if (m.version !== 'v0.9') {
      errors.push(`${at}: version must be the literal "v0.9"`);
      return;
    }
    const ops = Object.keys(m).filter((k) => ['createSurface', 'updateComponents', 'updateDataModel', 'deleteSurface'].includes(k));
    if (ops.length !== 1) {
      errors.push(`${at}: must have exactly one of createSurface/updateComponents/updateDataModel/deleteSurface`);
      return;
    }
    const key = ops[0];

    if (key === 'createSurface') {
      const body = (m as Record<string, unknown>).createSurface;
      if (!isRecord(body) || typeof body.surfaceId !== 'string') {
        errors.push(`${at}.createSurface: needs a string surfaceId`);
        return;
      }
      if (typeof body.catalogId !== 'string') {
        errors.push(`${at}.createSurface: needs a string catalogId (use "${ATLAS_CATALOG_ID}")`);
        return;
      }
      known.add(body.surfaceId);
      messages.push(m as unknown as CreateSurfaceMsg);
      return;
    }

    if (key === 'updateComponents') {
      const body = (m as Record<string, unknown>).updateComponents;
      if (!isRecord(body) || typeof body.surfaceId !== 'string') {
        errors.push(`${at}.updateComponents: needs a string surfaceId`);
        return;
      }
      if (!known.has(body.surfaceId)) {
        errors.push(`${at}.updateComponents: surface "${body.surfaceId}" was never created (send createSurface first)`);
      }
      if (!Array.isArray(body.components)) {
        errors.push(`${at}.updateComponents: components must be an array`);
        return;
      }
      body.components.forEach((c, j) => {
        if (!isRecord(c)) {
          errors.push(`${at}.components[${j}]: must be an object`);
          return;
        }
        if (typeof c.component !== 'string') {
          errors.push(`${at}.components[${j}]: missing "component" name`);
          return;
        }
        if (typeof c.id !== 'string') {
          errors.push(`${at}.components[${j}] (${c.component}): missing string "id"`);
        }
        if (!CATALOG_COMPONENT_NAMES.has(c.component)) {
          errors.push(
            `${at}.components[${j}]: unknown component "${c.component}". Known: ${[...CATALOG_COMPONENT_NAMES].join(', ')}`,
          );
        } else {
          // Known component: validate its props so a malformed node reports an
          // actionable error instead of rendering a silent empty surface.
          errors.push(...validateComponentProps(c, at, j));
        }
        if (c.id === ROOT_ID) rootedSurfaces.add(body.surfaceId as string);
        if (typeof c.id === 'string' && typeof c.component === 'string') {
          const components = batchComponents.get(body.surfaceId as string) ?? {};
          if (components[c.id]) {
            errors.push(`${at}.components[${j}]: duplicate component id "${c.id}" in this batch`);
          }
          components[c.id] = c as unknown as ComponentNode;
          batchComponents.set(body.surfaceId as string, components);
        }
      });
      messages.push(m as unknown as UpdateComponentsMsg);
      return;
    }

    if (key === 'updateDataModel') {
      const body = (m as Record<string, unknown>).updateDataModel;
      if (!isRecord(body) || typeof body.surfaceId !== 'string') {
        errors.push(`${at}.updateDataModel: needs a string surfaceId`);
        return;
      }
      if (body.path !== undefined && typeof body.path !== 'string') {
        errors.push(`${at}.updateDataModel: path must be a string like "/places"`);
      }
      messages.push(m as unknown as UpdateDataModelMsg);
      return;
    }

    if (key === 'deleteSurface') {
      const body = (m as Record<string, unknown>).deleteSurface;
      if (!isRecord(body) || typeof body.surfaceId !== 'string') {
        errors.push(`${at}.deleteSurface: needs a string surfaceId`);
        return;
      }
      messages.push(m as unknown as DeleteSurfaceMsg);
      return;
    }

    errors.push(`${at}: unknown message type "${key}"`);
  });

  // Every surface NEWLY introduced in this batch must define a "root". Surfaces
  // created in an earlier batch (passed via existingSurfaces) already have a root
  // in the store — the store MERGES components — so a partial update that touches
  // only some children (the natural way to UPDATE a surface) must not be rejected.
  for (const sid of rootedSurfaces) known.add(sid);
  const preexisting = existingSurfaces ?? new Set<string>();
  const surfacesWithComponents = new Set(
    messages
      .filter((m): m is UpdateComponentsMsg => 'updateComponents' in m)
      .map((m) => m.updateComponents.surfaceId),
  );
  for (const sid of surfacesWithComponents) {
    if (!rootedSurfaces.has(sid) && !preexisting.has(sid)) {
      errors.push(`surface "${sid}": updateComponents must include a component with id "root"`);
    }
    // A complete graph is available for newly created surfaces. Existing
    // surfaces may be partial patches, so their final graph is checked by the
    // atomic store reducer after merging with prior state.
    if (!preexisting.has(sid) && rootedSurfaces.has(sid)) {
      const graph = validateComponentGraph(batchComponents.get(sid) ?? {}, sid);
      errors.push(...graph.errors);
      if (graph.orphanIds.length) {
        errors.push(`surface "${sid}": orphaned components: ${graph.orphanIds.join(', ')}`);
      }
    }
  }

  return { ok: errors.length === 0, errors, messages };
}

/* ------------------------------------------------------------------ *
 * Lenient input normalization                                          *
 *                                                                      *
 * `gemini-3.7-flash` routinely emits A2UI that is a near-miss for the *
 * strict validator — which turned into a "Rendering the response" error *
 * chip and no card. These deterministic repairs turn the common        *
 * near-misses into valid input so the surface renders instead of failing: *
 *  - a JSON string / fenced block / {messages:[…]} / a single message  *
 *    object → a flat message array                                     *
 *  - a wrong or missing `version` → "v0.9"                             *
 *  - a missing/foreign createSurface `catalogId` → the Atlas catalog   *
 *  - inline-nested child component objects → hoisted into the flat list *
 *  - updateComponents/updateDataModel for an uncreated surface → a      *
 *    synthetic createSurface is prepended                              *
 *  - a new surface whose components omit "root" → a synthetic root      *
 *    Column wrapping the top-level components                          *
 * Anything it can't repair is passed through so validateMessages emits  *
 * the precise error for the model to self-correct on the next hop.      */

function tryParseJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    // Fall back to the first bracketed span, in case of surrounding prose.
    const first = Math.min(...['[', '{'].map((c) => (s.indexOf(c) + 1 || Infinity)).map((n) => n - 1));
    const open = s.indexOf('[') >= 0 && (s.indexOf('{') < 0 || s.indexOf('[') < s.indexOf('{')) ? '[' : '{';
    const close = open === '[' ? ']' : '}';
    const start = s.indexOf(open);
    const end = s.lastIndexOf(close);
    if (start >= 0 && end > start && Number.isFinite(first)) {
      try {
        return JSON.parse(s.slice(start, end + 1));
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
}

/** Coerce arbitrary render_surface input into an array of message objects (or the
 *  original value untouched when it clearly isn't one, so the validator complains). */
function coerceToMessageArray(raw: unknown): unknown {
  let v = raw;
  if (typeof v === 'string') {
    const cleaned = v.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
    v = tryParseJson(cleaned);
    if (v === undefined) return raw;
  }
  if (isRecord(v) && Array.isArray((v as Record<string, unknown>).messages)) {
    v = (v as Record<string, unknown>).messages;
  }
  if (Array.isArray(v)) return v;
  if (isRecord(v)) return [v]; // a single message object → wrap it
  return raw;
}

/** Child ids referenced by a component (children array, single child, or a List
 *  template's componentId) — used to find the top-level (unreferenced) nodes. */
function referencedChildIds(components: Record<string, unknown>[]): Set<string> {
  const refs = new Set<string>();
  for (const c of components) {
    const kids = c.children;
    if (Array.isArray(kids)) {
      for (const k of kids) if (typeof k === 'string') refs.add(k);
    } else if (isRecord(kids) && typeof kids.componentId === 'string') {
      refs.add(kids.componentId);
    }
    if (typeof c.child === 'string') refs.add(c.child);
  }
  return refs;
}

/** Flatten inline-nested child component objects into A2UI's required flat list:
 *  a child given as an object is hoisted out and replaced by its id (a synthetic
 *  id is assigned if it has none). */
function flattenComponents(components: unknown[]): Record<string, unknown>[] {
  const flat: Record<string, unknown>[] = [];
  let auto = 0;
  const visit = (node: unknown): unknown => {
    if (!isRecord(node)) return node;
    const c: Record<string, unknown> = { ...node };
    if (typeof c.id !== 'string' || !c.id) c.id = `_auto${auto++}`;
    if (isRecord(c.child)) c.child = visit(c.child);
    if (Array.isArray(c.children)) c.children = c.children.map((ch) => (isRecord(ch) ? visit(ch) : ch));
    flat.push(c);
    return c.id;
  };
  for (const node of components) visit(node);
  return flat;
}

function refSurfaceId(m: Record<string, unknown>): string | undefined {
  for (const key of ['updateComponents', 'updateDataModel'] as const) {
    const body = m[key];
    if (isRecord(body) && typeof body.surfaceId === 'string') return body.surfaceId;
  }
  return undefined;
}

/**
 * Best-effort repair of render_surface input before strict validation. See the
 * block comment above. Exported for unit testing. Returns the original value
 * untouched when it isn't coercible to a message array.
 */
export function normalizeA2uiInput(raw: unknown, existingSurfaces?: Set<string>): unknown {
  const arr = coerceToMessageArray(raw);
  if (!Array.isArray(arr)) return arr;

  // 1. Per-message repairs: version, createSurface catalogId, flatten components,
  //    wrap bare top-level `components` into updateComponents, drop operation-less messages.
  const msgs: Record<string, unknown>[] = [];
  let lastCreatedSurfaceId: string | undefined;

  for (const m of arr) {
    if (!isRecord(m)) {
      msgs.push(m as Record<string, unknown>);
      continue;
    }
    const out: Record<string, unknown> = { ...m, version: 'v0.9' };

    // Track the most recent createSurface for inferring surfaceId later.
    if (isRecord(out.createSurface)) {
      const cs = { ...(out.createSurface as Record<string, unknown>) };
      if (typeof cs.catalogId !== 'string' || !cs.catalogId) cs.catalogId = ATLAS_CATALOG_ID;
      out.createSurface = cs;
      if (typeof cs.surfaceId === 'string') lastCreatedSurfaceId = cs.surfaceId;
    }

    if (isRecord(out.updateComponents)) {
      const uc = { ...(out.updateComponents as Record<string, unknown>) };
      if (Array.isArray(uc.components)) uc.components = flattenComponents(uc.components);
      out.updateComponents = uc;
    }

    // Repair: bare top-level `components` array → wrap into updateComponents.
    if (Array.isArray(out.components) && !out.updateComponents && !out.createSurface && !out.updateDataModel && !out.deleteSurface) {
      // Infer surfaceId from the most recent createSurface, or the single known surface if unambiguous.
      const inferredId = lastCreatedSurfaceId ?? (existingSurfaces?.size === 1 ? [...existingSurfaces][0] : undefined);
      if (inferredId) {
        out.updateComponents = {
          surfaceId: inferredId,
          components: flattenComponents(out.components),
        };
        delete out.components;
        delete out.surfaceId;
      }
    }

    // Drop operation-less messages (only {version}, no operation field).
    const ops = Object.keys(out).filter((k) => ['createSurface', 'updateComponents', 'updateDataModel', 'deleteSurface'].includes(k));
    if (ops.length === 0) continue;

    msgs.push(out);
  }

  // 2. Prepend a createSurface for any surface referenced before it exists.
  const preexisting = existingSurfaces ?? new Set<string>();
  const known = new Set<string>(preexisting);
  const withCreates: Record<string, unknown>[] = [];
  for (const m of msgs) {
    if (isRecord(m.createSurface)) {
      const id = (m.createSurface as Record<string, unknown>).surfaceId;
      if (typeof id === 'string') known.add(id);
      withCreates.push(m);
      continue;
    }
    const ref = refSurfaceId(m);
    if (ref && !known.has(ref)) {
      withCreates.push({ version: 'v0.9', createSurface: { surfaceId: ref, catalogId: ATLAS_CATALOG_ID } });
      known.add(ref);
    }
    withCreates.push(m);
  }

  // 3. Inject a synthetic "root" for NEW surfaces whose components omit one.
  const hasRoot = new Set<string>();
  const firstUc = new Map<string, Record<string, unknown>>();
  for (const m of withCreates) {
    if (!isRecord(m.updateComponents)) continue;
    const uc = m.updateComponents as Record<string, unknown>;
    const sid = uc.surfaceId;
    if (typeof sid !== 'string') continue;
    const comps = (Array.isArray(uc.components) ? uc.components : []) as Record<string, unknown>[];
    if (comps.some((c) => c.id === ROOT_ID)) hasRoot.add(sid);
    if (!firstUc.has(sid)) firstUc.set(sid, uc);
  }
  for (const [sid, uc] of firstUc) {
    if (preexisting.has(sid) || hasRoot.has(sid)) continue;
    const all = withCreates
      .filter((m) => isRecord(m.updateComponents) && (m.updateComponents as Record<string, unknown>).surfaceId === sid)
      .flatMap((m) => ((m.updateComponents as Record<string, unknown>).components as Record<string, unknown>[]) ?? []);
    const ids = all.map((c) => c.id).filter((id): id is string => typeof id === 'string' && id !== ROOT_ID);
    const refs = referencedChildIds(all);
    const topLevel = ids.filter((id) => !refs.has(id));
    const comps = uc.components as Record<string, unknown>[];
    comps.unshift({ id: ROOT_ID, component: 'Column', children: topLevel.length ? topLevel : ids });
  }

  return withCreates;
}

/** Split a JSON-pointer-ish path ("/a/b" or "a/b") into segments. */
export function pathSegments(path: string): string[] {
  return path.split('/').filter((s) => s.length > 0);
}

/** Read a value from an object tree at a slash path. `scopePath` prefixes relative paths. */
export function getAtPath(root: unknown, path: string, scopePath?: string): unknown {
  const abs = path.startsWith('/') ? path : `${scopePath ? scopePath.replace(/\/$/, '') + '/' : '/'}${path}`;
  let cur: unknown = root;
  for (const seg of pathSegments(abs)) {
    if (Array.isArray(cur)) {
      const idx = Number(seg);
      cur = Number.isInteger(idx) ? cur[idx] : undefined;
    } else if (isRecord(cur)) {
      cur = cur[seg];
    } else {
      return undefined;
    }
    if (cur === undefined) return undefined;
  }
  return cur;
}

/** Immutably set a value at a slash path, creating intermediate objects/arrays. */
export function setAtPath(root: Record<string, unknown>, path: string | undefined, value: unknown): Record<string, unknown> {
  if (!path || pathSegments(path).length === 0) {
    // Whole-model replace.
    return isRecord(value) ? { ...value } : { value };
  }
  const segs = pathSegments(path);
  const next = { ...root };
  let cur: Record<string, unknown> = next;
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i];
    const existing = cur[seg];
    const clone = isRecord(existing) ? { ...existing } : {};
    cur[seg] = clone;
    cur = clone;
  }
  cur[segs[segs.length - 1]] = value;
  return next;
}

/** Resolve a dynamic value against the data model, honoring a relative scope. */
export function resolveDynamic<T>(v: Dynamic<T> | undefined, dataModel: unknown, scopePath?: string): T | undefined {
  if (v === undefined) return undefined;
  if (isBinding(v)) return getAtPath(dataModel, v.path, scopePath) as T | undefined;
  return v as T;
}

/**
 * Interpolate `{path}` tokens inside a literal string against the data model,
 * honoring a relative scope (e.g. a List template item). Models routinely emit
 * mustache-style text like "{label} — score {total}" inside List templates;
 * without this the raw tokens render on screen. A token is replaced only when
 * its path resolves to a primitive — unresolvable or object-valued tokens are
 * left untouched so legitimate braces in prose survive.
 */
/** A `{path}` binding-shaped token inside a literal string (mustache style). */
const PLACEHOLDER_TOKEN = /\{(\/?[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*)\}/g;

export function interpolate(text: string, dataModel: unknown, scopePath?: string): string {
  if (!text.includes('{')) return text;
  return text.replace(PLACEHOLDER_TOKEN, (token, path: string) => {
    const v = getAtPath(dataModel, path, scopePath);
    if (v === undefined || v === null || typeof v === 'object') return token;
    return String(v);
  });
}

/**
 * Remove any binding-shaped `{path}` tokens that survived interpolation — these
 * are model near-misses (a mustache placeholder the data model never satisfied)
 * that would otherwise leak raw "{headline}" braces onto the surface. Only bare,
 * binding-shaped tokens are stripped, so legitimate prose braces like
 * "{ spaced }" survive; the whitespace a removed token leaves is collapsed.
 * Apply ONLY to interpolated literals, never to bound data values.
 */
export function dropUnresolvedTokens(text: string): string {
  if (!text.includes('{')) return text;
  return text.replace(PLACEHOLDER_TOKEN, '').replace(/[ \t]{2,}/g, ' ').trim();
}

/**
 * Canonical resolver for a text-bearing prop on a display component: resolve the
 * dynamic value, interpolate `{path}` tokens when it was a literal, and drop any
 * still-unresolved placeholder tokens so a broken binding renders as empty
 * instead of leaking raw braces. Bound values (real data) are returned verbatim.
 */
export function resolveDisplayText(
  v: Dynamic<unknown> | undefined,
  dataModel: unknown,
  scopePath?: string,
): string {
  if (typeof v !== 'string') {
    const raw = resolveDynamic(v, dataModel, scopePath);
    return raw == null ? '' : String(raw);
  }
  // A literal string: interpolate its {path} tokens, then drop any that the data
  // model never satisfied so raw braces never reach the surface.
  return dropUnresolvedTokens(interpolate(v, dataModel, scopePath));
}

/**
 * Resolve a media reference prop (AdCreative.imageRef, Image/Video.url) to a raw
 * string src. Like resolveDisplayText, it accepts both a data binding
 * {"path":...} and a mustache `{path}` literal token — models routinely emit
 * `imageRef: "{imageRef}"` inside a List template instead of the documented
 * binding form, and without token interpolation the literal `"{imageRef}"` reaches
 * the image guard, fails, and the card renders an empty poster. A binding or a
 * bare `img:<id>`/URL literal passes through unchanged; an unresolvable token
 * yields undefined so the component shows its empty state instead of leaking braces.
 */
export function resolveMediaRef(
  v: Dynamic<unknown> | undefined,
  dataModel: unknown,
  scopePath?: string,
): string | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== 'string') {
    const raw = resolveDynamic(v, dataModel, scopePath);
    return typeof raw === 'string' && raw ? raw : undefined;
  }
  const resolved = dropUnresolvedTokens(interpolate(v, dataModel, scopePath));
  return resolved || undefined;
}
