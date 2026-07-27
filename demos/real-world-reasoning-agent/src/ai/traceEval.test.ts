import { describe, expect, it } from 'vitest';
import dataset from '../../eval/traces.json';
import {
  evaluateTraces,
  scoreTrace,
  type AgentTrace,
  type Dimension,
} from './traceEval';

const traces = (dataset as unknown as { traces: AgentTrace[] }).traces;
const byId = (id: string): AgentTrace => {
  const t = traces.find((x) => x.id === id);
  if (!t) throw new Error(`missing trace ${id}`);
  return t;
};

/** Which single dimension each fail.* fixture is designed to violate. */
const EXPECTED_FAILURE: Record<string, Dimension> = {
  'fail.toolorder.facts-before-business': 'toolOrderOk',
  'fail.grounding.invented-rating': 'grounded',
  'fail.ownership.double-owned-comparison': 'surfaceOwnershipOk',
  'fail.consistency.leaked-token': 'uiFinalConsistent',
  'fail.consistency.claims-absent-surface': 'uiFinalConsistent',
  'fail.mission.partial-no-artifact': 'missionCompleted',
};

describe('agent trace evaluator', () => {
  it('has unique ids and a well-formed dataset', () => {
    const ids = traces.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of traces) {
      expect(Array.isArray(t.toolCalls)).toBe(true);
      expect(Array.isArray(t.surfaces)).toBe(true);
      expect(typeof t.finalText).toBe('string');
    }
  });

  it('scores every golden trace perfectly across all five dimensions', () => {
    for (const t of traces.filter((x) => x.id.startsWith('golden.'))) {
      const score = scoreTrace(t);
      expect(score.passed, `${t.id} dims=${JSON.stringify(score.dimensions)}`).toBe(score.total);
    }
  });

  it('isolates behaviors: each fail.* trace fails exactly its target dimension', () => {
    for (const [id, dim] of Object.entries(EXPECTED_FAILURE)) {
      const score = scoreTrace(byId(id));
      expect(score.dimensions[dim], `${id} should FAIL ${dim}`).toBe(false);
      const others = (Object.keys(score.dimensions) as Dimension[]).filter((d) => d !== dim);
      for (const d of others) {
        expect(score.dimensions[d], `${id} should PASS ${d}`).toBe(true);
      }
    }
  });

  it('aggregates a delta-friendly report', () => {
    const report = evaluateTraces(traces);
    expect(report.total).toBe(traces.length);
    // 3 golden traces are perfect; every fail.* has exactly one failing dimension.
    expect(report.perfect).toBe(traces.filter((t) => t.id.startsWith('golden.')).length);
    expect(report.failures).toHaveLength(Object.keys(EXPECTED_FAILURE).length);
    // Each dimension's pass count never exceeds the total.
    for (const d of Object.keys(report.byDimension) as Dimension[]) {
      expect(report.byDimension[d].total).toBe(traces.length);
      expect(report.byDimension[d].passed).toBeLessThanOrEqual(traces.length);
    }
  });
});
