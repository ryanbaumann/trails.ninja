/**
 * The recipe catalogue. Portable records only — the Atlas React views live in
 * `src/scenarios/` and are looked up by the same id.
 *
 * Starters are the contract the foundation doc cares about: a recipe may only
 * suggest something its declared capabilities can actually do. `registry.test.ts`
 * enforces that the declared capability list matches the tools the scenario
 * really registers, so a recipe cannot advertise an action the runtime lacks.
 */
import type { ExperienceManifest } from './manifest';
import { manifestById } from './manifest';

export const RECIPES: ExperienceManifest[] = [
  {
    id: 'concierge',
    title: 'Concierge',
    tagline: 'One sentence in — a walkable day out, reasoned into order and drawn on the map.',
    placeholder: 'Describe your perfect day…',
    starters: [
      'Plan a walkable Saturday near the Ferry Building — coffee, art, then dinner',
      "It's raining — build my best indoor day downtown and show me the route",
    ],
    capabilities: ['propose_itinerary', 'update_itinerary', 'set_travel_mode', 'play_tour', 'make_postcard'],
    mapMode: '2d',
    accent: '#f59e0b',
  },
  {
    id: 'insight',
    title: 'Insight',
    tagline: 'Judge any block on air, weather, solar and live commutes — with receipts.',
    placeholder: 'Name a block to judge…',
    starters: [
      'Analyze the Mission District for someone who bikes to work',
      'Compare Hayes Valley against Noe Valley for air quality and commute',
    ],
    capabilities: ['analyze_location', 'compare_with', 'toggle_air_quality_layer', 'ask_atlas_brief'],
    mapMode: '2d',
    accent: '#34d399',
  },
  {
    id: 'fleet',
    title: 'Fleet',
    tagline: 'A dispatcher that watches live traffic and weighs every tradeoff before committing a van.',
    placeholder: 'Give the dispatcher an order…',
    starters: [
      'Which van should take the next unassigned job, and why?',
      'Traffic just spiked downtown — reroute anything at risk',
    ],
    capabilities: ['get_fleet_state', 'eta_matrix', 'assign_job', 'set_avoid_zone', 'set_sim_speed', 'follow_van'],
    mapMode: '2d',
    accent: '#22d3ee',
  },
  {
    id: 'cinema',
    title: 'Cinema',
    tagline: 'Fly a photoreal 3D city while the agent narrates only what it can prove.',
    placeholder: 'Name a place — Atlas flies there…',
    starters: [
      'Take me on a 3D tour of the waterfront and tell me what I am seeing',
      'Orbit Coit Tower and explain why it is where it is',
    ],
    capabilities: ['start_tour', 'tour_control', 'narrate_stop', 'orbit', 'generate_tour_video'],
    mapMode: '3d',
    accent: '#f472b6',
  },
  {
    id: 'adstudio',
    title: 'Ad Studio',
    tagline: 'Turn a real storefront into a campaign: grounded copy, conditioned creatives, walk-time targeting.',
    placeholder: 'Name a business to turn into a campaign…',
    starters: [
      'Build a campaign for a coffee shop near the Ferry Building',
      'Target everyone within a 10-minute walk of this business',
    ],
    capabilities: [
      'set_campaign_business',
      'gather_campaign_facts',
      'generate_ad_creatives',
      'set_geo_targeting',
      'export_campaign',
    ],
    mapMode: '2d',
    accent: '#a78bfa',
  },
  {
    id: 'scout',
    title: 'Scout',
    tagline: 'Walk the block on Street View, read the frontage, then defend a site pick with evidence.',
    placeholder: 'What are we siting, and where…',
    starters: [
      'Find the best corner for a new bakery in North Beach and show your evidence',
      'Compare the three strongest sites and recommend one',
    ],
    capabilities: [
      'scout_area',
      'inspect_candidate',
      'score_candidates',
      'show_evidence',
      'compare_sites',
      'walkthrough_video',
    ],
    mapMode: '2d',
    accent: '#60a5fa',
  },
];

export const RECIPES_BY_ID = manifestById(RECIPES);
