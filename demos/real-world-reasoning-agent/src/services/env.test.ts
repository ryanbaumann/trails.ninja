import { afterEach, describe, expect, it, vi } from 'vitest';
import { USAGE_ATTRIBUTION_ID } from '@/lib/config';
import { conditionsProvider } from './env';

const jsonResponse = (body: unknown, status = 200) => Promise.resolve({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
} as Response);

describe('conditionsProvider', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reports partial product coverage and attributes Weather requests', async () => {
    const fetch = vi.fn()
      .mockImplementationOnce(() => jsonResponse({ indexes: [{ aqi: 20, category: 'Good' }] }))
      .mockImplementationOnce(() => jsonResponse({ temperature: { degrees: 18 }, weatherCondition: { description: { text: 'Clear' } } }))
      .mockImplementationOnce(() => jsonResponse({ dailyInfo: [] }))
      .mockImplementationOnce(() => jsonResponse({}));
    vi.stubGlobal('fetch', fetch);

    const outcome = await conditionsProvider.snapshot({ lat: 1, lng: 2 });

    expect(outcome).toMatchObject({
      status: 'partial',
      value: { air: { aqi: 20 }, weather: { tempC: 18 } },
      evidence: { attributions: [{ label: 'Google Maps Platform' }], limitations: [{ code: 'product-coverage' }] },
    });
    expect(fetch.mock.calls[1]).toEqual([
      expect.stringContaining('/api/real-world-reasoning-agent/gmp/weather/'),
      expect.objectContaining({
        headers: { 'X-Goog-Maps-Solution-ID': USAGE_ATTRIBUTION_ID },
        signal: expect.any(AbortSignal),
      }),
    ]);
  });

  it('returns success when all environment products return data', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockImplementationOnce(() => jsonResponse({ indexes: [{ aqi: 20, category: 'Good' }] }))
      .mockImplementationOnce(() => jsonResponse({ temperature: { degrees: 18 }, weatherCondition: { description: { text: 'Clear' } } }))
      .mockImplementationOnce(() => jsonResponse({ dailyInfo: [{ date: { year: 2026, month: 7, day: 13 } }] }))
      .mockImplementationOnce(() => jsonResponse({ solarPotential: { solarPanelConfigs: [] } })));
    await expect(conditionsProvider.snapshot({ lat: 1, lng: 2 })).resolves.toMatchObject({ status: 'success' });
  });

  it('returns empty when products respond successfully without coverage', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => jsonResponse({})));
    await expect(conditionsProvider.snapshot({ lat: 1, lng: 2 })).resolves.toMatchObject({ status: 'empty' });
  });

  it('does not emit malformed required Weather values', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockImplementationOnce(() => jsonResponse({ indexes: [{ aqi: 20, category: 'Good' }] }))
      .mockImplementationOnce(() => jsonResponse({ temperature: { degrees: 'warm' } }))
      .mockImplementationOnce(() => jsonResponse({ dailyInfo: [{ date: { year: 2026, month: 7, day: 13 } }] }))
      .mockImplementationOnce(() => jsonResponse({ solarPotential: { solarPanelConfigs: [] } })));
    const outcome = await conditionsProvider.snapshot({ lat: 1, lng: 2 });
    expect(outcome).toMatchObject({ status: 'partial' });
    if (outcome.status === 'partial') expect(outcome.value.weather).toBeUndefined();
  });

  it('represents missing AQI and Solar metrics as unknown, never zero', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockImplementationOnce(() => jsonResponse({ indexes: [{ aqi: 'good', category: 'Good' }] }))
      .mockImplementationOnce(() => jsonResponse({ temperature: { degrees: 18 }, weatherCondition: { description: { text: 'Clear' } } }))
      .mockImplementationOnce(() => jsonResponse({ dailyInfo: [{ date: { year: 2026, month: 7, day: 13 } }] }))
      .mockImplementationOnce(() => jsonResponse({ solarPotential: { solarPanelConfigs: [] } })));
    const outcome = await conditionsProvider.snapshot({ lat: 1, lng: 2 });
    expect(outcome).toMatchObject({
      status: 'success',
      value: {
        air: { aqi: null },
        solar: {
          maxPanels: null,
          maxAreaMeters2: null,
          sunshineHoursPerYear: null,
          yearlyEnergyKwh: null,
        },
      },
    });
  });

  it('returns a typed failure when environment requests fail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(conditionsProvider.snapshot({ lat: 1, lng: 2 })).resolves.toMatchObject({
      status: 'failure', error: { code: 'unknown' },
    });
  });

  it.each([
    [403, 'auth'],
    [429, 'rate-limit'],
    [500, 'unavailable'],
    [502, 'unavailable'],
    [503, 'unavailable'],
  ] as const)('classifies HTTP %s as %s', async (status, code) => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => jsonResponse({}, status)));
    await expect(conditionsProvider.snapshot({ lat: 1, lng: 2 })).resolves.toMatchObject({
      status: 'failure', error: { code },
    });
  });

  it('classifies request timeouts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue({ message: 'deadline exceeded' }));
    await expect(conditionsProvider.snapshot({ lat: 1, lng: 2 })).resolves.toMatchObject({
      status: 'failure', error: { code: 'timeout' },
    });
  });

  it('cancels before issuing REST requests', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(conditionsProvider.snapshot(
      { lat: 1, lng: 2 },
      { cancellation: { aborted: true } },
    )).resolves.toMatchObject({ status: 'cancelled' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('aborts in-flight REST requests and returns cancelled promptly', async () => {
    let aborted = false;
    let notify: () => void = () => {};
    const cancellation = {
      get aborted() { return aborted; },
      subscribe(listener: () => void) {
        notify = listener;
        return () => { notify = () => {}; };
      },
    };
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject({ name: 'AbortError' }), { once: true });
      }),
    ));

    const outcome = conditionsProvider.snapshot({ lat: 1, lng: 2 }, { cancellation });
    aborted = true;
    notify();
    await expect(outcome).resolves.toMatchObject({ status: 'cancelled' });
  });
});
