import { describe, expect, it } from 'vitest';
import { parseLogEntries, buildTriage, classifyCluster } from './triage';
import { fingerprint, type SanitizedDiagnostic } from './telemetry';

/** Wrap a payload the way `gcloud logging read --format=json` does. */
const entry = (jsonPayload: unknown) => ({ jsonPayload, resource: { type: 'cloud_run_revision' } });

const proxyLine = (category: string, tsBucket = 1_700_000_040_000) =>
  entry({ evt: 'proxy', scenario: 'proxy', tool: 'ai', status: 'error', category, detailLabels: [], tsBucket, at: 'x' });

const clientBatch = (records: unknown[]) => entry({ evt: 'diag_batch', records, at: 'x' });

const rec = (over: Partial<SanitizedDiagnostic> = {}): SanitizedDiagnostic => ({
  scenario: 'adstudio',
  tool: 'generate_ad_creatives',
  status: 'error',
  category: 'error:generate_ad_creatives',
  detailLabels: ['Business'],
  tsBucket: 1_700_000_040_000,
  ...over,
});

describe('parseLogEntries', () => {
  it('flattens diag_batch records and proxy lines from a gcloud JSON array', () => {
    const raw = JSON.stringify([clientBatch([rec(), rec()]), proxyLine('proxy:ai:rate_limit')]);
    const out = parseLogEntries(raw);
    expect(out).toHaveLength(3);
    expect(out.filter((r) => r.scenario === 'proxy')).toHaveLength(1);
  });

  it('accepts NDJSON and ignores unknown evts / non-JSON banner lines', () => {
    const raw = [
      'Atlas server listening on :8080',
      JSON.stringify({ evt: 'proxy', ...rec({ scenario: 'proxy', tool: 'gmp', category: 'proxy:gmp:upstream_error' }) }),
      JSON.stringify({ evt: 'something-else', foo: 1 }),
    ].join('\n');
    const out = parseLogEntries(raw);
    expect(out).toHaveLength(1);
    expect(out[0].category).toBe('proxy:gmp:upstream_error');
  });

  it('drops malformed records (missing/typed-wrong fields)', () => {
    const raw = JSON.stringify([clientBatch([rec(), { scenario: 'x', tool: 'y' }, { evt: 'nope' }])]);
    expect(parseLogEntries(raw)).toHaveLength(1);
  });

  it('returns [] for empty input', () => {
    expect(parseLogEntries('')).toEqual([]);
    expect(parseLogEntries('   ')).toEqual([]);
  });
});

describe('buildTriage', () => {
  it('proposes only error clusters at or above minCount, ordered most-frequent first', () => {
    const records = [
      ...Array.from({ length: 5 }, () => rec()), // error, 5×  → proposed
      ...Array.from({ length: 2 }, () => rec({ tool: 'draft_copy', category: 'error:draft_copy' })), // 2× → dropped
      ...Array.from({ length: 9 }, () =>
        rec({ scenario: 'proxy', tool: 'ai', status: 'error', category: 'proxy:ai:rate_limit', detailLabels: [] }),
      ), // 9× → proposed, first
      rec({ status: 'ok', category: 'ok:generate_ad_creatives' }), // not a failure → ignored
    ];
    const { proposals, dropped } = buildTriage(records, { minCount: 3 });
    expect(proposals.map((p) => p.category)).toEqual(['proxy:ai:rate_limit', 'error:generate_ad_creatives']);
    expect(dropped).toEqual([{ category: 'error:draft_copy', count: 2 }]);
  });

  it('produces stable fingerprints and content-free structural proposals', () => {
    const sample = rec({ scenario: 'proxy', tool: 'ai', category: 'proxy:ai:upstream_error', detailLabels: [] });
    const records = Array.from({ length: 4 }, () => sample);
    const { proposals } = buildTriage(records, { minCount: 3 });
    expect(proposals).toHaveLength(1);
    const p = proposals[0];
    expect(p.fingerprint).toBe(fingerprint(sample));
    expect(p.severity).toBe('high'); // upstream_error is always high
    expect(p.component).toBe('proxy/ai');
    expect(p.labels).toContain(`atlas:fp:${p.fingerprint}`);
    // No content leaks into the proposal body.
    expect(p.body).not.toMatch(/https?:\/\//);
  });

  it('escalates severity to high when count is far above the threshold', () => {
    const records = Array.from({ length: 12 }, () => rec());
    const { proposals } = buildTriage(records, { minCount: 3 });
    expect(proposals[0].severity).toBe('high'); // 12 >= 3*3
  });

  it('marks the report invalid (and never proposes) when a record leaks content', () => {
    // Defense-in-depth: even if a forbidden value slips past the server, the
    // triage report fails loudly instead of filing an issue.
    const leaky = rec({ category: 'http://leak.example' });
    const { report } = buildTriage([leaky, leaky, leaky], { minCount: 1 });
    expect(report.valid).toBe(false);
    expect(report.violations.length).toBeGreaterThan(0);
  });
});

describe('classifyCluster', () => {
  it('is deterministic for a given cluster + sample', () => {
    const sample = rec();
    const cluster = { category: sample.category, count: 4, fingerprints: [fingerprint(sample)] };
    expect(classifyCluster(cluster, sample, 3)).toEqual(classifyCluster(cluster, sample, 3));
  });
});
