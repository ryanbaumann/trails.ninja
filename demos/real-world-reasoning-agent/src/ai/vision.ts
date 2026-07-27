/**
 * Gemini VISION over real, fetched imagery (Street View Static frames, Places
 * photos). No UI coupling — pure fetch → inlineData parts → generateContent →
 * parsed JSON. Scout's controller is the only current caller.
 *
 * Compliance: only same-origin `/api/real-world-reasoning-agent/gmp/streetview...` / `/api/real-world-reasoning-agent/gmp/staticmap...` proxy
 * URLs or `https:` Google-hosted URLs are accepted — never an arbitrary
 * third-party URL. Images are shrunk (when a DOM canvas is available) to keep
 * the request under the server's 1 MiB body cap.
 */
import { genai } from './client';
import { MODELS, getThinkingConfig } from '@/lib/config';

export interface VisionVerdict {
  scores: Record<string, number>;
  notes: string;
  confidence: number;
}

const MAX_IMAGES = 4;
const MAX_DIM = 640;
const TOTAL_BUDGET_BYTES = 700_000; // keep well under the 1 MiB proxy body cap

/** Same-origin GMP image proxy paths that vision may fetch (Street View frames,
 *  Static Maps aerial/satellite tiles). Both are server-whitelisted upstreams. */
const ALLOWED_PROXY_PREFIXES = ['/api/real-world-reasoning-agent/gmp/streetview', '/api/real-world-reasoning-agent/gmp/staticmap'];

function isAllowedImageUrl(url: string): boolean {
  try {
    // Same-origin relative proxy path, e.g. "/api/real-world-reasoning-agent/gmp/streetview/..." or "/api/real-world-reasoning-agent/gmp/staticmap/...".
    if (ALLOWED_PROXY_PREFIXES.some((p) => url.startsWith(p))) return true;
    const u = new URL(url, typeof window === 'undefined' ? 'http://localhost' : window.location.origin);
    if (url.startsWith('/')) return ALLOWED_PROXY_PREFIXES.some((p) => u.pathname.startsWith(p));
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Shrink an image blob to at most MAX_DIM on its long edge via a DOM canvas. Falls back to the original blob if no DOM canvas is available (e.g. in tests/SSR). */
async function shrinkBlob(blob: Blob): Promise<Blob> {
  if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') return blob;
  try {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1) {
      bitmap.close?.();
      return blob;
    }
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return blob;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const shrunk = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    return shrunk ?? blob;
  } catch {
    return blob;
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string; // "data:<mime>;base64,<data>"
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

interface InlineImagePart {
  inlineData: { mimeType: string; data: string };
}

async function fetchImagePart(url: string, signal?: AbortSignal): Promise<InlineImagePart | null> {
  if (!isAllowedImageUrl(url)) return null;
  try {
    const res = await fetch(url, signal ? { signal } : undefined);
    if (!res.ok) return null;
    const rawBlob = await res.blob();
    const blob = await shrinkBlob(rawBlob);
    const mimeType = blob.type || 'image/jpeg';
    const data = await blobToBase64(blob);
    return { inlineData: { mimeType, data } };
  } catch {
    return null;
  }
}

/**
 * Seed-frame helper for src/ai/video.ts: fetch a single allowed image URL and
 * return its bare base64 payload + mime type (or null). Thin wrapper over the
 * existing `fetchImagePart`, so it inherits the same shrink-under-1MiB and
 * bare-base64 (no `data:` prefix) behavior that `generateVideo`'s contract expects.
 */
export async function fetchImageBase64(
  url: string,
  signal?: AbortSignal,
): Promise<{ data: string; mimeType: string } | null> {
  const part = await fetchImagePart(url, signal);
  if (!part) return null;
  return { data: part.inlineData.data, mimeType: part.inlineData.mimeType };
}

/**
 * Extract the first top-level `{...}` JSON object from noisy model text (e.g.
 * wrapped in markdown fences or trailing commentary). Pure + unit-tested.
 */
export function firstJsonBlock(raw: string): string | undefined {
  const start = raw.indexOf('{');
  if (start < 0) return undefined;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  return undefined;
}

/**
 * Fetch up to MAX_IMAGES images (Street View / Google-hosted only), send them
 * to Gemini alongside instructions + a JSON schema hint, and return the raw
 * text plus a best-effort parse. Never throws — a failed fetch/parse degrades
 * to fewer images / `parsed: undefined` rather than blocking the caller.
 */
export async function analyzeImagesJson(
  instructions: string,
  imageUrls: string[],
  schemaHint: string,
  signal?: AbortSignal,
): Promise<{ raw: string; parsed?: unknown }> {
  const urls = imageUrls.filter(isAllowedImageUrl).slice(0, MAX_IMAGES);

  const fetchedParts = await Promise.all(urls.map((url) => fetchImagePart(url, signal)));
  const imageParts: InlineImagePart[] = [];
  let budget = TOTAL_BUDGET_BYTES;
  for (const part of fetchedParts) {
    if (!part) continue;
    // Rough byte estimate: base64 length * 3/4.
    const approxBytes = (part.inlineData.data.length * 3) / 4;
    if (approxBytes > budget) continue;
    budget -= approxBytes;
    imageParts.push(part);
  }

  const textPart = { text: `${instructions}\n\n${schemaHint}` };
  const parts = [...imageParts, textPart];

  let raw = '';
  try {
    const thinkingConfig = getThinkingConfig(MODELS.vision, 'other');
    const resp = await genai().models.generateContent({
      model: MODELS.vision,
      contents: parts,
      config: {
        responseMimeType: 'application/json',
        ...(thinkingConfig ? { thinkingConfig } : {}),
        ...(signal ? { abortSignal: signal } : {}),
      },
    });
    raw = resp.text ?? '';
  } catch (err) {
    raw = '';
    return { raw: err instanceof Error ? err.message : String(err), parsed: undefined };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const block = firstJsonBlock(raw);
    if (block) {
      try {
        parsed = JSON.parse(block);
      } catch {
        parsed = undefined;
      }
    }
  }

  return { raw, parsed };
}
