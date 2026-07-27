import type { ToolDefinition } from '@/lib/types';
import { COMMON_TOOLS } from '@/ai/tools/common';
import { atlas } from '@/state/store';
import { analyzeLocation, askBrief, askCompareBrief } from './controller';
import { insight } from './store';

const num = (v: unknown, d = 0) => (typeof v === 'number' ? v : Number(v) || d);

const analyzeLocationTool: ToolDefinition = {
  declaration: {
    name: 'analyze_location',
    description:
      'Build a full living-quality dossier for a coordinate: nearby essentials (groceries, transit, parks, schools, dining, gyms), air/weather/pollen/solar, Street View, and driving commutes to key anchors. Use when the user names or asks about a place. If you only have a place name, geocode it first with search_places to get its coordinates.',
    parametersJsonSchema: {
      type: 'object',
      properties: { lat: { type: 'number' }, lng: { type: 'number' } },
      required: ['lat', 'lng'],
    },
  },
  handler: async (a) => {
    const d = await analyzeLocation({ lat: num(a.lat), lng: num(a.lng) }, 'A');
    return {
      address: d.address,
      livingScore: d.score,
      airQuality: d.env.air,
      weather: d.env.weather,
      essentials: d.essentials
        .filter((e) => e.place)
        .map((e) => ({ what: e.label, name: e.place!.name, meters: Math.round(e.distanceMeters ?? 0) })),
      commuteMinutes: d.commute.filter((c) => c.ok).map((c) => ({ to: c.anchorName, min: Math.round(c.durationSeconds / 60) })),
    };
  },
};

const compareWithTool: ToolDefinition = {
  declaration: {
    name: 'compare_with',
    description:
      'Analyze a second location and place it side-by-side with the current subject as slot B. Use for "compare X vs Y" requests (analyze the first with analyze_location, the second with compare_with).',
    parametersJsonSchema: {
      type: 'object',
      properties: { lat: { type: 'number' }, lng: { type: 'number' } },
      required: ['lat', 'lng'],
    },
  },
  handler: async (a) => {
    const d = await analyzeLocation({ lat: num(a.lat), lng: num(a.lng) }, 'B');
    const subj = insight().subject;
    return {
      address: d.address,
      livingScore: d.score,
      scoreDeltaVsA: subj ? d.score - subj.score : undefined,
    };
  },
};

const toggleAqiTool: ToolDefinition = {
  declaration: {
    name: 'toggle_air_quality_layer',
    description: 'Show or hide the live US Air Quality heatmap overlay on the map.',
    parametersJsonSchema: {
      type: 'object',
      properties: { on: { type: 'boolean' } },
      required: ['on'],
    },
  },
  handler: async (a) => {
    const on = a.on === true;
    insight().setAqiLayer(on);
    atlas().setTileOverlay(on ? 'aqi' : null);
    return { ok: true, aqiLayer: on };
  },
};

const askBriefTool: ToolDefinition = {
  declaration: {
    name: 'ask_atlas_brief',
    description:
      'Write and read aloud a short living-here narrative brief. If two locations are being compared, this will automatically generate a comparative brief analyzing the trade-offs and differences between Location A and Location B.',
    parametersJsonSchema: { type: 'object', properties: {} },
  },
  handler: async (_args, signal) => {
    const s = insight();
    if (s.subject && s.compare) {
      const text = await askCompareBrief(true, signal);
      return { brief: text || 'No comparison dossier to summarize yet.' };
    } else {
      const text = await askBrief('A', true, signal);
      return { brief: text || 'No dossier to summarize yet.' };
    }
  },
};

export const INSIGHT_TOOLS: ToolDefinition[] = [
  ...COMMON_TOOLS,
  analyzeLocationTool,
  compareWithTool,
  toggleAqiTool,
  askBriefTool,
];
