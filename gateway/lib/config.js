// Server-only registry for upstream provider credentials. Manifest entries
// may name providers, but env-var names and values never enter public app data.

export const PROVIDER_REGISTRY = Object.freeze({
  strava: Object.freeze({
    clientId: 'STRAVA_CLIENT_ID',
    clientSecret: 'STRAVA_CLIENT_SECRET',
  }),
  isochrones: Object.freeze({
    apiKey: 'GMP_SERVER_API_KEY',
  }),
  gmp: Object.freeze({
    apiKey: 'GMP_SERVER_API_KEY',
  }),
  resend: Object.freeze({
    apiKey: 'RESEND_API_KEY',
    toEmail: 'CONTACT_TO_EMAIL',
    fromEmail: 'CONTACT_FROM_EMAIL',
    segmentId: 'RESEND_SEGMENT_ID',
    topicId: 'RESEND_TOPIC_ID',
  }),
  gemini: Object.freeze({
    apiKey: 'GEMINI_API_KEY',
  }),
});

export function isKnownProvider(name) {
  return Object.hasOwn(PROVIDER_REGISTRY, name);
}

export function resolveProvider(name, env = process.env) {
  const fields = PROVIDER_REGISTRY[name];
  if (!fields) throw new Error(`Unknown gateway provider: ${name}`);
  return Object.fromEntries(
    Object.entries(fields).map(([field, envVar]) => [field, env[envVar] || '']),
  );
}
