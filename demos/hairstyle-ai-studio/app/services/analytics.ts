const ALLOWED_EVENTS = new Set([
  'key_setup',
  'generation_start',
  'generation_success',
  'generation_failure',
  'generation_cancel',
  'refinement_start',
  'refinement_success',
  'refinement_failure',
]);

export function trackEvent(name: string, params: Record<string, string | number | boolean> = {}) {
  if (!ALLOWED_EVENTS.has(name)) return;
  const gtag = (window as typeof window & { gtag?: (...args: unknown[]) => void }).gtag;
  gtag?.('event', name, params);
}
