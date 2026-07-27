/**
 * CameraDirector — a pure reducer from camera intent + viewport to a concrete
 * camera command.
 *
 * Before the shell became a grid, the camera had to fake map padding: it read
 * `.copilot-dock`'s height off the DOM, read `--drawer-w` off computed styles,
 * branched on `window.innerWidth`, converted the resulting pixel offsets into
 * world coordinates and shifted the target center by them. That math ran inside
 * a React effect, depended on chrome whose height changed while a surface was
 * still streaming, and could not be unit tested.
 *
 * Now the map owns a real grid cell. On desktop nothing overlaps it, so a
 * "fly to X" is literally a move to X. Only the mobile sheet still floats over
 * the map, and it reports its height as viewport padding — one honest number,
 * measured by the element that knows it, rather than inferred by the consumer.
 */
import type { CameraIntent, LatLng } from '@/lib/types';

/** Chrome that overlaps the map cell, in CSS pixels. Zero on desktop. */
export interface ViewportPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const NO_PADDING: ViewportPadding = { top: 0, right: 0, bottom: 0, left: 0 };

/** Who last moved the camera. A user gesture suspends automatic movement. */
export type CameraOwner = 'agent' | 'user';

export type CameraCommand =
  | { kind: 'move'; center: LatLng; zoom?: number; heading?: number; tilt?: number }
  | { kind: 'pan'; center: LatLng; zoom?: number; heading?: number; tilt?: number }
  | { kind: 'fit'; bounds: LatLng[]; padding: ViewportPadding }
  | { kind: 'fly3d'; center: LatLng & { altitude?: number }; range?: number; heading?: number; tilt?: number; durationMs?: number }
  | { kind: 'orbit3d'; center: LatLng & { altitude?: number }; range?: number; tilt?: number; repeatCount?: number; durationMs?: number }
  | { kind: 'stop3d' }
  | { kind: 'none' };

/**
 * The map mode an intent *requires*, or null when either mode can execute it.
 *
 * `fly3d` and `orbit3d` can only be executed by the photorealistic 3D map. On a
 * 2D map they used to be dropped on the floor — `Camera2D` has no branch for
 * them and then cleared the intent — so asking for a 3D fly-over outside the
 * Cinema recipe did nothing at all, while a plain `fly` carrying a tilt merely
 * pitched the 2D map. Naming the requirement here lets the host escalate into
 * real 3D instead of silently approximating it.
 *
 * `stop3d` is deliberately excluded: stopping an animation must never be a
 * reason to *enter* 3D.
 */
export function intentRequiresMode(intent: CameraIntent | null): '3d' | null {
  if (!intent) return null;
  return intent.kind === 'fly3d' || intent.kind === 'orbit3d' ? '3d' : null;
}

/** Padding for `fitBounds`, with a small breathing margin around the content. */
const EDGE_MARGIN = 24;

export function fitPadding(viewport: ViewportPadding): ViewportPadding {
  return {
    top: viewport.top + EDGE_MARGIN,
    right: viewport.right + EDGE_MARGIN,
    bottom: viewport.bottom + EDGE_MARGIN,
    left: viewport.left + EDGE_MARGIN,
  };
}

/**
 * Resolve one intent against the current viewport and camera ownership.
 *
 * `owner === 'user'` means the person grabbed the map; automatic movement is
 * suppressed until they hand control back (a new run, or an explicit recenter).
 * This is the foundation doc's rule that the map must not fight the user.
 */
export function resolveCamera(
  intent: CameraIntent | null,
  options: { viewport?: ViewportPadding; owner?: CameraOwner; mode?: '2d' | '3d' } = {},
): CameraCommand {
  const { viewport = NO_PADDING, owner = 'agent', mode = '2d' } = options;
  if (!intent) return { kind: 'none' };
  if (owner === 'user') return { kind: 'none' };

  switch (intent.kind) {
    case 'fly':
      // A 2D intent arriving in 3D mode is approximated with a fly-over rather
      // than dropped, so a recipe that only speaks 2D still moves the 3D camera.
      if (mode === '3d') {
        return {
          kind: 'fly3d',
          center: { ...intent.center, altitude: 120 },
          tilt: intent.tilt ?? 60,
          range: 1600,
          durationMs: 3000,
        };
      }
      return {
        kind: intent.animate ? 'pan' : 'move',
        center: intent.center,
        zoom: intent.zoom,
        heading: intent.heading,
        tilt: intent.tilt,
      };
    case 'fit':
      if (!intent.bounds.length) return { kind: 'none' };
      return { kind: 'fit', bounds: intent.bounds, padding: fitPadding(viewport) };
    case 'fly3d':
      return {
        kind: 'fly3d',
        center: intent.center,
        range: intent.range,
        heading: intent.heading,
        tilt: intent.tilt,
        durationMs: intent.durationMs,
      };
    case 'orbit3d':
      return {
        kind: 'orbit3d',
        center: intent.center,
        range: intent.range,
        tilt: intent.tilt,
        repeatCount: intent.repeatCount,
        durationMs: intent.durationMs,
      };
    case 'stop3d':
      return { kind: 'stop3d' };
    default:
      return { kind: 'none' };
  }
}
