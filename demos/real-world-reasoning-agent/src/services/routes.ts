import type { LatLng, MatrixCell, RouteResult, RouteLeg, TravelMode } from '@/lib/types';
import { USAGE_ATTRIBUTION_ID } from '@/lib/config';
import type { WorldRoute, WorldRouteLeg } from '@/world/contracts';
import type { RoutesProvider } from '@/world/ports';
import { googleEvidence, optionalProviderCall, providerCall } from '@/world/results';
import { lib } from './maps';

const TRAVEL: Record<TravelMode, google.maps.TravelModeString> = {
  WALK: 'WALKING',
  DRIVE: 'DRIVING',
  BICYCLE: 'BICYCLING',
  TRANSIT: 'TRANSIT',
  TWO_WHEELER: 'TWO_WHEELER',
};

type Loc = LatLng | string;

function waypoint(loc: Loc): google.maps.routes.Waypoint | string {
  return typeof loc === 'string' ? loc : { location: loc };
}

function pathOf(pts: google.maps.LatLngAltitude[] | undefined): LatLng[] {
  return (pts ?? []).map((p) => ({ lat: p.lat, lng: p.lng }));
}

export interface RouteOpts {
  travelMode?: TravelMode;
  intermediates?: LatLng[];
  trafficAware?: boolean;
  avoidTolls?: boolean;
  avoidHighways?: boolean;
}

const routesEvidence = () => ({
  ...googleEvidence('routes'),
  limitations: [{ code: 'field-availability', message: 'Unavailable route metrics remain null.' }],
});

/** Normalized provider boundary. Missing route metrics remain null, never zero or NaN. */
export const routesProvider: RoutesProvider = {
  async computeRoute(request, context) {
    return optionalProviderCall(routesEvidence(), context, async () => {
      const { Route } = await lib('routes');
      const mode = request.travelMode ?? 'DRIVE';
      const drivingLike = mode === 'DRIVE' || mode === 'TWO_WHEELER';
      const { routes } = await Route.computeRoutes({
        origin: waypoint(request.origin),
        destination: waypoint(request.destination),
        intermediates: request.intermediates?.map((w) => ({ location: w })),
        travelMode: TRAVEL[mode],
        routingPreference: drivingLike && request.trafficAware !== false ? 'TRAFFIC_AWARE' : undefined,
        polylineQuality: 'HIGH_QUALITY',
        fields: ['durationMillis', 'distanceMeters', 'path', 'legs'],
        internalUsageAttributionIds: [USAGE_ATTRIBUTION_ID],
        ...(request.avoidTolls || request.avoidHighways
          ? { routeModifiers: { avoidTolls: !!request.avoidTolls, avoidHighways: !!request.avoidHighways } }
          : {}),
      });
      const route = routes?.[0];
      if (!route) return undefined;
      const legs: WorldRouteLeg[] = (route.legs ?? []).map((leg) => {
        const path = pathOf(leg.path);
        return {
          path,
          distanceMeters: leg.distanceMeters ?? null,
          durationSeconds: leg.durationMillis == null ? null : leg.durationMillis / 1000,
          start: path[0] ?? null,
          end: path[path.length - 1] ?? null,
        };
      });
      const path = pathOf(route.path);
      return {
        path: path.length ? path : legs.flatMap((leg) => leg.path),
        distanceMeters: route.distanceMeters ?? null,
        durationSeconds: route.durationMillis == null ? null : route.durationMillis / 1000,
        ...(legs.length ? { legs } : {}),
      } satisfies WorldRoute;
    });
  },

  async computeMatrix(request, context) {
    const outcome = await providerCall(routesEvidence(), context, async () => {
      const { RouteMatrix } = await lib('routes');
      const travelMode = request.travelMode ?? 'DRIVE';
      const drivingLike = travelMode === 'DRIVE' || travelMode === 'TWO_WHEELER';
      const { matrix } = await RouteMatrix.computeRouteMatrix({
        origins: request.origins.map((origin) => ({ location: origin })),
        destinations: request.destinations.map((destination) => ({ location: destination })),
        travelMode: TRAVEL[travelMode],
        routingPreference: drivingLike ? 'TRAFFIC_AWARE' : undefined,
        fields: ['durationMillis', 'distanceMeters', 'condition'],
        internalUsageAttributionIds: [USAGE_ATTRIBUTION_ID],
      });
      return matrix.rows.flatMap((row, originIndex) => row.items.map((item, destinationIndex) => ({
        originIndex,
        destinationIndex,
        distanceMeters: item.distanceMeters ?? null,
        durationSeconds: item.durationMillis == null ? null : item.durationMillis / 1000,
        status: item.condition === 'ROUTE_EXISTS' ? 'OK' as const : 'FAILED' as const,
      })));
    }, (cells) => cells.length === 0);
    if (outcome.status === 'success' && outcome.value.some((cell) => cell.status === 'FAILED')) {
      return {
        ...outcome,
        status: 'partial',
        error: {
          code: 'unavailable',
          message: 'One or more route matrix cells have no route.',
          retryable: false,
        },
      };
    }
    return outcome;
  },
};

export async function computeRoute(
  origin: Loc,
  destination: Loc,
  opts: RouteOpts = {},
): Promise<RouteResult | null> {
  const normalized = await routesProvider.computeRoute({ origin, destination, ...opts });
  if (normalized.status === 'empty') return null;
  if (normalized.status === 'failure' || normalized.status === 'cancelled') {
    throw new Error(normalized.error.message);
  }
  const route = normalized.value;
  const legs: RouteLeg[] = (route.legs ?? []).map((leg) => ({
    path: leg.path,
    distanceMeters: leg.distanceMeters ?? 0,
    durationSeconds: leg.durationSeconds ?? 0,
    start: leg.start ?? { lat: 0, lng: 0 },
    end: leg.end ?? { lat: 0, lng: 0 },
  }));
  return {
    path: route.path,
    distanceMeters: route.distanceMeters ?? 0,
    durationSeconds: route.durationSeconds ?? 0,
    legs: legs.length ? legs : undefined,
  };
}

/** Live traffic-aware travel-time/distance matrix (≤625 elements). */
export async function computeMatrix(
  origins: LatLng[],
  destinations: LatLng[],
  travelMode: TravelMode = 'DRIVE',
): Promise<MatrixCell[]> {
  const result = await routesProvider.computeMatrix({ origins, destinations, travelMode });
  if (result.status === 'empty') return [];
  if (result.status === 'failure' || result.status === 'cancelled') {
    throw new Error(result.error.message);
  }
  const cells = result.value;
  return cells.map((cell) => ({
    ...cell,
    distanceMeters: cell.distanceMeters ?? Number.NaN,
    durationSeconds: cell.durationSeconds ?? Number.NaN,
  }));
}
