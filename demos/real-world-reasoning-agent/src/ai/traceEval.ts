/**
 * Independent agent-trace evaluator (reliability plan §4: "trace dataset and
 * independent evaluation of mission completion, tool order, grounding, surface
 * ownership, and UI/final-response consistency").
 *
 * This is a GRADER, kept deliberately separate from the optimizer (the prompts
 * and tool code it scores) — a self-grader learns to game the metric (see
 * ~/.claude/CLAUDE.md "Agent Quality Flywheel"). Every dimension is a pure,
 * countable boolean over a declared trace, so a run reports a DELTA per
 * dimension ("grounding 6/10 -> 9/10") instead of one opaque number, and each
 * dimension isolates ONE behavior so a regression is attributable.
 *
 * Traces are declared facts about a journey turn (tool order, final text, the
 * surfaces rendered, grounding, mission outcome). Optimization fixtures stay
 * generic and synthetic; live Maps integration canaries are not eval data.
 */
import { leaksEnvelopeTags, leaksUnresolvedTokens, toolOrderRespected } from './rubrics';

export type Journey = 'scout' | 'adstudio' | 'concierge' | 'insight' | 'fleet' | 'cinema';

/** One A2UI surface the turn rendered. `logical` groups instances that must share a single owner. */
export interface TraceSurface {
  /** Catalog component type, e.g. 'AdCreative', 'ComparisonTable', 'MapPreview'. */
  type: string;
  /** Logical surface kind, e.g. 'comparison', 'creative', 'evidence'. */
  logical: string;
  /** Which layer produced it: the shared A2UI catalog, or a scenario's bespoke surface. */
  owner: 'catalog' | 'scenario';
}

export interface AgentTrace {
  id: string;
  journey: Journey;
  userGoal: string;
  /** Tool names in the order the model emitted+executed them. */
  toolCalls: string[];
  /** The user-visible final answer text. */
  finalText: string;
  surfaces: TraceSurface[];
  /** Surface `type`s the final answer claims to have produced (for UI/response consistency). */
  finalReferences: string[];
  grounding: {
    /** Did the declared synthetic turn use its supplied grounded fixture data? */
    used: boolean;
    /** Claims the answer made that are NOT backed by grounded data (fabrications). */
    invented: string[];
    /** Whether this journey requires grounding to be considered correct. */
    required: boolean;
  };
  mission: {
    expectedComplete: boolean;
    status: 'none' | 'complete' | 'partial' | 'failed';
    artifacts: string[];
  };
}

/**
 * Ordered prerequisite chains per journey: if these tools appear, they must
 * appear in this relative order (mirrors the engine's sequential-execution
 * invariant and the scenario contracts, e.g. "Call set_campaign_business first").
 */
const PREREQ_CHAINS: Partial<Record<Journey, string[]>> = {
  adstudio: ['set_campaign_business', 'gather_campaign_facts', 'generate_ad_creatives', 'export_campaign'],
  scout: ['scout_area', 'score_candidates', 'show_evidence'],
};

/** True when every consecutive prereq→dependent pair present in the chain is correctly ordered. */
export function toolOrderOk(trace: AgentTrace): boolean {
  const chain = PREREQ_CHAINS[trace.journey];
  if (!chain) return true;
  for (let i = 0; i < chain.length - 1; i++) {
    if (!toolOrderRespected(trace.toolCalls, chain[i], chain[i + 1])) return false;
  }
  return true;
}

/** True when the turn met (or wasn't expected to meet) mission completion with a real artifact. */
export function missionCompleted(trace: AgentTrace): boolean {
  if (!trace.mission.expectedComplete) return trace.mission.status !== 'failed';
  return trace.mission.status === 'complete' && trace.mission.artifacts.length > 0;
}

/** True when required grounding was used and the answer invented no unbacked claims. */
export function grounded(trace: AgentTrace): boolean {
  if (trace.grounding.invented.length > 0) return false;
  return trace.grounding.required ? trace.grounding.used : true;
}

/**
 * True when exactly ONE layer owns each logical surface kind — the generalized
 * form of the deferred "one layer responsible for Scout comparison surfaces"
 * decision. A `comparison` rendered by both the catalog and a bespoke scenario
 * surface is a double-ownership regression.
 */
export function surfaceOwnershipOk(trace: AgentTrace): boolean {
  const owners = new Map<string, Set<string>>();
  for (const s of trace.surfaces) {
    const set = owners.get(s.logical) ?? new Set<string>();
    set.add(s.owner);
    owners.set(s.logical, set);
  }
  for (const set of owners.values()) if (set.size > 1) return false;
  return true;
}

/**
 * True when the final answer is consistent with what was rendered: no leaked
 * internal tokens/envelope tags, and it never claims a surface type it didn't
 * actually produce (the "confident but stale final message" failure mode).
 */
export function uiFinalConsistent(trace: AgentTrace): boolean {
  if (leaksUnresolvedTokens(trace.finalText) || leaksEnvelopeTags(trace.finalText)) return false;
  const present = new Set(trace.surfaces.map((s) => s.type));
  return trace.finalReferences.every((ref) => present.has(ref));
}

export const DIMENSIONS = {
  missionCompleted,
  toolOrderOk,
  grounded,
  surfaceOwnershipOk,
  uiFinalConsistent,
} as const;

export type Dimension = keyof typeof DIMENSIONS;

export interface TraceScore {
  id: string;
  dimensions: Record<Dimension, boolean>;
  passed: number;
  total: number;
}

/** Score one trace across all five dimensions. */
export function scoreTrace(trace: AgentTrace): TraceScore {
  const dimensions = Object.fromEntries(
    (Object.keys(DIMENSIONS) as Dimension[]).map((d) => [d, DIMENSIONS[d](trace)]),
  ) as Record<Dimension, boolean>;
  const passed = Object.values(dimensions).filter(Boolean).length;
  return { id: trace.id, dimensions, passed, total: Object.keys(DIMENSIONS).length };
}

export interface TraceEvalReport {
  total: number;
  /** Traces that passed every dimension. */
  perfect: number;
  /** Per-dimension pass counts, for delta reporting. */
  byDimension: Record<Dimension, { passed: number; total: number }>;
  /** Every (trace, dimension) failure, for failure analysis. */
  failures: { id: string; dimension: Dimension }[];
  scores: TraceScore[];
}

/** Evaluate a dataset of traces and return a delta-friendly report. */
export function evaluateTraces(traces: AgentTrace[]): TraceEvalReport {
  const scores = traces.map(scoreTrace);
  const dims = Object.keys(DIMENSIONS) as Dimension[];
  const byDimension = Object.fromEntries(
    dims.map((d) => [d, { passed: scores.filter((s) => s.dimensions[d]).length, total: scores.length }]),
  ) as Record<Dimension, { passed: number; total: number }>;
  const failures = scores.flatMap((s) =>
    dims.filter((d) => !s.dimensions[d]).map((d) => ({ id: s.id, dimension: d })),
  );
  return {
    total: traces.length,
    perfect: scores.filter((s) => s.passed === s.total).length,
    byDimension,
    failures,
    scores,
  };
}
