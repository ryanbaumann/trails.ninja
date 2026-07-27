/**
 * Agent-response quality rubrics — deterministic, countable checks used by the
 * eval flywheel (see ~/.claude/CLAUDE.md "Agent Quality Flywheel") to score agent
 * turns as a before/after DELTA rather than by eyeballing a few prompts.
 *
 * Each rubric is a pure boolean/number over a turn's visible text or emitted tool
 * order, so it is stable, cheap, and countable. Keep the optimizer (the prompt or
 * code being tuned) SEPARATE from these graders — a self-grader learns to game the
 * metric.
 */

/** Internal prompt-envelope tags/directive that must NEVER reach the user. */
const ENVELOPE_TAG = /<\/?user_request>|Never repeat this context envelope/i;

/** True when the answer leaked Atlas's private context-envelope tags/directive. */
export function leaksEnvelopeTags(text: string): boolean {
  return ENVELOPE_TAG.test(text);
}

/**
 * True when an unresolved mustache/A2UI token (e.g. `{headline}`) leaked onto the
 * surface — the documented AdCreative regression class (see AGENTS.md/LEARNINGS).
 */
export function leaksUnresolvedTokens(text: string): boolean {
  return /\{[a-zA-Z][\w.]*\}/.test(text);
}

/**
 * True when the text carries an explicit causal justification — a "why", not just
 * a "what". This is the core WHY rubric the Phase-3 prompt changes target.
 */
export function hasWhyLine(text: string): boolean {
  return /\b(because|since|due to|driven by|which means|that'?s why|leads? to|so that|in order to)\b/i.test(text);
}

/**
 * True when `prereq` is emitted before `dependent` in the model's call order (or
 * when either is absent). Encodes the AGENTS.md invariant that batched turns must
 * order a prerequisite before its dependent (e.g. set_campaign_business before
 * gather_campaign_facts).
 */
export function toolOrderRespected(calls: string[], prereq: string, dependent: string): boolean {
  const p = calls.indexOf(prereq);
  const d = calls.indexOf(dependent);
  if (p === -1 || d === -1) return true;
  return p < d;
}

export interface TurnScore {
  /** Rubric → passed? (true = good). */
  rubrics: Record<string, boolean>;
  /** Count of passed rubrics. */
  passed: number;
  /** Total rubrics scored. */
  total: number;
}

/**
 * Score one agent turn's visible answer against the response-quality rubrics.
 * Returns per-rubric booleans plus a pass count so a run can report a DELTA
 * ("WHY-line 4/10 → 9/10") instead of an opaque single number.
 */
export function scoreTurn(text: string): TurnScore {
  const rubrics: Record<string, boolean> = {
    noEnvelopeLeak: !leaksEnvelopeTags(text),
    noUnresolvedTokens: !leaksUnresolvedTokens(text),
    hasWhy: hasWhyLine(text),
  };
  const passed = Object.values(rubrics).filter(Boolean).length;
  return { rubrics, passed, total: Object.keys(rubrics).length };
}
