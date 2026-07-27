import type {
  ProviderError,
  ProviderErrorCode,
  ProviderResult,
  WorldEvidence,
  WorldProduct,
} from './contracts';
import type { ProviderCallContext } from './ports';

const ATTRIBUTION = { label: 'Google Maps Platform', uri: 'https://maps.google.com/' } as const;

/** Remove optional undefined object fields and reject values JSON cannot represent faithfully. */
export function toJsonSafe<T>(value: T): T {
  const seen = new Set<object>();
  const visit = (item: unknown, inArray = false): unknown => {
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return item;
    if (typeof item === 'number') {
      if (!Number.isFinite(item)) throw new TypeError('Non-finite numbers are not JSON-safe.');
      return item;
    }
    if (item === undefined && !inArray) return undefined;
    if (typeof item !== 'object' || item === undefined) throw new TypeError('Value is not JSON-safe.');
    if (seen.has(item)) throw new TypeError('Cyclic values are not JSON-safe.');
    seen.add(item);
    const normalized = Array.isArray(item)
      ? item.map((entry) => visit(entry, true))
      : Object.fromEntries(Object.entries(item)
          .filter(([, entry]) => entry !== undefined)
          .map(([key, entry]) => [key, visit(entry)]));
    seen.delete(item);
    return normalized;
  };
  return visit(value) as T;
}

export function isJsonSafe(value: unknown): boolean {
  try {
    toJsonSafe(value);
    return true;
  } catch {
    return false;
  }
}

export function googleEvidence(product: Exclude<WorldProduct, 'fixture'>): WorldEvidence {
  const serverProducts: readonly WorldProduct[] = ['air-quality', 'weather', 'pollen', 'solar', 'environment'];
  return {
    providerId: 'google-maps-platform',
    product,
    attributions: [ATTRIBUTION],
    freshness: {
      kind: product === 'pollen' ? 'forecast' : product === 'solar' ? 'static' : 'live',
      retrievedAt: new Date().toISOString(),
    },
    limitations: [],
    modelContext: 'denied',
    modelImprovement: 'denied',
    credentialMode: serverProducts.includes(product) ? 'server-proxy' : 'browser-sdk',
    regionalTerms: 'provider-location-dependent',
    launchStage: 'product-specific',
    retention: {
      policy: 'provider-product-terms',
      reference: 'Google Maps Platform service-specific terms',
    },
  };
}

export function fixtureEvidence(product: WorldProduct = 'fixture'): WorldEvidence {
  return {
    providerId: 'deterministic-fixture',
    product,
    attributions: [{ label: 'Synthetic test fixture' }],
    freshness: { kind: 'fixture', retrievedAt: '2000-01-01T00:00:00.000Z' },
    limitations: [{ code: 'synthetic', message: 'Not real-world data.' }],
    modelContext: 'allowed',
    modelImprovement: 'denied',
    credentialMode: 'fixture',
    regionalTerms: 'not-applicable',
    launchStage: 'fixture',
    retention: { policy: 'synthetic-only', reference: 'Local deterministic fixture' },
  };
}

export function classifyProviderError(cause: unknown): ProviderError {
  const record = typeof cause === 'object' && cause !== null ? cause as Record<string, unknown> : {};
  const providerCode = String(record.code ?? record.status ?? record.name ?? '').toLowerCase();
  const text = String(record.message ?? cause ?? 'Provider request failed').toLowerCase();
  const haystack = `${providerCode} ${text}`;
  let code: ProviderErrorCode = 'unknown';
  if (/abort|cancel/.test(haystack)) code = 'cancelled';
  else if (/unauth|permission|forbidden|api.?key|401|403/.test(haystack)) code = 'auth';
  else if (/quota|rate|resource.?exhausted|429/.test(haystack)) code = 'rate-limit';
  else if (/timeout|deadline/.test(haystack)) code = 'timeout';
  else if (/invalid|bad.?request|400/.test(haystack)) code = 'invalid-request';
  else if (/unavailable|network|fetch|5\d\d/.test(haystack)) code = 'unavailable';
  return {
    code,
    message: code === 'unknown' ? 'Provider request failed.' : `Provider request failed: ${code}.`,
    retryable: code === 'rate-limit' || code === 'timeout' || code === 'unavailable',
    ...(providerCode ? { providerCode } : {}),
  };
}

export async function providerCall<T>(
  evidence: WorldEvidence,
  context: ProviderCallContext | undefined,
  call: () => Promise<T>,
  isEmpty: (value: T) => boolean = () => false,
): Promise<ProviderResult<T>> {
  if (context?.cancellation?.aborted) return cancelled(evidence);
  try {
    const value = toJsonSafe(await cancellableCall(context, call));
    if (context?.cancellation?.aborted) return cancelled(evidence);
    return isEmpty(value) ? { status: 'empty', evidence } : { status: 'success', value, evidence };
  } catch (cause) {
    const error = classifyProviderError(cause);
    return error.code === 'cancelled'
      ? { status: 'cancelled', error, evidence }
      : { status: 'failure', error, evidence };
  }
}

export async function optionalProviderCall<T>(
  evidence: WorldEvidence,
  context: ProviderCallContext | undefined,
  call: () => Promise<T | undefined>,
): Promise<ProviderResult<T>> {
  if (context?.cancellation?.aborted) return cancelled(evidence);
  try {
    const rawValue = await cancellableCall(context, call);
    const value = rawValue === undefined ? undefined : toJsonSafe(rawValue);
    if (context?.cancellation?.aborted) return cancelled(evidence);
    return value === undefined ? { status: 'empty', evidence } : { status: 'success', value, evidence };
  } catch (cause) {
    const error = classifyProviderError(cause);
    return error.code === 'cancelled'
      ? { status: 'cancelled', error, evidence }
      : { status: 'failure', error, evidence };
  }
}

async function cancellableCall<T>(
  context: ProviderCallContext | undefined,
  call: () => Promise<T>,
): Promise<T> {
  const cancellation = context?.cancellation;
  const subscribe = cancellation?.subscribe;
  if (!subscribe) return call();
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let unsubscribe: () => void = () => {};
    const finish = (complete: () => void) => {
      if (settled) return;
      settled = true;
      unsubscribe();
      complete();
    };
    unsubscribe = subscribe(() =>
      finish(() => reject({ code: 'cancelled', message: 'Provider request was cancelled.' })),
    );
    if (cancellation.aborted) {
      finish(() => reject({ code: 'cancelled', message: 'Provider request was cancelled.' }));
      return;
    }
    call().then(
      (value) => finish(() => resolve(value)),
      (cause) => finish(() => reject(cause)),
    );
  });
}

function cancelled(evidence: WorldEvidence): ProviderResult<never> {
  return {
    status: 'cancelled',
    evidence,
    error: { code: 'cancelled', message: 'Provider request was cancelled.', retryable: false },
  };
}

export function unwrapProviderResult<T>(result: ProviderResult<T>): T | undefined {
  return result.status === 'success' || result.status === 'partial' ? result.value : undefined;
}
