import { createExplorerFixture } from '@/explorer/fixtures';
import { buildExplorerSurface } from '@/explorer/presenter';
import { buildExplorerFallbackAnswer } from '@/explorer/answer';
import { rerunExplorerRoutes, runExplorer } from '@/explorer/runtime';
import type { ExplorerRun, ExplorerTravelMode, ExplorerUpdate, MapsGroundingProvider } from '@/explorer/contracts';
import type { ExplorerEvalTrace } from './types';

export interface ExplorerEvalCase {
  id: string;
  scenario: 'default' | 'no-results' | 'weather-unavailable' | 'counterfactual-drive';
  query: string;
  expectedTerminal: string;
  expectedWinnerId?: string;
  expectedTravelMode: ExplorerTravelMode;
  expectedWeatherRequested: boolean;
  expectedWeatherLookups: number;
}

const baseInput = { origin: { lat: 1, lng: 2 }, surfaceId: 'universal-explorer' };

function observeProvider(provider: MapsGroundingProvider) {
  const events: string[] = [];
  let activeRoutes = 0;
  let valid = true;
  const observed: MapsGroundingProvider = {
    async searchPlaces(input, signal) {
      if (events.length) valid = false;
      events.push('search');
      return provider.searchPlaces(input, signal);
    },
    async computeRoute(input, signal) {
      if (activeRoutes > 0) valid = false;
      activeRoutes += 1;
      events.push(`route:${input.destinationPlaceId}`);
      try { return await provider.computeRoute(input, signal); } finally { activeRoutes -= 1; }
    },
    async lookupWeather(input, signal) {
      if (activeRoutes > 0 || !events.some((event) => event.startsWith('route:'))) valid = false;
      events.push('weather');
      return provider.lookupWeather(input, signal);
    },
  };
  return { provider: observed, events, valid: () => valid };
}

function renderedEvidence(run: ExplorerRun) {
  const message = buildExplorerSurface(run.view, true).find((candidate) => 'updateComponents' in candidate);
  const components = message && 'updateComponents' in message ? message.updateComponents.components : [];
  const byId = new Map(components.map((component) => [component.id, component]));
  const root = byId.get('root');
  const children = root && Array.isArray(root.children) ? root.children.filter((id): id is string => typeof id === 'string') : [];
  const sourceCount = components.filter((component) => component.component === 'GroundingAttribution').length;
  const adjacent = run.view.dataMode === 'sample' || (run.view.candidates.every((_, index) => {
    const column = byId.get(`candidate-${index}-column`);
    const cardChildren = Array.isArray(column?.children) ? column.children : [];
    const claim = cardChildren.indexOf(`candidate-${index}-claim`);
    return claim >= 0 && cardChildren[claim + 1] === `candidate-${index}-source`;
  }) && (!run.view.weather || (() => {
    const column = byId.get('weather-column');
    const cardChildren = Array.isArray(column?.children) ? column.children : [];
    const claim = cardChildren.indexOf('weather-claim');
    return claim >= 0 && cardChildren[claim + 1] === 'weather-source';
  })()));
  const winnerIndex = components.findIndex((component) => component.id.startsWith('candidate-')
    && component.id.endsWith('-claim') && component.variant === 'h5');
  const winnerNode = winnerIndex >= 0 ? components[winnerIndex] : undefined;
  const index = winnerNode ? Number(winnerNode.id.split('-')[1]) : -1;
  const answer = buildExplorerFallbackAnswer(run.view);
  return {
    visibleSources: sourceCount,
    sourcesAdjacent: adjacent,
    limitationsVisible: children.includes('explorer-limitations')
      || run.view.stage === 'needs-clarification' || run.view.stage === 'empty',
    explanationVisible: answer.trim().length > 0 && !/https?:\/\/|github/i.test(answer),
    surfaceRecommendationId: index >= 0 ? run.view.candidates[index]?.id : undefined,
  };
}

function lastMapWinner(updates: ExplorerUpdate[]): string | undefined {
  const markerEffects = updates.flatMap((update) => update.effects)
    .filter((effect) => effect.type === 'map.replace-markers');
  return markerEffects.at(-1)?.markers[0]?.placeId;
}

function toTrace(
  evalCase: ExplorerEvalCase,
  run: ExplorerRun,
  updates: ExplorerUpdate[],
  providerSearches: number,
  weatherLookups: number,
  dependencyOrderValid: boolean,
): ExplorerEvalTrace {
  const final = run.view;
  const rendered = renderedEvidence(run);
  const groundedClaims = final.dataMode === 'sample' ? 0 : final.candidates.length + (final.weather ? 1 : 0);
  const durations = final.candidates.flatMap((candidate) => candidate.route ? [candidate.route.durationSeconds] : []);
  return {
    caseId: evalCase.id,
    expectedTerminal: evalCase.expectedTerminal,
    terminal: final.stage,
    expectedTravelMode: evalCase.expectedTravelMode,
    travelMode: final.travelMode,
    expectedWeatherRequested: evalCase.expectedWeatherRequested,
    weatherRequested: final.currentWeatherRequested,
    expectedWeatherLookups: evalCase.expectedWeatherLookups,
    weatherLookups,
    expectedRecommendationId: evalCase.expectedWinnerId,
    capabilityProfile: final.capabilityProfile,
    surfaceIds: updates.map((update) => update.view.surfaceId),
    firstMapEffectMs: final.firstMapEffectMs,
    providerSearches,
    groundedClaims,
    ...rendered,
    hardConstraintViolations: final.candidates.filter((candidate) => candidate.eligible
      && (candidate.route?.durationSeconds ?? Infinity) > final.maxTravelMinutes * 60).length,
    candidateCount: final.candidates.length,
    genericCandidateLabels: final.candidates.filter((candidate) => /^Grounded candidate \d+$/u.test(candidate.label)).length,
    distinctVerifiedDurations: new Set(durations).size,
    dependencyOrderValid,
    rawToolTranscriptVisible: false,
    resumeRequired: false,
    recommendationId: final.winnerId,
    mapWinnerId: lastMapWinner(updates),
  };
}

export async function executeExplorerEvalCase(evalCase: ExplorerEvalCase): Promise<ExplorerEvalTrace> {
  const fixture = createExplorerFixture({
    ...(evalCase.scenario === 'no-results' ? { places: { status: 'empty' as const } } : {}),
    ...(evalCase.scenario === 'weather-unavailable'
      ? { weather: { status: 'failure' as const, message: 'Unavailable.', retryable: true } } : {}),
  });
  const observed = observeProvider(fixture);
  const updates: ExplorerUpdate[] = [];
  const input = { ...baseInput, query: evalCase.query };
  const initial = await runExplorer(input, { grounding: observed.provider, now: () => 100 }, (update) => { updates.push(update); });
  if (evalCase.scenario !== 'counterfactual-drive') {
    return toTrace(
      evalCase,
      initial,
      updates,
      observed.events.filter((event) => event === 'search').length,
      observed.events.filter((event) => event === 'weather').length,
      observed.valid(),
    );
  }

  const counterUpdates: ExplorerUpdate[] = [];
  const searchesBefore = observed.events.filter((event) => event === 'search').length;
  const weatherBefore = observed.events.filter((event) => event === 'weather').length;
  const rerun = await rerunExplorerRoutes(initial, input, 'DRIVE', { grounding: observed.provider }, (update) => { counterUpdates.push(update); });
  const trace = toTrace(
    evalCase,
    rerun,
    counterUpdates,
    observed.events.filter((event) => event === 'search').length - searchesBefore,
    observed.events.filter((event) => event === 'weather').length - weatherBefore,
    observed.valid(),
  );
  return {
    ...trace,
    counterfactual: { previousWinnerId: initial.view.winnerId, reusedSurface: rerun.view.surfaceId === initial.view.surfaceId },
  };
}

export async function executeExplorerEval(cases: ExplorerEvalCase[]): Promise<ExplorerEvalTrace[]> {
  return Promise.all(cases.map(executeExplorerEvalCase));
}
