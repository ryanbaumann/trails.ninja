/**
 * TOOL_RATIONALE — a short purpose string for each agent tool, phrased as the
 * WHY behind the action. Where the gerund labels (src/shell/toolLabels.ts) say
 * WHAT the agent is doing, these say why it matters, so the live work panel can
 * surface the agent's reasoning during a run instead of a static platitude.
 *
 * Unknown tools have no rationale (rationaleForTool returns undefined); callers
 * must render gracefully when absent.
 */
export const TOOL_RATIONALE: Record<string, string> = {
  // Common
  search_places: 'Finding real, tool-sourced places instead of guessing',
  get_place_details: 'Pulling live details so every fact is verifiable',
  get_environment: 'Reading live air, weather and pollen for this spot',
  ask_maps: 'Grounding the answer in Google Maps data',
  draw_route: 'Showing the real route so the plan is legible',

  // Insight
  analyze_location: 'Reading the block from live neighborhood signals',
  compare_with: 'Weighing two places on the same evidence',

  // Fleet
  get_fleet_state: 'Reading the live fleet before committing anything',
  eta_matrix: 'Comparing live ETAs to find the fastest van',
  assign_job: 'Committing the best-justified assignment',

  // Concierge
  propose_itinerary: 'Ordering real, open places into a walkable day',

  // Ad Studio
  gather_campaign_facts: 'Grounding the campaign in verifiable truth',
  generate_ad_creatives: 'Conditioning creatives on the real storefront',
  set_geo_targeting: 'Sizing reach by real walk/drive time',

  // Cinema
  narrate_stop: 'Telling the story from grounded facts only',

  // Scout
  scout_area: 'Fanning out for real candidate sites',
  inspect_candidate: 'Grounding each site in real Street View + aerial imagery',
  score_candidates: 'Weighing evidence against your priorities',
  compare_sites: 'Defending the winner with a side-by-side matrix',
};

/** Short purpose string for a tool, or undefined when none is defined. */
export function rationaleForTool(name: string): string | undefined {
  return TOOL_RATIONALE[name];
}
