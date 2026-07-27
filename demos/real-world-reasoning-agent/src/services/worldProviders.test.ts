import { beforeEach, describe, expect, it, vi } from 'vitest';
import { USAGE_ATTRIBUTION_ID } from '@/lib/config';

const { loadLibrary } = vi.hoisted(() => ({ loadLibrary: vi.fn() }));
vi.mock('./maps', () => ({ lib: loadLibrary }));

import { placesProvider, searchText } from './places';
import { computeRoute, routesProvider } from './routes';

function sdkPlace(id: string, withLocation = true) {
  return {
    id,
    displayName: `Place ${id}`,
    location: withLocation ? { lat: () => 1, lng: () => 2 } : undefined,
    isOpen: async () => true,
  };
}

describe('Google world providers', () => {
  beforeEach(() => loadLibrary.mockReset());

  it('normalizes Places success without fabricating missing coordinates', async () => {
    const searchByText = vi.fn().mockResolvedValue({ places: [sdkPlace('ok'), sdkPlace('missing', false)] });
    loadLibrary.mockResolvedValue({ Place: { searchByText } });

    const outcome = await placesProvider.searchText({ query: 'coffee' });

    expect(outcome).toMatchObject({
      status: 'success',
      value: [
        { id: 'ok', location: { lat: 1, lng: 2 } },
        { id: 'missing', location: null },
      ],
      evidence: { attributions: [{ label: 'Google Maps Platform' }], limitations: [{ code: 'location-required' }] },
    });
    expect(searchByText).toHaveBeenCalledWith(expect.objectContaining({
      internalUsageAttributionIds: [USAGE_ATTRIBUTION_ID],
    }));
  });

  it('returns typed empty and failure outcomes for Places', async () => {
    loadLibrary.mockResolvedValueOnce({ Place: { searchByText: async () => ({ places: [] }) } });
    await expect(placesProvider.searchText({ query: 'none' })).resolves.toMatchObject({ status: 'empty' });

    loadLibrary.mockRejectedValueOnce({ status: 429 });
    await expect(placesProvider.searchText({ query: 'busy' })).resolves.toMatchObject({
      status: 'failure', error: { code: 'rate-limit', retryable: true },
    });
  });

  it.each([
    [{ status: 403 }, 'auth'],
    [{ message: 'deadline exceeded' }, 'timeout'],
  ] as const)('classifies Places failure %j as %s', async (cause, code) => {
    loadLibrary.mockRejectedValueOnce(cause);
    await expect(placesProvider.searchText({ query: 'coffee' })).resolves.toMatchObject({
      status: 'failure', error: { code },
    });
  });

  it('keeps absent route metrics nullable in normalized route and matrix results', async () => {
    const computeRoutes = vi.fn().mockResolvedValue({ routes: [{
      path: [{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }],
      legs: [{ path: [{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }] }],
    }] });
    const computeRouteMatrix = vi.fn().mockResolvedValue({ matrix: { rows: [{ items: [{ condition: 'NO_ROUTE' }] }] } });
    loadLibrary.mockImplementation(async (name: string) => name === 'routes'
      ? { Route: { computeRoutes }, RouteMatrix: { computeRouteMatrix } }
      : {});

    const route = await routesProvider.computeRoute({ origin: { lat: 1, lng: 2 }, destination: 'place-id' });
    expect(route).toMatchObject({ status: 'success', value: { distanceMeters: null, durationSeconds: null } });
    expect(computeRoutes).toHaveBeenCalledWith(expect.objectContaining({
      internalUsageAttributionIds: [USAGE_ATTRIBUTION_ID],
    }));

    const matrix = await routesProvider.computeMatrix({
      origins: [{ lat: 1, lng: 2 }], destinations: [{ lat: 3, lng: 4 }],
    });
    expect(matrix).toMatchObject({
      status: 'partial',
      value: [{ status: 'FAILED', distanceMeters: null, durationSeconds: null }],
    });
    expect(computeRouteMatrix).toHaveBeenCalledWith(expect.objectContaining({
      internalUsageAttributionIds: [USAGE_ATTRIBUTION_ID],
    }));
  });

  it('distinguishes no route from a provider error', async () => {
    loadLibrary.mockResolvedValueOnce({ Route: { computeRoutes: async () => ({ routes: [] }) } });
    await expect(routesProvider.computeRoute({ origin: 'a', destination: 'b' })).resolves.toMatchObject({ status: 'empty' });

    loadLibrary.mockRejectedValueOnce({ message: 'deadline exceeded' });
    await expect(routesProvider.computeRoute({ origin: 'a', destination: 'b' })).resolves.toMatchObject({
      status: 'failure', error: { code: 'timeout' },
    });
  });

  it.each([
    [{ status: 403 }, 'auth'],
    [{ status: 429 }, 'rate-limit'],
  ] as const)('classifies Routes failure %j as %s', async (cause, code) => {
    loadLibrary.mockRejectedValueOnce(cause);
    await expect(routesProvider.computeRoute({ origin: 'a', destination: 'b' })).resolves.toMatchObject({
      status: 'failure', error: { code },
    });
  });

  it('preserves legacy adapter rejection behavior', async () => {
    loadLibrary.mockRejectedValueOnce({ status: 403 });
    await expect(searchText('private')).rejects.toThrow('Provider request failed: auth.');

    loadLibrary.mockRejectedValueOnce({ message: 'deadline exceeded' });
    await expect(computeRoute('a', 'b')).rejects.toThrow('Provider request failed: timeout.');
  });

  it('cancels before loading an SDK library', async () => {
    const context = { cancellation: { aborted: true } };
    await expect(placesProvider.searchText({ query: 'coffee' }, context)).resolves.toMatchObject({ status: 'cancelled' });
    await expect(routesProvider.computeRoute({ origin: 'a', destination: 'b' }, context)).resolves.toMatchObject({ status: 'cancelled' });
    expect(loadLibrary).not.toHaveBeenCalled();
  });
});
