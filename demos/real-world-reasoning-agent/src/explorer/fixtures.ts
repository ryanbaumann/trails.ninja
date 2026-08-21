import type { MapsGroundingProvider, GroundingResult, GroundedPlace, GroundedRoute, GroundedWeather } from './contracts';

const source = { title: 'Demo fixture', url: '' };

export const SAMPLE_PLACES: GroundedPlace[] = [
  { id: 'synthetic-candidate-a', label: 'Sample café A', location: { lat: 37.797, lng: -122.395 }, placeUrl: source.url, attribution: source },
  { id: 'synthetic-candidate-b', label: 'Sample café B', location: { lat: 37.792, lng: -122.401 }, placeUrl: source.url, attribution: source },
  { id: 'synthetic-candidate-c', label: 'Sample café C', location: { lat: 37.789, lng: -122.407 }, placeUrl: source.url, attribution: source },
];

const WALK: Record<string, number> = { 'synthetic-candidate-a': 9, 'synthetic-candidate-b': 13, 'synthetic-candidate-c': 18 };
const DRIVE: Record<string, number> = { 'synthetic-candidate-a': 8, 'synthetic-candidate-b': 5, 'synthetic-candidate-c': 6 };

export function createExplorerFixture(overrides: {
  places?: GroundingResult<GroundedPlace[]>;
  route?: (placeId: string, mode: 'WALK' | 'DRIVE') => GroundingResult<GroundedRoute>;
  weather?: GroundingResult<GroundedWeather>;
} = {}): MapsGroundingProvider {
  return {
    searchPlaces: async () => overrides.places ?? { status: 'success', value: SAMPLE_PLACES },
    computeRoute: async ({ destinationPlaceId, travelMode }) => overrides.route?.(destinationPlaceId, travelMode) ?? {
      status: 'success',
      value: {
        durationSeconds: (travelMode === 'WALK' ? WALK : DRIVE)[destinationPlaceId] * 60,
        distanceMeters: (travelMode === 'WALK' ? WALK : DRIVE)[destinationPlaceId] * 75,
        attribution: source,
      },
    },
    lookupWeather: async () => overrides.weather ?? {
      status: 'success',
      value: {
        condition: 'Partly cloudy',
        temperature: { degrees: 12, unit: 'CELSIUS' },
        precipitationProbability: 20,
        attribution: source,
      },
    },
  };
}
