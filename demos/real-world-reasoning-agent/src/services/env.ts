import type {
  AirQuality,
  EnvironmentSnapshot,
  LatLng,
  PollenDay,
  SolarInsight,
  WeatherNow,
} from '@/lib/types';
import { USAGE_ATTRIBUTION_ID } from '@/lib/config';
import type { ProviderError, WorldConditions } from '@/world/contracts';
import type { ConditionsProvider } from '@/world/ports';
import { classifyProviderError, googleEvidence, toJsonSafe, unwrapProviderResult } from '@/world/results';

/**
 * The four Environment REST APIs are CORS-blocked from the browser (CF1), so
 * every call here goes through the /gmp proxy. Each fetch degrades to undefined
 * on failure — dossiers render tile-by-tile and never block on a dead API.
 */

function rgbToHex(c?: { red?: number; green?: number; blue?: number }): string {
  if (!c) return '#8a93a6';
  const to = (v = 0) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${to(c.red)}${to(c.green)}${to(c.blue)}`;
}

async function checkedJson(res: Response) {
  if (!res.ok) throw { status: res.status };
  return res.json();
}

function finite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

type WorldAirQuality = NonNullable<WorldConditions['air']>;
type WorldSolarInsight = NonNullable<WorldConditions['solar']>;

async function airQualityRaw(loc: LatLng, signal?: AbortSignal): Promise<WorldAirQuality | undefined> {
  const res = await fetch('/api/real-world-reasoning-agent/gmp/airquality/v1/currentConditions:lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: { latitude: loc.lat, longitude: loc.lng },
      extraComputations: ['DOMINANT_POLLUTANT_CONCENTRATION'],
      languageCode: 'en',
    }),
    signal,
  });
  const data = await checkedJson(res);
  const idx = data.indexes?.[0];
  if (!idx) return undefined;
  return {
    aqi: finite(idx.aqi) ?? null,
    category: typeof idx.category === 'string' ? idx.category : 'Unknown',
    dominantPollutant: idx.dominantPollutant,
    color: rgbToHex(idx.color),
  };
}

export async function airQuality(loc: LatLng): Promise<AirQuality | undefined> {
  const air = await airQualityRaw(loc).catch(() => undefined);
  return air ? { ...air, aqi: air.aqi ?? 0 } : undefined;
}

async function weatherRaw(loc: LatLng, signal?: AbortSignal): Promise<WeatherNow | undefined> {
  const res = await fetch(
    `/api/real-world-reasoning-agent/gmp/weather/v1/currentConditions:lookup?location.latitude=${loc.lat}&location.longitude=${loc.lng}`,
    { headers: { 'X-Goog-Maps-Solution-ID': USAGE_ATTRIBUTION_ID }, signal },
  );
  const d = await checkedJson(res);
  const tempC = finite(d.temperature?.degrees);
  if (d.error || tempC === undefined) return undefined;
  return {
    tempC,
    feelsLikeC: finite(d.feelsLikeTemperature?.degrees),
    condition: d.weatherCondition?.description?.text ?? 'Unknown',
    humidity: finite(d.relativeHumidity),
    windKph: finite(d.wind?.speed?.value),
    iconType: d.weatherCondition?.type,
    isDay: d.isDaytime,
  };
}

export async function weather(loc: LatLng): Promise<WeatherNow | undefined> {
  return weatherRaw(loc).catch(() => undefined);
}

const partialConditionsError: ProviderError = {
  code: 'unavailable',
  message: 'One or more environment products did not return data.',
  retryable: true,
};

/** Normalized boundary for the environment fan-out, including partial-data outcomes. */
export const conditionsProvider: ConditionsProvider = {
  async snapshot(loc, context) {
    const evidence = {
      ...googleEvidence('environment'),
      components: [
        googleEvidence('air-quality'),
        googleEvidence('weather'),
        googleEvidence('pollen'),
        googleEvidence('solar'),
      ],
      limitations: [{
        code: 'product-coverage',
        message: 'Coverage and freshness vary by environment product and region.',
      }],
    };
    if (context?.cancellation?.aborted) {
      return {
        status: 'cancelled',
        evidence,
        error: { code: 'cancelled', message: 'Provider request was cancelled.', retryable: false },
      };
    }
    const controller = new AbortController();
    const unsubscribe = context?.cancellation?.subscribe?.(() => controller.abort());
    const products = await Promise.allSettled([
      airQualityRaw(loc, controller.signal),
      weatherRaw(loc, controller.signal),
      pollenRaw(loc, controller.signal),
      solarRaw(loc, controller.signal),
    ]);
    unsubscribe?.();
    if (context?.cancellation?.aborted) {
      return {
        status: 'cancelled',
        evidence,
        error: { code: 'cancelled', message: 'Provider request was cancelled.', retryable: false },
      };
    }
    const [airResult, weatherResult, pollenResult, solarResult] = products;
    const air = airResult.status === 'fulfilled' ? airResult.value : undefined;
    const wx = weatherResult.status === 'fulfilled' ? weatherResult.value : undefined;
    const pol = pollenResult.status === 'fulfilled' ? pollenResult.value : undefined;
    const sol = solarResult.status === 'fulfilled' ? solarResult.value : undefined;
    const value: WorldConditions = toJsonSafe({ air, weather: wx, pollen: pol, solar: sol });
    const available = [air, wx, pol, sol].filter((item) => item !== undefined).length;
    const rejected = products.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    if (available === 0 && rejected) {
      return { status: 'failure', evidence, error: classifyProviderError(rejected.reason) };
    }
    if (available === 0) return { status: 'empty', evidence };
    if (available < 4) {
      return {
        status: 'partial',
        value,
        evidence,
        error: rejected ? classifyProviderError(rejected.reason) : partialConditionsError,
      };
    }
    return { status: 'success', value, evidence };
  },
};

async function pollenRaw(loc: LatLng, signal?: AbortSignal): Promise<PollenDay | undefined> {
  const res = await fetch(
    `/api/real-world-reasoning-agent/gmp/pollen/v1/forecast:lookup?location.latitude=${loc.lat}&location.longitude=${loc.lng}&days=1`,
    { signal },
  );
  const d = await checkedJson(res);
  const day = d.dailyInfo?.[0];
  if (!day) return undefined;
  const byCode: Record<string, { category: string; index: number }> = {};
  for (const t of day.pollenTypeInfo ?? []) {
    const index = finite(t.indexInfo?.value);
    if (index !== undefined && typeof t.indexInfo?.category === 'string' && typeof t.code === 'string') {
      byCode[t.code] = { category: t.indexInfo.category, index };
    }
  }
  const date = day.date ? `${day.date.year}-${day.date.month}-${day.date.day}` : '';
  return { date, grass: byCode.GRASS, tree: byCode.TREE, weed: byCode.WEED };
}

export async function pollen(loc: LatLng): Promise<PollenDay | undefined> {
  return pollenRaw(loc).catch(() => undefined);
}

async function solarRaw(loc: LatLng, signal?: AbortSignal): Promise<WorldSolarInsight | undefined> {
  const res = await fetch(
    `/api/real-world-reasoning-agent/gmp/solar/v1/buildingInsights:findClosest?location.latitude=${loc.lat}&location.longitude=${loc.lng}&requiredQuality=LOW`,
    { signal },
  );
  const d = await checkedJson(res);
  const sp = d.solarPotential;
  if (!sp) return undefined;
  const configs = sp.solarPanelConfigs ?? [];
  const best = configs[configs.length - 1];

  const boundingBox = d.boundingBox?.sw && d.boundingBox?.ne ? {
    sw: { lat: d.boundingBox.sw.latitude, lng: d.boundingBox.sw.longitude },
    ne: { lat: d.boundingBox.ne.latitude, lng: d.boundingBox.ne.longitude },
  } : undefined;

  return {
    maxPanels: finite(sp.maxArrayPanelsCount) ?? null,
    maxAreaMeters2: finite(sp.maxArrayAreaMeters2) ?? null,
    sunshineHoursPerYear: finite(sp.maxSunshineHoursPerYear) ?? null,
    yearlyEnergyKwh: finite(best?.yearlyEnergyDcKwh) ?? null,
    carbonOffsetKgPerMwh: finite(sp.carbonOffsetFactorKgPerMwh),
    boundingBox,
  };
}

export async function solar(loc: LatLng): Promise<SolarInsight | undefined> {
  const solar = await solarRaw(loc).catch(() => undefined);
  return solar ? {
    ...solar,
    maxPanels: solar.maxPanels ?? 0,
    maxAreaMeters2: solar.maxAreaMeters2 ?? 0,
    sunshineHoursPerYear: solar.sunshineHoursPerYear ?? 0,
    yearlyEnergyKwh: solar.yearlyEnergyKwh ?? 0,
  } : undefined;
}

/** Parallel environment fan-out used by the copilot `get_environment` tool. */
export async function environmentSnapshot(loc: LatLng): Promise<EnvironmentSnapshot> {
  const conditions = unwrapProviderResult(await conditionsProvider.snapshot(loc));
  if (!conditions) return {};
  return {
    ...conditions,
    air: conditions.air ? { ...conditions.air, aqi: conditions.air.aqi ?? 0 } : undefined,
    solar: conditions.solar ? {
      ...conditions.solar,
      maxPanels: conditions.solar.maxPanels ?? 0,
      maxAreaMeters2: conditions.solar.maxAreaMeters2 ?? 0,
      sunshineHoursPerYear: conditions.solar.sunshineHoursPerYear ?? 0,
      yearlyEnergyKwh: conditions.solar.yearlyEnergyKwh ?? 0,
    } : undefined,
  };
}

/** US AQI heatmap raster tiles — loaded directly as <img> (no CORS on tiles). */
export function aqiTileUrl(z: number, x: number, y: number): string {
  return `/api/real-world-reasoning-agent/gmp/airquality/v1/mapTypes/US_AQI/heatmapTiles/${z}/${x}/${y}`;
}

/** Pollen heatmap raster tiles. */
export function pollenTileUrl(z: number, x: number, y: number): string {
  return `/api/real-world-reasoning-agent/gmp/pollen/v1/mapTypes/TREE_UPI/heatmapTiles/${z}/${x}/${y}`;
}
