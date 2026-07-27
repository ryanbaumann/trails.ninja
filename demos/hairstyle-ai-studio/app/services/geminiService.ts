import { OutputLayout, HairstyleOption, GenerationMode } from '../types';

const API_BASE = '/api/hairstyle-ai-studio';
const GENERATION_TIMEOUT_MS = 120_000;

export interface FreeTierStatus {
  enabled: boolean;
  limit: number;
  remaining: number;
  resetAt: string;
}

const headersFor = (apiKey: string) => ({
  'Content-Type': 'application/json',
  ...(apiKey ? { 'X-Gemini-API-Key': apiKey } : {}),
});

async function readJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data?.error === 'string' ? data.error : 'Gemini request failed.';
    const code = typeof data?.code === 'string' ? data.code : 'GEMINI_REQUEST_FAILED';
    if (response.status === 429) throw new RateLimitError(message, code);
    throw new GeminiApiError(message, code);
  }
  return data;
}

const withTimeout = (signal?: AbortSignal): AbortSignal => {
  const timeout = AbortSignal.timeout(GENERATION_TIMEOUT_MS);
  if (!signal) return timeout;
  return typeof AbortSignal.any === 'function' ? AbortSignal.any([signal, timeout]) : signal;
};

export class GeminiApiError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'GeminiApiError';
  }
}

export class RateLimitError extends GeminiApiError {
  constructor(message: string, code = 'RATE_LIMITED') {
    super(message, code);
    this.name = 'RateLimitError';
  }
}

export const getFreeTierStatus = async (): Promise<FreeTierStatus> => {
  const response = await fetch(`${API_BASE}/quota`, { method: 'GET' });
  return readJson(response);
};

export const validateGeminiKey = async (apiKey: string): Promise<boolean> => {
  const response = await fetch(`${API_BASE}/validate-key`, {
    method: 'POST',
    headers: headersFor(apiKey),
    body: '{}',
  });
  const data = await readJson(response);
  return data.valid === true;
};

export const analyzeUserImage = async (
  apiKey: string,
  base64Image: string,
  availableStyles: HairstyleOption[] = []
): Promise<{ recommendedStyleId: string | null }> => {
  const response = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: headersFor(apiKey),
    body: JSON.stringify({ base64Image, availableStyles }),
  });
  const data = await readJson(response);
  return {
    recommendedStyleId: data.recommendedStyleId || null,
  };
};

export const generateHairstyleImage = async (
  apiKey: string,
  images: { front: string | null; side: string | null; back: string | null },
  styleDescription: string,
  styleReferenceImage: string | null = null,
  styleReferenceUrl: string | null = null,
  generationMode: GenerationMode = 'fast',
  outputLayout: OutputLayout = 'single',
  signal?: AbortSignal
): Promise<string> => {
  const response = await fetch(`${API_BASE}/generate`, {
    method: 'POST',
    headers: headersFor(apiKey),
    signal: withTimeout(signal),
    body: JSON.stringify({
      images,
      styleDescription,
      styleReferenceImage,
      styleReferenceUrl,
      generationMode,
      outputLayout,
    }),
  });
  const data = await readJson(response);
  if (typeof data.image !== 'string' || !data.image.startsWith('data:image/')) {
    throw new Error('Gemini completed without returning an image.');
  }
  return data.image;
};

export const refineHairstyleImage = async (
  apiKey: string,
  currentImage: string,
  refinementInstruction: string,
  styleReferenceImage: string | null = null,
  styleReferenceUrl: string | null = null,
  generationMode: GenerationMode = 'fast',
  outputLayout: OutputLayout = 'single',
  signal?: AbortSignal
): Promise<string> => {
  const response = await fetch(`${API_BASE}/refine`, {
    method: 'POST',
    headers: headersFor(apiKey),
    signal: withTimeout(signal),
    body: JSON.stringify({
      currentImage,
      refinementInstruction,
      styleReferenceImage,
      styleReferenceUrl,
      generationMode,
      outputLayout,
    }),
  });
  const data = await readJson(response);
  if (typeof data.image !== 'string' || !data.image.startsWith('data:image/')) {
    throw new Error('Gemini completed without returning an image.');
  }
  return data.image;
};
