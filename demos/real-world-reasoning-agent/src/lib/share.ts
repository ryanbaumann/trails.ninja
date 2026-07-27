/**
 * Replay links — the viral primitive. A replay link opens Atlas in the same
 * journey + city and auto-runs the same prompt, so the recipient watches the
 * agent reason live rather than seeing a static screenshot.
 *
 * The param names here MUST match what `getInitialStateFromUrl` in
 * `src/state/store.ts` parses: `scenario`, `city`, `prompt`.
 */
import type { CameraReport, ScenarioId } from './types';
import type { MissionMode, PreferencePassport, SpatialConstraint } from '@/mission/types';

/** Prompts are capped so replay URLs stay well under browser length limits. */
export const REPLAY_PROMPT_MAX = 500;

export interface ReplayLinkParams {
  scenario: ScenarioId;
  cityId: string;
  prompt: string;
}

/** Build an absolute replay URL for the current origin. */
export function buildReplayUrl({ scenario, cityId, prompt }: ReplayLinkParams): string {
  const origin =
    typeof window !== 'undefined' && window.location ? window.location.origin : 'https://atlas.app';
  const params = new URLSearchParams();
  params.set('scenario', scenario);
  params.set('city', cityId);
  params.set('prompt', prompt.slice(0, REPLAY_PROMPT_MAX));
  return `${origin}/?${params.toString()}`;
}

/**
 * Query params that can carry user content (a raw prompt, or a mission blob whose
 * goal text is user-authored). After the app reads them once on load they must be
 * scrubbed from the address bar so they don't linger in history or ride along as a
 * Referer on later requests (reliability §5). Non-sensitive params are preserved.
 */
export const SENSITIVE_REPLAY_PARAMS = ['prompt', 'mission'] as const;

/** Exact user-location camera reports remain session-only and never enter history/share URLs. */
export function cameraReportForUrl(enabled: boolean, report: CameraReport | null): CameraReport | null {
  return enabled ? report : null;
}

/**
 * Return a scrubbed `?query` string with the sensitive replay params removed, or
 * `null` if there was nothing to scrub (so a caller can skip a history write).
 */
export function scrubReplayParams(search: string): string | null {
  const params = new URLSearchParams(search);
  let changed = false;
  for (const key of SENSITIVE_REPLAY_PARAMS) {
    if (params.has(key)) {
      params.delete(key);
      changed = true;
    }
  }
  if (!changed) return null;
  const rest = params.toString();
  return rest ? `?${rest}` : '';
}

export interface MissionSharePayloadV1 {
  version: 1;
  goal: string;
  cityId: string;
  mode: MissionMode;
  preferences: Pick<PreferencePassport, 'travelModes' | 'maxTravelMinutes' | 'budget' | 'priorities' | 'accessibility' | 'environmentSensitivities' | 'interests'>;
  area?: SpatialConstraint;
  /** Rank is application-owned decision state; no place ID/name/content is persisted. */
  decisionRank?: number;
}

export function buildMissionReplayUrl(payload: MissionSharePayloadV1): string {
  const origin = typeof window !== 'undefined' && window.location ? window.location.origin : 'https://atlas.app';
  const encoded = encodeBase64Url(JSON.stringify(payload));
  return `${origin}/?mission=${encoded}`;
}

export function parseMissionShare(value: string): MissionSharePayloadV1 | null {
  try {
    const parsed = JSON.parse(decodeBase64Url(value)) as Partial<MissionSharePayloadV1>;
    if (parsed.version !== 1 || typeof parsed.goal !== 'string' || typeof parsed.cityId !== 'string') return null;
    if (parsed.mode !== 'live' && parsed.mode !== 'demo') return null;
    if (!parsed.preferences || !Array.isArray(parsed.preferences.travelModes) || typeof parsed.preferences.priorities !== 'object') return null;
    return parsed as MissionSharePayloadV1;
  } catch {
    return null;
  }
}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(base64);
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

export interface SharePayload {
  url: string;
  title?: string;
  text?: string;
  /** Optional files (e.g. a postcard image) shared via the Web Share API. */
  files?: File[];
}

export type ShareResult = 'shared' | 'copied';

/**
 * Share via the native share sheet when available, otherwise copy the URL to the
 * clipboard. Returns which path was taken so callers can toast appropriately.
 * Throws only if BOTH share and clipboard are unavailable or rejected — callers
 * should catch and surface a fallback.
 */
export async function shareOrCopy(payload: SharePayload): Promise<ShareResult> {
  const { url, title, text, files } = payload;
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;

  // Prefer the native share sheet (mobile + some desktops).
  if (nav?.share) {
    const data: ShareData = { url, title, text };
    if (files && files.length && nav.canShare?.({ files })) {
      data.files = files;
    }
    try {
      await nav.share(data);
      return 'shared';
    } catch (err) {
      // AbortError = the user dismissed the sheet; treat as a no-op cancel.
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      // Any other failure falls through to the clipboard path below.
    }
  }

  if (nav?.clipboard?.writeText) {
    await nav.clipboard.writeText(url);
    return 'copied';
  }

  throw new Error('Sharing and clipboard are both unavailable in this browser.');
}
