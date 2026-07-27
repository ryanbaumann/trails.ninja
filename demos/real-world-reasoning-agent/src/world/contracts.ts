/**
 * Provider-neutral, JSON-safe contracts for facts about the real world.
 * Keep this module free of SDK, framework, and browser types.
 */

export interface WorldPoint {
  lat: number;
  lng: number;
}

export type WorldProduct =
  | 'places'
  | 'routes'
  | 'air-quality'
  | 'weather'
  | 'pollen'
  | 'solar'
  | 'environment'
  | 'fixture';

export interface WorldAttribution {
  label: string;
  uri?: string;
}

export interface WorldLimitation {
  code: string;
  message: string;
}

export interface WorldFreshness {
  kind: 'live' | 'forecast' | 'static' | 'fixture';
  retrievedAt: string;
  observedAt?: string;
  expiresAt?: string;
}

export interface WorldEvidence {
  providerId: string;
  product: WorldProduct;
  attributions: readonly [WorldAttribution, ...WorldAttribution[]];
  freshness: WorldFreshness;
  limitations: readonly WorldLimitation[];
  /** Direct Maps content is default-deny; grounded content must keep its sources adjacent. */
  modelContext: 'denied' | 'grounded-only' | 'allowed';
  modelImprovement: 'denied';
  credentialMode: 'browser-sdk' | 'server-proxy' | 'fixture';
  regionalTerms: 'provider-location-dependent' | 'not-applicable';
  launchStage: 'product-specific' | 'fixture';
  retention: {
    policy: 'provider-product-terms' | 'synthetic-only';
    reference: string;
  };
  components?: readonly WorldEvidence[];
}

export type ProviderErrorCode =
  | 'auth'
  | 'rate-limit'
  | 'timeout'
  | 'invalid-request'
  | 'unavailable'
  | 'cancelled'
  | 'unknown';

export interface ProviderError {
  code: ProviderErrorCode;
  message: string;
  retryable: boolean;
  providerCode?: string;
}

interface ProviderOutcomeBase {
  evidence: WorldEvidence;
}

export type ProviderResult<T> =
  | (ProviderOutcomeBase & { status: 'success'; value: T })
  | (ProviderOutcomeBase & { status: 'partial'; value: T; error: ProviderError })
  | (ProviderOutcomeBase & { status: 'empty' })
  | (ProviderOutcomeBase & { status: 'failure'; error: ProviderError })
  | (ProviderOutcomeBase & { status: 'cancelled'; error: ProviderError });

export interface WorldPlace {
  id: string;
  name: string;
  /** Null when the provider returned the place but no usable coordinate. */
  location: WorldPoint | null;
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: number;
  primaryType?: string;
  types?: string[];
  openNow?: boolean;
  regularOpeningHours?: string[];
  photoUri?: string;
  editorialSummary?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  phone?: string;
}

export interface WorldRouteLeg {
  path: WorldPoint[];
  distanceMeters: number | null;
  durationSeconds: number | null;
  start: WorldPoint | null;
  end: WorldPoint | null;
}

export interface WorldRoute {
  path: WorldPoint[];
  distanceMeters: number | null;
  durationSeconds: number | null;
  legs?: WorldRouteLeg[];
}

export interface WorldMatrixCell {
  originIndex: number;
  destinationIndex: number;
  distanceMeters: number | null;
  durationSeconds: number | null;
  status: 'OK' | 'FAILED';
}

export interface WorldConditions {
  air?: {
    aqi: number | null;
    category: string;
    dominantPollutant?: string;
    color: string;
  };
  weather?: {
    tempC: number;
    feelsLikeC?: number;
    condition: string;
    humidity?: number;
    windKph?: number;
    iconType?: string;
    isDay?: boolean;
  };
  pollen?: {
    date: string;
    grass?: { category: string; index: number };
    tree?: { category: string; index: number };
    weed?: { category: string; index: number };
  };
  solar?: {
    maxPanels: number | null;
    maxAreaMeters2: number | null;
    sunshineHoursPerYear: number | null;
    yearlyEnergyKwh: number | null;
    carbonOffsetKgPerMwh?: number;
    boundingBox?: { sw: WorldPoint; ne: WorldPoint };
  };
}
