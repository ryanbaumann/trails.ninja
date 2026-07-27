/**
 * Human-facing labels for every agent tool, phrased as agentic gerunds so the
 * live status chips and progress panel read as "the agent doing something" —
 * never as raw snake_case tool names. Unknown names fall through to a
 * spaced-out version of the name, so a new tool is never rendered as a broken
 * label; add it here to give it the agent voice.
 */
export const TOOL_LABELS: Record<string, string> = {
  // Common tools (src/ai/tools/common.ts + genui)
  fly_to: 'Flying the camera',
  search_places: 'Searching places',
  get_place_details: 'Reading place details',
  focus_place: 'Focusing on the place',
  add_markers: 'Pinning the map',
  clear_map: 'Clearing the map',
  draw_route: 'Drawing the route',
  get_environment: 'Reading environmental signals',
  ask_maps: 'Asking Google Maps',
  show_notice: 'Posting a note',
  render_surface: 'Rendering the response',

  // Concierge
  propose_itinerary: 'Planning the itinerary',
  update_itinerary: 'Revising the plan',
  set_travel_mode: 'Setting the travel mode',
  play_tour: 'Playing the tour',
  make_postcard: 'Painting the postcard',

  // Insight
  analyze_location: 'Reading the location',
  compare_with: 'Comparing locations',
  toggle_air_quality_layer: 'Toggling the air-quality layer',
  ask_atlas_brief: 'Writing the brief',

  // Fleet
  get_fleet_state: 'Checking the fleet',
  eta_matrix: 'Computing live ETAs',
  assign_job: 'Assigning the job',
  set_avoid_zone: 'Setting an avoid zone',
  set_sim_speed: 'Adjusting the clock',
  follow_van: 'Following the van',

  // Cinema
  start_tour: 'Starting the tour',
  tour_control: 'Directing the tour',
  narrate_stop: 'Narrating this stop',
  orbit: 'Orbiting the view',
  generate_tour_video: 'Filming the tour',

  // Ad Studio
  set_campaign_business: 'Setting the business',
  gather_campaign_facts: 'Gathering grounded facts',
  generate_ad_creatives: 'Generating ad creatives',
  set_geo_targeting: 'Building geo-targeting',
  export_campaign: 'Exporting the campaign',

  // Scout
  scout_area: 'Scouting candidate sites',
  inspect_candidate: 'Walking the block on Street View',
  score_candidates: 'Weighing the evidence',
  show_evidence: 'Laying out the evidence',
  compare_sites: 'Ranking the sites',
  walkthrough_video: 'Filming the walkthrough',

  // Forward-compatible: labelled ahead of the tool landing (safe if absent).
  reveal_in_3d: 'Revealing it in 3D',
};

export function labelForTool(name: string): string {
  return TOOL_LABELS[name] ?? name.replace(/_/g, ' ');
}
