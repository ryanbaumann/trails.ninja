import type { ToolDefinition, TravelMode } from '@/lib/types';
import { COMMON_TOOLS } from '@/ai/tools/common';
import { concierge, type ItineraryStop } from './store';
import { proposeItinerary, redrawItinerary, playTour, makePostcard } from './controller';

const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);

const proposeItineraryTool: ToolDefinition = {
  declaration: {
    name: 'propose_itinerary',
    description:
      'Assemble the day. Pass the chosen stops IN VISITING ORDER, each referencing a placeId you already found with search_places. Atlas enriches every stop with photos/hours, drops numbered pins, and draws the walking/driving legs between them. Call this once you have picked the stops.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        stops: {
          type: 'array',
          description: 'Ordered list of stops for the day.',
          items: {
            type: 'object',
            properties: {
              placeId: { type: 'string', description: 'placeId from a prior search_places result' },
              name: { type: 'string' },
              window: { type: 'string', description: 'time window, e.g. "9:00–10:00"' },
              why: { type: 'string', description: 'one line on why this pick fits' },
              category: { type: 'string', description: 'e.g. coffee, museum, dinner, view' },
            },
            required: ['name'],
          },
        },
      },
      required: ['stops'],
    },
  },
  handler: async (a) => {
    const list = Array.isArray(a.stops) ? a.stops : [];
    const stops: ItineraryStop[] = list.map((s: Record<string, unknown>) => ({
      placeId: s.placeId ? String(s.placeId) : undefined,
      name: str(s.name, 'Stop'),
      window: s.window ? String(s.window) : undefined,
      why: s.why ? String(s.why) : undefined,
      category: s.category ? String(s.category) : undefined,
    }));
    return proposeItinerary(stops);
  },
};

const updateItineraryTool: ToolDefinition = {
  declaration: {
    name: 'update_itinerary',
    description:
      'Refine the current itinerary: remove a stop, or move a stop to a new position. Use after the user asks to swap/drop/reorder. Re-renders pins and legs.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        op: { type: 'string', enum: ['remove', 'move'] },
        stopIndex: { type: 'number', description: '1-based index of the stop to change' },
        toIndex: { type: 'number', description: '1-based target position for a move' },
      },
      required: ['op', 'stopIndex'],
    },
  },
  handler: async (a) => {
    const c = concierge();
    const stops = [...c.stops];
    const i = Math.round(Number(a.stopIndex)) - 1;
    if (i < 0 || i >= stops.length) return { ok: false, error: 'stopIndex out of range' };
    if (a.op === 'remove') {
      stops.splice(i, 1);
    } else if (a.op === 'move') {
      const to = Math.max(0, Math.min(stops.length - 1, Math.round(Number(a.toIndex)) - 1));
      const [moved] = stops.splice(i, 1);
      stops.splice(to, 0, moved);
    }
    c.setStops(stops);
    await redrawItinerary();
    return { ok: true, count: stops.length };
  },
};

const setTravelModeTool: ToolDefinition = {
  declaration: {
    name: 'set_travel_mode',
    description: 'Set how legs between stops are routed (WALK, DRIVE, BICYCLE, TRANSIT). Re-draws the legs.',
    parametersJsonSchema: {
      type: 'object',
      properties: { mode: { type: 'string', enum: ['WALK', 'DRIVE', 'BICYCLE', 'TRANSIT'] } },
      required: ['mode'],
    },
  },
  handler: async (a) => {
    concierge().setTravelMode(str(a.mode, 'WALK') as TravelMode);
    await redrawItinerary();
    return { ok: true, mode: str(a.mode) };
  },
};

const playTourTool: ToolDefinition = {
  declaration: {
    name: 'play_tour',
    description: 'Fly the camera through the itinerary stop by stop as a guided preview.',
    parametersJsonSchema: { type: 'object', properties: {} },
  },
  handler: async () => {
    void playTour();
    return { ok: true };
  },
};

const makePostcardTool: ToolDefinition = {
  declaration: {
    name: 'make_postcard',
    description:
      'Generate a stylized AI travel postcard from the real stop names in the itinerary. Opens it in a modal for the user to download.',
    parametersJsonSchema: {
      type: 'object',
      properties: { styleHint: { type: 'string', description: 'optional art-direction, e.g. "risograph, teal + coral"' } },
    },
  },
  handler: async (a) => makePostcard(a.styleHint ? String(a.styleHint) : undefined),
};

export const CONCIERGE_TOOLS: ToolDefinition[] = [
  ...COMMON_TOOLS,
  proposeItineraryTool,
  updateItineraryTool,
  setTravelModeTool,
  playTourTool,
  makePostcardTool,
];
