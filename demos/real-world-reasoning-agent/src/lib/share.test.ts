import { describe, expect, it } from 'vitest';
import { buildMissionReplayUrl, buildReplayUrl, cameraReportForUrl, parseMissionShare, REPLAY_PROMPT_MAX, scrubReplayParams } from './share';

describe('cameraReportForUrl', () => {
  const report = { lat: 12.34, lng: 56.78, zoom: 13 };

  it('suppresses camera coordinates while exact user-location URL sync is disabled', () => {
    expect(cameraReportForUrl(false, report)).toBeNull();
  });

  it('preserves ordinary shareable camera reports', () => {
    expect(cameraReportForUrl(true, report)).toBe(report);
  });
});

describe('scrubReplayParams', () => {
  it('removes the raw prompt but keeps non-sensitive params', () => {
    expect(scrubReplayParams('?scenario=scout&city=sf&prompt=find%20a%20quiet%20cafe')).toBe('?scenario=scout&city=sf');
  });

  it('removes the mission blob (its goal is user content)', () => {
    expect(scrubReplayParams('?mission=eyJnb2FsIjoi&city=sf')).toBe('?city=sf');
  });

  it('returns empty string when only sensitive params were present', () => {
    expect(scrubReplayParams('?prompt=hello')).toBe('');
  });

  it('returns null when there is nothing sensitive to scrub (skip the history write)', () => {
    expect(scrubReplayParams('?scenario=scout&city=sf')).toBeNull();
    expect(scrubReplayParams('')).toBeNull();
  });
});

describe('buildReplayUrl', () => {
  it('uses the param names the store parses (scenario, city, prompt)', () => {
    const url = new URL(buildReplayUrl({ scenario: 'scout', cityId: 'sf', prompt: 'hello' }));
    expect(url.searchParams.get('scenario')).toBe('scout');
    expect(url.searchParams.get('city')).toBe('sf');
    expect(url.searchParams.get('prompt')).toBe('hello');
  });

  it('URL-encodes prompts with spaces and special characters', () => {
    const raw = 'Scout the best corner for an espresso bar in North Beach & rank them';
    const url = buildReplayUrl({ scenario: 'scout', cityId: 'sf', prompt: raw });
    // No raw spaces or ampersands leak into the query string...
    expect(url).not.toContain('espresso bar');
    expect(url).toContain('%26'); // '&' inside the prompt is escaped
    // ...and it round-trips back to the original via the same parser the store uses.
    expect(new URL(url).searchParams.get('prompt')).toBe(raw);
    expect(new URLSearchParams(new URL(url).search).get('prompt')).toBe(raw);
  });

  it(`caps the prompt at ${REPLAY_PROMPT_MAX} characters`, () => {
    const long = 'a'.repeat(REPLAY_PROMPT_MAX + 200);
    const prompt = new URL(buildReplayUrl({ scenario: 'concierge', cityId: 'nyc', prompt: long }))
      .searchParams.get('prompt');
    expect(prompt).toHaveLength(REPLAY_PROMPT_MAX);
  });

  it('produces an absolute URL rooted at the origin', () => {
    const url = buildReplayUrl({ scenario: 'cinema', cityId: 'tokyo', prompt: 'fly the tour' });
    expect(() => new URL(url)).not.toThrow();
    expect(url).toMatch(/^https?:\/\//);
  });
});

describe('mission replay payload', () => {
  it('round-trips only application-owned mission inputs and decision rank', () => {
    const url = new URL(buildMissionReplayUrl({
      version: 1,
      goal: 'Find a calm site',
      cityId: 'sf',
      mode: 'demo',
      preferences: { travelModes: ['WALK'], priorities: { access: 90 }, accessibility: [], environmentSensitivities: [], interests: [] },
      decisionRank: 1,
    }));
    const raw = url.searchParams.get('mission')!;
    expect(raw).not.toContain('Find a calm site');
    expect(parseMissionShare(raw)).toMatchObject({ goal: 'Find a calm site', decisionRank: 1 });
    expect(JSON.stringify(parseMissionShare(raw))).not.toMatch(/placeId|photoUri|googleMapsUri/);
  });

  it('rejects malformed and future-version payloads', () => {
    expect(parseMissionShare('not-json')).toBeNull();
    const future = new URL(buildMissionReplayUrl({ version: 1, goal: 'x', cityId: 'sf', mode: 'live', preferences: { travelModes: [], priorities: {}, accessibility: [], environmentSensitivities: [], interests: [] } }));
    const parsed = parseMissionShare(future.searchParams.get('mission')!)!;
    expect(parseMissionShare(btoa(JSON.stringify({ ...parsed, version: 2 })))).toBeNull();
  });
});
