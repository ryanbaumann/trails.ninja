import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mapsGroundingProvider } from './mapsGrounding';
import * as clientModule from '@/ai/client';
import { routesProvider } from './routes';
import * as envModule from './env';

const mockGenerateContent = vi.fn();

beforeEach(() => {
  mockGenerateContent.mockReset();
  vi.spyOn(clientModule, 'genai').mockReturnValue({
    models: {
      generateContent: mockGenerateContent,
    },
  } as unknown as ReturnType<typeof clientModule.genai>);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Gemini Maps Grounding provider', () => {
  it('extracts grounded places, coordinates, place URL, and Google Maps attribution from grounding chunks', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: 'Here are coffee shops near the location:\n1. Blue Bottle Coffee (37.797, -122.395)\n2. Sightglass Coffee (37.792, -122.401)',
      candidates: [
        {
          groundingMetadata: {
            groundingChunks: [
              {
                maps: {
                  title: 'Blue Bottle Coffee',
                  uri: 'https://maps.google.com/?cid=11111',
                  placeId: 'places/ChIJ11111',
                },
              },
              {
                maps: {
                  title: 'Sightglass Coffee',
                  uri: 'https://maps.google.com/?cid=22222',
                  placeId: 'places/ChIJ22222',
                },
              },
            ],
          },
        },
      ],
    });

    const result = await mapsGroundingProvider.searchPlaces({
      query: 'coffee',
      near: { lat: 37.795, lng: -122.394 },
    });

    expect(result).toEqual({
      status: 'success',
      summary: 'Here are coffee shops near the location:\n1. Blue Bottle Coffee (37.797, -122.395)\n2. Sightglass Coffee (37.792, -122.401)',
      value: [
        {
          id: 'places/ChIJ11111',
          label: 'Blue Bottle Coffee',
          location: { lat: 37.797, lng: -122.395 },
          placeUrl: 'https://maps.google.com/?cid=11111',
          attribution: {
            title: 'Blue Bottle Coffee',
            url: 'https://maps.google.com/?cid=11111',
          },
        },
        {
          id: 'places/ChIJ22222',
          label: 'Sightglass Coffee',
          location: { lat: 37.792, lng: -122.401 },
          placeUrl: 'https://maps.google.com/?cid=22222',
          attribution: {
            title: 'Sightglass Coffee',
            url: 'https://maps.google.com/?cid=22222',
          },
        },
      ],
    });

    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: {
              latLng: { latitude: 37.795, longitude: -122.394 },
            },
          },
        }),
      }),
    );
  });

  it('filters out invalid or non-https grounding chunks and returns empty if no valid places remain', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: 'No matching places found.',
      candidates: [
        {
          groundingMetadata: {
            groundingChunks: [
              {
                maps: {
                  title: 'Insecure URL Place',
                  uri: 'http://insecure.example.com',
                },
              },
              {
                maps: {
                  title: '',
                  uri: 'https://maps.google.com/?cid=333',
                },
              },
            ],
          },
        },
      ],
    });

    const result = await mapsGroundingProvider.searchPlaces({
      query: 'obscure place',
      near: { lat: 0, lng: 0 },
    });

    expect(result).toEqual({ status: 'empty' });
  });

  it('handles cancellation and abort signals gracefully', async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await mapsGroundingProvider.searchPlaces(
      { query: 'coffee', near: { lat: 0, lng: 0 } },
      controller.signal,
    );

    expect(result).toEqual({ status: 'cancelled' });
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('handles upstream API failures with retryable failure status', async () => {
    mockGenerateContent.mockRejectedValueOnce(new Error('Network error'));

    const result = await mapsGroundingProvider.searchPlaces({
      query: 'coffee',
      near: { lat: 0, lng: 0 },
    });

    expect(result).toEqual({
      status: 'failure',
      message: 'Grounded map evidence is unavailable.',
      retryable: true,
    });
  });

  it('computes verified routes via routesProvider and formats attribution', async () => {
    const computeRouteSpy = vi.spyOn(routesProvider, 'computeRoute').mockResolvedValueOnce({
      status: 'success',
      value: {
        distanceMeters: 800,
        durationSeconds: 600,
        path: [{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }],
        legs: [],
      },
      evidence: { source: 'Google Maps Routes' } as never,
    });

    const result = await mapsGroundingProvider.computeRoute({
      origin: { lat: 1, lng: 2 },
      destinationPlaceId: 'ChIJ11111',
      destinationLocation: { lat: 3, lng: 4 },
      travelMode: 'WALK',
    });

    expect(computeRouteSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: 'ChIJ11111',
      }),
      expect.anything(),
    );

    expect(result).toEqual({
      status: 'success',
      value: {
        distanceMeters: 800,
        durationSeconds: 600,
        attribution: {
          title: 'Google Maps Routes',
          url: 'https://maps.google.com',
        },
      },
    });
  });

  it('falls back to destinationLocation when destinationPlaceId is a synthetic id', async () => {
    const computeRouteSpy = vi.spyOn(routesProvider, 'computeRoute').mockResolvedValueOnce({
      status: 'success',
      value: {
        distanceMeters: 500,
        durationSeconds: 300,
        path: [{ lat: 1, lng: 2 }, { lat: 5, lng: 6 }],
        legs: [],
      },
      evidence: { source: 'Google Maps Routes' } as never,
    });

    const result = await mapsGroundingProvider.computeRoute({
      origin: { lat: 1, lng: 2 },
      destinationPlaceId: 'grounded-place-1',
      destinationLocation: { lat: 5, lng: 6 },
      travelMode: 'DRIVE',
    });

    expect(computeRouteSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: { lat: 5, lng: 6 },
      }),
      expect.anything(),
    );

    expect(result).toEqual({
      status: 'success',
      value: {
        distanceMeters: 500,
        durationSeconds: 300,
        attribution: {
          title: 'Google Maps Routes',
          url: 'https://maps.google.com',
        },
      },
    });
  });

  it('looks up weather and converts units correctly', async () => {
    vi.spyOn(envModule, 'weather').mockResolvedValueOnce({
      tempC: 20,
      condition: 'Sunny',
      humidity: 50,
      windKph: 10,
    } as never);

    const result = await mapsGroundingProvider.lookupWeather({
      placeId: 'place-abc',
      units: 'IMPERIAL',
    });

    expect(result).toEqual({
      status: 'success',
      value: {
        condition: 'Sunny',
        temperature: {
          degrees: 68,
          unit: 'FAHRENHEIT',
        },
        precipitationProbability: 25,
        attribution: {
          title: 'Google Maps Weather',
          url: 'https://maps.google.com',
        },
      },
    });
  });
});
