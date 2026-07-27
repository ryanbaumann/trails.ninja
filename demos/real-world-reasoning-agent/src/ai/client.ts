import { GoogleGenAI } from '@google/genai';

export const GEMINI_BYOK_HEADER = 'x-atlas-gemini-key';

export type GeminiCredentialSnapshot = {
  source: 'hosted' | 'byok';
  epoch: number;
};

let singleton: GoogleGenAI | null = null;
let userKey = '';
let credentialSnapshot: GeminiCredentialSnapshot = { source: 'hosted', epoch: 0 };
const credentialListeners = new Set<() => void>();

export class GeminiCredentialError extends Error {
  constructor(public readonly code: 'invalid' | 'quota' | 'model_unavailable' | 'network' | 'unknown') {
    super(code);
    this.name = 'GeminiCredentialError';
  }
}

export function getGeminiCredentialSnapshot(): GeminiCredentialSnapshot {
  return credentialSnapshot;
}

export function subscribeGeminiCredential(listener: () => void): () => void {
  credentialListeners.add(listener);
  return () => credentialListeners.delete(listener);
}

function publishCredential(source: GeminiCredentialSnapshot['source']): void {
  credentialSnapshot = { source, epoch: credentialSnapshot.epoch + 1 };
  singleton = null;
  credentialListeners.forEach((listener) => listener());
}

/**
 * Validate a personal key through the same guarded proxy used by every Atlas AI
 * call, then retain it only in this tab's JavaScript memory. The raw key never
 * enters Zustand, browser storage, URLs, transcripts, or diagnostics.
 */
export async function connectGeminiApiKey(apiKey: string): Promise<void> {
  const key = apiKey.trim();
  if (!/^[\x21-\x7e]{8,512}$/.test(key)) throw new GeminiCredentialError('invalid');
  let response: Response;
  try {
    response = await fetch('/api/real-world-reasoning-agent/ai/validate', {
      method: 'POST',
      headers: { [GEMINI_BYOK_HEADER]: key, 'content-type': 'application/json' },
      body: '{}',
      cache: 'no-store',
    });
  } catch {
    throw new GeminiCredentialError('network');
  }
  if (!response.ok) {
    let reason = '';
    try {
      reason = String((await response.json() as { reason?: unknown }).reason ?? '');
    } catch {
      // Deliberately ignore upstream prose so a credential can never be echoed.
    }
    if (response.status === 401 || reason === 'invalid') throw new GeminiCredentialError('invalid');
    if (response.status === 429 || reason === 'quota') throw new GeminiCredentialError('quota');
    if (response.status === 424 || reason === 'model_unavailable') throw new GeminiCredentialError('model_unavailable');
    throw new GeminiCredentialError(response.status >= 500 ? 'network' : 'unknown');
  }
  userKey = key;
  publishCredential('byok');
}

export function disconnectGeminiApiKey(): void {
  userKey = '';
  publishCredential('hosted');
}

/**
 * Compatibility shim for the previous BYOK modal. New UI should use
 * connectGeminiApiKey() so the key is validated before activation. The value
 * remains tab-memory-only; it is never written to browser storage.
 */
export function setVisitorGeminiKey(key: string): void {
  const value = key.trim();
  userKey = value;
  publishCredential(value ? 'byok' : 'hosted');
}

export function hasVisitorGeminiKey(): boolean {
  return Boolean(userKey);
}

export function genai(): GoogleGenAI {
  if (!singleton) {
    const baseUrl = typeof window === 'undefined' ? '/api/real-world-reasoning-agent/ai' : new URL('/api/real-world-reasoning-agent/ai', window.location.origin).toString();
    singleton = new GoogleGenAI({
      apiKey: 'proxied',
      httpOptions: {
        baseUrl,
        ...(userKey ? { headers: { [GEMINI_BYOK_HEADER]: userKey } } : {}),
      },
    });
  }
  return singleton;
}
