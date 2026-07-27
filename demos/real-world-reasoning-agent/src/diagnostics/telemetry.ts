/**
 * Privacy-safe session diagnostics (reliability plan §5).
 *
 * The store keeps a bounded log of ToolEvents whose `summary`/`details` can carry
 * Maps content, place names/ids, coordinates, and echoes of the user's prompt.
 * NONE of that may leave the browser. This module turns a raw ToolEvent into a
 * SanitizedDiagnostic that contains ONLY structural metadata (scenario, tool
 * name, status, a derived category, detail LABELS, and a coarse time bucket) —
 * never free text, ids, coordinates, urls, or prompt content — then fingerprints,
 * dedupes, clusters, and builds deterministic replay fixtures from it.
 *
 * Constraints (do not regress): no raw prompts/transcripts/tool data, no Maps
 * content, no identifiers/locations/urls/headers/cookies/credentials. Maps
 * content must never be used for training. Raw (unsanitized) bundles are gated on
 * regional/EEA review and are NOT produced here.
 */

/** The content-bearing shape recorded during a session (mirrors lib/types ToolEvent). */
export interface RawDiagnostic {
  scenario: string;
  name: string;
  status: 'running' | 'ok' | 'error';
  summary?: string;
  details?: { label: string; value?: string; placeId?: string }[];
  ts: number;
}

/** The ONLY shape that may be exported. Structural metadata; no content. */
export interface SanitizedDiagnostic {
  scenario: string;
  tool: string;
  status: 'running' | 'ok' | 'error';
  /** Derived bucket, e.g. "error:generate_ad_creatives" — countable, no content. */
  category: string;
  /** Fixed UI labels only (values dropped). */
  detailLabels: string[];
  /** Minute-resolution bucket, not the exact timestamp (avoids fine-grained correlation). */
  tsBucket: number;
}

/** Time bucket size for tsBucket (coarsen to the minute). */
const TS_BUCKET_MS = 60_000;

/** Patterns that must NEVER appear in exported telemetry (defensive validator). */
const FORBIDDEN = [
  /https?:\/\//i, // urls
  /\bdata:/i, // data urls
  /@[\w.-]+\.[a-z]{2,}/i, // emails
  /-?\d{1,3}\.\d{3,}/, // coordinate-precision floats
  /\{[a-zA-Z][\w.]*\}/, // unresolved a2ui/mustache tokens
  /place[_-]?id/i, // place id labels/values
];

/** Derive a countable category from status + tool. No content. */
export function categorize(d: RawDiagnostic): string {
  return `${d.status}:${d.name}`;
}

/**
 * Strip a raw ToolEvent to structural metadata only. Drops summary, detail
 * values, and place ids entirely; keeps fixed detail labels and coarsens ts.
 */
export function sanitizeDiagnostic(d: RawDiagnostic): SanitizedDiagnostic {
  return {
    scenario: d.scenario,
    tool: d.name,
    status: d.status,
    category: categorize(d),
    detailLabels: (d.details ?? []).map((x) => x.label).filter((l) => typeof l === 'string'),
    tsBucket: Math.floor(d.ts / TS_BUCKET_MS) * TS_BUCKET_MS,
  };
}

/**
 * Assert a sanitized record carries no forbidden content. Returns the list of
 * violations (empty = safe). Belt-and-suspenders for item 5 — a label that
 * somehow embeds a url/coord/id is caught before export.
 */
export function validateSanitized(d: SanitizedDiagnostic): string[] {
  const haystack = JSON.stringify(d);
  return FORBIDDEN.filter((re) => re.test(haystack)).map((re) => re.source);
}

/** Deterministic 32-bit FNV-1a hash (no crypto; stable across node/browser). */
export function fingerprint(d: SanitizedDiagnostic): string {
  const key = `${d.scenario}|${d.tool}|${d.status}|${d.category}|${[...d.detailLabels].sort().join(',')}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export interface DedupedDiagnostic {
  fingerprint: string;
  count: number;
  sample: SanitizedDiagnostic;
}

/** Collapse identical (by fingerprint) records into counted representatives. */
export function dedupe(list: SanitizedDiagnostic[]): DedupedDiagnostic[] {
  const map = new Map<string, DedupedDiagnostic>();
  for (const d of list) {
    const fp = fingerprint(d);
    const existing = map.get(fp);
    if (existing) existing.count++;
    else map.set(fp, { fingerprint: fp, count: 1, sample: d });
  }
  // Stable order: most frequent first, then fingerprint for determinism.
  return [...map.values()].sort((a, b) => b.count - a.count || a.fingerprint.localeCompare(b.fingerprint));
}

export interface DiagnosticCluster {
  category: string;
  count: number;
  fingerprints: string[];
}

/** Group records by category (status:tool) for failure analysis. */
export function cluster(list: SanitizedDiagnostic[]): DiagnosticCluster[] {
  const map = new Map<string, { count: number; fps: Set<string> }>();
  for (const d of list) {
    const c = map.get(d.category) ?? { count: 0, fps: new Set<string>() };
    c.count++;
    c.fps.add(fingerprint(d));
    map.set(d.category, c);
  }
  return [...map.entries()]
    .map(([category, v]) => ({ category, count: v.count, fingerprints: [...v.fps].sort() }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}

export interface ReplayFixture {
  fingerprint: string;
  scenario: string;
  tool: string;
  status: 'running' | 'ok' | 'error';
  category: string;
}

/** Build a deterministic, content-free replay fixture from a sanitized record. */
export function buildReplayFixture(d: SanitizedDiagnostic): ReplayFixture {
  return {
    fingerprint: fingerprint(d),
    scenario: d.scenario,
    tool: d.tool,
    status: d.status,
    category: d.category,
  };
}

/**
 * Bounded in-memory session diagnostics buffer. Records raw events, but only
 * ever EXPORTS the sanitized projection. Oldest entries are dropped past `cap`.
 */
export class DiagnosticsBuffer {
  private buf: RawDiagnostic[] = [];
  constructor(private readonly cap = 200) {}

  record(d: RawDiagnostic): void {
    this.buf.push(d);
    if (this.buf.length > this.cap) this.buf.splice(0, this.buf.length - this.cap);
  }

  get size(): number {
    return this.buf.length;
  }

  /** Sanitized projection — the only thing that may leave the browser. */
  exportSanitized(): SanitizedDiagnostic[] {
    return this.buf.map(sanitizeDiagnostic);
  }

  clear(): void {
    this.buf = [];
  }
}

export interface TelemetryReport {
  total: number;
  valid: boolean;
  violations: { index: number; patterns: string[] }[];
  deduped: DedupedDiagnostic[];
  clusters: DiagnosticCluster[];
  replayFixtures: ReplayFixture[];
}

/**
 * Validate → fingerprint → dedupe → cluster → build replay fixtures. `report.valid`
 * is false if ANY record carries forbidden content, so a leak fails loudly
 * instead of shipping.
 */
export function buildTelemetryReport(list: SanitizedDiagnostic[]): TelemetryReport {
  const violations = list
    .map((d, index) => ({ index, patterns: validateSanitized(d) }))
    .filter((v) => v.patterns.length > 0);
  const deduped = dedupe(list);
  return {
    total: list.length,
    valid: violations.length === 0,
    violations,
    deduped,
    clusters: cluster(list),
    replayFixtures: deduped.map((d) => buildReplayFixture(d.sample)),
  };
}
