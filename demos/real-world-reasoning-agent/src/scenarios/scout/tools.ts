import type { ToolDefinition } from '@/lib/types';
import { COMMON_TOOLS } from '@/ai/tools/common';
import { atlas } from '@/state/store';
import { genui } from '@/genui/store';
import { uid } from '@/lib/id';
import { VIDEO_GEN_ENABLED } from '@/lib/config';
import {
  scoutArea,
  inspectCandidate,
  scoreCandidates,
  getEvidence,
  compareSites,
  generateWalkthroughVideo,
} from './controller';
import { buildCompareSurface } from './compareSurface';
import { scout, type RubricWeights } from './store';

const num = (v: unknown, d = 0) => (typeof v === 'number' ? v : Number(v) || d);
const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);

/* -------------------------------------------------------------- scout_area */
const scoutAreaTool: ToolDefinition = {
  declaration: {
    name: 'scout_area',
    description:
      'Search a corridor/area for anchor site candidates (e.g. storefronts matching a business type, or ' +
      'general POIs for an accessibility audit). Drops numbered pins and fits the camera to the results. ' +
      'Call this first, before inspect_candidate.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What to scout for, e.g. "espresso bar" or "storefronts on Valencia St"' },
        lat: { type: 'number' },
        lng: { type: 'number' },
        radiusM: { type: 'number', description: 'Search radius in meters, max 1500' },
        maxCandidates: { type: 'number', description: 'Max candidates to return, max 6' },
      },
      required: ['query', 'lat', 'lng'],
    },
  },
  handler: async (a) => {
    const center = { lat: num(a.lat), lng: num(a.lng) };
    const radiusM = a.radiusM != null ? Math.min(num(a.radiusM, 800), 1500) : 800;
    const maxCandidates = a.maxCandidates != null ? Math.min(num(a.maxCandidates, 6), 6) : 6;
    const candidates = await scoutArea(str(a.query), center, radiusM, maxCandidates);
    return {
      ok: true,
      count: candidates.length,
      candidates: candidates.map((c, i) => ({
        index: i + 1,
        candidateId: c.id,
        label: c.label,
        location: c.loc,
        placeId: c.place?.id,
        address: c.place?.formattedAddress,
      })),
    };
  },
};

/* -------------------------------------------------------------- inspect_candidate */
const inspectCandidateTool: ToolDefinition = {
  declaration: {
    name: 'inspect_candidate',
    description:
      'Visually inspect one candidate by fetching real Street View frames (2-3 headings) and running Gemini ' +
      'vision over them to score visibility, condition and pedestrian activity. Announce what heading you are ' +
      'looking toward before/after calling this (the response includes headingLabels like "north-east"). Each ' +
      'candidate can only be inspected once; this demo caps total inspections per session.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        candidateId: { type: 'string' },
        headings: {
          type: 'array',
          items: { type: 'number' },
          description: 'Optional explicit compass headings (0-360) to look toward; defaults to a sensible spread.',
        },
      },
      required: ['candidateId'],
    },
  },
  handler: async (a, signal) => {
    const headings = Array.isArray(a.headings) ? (a.headings as unknown[]).map((h) => num(h)) : undefined;
    return inspectCandidate(str(a.candidateId), headings, signal);
  },
};

/* -------------------------------------------------------------- score_candidates */
const scoreCandidatesTool: ToolDefinition = {
  declaration: {
    name: 'score_candidates',
    description:
      'Fuse vision scores with real Places density, environment (air quality/pollen), and walking-access time ' +
      'into a weighted ranked total for every inspected candidate. Call after inspecting candidates. Re-glyphs ' +
      'map pins by rank. Optionally pass custom rubric weights (each 0-1, should roughly sum to 1).',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        weights: {
          type: 'object',
          properties: {
            visibility: { type: 'number' },
            condition: { type: 'number' },
            activity: { type: 'number' },
            access: { type: 'number' },
            environment: { type: 'number' },
          },
        },
      },
    },
  },
  handler: async (a) => {
    const rawWeights = a.weights as Partial<RubricWeights> | undefined;
    const inspectedCount = scout().candidates.filter((c) => c.status !== 'pending').length;
    if (inspectedCount === 0) {
      return { ok: false, error: 'No candidates have been inspected yet — call inspect_candidate first.' };
    }
    const ranked = await scoreCandidates(rawWeights);
    return { ok: true, ranked };
  },
};

/* -------------------------------------------------------------- show_evidence */
const showEvidenceTool: ToolDefinition = {
  declaration: {
    name: 'show_evidence',
    description:
      'Fetch the exact inspected Street View frames, scores and notes for one candidate. After calling this, ' +
      'render an A2UI evidence surface with render_surface: an Image row of the returned frame refs, a StatGrid ' +
      'of the sub-scores, a Text of the notes citing the heading labels, and a "Fly to it" Button (action ' +
      'fly_to with the candidate location).',
    parametersJsonSchema: {
      type: 'object',
      properties: { candidateId: { type: 'string' } },
      required: ['candidateId'],
    },
  },
  handler: async (a) => getEvidence(str(a.candidateId)),
};

/* -------------------------------------------------------------- compare_sites */
const compareSitesTool: ToolDefinition = {
  declaration: {
    name: 'compare_sites',
    description:
      'Render a side-by-side decision matrix of the ranked, scored candidates (visibility, condition, ' +
      'activity, access, environment, total) plus the recommended winner and a "Fly to the winner" button. ' +
      'Call after score_candidates when the user wants to compare sites or pick one. This tool renders the ' +
      'comparison surface ITSELF — do NOT call render_surface for it. After it returns, just give a one- or ' +
      'two-sentence spoken recommendation of the winner and why.',
    parametersJsonSchema: { type: 'object', properties: {} },
  },
  handler: async () => {
    const payload = compareSites();
    if (!payload.ok || !payload.rows || payload.rows.length < 2) return payload;
    const scenario = atlas().activeScenario;
    const { surfaceId, messages } = buildCompareSurface(payload);
    genui().applyMessages(scenario, messages);
    atlas().addMsg({ id: uid('s'), role: 'surface', surfaceId, ts: Date.now() });
    return {
      ok: true,
      rendered: true,
      area: payload.area,
      winner: payload.winner,
      rows: payload.rows,
      note: 'Comparison surface already rendered in the chat. Do NOT call render_surface. Give a brief spoken recommendation of the winner.',
    };
  },
};

/* -------------------------------------------------------------- walkthrough_video */
const walkthroughVideoTool: ToolDefinition = {
  declaration: {
    name: 'walkthrough_video',
    description:
      'Generate a short establishing walkthrough video of the winning site, seeded on its real Street View ' +
      'evidence frame, and render it as an A2UI surface. Call after compare_sites has picked a winner. This ' +
      'tool renders the surface ITSELF — do NOT call render_surface for it. After it returns, give a one-' +
      'sentence spoken note.',
    parametersJsonSchema: { type: 'object', properties: {} },
  },
  handler: async () => {
    const r = await generateWalkthroughVideo();
    if (!r.ok || !r.messages) return r;
    const scenario = atlas().activeScenario;
    genui().applyMessages(scenario, r.messages);
    atlas().addMsg({ id: uid('s'), role: 'surface', surfaceId: r.surfaceId, ts: Date.now() });
    return {
      ok: true,
      rendered: true,
      label: r.label,
      note: 'Walkthrough video surface rendered. Give a one-sentence spoken note.',
    };
  },
};

export const SCOUT_TOOLS: ToolDefinition[] = [
  ...COMMON_TOOLS,
  scoutAreaTool,
  inspectCandidateTool,
  scoreCandidatesTool,
  showEvidenceTool,
  compareSitesTool,
  ...(VIDEO_GEN_ENABLED ? [walkthroughVideoTool] : []),
];
