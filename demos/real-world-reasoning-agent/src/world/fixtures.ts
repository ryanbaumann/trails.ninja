import type { ProviderResult, WorldConditions, WorldMatrixCell, WorldPlace, WorldRoute } from './contracts';
import type { ConditionsProvider, PlacesProvider, RoutesProvider } from './ports';
import { classifyProviderError, fixtureEvidence, toJsonSafe } from './results';

export interface FixtureWorldData {
  places?: WorldPlace[];
  route?: WorldRoute;
  matrix?: WorldMatrixCell[];
  conditions?: WorldConditions;
  outcomes?: {
    placeSearch?: ProviderResult<WorldPlace[]>;
    placeDetails?: ProviderResult<WorldPlace>;
    route?: ProviderResult<WorldRoute>;
    matrix?: ProviderResult<WorldMatrixCell[]>;
    conditions?: ProviderResult<WorldConditions>;
  };
}

export function createFixtureWorld(data: FixtureWorldData = {}): {
  places: PlacesProvider;
  routes: RoutesProvider;
  conditions: ConditionsProvider;
} {
  const safe = <T>(outcome: ProviderResult<T>): ProviderResult<T> => {
    try {
      return toJsonSafe(outcome);
    } catch (cause) {
      return { status: 'failure', evidence: fixtureEvidence(), error: classifyProviderError(cause) };
    }
  };
  const result = <T>(value: T | undefined, empty: (v: T) => boolean = () => false): ProviderResult<T> =>
    safe(value === undefined || empty(value)
      ? { status: 'empty', evidence: fixtureEvidence() }
      : { status: 'success', value, evidence: fixtureEvidence() });
  const places = data.places ?? [];
  const cancelled = <T>(): ProviderResult<T> => ({
    status: 'cancelled',
    evidence: fixtureEvidence(),
    error: { code: 'cancelled', message: 'Provider request was cancelled.', retryable: false },
  });
  return {
    places: {
      searchText: async (_request, context) => context?.cancellation?.aborted
        ? cancelled()
        : data.outcomes?.placeSearch ? safe(data.outcomes.placeSearch) : result(places, (value) => value.length === 0),
      searchNearby: async (_request, context) => context?.cancellation?.aborted
        ? cancelled()
        : data.outcomes?.placeSearch ? safe(data.outcomes.placeSearch) : result(places, (value) => value.length === 0),
      details: async (placeId, context) => context?.cancellation?.aborted
        ? cancelled()
        : data.outcomes?.placeDetails ? safe(data.outcomes.placeDetails) : result(places.find((place) => place.id === placeId)),
    },
    routes: {
      computeRoute: async (_request, context) => context?.cancellation?.aborted
        ? cancelled()
        : data.outcomes?.route ? safe(data.outcomes.route) : result(data.route),
      computeMatrix: async (_request, context) => context?.cancellation?.aborted
        ? cancelled()
        : data.outcomes?.matrix ? safe(data.outcomes.matrix) : result(data.matrix ?? [], (value) => value.length === 0),
    },
    conditions: {
      snapshot: async (_location, context) => context?.cancellation?.aborted
        ? cancelled()
        : data.outcomes?.conditions ? safe(data.outcomes.conditions) : result(data.conditions),
    },
  };
}
