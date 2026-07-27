const ALLOWED_PHOTO_HOSTS = new Set(['places.googleapis.com']);

function isAllowedPhotoHost(hostname: string): boolean {
  return ALLOWED_PHOTO_HOSTS.has(hostname) || hostname === 'googleusercontent.com' || hostname.endsWith('.googleusercontent.com');
}

export function proxiedPlacePhotoUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('/')) return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !isAllowedPhotoHost(parsed.hostname)) return url;
    return `/api/real-world-reasoning-agent/gmp/placephoto?url=${encodeURIComponent(parsed.toString())}`;
  } catch {
    return url;
  }
}
