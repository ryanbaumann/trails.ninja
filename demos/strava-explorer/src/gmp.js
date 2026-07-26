// strava-explorer/src/gmp.js

import { initializeFollowCamera, registerPhotoTriggers, setPhotoTriggerCallback } from './followCamera.js';
import { debug, warn, error } from './log.js';
import { toLatLngLiteral } from './latlng.js';
import { DEFAULT_ALTITUDE_M, haversineKm, downsamplePath } from './geo.js';
import { groupPhotosByProximity } from './photos.js';
import { proxiedPhotoUrl } from './photoUrl.js';
import { activityMarkerSvg, sportDescriptor } from './activityIcons.js';

// --- Module-Level Variables ---
let map3d = null;
let elevator = null;
let previousPolyline = null;
let routeMarkers = [];
let photoMarkers = new Map(); // Stores { marker, popover } pairs, key = photo.unique_id
let trackingMarker = null;
let trackingMarkerSport = null; // Sport key the current tracking marker artwork was built for
let riderSportKey = 'default';
let photoLoadSessionId = 0;
let mapReadyPromise = null;
let defaultOrbitActive = false;

// GMP Class variables (populated in initMap)
let Map3DElement, Marker3DElement, Marker3DInteractiveElement, Polyline3DElement, AltitudeMode, MapMode, PinElement, PopoverElement;
let CollisionBehavior;
let ElevationService;
let LatLng, LatLngBounds, encoding;

// --- Helper Functions ---
let showLoading = (isLoading, text) => debug(`Loading: ${isLoading}, Text: ${text}`);
let showError = (message) => error(`Error: ${message}`);
const PHOTO_PROXY_BASE_URL = (import.meta.env.VITE_STRAVA_AUTH_BASE_URL || '').replace(/\/$/, '');
const MAP_LOAD_TIMEOUT_MS = 15_000;

// Function to set helper dependencies (called from index.js)
export function setHelpers(helpers) {
    showLoading = helpers.showLoading;
    showError = helpers.showError;
}

async function loadGoogleMapsApi(apiKey, libraries) {
    const GoogleMapsLoader = await import('@googlemaps/js-api-loader');
    const loaderModule = GoogleMapsLoader.default ?? GoogleMapsLoader;

    if (typeof GoogleMapsLoader.setOptions === 'function' && typeof GoogleMapsLoader.importLibrary === 'function') {
        GoogleMapsLoader.setOptions({
            key: apiKey,
            v: 'beta',
            libraries,
            internalUsageAttributionIds: ['gmp_git_agentskills_v1']
        });
        return GoogleMapsLoader.importLibrary;
    }

    // Compatibility path for @googlemaps/js-api-loader v1.x in existing installs.
    // v2.x exposes setOptions/importLibrary and package.json targets that path.
    const LoaderClass = GoogleMapsLoader.Loader ?? loaderModule.Loader;
    const loader = new LoaderClass({
        apiKey,
        version: 'beta',
        libraries,
        internalUsageAttributionIds: ['gmp_git_agentskills_v1']
    });
    await loader.load();
    return google.maps.importLibrary.bind(google.maps);
}

async function loadGoogleMapsLibraries(apiKey, libraries) {
    const importLibrary = await loadGoogleMapsApi(apiKey, libraries);
    return Promise.all([
        importLibrary("maps3d"),
        importLibrary("marker"),
        importLibrary("elevation"),
        importLibrary("core"),
        importLibrary("geometry"),
    ]);
}

function withMapLoadTimeout(promise) {
    let timeoutId;
    const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error("Google Maps did not finish loading within 15 seconds. Check your connection, then reload to try again."));
        }, MAP_LOAD_TIMEOUT_MS);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

// --- Map Initialization ---
export async function initMap(mapHostElement, apiKey) {
    if (!mapHostElement) throw new Error("Map host element is required.");
    if (!apiKey) throw new Error("Google Maps API Key is required.");

    showLoading(true, "Loading Google Maps...");
    const libraries = ["maps3d", "marker", "elevation", "geometry", "core"];

    try {
        const [maps3dLibrary, markerLibrary, elevationLibrary, coreLibrary, geometryLibrary] = await withMapLoadTimeout(
            loadGoogleMapsLibraries(apiKey, libraries)
        );
        debug("Google Maps API loaded.");

        // Import necessary classes *after* API is loaded
        ({ Map3DElement, Marker3DElement, Marker3DInteractiveElement, Polyline3DElement, AltitudeMode, MapMode, PopoverElement } = maps3dLibrary);
        ({ PinElement, CollisionBehavior } = markerLibrary); // CollisionBehavior keeps route markers from being culled by basemap labels
        ({ ElevationService } = elevationLibrary);
        ({ LatLng, LatLngBounds } = coreLibrary);
        ({ encoding } = geometryLibrary);

        // Instantiate services
        elevator = new ElevationService();

        // Instantiate the 3D Map
        map3d = new Map3DElement({
            center: { lat: 32.6141, lng: -114.34411, altitude: 1000000 }, // Start high up
            range: 1000000, // Wide initial range
            tilt: 0, // Start looking straight down
            heading: 0,
            mode: MapMode.HYBRID, // Or SATELLITE
            defaultUIHidden: true, // Hide default controls; app provides custom accessible controls
        });
        mapHostElement.appendChild(map3d);
        debug("3D Map initialized.");

        // E3: Listen for gmp-error to show error notices
        map3d.addEventListener('gmp-error', (e) => {
            error("Map3DElement error:", e);
            showError("Google Maps 3D error. Your browser or hardware may not support Photorealistic 3D Maps.");
        });

        // E3: Listen for gmp-steadystate event before triggering route flights
        mapReadyPromise = new Promise((resolve) => {
            map3d.addEventListener('gmp-steadystate', () => {
                debug("Map reached initial steady state.");
                resolve();
            }, { once: true });
        });

        // Initialize Follow Camera module after map and dependencies are ready
        // Pass the module-level showError and updateTrackingMarker
        initializeFollowCamera(map3d, showError, updateTrackingMarker);

        setPhotoTriggerCallback((photoId, shouldOpen) => {
            if (shouldOpen) {
                // Close all other popovers to prevent visual clutter
                photoMarkers.forEach(({ popover: otherPopover }, key) => {
                    if (key !== photoId) {
                        otherPopover.open = false;
                    }
                });
            }
            const refs = photoMarkers.get(photoId);
            if (refs && refs.popover) {
                refs.popover.open = shouldOpen;
            }
        });

        showLoading(false);
        return map3d; // Return the map instance

    } catch (errorObj) {
        error("Map Initialization failed:", errorObj);
        showError(`Map initialization failed: ${errorObj.message}. Check API key or network connection.`);
        showLoading(false);
        throw errorObj; // Re-throw
    }
}

// --- Elevation Helpers ---
export async function getClientElevation(latLng) { // latLng = { lat: number, lng: number }
    if (!elevator) {
        warn("ElevationService not initialized.");
        return DEFAULT_ALTITUDE_M; // Default elevation
    }
    try {
        const { results } = await elevator.getElevationForLocations({ locations: [latLng] });
        return results?.[0]?.elevation ?? DEFAULT_ALTITUDE_M; // Return elevation or default
    } catch (e) {
        error("Elevation lookup failed:", e);
        showError(`Elevation lookup error: ${e.message}`);
        return DEFAULT_ALTITUDE_M; // Default on error
    }
}

export async function getElevationsForPoints(locations) { // locations = [{ lat, lng }, ...]
    if (!elevator || locations.length === 0) return locations.map(() => DEFAULT_ALTITUDE_M); // Default if no service/locations
    const batchSize = 200; // API limit often around 512, use smaller batches
    let allElevations = [];
    showLoading(true, `Fetching ${locations.length} elevations...`);
    try {
        for (let i = 0; i < locations.length; i += batchSize) {
            const batchLocations = locations.slice(i, i + batchSize);
            const { results } = await elevator.getElevationForLocations({ locations: batchLocations });
            const elevations = results.map(result => result?.elevation ?? DEFAULT_ALTITUDE_M); // Default to fallback if null
            allElevations.push(...elevations);
        }
    } catch (e) {
        error(`Elevation fetch error:`, e);
        showError(`Elevation fetch error: ${e.message}`);
        // Fill remaining with default if error occurred mid-batch
        const remaining = locations.length - allElevations.length;
        if (remaining > 0) {
            allElevations.push(...Array(remaining).fill(DEFAULT_ALTITUDE_M));
        }
    } finally {
        showLoading(false);
    }
    return allElevations;
}

// --- Camera Helper ---
export async function flyToLocation(targetCoords, range = 1000, tilt = 60, heading = 0, duration = 1500) {
    if (!map3d || !targetCoords) return;
    // Ensure targetCoords has altitude if not provided
    const centerWithAltitude = {
        lat: targetCoords.lat,
        lng: targetCoords.lng,
        altitude: targetCoords.altitude ?? await getClientElevation(targetCoords) // Fetch if missing
    };

    const endCamera = { center: centerWithAltitude, range, tilt, heading };
    try {
        showLoading(true, "Moving camera...");
        await map3d.flyCameraTo({ endCamera, durationMillis: duration });
    } catch (errorObj) {
        if (errorObj.name === 'AbortError' || errorObj.message?.includes('interrupted')) {
           debug("Camera animation interrupted.");
        } else {
            error("flyCameraTo error:", errorObj);
            showError(`Camera movement error: ${errorObj.message}`);
        }
    } finally {
        showLoading(false);
    }
}

export async function frameRoute(decodedPathLatLng, options = {}) {
    // E3: Wait for map initial steady state if promise exists (with a 500ms timeout fallback)
    if (mapReadyPromise) {
        await Promise.race([
            mapReadyPromise,
            new Promise((resolve) => setTimeout(resolve, 500))
        ]);
    }

    if (!decodedPathLatLng || decodedPathLatLng.length === 0) return;
    const LatLngBoundsClass = LatLngBounds;
    const bounds = new LatLngBoundsClass();
    decodedPathLatLng.forEach((point) => bounds.extend(point));
    if (bounds.isEmpty()) return;

    const center = bounds.getCenter().toJSON();
    const ne = bounds.getNorthEast().toJSON();
    const sw = bounds.getSouthWest().toJSON();
    let diagonalDistance = 5000;
    if (google?.maps?.geometry?.spherical && LatLng) {
        diagonalDistance = google.maps.geometry.spherical.computeDistanceBetween(
            new LatLng(ne.lat, ne.lng),
            new LatLng(sw.lat, sw.lng)
        );
    }
    const range = Math.max(900, diagonalDistance * (options.rangeMultiplier ?? 1.45));
    await flyToLocation(center, range, options.tilt ?? 62, options.heading ?? 0, options.duration ?? 1400);
}

export async function flyToRoutePoint(decodedPathLatLng, routePoint = 'start') {
    if (!decodedPathLatLng || decodedPathLatLng.length === 0) return;
    const point = routePoint === 'finish' ? decodedPathLatLng[decodedPathLatLng.length - 1] : decodedPathLatLng[0];
    const heading = routePoint === 'finish' ? (map3d?.heading ?? 0) + 180 : map3d?.heading ?? 0;
    await flyToLocation(point.toJSON(), 650, 72, heading, 1200);
}

export async function orbitCurrentView(duration = 9000) {
    if (!map3d?.flyCameraAround) return;
    try {
        showLoading(true, 'Orbiting route...');
        await map3d.flyCameraAround({ camera: { center: map3d.center, range: map3d.range, tilt: Math.max(map3d.tilt ?? 65, 65), heading: map3d.heading ?? 0 }, durationMillis: duration, repeatCount: 1 });
    } catch (errorObj) {
        if (!(errorObj.name === 'AbortError' || errorObj.message?.includes('interrupted'))) {
            error('flyCameraAround error:', errorObj);
            showError(`Camera orbit error: ${errorObj.message}`);
        }
    } finally {
        showLoading(false);
    }
}

// --- Polyline Handling ---
export function decodePolyline(polylineString) {
    if (polylineString && polylineString.startsWith('demo:')) {
        try {
            const dataStr = polylineString.substring(5);
            return JSON.parse(dataStr);
        } catch (e) {
            error("Failed to parse demo polyline points:", e);
            return [];
        }
    }
    if (!encoding) {
        showError("Geometry library (encoding) not loaded.");
        return [];
    }
    if (!polylineString || typeof polylineString !== 'string' || polylineString.trim() === '') {
        showError("Invalid polyline string provided for decoding.");
        return [];
    }
    try {
        const decodedPath = encoding.decodePath(polylineString);
        if (!decodedPath || decodedPath.length === 0) {
            throw new Error("Decoded path is empty or invalid.");
        }
        debug(`Successfully decoded polyline. Path length: ${decodedPath.length}`);
        return decodedPath; // Returns array of LatLng objects
    } catch (e) {
        error("GMP polyline decoding failed:", e);
        showError(`Failed to decode activity route: ${e.message}`);
        return []; // Return empty on error
    }
}

export function displayPolyline(decodedPathLatLng) { // Expects array of LatLng objects
    if (!map3d || !Polyline3DElement || !AltitudeMode) {
        showError("Map or necessary 3D components not ready for polyline.");
        return null;
    }
    if (!decodedPathLatLng || decodedPathLatLng.length === 0) {
        showError("Cannot display empty or invalid polyline path.");
        return null;
    }

    debug(`[displayPolyline] Displaying polyline with ${decodedPathLatLng.length} points.`);

    // Remove previous polyline
    removePreviousPolyline();
    clearRouteMarkers();

    // Create new 3D Polyline clamped to ground with normalized literals
    const pathLiterals = decodedPathLatLng.map((point) => {
        const literal = toLatLngLiteral(point);
        literal.altitude = Number.isFinite(point.altitude) ? point.altitude : DEFAULT_ALTITUDE_M;
        return literal;
    });

    const routePolyline = new Polyline3DElement({
        path: pathLiterals, // Pass plain LatLngAltitudeLiteral objects
        strokeColor: '#ff4d2e',
        strokeWidth: 14,
        outerColor: '#ffffff',
        outerWidth: 0.65,
        altitudeMode: AltitudeMode.CLAMP_TO_GROUND,
    });

    // Add polyline to map
    map3d.appendChild(routePolyline);
    previousPolyline = routePolyline; // Store reference
    addRouteEndpointMarkers(decodedPathLatLng);
    debug(`[displayPolyline] Appended routePolyline to map.`);
    return routePolyline; // Return the created element
}

// `REQUIRED_AND_HIDES_OPTIONAL` keeps our markers drawn and pushes any colliding
// basemap label out of the way instead of letting the label win. Falls back to
// the literal enum value if the marker library shape ever changes.
function alwaysVisibleCollision() {
    return CollisionBehavior?.REQUIRED_AND_HIDES_OPTIONAL ?? 'REQUIRED_AND_HIDES_OPTIONAL';
}

// Marker3DElement only draws HTMLImageElement, SVGElement, or PinElement from its
// default slot, and SVG has to be wrapped in a <template> before it is appended.
function svgTemplateFromMarkup(svgMarkup) {
    const svgElement = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml').documentElement;
    if (svgElement.nodeName === 'parsererror' || svgElement.querySelector('parsererror')) {
        warn('[svgTemplateFromMarkup] Failed to parse marker SVG.');
        return null;
    }
    const template = document.createElement('template');
    template.content.append(svgElement);
    return template;
}

function addRouteEndpointMarkers(path) {
    if (!map3d || !Marker3DElement || !AltitudeMode || path.length < 2) return;
    const endpoints = [
        { label: 'Start', point: path[0], color: '#22c55e' },
        { label: 'Finish', point: path[path.length - 1], color: '#ef4444' },
    ];
    endpoints.forEach(({ label, point, color }) => {
        const literal = toLatLngLiteral(point);
        const marker = new Marker3DInteractiveElement({
            position: literal,
            altitudeMode: AltitudeMode.CLAMP_TO_GROUND,
            title: `${label} of activity route`,
            label,
            collisionBehavior: alwaysVisibleCollision(),
            collisionPriority: 50,
            drawsWhenOccluded: true,
            zIndex: 50,
        });
        const pin = new PinElement({
            background: color,
            borderColor: color === '#ffffff' ? '#e5e7eb' : '#ffffff',
            glyphColor: '#ffffff',
            scale: 1.0,
        });
        marker.append(pin);
        map3d.append(marker);
        routeMarkers.push(marker);
    });
}

export function clearRouteMarkers() {
    routeMarkers.forEach((marker) => {
        try { map3d?.removeChild(marker); } catch (e) { warn('Error removing route marker', e); }
    });
    routeMarkers = [];
    updateTrackingMarker(null);
}

export function removePreviousPolyline() {
    if (previousPolyline && map3d) {
        try {
            debug(`[removePreviousPolyline] Attempting to remove previous polyline.`);
            map3d.removeChild(previousPolyline);
            debug(`[removePreviousPolyline] Successfully removed previous polyline.`);
        } catch (e) {
            warn("[removePreviousPolyline] Could not remove previous polyline:", e);
        } finally {
             previousPolyline = null;
        }
    }
    clearRouteMarkers();
}

function getMarkerPhotoUrl(imageUrl) {
    return proxiedPhotoUrl(imageUrl, PHOTO_PROXY_BASE_URL);
}

function resizeImageToDataUrl(imageUrl, maxDim = 100, photoCount = 1) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            let targetWidth, targetHeight;
            if (img.width > img.height) {
                targetWidth = maxDim;
                targetHeight = Math.round(maxDim * (img.height / img.width));
            } else {
                targetHeight = maxDim;
                targetWidth = Math.round(maxDim * (img.width / img.height));
            }

            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');
            
            // Draw a white border and background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, targetWidth, targetHeight);
            
            // Draw image inside (inset by 4px for border)
            const border = 4;
            ctx.drawImage(img, border, border, targetWidth - border * 2, targetHeight - border * 2);
            
            if (photoCount > 1) {
                // Draw a badge in the bottom-right corner
                ctx.fillStyle = '#ff4d2e';
                ctx.shadowColor = 'rgba(0,0,0,0.4)';
                ctx.shadowBlur = 4;
                ctx.beginPath();
                ctx.arc(targetWidth - 18, targetHeight - 18, 12, 0, 2 * Math.PI);
                ctx.fill();
                
                // Clear shadow for text
                ctx.shadowBlur = 0;
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 10px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${photoCount}`, targetWidth - 18, targetHeight - 18);
            }
            
            try {
                resolve({
                    dataUrl: canvas.toDataURL('image/jpeg', 0.8),
                    width: targetWidth,
                    height: targetHeight
                });
            } catch (e) {
                warn("Canvas resize failed (CORS):", e);
                resolve({ dataUrl: imageUrl, width: maxDim, height: maxDim }); // Fallback
            }
        };
        img.onerror = () => {
            resolve({ dataUrl: imageUrl, width: maxDim, height: maxDim });
        };
        img.src = imageUrl;
    });
}

const PHOTO_DATE_FORMAT = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

function formatPhotoDate(photo) {
    const raw = photo?.created_at || photo?.created_at_local;
    if (!raw) return '';
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? '' : PHOTO_DATE_FORMAT.format(date);
}

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
}

/**
 * Build the photo popover card: fixed-aspect media frame (no layout shift),
 * skeleton + error states, caption/date meta, and gallery navigation via
 * buttons, dots, arrow keys, and swipe.
 * @returns {{ popover: PopoverElement, dispose: () => void }}
 */
function createPhotoPopover(group) {
    const photos = group.photos;
    const multi = photos.length > 1;

    const popover = new PopoverElement({ open: false });
    popover.style.setProperty('--gmp-popover-max-width', '440px');

    // --- Header ---
    const header = el('div', 'photo-pop-header');
    header.slot = 'header';
    const heading = el('h3', 'photo-pop-title', 'Activity photo');
    const headerRight = el('div', 'photo-pop-header-right');
    const counter = el('span', 'photo-pop-counter');
    if (multi) headerRight.append(counter);

    const closeButton = el('button', 'photo-pop-close');
    closeButton.type = 'button';
    closeButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    closeButton.setAttribute('aria-label', 'Close photo');
    closeButton.addEventListener('click', () => { popover.open = false; });
    headerRight.append(closeButton);
    header.append(heading, headerRight);

    // --- Media frame ---
    const body = el('div', 'photo-pop-body');
    const frame = el('button', 'photo-pop-frame');
    frame.type = 'button';
    frame.setAttribute('aria-label', 'Toggle full photo view');
    const skeleton = el('div', 'photo-pop-skeleton skeleton-shimmer');
    const image = el('img', 'photo-pop-image');
    image.alt = '';
    image.decoding = 'async';
    const failure = el('p', 'photo-pop-failure', 'Photo could not be loaded');
    failure.hidden = true;
    frame.append(skeleton, image, failure);

    image.addEventListener('load', () => { skeleton.hidden = true; failure.hidden = true; image.classList.add('is-loaded'); });
    image.addEventListener('error', () => { skeleton.hidden = true; failure.hidden = false; image.classList.remove('is-loaded'); });
    frame.addEventListener('click', () => {
        const contained = frame.classList.toggle('is-contained');
        frame.setAttribute('aria-pressed', String(contained));
    });

    const caption = el('p', 'photo-pop-caption');
    const meta = el('p', 'photo-pop-meta');
    body.append(frame, caption, meta);

    // --- Gallery navigation ---
    let activeIdx = 0;
    const dots = [];
    let prevButton = null;
    let nextButton = null;

    const show = (idx) => {
        activeIdx = Math.max(0, Math.min(photos.length - 1, idx));
        const photo = photos[activeIdx];
        const rawUrl = photo.urls?.['1000'] || photo.urls?.['600'] || photo.urls?.['100'];

        skeleton.hidden = false;
        failure.hidden = true;
        image.classList.remove('is-loaded');
        image.src = rawUrl ? getMarkerPhotoUrl(rawUrl) : '';
        image.alt = photo.caption
            ? `Activity photo: ${photo.caption}`
            : `Activity photo ${activeIdx + 1} of ${photos.length}`;

        const title = photo.caption?.trim();
        heading.textContent = title || (multi ? `Photo ${activeIdx + 1}` : 'Activity photo');
        caption.textContent = title || '';
        caption.hidden = !title;
        meta.textContent = formatPhotoDate(photo);
        meta.hidden = meta.textContent === '';
        counter.textContent = `${activeIdx + 1} / ${photos.length}`;

        if (multi) {
            prevButton.disabled = activeIdx === 0;
            nextButton.disabled = activeIdx === photos.length - 1;
            dots.forEach((dot, i) => {
                dot.classList.toggle('is-active', i === activeIdx);
                dot.setAttribute('aria-current', i === activeIdx ? 'true' : 'false');
            });
            // Warm the neighbours so paging feels instant.
            [activeIdx - 1, activeIdx + 1].forEach((i) => {
                const neighbour = photos[i];
                const url = neighbour?.urls?.['1000'] || neighbour?.urls?.['600'];
                if (url) new Image().src = getMarkerPhotoUrl(url);
            });
        }
    };

    let onKeyDown = null;
    if (multi) {
        const nav = el('div', 'photo-pop-nav');
        prevButton = el('button', 'photo-pop-nav-btn');
        prevButton.type = 'button';
        prevButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>';
        prevButton.setAttribute('aria-label', 'Previous photo');
        prevButton.addEventListener('click', () => show(activeIdx - 1));

        nextButton = el('button', 'photo-pop-nav-btn');
        nextButton.type = 'button';
        nextButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>';
        nextButton.setAttribute('aria-label', 'Next photo');
        nextButton.addEventListener('click', () => show(activeIdx + 1));

        const dotRow = el('div', 'photo-pop-dots');
        dotRow.setAttribute('role', 'tablist');
        dotRow.setAttribute('aria-label', 'Photos at this spot');
        photos.forEach((_, i) => {
            const dot = el('button', 'photo-pop-dot');
            dot.type = 'button';
            dot.setAttribute('aria-label', `Photo ${i + 1} of ${photos.length}`);
            dot.addEventListener('click', () => show(i));
            dots.push(dot);
            dotRow.append(dot);
        });

        nav.append(prevButton, dotRow, nextButton);
        body.append(nav);

        // Swipe paging on touch devices.
        let touchStartX = null;
        frame.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].clientX; }, { passive: true });
        frame.addEventListener('touchend', (e) => {
            if (touchStartX === null) return;
            const deltaX = e.changedTouches[0].clientX - touchStartX;
            touchStartX = null;
            if (Math.abs(deltaX) > 40) show(activeIdx + (deltaX < 0 ? 1 : -1));
        }, { passive: true });

        onKeyDown = (e) => {
            if (!popover.open) return;
            if (e.key === 'ArrowRight') { e.preventDefault(); show(activeIdx + 1); }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); show(activeIdx - 1); }
        };
        document.addEventListener('keydown', onKeyDown);
    }

    popover.append(header);
    popover.append(body);
    show(0);

    return {
        popover,
        dispose: () => {
            if (onKeyDown) document.removeEventListener('keydown', onKeyDown);
        },
    };
}

export async function displayPhotoMarkers(photosData) { // photosData = array from Strava API
    if (!map3d || !Marker3DInteractiveElement || !PopoverElement || !AltitudeMode) {
        showError("Map or necessary 3D components not ready for photo markers.");
        return;
    }

    // Cleanup previous markers and popovers
    clearPhotoMarkers();

    if (!photosData || photosData.length === 0) {
        debug("No photos data provided to display.");
        return;
    }

    // Increment session ID to cancel any active loads
    photoLoadSessionId++;
    const currentSession = photoLoadSessionId;

    showLoading(true, `Processing ${photosData.length} photos...`);
    try {
        const photoGroups = groupPhotosByProximity(photosData, haversineKm);

        if (photoGroups.length === 0) {
            debug("No valid locations found in photo data.");
            showLoading(false);
            return;
        }

        debug(`[displayPhotoMarkers] Grouped photos into ${photoGroups.length} spatial clusters.`);

        // Register trigger positions in the follow camera module
        registerPhotoTriggers(photoGroups);

        photoGroups.forEach(async (group) => {
            const lat = group.lat;
            const lng = group.lng;
            const primePhoto = group.photos[0];
            const primePhotoId = primePhoto.unique_id;

            const photoUrlToResize = primePhoto.urls?.["600"] || primePhoto.urls?.["1000"] || primePhoto.urls?.["100"];
            if (!photoUrlToResize) return;

            const proxiedUrl = getMarkerPhotoUrl(photoUrlToResize);
            
            // Resize image and draw a photo count badge if group contains multiple overlapping photos
            const resized = await resizeImageToDataUrl(proxiedUrl, 100, group.photos.length);

            // Guard against race conditions (e.g. route changed while loading)
            if (currentSession !== photoLoadSessionId) {
                debug("[displayPhotoMarkers] Discarding loaded photo due to session change.");
                return;
            }

            const { popover, dispose: disposePopover } = createPhotoPopover(group);

            // Create Marker3DInteractiveElement with popover target
            const marker = new Marker3DInteractiveElement({
                position: { lat, lng },
                altitudeMode: AltitudeMode.CLAMP_TO_GROUND,
                title: primePhoto.caption || `Activity photo at this spot`,
                drawsWhenOccluded: true,
                gmpPopoverTargetElement: popover,
                sizePreserved: true,
                collisionBehavior: alwaysVisibleCollision(),
                collisionPriority: 100,
                zIndex: 100,
            });

            // Create custom photo thumbnail with preserved aspect ratio
            const template = document.createElement('template');
            const img = document.createElement('img');
            img.src = resized.dataUrl;
            img.setAttribute('width', resized.width.toString());
            img.setAttribute('height', resized.height.toString());
            img.style.width = `${resized.width}px`;
            img.style.height = `${resized.height}px`;
            img.style.borderRadius = '4px';
            img.style.border = '2px solid #ffffff';
            img.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
            template.content.appendChild(img);
            marker.append(template);

            // Add Click Listener to Marker for camera fly-to
            marker.addEventListener('gmp-click', async () => {
                debug("Clicked Photo Marker:", primePhotoId);
                // Close other open popovers
                photoMarkers.forEach(({ popover: otherPopover }, key) => {
                    if (key !== primePhotoId) {
                        otherPopover.open = false;
                    }
                });
                // Fly closer
                const trueElevation = await getClientElevation({ lat, lng });
                flyToLocation({ lat, lng, altitude: trueElevation + 72 }, 850, 66, map3d.heading, 900);
            });

            // Add Marker and Popover to Map
            map3d.append(marker);
            map3d.append(popover);

            // Store Marker and Popover References (keyed by first photo's ID)
            photoMarkers.set(primePhotoId, { marker, popover, dispose: disposePopover });
            debug(`[displayPhotoMarkers] Appended marker/popover for photo ${primePhotoId}`);
        });

    } catch (errorObj) {
        error("Error processing or displaying photo markers:", errorObj);
        showError(`Failed to display photos: ${errorObj.message}`);
    } finally {
        showLoading(false);
    }
}

export function clearPhotoMarkers() {
    if (photoMarkers.size > 0 && map3d) {
        debug(`[clearPhotoMarkers] Clearing ${photoMarkers.size} photo markers and popovers.`);
        photoMarkers.forEach(({ marker, popover, dispose }) => {
            try { dispose?.(); } catch(e) { warn("Error disposing popover listeners", e); }
            try { map3d.removeChild(marker); } catch(e) { warn("Error removing marker", e); }
            try { map3d.removeChild(popover); } catch(e) { warn("Error removing popover", e); }
        });
        photoMarkers.clear(); // Clear the map
    }
}

export { downsamplePath };

/**
 * Set the sport the rider marker should be drawn for. Accepts a Strava activity
 * object or a raw sport string; the marker is rebuilt on the next update.
 */
export function setRiderActivityType(activity) {
    const { key } = sportDescriptor(activity);
    if (key === riderSportKey) return;
    riderSportKey = key;
    debug(`[setRiderActivityType] Rider marker sport set to "${key}".`);
    disposeTrackingMarker();
}

function disposeTrackingMarker() {
    if (trackingMarker?.parentNode) {
        try { map3d?.removeChild(trackingMarker); } catch (e) { warn('[disposeTrackingMarker] Error removing marker:', e); }
    }
    trackingMarker = null;
    trackingMarkerSport = null;
}

export function updateTrackingMarker(position) {
    if (!map3d || !Marker3DElement || !AltitudeMode) return;

    if (trackingMarker && trackingMarkerSport !== riderSportKey) {
        disposeTrackingMarker();
    }

    if (!trackingMarker) {
        try {
            const { label } = sportDescriptor(riderSportKey);
            trackingMarker = new Marker3DElement({
                altitudeMode: AltitudeMode.RELATIVE_TO_GROUND,
                title: `${label} position on route`,
                extruded: true,
                drawsWhenOccluded: true,
                // The rider must never be culled by basemap labels or other markers.
                collisionBehavior: alwaysVisibleCollision(),
                collisionPriority: 1000,
                // Keep the pin readable at every camera range instead of shrinking with distance.
                sizePreserved: true,
                zIndex: 1000,
            });
            const template = svgTemplateFromMarkup(activityMarkerSvg(riderSportKey));
            if (template) trackingMarker.append(template);
            trackingMarkerSport = riderSportKey;
            debug(`[updateTrackingMarker] Created "${riderSportKey}" rider marker.`);
        } catch (e) {
            error("[updateTrackingMarker] Failed to initialize tracking marker:", e);
            trackingMarker = null;
            return;
        }
    }

    if (!position) {
        if (trackingMarker.parentNode) {
            try {
                map3d.removeChild(trackingMarker);
            } catch (e) {
                warn("[updateTrackingMarker] Error removing marker:", e);
            }
        }
        return;
    }
    
    const literal = toLatLngLiteral(position);
    try {
        trackingMarker.position = { ...literal, altitude: 5 }; // Boost relative to ground directly by 5 meters
        if (!trackingMarker.parentNode) {
            map3d.append(trackingMarker);
        }
    } catch (e) {
        warn("[updateTrackingMarker] Error updating position:", e);
    }
}

export async function startDefaultOrbit() {
    if (!map3d) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        debug("Skipping scenic orbit due to prefers-reduced-motion.");
        return;
    }
    debug("Starting scenic orbit over the Dolomites.");
    defaultOrbitActive = true;
    try {
        const dolomitesCenter = { lat: 46.4312, lng: 11.8512, altitude: 2500 };
        map3d.center = dolomitesCenter;
        map3d.range = 4000;
        map3d.tilt = 60;
        map3d.heading = 0;

        await map3d.flyCameraAround({
            camera: {
                center: dolomitesCenter,
                range: 4000,
                tilt: 60,
                heading: 0
            },
            durationMillis: 60000,
            repeatCount: 99999
        });
    } catch (e) {
        if (!(e.name === 'AbortError' || e.message?.includes('interrupted'))) {
            warn("Default orbit failed or interrupted:", e);
        }
    }
}

export function stopDefaultOrbit() {
    if (!defaultOrbitActive) return;
    defaultOrbitActive = false;
    debug("Stopping scenic orbit.");
    if (map3d?.stopCameraAnimation) {
        try {
            map3d.stopCameraAnimation();
        } catch (e) {
            warn("Failed to stop camera animation:", e);
        }
    }
}
