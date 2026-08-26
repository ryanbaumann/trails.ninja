/**
 * GenUI surface store. Holds the live A2UI surfaces per scenario: their flat
 * component maps and data models. `applyMessages` is the single reducer that
 * folds A2UI protocol messages into surface state; SurfaceView subscribes and
 * re-renders on `rev` bumps. Non-React accessor `genui()` is used by tools.
 */
import { create } from 'zustand';
import type { ScenarioId } from '@/lib/types';
import type { A2uiMessage, ComponentNode } from './protocol';

/**
 * Who owns a surface. Recipes own theirs; the explorer runtime owns its own
 * scope rather than borrowing a journey slot, so clearing one never wipes the
 * other's surfaces.
 */
export type SurfaceScope = ScenarioId | 'explorer';
import { setAtPath, topLevelComponentIds, validateComponentGraph } from './protocol';

export interface SurfaceState {
  id: string;
  catalogId: string;
  scenario: SurfaceScope;
  components: Record<string, ComponentNode>;
  dataModel: Record<string, unknown>;
  rootId: 'root';
  rev: number;
}

export interface ApplyResult {
  created: string[];
  updated: string[];
  deleted: string[];
  errors: string[];
}

interface GenuiState {
  surfaces: Record<string, SurfaceState>;
  applyMessages: (scenario: SurfaceScope, msgs: A2uiMessage[]) => ApplyResult;
  getSurface: (id: string) => SurfaceState | undefined;
  clearScenario: (scenario: SurfaceScope) => void;
  reset: () => void;
}

export const useGenui = create<GenuiState>((set, get) => ({
  surfaces: {},

  applyMessages: (scenario, msgs) => {
    const created: string[] = [];
    const updated = new Set<string>();
    const deleted: string[] = [];
    const errors: string[] = [];

    set((state) => {
      const surfaces = { ...state.surfaces };
      const touched = new Set<string>();

      for (const msg of msgs) {
        if ('createSurface' in msg) {
          const { surfaceId, catalogId, components: initialComponents, dataModel: initialDataModel } = msg.createSurface;
          if (!surfaces[surfaceId]) created.push(surfaceId);
          const componentsMap: Record<string, ComponentNode> = surfaces[surfaceId]?.components
            ? { ...surfaces[surfaceId].components }
            : {};
          if (Array.isArray(initialComponents)) {
            for (const c of initialComponents) {
              if (c && typeof c === 'object' && 'id' in c) {
                componentsMap[c.id] = c;
              }
            }
          }
          const dataModelObj: Record<string, unknown> = surfaces[surfaceId]?.dataModel
            ? { ...surfaces[surfaceId].dataModel }
            : {};
          if (initialDataModel && typeof initialDataModel === 'object') {
            Object.assign(dataModelObj, initialDataModel);
          }
          surfaces[surfaceId] = {
            id: surfaceId,
            catalogId,
            scenario,
            components: componentsMap,
            dataModel: dataModelObj,
            rootId: 'root',
            rev: (surfaces[surfaceId]?.rev ?? 0) + 1,
          };
          touched.add(surfaceId);
        } else if ('updateComponents' in msg) {
          const { surfaceId, components } = msg.updateComponents;
          const prev =
            surfaces[surfaceId] ??
            ({
              id: surfaceId,
              catalogId: '',
              scenario,
              components: {},
              dataModel: {},
              rootId: 'root',
              rev: 0,
            } satisfies SurfaceState);
          const nextComponents = { ...prev.components };
          for (const c of components) nextComponents[c.id] = c;
          surfaces[surfaceId] = { ...prev, components: nextComponents, rev: prev.rev + 1 };
          touched.add(surfaceId);
          updated.add(surfaceId);
        } else if ('updateDataModel' in msg) {
          const { surfaceId, path, value } = msg.updateDataModel;
          const prev = surfaces[surfaceId];
          if (!prev) continue;
          surfaces[surfaceId] = {
            ...prev,
            dataModel: setAtPath(prev.dataModel, path, value),
            rev: prev.rev + 1,
          };
          touched.add(surfaceId);
          updated.add(surfaceId);
        } else if ('deleteSurface' in msg) {
          const { surfaceId } = msg.deleteSurface;
          if (surfaces[surfaceId]) {
            delete surfaces[surfaceId];
            deleted.push(surfaceId);
            touched.delete(surfaceId);
          }
        }
      }

      // Commit the whole message batch or none of it. This prevents a valid
      // createSurface from being committed when a later component update is
      // malformed, which otherwise leaves an empty/orphaned chat surface.
      for (const surfaceId of touched) {
        let surface = surfaces[surfaceId];
        if (!surface) continue;

        // Guarantee a root before validating the graph. A surface that has
        // components but no "root" — a new surface whose batch omitted it, or one
        // populated across hops without one — would otherwise be rejected by
        // validateComponentGraph and render as a "Rendering the response failed"
        // chip. Synthesize a root Column wrapping the current top-level
        // (unreferenced) nodes so the real content renders. Surfaces that already
        // define a root, and genuinely empty surfaces, are left untouched (the
        // latter still fail validation with a clear "missing root" error).
        if (!surface.components[surface.rootId] && Object.keys(surface.components).length) {
          const components: Record<string, ComponentNode> = {
            ...surface.components,
            [surface.rootId]: {
              id: surface.rootId,
              component: 'Column',
              children: topLevelComponentIds(surface.components),
            },
          };
          surface = { ...surface, components };
          surfaces[surfaceId] = surface;
        }

        const graph = validateComponentGraph(surface.components, surfaceId);
        errors.push(...graph.errors);
        if (graph.errors.length) return state;

        // Upserts intentionally preserve nodes for partial updates; once the
        // root stops referencing an old subtree, remove it to bound memory and
        // ensure stale interactive controls cannot be addressed.
        if (graph.orphanIds.length) {
          const components = { ...surface.components };
          for (const id of graph.orphanIds) delete components[id];
          surfaces[surfaceId] = { ...surface, components };
        }
      }

      return { surfaces };
    });

    if (errors.length) return { created: [], updated: [], deleted: [], errors };

    return { created, updated: [...updated], deleted, errors: [] };
  },

  getSurface: (id) => get().surfaces[id],

  clearScenario: (scenario) =>
    set((state) => ({
      surfaces: Object.fromEntries(
        Object.entries(state.surfaces).filter(([, s]) => s.scenario !== scenario),
      ),
    })),

  reset: () => set({ surfaces: {} }),
}));

/** Non-React access for tools / actions. */
export const genui = useGenui.getState;
