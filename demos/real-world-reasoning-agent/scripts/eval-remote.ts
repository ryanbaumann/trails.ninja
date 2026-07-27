/**
 * Eval runner with a HUMAN-APPROVAL gate for paid remote evaluation
 * (reliability plan §4: "Require human approval before a paid remote evaluation
 * and compare before/after deltas for prompt or tool changes").
 *
 * Run with vite-node so it can import the real evaluator (single source of
 * truth — never re-implement the grader here):
 *
 *   node_modules/.bin/vite-node scripts/eval-remote.ts              # local eval + delta vs baseline
 *   node_modules/.bin/vite-node scripts/eval-remote.ts --save-baseline
 *   EVAL_REMOTE_APPROVED=1 vite-node scripts/eval-remote.ts         # also runs the paid remote eval
 *
 * The LOCAL eval (deterministic trace dimensions) always runs — it is free and
 * offline. The REMOTE eval (a paid AutoRater over the Agent Platform GenAI
 * Evaluation Service) NEVER runs unless a human sets EVAL_REMOTE_APPROVED=1, so
 * a routine `npm run eval` can never silently spend money. Deltas are computed
 * against .eval/baseline.json (untracked) so prompt/tool changes are judged by
 * their effect on the numbers, not a single absolute score.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { evaluateTraces, type AgentTrace, type Dimension } from '@/ai/traceEval';
import dataset from '../eval/traces.json';

const OUT = '.eval';
const BASELINE = `${OUT}/baseline.json`;
const LAST = `${OUT}/last-eval.json`;

const traces = (dataset as unknown as { traces: AgentTrace[] }).traces;
const report = evaluateTraces(traces);

mkdirSync(OUT, { recursive: true });

type DimReport = Record<Dimension, { passed: number; total: number }>;
const prev: DimReport | null = existsSync(BASELINE)
  ? (JSON.parse(readFileSync(BASELINE, 'utf8')).byDimension as DimReport)
  : null;

console.log(`LOCAL TRACE EVAL — ${report.total} traces, ${report.perfect} perfect`);
for (const dim of Object.keys(report.byDimension) as Dimension[]) {
  const cur = report.byDimension[dim];
  const base = prev?.[dim];
  const delta = base ? cur.passed - base.passed : 0;
  const sign = delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : '±0';
  const tag = base ? ` (${sign} vs baseline)` : ' (no baseline)';
  console.log(`  ${dim.padEnd(20)} ${cur.passed}/${cur.total}${tag}`);
}
if (report.failures.length) {
  console.log('FAILURES:');
  for (const f of report.failures) console.log(`  ${f.id} → ${f.dimension}`);
}

writeFileSync(LAST, JSON.stringify(report, null, 2));

if (process.argv.includes('--save-baseline')) {
  writeFileSync(BASELINE, JSON.stringify(report, null, 2));
  console.log(`baseline saved → ${BASELINE}`);
}

// ---- Paid remote eval: gated behind explicit human approval -----------------
const approved = process.env.EVAL_REMOTE_APPROVED === '1';
if (!approved) {
  console.log(
    'REMOTE EVAL  gated — set EVAL_REMOTE_APPROVED=1 to run the paid AutoRater ' +
      'evaluation (Agent Platform GenAI Evaluation Service). Skipped; no spend.',
  );
} else {
  // Approval is present, but a paid run must ALSO be configured; never fabricate
  // remote scores. Fail loudly with what's missing rather than pretending.
  const key = process.env.GEMINI_KEY;
  if (!key) {
    console.error('REMOTE EVAL  approved but GEMINI_KEY is not set — cannot run. Aborting.');
    process.exit(1);
  }
  console.error(
    'REMOTE EVAL  approved, but the remote AutoRater client is not wired in this ' +
      'repo yet. Configure the GenAI Evaluation Service endpoint before enabling ' +
      'this path (see docs/implementation/demo-reliability-hardening.md §4). Aborting.',
  );
  process.exit(2);
}

// Local eval is a gate: non-zero exit if any dimension regressed below baseline.
if (prev) {
  const regressed = (Object.keys(report.byDimension) as Dimension[]).filter(
    (d) => report.byDimension[d].passed < (prev[d]?.passed ?? 0),
  );
  if (regressed.length) {
    console.error(`EVAL FAIL — regressions: ${regressed.join(', ')}`);
    process.exit(1);
  }
}
console.log('EVAL OK');
