const PLACE_DETAILS_STYLE = [
  'width: min(360px, calc(100vw - 64px))',
  'height: min(440px, calc(100vh - 180px))',
  'border: 0',
  'color-scheme: dark',
  'font-family: inherit',
  '--gmp-mat-color-surface: #0f172a',
  '--gmp-mat-color-on-surface: #f8fafc',
  '--gmp-mat-color-on-surface-variant: #94a3b8',
  '--gmp-mat-color-primary: #22d3ee',
].join('; ');

export function createPlaceDetailsContent(place, documentRef = document) {
  const details = documentRef.createElement('gmp-place-details');
  details.setAttribute('internal-usage-attribution-ids', 'gmp_git_agentskills_v1');
  details.setAttribute('aria-label', `Details for ${place.displayName || 'meeting place'}`);
  details.style.cssText = PLACE_DETAILS_STYLE;

  const request = documentRef.createElement('gmp-place-details-place-request');
  request.place = place;
  const content = documentRef.createElement('gmp-place-all-content');
  details.append(request, content);
  return details;
}
