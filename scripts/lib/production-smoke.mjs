export const SERVER_SECRET_PATTERNS = [
  ['OAuth client secret value', /client_secret["']?\s*[:=]\s*["'][^"'\\\s]{12,}/i],
  ['PEM private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['Stripe-style live secret key', /sk_live_[0-9A-Za-z]+/],
];

export function findServerSecretMarker(text) {
  return SERVER_SECRET_PATTERNS.find(([, pattern]) => pattern.test(text));
}

export function expectedPublicAppNames(apps, rootAppCompatibilityName = '') {
  const rootApps = apps.filter((app) => app.path === '/');
  if (rootAppCompatibilityName && rootApps.length !== 1) {
    throw new Error(`ROOT_APP_COMPAT_NAME requires exactly one public root app, found ${rootApps.length}`);
  }

  return apps
    .map((app) => (rootAppCompatibilityName && app.path === '/' ? rootAppCompatibilityName : app.name))
    .sort();
}
