import { genai } from './client';
import { MODELS } from '@/lib/config';
import type { EnvironmentSnapshot, PlaceLite } from '@/lib/types';

const CONDITIONING_IMAGE_FETCH_TIMEOUT_MS = 8_000;
const CONDITIONED_IMAGE_TIMEOUT_MS = 30_000;
const TEXT_ONLY_IMAGE_TIMEOUT_MS = 45_000;
const UNAVAILABLE_RETRY_DELAY_MS = 800;

/**
 * Why an image call failed, so callers can show an accurate, actionable message
 * instead of blaming the key/quota for what is actually a transient rate limit.
 * - `rate-limited`: HTTP 429 — the /ai proxy's per-IP window or an upstream
 *   per-second quota. The demo burst (Scout + grounding + N ad images) exceeded
 *   AI_RATE_LIMIT; wait and retry, or raise AI_RATE_LIMIT. NOT retried inline
 *   (the proxy limiter is a 10-min window, so an immediate retry just re-429s
 *   and burns another slot).
 * - `unavailable`: HTTP 503 — a genuinely transient upstream blip; retried once.
 * - `other`: model/key/quota/region or an unexpected error — check config.
 */
export type AiFailureKind = 'rate-limited' | 'unavailable' | 'other';

/** Classify a GenAI SDK error (ApiError has a numeric `.status`) into an {@link AiFailureKind}. */
export function classifyAiFailure(err: unknown): AiFailureKind {
  const status = (err as { status?: unknown } | null)?.status;
  if (status === 429) return 'rate-limited';
  if (status === 503) return 'unavailable';
  // Fall back to sniffing the message when the status didn't survive (e.g. a
  // stringified upstream error body).
  const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  if (/\b429\b|too many requests|rate.?limit|\bbusy\b/i.test(msg)) return 'rate-limited';
  if (/\b503\b|unavailable/i.test(msg)) return 'unavailable';
  return 'other';
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Image generation via Nano Banana 2 Lite (gemini-3.1-flash-lite-image). Returns a
 * ready-to-use data URL. Real place names are passed as text so the postcard is
 * grounded in the user's actual itinerary. Labeled "AI-generated image" in UI.
 */
export async function generateImage(
  prompt: string,
  onError?: (kind: AiFailureKind) => void,
): Promise<string | null> {
  const call = () =>
    genai().models.generateContent({
      model: MODELS.image,
      contents: prompt,
      config: { responseModalities: ['IMAGE', 'TEXT'] },
    });
  try {
    let resp;
    try {
      resp = await call();
    } catch (err) {
      // One retry for a transient upstream 503; 429s are not retried (see AiFailureKind).
      if (classifyAiFailure(err) !== 'unavailable') throw err;
      await delay(UNAVAILABLE_RETRY_DELAY_MS);
      resp = await call();
    }
    const part = resp.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    const data = part?.inlineData?.data;
    if (!data) return null;
    const mime = part?.inlineData?.mimeType ?? 'image/png';
    return `data:${mime};base64,${data}`;
  } catch (err) {
    // Surface WHY image generation failed (rate limit, model unavailable, quota,
    // key/region) instead of swallowing it — otherwise a run just shows blank/
    // error cards. The classified kind lets the UI show an accurate message.
    console.error('[generateImage] failed:', err);
    onError?.(classifyAiFailure(err));
    return null;
  }
}

/** Build a travel-postcard prompt from real itinerary stop names + a style hint. */
export function postcardPrompt(cityLabel: string, stopNames: string[], styleHint?: string): string {
  const stops = stopNames.slice(0, 6).join(', ');
  const style =
    styleHint?.trim() ||
    'vintage travel poster, warm golden-hour palette, bold clean typography, subtle grain';
  return (
    `Design a single stylized travel postcard for a day in ${cityLabel}. ` +
    `Style: ${style}. ` +
    `Feature these real stops as small illustrated vignettes with tasteful hand-lettered labels: ${stops}. ` +
    `Include a "Greetings from ${cityLabel}" banner. Cohesive, print-ready, no photorealism, no map UI.`
  );
}

/* ============================================================ Ad Studio ==== */

/**
 * Fetch an image URL (same-origin `/api/real-world-reasoning-agent/gmp/…` proxy path or an `https:` Google-hosted
 * Places photo URI) and convert it to a base64 inlineData part. Returns null on
 * any failure or disallowed scheme — callers degrade to a text-only image call.
 */
export interface InlineImageData {
  mimeType: string;
  data: string;
}

async function fetchAsInlineData(url: string): Promise<InlineImageData | null> {
  const isSameOrigin = url.startsWith('/');
  const isHttps = url.startsWith('https:');
  if (!isSameOrigin && !isHttps) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CONDITIONING_IMAGE_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const blob = await res.blob();
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    const data = btoa(binary);
    const mimeType = blob.type || 'image/jpeg';
    return { mimeType, data };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Result from an ad creative image generation attempt. `usedConditioning`
 * tells the UI whether the real storefront/location image made it into the
 * successful model request or the call fell back to text-only.
 */
export interface AdImageResult {
  dataUrl: string;
  usedConditioning: boolean;
}

/**
 * Cache of in-flight/resolved conditioning-image fetches, keyed by URL, so the
 * (slow, up-to-8s) fetch can be warmed once during fact-gathering and reused by
 * generation without a second network round-trip. Failed fetches are evicted so
 * a later retry can refetch.
 */
const conditioningCache = new Map<string, Promise<InlineImageData | null>>();

/** Warm the conditioning-image cache for a URL (idempotent). Safe to fire-and-forget. */
export function prefetchAdConditioningImage(url: string): Promise<InlineImageData | null> {
  let cached = conditioningCache.get(url);
  if (!cached) {
    cached = fetchAsInlineData(url).then((res) => {
      if (!res) conditioningCache.delete(url); // don't cache failures — allow a retry to refetch
      return res;
    });
    conditioningCache.set(url, cached);
  }
  return cached;
}

/** Get the conditioning image for a URL, reusing a prefetched result when available. */
export function prepareAdConditioningImage(url: string): Promise<InlineImageData | null> {
  return prefetchAdConditioningImage(url);
}

/**
 * Generate an ad creative image, optionally conditioned on a real photo of the
 * business (Street View frame or a Places photo). On ANY failure — fetching the
 * conditioning image, or the conditioned generateContent call itself — retries
 * once text-only so a campaign never dead-ends on a flaky image fetch/model call.
 * `onFallback` fires when the conditioned attempt fails and the text-only retry begins.
 */
export async function generateAdImage(
  prompt: string,
  conditioningImage?: string | InlineImageData | null,
  onFallback?: () => void,
  onError?: (kind: AiFailureKind) => void,
): Promise<AdImageResult | null> {
  const inline =
    typeof conditioningImage === 'string'
      ? await fetchAsInlineData(conditioningImage)
      : conditioningImage ?? null;

  const attempt = async (withImage: boolean): Promise<AdImageResult | null> => {
    const contents =
      withImage && inline ? [{ inlineData: inline }, { text: prompt }] : prompt;
    const timeoutMs = withImage ? CONDITIONED_IMAGE_TIMEOUT_MS : TEXT_ONLY_IMAGE_TIMEOUT_MS;
    const call = () =>
      withTimeout(
        genai().models.generateContent({
          model: MODELS.image,
          contents,
          config: { responseModalities: ['IMAGE', 'TEXT'] },
        }),
        timeoutMs,
      );
    try {
      let resp;
      try {
        resp = await call();
      } catch (err) {
        // One retry for a transient upstream 503; 429s are not retried (see AiFailureKind).
        if (classifyAiFailure(err) !== 'unavailable') throw err;
        await delay(UNAVAILABLE_RETRY_DELAY_MS);
        resp = await call();
      }
      if (!resp) return null;
      const part = resp.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      const data = part?.inlineData?.data;
      if (!data) return null;
      const mime = part?.inlineData?.mimeType ?? 'image/png';
      return { dataUrl: `data:${mime};base64,${data}`, usedConditioning: withImage && !!inline };
    } catch (err) {
      // Surface the real reason (rate limit, model unavailable, quota, key/region)
      // so a wall of failed ad creatives is diagnosable instead of opaque, and
      // report the classified kind so the batch toast can be accurate.
      console.error(`[generateAdImage] ${withImage ? 'conditioned' : 'text-only'} attempt failed:`, err);
      onError?.(classifyAiFailure(err));
      return null;
    }
  };

  if (inline) {
    const withImage = await attempt(true);
    if (withImage) return withImage;
    onFallback?.(); // surface the text-only retry to the UI
    return attempt(false); // text-only retry
  }
  return attempt(false);
}

/**
 * Downscale a data URL so its base64 payload stays well under the /ai proxy's
 * body cap. No-op (returns input unchanged) outside a DOM environment (SSR/tests)
 * or on any canvas failure.
 */
export async function shrinkImage(dataUrl: string, maxDim = 1024): Promise<string> {
  if (typeof document === 'undefined') return dataUrl;
  try {
    const img = new Image();
    const loaded = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('image failed to load'));
    });
    img.src = dataUrl;
    await loaded;
    const { naturalWidth: width, naturalHeight: height } = img;
    if (!width || !height || (width <= maxDim && height <= maxDim)) return dataUrl;
    const scale = maxDim / Math.max(width, height);
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch {
    return dataUrl;
  }
}

export type AdFormat = 'square' | 'story' | 'banner';

const AD_FORMAT_HINTS: Record<AdFormat, string> = {
  square: 'square 1:1 aspect ratio, ideal for a social feed placement',
  story: 'vertical 9:16 aspect ratio, full-bleed story/reels format',
  banner: 'wide ~1.91:1 banner aspect ratio, ideal for a display placement',
};

export interface AdCopyHints {
  headline?: string;
  body?: string;
  cta?: string;
}

export interface AdFactsForPrompt {
  env?: EnvironmentSnapshot;
  vibe?: string;
}

/**
 * Pure ad-image prompt builder. Only weaves in facts that were actually passed
 * in (grounded); never invents ratings, awards, distances, or foot-traffic
 * numbers. Ratings below 4.2 are deliberately omitted (not a strong enough
 * signal to lead an ad with).
 */
export function adPrompt(
  business: PlaceLite,
  facts: AdFactsForPrompt,
  style: string,
  format: AdFormat,
  copy?: AdCopyHints,
): string {
  const lines: string[] = [];
  lines.push(`Create a single advertising creative image for "${business.name}".`);
  lines.push(
    'Use the attached photo of the actual storefront/location as visual reference for the building, ' +
      'signage and setting — keep it recognizably the same real place.',
  );

  const neighborhood = business.formattedAddress?.split(',')[1]?.trim() || business.formattedAddress;
  if (neighborhood) lines.push(`It is located in ${neighborhood}.`);

  if (business.rating != null && business.rating >= 4.2) {
    lines.push(`It is a well-loved, highly rated spot (${business.rating.toFixed(1)} stars).`);
  }

  if (facts.env?.weather?.tempC != null) {
    const cond = facts.env.weather.condition ? ` ${facts.env.weather.condition.toLowerCase()}` : '';
    lines.push(`Set the mood for a${cond} ${Math.round(facts.env.weather.tempC)}°C day.`);
  }

  if (facts.vibe) lines.push(`Vibe notes grounded in real local context: ${facts.vibe}`);

  lines.push(`Art direction / style: ${style}.`);
  lines.push(`Format: ${AD_FORMAT_HINTS[format]}.`);
  lines.push(
    'Clean advertising layout with clear negative space reserved for a headline and call-to-action overlay.',
  );
  if (copy?.headline) lines.push(`Leave room to overlay this headline text: "${copy.headline}".`);

  lines.push("No fake awards, no invented claims or statistics, no other brands' logos or trademarks.");
  return lines.join(' ');
}
