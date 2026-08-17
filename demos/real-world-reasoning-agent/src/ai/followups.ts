/**
 * Follow-up suggestions: after every copilot turn, propose 2–3 short next actions
 * the user can click to keep the conversation moving. Runs as a SEPARATE, cheap
 * task-agent call (gemini-3.7-flash at MINIMAL thinking) off the main
 * function-calling chat, so it never blocks or slows the streamed answer. Best
 * effort — any failure returns an empty list and the chips simply don't show.
 */
import { genai } from './client';
import { MODELS, getThinkingConfig } from '@/lib/config';
import { atlas } from '@/state/store';
import { SCENARIOS } from '@/scenarios/registry';
import type { ChatMsg, ScenarioId } from '@/lib/types';

/** How many recent transcript turns to feed the suggester for context. */
const HISTORY_TURNS = 8;
/** Hard bounds on what we render — the UI shows at most 3 compact chips. */
const MIN_SUGGESTIONS = 2;
const MAX_SUGGESTIONS = 3;
const MAX_CHARS = 64;

/**
 * Gemini structured-output schema: force a plain JSON array of 2–3 short strings.
 * Lets the cheap flash-lite utility model produce parser-clean output instead of
 * fenced/prose-wrapped JSON. `normalize` still clamps/de-dupes defensively.
 */
const FOLLOWUPS_SCHEMA = {
  type: 'array',
  items: { type: 'string', maxLength: MAX_CHARS },
  minItems: MIN_SUGGESTIONS,
  maxItems: MAX_SUGGESTIONS,
} as const;

/**
 * Ask the utility model for 2–3 next-step suggestions grounded in the recent
 * transcript and the active journey. Returns clickable, first-person prompts
 * (e.g. "Show me the fastest route") or an empty array on any failure.
 */
export async function suggestFollowups(
  scenario: ScenarioId,
  signal?: AbortSignal,
): Promise<string[]> {
  const transcript = atlas().transcript;
  const history = summarizeTranscript(transcript);
  if (!history) return [];

  const mod = SCENARIOS[scenario];
  const prompt = buildPrompt(mod.title, mod.tagline, history, describeCapabilities(scenario));

  try {
    const thinkingConfig = getThinkingConfig(MODELS.utility, 'simpleUi');
    const resp = await genai().models.generateContent({
      model: MODELS.utility,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        // Structured output so the small flash-lite utility model reliably emits a
        // JSON array of strings (no prose, no fences, no objects) — the parser
        // stays as a defensive fallback for older models that ignore the schema.
        responseJsonSchema: FOLLOWUPS_SCHEMA,
        ...(thinkingConfig ? { thinkingConfig } : {}),
        ...(signal ? { abortSignal: signal } : {}),
      },
    });
    if (signal?.aborted) return [];
    return parseFollowups(resp.text ?? '');
  } catch {
    return [];
  }
}

/** Turn raw model output into 2–3 clean suggestion strings (or [] if unusable).
 *  Exported for unit testing the JSON-tolerant parsing + normalization. */
export function parseFollowups(raw: string): string[] {
  return normalize(parseSuggestions(raw));
}

/** Compact, role-tagged view of the last few turns (user + model text only). */
function summarizeTranscript(msgs: ChatMsg[]): string {
  const lines: string[] = [];
  for (const m of msgs) {
    if (m.role !== 'user' && m.role !== 'model') continue;
    const text = (m.text ?? '').trim();
    if (!text) continue;
    const who = m.role === 'user' ? 'User' : 'Atlas';
    lines.push(`${who}: ${text.length > 400 ? text.slice(0, 399).trimEnd() + '…' : text}`);
  }
  return lines.slice(-HISTORY_TURNS).join('\n');
}

/** Plumbing tools that aren't user-facing actions — excluded from the capability
 *  list so the suggester never proposes "render a surface" / "show a notice". */
const NON_ACTION_TOOLS = new Set(['render_surface', 'show_notice']);

/** First sentence of a tool description, for a compact capability line. */
function firstSentence(desc: string): string {
  const trimmed = desc.trim();
  const dot = trimmed.indexOf('. ');
  return (dot > 0 ? trimmed.slice(0, dot) : trimmed).trim();
}

/**
 * A concise, capability list for a journey, derived from its actual tools. Feeds
 * the suggester so it never proposes actions the agent can't perform (e.g. the
 * Fleet journey has no "traffic heatmap" tool, so it must not suggest one).
 * Exported for unit testing.
 */
export function describeCapabilities(scenario: ScenarioId): string {
  const mod = SCENARIOS[scenario];
  return mod.tools
    .map((t) => t.declaration)
    .filter((d) => d.name && !NON_ACTION_TOOLS.has(d.name))
    .map((d) => `- ${d.name}: ${firstSentence(d.description ?? '')}`)
    .join('\n');
}

/** Build the utility-model prompt. Exported for unit testing the nudge rules. */
export function buildPrompt(title: string, tagline: string, history: string, capabilities?: string): string {
  return [
    `You are Atlas, a Google Maps + Gemini copilot. The user is in the "${title}" journey (${tagline}).`,
    'Based on the conversation so far, propose the 2-3 most useful next actions the user might want to take.',
    'Rules:',
    '- Write each as a short first-person request the user could click to send (e.g. "Show me the fastest route", "Compare this with a quieter neighborhood").',
    `- Keep each under ${MAX_CHARS} characters, specific to the context, and distinct from each other.`,
    '- Do not repeat something the user already asked. Prefer concrete, forward-moving steps.',
    "- If a result was just produced, make ONE suggestion a step that deepens understanding of it — the WHY behind the outcome (e.g. \"Why is #1 the winner?\", \"Explain the tradeoffs\") — not only forward \"do\" actions.",
    '- Favor steps with a visible payoff: a route drawn, a 3D flyover, a scorecard, a postcard, an exported campaign.',
    '- When it fits, suggest a cross-journey hop (e.g. after an ad campaign, "Now scout a site for it").',
    '- If the run produced something shareable, offer a finishing move like "Make the postcard" or "Export the campaign".',
    ...(capabilities
      ? [
          '- CRITICAL: only suggest actions Atlas can actually perform with the capabilities listed below (or a hop to another journey). Never invent features it lacks — no heatmaps, dashboards, alerts, notifications, exports, or bulk edits unless a capability explicitly supports it. If you are unsure an action is supported, do not suggest it.',
          '',
          "Atlas's capabilities in this journey:",
          capabilities,
        ]
      : []),
    'Respond with ONLY a JSON array of 2-3 strings, nothing else.',
    '',
    'Conversation:',
    history,
  ].join('\n');
}

/** Parse the model output into a string array, tolerating fenced/prose wrappers. */
function parseSuggestions(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('[');
    const end = trimmed.lastIndexOf(']');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return [];
      }
    }
    return [];
  }
}

/** Coerce, trim, de-dupe, length-clamp, and bound to MIN..MAX suggestions. */
function normalize(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const clean = item.trim().replace(/\s+/g, ' ');
    if (!clean) continue;
    const capped = clean.length > MAX_CHARS ? clean.slice(0, MAX_CHARS - 1).trimEnd() + '…' : clean;
    const key = capped.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(capped);
    if (out.length >= MAX_SUGGESTIONS) break;
  }
  return out.length >= MIN_SUGGESTIONS ? out : [];
}
