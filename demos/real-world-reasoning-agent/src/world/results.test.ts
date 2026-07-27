import { describe, expect, it } from 'vitest';
import { createFixtureWorld } from './fixtures';
import { classifyProviderError, fixtureEvidence, isJsonSafe, providerCall, toJsonSafe } from './results';

describe('provider outcomes', () => {
  it.each([
    [{ status: 403 }, 'auth'],
    [{ code: 'RESOURCE_EXHAUSTED' }, 'rate-limit'],
    [{ name: 'AbortError' }, 'cancelled'],
    [{ message: 'deadline exceeded' }, 'timeout'],
    [{ message: 'network unavailable' }, 'unavailable'],
  ] as const)('classifies %j as %s without leaking raw errors', (cause, code) => {
    expect(classifyProviderError(cause)).toMatchObject({ code });
  });

  it('distinguishes success, empty, failure, and cancellation', async () => {
    const evidence = fixtureEvidence();
    await expect(providerCall(evidence, undefined, async () => ['ok'])).resolves.toMatchObject({ status: 'success' });
    await expect(providerCall(evidence, undefined, async () => [], (v) => v.length === 0)).resolves.toMatchObject({ status: 'empty' });
    await expect(providerCall(evidence, undefined, async () => { throw new Error('network unavailable'); })).resolves.toMatchObject({ status: 'failure', error: { code: 'unavailable' } });
    await expect(providerCall(evidence, { cancellation: { aborted: true } }, async () => 'no')).resolves.toMatchObject({ status: 'cancelled' });
  });

  it('returns cancelled without waiting for stalled provider work', async () => {
    let aborted = false;
    let notify: () => void = () => {};
    const cancellation = {
      get aborted() { return aborted; },
      subscribe(listener: () => void) {
        notify = listener;
        return () => { notify = () => {}; };
      },
    };
    const outcome = providerCall(
      fixtureEvidence(),
      { cancellation },
      () => new Promise<string>(() => undefined),
    );
    aborted = true;
    notify();
    await expect(outcome).resolves.toMatchObject({ status: 'cancelled' });
  });

  it('keeps fixture data behind the same provider ports with durable evidence', async () => {
    const world = createFixtureWorld({ places: [{ id: 'p1', name: 'Cafe', location: { lat: 1, lng: 2 } }] });
    const outcome = await world.places.details('p1');
    expect(outcome).toMatchObject({
      status: 'success',
      evidence: {
        providerId: 'deterministic-fixture',
        attributions: [{ label: 'Synthetic test fixture' }],
        limitations: [{ code: 'synthetic' }],
      },
    });
    expect(isJsonSafe(outcome)).toBe(true);
  });

  it('drops optional undefined fields and rejects lossy JSON values', () => {
    expect(toJsonSafe({ kept: 1, omitted: undefined })).toEqual({ kept: 1 });
    expect(isJsonSafe({ value: Number.NaN })).toBe(false);
    expect(isJsonSafe({ callback: () => undefined })).toBe(false);
  });

  it('lets fixtures exercise partial/error outcomes and cancellation', async () => {
    const evidence = fixtureEvidence();
    const world = createFixtureWorld({
      outcomes: {
        placeSearch: {
          status: 'partial',
          value: [{ id: 'p1', name: 'Cafe', location: null }],
          evidence,
          error: { code: 'unavailable', message: 'One shard unavailable.', retryable: true },
        },
      },
    });
    await expect(world.places.searchText({ query: 'cafe' })).resolves.toMatchObject({ status: 'partial' });
    await expect(world.places.searchText(
      { query: 'cafe' },
      { cancellation: { aborted: true } },
    )).resolves.toMatchObject({ status: 'cancelled' });
  });

  it('fails closed when fixture data is not JSON-safe', async () => {
    const world = createFixtureWorld({
      places: [{ id: 'bad', name: 'Bad fixture', location: { lat: Number.NaN, lng: 2 } }],
    });
    await expect(world.places.searchText({ query: 'bad' })).resolves.toMatchObject({
      status: 'failure', error: { code: 'unknown' },
    });
  });
});
