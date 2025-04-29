// strava-explorer/gmp.js
import { Loader } from '@googlemaps/js-api-loader';

// --- Module-Level Variables ---
let map3d = null;
let elevator = null;
let previousPolyline = null;
let photoMarkers = new Map(); // Stores { marker, popover } pairs, key = photo.unique_id

// GMP Class variables (populated in initMap)
let Map3DElement, Marker3DInteractiveElement, Polyline3DElement, AltitudeMode, MapMode, PinElement, PopoverElement;
let ElevationService, ElevationElement; // Removed Place
let LatLng, LatLngBounds, encoding;

// --- Helper Functions (Dependencies - will be passed or imported if moved to utils) ---
let showLoading = (isLoading, text) => console.log(`Loading: ${isLoading}, Text: ${text}`);
let showError = (message) => console.error(`Error: ${message}`);

// Function to set helper dependencies (called from index.js)
export function setHelpers(helpers) {
    showLoading = helpers.showLoading;
    showError = helpers.showError;
}

// --- Map Initialization ---
export async function initMap(mapHostElement, apiKey) {
    if (!mapHostElement) throw new Error("Map host element is required.");
    if (!apiKey) throw new Error("Google Maps API Key is required.");

    showLoading(true, "Loading Google Maps...");
    const loader = new Loader({
        apiKey: apiKey,
        version: "alpha",
        libraries: ["maps3d", "marker", "elevation", "places", "geometry", "core"] // Keep places for now if needed elsewhere, geometry for encoding
    });

    try {
        await loader.load();
        console.log("Google Maps API loaded.");

        // Import necessary classes *after* API is loaded
        ({ Map3DElement, Marker3DInteractiveElement, Polyline3DElement, AltitudeMode, MapMode, PopoverElement } = await google.maps.importLibrary("maps3d"));
        ({ PinElement } = await google.maps.importLibrary("marker")); // Keep PinElement if default marker appearance is customized later
        ({ ElevationService, ElevationElement } = await google.maps.importLibrary("elevation"));
        // ({ Place } = await google.maps.importLibrary("places")); // Removed Place import
        ({ LatLng, LatLngBounds } = await google.maps.importLibrary("core"));
        ({ encoding } = await google.maps.importLibrary("geometry"));

        // Instantiate services
        elevator = new ElevationService();

        // Instantiate the 3D Map
        map3d = new Map3DElement({
            center: { lat: 32.6141, lng: -114.34411, altitude: 1000000 }, // Start high up
            range: 1000000, // Wide initial range
            tilt: 0, // Start looking straight down
            heading: 0,
            mode: MapMode.HYBRID, // Or SATELLITE
            defaultUIDisabled: true, // Disable default controls initially
        });
        mapHostElement.appendChild(map3d);
        console.log("3D Map initialized.");
        showLoading(false);
        return map3d; // Return the map instance

    } catch (error) {
        console.error("Map Initialization failed:", error);
        showError(`Map initialization failed: ${error.message}. Check API key or network connection.`);
        showLoading(false);
        throw error; // Re-throw
    }
}

// --- Elevation Helpers ---
export async function getClientElevation(latLng) { // latLng = { lat: number, lng: number }
    if (!elevator) {
        console.warn("ElevationService not initialized.");
        return 10; // Default elevation
    }
    try {
        const { results } = await elevator.getElevationForLocations({ locations: [latLng] });
        return results?.[0]?.elevation ?? 10; // Return elevation or default
    } catch (e) {
        console.error("Elevation lookup failed:", e);
        showError(`Elevation lookup error: ${e.message}`);
        return 10; // Default on error
    }
}

export async function getElevationsForPoints(locations) { // locations = [{ lat, lng }, ...]
    if (!elevator || locations.length === 0) return locations.map(() => 10); // Default if no service/locations
    const batchSize = 200; // API limit often around 512, use smaller batches
    let allElevations = [];
    showLoading(true, `Fetching ${locations.length} elevations...`);
    try {
        for (let i = 0; i < locations.length; i += batchSize) {
            const batchLocations = locations.slice(i, i + batchSize);
            const { results } = await elevator.getElevationForLocations({ locations: batchLocations });
            const elevations = results.map(result => result?.elevation ?? 10); // Default to 10 if null
            allElevations.push(...elevations);
        }
    } catch (e) {
        console.error(`Elevation fetch error:`, e);
        showError(`Elevation fetch error: ${e.message}`);
        // Fill remaining with default if error occurred mid-batch
        const remaining = locations.length - allElevations.length;
        if (remaining > 0) {
            allElevations.push(...Array(remaining).fill(10));
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
    } catch (error) {
        if (error.name === 'AbortError' || error.message?.includes('interrupted')) {
           console.log("Camera animation interrupted.");
        } else {
            console.error("flyCameraTo error:", error);
            showError(`Camera movement error: ${error.message}`);
        }
    } finally {
        showLoading(false);
    }
}

// --- Polyline Handling ---
export function decodePolyline(polylineString) {
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
        console.log(`Successfully decoded polyline. Path length: ${decodedPath.length}`);
        return decodedPath; // Returns array of LatLng objects
    } catch (e) {
        console.error("GMP polyline decoding failed:", e);
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

    console.log(`[displayPolyline] Displaying polyline with ${decodedPathLatLng.length} points.`);

    // Remove previous polyline
    removePreviousPolyline();

    // Create new 3D Polyline clamped to ground
    const routePolyline = new Polyline3DElement({
        coordinates: decodedPathLatLng, // Pass the array of LatLng objects directly
        strokeColor: 'red',
        strokeWidth: 20,
        outerColor: 'white',
        outerWidth: 0.5,
        altitudeMode: AltitudeMode.CLAMP_TO_GROUND,
    });

    // Add polyline to map
    map3d.appendChild(routePolyline);
    previousPolyline = routePolyline; // Store reference
    console.log(`[displayPolyline] Appended routePolyline to map.`);
    return routePolyline; // Return the created element
}

export function removePreviousPolyline() {
    if (previousPolyline && map3d) {
        try {
            console.log(`[removePreviousPolyline] Attempting to remove previous polyline.`);
            map3d.removeChild(previousPolyline);
            console.log(`[removePreviousPolyline] Successfully removed previous polyline.`);
        } catch (e) {
            console.warn("[removePreviousPolyline] Could not remove previous polyline:", e);
        } finally {
             previousPolyline = null;
        }
    }
}

// --- Photo Marker Handling ---
export async function displayPhotoMarkers(photosData) { // photosData = array from Strava API
    if (!map3d || !Marker3DInteractiveElement || !PopoverElement || !AltitudeMode) {
        showError("Map or necessary 3D components not ready for photo markers.");
        return;
    }

    // Cleanup previous markers and popovers
    clearPhotoMarkers();

    if (!photosData || photosData.length === 0) {
        console.log("No photos data provided to display.");
        return;
    }

    showLoading(true, `Processing ${photosData.length} photos...`);
    try {
        const photoLocations = photosData
            .map(p => ({ lat: p.location?.[0], lng: p.location?.[1], id: p.unique_id }))
            .filter(loc => loc.lat != null && loc.lng != null);

        if (photoLocations.length === 0) {
            console.log("No valid locations found in photo data.");
            showLoading(false);
            return;
        }

        const elevations = await getElevationsForPoints(photoLocations); // Fetch elevations for valid locations

        let elevationIndex = 0;
        photosData.forEach((photo) => {
            if (!photo.location || photo.location.length !== 2 || !photo.unique_id) return; // Skip if no location or ID

            const lat = photo.location[0];
            const lng = photo.location[1];
            // Find the corresponding elevation (assuming order is preserved)
            const locationIndex = photoLocations.findIndex(loc => loc.id === photo.unique_id);
            const baseAltitude = locationIndex !== -1 ? elevations[locationIndex] : 10; // Default if somehow not found

            const position = { lat, lng, altitude: baseAltitude + 1 }; // Position 1m above ground

            // Create Interactive Marker with Default Pin
            const marker = new Marker3DInteractiveElement({
                position: position,
                altitudeMode: AltitudeMode.RELATIVE_TO_GROUND,
                title: photo.caption || `Photo ${photo.unique_id}`,
                extruded: true,
                drawsWhenOccluded: true,
            });

            // Create Popover
            const popover = new PopoverElement({
                positionAnchor: marker,
                open: false,
            });

            // Populate Popover Content
            const popoverImageUrl = photo.urls?.["1000"] || photo.urls?.["600"] || photo.urls?.["100"]; // Fallback
            const popoverImage = document.createElement('img');
            popoverImage.src = popoverImageUrl;
            popoverImage.style.maxWidth = '300px';
            popoverImage.style.maxHeight = '300px';
            popoverImage.style.display = 'block';
            popoverImage.style.marginBottom = '8px';
            popoverImage.onerror = () => { popoverImage.alt = 'Image failed to load'; };

            const popoverCaption = document.createElement('p');
            popoverCaption.textContent = photo.caption || 'No caption';
            popoverCaption.style.fontSize = '12px';
            popoverCaption.style.color = '#555';

            popover.append(popoverImage);
            popover.append(popoverCaption);

            // Add Click Listener to Toggle Popover
            marker.addEventListener('gmp-click', () => {
                console.log("Clicked Photo Marker:", photo.unique_id);
                // Close other open popovers
                photoMarkers.forEach(({ popover: otherPopover }, key) => {
                    if (key !== photo.unique_id) {
                        otherPopover.open = false;
                    }
                });
                // Toggle this popover
                popover.open = !popover.open;
                // Fly closer
                flyToLocation(marker.position, 2000, 60, map3d.heading); // Fly closer (e.g., 500m)
            });

            // Add Marker and Popover to Map
            map3d.append(marker);
            map3d.append(popover);

            // Store Marker and Popover References
            photoMarkers.set(photo.unique_id, { marker, popover });
            console.log(`[displayPhotoMarkers] Appended marker/popover for photo ${photo.unique_id}`);
        });

    } catch (error) {
        console.error("Error processing or displaying photo markers:", error);
        showError(`Failed to display photos: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

export function clearPhotoMarkers() {
    if (photoMarkers.size > 0 && map3d) {
        console.log(`[clearPhotoMarkers] Clearing ${photoMarkers.size} photo markers and popovers.`);
        photoMarkers.forEach(({ marker, popover }) => {
            try { map3d.removeChild(marker); } catch(e) { console.warn("Error removing marker", e); }
            try { map3d.removeChild(popover); } catch(e) { console.warn("Error removing popover", e); }
        });
        photoMarkers.clear(); // Clear the map
    }
}

// --- Utility ---
export function getMapInstance() {
    return map3d;
}

export function getLatLngClass() {
    return LatLng;
}

export function getLatLngBoundsClass() {
    return LatLngBounds;
}

export function getElevationElementClass() {
    return ElevationElement;
}

// --- Downsampling Function (Handles LatLng objects) ---
// Moved here as it's primarily used for the GMP Elevation Widget path
export function downsamplePath(path, maxPoints) { // path = array of LatLng objects
    console.log(`[downsamplePath] Called with path length: ${path?.length}, maxPoints: ${maxPoints}`);
    if (!path || path.length <= maxPoints) {
        return path; // No need to downsample
    }

    const originalLength = path.length;
    const keepEvery = Math.ceil(originalLength / maxPoints);
    const newPath = [];

    for (let i = 0; i < originalLength; i += keepEvery) {
        newPath.push(path[i]);
    }

    // Ensure the last point is always included
    if (newPath.length > 0 && path.length > 0 && newPath[newPath.length - 1] !== path[originalLength - 1]) {
         // Check if the last element added is actually the last element of the original path
         const lastOriginalPoint = path[originalLength - 1];
         const lastAddedPoint = newPath[newPath.length - 1];
         // Compare LatLng objects (need to compare lat/lng values)
         if (lastAddedPoint.lat() !== lastOriginalPoint.lat() || lastAddedPoint.lng() !== lastOriginalPoint.lng()) {
            newPath.push(lastOriginalPoint);
         }
    } else if (newPath.length === 0 && path.length > 0) {
        // If keepEvery was larger than length, add the first and last points at least
        newPath.push(path[0]);
        if (originalLength > 1) {
            newPath.push(path[originalLength - 1]);
        }
    }


    console.log(`[downsamplePath] Returning new path. Length: ${newPath?.length}`);
    return newPath;
}