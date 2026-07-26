// strava-explorer/src/followCamera.js

import { debug, error } from './log.js';
import { toLatLngLiteral } from './latlng.js';
import {
    DEFAULT_ALTITUDE_M,
    clamp,
    lerp,
    lerpAngle,
    haversineKm,
    samplePointAlongLine,
    samplePointAlongLineExact,
    calculateCumulativeDistances,
    smoothPath
} from './geo.js';

// --- Module-Level Variables ---
let map3d = null;
let showError = (message) => error(`Error: ${message}`); // Placeholder

// Follow Camera State
let followCameraActive = false; // Is the animation currently running (playing)?
let followCameraTimeoutId = null; // Timeout ID for any delays
let followCameraAnimationId = null; // requestAnimationFrame ID
let followCameraCoords = []; // Coordinates of the current route (plain literals)
let followCameraSourceCoords = null; // The caller's array that produced them (identity only)
let followCameraSamples = []; // Precomputed camera samples (plain literals)
let followCameraBaseDuration = 90000; // Dynamic base duration (ms) for the full tour
let followCameraPathDistance = 0; // Total distance of the path in km
let followCameraCumulativeDistances = null; // Float64Array of cumulative distances for exact snapping
let followCameraSpeedMultiplier = 1.0; // Current speed multiplier

// Tour Configurable Settings
let cameraHeightOffset = 120; // meters of terrain clearance around the path point
let cameraRangeOffset = 760; // meters range
let cameraTiltOffset = 64; // degrees tilt
let cameraSmoothness = 0.18; // LERP factor; higher defaults reduce lag during fly-throughs
let filteredHeading = null;
let lastCameraUpdateTime = null;
let lastTargetAltitude = null;

// Animation Progress variables
let currentProgress = 0; // 0.0 to 1.0 (tour progress)
let lastFrameTime = null; // Timestamp of the last frame

// Callbacks
let onProgressUpdate = null; // function(progress, distanceElapsedKm)
let onPlaybackStateChange = null; // function(state) -> 'playing' | 'paused' | 'stopped'

let updateTrackingMarkerCb = null; // Placeholder
let photoTriggers = []; // Array of { id, distanceKm, triggered, openUntil }
let onPhotoTriggerCb = null; // function(photoId, shouldOpen)

/**
 * Initializes the follow camera module with necessary dependencies.
 */
export function initializeFollowCamera(mapInstance, errorReporter, trackingMarkerUpdater) {
    map3d = mapInstance;
    showError = errorReporter;
    updateTrackingMarkerCb = trackingMarkerUpdater;
    debug("Follow Camera module initialized.");
}

/**
 * Register callbacks for tour status updates.
 */
export function registerTourCallbacks(progressCb, stateCb) {
    onProgressUpdate = progressCb;
    onPlaybackStateChange = stateCb;
}

/**
 * Set tour camera settings.
 */
export function setTourSettings({ height, range, tilt, smoothness }) {
    if (typeof height === 'number') cameraHeightOffset = height;
    if (typeof range === 'number') cameraRangeOffset = range;
    if (typeof tilt === 'number') cameraTiltOffset = tilt;
    if (typeof smoothness === 'number') cameraSmoothness = smoothness;
    
    // If not currently playing, render immediately so user sees the setting change
    if (!followCameraActive && followCameraSamples.length > 0) {
        updateCameraForProgress(currentProgress, true);
    }
}

/**
 * Get current tour settings.
 */
export function getTourSettings() {
    return {
        height: cameraHeightOffset,
        range: cameraRangeOffset,
        tilt: cameraTiltOffset,
        smoothness: cameraSmoothness
    };
}

/**
 * Get current tour stats.
 */
export function getTourState() {
    return {
        active: followCameraActive,
        progress: currentProgress,
        pathDistance: followCameraPathDistance
    };
}

/**
 * Updates the speed multiplier.
 */
export function setFollowCameraSpeed(multiplier) {
    if (typeof multiplier === 'number' && multiplier > 0) {
        followCameraSpeedMultiplier = multiplier;
        debug(`Follow camera speed set to: ${multiplier}x`);
    }
}

// --- Re-export for compatibility with other client modules ---
export function haversineDistance(p1, p2) {
    return haversineKm(toLatLngLiteral(p1), toLatLngLiteral(p2));
}

// --- Helper Functions ---

function analyzeUpcomingTerrain(distanceAlongPath, windowKm = 0.5) {
    const sampleCount = 6;
    let minAlt = Infinity;
    let maxAlt = -Infinity;
    
    for (let i = 0; i <= sampleCount; i++) {
        const dist = distanceAlongPath + (windowKm * (i / sampleCount));
        const sample = samplePointAlongLine(followCameraSamples, clamp(dist, 0, followCameraPathDistance), DEFAULT_ALTITUDE_M);
        if (sample?.point?.altitude != null) {
            minAlt = Math.min(minAlt, sample.point.altitude);
            maxAlt = Math.max(maxAlt, sample.point.altitude);
        }
    }
    
    if (minAlt === Infinity) return { variance: 0, maxAlt: 0 };
    return { variance: Math.max(0, maxAlt - minAlt), maxAlt };
}

function calculateTourDuration(pathDistanceKm) {
    if (!Number.isFinite(pathDistanceKm) || pathDistanceKm <= 0) return 90000;
    // Keep short activities brisk, but give long routes more time so camera ground
    // speed does not become frantic. The duration tops out at five minutes.
    return clamp(75000 + pathDistanceKm * 2500, 75000, 300000);
}

function calculateTerrainClearanceAltitude(distanceAlongPath, fallbackAltitude) {
    const sampleWindowKm = Math.min(0.55, Math.max(0.12, followCameraPathDistance * 0.02));
    const sampleDistances = [
        distanceAlongPath - sampleWindowKm,
        distanceAlongPath,
        distanceAlongPath + sampleWindowKm,
        distanceAlongPath + sampleWindowKm * 2,
        distanceAlongPath + sampleWindowKm * 3
    ];

    let highestTerrainAltitude = fallbackAltitude ?? DEFAULT_ALTITUDE_M;
    sampleDistances.forEach((distanceKm) => {
        const sample = samplePointAlongLine(followCameraSamples, clamp(distanceKm, 0, followCameraPathDistance), DEFAULT_ALTITUDE_M);
        if (sample?.point?.altitude != null) {
            highestTerrainAltitude = Math.max(highestTerrainAltitude, sample.point.altitude);
        }
    });

    return highestTerrainAltitude + cameraHeightOffset;
}

/**
 * Loads a new route's coordinates into the follow camera module.
 * Precomputes the camera samples via a rolling average and calculates path distance.
 */
export async function loadTourRoute(routeCoords) {
    if (!routeCoords || routeCoords.length < 2) return;
    debug("Loading new route coordinates for follow tour...");
    
    // 1. Evaluate coordinates down to absolute primitives to avoid call stack loops
    const baseCoords = routeCoords.map(p => {
        const lit = toLatLngLiteral(p);
        lit.altitude = p.altitude ?? DEFAULT_ALTITUDE_M;
        return lit;
    });

    // 2. Apply a simple rolling average across a window of 15 points (75-meter strike)
    // This organically rounds harsh geometric edges into swooping cinematic curves.
    const smoothedRouteCoords = smoothPath(baseCoords, 15, DEFAULT_ALTITUDE_M);
    
    // 3. Bind the definitive smoothed path to the engine. Keep the caller's
    // array by identity too: playFollowCamera compares against it to decide
    // whether a play is a resume or a genuinely new route.
    followCameraSourceCoords = routeCoords;
    followCameraCoords = smoothedRouteCoords;
    followCameraSamples = smoothedRouteCoords; // Use high-res smoothed array entirely
    
    // 4. Calculate high-fidelity cumulative distances for exact polyline snapping
    followCameraCumulativeDistances = calculateCumulativeDistances(smoothedRouteCoords);
    followCameraPathDistance = followCameraCumulativeDistances[followCameraCumulativeDistances.length - 1] || 0;
    followCameraBaseDuration = calculateTourDuration(followCameraPathDistance);
    
    // Reset photo triggers list
    photoTriggers = [];
    debug(`Follow camera duration set to ${(followCameraBaseDuration / 1000).toFixed(0)}s for ${followCameraPathDistance.toFixed(1)} km (Exact snap array built: ${followCameraCumulativeDistances.length} points).`);
    
    // Smart profile defaults assessment based on terrain and elevation gain
    let globalMinAlt = Infinity;
    let globalMaxAlt = -Infinity;
    followCameraSamples.forEach(p => {
        const alt = p.altitude ?? DEFAULT_ALTITUDE_M;
        globalMinAlt = Math.min(globalMinAlt, alt);
        globalMaxAlt = Math.max(globalMaxAlt, alt);
    });
    const totalElevationGain = Math.max(0, globalMaxAlt - globalMinAlt);
    
    if (totalElevationGain > 450) { // High Alpine Climb
        cameraHeightOffset = 180;
        cameraRangeOffset = 1150;
        cameraTiltOffset = 42;
        debug(`[loadTourRoute] Smart Profile: High Alpine. Gain: ${totalElevationGain.toFixed(0)}m. Set tight tilt and high range.`);
    } else if (totalElevationGain > 120) { // Rolling Hills / Moderate
        cameraHeightOffset = 130;
        cameraRangeOffset = 760;
        cameraTiltOffset = 58;
        debug(`[loadTourRoute] Smart Profile: Rolling Hills. Gain: ${totalElevationGain.toFixed(0)}m.`);
    } else { // Flat Coastal / Urban
        cameraHeightOffset = 85;
        cameraRangeOffset = 460;
        cameraTiltOffset = 68;
        debug(`[loadTourRoute] Smart Profile: Flat Coastal. Gain: ${totalElevationGain.toFixed(0)}m. Set scenic close range.`);
    }
    
    currentProgress = 0;
    filteredHeading = null;
    lastCameraUpdateTime = null;
    lastTargetAltitude = null;
    if (onProgressUpdate) onProgressUpdate(0, 0);
}

/**
 * Clears the currently loaded route coordinates.
 */
export function clearTourRoute() {
    followCameraCoords = [];
    followCameraSourceCoords = null;
    followCameraSamples = [];
    followCameraCumulativeDistances = null;
    followCameraPathDistance = 0;
    currentProgress = 0;
    filteredHeading = null;
    lastCameraUpdateTime = null;
    lastTargetAltitude = null;
    photoTriggers = [];
    if (onProgressUpdate) onProgressUpdate(0, 0);
}

/**
 * Play or resume the tour.
 */
export async function playFollowCamera(routeCoords) {
    if (!map3d) {
        showError("Cannot start follow camera: Map not initialized.");
        return;
    }
    
    // Only reload when this is actually a different route. Comparing against
    // followCameraCoords was always true — loadTourRoute stores a *smoothed
    // copy*, never the caller's array — so every resume re-ran loadTourRoute,
    // which resets currentProgress to 0 and clears photoTriggers. Pausing and
    // hitting play again silently restarted the tour from the trailhead.
    if (routeCoords && (followCameraSourceCoords !== routeCoords || followCameraSamples.length === 0)) {
        await loadTourRoute(routeCoords);
        if (isNaN(followCameraPathDistance) || followCameraPathDistance <= 0) {
            showError("Invalid route distance. Cannot play tour.");
            return;
        }
    }
    
    if (followCameraSamples.length === 0) {
        showError("No route loaded to tour.");
        return;
    }

    if (followCameraActive) return; // Already playing

    debug("Playing follow camera tour.");
    followCameraActive = true;
    lastFrameTime = null; // Reset frame timestamp
    
    // Reset triggers based on current play start distance
    const startDistanceKm = followCameraPathDistance * currentProgress;
    resetPhotoTriggers(startDistanceKm);
    
    // Stop any pending delays
    if (followCameraTimeoutId) {
        clearTimeout(followCameraTimeoutId);
        followCameraTimeoutId = null;
    }
    
    if (onPlaybackStateChange) onPlaybackStateChange('playing');
    
    followCameraAnimationId = window.requestAnimationFrame(frame);
}

/**
 * Pause the tour.
 */
export function pauseFollowCamera() {
    if (!followCameraActive) return;
    debug("Pausing follow camera tour.");
    followCameraActive = false;
    lastFrameTime = null;
    
    if (followCameraAnimationId) {
        window.cancelAnimationFrame(followCameraAnimationId);
        followCameraAnimationId = null;
    }
    
    if (onPlaybackStateChange) onPlaybackStateChange('paused');
}

/**
 * Stop and reset the tour.
 */
export function stopFollowCamera() {
    debug("Stopping and resetting follow camera tour.");
    followCameraActive = false;
    lastFrameTime = null;
    currentProgress = 0; // Reset progress
    
    if (followCameraAnimationId) {
        window.cancelAnimationFrame(followCameraAnimationId);
        followCameraAnimationId = null;
    }
    if (followCameraTimeoutId) {
        clearTimeout(followCameraTimeoutId);
        followCameraTimeoutId = null;
    }
    
    // Return camera to start of route
    if (followCameraSamples.length > 0) {
        updateCameraForProgress(0, true);
    }
    
    resetPhotoTriggers(0);
    
    if (onProgressUpdate) onProgressUpdate(0, 0);
    if (onPlaybackStateChange) onPlaybackStateChange('stopped');
    if (typeof updateTrackingMarkerCb === 'function') {
        updateTrackingMarkerCb(null);
    }
}

/**
 * Scrub/Seek the tour to a specific progress (0.0 to 1.0).
 */
export function setFollowCameraProgress(progress) {
    if (followCameraSamples.length === 0) return;
    currentProgress = Math.max(0, Math.min(1, progress));
    
    // Update camera position snap-to-target immediately (smoothness = 1.0 during scrubbing)
    updateCameraForProgress(currentProgress, true);
    
    const distanceElapsedKm = followCameraPathDistance * currentProgress;
    resetPhotoTriggers(distanceElapsedKm);
    if (onProgressUpdate) onProgressUpdate(currentProgress, distanceElapsedKm);
}

/**
 * The animation frame function.
 */
function frame(time) {
    if (!followCameraActive || !map3d) {
        lastFrameTime = null;
        followCameraAnimationId = null;
        return;
    }

    if (!lastFrameTime) {
        lastFrameTime = time;
        followCameraAnimationId = window.requestAnimationFrame(frame);
        return;
    }

    const deltaTime = time - lastFrameTime;
    lastFrameTime = time;

    // Calculate route-relative progress from a distance-aware duration. The speed
    // multiplier stays sensitive because the base pace is already normalized by route length.
    const progressDelta = (deltaTime * followCameraSpeedMultiplier) / followCameraBaseDuration;
    currentProgress += progressDelta;

    if (currentProgress >= 1) {
        currentProgress = 1;
        followCameraActive = false;
        lastFrameTime = null;
        debug("Follow camera animation finished.");
        
        const distanceElapsedKm = followCameraPathDistance * currentProgress;
        if (onProgressUpdate) onProgressUpdate(currentProgress, distanceElapsedKm);
        if (onPlaybackStateChange) onPlaybackStateChange('stopped');
        return;
    }

    updateCameraForProgress(currentProgress, false);

    const distanceElapsedKm = followCameraPathDistance * currentProgress;
    if (onProgressUpdate) onProgressUpdate(currentProgress, distanceElapsedKm);

    if (followCameraActive) {
        followCameraAnimationId = window.requestAnimationFrame(frame);
    } else {
        followCameraAnimationId = null;
    }
}

/**
 * Update the 3D camera properties based on the progress fraction.
 */
export function updateCameraForProgress(progress, snapDirectly = false) {
    if (!map3d || !followCameraSamples || followCameraSamples.length < 2) return;

    const distanceAlongPath = followCameraPathDistance * progress;
    const alongCoords = samplePointAlongLine(followCameraSamples, distanceAlongPath, DEFAULT_ALTITUDE_M);

    if (!alongCoords || !alongCoords.point) return;

    const upcomingTerrain = analyzeUpcomingTerrain(distanceAlongPath, 0.5);
    const varianceMeters = upcomingTerrain.variance;

    // Aggressive Spatial Elevation Anti-Clipping (Part 1)
    const varianceFactor = clamp(varianceMeters / 150, 0, 1);
    const dynamicHeightBoost = varianceFactor * 150; // Push up to 150m above for steep climbs
    const dynamicRangeBoost = varianceMeters * 12; // Inflate range less aggressively (12x variance instead of 25x)
    const dynamicTiltBoost = varianceFactor * 21; // Lift tilt towards the horizon (up to 85) instead of dropping it to go vertical

    const baseClearance = calculateTerrainClearanceAltitude(distanceAlongPath, alongCoords.point.altitude ?? DEFAULT_ALTITUDE_M);
    const rawTargetAltitude = Math.max(baseClearance, upcomingTerrain.maxAlt + cameraHeightOffset + dynamicHeightBoost);

    // How long since the previous camera update. Every rate below is expressed
    // per second and scaled by this, so a 120 Hz display and a 30 Hz one fly the
    // same route at the same pace — the old per-frame budgets made the camera
    // literally twice as sluggish on a 120 Hz screen.
    const now = performance.now();
    const frameSeconds = (snapDirectly || lastCameraUpdateTime == null)
        ? 0
        : clamp((now - lastCameraUpdateTime) / 1000, 0.001, 0.25);

    // Velocity Slope Clamping (Jank Prevention): the terrain-following target
    // may climb no faster than ~240 m of altitude per second of tour time.
    const maxAltitudeRatePerSecond = 240 * followCameraSpeedMultiplier;
    let targetCameraAltitude = rawTargetAltitude;
    if (lastTargetAltitude !== null && !snapDirectly) {
        const maxAltitudeDelta = maxAltitudeRatePerSecond * frameSeconds;
        const targetDelta = rawTargetAltitude - lastTargetAltitude;
        targetCameraAltitude = lastTargetAltitude + clamp(targetDelta, -maxAltitudeDelta, maxAltitudeDelta);
    }
    lastTargetAltitude = targetCameraAltitude;

    // Cinematic Inertia View (Time-Based 8-second Future Bearing)
    const currentDurationMs = followCameraBaseDuration / followCameraSpeedMultiplier;
    const kmPerMs = followCameraPathDistance / currentDurationMs;
    const lookAheadMs = 8000; 
    const lookAheadDistanceKm = clamp(kmPerMs * lookAheadMs, 0.05, 0.55);

    const lookAheadSample = samplePointAlongLine(
        followCameraSamples,
        Math.min(followCameraPathDistance, distanceAlongPath + lookAheadDistanceKm),
        DEFAULT_ALTITUDE_M
    );
    let smoothedBearing = lookAheadSample ? lookAheadSample.bearing : alongCoords.bearing;

    if (snapDirectly || filteredHeading == null) {
        filteredHeading = smoothedBearing;
    } else {
        // Cap the yaw rate at 95 deg/sec so switchbacks pan instead of snapping.
        const maxTurnDegrees = 95 * frameSeconds;
        const signedDelta = ((((smoothedBearing - filteredHeading) % 360) + 540) % 360) - 180;
        filteredHeading = (filteredHeading + clamp(signedDelta, -maxTurnDegrees, maxTurnDegrees) + 360) % 360;
        smoothedBearing = filteredHeading;
    }
    lastCameraUpdateTime = now;

    // 4. Exact spatial lookup using the Integer Scan on the smoothed points
    const exactPoint = samplePointAlongLineExact(followCameraCoords, followCameraCumulativeDistances, distanceAlongPath, DEFAULT_ALTITUDE_M);
    if (!exactPoint) return;

    const targetCameraPosition = {
        center: { lat: exactPoint.lat, lng: exactPoint.lng, altitude: targetCameraAltitude },
        heading: smoothedBearing,
        range: clamp(cameraRangeOffset + dynamicRangeBoost, 200, 3000), // Max range 3000 instead of 3500
        tilt: clamp(cameraTiltOffset + dynamicTiltBoost, 20, 85), // Boost tilt towards horizon
    };

    // Force the physical camera center to chase the mathematical coordinate using LERP.
    // This provides beautiful "rubber banding" drone inertia even at high playback speeds.
    //
    // cameraSmoothness is authored as "fraction of the remaining gap closed in
    // one 60 Hz frame"; converting it to an exponential decay over the real
    // frame time keeps that feel identical at any refresh rate, and stops a
    // long frame (tile load, tab regaining focus) from leaving the camera
    // behind the marker.
    const perFrameFactor = Math.max(cameraSmoothness, 0.14);
    const factor = snapDirectly
        ? 1.0
        : clamp(1 - Math.pow(1 - perFrameFactor, frameSeconds * 60), 0, 1);

    const currentCamera = {
        center: map3d.center,
        heading: map3d.heading,
        range: map3d.range,
        tilt: map3d.tilt
    };

    const interpolatedCamera = {
        center: {
            lat: lerp(currentCamera.center.lat, targetCameraPosition.center.lat, factor),
            lng: lerp(currentCamera.center.lng, targetCameraPosition.center.lng, factor),
            altitude: lerp(currentCamera.center.altitude, targetCameraPosition.center.altitude, factor)
        },
        heading: lerpAngle(currentCamera.heading, targetCameraPosition.heading, factor),
        range: lerp(currentCamera.range, targetCameraPosition.range, factor),
        tilt: lerp(currentCamera.tilt, targetCameraPosition.tilt, factor)
    };

    if (!isNaN(interpolatedCamera.center.lat) && !isNaN(interpolatedCamera.center.lng) && !isNaN(interpolatedCamera.center.altitude) && !isNaN(interpolatedCamera.heading)) {
        map3d.center = interpolatedCamera.center;
        map3d.heading = interpolatedCamera.heading;
        map3d.range = Math.max(10, interpolatedCamera.range);
        map3d.tilt = clamp(interpolatedCamera.tilt, 0, 85);
    }

    // Synchronize the marker EXACTLY to the high-fidelity route line position
    if (typeof updateTrackingMarkerCb === 'function') {
        updateTrackingMarkerCb({
            lat: exactPoint.lat,
            lng: exactPoint.lng,
            altitude: DEFAULT_ALTITUDE_M
        });
    }

    // Auto popup photo triggers as we fly past them
    const nowMs = performance.now();
    photoTriggers.forEach(t => {
        // If camera has passed the photo location
        if (!t.triggered && distanceAlongPath >= t.distanceKm) {
            t.triggered = true;
            t.openUntil = nowMs + 3000; // Open for exactly 3 seconds
            if (typeof onPhotoTriggerCb === 'function') {
                onPhotoTriggerCb(t.id, true);
            }
        }
        
        // If photo should close
        if (t.triggered && t.openUntil > 0 && nowMs >= t.openUntil) {
            t.openUntil = 0;
            if (typeof onPhotoTriggerCb === 'function') {
                onPhotoTriggerCb(t.id, false);
            }
        }
    });
}

/**
 * Register the callback for auto photo popups
 */
export function setPhotoTriggerCallback(cb) {
    onPhotoTriggerCb = cb;
}

/**
 * Register photo distances along the path to set up the triggers
 */
export function registerPhotoTriggers(photoGroups) {
    if (!followCameraCoords || followCameraCoords.length === 0) return;
    photoTriggers = photoGroups.map(group => {
        const lat = group.lat;
        const lng = group.lng;
        
        let minD = Infinity;
        let closestIdx = 0;
        for (let i = 0; i < followCameraCoords.length; i++) {
            const pt = followCameraCoords[i];
            const d = haversineKm({ lat, lng }, pt);
            if (d < minD) {
                minD = d;
                closestIdx = i;
            }
        }
        
        return {
            id: group.photos[0].unique_id, // Trigger is identified by the first photo's ID
            distanceKm: followCameraCumulativeDistances[closestIdx],
            triggered: false,
            openUntil: 0
        };
    });
    debug(`[registerPhotoTriggers] Registered ${photoTriggers.length} auto-pop triggers.`);
}

/**
 * Resets photo triggers when progress changes backward/forward via scrubs or play/stops
 */
export function resetPhotoTriggers(currentDistKm) {
    photoTriggers.forEach(t => {
        if (t.distanceKm > currentDistKm) {
            // Re-arm triggers that are ahead of our new position
            t.triggered = false;
            t.openUntil = 0;
            if (typeof onPhotoTriggerCb === 'function') {
                onPhotoTriggerCb(t.id, false);
            }
        } else {
            // Already passed - mark as triggered but do not pop it up retrospectively
            t.triggered = true;
            t.openUntil = 0;
        }
    });
}