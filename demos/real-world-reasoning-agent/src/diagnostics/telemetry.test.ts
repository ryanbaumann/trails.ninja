import { describe, expect, it } from 'vitest';
import {
  DiagnosticsBuffer,
  buildReplayFixture,
  buildTelemetryReport,
  categorize,
  cluster,
  dedupe,
  fingerprint,
  sanitizeDiagnostic,
  validateSanitized,
  type RawDiagnostic,
} from './telemetry';

const raw = (over: Partial<RawDiagnostic> = {}): RawDiagnostic => ({
  scenario: 'adstudio',
  name: 'generate_ad_creatives',
  status: 'error',
  summary: 'Failed for Blue Bottle Coffee at 37.79557,-122.39374 — see https://maps.google.com/x',
  details: [
    { label: 'Business', value: 'Blue Bottle Coffee', placeId: 'ChIJ-abc123' },
    { label: 'Rating', value: '4.6' },
  ],
  ts: 1_700_000_123_456,
  ...over,
});

describe('sanitizeDiagnostic', () => {
  it('drops summary, detail values, and place ids — keeping only structural metadata', () => {
    const s = sanitizeDiagnostic(raw());
    expect(s).toEqual({
      scenario: 'adstudio',
      tool: 'generate_ad_creatives',
      status: 'error',
      category: 'error:generate_ad_creatives',
      detailLabels: ['Business', 'Rating'],
      tsBucket: Math.floor(1_700_000_123_456 / 60_000) * 60_000,
    });
    // No content-bearing fields survive.
    const json = JSON.stringify(s);
    expect(json).not.toMatch(/Blue Bottle/);
    expect(json).not.toMatch(/ChIJ/);
    expect(json).not.toMatch(/122\.39374/);
    expect(json).not.toMatch(/https?:\/\//);
  });

  it('coarsens the timestamp to the minute (no fine-grained correlation)', () => {
    const s = sanitizeDiagnostic(raw({ ts: 1_700_000_123_999 }));
    expect(s.tsBucket % 60_000).toBe(0);
  });
});

describe('validateSanitized', () => {
  it('passes a clean sanitized record', () => {
    expect(validateSanitized(sanitizeDiagnostic(raw()))).toEqual([]);
  });

  it('flags a record that smuggled a url, coordinate, email, token, or place id in a label', () => {
    const dirty = sanitizeDiagnostic(raw({ details: [{ label: 'https://leak.example' }] }));
    expect(validateSanitized(dirty).length).toBeGreaterThan(0);
    expect(validateSanitized(sanitizeDiagnostic(raw({ details: [{ label: '37.79557,-122.39374' }] }))).length).toBeGreaterThan(0);
    expect(validateSanitized(sanitizeDiagnostic(raw({ details: [{ label: 'ping user@example.com' }] }))).length).toBeGreaterThan(0);
    expect(validateSanitized(sanitizeDiagnostic(raw({ details: [{ label: 'Open {business.name}' }] }))).length).toBeGreaterThan(0);
    expect(validateSanitized(sanitizeDiagnostic(raw({ details: [{ label: 'placeId' }] }))).length).toBeGreaterThan(0);
  });
});

describe('fingerprint', () => {
  it('is stable and independent of timestamp and detail-label order', () => {
    const a = sanitizeDiagnostic(raw({ ts: 1 }));
    const b = sanitizeDiagnostic(raw({ ts: 999_999, details: [{ label: 'Rating' }, { label: 'Business' }] }));
    expect(fingerprint(a)).toBe(fingerprint(b));
  });

  it('differs when the category differs', () => {
    expect(fingerprint(sanitizeDiagnostic(raw({ status: 'ok' })))).not.toBe(
      fingerprint(sanitizeDiagnostic(raw({ status: 'error' }))),
    );
  });
});

describe('dedupe + cluster', () => {
  const list = [raw(), raw(), raw({ name: 'set_campaign_business', status: 'ok', summary: undefined, details: [] })].map(
    sanitizeDiagnostic,
  );

  it('collapses identical records with a count, most-frequent first', () => {
    const d = dedupe(list);
    expect(d).toHaveLength(2);
    expect(d[0].count).toBe(2);
    expect(categorize(raw())).toBe('error:generate_ad_creatives');
  });

  it('groups by category', () => {
    const c = cluster(list);
    expect(c.map((x) => x.category)).toContain('error:generate_ad_creatives');
    expect(c.find((x) => x.category === 'error:generate_ad_creatives')?.count).toBe(2);
  });
});

describe('buildReplayFixture', () => {
  it('is deterministic and content-free', () => {
    const f = buildReplayFixture(sanitizeDiagnostic(raw()));
    expect(f).toEqual({
      fingerprint: fingerprint(sanitizeDiagnostic(raw())),
      scenario: 'adstudio',
      tool: 'generate_ad_creatives',
      status: 'error',
      category: 'error:generate_ad_creatives',
    });
  });
});

describe('DiagnosticsBuffer', () => {
  it('bounds itself to cap, dropping oldest, and only exports sanitized records', () => {
    const buf = new DiagnosticsBuffer(3);
    for (let i = 0; i < 5; i++) buf.record(raw({ ts: i }));
    expect(buf.size).toBe(3);
    const exported = buf.exportSanitized();
    expect(exported).toHaveLength(3);
    for (const e of exported) expect(validateSanitized(e)).toEqual([]);
  });

  it('clear() empties the buffer', () => {
    const buf = new DiagnosticsBuffer();
    buf.record(raw());
    buf.clear();
    expect(buf.size).toBe(0);
  });
});

describe('buildTelemetryReport', () => {
  it('validates, dedupes, clusters, and emits replay fixtures', () => {
    const list = [raw(), raw(), raw({ status: 'ok' })].map(sanitizeDiagnostic);
    const report = buildTelemetryReport(list);
    expect(report.total).toBe(3);
    expect(report.valid).toBe(true);
    expect(report.violations).toEqual([]);
    expect(report.deduped[0].count).toBe(2);
    expect(report.replayFixtures.length).toBe(report.deduped.length);
  });

  it('marks the report invalid when any record carries forbidden content', () => {
    const list = [sanitizeDiagnostic(raw({ details: [{ label: 'https://leak.example' }] }))];
    const report = buildTelemetryReport(list);
    expect(report.valid).toBe(false);
    expect(report.violations[0].index).toBe(0);
  });
});
