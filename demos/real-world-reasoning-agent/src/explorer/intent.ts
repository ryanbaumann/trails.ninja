import type { ExplorerIntent } from './contracts';

const DRIVE_TERMS = /\b(?:drive|driving|car)\b/iu;
const WALK_TERMS = /\b(?:walk|walking|on foot)\b/iu;
const CURRENT_WEATHER_TERMS = /\b(?:weather|jacket|umbrella|raincoat|raining|temperature)\b/iu;

/** Deterministic, conservative interpretation of the first-run prompt. */
export function classifyExplorerIntent(query: string): ExplorerIntent {
  const asksToDrive = DRIVE_TERMS.test(query);
  const asksToWalk = WALK_TERMS.test(query);
  return {
    travelMode: asksToDrive && !asksToWalk ? 'DRIVE' : 'WALK',
    currentWeatherRequested: CURRENT_WEATHER_TERMS.test(query),
  };
}
