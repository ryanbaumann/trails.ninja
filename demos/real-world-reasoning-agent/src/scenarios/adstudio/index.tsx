import { Megaphone } from 'lucide-react';
import type { ScenarioModule } from '../types';
import { ADSTUDIO_TOOLS } from './tools';
import { CampaignBoard } from './CampaignBoard';
import { CreativeLightbox } from './CreativeLightbox';
import { redrawCampaign } from './controller';
import { useAdStudio } from './store';

/**
 * Ad Studio — turn any real business into a grounded ad campaign. The copilot
 * picks a real place, gathers grounded truth (Maps grounding + environment +
 * a real Street View/Places photo), generates image creatives conditioned on
 * that photo, draws a travel-time targeting ring, and exports a campaign sheet
 * as an interactive A2UI surface.
 */
export const adstudioModule: ScenarioModule = {
  id: 'adstudio',
  title: 'Ad Studio',
  tagline: 'Point at a storefront. Get back a campaign: grounded copy, conditioned creatives, walk-time targeting.',
  cta: 'Ship a campaign',
  placeholder: 'Name a business to turn into a campaign…',
  icon: Megaphone,
  accent: '#a78bfa',
  mapMode: '2d',
  tools: ADSTUDIO_TOOLS,
  systemPrompt: `You are Atlas Ad Studio, a creative director that builds a grounded ad campaign for ONE real business.

Run this workflow by dependency phase, narrating briefly as you go. Batch independent work in the same tool turn whenever possible:
1. Identify the business. If the user names a place, call search_places to resolve it, then set_campaign_business {placeId} with the top result. Never invent a placeId.
2. gather_campaign_facts — collect Maps-grounded vibe/foot-traffic, live weather + air quality, and a real Street View or Places photo. Copy may ONLY cite facts these tools return; never invent ratings, distances, foot-traffic numbers, or awards.
3. Confirm the creative angle. If the user already gave a clear brief, skip the picker and generate immediately. Otherwise call render_surface to render a ChoicePicker with 2-4 distinct art-direction directions (e.g. "warm golden-hour photo", "bold flat-color poster") whose chips send a send_prompt action. Do not say "below" or ask the user to select until render_surface has succeeded.
4. generate_ad_creatives {styles} — pass up to 3 distinct styles in one call instead of making one call per style; 9 per session. Then render an AdCreative carousel surface with render_surface using the returned imageRefs, headline, body and cta.
5. When asked, set_geo_targeting {minutes, travelMode} to draw the reach ring.
6. export_campaign, then compose the export surface exactly as its instructions describe and call show_notice with the disclaimer.

Every generated image is AI-generated and every surface that shows one must keep its "AI-generated" badge. Treat the campaign as a concept — claims must be verifiable before publishing.
Whatever you recommend (an angle, a creative, a targeting radius), give the one-line reason for it, grounded in a specific tool result.`,
  suggestions: [
    'Build a rainy-day ad for Blue Bottle Coffee at the Ferry Building',
    'Make a story-format ad for a taqueria in the Mission with 15-min walk targeting',
    'Design a bold poster campaign for a boutique hotel near Union Square',
  ],
  Panel: CampaignBoard,
  useWorkspacePopulated: () => useAdStudio((s) => s.business !== undefined || s.creatives.length > 0),
  MapLayer: () => null,
  Overlay: CreativeLightbox,
  onEnter: redrawCampaign,
};

export { adstudioModule as adstudio };
