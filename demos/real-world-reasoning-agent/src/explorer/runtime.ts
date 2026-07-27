import type {
  ExplorerCandidate,
  ExplorerDependencies,
  ExplorerRun,
  ExplorerRunInput,
  ExplorerTravelMode,
  ExplorerUpdate,
  ExplorerView,
  GroundedPlace,
} from './contracts';
import { explorerCapabilityProfile } from './capabilities';
import { classifyExplorerIntent } from './intent';

const WALK_WARNING = 'Walking routes are in beta and may sometimes lack clear sidewalks or pedestrian paths.';

type Emit = (update: ExplorerUpdate) => void | Promise<void>;

function durationLabel(seconds: number): string {
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

function rank(candidates: ExplorerCandidate[], maxMinutes: number): ExplorerCandidate[] {
  const eligibleIds = candidates
    .filter((candidate) => candidate.routeStatus === 'verified'
      && (candidate.route?.durationSeconds ?? Infinity) <= maxMinutes * 60)
    .sort((a, b) => (a.route?.durationSeconds ?? Infinity) - (b.route?.durationSeconds ?? Infinity))
    .map((candidate) => candidate.id);
  const rankById = new Map(eligibleIds.map((id, index) => [id, index + 1]));
  return candidates.map((candidate) => {
    const candidateRank = rankById.get(candidate.id);
    return { ...candidate, eligible: candidateRank !== undefined, ...(candidateRank ? { rank: candidateRank } : {}) };
  });
}

function initialView(input: ExplorerRunInput, dependencies: ExplorerDependencies): ExplorerView {
  const intent = input.intent ?? classifyExplorerIntent(input.query);
  return {
    schemaVersion: '1',
    surfaceId: input.surfaceId ?? 'universal-explorer',
    revision: 0,
    stage: 'interpreting',
    narrative: 'Understanding the decision and its hard constraints.',
    query: input.query.trim(),
    dataMode: input.dataMode ?? 'sample',
    travelMode: input.travelMode ?? intent.travelMode,
    currentWeatherRequested: intent.currentWeatherRequested,
    maxTravelMinutes: input.maxTravelMinutes ?? 15,
    candidates: [],
    limitations: [],
    capabilityProfile: explorerCapabilityProfile(Boolean(dependencies.displayRoutes), intent.currentWeatherRequested),
  };
}

export function cleanSearchQuery(query: string): string {
  let clean = query.trim();
  // Remove conversational prefixes:
  clean = clean.replace(/^(?:find\s+a\s+nearby|find\s+nearby|find\s+a|find|show\s+me\s+a\s+nearby|show\s+me\s+a|show\s+me|show|search\s+for\s+a|search\s+for|search)\s+/i, '');
  // Remove travel mode/distance constraints suffixes:
  clean = clean.replace(/\s+with\s+the\s+shortest\s+verified\s+(?:walk|drive|route|trip)/i, '');
  clean = clean.replace(/\s+with\s+the\s+shortest\s+(?:walk|drive|route|trip)/i, '');
  clean = clean.replace(/\s+with\s+verified\s+(?:walk|drive|route|trip)/i, '');
  // Remove weather/jacket conditions followups:
  clean = clean.replace(/;\s+tell\s+me\s+(?:if|whether)\s+I\s+need\s+a\s+jacket\.?$/i, '');
  clean = clean.replace(/;\s+do\s+I\s+need\s+a\s+jacket\.?$/i, '');
  // Remove trailing periods or question marks:
  clean = clean.replace(/[.;?!]+$/, '').trim();
  return clean || query;
}

function cancelled(signal?: AbortSignal): boolean {
  return signal?.aborted === true;
}

function hasPlaceIntent(query: string): boolean {
  const generic = new Set(['a', 'an', 'the', 'find', 'show', 'me', 'some', 'somewhere', 'place', 'places', 'good', 'best', 'near', 'nearby', 'around', 'here', 'please']);
  return query.toLowerCase().split(/[^\p{L}\p{N}]+/u)
    .some((token) => token.length >= 3 && !generic.has(token) && !/^\d+$/.test(token));
}

async function publish(view: ExplorerView, effects: ExplorerUpdate['effects'], emit: Emit): Promise<ExplorerView> {
  const next = { ...view, revision: view.revision + 1 };
  await emit({ view: next, effects });
  return next;
}

function candidateEffects(places: GroundedPlace[]): ExplorerUpdate['effects'] {
  if (!places.length) return [{ type: 'map.replace-markers', scope: 'universal-explorer', markers: [] }];
  return [
    {
      type: 'map.replace-markers',
      scope: 'universal-explorer',
      markers: places.map((place, index) => ({
        position: place.location,
        label: String(index + 1),
        title: place.label,
        placeId: place.id,
        color: '#22d3ee',
      })),
    },
    { type: 'map.fit', points: places.map((place) => place.location) },
  ];
}

async function rankedWinnerEffects(
  input: ExplorerRunInput,
  candidates: ExplorerCandidate[],
  winner: ExplorerCandidate,
  dependencies: ExplorerDependencies,
): Promise<ExplorerUpdate['effects']> {
  const ranked = [...candidates].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  return [...candidateEffects(ranked), ...await drawWinnerRoute(input, winner, dependencies)];
}

async function drawWinnerRoute(
  input: ExplorerRunInput,
  winner: ExplorerCandidate | undefined,
  dependencies: ExplorerDependencies,
): Promise<ExplorerUpdate['effects']> {
  if (!winner || !dependencies.displayRoutes) {
    return [{ type: 'map.replace-route', scope: 'universal-explorer', route: null }];
  }
  const outcome = await dependencies.displayRoutes.computeRoute({
    origin: input.origin,
    destination: winner.location,
    travelMode: input.travelMode ?? 'WALK',
  }, { cancellation: input.signal ? { get aborted() { return input.signal!.aborted; } } : undefined });
  if (outcome.status !== 'success' && outcome.status !== 'partial') {
    return [{ type: 'map.replace-route', scope: 'universal-explorer', route: null }];
  }
  return [{
    type: 'map.replace-route',
    scope: 'universal-explorer',
    route: { path: outcome.value.path, color: '#22d3ee' },
  }];
}

export async function runExplorer(
  input: ExplorerRunInput,
  dependencies: ExplorerDependencies,
  emit: Emit,
): Promise<ExplorerRun> {
  const classified = classifyExplorerIntent(input.query);
  const intent = input.intent ?? {
    ...classified,
    ...(input.travelMode ? { travelMode: input.travelMode } : {}),
  };
  input = { ...input, intent, travelMode: intent.travelMode };
  const now = dependencies.now ?? Date.now;
  const startedAt = now();
  let view = initialView(input, dependencies);
  view = await publish(view, [], emit);

  if (!hasPlaceIntent(view.query)) {
    view = await publish({
      ...view,
      stage: 'needs-clarification',
      narrative: 'Tell me what kind of place you need; the selected area is already set.',
      capabilityProfile: ['world.presentation.explorer@1'],
    }, [], emit);
    return { view, places: [] };
  }

  view = await publish({ ...view, stage: 'searching', narrative: 'Finding relevant places near the selected area.' }, [], emit);
  const search = await dependencies.grounding.searchPlaces({
    query: cleanSearchQuery(view.query),
    near: input.origin,
    regionCode: input.regionCode,
  }, input.signal);
  if (cancelled(input.signal) || search.status === 'cancelled') {
    view = await publish({ ...view, stage: 'cancelled', narrative: 'This exploration was cancelled.' }, [], emit);
    return { view, places: [] };
  }
  if (search.status === 'empty') {
    view = await publish({ ...view, stage: 'empty', narrative: 'No matching places were returned. Try a broader category or area.' }, candidateEffects([]), emit);
    return { view, places: [] };
  }
  if (search.status === 'failure') {
    view = await publish({ ...view, stage: 'failed', narrative: search.message, limitations: [search.message] }, [], emit);
    return { view, places: [] };
  }

  const places = search.value.filter((place) => Number.isFinite(place.location.lat) && Number.isFinite(place.location.lng)).slice(0, 3);
  if (!places.length) {
    view = await publish({ ...view, stage: 'empty', narrative: 'Places were returned without usable map locations.' }, candidateEffects([]), emit);
    return { view, places: [] };
  }
  const firstMapEffectMs = Math.max(0, now() - startedAt);
  view = await publish({
    ...view,
    stage: 'checking-routes',
    narrative: `Found ${places.length} candidates. Checking the ${view.maxTravelMinutes}-minute ${view.travelMode.toLowerCase()} limit.`,
    firstMapEffectMs,
    ...(search.summary ? { groundedSummary: search.summary } : {}),
    candidates: places.map((place) => ({ ...place, routeStatus: 'pending', eligible: false })),
  }, candidateEffects(places), emit);

  const routed: ExplorerCandidate[] = [];
  for (const place of places) {
    if (cancelled(input.signal)) break;
    const route = await dependencies.grounding.computeRoute({
      origin: input.origin,
      destinationPlaceId: place.id,
      travelMode: view.travelMode,
    }, input.signal);
    routed.push(route.status === 'success'
      ? { ...place, route: route.value, routeStatus: 'verified', eligible: false }
      : { ...place, routeStatus: 'unavailable', eligible: false });
  }
  if (cancelled(input.signal)) {
    view = await publish({ ...view, stage: 'cancelled', narrative: 'This exploration was cancelled.' }, [], emit);
    return { view, places };
  }

  const candidates = rank(routed, view.maxTravelMinutes);
  const winner = candidates.find((candidate) => candidate.rank === 1);
  const routeLimitations = candidates.some((candidate) => candidate.routeStatus === 'unavailable')
    ? ['One or more routes could not be verified and were excluded.']
    : [];
  if (!winner) {
    view = await publish({
      ...view,
      stage: 'partial',
      narrative: `No candidate has a verified ${view.travelMode.toLowerCase()} route within ${view.maxTravelMinutes} minutes.`,
      candidates,
      limitations: [...routeLimitations, ...(view.travelMode === 'WALK' ? [WALK_WARNING] : [])],
    }, [{ type: 'map.replace-route', scope: 'universal-explorer', route: null }], emit);
    return { view, places };
  }

  if (!view.currentWeatherRequested) {
    view = await publish({
      ...view,
      stage: routeLimitations.length ? 'partial' : 'ready',
      narrative: `${winner.label} is the first relevant place inside the verified ${view.maxTravelMinutes}-minute ${view.travelMode.toLowerCase()} limit.`,
      candidates,
      winnerId: winner.id,
      limitations: [
        ...routeLimitations,
        ...(view.travelMode === 'WALK' ? [WALK_WARNING] : []),
        'Search relevance is not a measured quietness score.',
      ],
    }, await rankedWinnerEffects(input, candidates, winner, dependencies), emit);
    return { view, places };
  }

  view = await publish({
    ...view,
    stage: 'checking-weather',
    narrative: `${winner.label} is the first relevant candidate inside the hard travel limit (${durationLabel(winner.route!.durationSeconds)}). Checking current weather.`,
    candidates,
    winnerId: winner.id,
    limitations: view.travelMode === 'WALK' ? [WALK_WARNING] : [],
  }, await rankedWinnerEffects(input, candidates, winner, dependencies), emit);

  const weather = await dependencies.grounding.lookupWeather({
    placeId: winner.id,
    units: input.units ?? 'METRIC',
  }, input.signal);
  if (cancelled(input.signal) || weather.status === 'cancelled') {
    view = await publish({ ...view, stage: 'cancelled', narrative: 'This exploration was cancelled.' }, [], emit);
    return { view, places };
  }
  const weatherMissing = weather.status !== 'success';
  view = await publish({
    ...view,
    stage: weatherMissing || routeLimitations.length ? 'partial' : 'ready',
    narrative: weatherMissing
      ? `${winner.label} fits the verified travel limit. Current weather is unavailable, so no jacket claim is made.`
      : `${winner.label} is the first relevant place inside the verified ${view.maxTravelMinutes}-minute limit.`,
    candidates,
    winnerId: winner.id,
    ...(weather.status === 'success' ? { weather: weather.value } : {}),
    limitations: [
      ...routeLimitations,
      ...(view.travelMode === 'WALK' ? [WALK_WARNING] : []),
      ...(weatherMissing ? ['Current weather could not be verified.'] : []),
      'Search relevance is not a measured quietness score.',
    ],
  }, [], emit);
  return { view, places };
}

export async function rerunExplorerRoutes(
  prior: ExplorerRun,
  input: ExplorerRunInput,
  travelMode: ExplorerTravelMode,
  dependencies: ExplorerDependencies,
  emit: Emit,
): Promise<ExplorerRun> {
  const priorIntent = input.intent ?? classifyExplorerIntent(prior.view.query);
  const nextInput = {
    ...input,
    query: prior.view.query,
    surfaceId: prior.view.surfaceId,
    travelMode,
    intent: { ...priorIntent, travelMode },
  };
  let view = await publish({
    ...prior.view,
    travelMode,
    stage: 'checking-routes',
    narrative: `Rechecking only the saved shortlist by ${travelMode.toLowerCase()}.`,
    candidates: prior.places.map((place) => ({ ...place, routeStatus: 'pending', eligible: false })),
    winnerId: undefined,
    weather: undefined,
  }, [{ type: 'map.replace-route', scope: 'universal-explorer', route: null }], emit);
  const routed: ExplorerCandidate[] = [];
  for (const place of prior.places) {
    if (cancelled(input.signal)) break;
    const outcome = await dependencies.grounding.computeRoute({
      origin: input.origin,
      destinationPlaceId: place.id,
      travelMode,
    }, input.signal);
    routed.push(outcome.status === 'success'
      ? { ...place, route: outcome.value, routeStatus: 'verified', eligible: false }
      : { ...place, routeStatus: 'unavailable', eligible: false });
  }
  if (cancelled(input.signal)) {
    view = await publish({ ...view, stage: 'cancelled', narrative: 'This exploration was cancelled.' }, [], emit);
    return { view, places: prior.places };
  }
  const candidates = rank(routed, view.maxTravelMinutes);
  const winner = candidates.find((candidate) => candidate.rank === 1);
  const markerEffects = candidateEffects(
    [...candidates].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)),
  );
  const routeEffects = await drawWinnerRoute(nextInput, winner, dependencies);
  view = await publish({
    ...view,
    stage: winner && !view.currentWeatherRequested ? 'ready' : 'partial',
    narrative: winner
      ? `${winner.label} now has the shortest verified ${travelMode.toLowerCase()} trip inside the ${view.maxTravelMinutes}-minute limit.`
      : `No saved candidate has a verified ${travelMode.toLowerCase()} trip inside the ${view.maxTravelMinutes}-minute limit.`,
    candidates,
    winnerId: winner?.id,
    limitations: [
      ...(travelMode === 'WALK' ? [WALK_WARNING] : []),
      'Search relevance is not a measured quietness score.',
    ],
  }, [...markerEffects, ...routeEffects], emit);
  if (!winner || !view.currentWeatherRequested) return { view, places: prior.places };

  view = await publish({
    ...view,
    stage: 'checking-weather',
    narrative: `${winner.label} now has the shortest verified ${travelMode.toLowerCase()} trip. Checking current weather for the new winner.`,
  }, [], emit);
  const weather = await dependencies.grounding.lookupWeather({
    placeId: winner.id,
    units: input.units ?? 'METRIC',
  }, input.signal);
  if (cancelled(input.signal) || weather.status === 'cancelled') {
    view = await publish({ ...view, stage: 'cancelled', narrative: 'This exploration was cancelled.' }, [], emit);
    return { view, places: prior.places };
  }
  const weatherMissing = weather.status !== 'success';
  view = await publish({
    ...view,
    stage: weatherMissing ? 'partial' : 'ready',
    narrative: weatherMissing
      ? `${winner.label} fits the verified travel limit. Current weather is unavailable, so no jacket claim is made.`
      : `${winner.label} now has the shortest verified ${travelMode.toLowerCase()} trip inside the ${view.maxTravelMinutes}-minute limit.`,
    ...(weather.status === 'success' ? { weather: weather.value } : {}),
    limitations: [
      ...(travelMode === 'WALK' ? [WALK_WARNING] : []),
      ...(weatherMissing ? ['Current weather could not be verified.'] : []),
      'Search relevance is not a measured quietness score.',
    ],
  }, [], emit);
  return { view, places: prior.places };
}
