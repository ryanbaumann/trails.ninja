import {
  VisualMode,
  AspectRatio,
  ImageModelOption,
  PrepareResponse,
  RenderResponse,
} from '../types.ts';

export class GeminiApiError extends Error {
  statusCode: number;
  code?: string;
  details?: string;

  constructor(message: string, statusCode = 500, code?: string, details?: string) {
    super(message);
    this.name = 'GeminiApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class RateLimitError extends GeminiApiError {
  constructor(message: string, details?: string) {
    super(message, 429, 'RATE_LIMITED', details);
    this.name = 'RateLimitError';
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  const isJson = res.headers?.get?.('content-type')?.includes('application/json');
  const data = isJson ? await res.json().catch(() => ({})) : (await res.json().catch(() => ({})));

  if (!res.ok) {
    const message = data.error || data.message || `Request failed with status ${res.status}`;
    if (res.status === 429 || data.code === 'RATE_LIMITED' || data.code === 'FREE_TIER_EXHAUSTED') {
      throw new RateLimitError(message, data.details);
    }
    throw new GeminiApiError(message, res.status, data.code, data.details);
  }

  return data as T;
}

export async function validateApiKey(apiKey: string): Promise<boolean> {
  const res = await fetch('/api/infographic-agent/validate-key', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-gemini-api-key': apiKey,
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    return false;
  }
  const data = await res.json().catch(() => ({}));
  return !!data.valid;
}

export async function prepareInfographic(params: {
  topic: string;
  mode: VisualMode;
  aspect: AspectRatio;
  instructions?: string;
  apiKey?: string | null;
}): Promise<PrepareResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (params.apiKey) {
    headers['x-gemini-api-key'] = params.apiKey;
  }

  const res = await fetch('/api/infographic-agent/prepare', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      topic: params.topic,
      mode: params.mode,
      aspect: params.aspect,
      instructions: params.instructions,
    }),
  });

  return handleResponse<PrepareResponse>(res);
}

export async function renderInfographic(params: {
  prompt: string;
  mode: VisualMode;
  aspect: AspectRatio;
  imageModel?: ImageModelOption;
  previousImageBase64?: string;
  editInstruction?: string;
  apiKey?: string | null;
}): Promise<RenderResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (params.apiKey) {
    headers['x-gemini-api-key'] = params.apiKey;
  }

  const res = await fetch('/api/infographic-agent/render', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      prompt: params.prompt,
      mode: params.mode,
      aspect: params.aspect,
      imageModel: params.imageModel || 'gemini-3.1-flash-lite-image',
      previousImageBase64: params.previousImageBase64,
      editInstruction: params.editInstruction,
    }),
  });

  return handleResponse<RenderResponse>(res);
}
