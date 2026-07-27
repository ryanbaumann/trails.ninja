import type { ToolDefinition } from '@/lib/types';
import type { CapabilityDefinition, HostEffect } from './effects';
import { capabilityDeclaration } from './manifest';
import { atlas } from '@/state/store';
import { uid } from '@/lib/id';
import { PRESENTATION_CAPABILITIES } from './presentation';
import { WORLD_CAPABILITIES } from './world';

export function applyAtlasEffects(effects: readonly HostEffect[]): void {
  for (const effect of effects) {
    const state = atlas();
    switch (effect.type) {
      case 'map.fly':
        if (state.mapMode === '3d') {
          state.setCamera({
            kind: 'fly3d',
            center: { ...effect.center, altitude: 60 },
            range: 1400,
            tilt: effect.tilt ?? 60,
            heading: effect.heading ?? 0,
          });
        } else {
          state.setCamera({
            kind: 'fly',
            center: effect.center,
            zoom: effect.zoom ?? 15,
            heading: effect.heading,
            tilt: effect.tilt,
            animate: true,
          });
        }
        break;
      case 'map.add-markers':
        state.addMarkers(effect.markers.map((marker) => ({
          id: uid('m'),
          position: marker.position,
          glyph: marker.label?.slice(0, 2),
          title: marker.title,
          color: marker.color,
          kind: 'pin',
          placeId: marker.placeId,
          scenario: state.activeScenario,
        })));
        break;
      case 'map.replace-markers':
        state.setMarkers(effect.markers.map((marker, index) => ({
          id: `${effect.scope}-marker-${index + 1}`,
          position: marker.position,
          glyph: marker.label?.slice(0, 2),
          title: marker.title,
          color: marker.color,
          kind: 'pin',
          placeId: marker.placeId,
          scenario: state.activeScenario,
          meta: { effectScope: effect.scope },
        })));
        break;
      case 'map.fit':
        if (effect.points.length) state.setCamera({ kind: 'fit', bounds: [...effect.points] });
        break;
      case 'map.replace-route':
        state.setRoutes(effect.route ? [{
          id: `${effect.scope}-route`,
          path: effect.route.path,
          color: effect.route.color,
          width: 5,
          scenario: state.activeScenario,
        }] : []);
        break;
      case 'map.add-route':
        state.addRoute({
          id: uid('r'),
          path: effect.route.path,
          color: effect.route.color ?? '#22d3ee',
          width: 5,
          scenario: state.activeScenario,
        });
        break;
      case 'map.select-place': {
        if (effect.placeId === null) {
          state.selectMarker(null);
          break;
        }
        const marker = state.markers.find((m) => m.placeId === effect.placeId);
        state.selectMarker(marker?.id ?? null);
        break;
      }
      case 'map.clear':
        state.clearMap();
        break;
      case 'chat.notice':
        state.addMsg({
          id: uid('n'),
          role: 'notice',
          notice: { title: effect.title, body: effect.body },
          ts: Date.now(),
        });
        break;
    }
  }
}

export function capabilityTool(
  definition: CapabilityDefinition,
  effectSink: (effects: readonly HostEffect[]) => void = applyAtlasEffects,
): ToolDefinition {
  return {
    declaration: capabilityDeclaration(definition.manifest),
    async handler(args, signal) {
      if (signal?.aborted) return { ok: false, error: 'cancelled' };
      let execution;
      try {
        execution = await definition.execute(args, {
          cancellation: signal ? {
            get aborted() { return signal.aborted; },
            subscribe(listener) {
              signal.addEventListener('abort', listener, { once: true });
              return () => signal.removeEventListener('abort', listener);
            },
          } : undefined,
        });
      } catch (cause) {
        if (signal?.aborted) return { ok: false, error: 'cancelled' };
        throw cause;
      }
      if (signal?.aborted) return { ok: false, error: 'cancelled' };
      effectSink(execution.effects);
      return execution.data;
    },
  } as ToolDefinition;
}

export const PRESENTATION_TOOLS_BY_ID = new Map(
  PRESENTATION_CAPABILITIES.map((definition) => [definition.manifest.modelName, capabilityTool(definition)]),
);

/** Provider-backed capabilities, exposed to the model by their tool name. */
export const WORLD_TOOLS_BY_ID = new Map(
  WORLD_CAPABILITIES.map((definition) => [definition.manifest.modelName, capabilityTool(definition)]),
);
