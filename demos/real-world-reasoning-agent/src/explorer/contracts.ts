import type { HostEffect } from '@/capabilities/effects';
import type { RoutesProvider } from '@/world/ports';

export type ExplorerTravelMode = 'WALK' | 'DRIVE';

export interface ExplorerIntent {
  travelMode: ExplorerTravelMode;
  currentWeatherRequested: boolean;
}

export interface ExplorerAttribution {
  title: string;
  url: string;
}

export interface GroundedPlace {
  id: string;
  label: string;
  location: { lat: number; lng: number };
  placeUrl: string;
  attribution: ExplorerAttribution;
}

export interface GroundedRoute {
  distanceMeters: number;
  durationSeconds: number;
  attribution: ExplorerAttribution;
}

export interface GroundedWeather {
  condition: string;
  temperature: { degrees: number; unit: 'CELSIUS' | 'FAHRENHEIT' };
  precipitationProbability?: number;
  attribution: ExplorerAttribution;
}

export type GroundingResult<T> =
  | { status: 'success'; value: T; summary?: string }
  | { status: 'empty'; attribution?: ExplorerAttribution }
  | { status: 'failure'; message: string; retryable: boolean }
  | { status: 'cancelled' };

export interface MapsGroundingProvider {
  searchPlaces(input: {
    query: string;
    near: { lat: number; lng: number };
    regionCode?: string;
  }, signal?: AbortSignal): Promise<GroundingResult<GroundedPlace[]>>;
  computeRoute(input: {
    origin: { lat: number; lng: number };
    destinationPlaceId: string;
    destinationLocation?: { lat: number; lng: number };
    travelMode: ExplorerTravelMode;
  }, signal?: AbortSignal): Promise<GroundingResult<GroundedRoute>>;
  lookupWeather(input: {
    placeId: string;
    units: 'METRIC' | 'IMPERIAL';
  }, signal?: AbortSignal): Promise<GroundingResult<GroundedWeather>>;
}

export type GroundingLiteProvider = MapsGroundingProvider;

export type ExplorerStage =
  | 'interpreting'
  | 'searching'
  | 'checking-routes'
  | 'checking-weather'
  | 'ready'
  | 'partial'
  | 'empty'
  | 'needs-clarification'
  | 'failed'
  | 'cancelled';

export interface ExplorerCandidate extends GroundedPlace {
  route?: GroundedRoute;
  routeStatus: 'pending' | 'verified' | 'unavailable';
  eligible: boolean;
  rank?: number;
}

export interface ExplorerView {
  schemaVersion: '1';
  surfaceId: string;
  revision: number;
  stage: ExplorerStage;
  narrative: string;
  query: string;
  dataMode: 'sample' | 'live';
  groundedSummary?: string;
  travelMode: ExplorerTravelMode;
  currentWeatherRequested: boolean;
  maxTravelMinutes: number;
  candidates: ExplorerCandidate[];
  winnerId?: string;
  weather?: GroundedWeather;
  limitations: string[];
  capabilityProfile: string[];
  firstMapEffectMs?: number;
}

export interface ExplorerUpdate {
  view: ExplorerView;
  effects: HostEffect[];
}

export interface ExplorerDependencies {
  grounding: MapsGroundingProvider;
  displayRoutes?: RoutesProvider;
  now?: () => number;
}

export interface ExplorerRunInput {
  query: string;
  dataMode?: 'sample' | 'live';
  origin: { lat: number; lng: number };
  regionCode?: string;
  units?: 'METRIC' | 'IMPERIAL';
  travelMode?: ExplorerTravelMode;
  intent?: ExplorerIntent;
  maxTravelMinutes?: number;
  surfaceId?: string;
  signal?: AbortSignal;
}

export interface ExplorerRun {
  view: ExplorerView;
  places: GroundedPlace[];
}
