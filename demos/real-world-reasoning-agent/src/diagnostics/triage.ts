/**
 * Telemetry triage (telemetry-triage CI/CD loop). Turns production Cloud Run
 * logs — the structured `diag_batch` (opt-in client diagnostics) and `proxy`
 * (server-side proxy failures) lines emitted by server/index.mjs — into ranked,
 * deduped GitHub-issue PROPOSALS.
 *
 * This module is the deterministic, testable CORE (mirrors traceEval.ts behind
 * eval-remote.ts). It reuses buildTelemetryReport from @/diagnostics/telemetry as
 * the SINGLE SOURCE OF TRUTH for clustering/fingerprinting — never reimplement the
 * reducer here. The thin CLI (scripts/triage.ts) and the workflow's issue opener
 * consume what this produces.
 *
 * Privacy: input records are structural metadata only. If ANY record carries
 * forbidden content (url/coord/email/token/place id), buildTelemetryReport marks
 * the report invalid so a leak fails loudly instead of being filed as an issue.
 */
import {
  buildTelemetryReport,
  buildReplayFixture,
  fingerprint,
  type SanitizedDiagnostic,
  type DiagnosticCluster,
  type TelemetryReport,
} from '@/diagnostics/telemetry';

export type Severity = 'high' | 'medium' | 'low';

/** A structural-only proposal for one distinct failure mode (one GitHub issue). */
export interface IssueProposal {
  /** Stable id (from the cluster's representative sample) — the dedup key. */
  fingerprint: string;
  category: string;
  scenario: string;
  tool: string;
  status: SanitizedDiagnostic['status'];
  /** Occurrences of this category in the window. */
  count: number;
  /** Distinct variants (fingerprints) folded into this category. */
  variants: number;
  severity: Severity;
  component: string;
  title: string;
  body: string;
  labels: string[];
}

export interface TriageResult {
  report: TelemetryReport;
  proposals: IssueProposal[];
  /** Error clusters seen but below `minCount` — surfaced, never silently dropped. */
  dropped: { category: string; count: number }[];
}

/** Default occurrence threshold below which an error cluster is not proposed. */
export const DEFAULT_MIN_COUNT = 3;

const unwrap = (e: unknown): unknown =>
  e && typeof e === 'object' && 'jsonPayload' in (e as Record<string, unknown>)
    ? (e as Record<string, unknown>).jsonPayload
    : e;

/** Parse a whole-JSON array, a single object, or NDJSON into log payloads. */
function extractPayloads(raw: string): Record<string, unknown>[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    return list.map(unwrap).filter((p): p is Record<string, unknown> => !!p && typeof p === 'object');
  } catch {
    // Fall through: gcloud can also emit newline-delimited JSON.
  }
  const out: Record<string, unknown>[] = [];
  for (const line of trimmed.split('\n')) {
    const l = line.trim();
    if (!l) continue;
    try {
      const p = unwrap(JSON.parse(l));
      if (p && typeof p === 'object') out.push(p as Record<string, unknown>);
    } catch {
      // Skip non-JSON log lines (e.g. the "listening on" banner).
    }
  }
  return out;
}

/** Coerce a payload object to a SanitizedDiagnostic, or null if it isn't one. */
function toRecord(p: unknown): SanitizedDiagnostic | null {
  if (!p || typeof p !== 'object') return null;
  const { scenario, tool, status, category, detailLabels, tsBucket } = p as Record<string, unknown>;
  if (
    typeof scenario !== 'string' ||
    typeof tool !== 'string' ||
    typeof category !== 'string' ||
    (status !== 'ok' && status !== 'error' && status !== 'running') ||
    typeof tsBucket !== 'number'
  ) {
    return null;
  }
  return {
    scenario,
    tool,
    status,
    category,
    detailLabels: Array.isArray(detailLabels) ? detailLabels.filter((l): l is string => typeof l === 'string') : [],
    tsBucket,
  };
}

/**
 * Flatten production log text into sanitized diagnostics. Understands the two
 * structured shapes server/index.mjs emits: `diag_batch` (an array of client
 * records) and `proxy` (a single server record). Unknown `evt`s are ignored.
 */
export function parseLogEntries(raw: string): SanitizedDiagnostic[] {
  const out: SanitizedDiagnostic[] = [];
  for (const p of extractPayloads(raw)) {
    if (p.evt === 'diag_batch' && Array.isArray(p.records)) {
      for (const r of p.records) {
        const rec = toRecord(r);
        if (rec) out.push(rec);
      }
    } else if (p.evt === 'proxy' || p.evt === 'diag') {
      const rec = toRecord(p);
      if (rec) out.push(rec);
    }
  }
  return out;
}

function severityFor(status: SanitizedDiagnostic['status'], category: string, count: number, minCount: number): Severity {
  if (status !== 'error') return 'low';
  // A blocked upstream (5xx / timeout) is the most user-visible failure.
  if (category.endsWith(':upstream_error')) return 'high';
  if (count >= minCount * 3) return 'high';
  if (count >= minCount) return 'medium';
  return 'low';
}

function componentFor(scenario: string, tool: string): string {
  return scenario === 'proxy' ? `proxy/${tool}` : `${scenario}/${tool}`;
}

/** Build one structural-only issue proposal from a cluster + its sample record. */
export function classifyCluster(
  cluster: DiagnosticCluster,
  sample: SanitizedDiagnostic,
  minCount: number = DEFAULT_MIN_COUNT,
): IssueProposal {
  const fp = fingerprint(sample);
  const severity = severityFor(sample.status, cluster.category, cluster.count, minCount);
  const component = componentFor(sample.scenario, sample.tool);
  const labels = ['atlas:triage', `atlas:fp:${fp}`, `severity:${severity}`];
  const body = [
    'Automated telemetry-triage finding. **Structural metadata only** — no prompts,',
    'URLs, coordinates, ids, headers, or Maps content is recorded or reproduced here.',
    '',
    `- **Category:** \`${cluster.category}\``,
    `- **Component:** \`${component}\``,
    `- **Status:** ${sample.status}`,
    `- **Occurrences (window):** ${cluster.count}`,
    `- **Distinct variants:** ${cluster.fingerprints.length}`,
    `- **Severity:** ${severity}`,
    `- **Fingerprint (dedup key):** \`${fp}\``,
    '',
    'Replay fixture (content-free):',
    '```json',
    JSON.stringify(buildReplayFixture(sample), null, 2),
    '```',
    '',
    `_Deduped by the \`atlas:fp:${fp}\` label — recurrences comment on this issue instead of opening a new one._`,
  ].join('\n');
  return {
    fingerprint: fp,
    category: cluster.category,
    scenario: sample.scenario,
    tool: sample.tool,
    status: sample.status,
    count: cluster.count,
    variants: cluster.fingerprints.length,
    severity,
    component,
    title: `[triage] ${cluster.category} — ${cluster.count}× (${severity})`,
    body,
    labels,
  };
}

/**
 * Reduce sanitized records → { report, proposals, dropped }. Only ERROR clusters
 * at or above `minCount` become proposals (ok/running clusters are not failures);
 * error clusters below the threshold are reported in `dropped` so nothing is
 * silently truncated. Proposals are ordered most-frequent first.
 */
export function buildTriage(records: SanitizedDiagnostic[], opts: { minCount?: number } = {}): TriageResult {
  const minCount = opts.minCount ?? DEFAULT_MIN_COUNT;
  const report = buildTelemetryReport(records);

  // Representative sample per category = the highest-count deduped entry in it
  // (report.deduped is already sorted by count desc, so first-seen wins).
  const sampleByCategory = new Map<string, SanitizedDiagnostic>();
  for (const d of report.deduped) {
    if (!sampleByCategory.has(d.sample.category)) sampleByCategory.set(d.sample.category, d.sample);
  }

  const proposals: IssueProposal[] = [];
  const dropped: { category: string; count: number }[] = [];
  for (const c of report.clusters) {
    const sample = sampleByCategory.get(c.category);
    if (!sample || sample.status !== 'error') continue; // only failures are issues
    if (c.count < minCount) {
      dropped.push({ category: c.category, count: c.count });
      continue;
    }
    proposals.push(classifyCluster(c, sample, minCount));
  }
  return { report, proposals, dropped };
}
