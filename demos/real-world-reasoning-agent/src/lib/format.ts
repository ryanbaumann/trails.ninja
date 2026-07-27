/** Human distance from meters. */
export function fmtDistance(m: number): string {
  if (!isFinite(m)) return '—';
  if (m < 950) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}

/** Human duration from seconds. */
export function fmtDuration(s: number): string {
  if (!isFinite(s)) return '—';
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

export function fmtPrice(level?: number): string {
  if (level == null) return '';
  return '$'.repeat(Math.max(1, Math.min(4, level + 1)));
}

export function fmtRating(rating?: number, count?: number): string {
  if (rating == null) return '';
  return count ? `${rating.toFixed(1)} (${count.toLocaleString()})` : rating.toFixed(1);
}

export function titleCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
