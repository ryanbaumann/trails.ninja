import baseline from '../eval/explorer/baseline.json';
import cases from '../eval/explorer/cases.json';
import { evaluateExplorerTraces } from '../src/eval/explorer/grader';
import { executeExplorerEval } from '../src/eval/explorer/harness';
import type { ExplorerEvalCase } from '../src/eval/explorer/harness';
import type { ExplorerEvalDimension, ExplorerEvalScore } from '../src/eval/explorer/types';

const candidate = evaluateExplorerTraces(await executeExplorerEval(cases as ExplorerEvalCase[]));
const before = baseline as ExplorerEvalScore[];
const delta = Object.fromEntries((Object.keys(candidate.byDimension) as ExplorerEvalDimension[]).map((dimension) => {
  const baselinePassed = before.filter((score) => score.dimensions[dimension] === 'pass').length;
  const next = candidate.byDimension[dimension];
  return [dimension, { before: baselinePassed, after: next.passed, applicable: next.applicable, delta: next.passed - baselinePassed }];
}));

console.log(JSON.stringify({ dataset: 'eval/explorer/cases.json', baseline: 'eval/explorer/baseline.json', candidate: {
  total: candidate.total, perfect: candidate.perfect, p75FirstMapEffectMs: candidate.p75FirstMapEffectMs,
}, dimensions: delta }, null, 2));

if (candidate.perfect !== cases.length) process.exitCode = 1;
