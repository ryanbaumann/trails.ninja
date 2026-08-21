import type { MissionMode } from '@/mission/types';

type ApiHealth = 'ok' | 'degraded' | 'down';

export interface CapabilityInputs {
  browserMaps: boolean;
  serverMaps: boolean;
  gemini: boolean;
  mapsGrounding: boolean;
  groundingLite?: boolean;
  online: boolean;
  apiHealth: ApiHealth;
}

export type CapabilityStatus = CapabilityInputs & { mode: MissionMode };

/** Live is opt-in by proven capability; every unknown or degraded state uses fixtures. */
export function resolveMissionMode(input: CapabilityInputs): MissionMode {
  const grounding = input.mapsGrounding || (input.groundingLite ?? false);
  return input.browserMaps && input.serverMaps && input.gemini && grounding && input.online && input.apiHealth === 'ok'
    ? 'live'
    : 'demo';
}

export async function preflightCapabilities(
  browserMaps: boolean,
  apiHealth: ApiHealth,
  hasPersonalGemini = false,
  signal?: AbortSignal,
): Promise<CapabilityStatus> {
  const base = {
    browserMaps,
    serverMaps: false,
    gemini: hasPersonalGemini,
    mapsGrounding: hasPersonalGemini,
    groundingLite: hasPersonalGemini,
    online: typeof navigator === 'undefined' || navigator.onLine !== false,
    apiHealth,
  };
  try {
    const response = await fetch('/api/real-world-reasoning-agent/capabilities', { method: 'GET', signal, cache: 'no-store' });
    if (!response.ok) return { ...base, mode: resolveMissionMode(base) };
    const capabilities = await response.json() as { maps?: unknown; gemini?: unknown; mapsGrounding?: unknown; groundingLite?: unknown };
    const geminiAvailable = hasPersonalGemini || capabilities.gemini === true;
    const mapsGroundingAvailable = geminiAvailable || capabilities.mapsGrounding === true || capabilities.groundingLite === true;
    const status = {
      ...base,
      serverMaps: capabilities.maps === true,
      gemini: geminiAvailable,
      mapsGrounding: mapsGroundingAvailable,
      groundingLite: mapsGroundingAvailable,
    };
    return { ...status, mode: resolveMissionMode(status) };
  } catch {
    return { ...base, mode: resolveMissionMode(base) };
  }
}

export async function preflightMissionMode(
  browserMaps: boolean,
  apiHealth: ApiHealth,
  signal?: AbortSignal,
  hasPersonalGemini = false,
): Promise<MissionMode> {
  return (await preflightCapabilities(browserMaps, apiHealth, hasPersonalGemini, signal)).mode;
}
