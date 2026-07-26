import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import * as geo from '../src/geo.js';
import * as units from '../src/units.js';
import * as urlState from '../src/urlState.js';
import * as photos from '../src/photos.js';
import { proxiedPhotoUrl } from '../src/photoUrl.js';
import * as strava from '../src/strava.js';
import * as icons from '../src/activityIcons.js';

// Setup Mock LocalStorage for Strava tests
const mockLocalStorage = (() => {
    let store = {};
    return {
        getItem(key) {
            return store[key] || null;
        },
        setItem(key, value) {
            store[key] = String(value);
        },
        removeItem(key) {
            delete store[key];
        },
        clear() {
            store = {};
        }
    };
})();

global.localStorage = mockLocalStorage;

describe('src/photoUrl.js', () => {
    const photo = 'https://dgtzuqphqg23d.cloudfront.net/path/photo.jpg?size=600';

    test('uses the same-origin proxy when the broker base is empty', () => {
        expect(proxiedPhotoUrl(photo)).toBe(`/api/photo-proxy?url=${encodeURIComponent(photo)}`);
    });

    test('uses a configured cross-origin broker base', () => {
        expect(proxiedPhotoUrl(photo, 'https://broker.example/')).toBe(
            `https://broker.example/api/photo-proxy?url=${encodeURIComponent(photo)}`,
        );
    });

    test('does not proxy unsupported, insecure, or non-default-port URLs', () => {
        const unsupported = 'https://images.example/photo.jpg';
        const insecure = 'http://dgtzuqphqg23d.cloudfront.net/photo.jpg';
        const customPort = 'https://dgtzuqphqg23d.cloudfront.net:444/photo.jpg';
        expect(proxiedPhotoUrl(unsupported)).toBe(unsupported);
        expect(proxiedPhotoUrl(insecure)).toBe(insecure);
        expect(proxiedPhotoUrl(customPort)).toBe(customPort);
    });
});

describe('src/geo.js', () => {
    test('clamp', () => {
        expect(geo.clamp(5, 1, 10)).toBe(5);
        expect(geo.clamp(-5, 1, 10)).toBe(1);
        expect(geo.clamp(15, 1, 10)).toBe(10);
    });

    test('lerp', () => {
        expect(geo.lerp(10, 20, 0)).toBe(10);
        expect(geo.lerp(10, 20, 0.5)).toBe(15);
        expect(geo.lerp(10, 20, 1)).toBe(20);
        expect(geo.lerp(10, 20, 1.5)).toBe(20); // clamps amt to 1
    });

    test('lerpAngle', () => {
        expect(geo.lerpAngle(0, 90, 0.5)).toBe(45);
        expect(geo.lerpAngle(350, 10, 0.5)).toBe(0); // shortest way is cross 0
        expect(geo.lerpAngle(10, 350, 0.5)).toBe(0);
    });

    test('haversineKm', () => {
        const p1 = { lat: 46.508, lng: 11.838 };
        const p2 = { lat: 46.508, lng: 11.838 };
        expect(geo.haversineKm(p1, p2)).toBe(0);

        const p3 = { lat: 46.538, lng: 11.858 };
        const d = geo.haversineKm(p1, p3);
        expect(d).toBeGreaterThan(3);
        expect(d).toBeLessThan(4);
    });

    test('bearingDeg', () => {
        const p1 = { lat: 0, lng: 0 };
        const p2 = { lat: 1, lng: 0 }; // straight north
        expect(geo.bearingDeg(p1, p2)).toBeCloseTo(0, 1);

        const p3 = { lat: 0, lng: 1 }; // straight east
        expect(geo.bearingDeg(p1, p3)).toBeCloseTo(90, 1);
    });

    test('samplePointAlongLine', () => {
        const coords = [
            { lat: 0, lng: 0, altitude: 10 },
            { lat: 0.1, lng: 0, altitude: 20 },
            { lat: 0.2, lng: 0, altitude: 30 }
        ];

        // 0 distance
        const s0 = geo.samplePointAlongLine(coords, 0);
        expect(s0.point.lat).toBeCloseTo(0);
        expect(s0.point.altitude).toBe(10);

        // halfway to the first segment
        const d1 = geo.haversineKm(coords[0], coords[1]);
        const s1 = geo.samplePointAlongLine(coords, d1 / 2);
        expect(s1.point.lat).toBeCloseTo(0.05);
        expect(s1.point.altitude).toBeCloseTo(15);
    });

    test('downsamplePath', () => {
        const path = Array.from({ length: 10 }, (_, i) => ({ lat: i, lng: i, altitude: i }));
        const downsampled = geo.downsamplePath(path, 3);
        expect(downsampled.length).toBeLessThanOrEqual(5); // should be downsampled
        // verify endpoints kept
        expect(downsampled[0]).toEqual(path[0]);
        expect(downsampled[downsampled.length - 1]).toEqual(path[path.length - 1]);
    });

    test('smoothPath', () => {
        const coords = [
            { lat: 1, lng: 1, altitude: 10 },
            { lat: 2, lng: 2, altitude: 20 },
            { lat: 3, lng: 3, altitude: 30 }
        ];
        const smoothed = geo.smoothPath(coords, 3);
        expect(smoothed.length).toBe(3);
        // Middle one should be average of all three: (1+2+3)/3 = 2, altitude (10+20+30)/3 = 20
        expect(smoothed[1].lat).toBeCloseTo(2);
        expect(smoothed[1].altitude).toBeCloseTo(20);
    });

    test('calculateElevationLoss', () => {
        const alts = [100, 150, 120, 130, 90, 100];
        // losses: 150->120 (-30), 130->90 (-40). Total loss = 70.
        expect(geo.calculateElevationLoss(alts)).toBe(70);
    });
});

describe('src/units.js', () => {
    test('formatDistance', () => {
        // useImperial = true (miles)
        // 1609.344 meters is 1 mile
        expect(units.formatDistance(1609.344, true)).toBe("1.00 mi");
        // useImperial = false (km)
        expect(units.formatDistance(1000, false)).toBe("1.00 km");
    });

    test('formatElevation', () => {
        // useImperial = true (feet)
        // 100 meters * 3.28084 = 328 feet
        expect(units.formatElevation(100, true)).toBe("328 ft");
        // useImperial = false (meters)
        expect(units.formatElevation(100, false)).toBe("100 m");
    });

    test('formatSpeed', () => {
        // useImperial = true (mph)
        // 1 m/s * 2.23694 = 2.2 mph
        expect(units.formatSpeed(1, true)).toBe("2.2 mph");
        // useImperial = false (km/h)
        expect(units.formatSpeed(10, false)).toBe("36.0 km/h");
    });

    test('formatDuration', () => {
        expect(units.formatDuration(3665)).toBe("1:01:05");
        expect(units.formatDuration(45)).toBe("0:00:45");
    });
});

describe('src/urlState.js', () => {
    test('readUrlState', () => {
        const query = '?start_date=2026-01-01&count=25&camera_height=150';
        const parsed = urlState.readUrlState(query);
        expect(parsed.startDate).toBe('2026-01-01');
        expect(parsed.count).toBe(25);
        expect(parsed.cameraHeight).toBe(150);
        expect(parsed.cameraRange).toBeNull();
    });

    test('buildUrlParams', () => {
        const state = {
            startDate: '2026-01-01',
            count: 25,
            cameraHeight: 150,
            activityId: 'demo-123'
        };
        const query = urlState.buildUrlParams(state);
        const params = new URLSearchParams(query);
        expect(params.get('start_date')).toBe('2026-01-01');
        expect(params.get('count')).toBe('25');
        expect(params.get('camera_height')).toBe('150');
        expect(params.get('activity_id')).toBe('demo-123');
    });
});

describe('src/photos.js', () => {
    test('groupPhotosByProximity', () => {
        const mockPhotos = [
            { unique_id: 'p1', location: [40.0, -100.0] },
            { unique_id: 'p2', location: [40.00001, -100.00001] }, // close to p1
            { unique_id: 'p3', location: [41.0, -101.0] }, // far
            { unique_id: 'p4', location: [] } // unlocated
        ];

        // mock distance function: returns 0 if same or super close, 5 otherwise
        const mockDistFn = (a, b) => {
            if (Math.abs(a.lat - b.lat) < 0.01) return 0.001; // 1 meter
            return 5;
        };

        const groups = photos.groupPhotosByProximity(mockPhotos, mockDistFn);
        // should have 2 groups: [p1, p2] and [p3]. p4 is filtered out.
        expect(groups.length).toBe(2);
        expect(groups[0].photos.length).toBe(2);
        expect(groups[1].photos.length).toBe(1);
    });
});

describe('Token Expiration (src/strava.js)', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('isTokenExpiringSoon transitions', () => {
        const nowSec = Math.floor(Date.now() / 1000);
        // set token expiring in 4 minutes (240 seconds) - which is < 5 minutes threshold
        const authData = {
            access_token: 'valid-token',
            refresh_token: 'refresh-token',
            expires_at: nowSec + 240,
            athlete: { id: 12345 }
        };

        localStorage.setItem('trailsNinja.stravaAuth.v1', JSON.stringify(authData));
        strava.getCachedAuthData();

        expect(strava.isTokenExpiringSoon()).toBe(true);

        // set token expiring in 10 minutes (600 seconds) - should not be expiring soon
        const authDataFuture = {
            access_token: 'valid-token',
            refresh_token: 'refresh-token',
            expires_at: nowSec + 600,
            athlete: { id: 12345 }
        };

        localStorage.setItem('trailsNinja.stravaAuth.v1', JSON.stringify(authDataFuture));
        strava.getCachedAuthData();

        expect(strava.isTokenExpiringSoon()).toBe(false);

        // Advance time by 6 minutes (360 seconds) - should now be expiring soon
        vi.advanceTimersByTime(360 * 1000);
        expect(strava.isTokenExpiringSoon()).toBe(true);
    });
});

describe('src/activityIcons.js', () => {
    test('maps Strava sport_type values onto canonical keys', () => {
        expect(icons.normalizeSportType({ sport_type: 'MountainBikeRide' })).toBe('mountainbikeride');
        expect(icons.normalizeSportType({ sport_type: 'TrailRun' })).toBe('trailrun');
        expect(icons.normalizeSportType({ sport_type: 'GravelRide' })).toBe('gravelride');
        expect(icons.normalizeSportType({ sport_type: 'EBikeRide' })).toBe('ebikeride');
        expect(icons.normalizeSportType({ sport_type: 'Snowshoe' })).toBe('hike');
        expect(icons.normalizeSportType({ sport_type: 'Kayaking' })).toBe('watersport');
        expect(icons.normalizeSportType('Run')).toBe('run');
    });

    test('prefers sport_type over the legacy type field', () => {
        expect(icons.normalizeSportType({ type: 'Ride', sport_type: 'MountainBikeRide' })).toBe('mountainbikeride');
        expect(icons.normalizeSportType({ type: 'Ride' })).toBe('ride');
    });

    test('falls back to demo activities and then to default', () => {
        expect(icons.normalizeSportType({ id: 'demo-alpine-ride' })).toBe('ride');
        expect(icons.normalizeSportType({ id: 'demo-coastal-run' })).toBe('run');
        expect(icons.normalizeSportType({ sport_type: 'Curling' })).toBe('default');
        expect(icons.normalizeSportType(null)).toBe('default');
    });

    test('every sport renders a distinct, well-formed marker SVG', () => {
        const rendered = icons.SPORT_KEYS.map((key) => icons.activityMarkerSvg(key));
        rendered.forEach((svg, i) => {
            expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
            expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
            expect(svg).toContain(`aria-label="${icons.sportDescriptor(icons.SPORT_KEYS[i]).label} position"`);
        });
        expect(new Set(rendered).size).toBe(rendered.length);
    });

    test('marker size option scales the viewport, not the viewBox', () => {
        const svg = icons.activityMarkerSvg('hike', { size: 92 });
        expect(svg).toContain('width="92"');
        expect(svg).toContain('height="116"');
        expect(svg).toContain('viewBox="0 0 46 58"');
    });

    test('sport emoji stays in sync with the marker sport', () => {
        expect(icons.sportEmoji({ sport_type: 'MountainBikeRide' })).toBe('🚵');
        expect(icons.sportEmoji({ sport_type: 'Ride' })).toBe('🚴');
        expect(icons.sportEmoji({ sport_type: 'TrailRun' })).toBe('🏃');
        expect(icons.sportEmoji({ sport_type: 'Hike' })).toBe('🥾');
    });
});
