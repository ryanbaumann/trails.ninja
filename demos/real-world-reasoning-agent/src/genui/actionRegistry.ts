/**
 * Typed action registry for A2UI surfaces.
 *
 * Surfaces can be authored by the model (`render_surface`), so an action name
 * and its context are untrusted input. The previous dispatcher forwarded any
 * unrecognised action to the agent as
 * `sendToCopilot('[ui-action] ' + name + JSON.stringify(context))` — which meant
 * a surface could put arbitrary attacker-chosen text into the next user turn
 * just by naming an action nobody registered. A capability the host never
 * granted became a prompt.
 *
 * Every action a surface may invoke is now declared here with a validator.
 * Anything else is refused and reported, never forwarded.
 *
 * This module is pure: it decides *what* an action means. Executing the result
 * (moving the camera, sending a prompt) stays in `actions.ts`.
 */

export type ActionName =
  | 'fly_to'
  | 'select_place'
  | 'send_prompt'
  | 'open_url'
  | 'download_image'
  | 'explorer_change_travel_mode';

export type ResolvedAction =
  | { name: 'fly_to'; center: { lat: number; lng: number }; zoom?: number }
  | { name: 'select_place'; placeId: string }
  | { name: 'send_prompt'; prompt: string }
  | { name: 'open_url'; url: string }
  | { name: 'download_image'; dataUrl: string; filename: string }
  | { name: 'explorer_change_travel_mode'; travelMode: 'WALK' | 'DRIVE' };

export type ActionResolution =
  | { ok: true; action: ResolvedAction }
  | { ok: false; reason: string };

/** Longest prompt a surface control may hand back to the agent. */
export const SURFACE_PROMPT_MAX = 500;

const numeric = (value: unknown): number | undefined => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

/** https/mailto only — blocks javascript:, data:, and relative escapes. */
export function isSafeHref(href: string, origin = 'https://atlas.invalid'): boolean {
  try {
    const url = new URL(href, origin);
    return url.protocol === 'https:' || url.protocol === 'mailto:';
  } catch {
    return false;
  }
}

/** Only base64 image data URLs may reach the download path. */
function isSafeImageDataUrl(value: string): boolean {
  return /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/.test(value);
}

/**
 * Resolve an action name + context into a typed action, or refuse it.
 * Unknown names are refused rather than being reinterpreted as a prompt.
 */
export function resolveSurfaceAction(name: string, context: Record<string, unknown> = {}): ActionResolution {
  switch (name) {
    case 'fly_to': {
      const lat = numeric(context.lat);
      const lng = numeric(context.lng);
      if (lat === undefined || lng === undefined) return { ok: false, reason: 'fly_to needs numeric lat and lng' };
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return { ok: false, reason: 'fly_to coordinates are out of range' };
      }
      const zoom = numeric(context.zoom);
      return {
        ok: true,
        action: { name: 'fly_to', center: { lat, lng }, ...(zoom === undefined ? {} : { zoom }) },
      };
    }
    case 'select_place': {
      const placeId = text(context.placeId);
      if (!placeId) return { ok: false, reason: 'select_place needs a placeId' };
      return { ok: true, action: { name: 'select_place', placeId } };
    }
    case 'send_prompt': {
      const prompt = text(context.prompt);
      if (!prompt) return { ok: false, reason: 'send_prompt needs a prompt' };
      if (prompt.length > SURFACE_PROMPT_MAX) {
        return { ok: false, reason: 'send_prompt exceeded the allowed prompt length' };
      }
      return { ok: true, action: { name: 'send_prompt', prompt } };
    }
    case 'open_url': {
      const url = text(context.url);
      if (!url || !isSafeHref(url)) return { ok: false, reason: 'open_url requires an https or mailto link' };
      return { ok: true, action: { name: 'open_url', url } };
    }
    case 'download_image': {
      const dataUrl = text(context.dataUrl);
      if (!dataUrl || !isSafeImageDataUrl(dataUrl)) {
        return { ok: false, reason: 'download_image requires a base64 image data URL' };
      }
      // Strip any path traversal a surface tried to smuggle into the filename:
      // separators, then leading dots, then anything outside a safe charset.
      const safeName = (text(context.filename) ?? 'atlas-image.png')
        .replace(/[/\\]/g, '-')
        .replace(/\.{2,}/g, '.')
        .replace(/^[.\-\s]+/, '')
        .replace(/[^A-Za-z0-9._-]/g, '_')
        .slice(0, 80);
      return {
        ok: true,
        action: { name: 'download_image', dataUrl, filename: safeName || 'atlas-image.png' },
      };
    }
    case 'explorer_change_travel_mode': {
      const travelMode = context.travelMode;
      if (travelMode !== 'WALK' && travelMode !== 'DRIVE') {
        return { ok: false, reason: 'explorer_change_travel_mode accepts WALK or DRIVE' };
      }
      return { ok: true, action: { name: 'explorer_change_travel_mode', travelMode } };
    }
    default:
      return { ok: false, reason: `Unregistered surface action: ${name}` };
  }
}
