/**
 * Pure predicate gating which image URLs the Image/AdCreative catalog
 * components may render. Only https: URLs, data:image/* URLs, and same-origin
 * Namespaced same-origin GMP proxy URLs are allowed — never arbitrary relative paths or other
 * schemes (javascript:, blob: from a foreign origin, etc). Kept dependency-
 * free so it's unit-testable without a DOM.
 */
export function isAllowedImageUrl(url: string): boolean {
  if (!url) return false;
  if (url.startsWith('/api/real-world-reasoning-agent/gmp/')) return true;
  if (url.startsWith('data:image/')) return true;
  if (!url.startsWith('https://')) return false;
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}
