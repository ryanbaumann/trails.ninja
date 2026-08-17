import { ThinkingLevel } from '@google/genai';

export const GMP_BROWSER_KEY = import.meta.env.VITE_GMP_API_KEY;
export const DEFAULT_MAP_ID = 'DEMO_MAP_ID';

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
 * `gemini-3.7-flash` at HIGH thinking. Bounded task agents use
 * `gemini-3.7-flash`: MINIMAL for classification/formatting/voice and
 * LOW for multimodal evidence analysis. Where task agents emit JSON
 * (e.g. follow-up suggestions), we constrain them with a Gemini structured-output
 * `responseJsonSchema` so the model stays reliable without paying for a
 * bigger one.
 *
 * - `vision` grounds Scout's imagery reasoning (Street View + aerial). Defaults
 *   to the worker model at LOW thinking; override with
 *   VITE_GEMINI_VISION_MODEL.
 * - `stt` transcribes microphone audio for the copilot's voice input. Defaults
 *   to the low-latency worker tier (already allowlisted); override with
 *   VITE_GEMINI_STT_MODEL. Runs with MINIMAL thinking for the fastest turnaround.
 * - `omni` targets the Gemini "omni" model, which is a VIDEO generation model
 *   driven through the Interactions API (see src/ai/video.ts) — NOT an
 *   image-understanding model. It powers the Cinema tour-video and Scout
 *   walkthrough-video surfaces, and is inert unless VITE_VIDEO_GEN_ENABLED is
 *   set and the id is allowlisted (GENAI_EXTRA_MODELS).
 */
const ORCHESTRATOR_MODEL =
  import.meta.env.VITE_GEMINI_ORCHESTRATOR_MODEL ||
  import.meta.env.VITE_GEMINI_CHAT_MODEL ||
  'gemini-3.7-flash';
const WORKER_MODEL =
  import.meta.env.VITE_GEMINI_WORKER_MODEL ||
  import.meta.env.VITE_GEMINI_UTILITY_MODEL ||
  'gemini-3.7-flash';

export const MODELS = {
  /** Plans each copilot turn and coordinates deterministic journey tools. */
  orchestrator: ORCHESTRATOR_MODEL,
  /** Low-cost task agent for grounded summaries, analysis, suggestions, and voice. */
  worker: WORKER_MODEL,
  // Compatibility aliases for existing call sites and deployer overrides.
  chat: ORCHESTRATOR_MODEL,
  utility: WORKER_MODEL,
  vision: import.meta.env.VITE_GEMINI_VISION_MODEL || WORKER_MODEL,
  stt: import.meta.env.VITE_GEMINI_STT_MODEL || WORKER_MODEL,
  tts: 'gemini-3.1-flash-tts-preview',
  image: import.meta.env.VITE_GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-lite-image',
  omni: import.meta.env.VITE_GEMINI_OMNI_MODEL || 'gemini-omni-flash-preview',
} as const;

/**
 * Feature flag for the preview omni video-gen surface. ON by default — set
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
 *  - 'simpleUi' for immediate simple ui/ux (Grounding, Cinema Narration, Voice, Suggestions) -> MINIMAL
 *  - 'other' for primary text and vision reasoning -> LOW
 */
export const THINKING_CONFIGS = {
  orchestration: {
    thinkingLevel: ThinkingLevel.HIGH,
  },
  simpleUi: {
    thinkingLevel: ThinkingLevel.MINIMAL,
  },
  other: {
    thinkingLevel: ThinkingLevel.LOW,
  },
} as const;

/** Public, inspectable routing contract used by the settings UI and tests. */
export const AGENT_PROFILES = {
  orchestrator: { model: MODELS.orchestrator, thinking: 'high' },
  fastWorker: { model: MODELS.worker, thinking: 'minimal' },
  analysisWorker: { model: MODELS.vision, thinking: 'low' },
} as const;

/**
 * Fastest thinking tier — used for the latency-sensitive voice path (speech-to-text
 * transcription and text-to-speech narration) where the model isn't reasoning, it's
 * transcribing or vocalizing, so any thinking is pure added latency in the browser.
 */
export const MINIMAL_THINKING_CONFIG = THINKING_CONFIGS.simpleUi;

/** Default reasoning tier for general-purpose Gemini text and vision calls. */
export const DEFAULT_THINKING_CONFIG = THINKING_CONFIGS.other;

/**
 * Safely resolves the thinkingConfig object based on model support.
 * - Gemini 3/3.5 models (e.g. gemini-3.*) support `thinkingLevel`.
 * - Gemini 2.5 models (e.g. gemini-2.5-*) support `thinkingBudget`.
 * - Other/older models (e.g. gemini-2.0, gemini-1.5, image, tts) do not support thinking config at all and will error.
 */
export function getThinkingConfig(
  model: string,
  level: 'orchestration' | 'simpleUi' | 'other'
): { thinkingLevel?: ThinkingLevel; thinkingBudget?: number } | undefined {
  if (!model) return undefined;

  // Gemini 3.x supports named thinking levels.
  if (/^gemini-3/i.test(model)) {
    if (level === 'orchestration') {
      return { thinkingLevel: ThinkingLevel.HIGH };
    } else if (level === 'simpleUi') {
      return { thinkingLevel: ThinkingLevel.MINIMAL };
    } else {
      return { thinkingLevel: ThinkingLevel.LOW };
    }
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
 * `VITE_GEMINI_CHAT_THINKING` to
 * `minimal | low | medium | high`. The production UI exposes low/medium for the
 * orchestrator; the wider type remains for backwards-compatible env experiments.
 */
export const CHAT_THINKING_OVERRIDE = import.meta.env.VITE_GEMINI_CHAT_THINKING as
  | 'minimal'
  | 'low'
  | 'medium'
  | 'high'
  | undefined;

const THINKING_LEVEL_BY_NAME: Record<string, ThinkingLevel> = {
  minimal: ThinkingLevel.MINIMAL,
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
