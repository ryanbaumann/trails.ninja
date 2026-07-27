import type { AutocompleteHit, LatLng, PlaceLite } from '@/lib/types';
import { USAGE_ATTRIBUTION_ID } from '@/lib/config';
import type { WorldPlace } from '@/world/contracts';
import type { PlacesProvider } from '@/world/ports';
import { googleEvidence, providerCall } from '@/world/results';
import { lib } from './maps';

const SEARCH_FIELDS = [
  'id',
  'displayName',
  'location',
  'formattedAddress',
  'rating',
  'userRatingCount',
  'priceLevel',
  'types',
  'primaryType',
  'businessStatus',
  'photos',
];

const DETAIL_FIELDS = [
  ...SEARCH_FIELDS,
  'regularOpeningHours',
  'editorialSummary',
  'googleMapsURI',
  'websiteURI',
  'nationalPhoneNumber',
];

const PRICE_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

function toWorldPlace(p: google.maps.places.Place): WorldPlace {
  const loc = p.location;
  const price = p.priceLevel != null ? PRICE_MAP[String(p.priceLevel)] : undefined;
  return {
    id: p.id,
    name: p.displayName ?? 'Unnamed place',
    location: loc ? { lat: loc.lat(), lng: loc.lng() } : null,
    formattedAddress: p.formattedAddress ?? undefined,
    rating: p.rating ?? undefined,
    userRatingCount: p.userRatingCount ?? undefined,
    priceLevel: price,
    primaryType: p.primaryType ?? undefined,
    types: p.types ?? undefined,
    regularOpeningHours: p.regularOpeningHours?.weekdayDescriptions ?? undefined,
    photoUri: p.photos?.[0]?.getURI({ maxWidth: 800, maxHeight: 600 }) ?? undefined,
    editorialSummary: p.editorialSummary ?? undefined,
    websiteUri: p.websiteURI ?? undefined,
    googleMapsUri: p.googleMapsURI ?? undefined,
    phone: p.nationalPhoneNumber ?? undefined,
  };
}

function mappedPlaces(places: google.maps.places.Place[]): WorldPlace[] {
  return places.map(toWorldPlace);
}

function toLegacyPlace(place: WorldPlace): PlaceLite {
  return { ...place, location: place.location ?? { lat: 0, lng: 0 } };
}

export interface TextSearchOpts {
  near?: LatLng;
  radius?: number;
  maxResults?: number;
  openNow?: boolean;
  minRating?: number;
  includedType?: string;
}

const placesEvidence = () => ({
  ...googleEvidence('places'),
  limitations: [{ code: 'location-required', message: 'A result location may be null when coordinates are unavailable.' }],
});

/** Normalized provider boundary. Callers that can handle typed outcomes should prefer this export. */
export const placesProvider: PlacesProvider = {
  async searchText(request, context) {
    return providerCall(placesEvidence(), context, async () => {
      const { Place } = await lib('places');
      const req: google.maps.places.SearchByTextRequest = {
        textQuery: request.query,
        fields: SEARCH_FIELDS,
        maxResultCount: Math.min(request.maxResults ?? 10, 20),
        isOpenNow: request.openNow,
        minRating: request.minRating,
        includedType: request.includedType,
        internalUsageAttributionIds: [USAGE_ATTRIBUTION_ID],
      };
      if (request.near) {
        req.locationBias = { center: request.near, radius: request.radius ?? 8000 };
      }
      const { places } = await Place.searchByText(req);
      return mappedPlaces(places);
    }, (places) => places.length === 0);
  },

  async searchNearby(request, context) {
    return providerCall(placesEvidence(), context, async () => {
      const { Place, SearchNearbyRankPreference } = await lib('places');
      const { places } = await Place.searchNearby({
        fields: SEARCH_FIELDS,
        locationRestriction: { center: request.center, radius: request.radius ?? 1200 },
        includedTypes: request.includedTypes,
        maxResultCount: Math.min(request.maxResults ?? 8, 20),
        rankPreference:
          request.rank === 'POPULARITY'
            ? SearchNearbyRankPreference.POPULARITY
            : SearchNearbyRankPreference.DISTANCE,
        internalUsageAttributionIds: [USAGE_ATTRIBUTION_ID],
      });
      return mappedPlaces(places);
    }, (places) => places.length === 0);
  },

  async details(placeId, context) {
    return providerCall(placesEvidence(), context, async () => {
      const { Place } = await lib('places');
      const place = new Place({ id: placeId });
      await place.fetchFields({ fields: DETAIL_FIELDS });
      const worldPlace = toWorldPlace(place);
      try {
        worldPlace.openNow = await place.isOpen();
      } catch {
        // Hours are optional and their absence does not invalidate the place fact.
      }
      return worldPlace;
    });
  },
};

export async function searchText(query: string, opts: TextSearchOpts = {}): Promise<PlaceLite[]> {
  const result = await placesProvider.searchText({ query, ...opts });
  if (result.status === 'success' || result.status === 'partial') return result.value.map(toLegacyPlace);
  if (result.status === 'empty') return [];
  throw new Error(result.error.message);
}

export interface NearbyOpts {
  radius?: number;
  maxResults?: number;
  rank?: 'DISTANCE' | 'POPULARITY';
  includedTypes?: string[];
}

export async function searchNearby(center: LatLng, opts: NearbyOpts = {}): Promise<PlaceLite[]> {
  const result = await placesProvider.searchNearby({ center, ...opts });
  if (result.status === 'success' || result.status === 'partial') return result.value.map(toLegacyPlace);
  if (result.status === 'empty') return [];
  throw new Error(result.error.message);
}

export async function placeDetails(placeId: string): Promise<PlaceLite> {
  const result = await placesProvider.details(placeId);
  if (result.status === 'success' || result.status === 'partial') return toLegacyPlace(result.value);
  if (result.status === 'empty') throw new Error('Place not found.');
  throw new Error(result.error.message);
}

/** Autocomplete with session token (billing efficiency, CF-compliant). */
export async function autocomplete(
  input: string,
  sessionToken: google.maps.places.AutocompleteSessionToken,
  bias?: LatLng,
): Promise<AutocompleteHit[]> {
  if (!input.trim()) return [];
  const { AutocompleteSuggestion } = await lib('places');
  const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
    input,
    sessionToken,
    ...(bias ? { locationBias: { center: bias, radius: 30000 } } : {}),
  });
  const hits: AutocompleteHit[] = [];
  for (const s of suggestions) {
    const pred = s.placePrediction;
    if (!pred?.placeId) continue;
    hits.push({
      placeId: pred.placeId,
      primaryText: pred.mainText?.text ?? pred.text?.text ?? '',
      secondaryText: pred.secondaryText?.text ?? '',
    });
  }
  return hits;
}

export async function newSessionToken(): Promise<google.maps.places.AutocompleteSessionToken> {
  const { AutocompleteSessionToken } = await lib('places');
  return new AutocompleteSessionToken();
}
