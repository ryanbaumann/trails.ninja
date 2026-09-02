import { ThinkingLevel } from '@google/genai';

export const GMP_BROWSER_KEY = import.meta.env.VITE_GMP_API_KEY;
export const DEFAULT_MAP_ID = '9e6b48a5b3653026f9d7556d';

export function resolveMapId(value?: string): string {
  return value?.trim() || DEFAULT_MAP_ID;
}

export const MAP_ID = resolveMapId(import.meta.env.VITE_GMP_MAP_ID);

/** vis.gl API loader config. `weekly` channel carries maps3d +
 *  gmp-place-contextual. Libraries preloaded so services can grab them fast. */
export const MAPS_VERSION = 'weekly';
export const MAPS_LIBRARIES = [
  'maps',
  'places',
  'marker',
  'routes',
  'geometry',
  'maps3d',
] as const;

/** Attribution id required by the agent-skills program (GMP compliance). */
export const USAGE_ATTRIBUTION_ID = 'gmp_git_agentskills_v1';

/**
 * Gemini model ids — per installed gemini skills (training data is stale).
 * Every id is overridable at build time so a deployer can swap in a heavier
 * model without code changes. NEVER invent model ids — any override MUST also be
 * added to the server's allowedModels allowlist (server/index.mjs, via
 * GENAI_EXTRA_MODELS) or the /ai proxy will reject it with 403. 
 *
 * Default routing: the main copilot is the orchestration agent and uses
 * `gemini-3.8-flash` at HIGH thinking. Bounded task agents use
 * `gemini-3.8-flash` at LOW thinking for classification, formatting, suggestions,
 * voice STT transcription, and multimodal evidence analysis. Where task agents emit JSON
 * (e.g. follow-up suggestions), we constrain them with a Gemini structured-output
 * `responseJsonSchema` so the model stays reliable without paying for a
 * bigger one.
 *
 * - `vision` grounds Scout's imagery reasoning (Street View + aerial). Defaults
 *   to the worker model at LOW thinking; override with
 *   VITE_GEMINI_VISION_MODEL.
 * - `stt` transcribes microphone audio for the copilot's voice input. Defaults
 *   to the low-latency worker tier (already allowlisted); override with
 *   VITE_GEMINI_STT_MODEL. Runs with LOW thinking for the fastest turnaround.
 * - `omni` targets the Gemini "omni" model, which is a VIDEO generation model
 *   driven through the Interactions API (see src/ai/video.ts) — NOT an
 *   image-understanding model. It powers the Cinema tour-video and Scout
 *   walkthrough-video surfaces, and is inert unless VITE_VIDEO_GEN_ENABLED is
 *   set and the id is allowlisted (GENAI_EXTRA_MODELS).
 */
const ORCHESTRATOR_MODEL =
  import.meta.env.VITE_GEMINI_ORCHESTRATOR_MODEL ||
  import.meta.env.VITE_GEMINI_CHAT_MODEL ||
  'gemini-3.8-flash';
const WORKER_MODEL =
  import.meta.env.VITE_GEMINI_WORKER_MODEL ||
  import.meta.env.VITE_GEMINI_UTILITY_MODEL ||
  'gemini-3.8-flash';
const VISION_MODEL =
  import.meta.env.VITE_GEMINI_VISION_MODEL ||
  WORKER_MODEL;
const STT_MODEL =
  import.meta.env.VITE_GEMINI_STT_MODEL ||
  WORKER_MODEL;

export const MODELS = {
  /** Main orchestrator (copilot chat in every journey). Defaults to gemini-3.8-flash. */
  orchestrator: ORCHESTRATOR_MODEL,
  /** Legacy alias for {@link MODELS.orchestrator}. */
  chat: ORCHESTRATOR_MODEL,
  /** Shared fast worker for bounded tasks (JSON formatting, chips, briefs). */
  worker: WORKER_MODEL,
  /** Legacy alias for {@link MODELS.worker}. */
  utility: WORKER_MODEL,
  /** Multimodal imagery reasoning (Street View + aerial). Defaults to WORKER_MODEL. */
  vision: VISION_MODEL,
  /** Speech-to-text for the copilot voice input. Defaults to WORKER_MODEL. */
  stt: STT_MODEL,
  /** TTS model used when browser speechSynthesis is unavailable or disabled. */
  tts: import.meta.env.VITE_GEMINI_TTS_MODEL || 'gemini-3.1-flash-tts-preview',
  /** Image generation model used for Ad Studio assets and visuals. */
  image: import.meta.env.VITE_GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-lite-image',
  /** Video generation model (Interactions API) powering Cinema and Scout video. */
  omni: import.meta.env.VITE_GEMINI_OMNI_MODEL || 'gemini-omni-1.1-flash-preview',
} as const;

/**
 * Global killswitch for video generation (Cinema tour-video and Scout walkthrough).
 * Defaults to true. If you don't have access to the omni video model, set
 * VITE_VIDEO_GEN_ENABLED=false to hide the Cinema/Scout video CTAs. For the
 * clip to actually render, MODELS.omni must be a real image→video model your
 * project can call and must be on the server allowlist (the default omni id is
 * in server/index.mjs's base set; any override needs GENAI_EXTRA_MODELS). If the
 * model is unavailable the CTAs degrade to a friendly error, not a crash.
 * See docs/FUTURE_WORK.md.
 */
export const VIDEO_GEN_ENABLED = import.meta.env.VITE_VIDEO_GEN_ENABLED !== 'false';

/** Thinking level configurations based on the type of task:
 *  - 'orchestration' for max orchestration (Copilot multi-turn tool calling) -> HIGH
 *  - 'simpleUi' for immediate simple ui/ux (Grounding, Cinema Narration, Voice, Suggestions) -> LOW
 *  - 'other' for primary text and vision reasoning -> LOW
 */
export const THINKING_CONFIGS = {
  orchestration: {
    thinkingLevel: ThinkingLevel.HIGH,
  },
  simpleUi: {
    thinkingLevel: ThinkingLevel.LOW,
  },
  other: {
    thinkingLevel: ThinkingLevel.LOW,
  },
} as const;

/** Public, inspectable routing contract used by the settings UI and tests. */
export const AGENT_PROFILES = {
  orchestrator: { model: MODELS.orchestrator, thinking: 'high' },
  fastWorker: { model: MODELS.worker, thinking: 'low' },
  analysisWorker: { model: MODELS.vision, thinking: 'low' },
} as const;

/**
 * Fast reasoning tier for general-purpose utility calls (voice transcription,
 * suggestions, grounded briefs).
 */
export const LOW_THINKING_CONFIG = THINKING_CONFIGS.simpleUi;
export const MINIMAL_THINKING_CONFIG = LOW_THINKING_CONFIG;

/** Default reasoning tier for general-purpose Gemini text and vision calls. */
export const DEFAULT_THINKING_CONFIG = THINKING_CONFIGS.other;

/**
 * Safely resolves the thinkingConfig object based on model support.
 * - Gemini 3.x models support thinkingLevel: LOW, MEDIUM, HIGH.
 * - Gemini 2.5 models support thinkingBudget.
 * - Image, TTS, and Omni models do not support thinking config and return undefined.
 */
export function getThinkingConfig(
  model: string,
  level: 'orchestration' | 'simpleUi' | 'other'
): { thinkingLevel?: ThinkingLevel; thinkingBudget?: number } | undefined {
  if (!model) return undefined;

  // Image, audio/TTS, and Omni models do not support thinking config
  if (/image|tts|omni/i.test(model)) {
    return undefined;
  }

  // Gemini 3.x models (gemini-3.8, gemini-3.7, gemini-3.6, gemini-3.5, gemini-3.1)
  if (/^gemini-3/i.test(model)) {
    if (level === 'orchestration') {
      return { thinkingLevel: ThinkingLevel.HIGH };
    }
    return { thinkingLevel: ThinkingLevel.LOW };
  }

  // Gemini 2.5 supports thinkingBudget
  if (/^gemini-2\.5/i.test(model)) {
    if (level === 'orchestration') {
      return { thinkingBudget: 2048 };
    } else if (level === 'simpleUi') {
      return { thinkingBudget: 1024 };
    } else {
      return { thinkingBudget: 1024 };
    }
  }

  // Otherwise, do not include thinkingConfig to prevent errors
  return undefined;
}

/**
 * Optional global override for the COPILOT CHAT model's thinking level, so you can
 * A/B the orchestrator thinking tier without code edits. Set
 * `VITE_GEMINI_CHAT_THINKING` to `low | medium | high`.
 */
export const CHAT_THINKING_OVERRIDE = import.meta.env.VITE_GEMINI_CHAT_THINKING as
  | 'low'
  | 'medium'
  | 'high'
  | undefined;

const THINKING_LEVEL_BY_NAME: Record<string, ThinkingLevel> = {
  minimal: ThinkingLevel.LOW,
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

/**
 * Thinking config for the copilot chat model. Honors `CHAT_THINKING_OVERRIDE`
 * when set (Gemini 3.x supports `thinkingLevel`); otherwise falls back to the
 * per-scenario default via {@link getThinkingConfig}.
 */
export function getChatThinkingConfig(
  model: string,
  level: 'orchestration' | 'other',
  override?: string | null,
): { thinkingLevel?: ThinkingLevel; thinkingBudget?: number } | undefined {
  // Precedence: explicit runtime override (admin panel) → env → per-scenario default.
  const name = (override ?? CHAT_THINKING_OVERRIDE)?.toLowerCase();
  if (name && THINKING_LEVEL_BY_NAME[name] && /^gemini-3/i.test(model)) {
    return { thinkingLevel: THINKING_LEVEL_BY_NAME[name] };
  }
  return getThinkingConfig(model, level);
}

export const DEFAULT_ZOOM = 13.2;
