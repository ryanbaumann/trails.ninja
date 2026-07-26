// strava-explorer/src/activityIcons.js
//
// Sport-aware marker artwork for the 3D rider marker.
//
// The 3D basemap is satellite/hybrid imagery, so every icon is drawn as a
// high-contrast stack: a soft ground shadow, a white halo, a saturated pin
// body with a near-black outline, and a dark glyph on a white disc. That
// reads against grass, rock, snow, water, and asphalt alike.
//
// Marker3DElement only draws HTMLImageElement, SVGElement, or PinElement from
// its default slot, and SVG must be wrapped in a <template>. This module keeps
// the artwork as pure strings so it stays unit-testable; the DOM parsing lives
// in gmp.js.

const SLATE = '#0f172a';

// Glyphs are authored in a 24x24 box, stroked, and inherit `stroke` from the
// wrapping <g>. Keep them stroke-only so one color swap restyles the whole set.
const GLYPHS = {
    bike: `
        <circle cx="5.6" cy="16.4" r="4.1"/>
        <circle cx="18.4" cy="16.4" r="4.1"/>
        <path d="M5.6 16.4h5.1l3.6-7.6 3.9 7.6M10.7 16.4l3.6-7.6M8.6 8.8h3.4M15.6 7.4h3"/>`,
    bikeKnobby: `
        <circle cx="5.6" cy="16.4" r="4.1" stroke-dasharray="2 1.7"/>
        <circle cx="18.4" cy="16.4" r="4.1" stroke-dasharray="2 1.7"/>
        <path d="M5.6 16.4h5.1l3.6-7.6 3.9 7.6M10.7 16.4l3.6-7.6M8.6 8.8h3.4M15.6 7.4h3"/>
        <path d="M1.6 7.4l2.9-3.6 2.2 2.6 2.3-3.2" stroke-width="1.8"/>`,
    bikeGravel: `
        <circle cx="5.6" cy="15.4" r="4.1"/>
        <circle cx="18.4" cy="15.4" r="4.1"/>
        <path d="M5.6 15.4h5.1l3.6-7.6 3.9 7.6M10.7 15.4l3.6-7.6M8.6 7.8h3.4M15.6 6.4h3"/>
        <path d="M2.4 21.2h3M8.4 21.2h3.4M15 21.2h3.2" stroke-width="1.7"/>`,
    bikeBolt: `
        <circle cx="5.6" cy="16.4" r="4.1"/>
        <circle cx="18.4" cy="16.4" r="4.1"/>
        <path d="M5.6 16.4h5.1l3.6-7.6 3.9 7.6M10.7 16.4l3.6-7.6M8.6 8.8h3.4"/>
        <path d="M20.2 1.2l-4.2 4.6h3.1l-3.4 4.4" stroke-width="1.9" stroke-linejoin="miter"/>`,
    runner: `
        <circle cx="15.2" cy="4.4" r="2.2"/>
        <path d="M14.2 8.1l-3.9 3.4 2.8 3.1-1.6 6.6"/>
        <path d="M13.4 10.9l3.9 1.5 2.4-2.2M10.3 11.5L6.4 13.6M13.1 14.6l3.4 2.6 1.3 4.2"/>`,
    runnerTrail: `
        <circle cx="15.4" cy="4.2" r="2.1"/>
        <path d="M14.4 7.8l-3.8 3.3 2.7 3-1.5 5.1"/>
        <path d="M13.6 10.5l3.8 1.5 2.3-2.1M10.6 11.2L6.9 13.2M13.3 14.1l3.3 2.5 1.2 3.4"/>
        <path d="M2.4 21.4l3.6-4.2 2.5 2.8 3.1-4 3.4 5.4" stroke-width="1.6"/>`,
    hiker: `
        <circle cx="12.8" cy="4.4" r="2.2"/>
        <path d="M12.2 8.2v5.2l-2.6 7.8M12.2 13.4l3.2 3.2 1 4.6"/>
        <path d="M12.2 9.6l3 1.6"/>
        <path d="M16 8.8h2.4a1.2 1.2 0 0 1 1.2 1.2v2.6a1.2 1.2 0 0 1-1.2 1.2H16" stroke-width="1.7"/>
        <path d="M6.4 8.4v13" stroke-width="1.7"/>`,
    walker: `
        <circle cx="12.6" cy="4.2" r="2.2"/>
        <path d="M12 8v5.6l-2.6 7.8M12 13.6l3 3 1 4.8M12 9.6l3.4 1.6M11 9.8L7.6 12"/>`,
    skier: `
        <circle cx="14.8" cy="4.2" r="2.1"/>
        <path d="M13.8 7.6l-2.6 4.4 3.4 2.8-.6 3.6"/>
        <path d="M13.4 10.2l4.4 1.2M11.2 12l-4 1.6"/>
        <path d="M3.4 18.4l16-3.6M4.4 21.4l16-3.6" stroke-width="1.7"/>`,
    boarder: `
        <circle cx="14.4" cy="4.4" r="2.1"/>
        <path d="M13.4 7.8l-2.4 4.6 3.6 2.6"/>
        <path d="M13 10.4l4.2 1.4M11.4 12.2L7 13.6"/>
        <path d="M3.6 19.8q8.4-4 16.8-3" stroke-width="1.9"/>`,
    swimmer: `
        <circle cx="7.4" cy="8.4" r="2.2"/>
        <path d="M9 10.6l4 2.2 4.6-4.4"/>
        <path d="M2.4 16.4q2.6-2 5.2 0t5.2 0 5.2 0 4-.4" stroke-width="1.7"/>
        <path d="M2.4 20.4q2.6-2 5.2 0t5.2 0 5.2 0 4-.4" stroke-width="1.7"/>`,
    paddler: `
        <circle cx="12.4" cy="4.6" r="2.1"/>
        <path d="M11.6 8.2v4.6"/>
        <path d="M4.6 6.4l14.8 8.4M4.2 5l1.6 2.8M20 13.4l-1.7 2.8"/>
        <path d="M3.4 20.4q3-2.2 6 0t6 0 5.2-.6" stroke-width="1.7"/>`,
    pulse: `
        <path d="M2.6 12.4h4.2l2.6-6 4 12 2.8-6h5.2" stroke-width="2.2"/>`,
};

// Canonical sport keys -> accent color, glyph, and human label.
// Accent colors are saturated mid-tones chosen to stay legible on imagery.
const SPORTS = {
    ride: { accent: '#6366f1', glyph: 'bike', label: 'Ride' },
    mountainbikeride: { accent: '#a855f7', glyph: 'bikeKnobby', label: 'Mountain bike ride' },
    gravelride: { accent: '#eab308', glyph: 'bikeGravel', label: 'Gravel ride' },
    ebikeride: { accent: '#14b8a6', glyph: 'bikeBolt', label: 'E-bike ride' },
    virtualride: { accent: '#8b5cf6', glyph: 'bike', label: 'Virtual ride' },
    run: { accent: '#06b6d4', glyph: 'runner', label: 'Run' },
    trailrun: { accent: '#f43f5e', glyph: 'runnerTrail', label: 'Trail run' },
    virtualrun: { accent: '#0ea5e9', glyph: 'runner', label: 'Virtual run' },
    hike: { accent: '#f97316', glyph: 'hiker', label: 'Hike' },
    walk: { accent: '#38bdf8', glyph: 'walker', label: 'Walk' },
    alpineski: { accent: '#0ea5e9', glyph: 'skier', label: 'Alpine ski' },
    backcountryski: { accent: '#0284c7', glyph: 'skier', label: 'Backcountry ski' },
    nordicski: { accent: '#22d3ee', glyph: 'skier', label: 'Nordic ski' },
    snowboard: { accent: '#818cf8', glyph: 'boarder', label: 'Snowboard' },
    swim: { accent: '#3b82f6', glyph: 'swimmer', label: 'Swim' },
    watersport: { accent: '#0891b2', glyph: 'paddler', label: 'Water activity' },
    default: { accent: '#6366f1', glyph: 'pulse', label: 'Activity' },
};

// Strava sport_type values that map onto a shared canonical key.
const SPORT_ALIASES = {
    ride: 'ride',
    roadride: 'ride',
    virtualride: 'virtualride',
    mountainbikeride: 'mountainbikeride',
    mtb: 'mountainbikeride',
    emountainbikeride: 'mountainbikeride',
    gravelride: 'gravelride',
    ebikeride: 'ebikeride',
    velomobile: 'ride',
    handcycle: 'ride',
    run: 'run',
    trailrun: 'trailrun',
    virtualrun: 'virtualrun',
    hike: 'hike',
    walk: 'walk',
    snowshoe: 'hike',
    alpineski: 'alpineski',
    backcountryski: 'backcountryski',
    nordicski: 'nordicski',
    rollerski: 'nordicski',
    snowboard: 'snowboard',
    iceskate: 'nordicski',
    swim: 'swim',
    kayaking: 'watersport',
    canoeing: 'watersport',
    rowing: 'watersport',
    virtualrow: 'watersport',
    standuppaddling: 'watersport',
    surfing: 'watersport',
    kitesurf: 'watersport',
    windsurf: 'watersport',
    sail: 'watersport',
};

/**
 * Resolve a Strava activity (or a raw type string) to a canonical sport key.
 * Falls back to the two bundled demo activities, then to 'default'.
 * @param {object|string|null|undefined} activity
 * @returns {string} canonical key present in SPORTS
 */
export function normalizeSportType(activity) {
    if (!activity) return 'default';

    const raw = typeof activity === 'string'
        ? activity
        : activity.sport_type || activity.type || '';
    const key = String(raw).toLowerCase().replace(/[^a-z]/g, '');
    const resolvedKey = SPORT_ALIASES[key] || (SPORTS[key] ? key : null);

    const name = typeof activity === 'object' ? String(activity.name || '') : '';

    // Upgrade generic 'run' or 'ride' when title explicitly mentions trail/mtb/gravel
    if (resolvedKey === 'run' || !resolvedKey) {
        if (/trail/i.test(name)) return 'trailrun';
    }
    if (resolvedKey === 'ride' || !resolvedKey) {
        if (/mtb|mountain/i.test(name)) return 'mountainbikeride';
        if (/gravel/i.test(name)) return 'gravelride';
    }

    if (resolvedKey) return resolvedKey;

    if (/ride|bike|cycling/i.test(name)) return 'ride';
    if (/run|jog/i.test(name)) return 'run';
    if (/hike|trek/i.test(name)) return 'hike';
    if (/walk/i.test(name)) return 'walk';
    if (/ski/i.test(name)) return 'alpineski';
    if (/swim/i.test(name)) return 'swim';

    const id = typeof activity === 'object' ? String(activity.id ?? '') : '';
    if (id === 'demo-alpine-ride') return 'ride';
    if (id === 'demo-coastal-run') return 'run';

    return 'default';
}

/**
 * Descriptive metadata for a sport, used for marker titles and list labels.
 * @param {object|string} activity
 * @returns {{ key: string, accent: string, label: string, emoji: string }}
 */
export function sportDescriptor(activity) {
    const key = normalizeSportType(activity);
    const sport = SPORTS[key] ?? SPORTS.default;
    return { key, accent: sport.accent, label: sport.label, emoji: sportEmoji(key) };
}

/**
 * Emoji used in the activity dropdown, kept in sync with the marker artwork.
 * @param {object|string} activity
 * @returns {string}
 */
export function sportEmoji(activity) {
    const key = normalizeSportType(activity);
    if (key.includes('ride')) return key === 'mountainbikeride' ? '🚵' : '🚴';
    if (key === 'hike') return '🥾';
    if (key === 'walk') return '🚶';
    if (key.includes('ski') || key === 'snowboard') return '⛷️';
    if (key === 'swim') return '🏊';
    if (key === 'watersport') return '🛶';
    if (key.includes('run')) return '🏃';
    return '📍';
}

/**
 * Build the rider marker SVG for a sport.
 * @param {object|string} activity - activity object or raw sport string
 * @param {{ size?: number }} [options] - `size` is the rendered pin width in px
 * @returns {string} standalone SVG markup
 */
export function activityMarkerSvg(activity, options = {}) {
    const key = normalizeSportType(activity);
    const sport = SPORTS[key] ?? SPORTS.default;
    const glyph = GLYPHS[sport.glyph] ?? GLYPHS.pulse;
    const width = Number.isFinite(options.size) ? options.size : 46;
    const height = Math.round(width * (58 / 46));

    // Glyph box is 24x24; scale it to 17px and center it on the 12.2r disc.
    const glyphScale = 17 / 24;
    const glyphOffset = 22 - 17 / 2;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 46 58" role="img" aria-label="${sport.label} position">
  <ellipse cx="23" cy="54.4" rx="7.4" ry="2.6" fill="#020617" opacity="0.38"/>
  <path d="M23 52.6C23 52.6 5.4 33.4 5.4 21.6a17.6 17.6 0 1 1 35.2 0c0 11.8-17.6 31-17.6 31Z" fill="#ffffff" stroke="#ffffff" stroke-width="5.5" stroke-linejoin="round"/>
  <path d="M23 52.6C23 52.6 5.4 33.4 5.4 21.6a17.6 17.6 0 1 1 35.2 0c0 11.8-17.6 31-17.6 31Z" fill="${sport.accent}" stroke="${SLATE}" stroke-width="2" stroke-linejoin="round"/>
  <circle cx="23" cy="21.6" r="12.4" fill="#ffffff" stroke="${SLATE}" stroke-width="1.2" opacity="0.96"/>
  <g transform="translate(${glyphOffset.toFixed(2)} ${(glyphOffset - 0.4).toFixed(2)}) scale(${glyphScale.toFixed(4)})" fill="none" stroke="${SLATE}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${glyph}
  </g>
</svg>`;
}

export const SPORT_KEYS = Object.keys(SPORTS);
