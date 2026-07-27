import type { MissionMode } from '@/mission/types';

type ApiHealth = 'ok' | 'degraded' | 'down';

export interface CapabilityInputs {
  browserMaps: boolean;
  serverMaps: boolean;
  gemini: boolean;
  groundingLite: boolean;
  online: boolean;
  apiHealth: ApiHealth;
}

export type CapabilityStatus = CapabilityInputs & { mode: MissionMode };

/** Live is opt-in by proven capability; every unknown or degraded state uses fixtures. */
export function resolveMissionMode(input: CapabilityInputs): MissionMode {
  return input.browserMaps && input.serverMaps && input.gemini && input.groundingLite && input.online && input.apiHealth === 'ok'
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
    groundingLite: false,
    online: typeof navigator === 'undefined' || navigator.onLine !== false,
    apiHealth,
  };
  try {
    const response = await fetch('/api/real-world-reasoning-agent/capabilities', { method: 'GET', signal, cache: 'no-store' });
    if (!response.ok) return { ...base, mode: resolveMissionMode(base) };
    const capabilities = await response.json() as { maps?: unknown; gemini?: unknown; groundingLite?: unknown };
    const status = {
      ...base,
      serverMaps: capabilities.maps === true,
      gemini: hasPersonalGemini || capabilities.gemini === true,
      groundingLite: capabilities.groundingLite === true,
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
