/**
 * Pure predicate gating which video URLs the Video catalog component may render.
 * Mirrors imageGuard: only https: URLs, data:video/* URLs, and same-origin
 * Namespaced same-origin GMP proxy URLs are allowed — never arbitrary relative paths, other schemes
 * (javascript:, blob: from a foreign origin), or non-video data: URLs. Kept
 * dependency-free so it's unit-testable without a DOM.
 */
export function isAllowedVideoUrl(url: string): boolean {
  if (!url) return false;
  if (url.startsWith('/api/real-world-reasoning-agent/gmp/')) return true;
  if (url.startsWith('data:video/')) return true;
  if (!url.startsWith('https://')) return false;
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}
