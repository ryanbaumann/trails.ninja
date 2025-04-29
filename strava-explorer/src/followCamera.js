// strava-explorer/followCamera.js

// --- Module-Level Variables ---
let map3d = null;
let LatLng = null; // To be initialized
let getClientElevation = async () => 10; // Placeholder, to be initialized
let showError = (message) => console.error(`Error: ${message}`); // Placeholder

// Follow Camera State
let followCameraActive = false; // Is the feature currently active?
let followCameraTimeoutId = null; // Timeout ID for the initial 5-second delay
let followCameraAnimationId = null; // requestAnimationFrame ID
let followCameraCoords = []; // Coordinates of the current route for animation
let followCameraStartTime = null; // Timestamp when animation started
let followCameraDuration = 60000; // Default duration (ms), adjust as needed
let followCameraPathDistance = 0; // Total distance of the path

/**
 * Initializes the follow camera module with necessary dependencies.
 * @param {google.maps.maps3d.Map3DElement} mapInstance The 3D map instance.
 * @param {Function} latLngClass The google.maps.LatLng class.
 * @param {Function} elevationGetter Async function to get elevation for a LatLng.
 * @param {Function} errorReporter Function to report errors.
 */
export function initializeFollowCamera(mapInstance, latLngClass, elevationGetter, errorReporter) {
    map3d = mapInstance;
    LatLng = latLngClass;
    getClientElevation = elevationGetter;
    showError = errorReporter;
    console.log("Follow Camera module initialized.");
}


// --- Helper Functions ---

/**
 * Calculates the Haversine distance between two points in kilometers.
 * @param {google.maps.LatLng} p1 First point.
 * @param {google.maps.LatLng} p2 Second point.
 * @returns {number} Distance in kilometers.
 */
function haversineDistance(p1, p2) {
    if (!p1 || !p2) return 0; // Guard against null/undefined inputs
    const R = 6371; // Radius of the Earth in km
    const dLat = (p2.lat() - p1.lat()) * Math.PI / 180;
    const dLon = (p2.lng() - p1.lng()) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(p1.lat() * Math.PI / 180) * Math.cos(p2.lat() * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Calculates the initial bearing (direction) from point p1 to point p2.
 * @param {google.maps.LatLng} p1 Start point.
 * @param {google.maps.LatLng} p2 End point.
 * @returns {number} Bearing in degrees (0-360).
 */
function calculateBearing(p1, p2) {
     if (!p1 || !p2) return 0; // Guard against null/undefined inputs
    const lat1 = p1.lat() * Math.PI / 180;
    const lon1 = p1.lng() * Math.PI / 180;
    const lat2 = p2.lat() * Math.PI / 180;
    const lon2 = p2.lng() * Math.PI / 180;

    const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) -
              Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    bearing = (bearing + 360) % 360; // Normalize to 0-360
    return bearing;
}

/**
 * Finds a point along a polyline at a specific distance.
 * @param {google.maps.LatLng[]} coords Array of LatLng coordinates defining the line.
 * @param {number} distance Distance along the line (in km).
 * @returns {{point: google.maps.LatLng, bearing: number}|null} The point and bearing, or null if distance is out of bounds.
 */
function samplePointAlongLine(coords, distance) {
    if (!coords || coords.length < 2 || distance < 0 || !LatLng) return null;

    let cumulativeDistance = 0;
    for (let i = 0; i < coords.length - 1; i++) {
        const p1 = coords[i];
        const p2 = coords[i + 1];
        if (!p1 || !p2) continue; // Skip if points are invalid
        const segmentDistance = haversineDistance(p1, p2);

        // Skip segment if distance is zero or negative to avoid division error
        if (segmentDistance <= 0) {
            continue; // Move to the next segment
        }

        if (cumulativeDistance + segmentDistance >= distance) {
            const fraction = (distance - cumulativeDistance) / segmentDistance;
            const bearing = calculateBearing(p1, p2);
            const lat = p1.lat() + (p2.lat() - p1.lat()) * fraction;
            const lng = p1.lng() + (p2.lng() - p1.lng()) * fraction;
            // Interpolate altitude if available, otherwise fetch/default
            const alt1 = p1.altitude ?? 10; // Use altitude if present in LatLng object, else default
            const alt2 = p2.altitude ?? 10;
            const altitude = alt1 + (alt2 - alt1) * fraction;

            return { point: new LatLng(lat, lng, altitude), bearing: bearing };
        }
        cumulativeDistance += segmentDistance;
    }

    // If distance exceeds total path length, return the last point and bearing into it
    if (coords.length >= 2) {
        const lastPoint = coords[coords.length - 1];
        const secondLastPoint = coords[coords.length - 2];
         if (!lastPoint || !secondLastPoint) return null; // Check validity
        const bearing = calculateBearing(secondLastPoint, lastPoint);
        // Ensure the returned last point also has an altitude property
        const lastPointWithAlt = new LatLng(lastPoint.lat(), lastPoint.lng(), lastPoint.altitude ?? 10); // Use original altitude if present, else default 10
        return { point: lastPointWithAlt, bearing: bearing };
    }

    return null; // Should not happen if checks pass
}

/**
 * Moves the map camera instantly to the specified position.
 * @param {{center: {lat: number, lng: number, altitude: number}, heading: number, range: number, tilt: number}} position Camera parameters.
 */
function moveCamera(position) {
    if (map3d && position?.center && !isNaN(position.center.lat) && !isNaN(position.center.lng) && !isNaN(position.center.altitude)) {
        map3d.center = position.center;
        map3d.heading = position.heading;
        map3d.range = position.range;
        map3d.tilt = position.tilt;
    } else {
        console.warn("moveCamera skipped: Invalid map or position.", { map3d: !!map3d, position });
    }
}

/**
 * The animation frame function for the follow camera.
 * @param {DOMHighResTimeStamp} time The current time.
 */
async function frame(time) {
    if (!followCameraActive || !map3d) {
        followCameraAnimationId = null;
        return; // Stop if not active or map not ready
    }
    if (!followCameraStartTime) followCameraStartTime = time;

    const elapsedTime = time - followCameraStartTime;
    let animationPhase = elapsedTime / followCameraDuration;

    if (animationPhase > 1) {
        animationPhase = 1; // Clamp to end
        followCameraActive = false; // Stop animation after completion
        console.log("Follow camera animation finished.");
    }

    const distanceAlongPath = followCameraPathDistance * animationPhase;
    const alongCoords = samplePointAlongLine(followCameraCoords, distanceAlongPath);

    if (!alongCoords || !alongCoords.point) {
        console.warn("Could not sample point along line for follow camera at distance:", distanceAlongPath);
        if (followCameraActive) { // Only request next frame if still supposed to be active
             followCameraAnimationId = requestAnimationFrame(frame);
        } else {
            followCameraAnimationId = null;
        }
        return;
    }

    // Fetch ground elevation for the sampled point to adjust camera altitude
    let groundElevation = 10; // Default
    try {
        groundElevation = await getClientElevation(alongCoords.point);
    } catch (e) {
        console.error("Error fetching elevation during animation:", e);
        // Use default elevation
    }

    const cameraAltitude = groundElevation + 50; // Camera 50m above the sampled point's ground elevation

    const cameraPosition = {
        center: { lat: alongCoords.point.lat(), lng: alongCoords.point.lng(), altitude: cameraAltitude },
        heading: alongCoords.bearing,
        range: 500, // How far the camera looks (meters)
        tilt: 75,   // Camera angle (degrees from vertical)
    };

    // Validate coordinates before moving camera
    if (isNaN(cameraPosition.center.lat) || isNaN(cameraPosition.center.lng) || isNaN(cameraPosition.center.altitude) || isNaN(cameraPosition.heading)) {
        console.error('frame ERROR: Invalid coordinates detected before moveCamera!', {
             pointLat: alongCoords?.point?.lat(),
             pointLng: alongCoords?.point?.lng(),
             cameraAltitude: cameraAltitude,
             bearing: alongCoords?.bearing,
             distanceAlongPath: distanceAlongPath,
             animationPhase: animationPhase
            });
        // Stop animation on error to prevent further issues
        stopFollowCamera();
        return;
    } else {
        moveCamera(cameraPosition); // Only move if valid
    }

    // Request next frame if still active
    if (followCameraActive) {
        followCameraAnimationId = window.requestAnimationFrame(frame);
    } else {
         followCameraAnimationId = null;
         // Optionally reset camera or leave it at the end position
    }
}

/**
 * Starts the follow camera animation.
 * @param {google.maps.LatLng[]} routeCoords Coordinates of the route.
 * @param {number} [durationMs=60000] Optional duration for the animation.
 */
function startFollowCamera(routeCoords, durationMs) {
    if (!map3d) {
        showError("Cannot start follow camera: Map not initialized.");
        return;
    }
    if (!routeCoords || routeCoords.length < 2) {
        showError("Cannot start follow camera: Invalid route coordinates.");
        return;
    }
    if (followCameraActive) {
        console.log("Follow camera already active.");
        return; // Don't restart if already running
    }

    console.log("Starting follow camera animation.");
    followCameraCoords = routeCoords;
    followCameraDuration = durationMs || 60000; // Use provided duration or default
    followCameraStartTime = null; // Reset start time
    followCameraActive = true;

    // Calculate total path distance
    followCameraPathDistance = 0;
    for (let i = 0; i < followCameraCoords.length - 1; i++) {
        followCameraPathDistance += haversineDistance(followCameraCoords[i], followCameraCoords[i + 1]);
    }
     if (isNaN(followCameraPathDistance) || followCameraPathDistance <= 0) {
        showError(`Cannot start follow camera: Invalid calculated path distance (${followCameraPathDistance}). Check coordinates.`);
        followCameraActive = false; // Prevent start
        return;
    }
    console.log(`Follow camera path distance: ${followCameraPathDistance.toFixed(2)} km`);


    // Stop any previous animation frame request
    if (followCameraAnimationId) {
        window.cancelAnimationFrame(followCameraAnimationId);
    }
    // Stop any pending timeout start
    if (followCameraTimeoutId) {
        clearTimeout(followCameraTimeoutId);
        followCameraTimeoutId = null;
    }

    // Start the animation loop
    followCameraAnimationId = window.requestAnimationFrame(frame);
}

/**
 * Stops the follow camera animation and clears any pending start timeout.
 */
export function stopFollowCamera() {
    console.log("Stopping follow camera animation.");
    followCameraActive = false;
    followCameraStartTime = null; // Reset start time as well

    if (followCameraAnimationId) {
        window.cancelAnimationFrame(followCameraAnimationId);
        followCameraAnimationId = null;
    }
    if (followCameraTimeoutId) {
        clearTimeout(followCameraTimeoutId);
        followCameraTimeoutId = null;
    }
    // Don't reset coords, duration, or distance here, might be needed if toggled back on
}

/**
 * Sets the follow camera state and starts/stops accordingly.
 * Also handles the initial delay if activating.
 * @param {boolean} isActive Whether the follow camera should be active.
 * @param {google.maps.LatLng[]} routeCoords Coordinates needed if activating.
 * @param {boolean} [useDelay=false] If true and activating, wait 5 seconds.
 */
export function setFollowCameraState(isActive, routeCoords, useDelay = false) {
     if (isActive) {
        if (!routeCoords || routeCoords.length < 2) {
            showError("Cannot enable follow camera: Route coordinates are missing or invalid.");
            // Ensure toggle reflects failure (assuming a toggle exists in the main app)
            // Consider adding a callback or event emitter for UI updates
            return;
        }
        // Stop any currently running animation or timeout before starting/scheduling a new one
        stopFollowCamera();

        if (useDelay) {
            console.log("Scheduling follow camera start in 5 seconds...");
            followCameraTimeoutId = setTimeout(() => {
                startFollowCamera(routeCoords);
                followCameraTimeoutId = null; // Clear the ID after execution
            }, 5000);
        } else {
            // Start immediately
            startFollowCamera(routeCoords);
        }
    } else {
        stopFollowCamera();
    }
}