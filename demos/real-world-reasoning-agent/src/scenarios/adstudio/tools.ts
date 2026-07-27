import type { ToolDefinition, TravelMode } from '@/lib/types';
import { COMMON_TOOLS } from '@/ai/tools/common';
import type { AdFormat } from '@/ai/image';
import {
  setCampaignBusiness,
  gatherCampaignFacts,
  generateAdCreatives,
  setGeoTargeting,
  exportCampaign,
} from './controller';

const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);
const num = (v: unknown, d = 0) => (typeof v === 'number' ? v : Number(v) || d);

const FORMATS: AdFormat[] = ['square', 'story', 'banner'];
const TRAVEL_MODES: TravelMode[] = ['WALK', 'DRIVE', 'BICYCLE', 'TRANSIT', 'TWO_WHEELER'];

const setCampaignBusinessTool: ToolDefinition = {
  declaration: {
    name: 'set_campaign_business',
    description:
      'Choose the real business this ad campaign is for. Pass a placeId found with search_places or ' +
      'get_place_details. Drops the hero marker and flies the camera there, and resets any prior campaign ' +
      'in this session. Call this first, before gathering facts or generating creatives.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        placeId: { type: 'string', description: 'placeId of the business' },
        brief: { type: 'string', description: 'optional short creative brief from the user' },
      },
      required: ['placeId'],
    },
  },
  handler: async (a) => setCampaignBusiness(str(a.placeId), a.brief != null ? str(a.brief) : undefined),
};

const gatherCampaignFactsTool: ToolDefinition = {
  declaration: {
    name: 'gather_campaign_facts',
    description:
      'Gather grounded truth about the chosen business: a Maps-grounded vibe/foot-traffic answer (renders a ' +
      'Google Maps widget in chat), live weather + air quality, and a real Street View or Places photo to ' +
      'condition creatives on. Call after set_campaign_business and before writing any copy or generating ' +
      'creatives — copy must only ever cite facts this tool returns.',
    parametersJsonSchema: { type: 'object', properties: {} },
  },
  handler: async () => gatherCampaignFacts(),
};

const generateAdCreativesTool: ToolDefinition = {
  declaration: {
    name: 'generate_ad_creatives',
    description:
      'Generate up to 3 image ad creatives at once, conditioned on the business\'s real Street View/Places ' +
      'photo, plus grounded copy. Session cap is 9 creatives total (call refuses beyond that — remix instead). ' +
      'Call gather_campaign_facts first so copy is grounded. After this returns, render an AdCreative carousel ' +
      'surface with render_surface using the returned imageRefs.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        styles: {
          type: 'array',
          description:
            'Up to 3 distinct art-direction style strings, e.g. "warm golden-hour photo", "bold flat-color poster".',
          items: { type: 'string' },
        },
        format: { type: 'string', enum: FORMATS, description: 'Ad aspect ratio. Default square.' },
        headline: { type: 'string', description: 'Grounded headline copy shared across the styles requested.' },
        body: { type: 'string', description: 'Grounded body copy.' },
        cta: { type: 'string', description: 'Call to action, e.g. "Order now".' },
      },
      required: ['styles'],
    },
  },
  handler: async (a) => {
    const styles = Array.isArray(a.styles) ? a.styles.map((x) => String(x)) : [];
    const format = (FORMATS as string[]).includes(str(a.format)) ? (str(a.format) as AdFormat) : 'square';
    return generateAdCreatives(styles, format, {
      headline: a.headline != null ? str(a.headline) : undefined,
      body: a.body != null ? str(a.body) : undefined,
      cta: a.cta != null ? str(a.cta) : undefined,
    });
  },
};

const setGeoTargetingTool: ToolDefinition = {
  declaration: {
    name: 'set_geo_targeting',
    description:
      'Draw a travel-time geo-targeting ring around the business (walk/drive/bike/transit minutes) and store ' +
      'it as the campaign targeting radius. Fits the camera to the ring.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        minutes: { type: 'number', description: 'Travel-time budget, 5-30 minutes.' },
        travelMode: { type: 'string', enum: TRAVEL_MODES },
      },
      required: ['minutes', 'travelMode'],
    },
  },
  handler: async (a) => {
    const mode = (TRAVEL_MODES as string[]).includes(str(a.travelMode)) ? (str(a.travelMode) as TravelMode) : 'DRIVE';
    return setGeoTargeting(num(a.minutes, 15), mode);
  },
};

const exportCampaignTool: ToolDefinition = {
  declaration: {
    name: 'export_campaign',
    description:
      'Finalize the campaign for export. Returns a summary of grounded facts, creatives and targeting for you ' +
      'to compose into a final A2UI export surface (StatGrid + AdCreative carousel + MapPreview + grounded-claims ' +
      'list), then call show_notice with a "concept — verify claims before publishing" disclaimer.',
    parametersJsonSchema: { type: 'object', properties: {} },
  },
  handler: async () => exportCampaign(),
};

export const ADSTUDIO_TOOLS: ToolDefinition[] = [
  ...COMMON_TOOLS,
  setCampaignBusinessTool,
  gatherCampaignFactsTool,
  generateAdCreativesTool,
  setGeoTargetingTool,
  exportCampaignTool,
];
