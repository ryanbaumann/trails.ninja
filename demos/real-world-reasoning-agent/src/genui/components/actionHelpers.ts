/**
 * Pure helpers for building and resolving A2uiAction context objects fired
 * from catalog components (Button, ChoicePicker, PlaceCard, MapPreview,
 * AdCreative). Kept dependency-free and DOM-free so they're unit-testable
 * without jsdom.
 */
import { getAtPath } from '../protocol';
import type { A2uiAction } from '../protocol';
import type { SurfaceState } from '../store';

function isBindingLike(v: unknown): v is { path: string } {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && typeof (v as { path?: unknown }).path === 'string';
}

/**
 * Deep-resolve any `{path}` bindings found anywhere inside an action's
 * context object against the surface data model (honoring `scope` for
 * relative paths, same as `resolveDynamic`). Non-binding values pass through
 * unchanged; the result is always a plain object.
 */
export function resolveActionContext(context: unknown, dataModel: unknown, scope?: string): Record<string, unknown> {
  const resolve = (v: unknown): unknown => {
    if (isBindingLike(v)) return getAtPath(dataModel, v.path, scope);
    if (Array.isArray(v)) return v.map(resolve);
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = resolve(val);
      return out;
    }
    return v;
  };
  const resolved = resolve(context ?? {});
  return resolved && typeof resolved === 'object' && !Array.isArray(resolved)
    ? (resolved as Record<string, unknown>)
    : {};
}

/**
 * Replace every literal "{selection}" token inside string values of a context
 * tree with the chosen value(s) (arrays are joined with ", "). Used by
 * ChoicePicker so a single action context template can read naturally, e.g.
 * `{"prompt":"filter the list: {selection}"}`.
 */
export function interpolateSelection<T>(value: T, selection: unknown): T {
  const sel = Array.isArray(selection) ? selection.join(', ') : String(selection ?? '');
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return v.split('{selection}').join(sel);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = walk(val);
      return out;
    }
    return v;
  };
  return walk(value) as T;
}

/** Build a client→server A2uiAction envelope for `dispatchSurfaceAction`. */
export function buildAction(
  name: string,
  surface: SurfaceState,
  sourceComponentId: string,
  context: Record<string, unknown>,
): A2uiAction {
  return { name, surfaceId: surface.id, sourceComponentId, timestamp: new Date().toISOString(), context };
}
