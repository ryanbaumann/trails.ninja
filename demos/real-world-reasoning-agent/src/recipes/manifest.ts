/**
 * ExperienceManifest — what a recipe *is*, with no React in it.
 *
 * A "journey" used to be a mode: picking one swapped the panel, the map layer,
 * the transcript and the engine. Now the session is continuous and a recipe only
 * selects three things — how the agent is briefed, which capabilities it may
 * call, and what to suggest first.
 *
 * This module is deliberately free of React, Zustand and the Google SDK so the
 * same records can describe a recipe to a non-Atlas host (MCP, agent-as-tool).
 * The Atlas-only views (Panel, MapLayer, Overlay) stay in `src/scenarios/` and
 * are looked up by id; they are demo code, not part of the portable contract.
 */
import type { ScenarioId } from '@/lib/types';

export interface ExperienceManifest {
  id: ScenarioId;
  title: string;
  /** One line describing what the recipe does, shown in the picker. */
  tagline: string;
  /** Composer placeholder while this recipe is active. */
  placeholder?: string;
  /** Prompts that are honest about what this recipe can actually do. */
  starters: string[];
  /** Capability/tool names this recipe may call, beyond the common set. */
  capabilities: string[];
  /** Map presentation this recipe expects. */
  mapMode: '2d' | '3d';
  accent: string;
}

/** Tool names every recipe gets (`src/ai/tools/common.ts`). */
export const COMMON_CAPABILITY_NAMES = [
  'fly_to',
  'search_places',
  'get_place_details',
  'focus_place',
  'add_markers',
  'clear_map',
  'draw_route',
  'get_environment',
  'ask_maps',
  'show_notice',
  'render_surface',
] as const;

/**
 * A recipe may only suggest something it can actually do. A starter that needs a
 * capability the recipe does not declare is a promise the runtime cannot keep —
 * the failure mode the foundation doc calls "suggestions advertising
 * unavailable actions".
 */
export function declaredCapabilities(manifest: ExperienceManifest): string[] {
  return [...COMMON_CAPABILITY_NAMES, ...manifest.capabilities];
}

export function manifestById(
  manifests: readonly ExperienceManifest[],
): ReadonlyMap<ScenarioId, ExperienceManifest> {
  const byId = new Map<ScenarioId, ExperienceManifest>();
  for (const manifest of manifests) {
    if (byId.has(manifest.id)) throw new Error(`Duplicate recipe id: ${manifest.id}`);
    byId.set(manifest.id, manifest);
  }
  return byId;
}
