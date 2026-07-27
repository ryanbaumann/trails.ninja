import { uid } from '@/lib/id';
import { CITIES } from '@/lib/cities';
import { atlas } from '@/state/store';
import { genui } from '@/genui/store';
import { applyAtlasEffects } from '@/capabilities/atlasAdapter';
import { groundingLiteProvider } from '@/services/groundingLite';
import { routesProvider } from '@/services/routes';
import { createFixtureWorld } from '@/world/fixtures';
import { createExplorerFixture } from './fixtures';
import { buildExplorerSurface } from './presenter';
import { buildExplorerFallbackAnswer, generateExplorerAnswer } from './answer';
import { classifyExplorerIntent } from './intent';
import { rerunExplorerRoutes, runExplorer } from './runtime';
import { suggestFollowups } from '@/ai/followups';
import type { ExplorerDependencies, ExplorerRun, ExplorerRunInput, ExplorerTravelMode, ExplorerUpdate } from './contracts';

let generation = 0;
let activeAbort: AbortController | undefined;
let activeRun: ExplorerRun | undefined;
let activeInput: ExplorerRunInput | undefined;
let activeDependencies: ExplorerDependencies | undefined;
let activeAnswerId: string | undefined;

const ANSWER_TIMEOUT_MS = 12_000;

/** GenUI scope owned by the explorer runtime (previously borrowed from Scout). */
const EXPLORER_SCOPE = 'explorer';

async function boundedExplorerAnswer(view: ExplorerRun['view'], signal: AbortSignal): Promise<string> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = globalThis.setTimeout(abort, ANSWER_TIMEOUT_MS);
  signal.addEventListener('abort', abort, { once: true });
  try {
    return await generateExplorerAnswer(view, controller.signal);
  } finally {
    globalThis.clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  }
}

function demoDisplayRoutes(): ExplorerDependencies['displayRoutes'] {
  const fixture = createFixtureWorld({
    route: {
      path: [{ lat: 37.7955, lng: -122.3937 }, { lat: 37.797, lng: -122.395 }],
      distanceMeters: 675,
      durationSeconds: 540,
    },
  }).routes;
  return {
    async computeRoute(request, context) {
      const outcome = await fixture.computeRoute(request, context);
      if ((outcome.status !== 'success' && outcome.status !== 'partial')
        || typeof request.origin === 'string' || typeof request.destination === 'string') return outcome;
      return { ...outcome, value: { ...outcome.value, path: [request.origin, request.destination] } };
    },
    computeMatrix: (request, context) => fixture.computeMatrix(request, context),
  };
}

function present(runGeneration: number, update: ExplorerUpdate): void {
  if (runGeneration !== generation || activeAbort?.signal.aborted) return;
  const existing = genui().getSurface(update.view.surfaceId);
  const result = genui().applyMessages(EXPLORER_SCOPE, buildExplorerSurface(update.view, !existing));
  if (result.errors.length) {
    atlas().pushToast('bad', 'The explorer surface could not be updated.');
    return;
  }
  if (!existing) {
    atlas().addMsg({ id: uid('surface'), role: 'surface', surfaceId: update.view.surfaceId, ts: Date.now() });
  }
  applyAtlasEffects(update.effects);
}

export function startExplorerJourney(input: {
  goal: string;
  cityId: string;
  mode: 'demo' | 'live';
  location?: { lat: number; lng: number };
}): void {
  activeAbort?.abort();
  const runGeneration = ++generation;
  activeAbort = new AbortController();
  const signal = activeAbort.signal;
  const city = CITIES.find((candidate) => candidate.id === input.cityId) ?? CITIES[0];
  const intent = classifyExplorerIntent(input.goal);
  const runInput: ExplorerRunInput = {
    query: input.goal,
    dataMode: input.mode === 'live' ? 'live' : 'sample',
    origin: input.location ?? city.center,
    regionCode: city.country === 'UK' ? 'GB' : city.country,
    units: city.country === 'US' ? 'IMPERIAL' : 'METRIC',
    travelMode: intent.travelMode,
    intent,
    maxTravelMinutes: 15,
    surfaceId: 'universal-explorer',
    signal,
  };
  const dependencies: ExplorerDependencies = input.mode === 'live'
    ? { grounding: groundingLiteProvider, displayRoutes: routesProvider }
    : { grounding: createExplorerFixture(), displayRoutes: demoDisplayRoutes() };
  activeInput = runInput;
  activeDependencies = dependencies;
  activeRun = undefined;

  const state = atlas();
  state.dismissLanding();
  state.clearMap();
  state.clearChat();
  genui().clearScenario(EXPLORER_SCOPE);
  state.setResumable(null);
  state.setFollowups([]);
  state.addMsg({ id: uid('user'), role: 'user', text: input.goal, ts: Date.now() });
  activeAnswerId = undefined;
  state.setRunning(true);

  void runExplorer(runInput, dependencies, (update) => present(runGeneration, update)).then(async (run) => {
    if (runGeneration !== generation || activeAbort?.signal.aborted) return;
    activeRun = run;
    activeAnswerId = uid('answer');
    state.addMsg({ id: activeAnswerId, role: 'model', text: buildExplorerFallbackAnswer(run.view), streaming: false, ts: Date.now() });
    if (run.view.dataMode !== 'sample' && run.view.winnerId) {
      const answer = await boundedExplorerAnswer(run.view, signal);
      if (runGeneration === generation && !activeAbort?.signal.aborted && activeAnswerId) {
        state.updateMsg(activeAnswerId, { text: answer, streaming: false });
      }
    }
    const followups = await suggestFollowups(atlas().activeScenario, signal);
    if (runGeneration === generation && !activeAbort?.signal.aborted && followups.length) {
      state.setFollowups(followups);
    }
    state.setRunning(false);
  });
}

export function changeExplorerTravelMode(travelMode: ExplorerTravelMode): void {
  if (!activeRun || !activeInput || !activeDependencies) return;
  activeAbort?.abort();
  const runGeneration = ++generation;
  activeAbort = new AbortController();
  const signal = activeAbort.signal;
  activeInput = { ...activeInput, travelMode, signal };
  const prior = activeRun;
  const state = atlas();
  if (activeAnswerId) state.updateMsg(activeAnswerId, { text: '', streaming: true });
  state.setRunning(true);
  void rerunExplorerRoutes(prior, activeInput, travelMode, activeDependencies, (update) => present(runGeneration, update)).then(async (run) => {
    if (runGeneration !== generation || activeAbort?.signal.aborted) return;
    activeRun = run;
    if (!activeAnswerId) return;
    state.updateMsg(activeAnswerId, { text: buildExplorerFallbackAnswer(run.view), streaming: false });
    if (run.view.dataMode !== 'sample' && run.view.winnerId) {
      const answer = await boundedExplorerAnswer(run.view, signal);
      if (runGeneration === generation && !activeAbort?.signal.aborted && activeAnswerId) {
        state.updateMsg(activeAnswerId, { text: answer, streaming: false });
      }
    }
    const followups = await suggestFollowups(atlas().activeScenario, signal);
    if (runGeneration === generation && !activeAbort?.signal.aborted && followups.length) {
      state.setFollowups(followups);
    }
    state.setRunning(false);
  });
}

export function cancelExplorerJourney(): void {
  generation += 1;
  activeAbort?.abort();
  activeAbort = undefined;
  activeRun = undefined;
  activeInput = undefined;
  activeDependencies = undefined;
  activeAnswerId = undefined;
  atlas().setRunning(false);
}
