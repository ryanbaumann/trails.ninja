import type {
  ProviderResult,
  WorldConditions,
  WorldMatrixCell,
  WorldPlace,
  WorldPoint,
  WorldRoute,
} from './contracts';

export interface ProviderCancellation {
  readonly aborted: boolean;
  /** Optional framework-neutral subscription for prompt mid-flight cancellation. */
  subscribe?(listener: () => void): () => void;
}

export interface ProviderCallContext {
  requestId?: string;
  cancellation?: ProviderCancellation;
}

export interface PlaceTextRequest {
  query: string;
  near?: WorldPoint;
  radius?: number;
  maxResults?: number;
  openNow?: boolean;
  minRating?: number;
  includedType?: string;
}

export interface PlaceNearbyRequest {
  center: WorldPoint;
  radius?: number;
  maxResults?: number;
  rank?: 'DISTANCE' | 'POPULARITY';
  includedTypes?: string[];
}

export interface PlacesProvider {
  searchText(request: PlaceTextRequest, context?: ProviderCallContext): Promise<ProviderResult<WorldPlace[]>>;
  searchNearby(request: PlaceNearbyRequest, context?: ProviderCallContext): Promise<ProviderResult<WorldPlace[]>>;
  details(placeId: string, context?: ProviderCallContext): Promise<ProviderResult<WorldPlace>>;
}

export type WorldTravelMode = 'WALK' | 'DRIVE' | 'BICYCLE' | 'TRANSIT' | 'TWO_WHEELER';
export type WorldLocation = WorldPoint | string;

export interface RouteRequest {
  origin: WorldLocation;
  destination: WorldLocation;
  travelMode?: WorldTravelMode;
  intermediates?: WorldPoint[];
  trafficAware?: boolean;
  avoidTolls?: boolean;
  avoidHighways?: boolean;
}

export interface MatrixRequest {
  origins: WorldPoint[];
  destinations: WorldPoint[];
  travelMode?: WorldTravelMode;
}

export interface RoutesProvider {
  computeRoute(request: RouteRequest, context?: ProviderCallContext): Promise<ProviderResult<WorldRoute>>;
  computeMatrix(request: MatrixRequest, context?: ProviderCallContext): Promise<ProviderResult<WorldMatrixCell[]>>;
}

export interface ConditionsProvider {
  snapshot(location: WorldPoint, context?: ProviderCallContext): Promise<ProviderResult<WorldConditions>>;
}
