import type { ToolDefinition } from '@/lib/types';
import { COMMON_TOOLS } from '@/ai/tools/common';
import { atlas } from '@/state/store';
import { VIDEO_GEN_ENABLED } from '@/lib/config';
import { TOURS } from './tours';
import { startTour, tourControl, narrateStop, generateTourVideo } from './controller';

const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);

const startTourTool: ToolDefinition = {
  declaration: {
    name: 'start_tour',
    description: `Begin a curated cinematic 3D tour. Available tours: ${TOURS.map((t) => `${t.id} (${t.title})`).join(', ')}.`,
    parametersJsonSchema: {
      type: 'object',
      properties: { tourId: { type: 'string', enum: TOURS.map((t) => t.id) } },
      required: ['tourId'],
    },
  },
  handler: async (a) => startTour(str(a.tourId)),
};

const tourControlTool: ToolDefinition = {
  declaration: {
    name: 'tour_control',
    description: 'Control the running tour: play, pause, next, prev, or exit (back to overview).',
    parametersJsonSchema: {
      type: 'object',
      properties: { op: { type: 'string', enum: ['play', 'pause', 'next', 'prev', 'exit'] } },
      required: ['op'],
    },
  },
  handler: async (a) => tourControl(str(a.op, 'play') as 'play' | 'pause' | 'next' | 'prev' | 'exit'),
};

const narrateStopTool: ToolDefinition = {
  declaration: {
    name: 'narrate_stop',
    description:
      'Narrate the place currently in view: fetch real facts, write a tight cinematic 2-sentence story, and read it aloud. Use in free-explore mode after flying somewhere.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'the landmark/place name in view' },
        lat: { type: 'number' },
        lng: { type: 'number' },
      },
      required: ['name'],
    },
  },
  handler: async (a) => {
    const near =
      a.lat != null && a.lng != null
        ? { name: str(a.name), center: { lat: Number(a.lat), lng: Number(a.lng) }, range: 600, heading: 0, tilt: 60 }
        : undefined;
    const text = await narrateStop(str(a.name), near);
    return { narration: text };
  },
};

const orbitTool: ToolDefinition = {
  declaration: {
    name: 'orbit',
    description: 'Start or stop a slow cinematic orbit around the current view.',
    parametersJsonSchema: {
      type: 'object',
      properties: { on: { type: 'boolean' }, lat: { type: 'number' }, lng: { type: 'number' } },
      required: ['on'],
    },
  },
  handler: async (a) => {
    if (a.on === false) {
      atlas().setCamera({ kind: 'stop3d' });
      return { ok: true, orbiting: false };
    }
    const report = atlas().cameraReport;
    const center =
      a.lat != null && a.lng != null
        ? { lat: Number(a.lat), lng: Number(a.lng) }
        : report
          ? { lat: report.lat, lng: report.lng }
          : { lat: 37.8199, lng: -122.4783 };
    atlas().setCamera({ kind: 'orbit3d', center: { ...center, altitude: 60 }, range: 700, tilt: 62, repeatCount: 2, durationMs: 40000 });
    return { ok: true, orbiting: true };
  },
};

const generateTourVideoTool: ToolDefinition = {
  declaration: {
    name: 'generate_tour_video',
    description:
      "Generate a short cinematic video of the current tour stop from its Street View, shown in the Cinema panel.",
    parametersJsonSchema: { type: 'object', properties: {} },
  },
  handler: async () => generateTourVideo(),
};

export const CINEMA_TOOLS: ToolDefinition[] = [
  ...COMMON_TOOLS,
  startTourTool,
  tourControlTool,
  narrateStopTool,
  orbitTool,
  ...(VIDEO_GEN_ENABLED ? [generateTourVideoTool] : []),
];
