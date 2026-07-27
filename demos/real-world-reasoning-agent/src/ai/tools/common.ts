/**
 * The common tool set handed to a recipe's copilot.
 *
 * Everything that touches places, routes, conditions or the map is a capability
 * (`src/capabilities/world.ts`, `src/capabilities/presentation.ts`) surfaced
 * through `capabilityTool`, so execution returns typed effects and the host
 * applies them. These handlers used to reach into the Zustand store directly —
 * `search_places` dropped markers and moved the camera as an invisible side
 * effect — which made map behaviour unreplayable and untestable without a live
 * store.
 *
 * `ask_maps` is the one remaining hand-written tool: it appends a grounded Maps
 * widget to the transcript, a chat effect with no typed equivalent yet.
 */
import type { FunctionDeclaration } from '@google/genai';
import type { ToolDefinition } from '@/lib/types';
import { atlas } from '@/state/store';
import { uid } from '@/lib/id';
import { askMaps } from '@/ai/grounding';
import { RENDER_SURFACE_TOOL } from '@/genui/tool';
import { PRESENTATION_TOOLS_BY_ID, WORLD_TOOLS_BY_ID } from '@/capabilities/atlasAdapter';

const num = (v: unknown, d = 0) => (typeof v === 'number' ? v : Number(v) || d);
const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);

/** Resolve a capability by the tool name the model sees. */
export function capabilityTool(name: string): ToolDefinition {
  const tool = PRESENTATION_TOOLS_BY_ID.get(name) ?? WORLD_TOOLS_BY_ID.get(name);
  if (!tool) throw new Error(`Missing capability: ${name}`);
  return tool;
}

/* -------------------------------------------------------------- ask_maps */
const askMapsTool: ToolDefinition = {
  declaration: {
    name: 'ask_maps',
    description:
      'Answer an open question about places using Google Maps grounding (reviews, what an area is known for). Renders a Google Maps widget in the chat.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        question: { type: 'string' },
        lat: { type: 'number' },
        lng: { type: 'number' },
      },
      required: ['question'],
    },
  },
  handler: async (a) => {
    const at =
      a.lat != null && a.lng != null ? { lat: num(a.lat), lng: num(a.lng) } : undefined;
    const ans = await askMaps(str(a.question), at);
    if (ans.widgetContextToken) {
      atlas().addMsg({
        id: uid('w'),
        role: 'widget',
        widgetContextToken: ans.widgetContextToken,
        ts: Date.now(),
      });
    }
    return { answer: ans.text, grounded: !!ans.widgetContextToken };
  },
};

export const COMMON_TOOLS: ToolDefinition[] = [
  capabilityTool('fly_to'),
  capabilityTool('search_places'),
  capabilityTool('get_place_details'),
  capabilityTool('focus_place'),
  capabilityTool('add_markers'),
  capabilityTool('clear_map'),
  capabilityTool('draw_route'),
  capabilityTool('get_environment'),
  askMapsTool,
  capabilityTool('show_notice'),
  RENDER_SURFACE_TOOL,
];

export const COMMON_DECLARATIONS: FunctionDeclaration[] = COMMON_TOOLS.map((t) => t.declaration);
