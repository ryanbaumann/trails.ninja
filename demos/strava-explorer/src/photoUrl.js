export const STRAVA_PHOTO_HOST = 'dgtzuqphqg23d.cloudfront.net';

// Hosts Strava serves athlete avatars from. `profile_medium` is not always on
// the photo CDN: stock avatars still come from the older asset bucket, and a
// social sign-in keeps the provider's CDN. The gateway CSP (gateway/lib/
// staticFiles.js, CSP_STRAVA_DEMO_DIRECTIVES) must list every host here, or a
// signed-in athlete gets an img-src violation instead of their face.
export const STRAVA_AVATAR_HOSTS = Object.freeze([
    'dgtzuqphqg23d.cloudfront.net',
    'd3nn82uaxijpm6.cloudfront.net',
    'dgalywyr863hv.cloudfront.net',
    'graph.facebook.com',
    'lh3.googleusercontent.com',
]);

/**
 * Resolve `athlete.profile_medium` to something safe to put in an <img src>.
 *
 * Strava returns the bare string `avatar/athlete/medium.png` for athletes who
 * never set a picture. Assigning that relative path resolves it against the
 * demo's own origin and 404s, so treat it — and any host the CSP does not
 * allow — as "no avatar" and let the caller fall back to its own placeholder.
 *
 * @param {string|null|undefined} profileUrl
 * @returns {string|null} an absolute https URL, or null when there is none
 */
export function athleteAvatarUrl(profileUrl) {
    if (!profileUrl) return null;
    try {
        const url = new URL(profileUrl);
        if (url.protocol !== 'https:' || url.username || url.password) return null;
        if (url.hostname.endsWith('.cloudfront.net') || url.hostname.endsWith('.googleusercontent.com') || STRAVA_AVATAR_HOSTS.includes(url.hostname)) {
            return url.href;
        }
        return null;
    } catch {
        // Relative value (`avatar/athlete/medium.png`) or otherwise unparseable.
        return null;
    }
}

/**
 * Route supported Strava photos through the broker. An empty broker base is
 * intentional and produces the gateway's same-origin `/api/photo-proxy` URL.
 */
export function proxiedPhotoUrl(imageUrl, brokerBaseUrl = '') {
    if (!imageUrl) return imageUrl;
    try {
        const url = new URL(imageUrl);
        if (url.protocol === 'https:' && !url.username && !url.password
            && (!url.port || url.port === '443') && url.hostname === STRAVA_PHOTO_HOST) {
            const base = String(brokerBaseUrl).replace(/\/$/, '');
            return `${base}/api/photo-proxy?url=${encodeURIComponent(url.href)}`;
        }
    } catch {
        // Preserve unsupported/invalid values for the caller's normal image
        // error handling rather than attempting to proxy arbitrary input.
    }
    return imageUrl;
}
