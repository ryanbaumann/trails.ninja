import type {
  ExplorerAttribution,
  GroundedPlace,
  GroundingLiteProvider,
  GroundingResult,
} from '@/explorer/contracts';

type RecordLike = Record<string, unknown>;

function record(value: unknown): RecordLike | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordLike : undefined;
}

function finite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function field(item: RecordLike | undefined, camel: string, snake: string): unknown {
  return item?.[camel] ?? item?.[snake];
}

function attribution(value: unknown): ExplorerAttribution | undefined {
  const item = record(value);
  return typeof item?.title === 'string' && item.title.length > 0
    && typeof item.url === 'string' && item.url.startsWith('https://')
    ? { title: item.title, url: item.url }
    : undefined;
}

function labelFromSummary(summary: string | undefined, index: number): string | undefined {
  if (!summary) return undefined;
  const citation = summary.indexOf(`[${index}]`);
  if (citation < 0) return undefined;
  const previousCitationEnd = summary.lastIndexOf(']', citation - 1);
  const prefix = summary.slice(Math.max(previousCitationEnd + 1, citation - 240), citation);
  const bold = [...prefix.matchAll(/\*\*([^*\n]{1,120})\*\*/gu)].at(-1)?.[1]?.trim();
  return bold || undefined;
}

export function parseMcpEnvelope(raw: string): unknown {
  const candidates = raw
    .split('\n')
    .map((line) => line.startsWith('data:') ? line.slice(5).trim() : line.trim())
    .filter((line) => line.startsWith('{'));
  const envelope = JSON.parse(candidates.at(-1) ?? raw) as RecordLike;
  if (envelope.error) throw new Error('Maps Grounding Lite returned an MCP error.');
  const result = record(envelope.result);
  // The upstream MCP endpoint may return HTTP 200 with result.isError=true
  // (e.g. API key referer restrictions). Surface the upstream message so the
  // failure path can provide a diagnosable error rather than a JSON parse crash.
  if (result?.isError === true) {
    const content = Array.isArray(result.content) ? result.content : [];
    const errText = content.map(record).find((item) => item?.type === 'text' && typeof item.text === 'string')?.text;
    throw new Error(typeof errText === 'string' ? errText : 'Maps Grounding Lite returned an error.');
  }
  const structured = result?.structuredContent;
  if (structured) return structured;
  const content = Array.isArray(result?.content) ? result.content : [];
  const text = content.map(record).find((item) => item?.type === 'text' && typeof item.text === 'string')?.text;
  return typeof text === 'string' ? JSON.parse(text) : result;
}

async function callTool(name: string, args: RecordLike, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch('/api/real-world-reasoning-agent/gmp/grounding-lite/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
    signal,
  });
  if (!response.ok) throw new Error(`Maps Grounding Lite request failed (${response.status}).`);
  return parseMcpEnvelope(await response.text());
}

function failure(cause: unknown): GroundingResult<never> {
  if (cause instanceof DOMException && cause.name === 'AbortError') return { status: 'cancelled' };
  return { status: 'failure', message: 'Grounded map evidence is unavailable.', retryable: true };
}

export const groundingLiteProvider: GroundingLiteProvider = {
  async searchPlaces(input, signal) {
    try {
      const payload = record(await callTool('search_places', {
        text_query: input.query,
        location_bias: { circle: { center: { latitude: input.near.lat, longitude: input.near.lng }, radius_meters: 8000 } },
        language_code: 'en',
        ...(input.regionCode ? { region_code: input.regionCode } : {}),
      }, signal));
      const rawPlaces = Array.isArray(payload?.places) ? payload.places : [];
      const summary = typeof payload?.summary === 'string' && payload.summary.trim() ? payload.summary : undefined;
      const places: GroundedPlace[] = rawPlaces.flatMap((value, index) => {
        const item = record(value);
        const location = record(item?.location);
        const links = record(field(item, 'googleMapsLinks', 'google_maps_links'));
        const source = attribution(item?.attribution);
        const lat = finite(location?.latitude);
        const lng = finite(location?.longitude);
        if (typeof item?.id !== 'string' || lat === undefined || lng === undefined
          || typeof field(links, 'placeUrl', 'place_url') !== 'string'
          || !String(field(links, 'placeUrl', 'place_url')).startsWith('https://') || !source) return [];
        return [{
          id: item.id,
          label: labelFromSummary(summary, index) ?? `Grounded candidate ${index + 1}`,
          location: { lat, lng },
          placeUrl: String(field(links, 'placeUrl', 'place_url')),
          attribution: source,
        }];
      });
      return places.length ? { status: 'success', value: places, ...(summary ? { summary } : {}) } : { status: 'empty' };
    } catch (cause) {
      return failure(cause);
    }
  },

  async computeRoute(input, signal) {
    try {
      const payload = record(await callTool('compute_routes', {
        origin: { lat_lng: { latitude: input.origin.lat, longitude: input.origin.lng } },
        destination: { place_id: input.destinationPlaceId },
        travel_mode: input.travelMode,
      }, signal));
      const item = record(Array.isArray(payload?.routes) ? payload.routes[0] : undefined);
      const source = attribution(item?.attribution);
      const distanceMeters = finite(field(item, 'distanceMeters', 'distance_meters'));
      const duration = typeof item?.duration === 'string' ? Number.parseFloat(item.duration) : Number.NaN;
      return source && distanceMeters !== undefined && Number.isFinite(duration)
        ? { status: 'success', value: { distanceMeters, durationSeconds: duration, attribution: source } }
        : { status: 'empty' };
    } catch (cause) {
      return failure(cause);
    }
  },

  async lookupWeather(input, signal) {
    try {
      const payload = record(await callTool('lookup_weather', {
        location: { place_id: input.placeId },
        units_system: input.units,
      }, signal));
      const source = attribution(payload?.attribution);
      const condition = record(field(payload, 'weatherCondition', 'weather_condition'));
      const temperature = record(payload?.temperature);
      const precipitation = record(payload?.precipitation);
      const probability = record(precipitation?.probability);
      const degrees = finite(temperature?.degrees);
      const conditionText = record(condition?.description)?.text;
      const unit = temperature?.unit === 'FAHRENHEIT' ? 'FAHRENHEIT' : 'CELSIUS';
      if (!source || degrees === undefined || typeof conditionText !== 'string') return { status: 'empty' };
      return {
        status: 'success',
        value: {
          condition: conditionText,
          temperature: { degrees, unit },
          ...(finite(probability?.percent) !== undefined
            ? { precipitationProbability: finite(probability?.percent) }
            : {}),
          attribution: source,
        },
      };
    } catch (cause) {
      return failure(cause);
    }
  },
};
