import { Loader } from '@googlemaps/js-api-loader';
// Removed Mapbox polyline import

// --- Module-Level Variables ---
let map3d; // For the 3D map instance
let elevator; // For ElevationService
// let autocomplete; // REMOVED Autocomplete variable
let previousPolyline = null; // To store the previous 3D polyline for removal
let photoMarkers = new Map(); // Use Map to store { marker, popover } pairs, key = photo.unique_id
let stravatoken;
let userid, actid;

// GMP Class variables (populated in initApp)
let Map3DElement, Marker3DInteractiveElement, Polyline3DElement, AltitudeMode, MapMode, PinElement, PopoverElement; // Added PopoverElement here
let ElevationService, Place, LatLng, LatLngBounds, encoding, ElevationElement; // REMOVED Autocomplete class

// --- DOM Element References ---
let mapHost, loadingIndicator, loadingText, errorMessageDiv, statsContainer, activityNameEl, activityDistEl, activityTimeEl, activityElevEl, activityAvgSpeedEl, activityMaxSpeedEl, elevationProfileWidget, selectList, activityFilterDiv, startDateInput, endDateInput, activityCountInput, fetchFilteredButton, photoDisplayDiv, selectedPhotoImg, selectedPhotoCaption, footerAthleteInfo, footerProfileImg, footerProfileName, logoutButton; // Added footer elements

// --- Utility Functions ---
function showLoading(isLoading, text = "Loading...") {
    if (!loadingIndicator || !loadingText) return;
    loadingText.textContent = text;
    loadingIndicator.style.display = isLoading ? 'flex' : 'none';
    if (isLoading) showError(''); // Clear errors when loading starts
}
function showError(message) {
    if (!errorMessageDiv) return;
    errorMessageDiv.textContent = message || '';
    errorMessageDiv.style.display = message ? 'block' : 'none';
    if (message) showLoading(false); // Hide loading if error occurs
}

// --- Elevation Helpers ---
async function getClientElevation(latLng) { // latLng = { lat: number, lng: number }
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

async function getElevationsForPoints(locations) { // locations = [{ lat, lng }, ...]
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
async function flyToLocation(targetCoords, range = 1000, tilt = 60, heading = 0, duration = 1500) {
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

// --- Strava Photo Handling (3D) ---
async function getPhotos(stravatoken, activityid) {
console.log(`[getPhotos] Called for activity ID: ${activityid}`); // Log entry point
    // Cleanup previous markers
    // Cleanup previous markers and popovers
    // Cleanup previous markers and popovers
    if (photoMarkers.size > 0) {
        photoMarkers.forEach(({ marker, popover }) => {
            try { map3d?.removeChild(marker); } catch(e) { console.warn("Error removing marker", e); }
            try { map3d?.removeChild(popover); } catch(e) { console.warn("Error removing popover", e); }
        });
        photoMarkers.clear(); // Clear the map
    }

    let photoURL = `https://www.strava.com/api/v3/activities/${activityid}/photos?photo_sources=true&access_token=${stravatoken}&size=1000`;
    showLoading(true, "Fetching activity photos...");
    try {
        const response = await fetch(photoURL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const photos = await response.json();

console.log(`[getPhotos] Received ${photos.length} photos from Strava:`, photos); // Log raw photo data
        if (photos.length > 0) {
            showLoading(true, `Processing ${photos.length} photos...`);
            const photoLocations = photos.map(p => ({ lat: p.location?.[0], lng: p.location?.[1] })).filter(loc => loc.lat != null && loc.lng != null);
            const elevations = await getElevationsForPoints(photoLocations);

            let photoIndex = 0;
            photos.forEach((photo) => {
console.log(`[getPhotos] Processing photo ${photoIndex + 1}/${photos.length}: ID ${photo.unique_id}`, photo); // Log before processing each photo
                if (!photo.location || photo.location.length !== 2) return;

                const lat = photo.location[0];
                const lng = photo.location[1];
                const baseAltitude = elevations[photoIndex++]; // Get corresponding elevation
                const position = { lat, lng, altitude: baseAltitude + 1 }; // Position 1m above ground

                // --- Create Interactive Marker with Default Pin ---
                const marker = new Marker3DInteractiveElement({
                    position: position,
                    altitudeMode: AltitudeMode.RELATIVE_TO_GROUND,
                    title: photo.caption || `Photo ${photo.unique_id}`,
                    extruded: true, 
                    drawsWhenOccluded: true,
                    // sizePreserved: true // Pin size is generally managed differently
                });

                // Removed PinElement creation and appendChild call, relying on default rendering

                // --- Create Popover ---
                const popover = new PopoverElement({
                    positionAnchor: marker, // Anchor to the marker
                    open: false, // Start closed
                    // Optional: Style popover via CSS variables if needed
                    // style: "--gmp-popover-max-width: 320px;"
                });

                // --- Populate Popover Content ---
                const popoverImageUrl = photo.urls?.["1000"] || photo.urls?.["600"] || markerImageUrl; // Use larger image for popover
                const popoverImage = document.createElement('img');
                popoverImage.src = popoverImageUrl;
                popoverImage.style.maxWidth = '300px'; // Limit popover image size
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

                // --- Add Click Listener to Toggle Popover ---
                marker.addEventListener('gmp-click', () => {
                    console.log("Clicked Photo Marker:", photo.unique_id);
                    // Close other open popovers (optional, good UX)
                    photoMarkers.forEach(({ popover: otherPopover }, key) => {
                        if (key !== photo.unique_id) {
                            otherPopover.open = false;
                        }
                    });
                    // Toggle this popover
                    popover.open = !popover.open;
                    // Fly closer, adjust range/tilt if needed
                    flyToLocation(marker.position, 1000, 70, map3d.heading); // Fly closer (e.g., 500m)
                });

                // --- Add Marker and Popover to Map ---
                map3d.append(marker);
                map3d.append(popover);

                // --- Store Marker and Popover References ---
                photoMarkers.set(photo.unique_id, { marker, popover });
                console.log(`[getPhotos] Appended marker and popover for photo ${photo.unique_id} at position:`, position); // Moved log inside loop
            });
        } else {
            console.log("No photos found for this activity.");
        }
    } catch (error) {
        console.error("Error fetching or processing Strava photos:", error);
        showError(`Failed to load photos: ${error.message}`);
    } finally {
        showLoading(false);
        // Removed misplaced log from here
    }
}


// --- Strava Auth & Activity Fetching (Mostly Unchanged) ---
async function exchangeToken(code) {
    const tokenUrl = 'https://www.strava.com/oauth/token';
    const params = new URLSearchParams({
        client_id: import.meta.env.VITE_STRAVA_CLIENT_ID,
        client_secret: import.meta.env.VITE_STRAVA_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code'
    });

    showLoading(true, "Authenticating with Strava...");
    try {
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Strava token exchange failed: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        console.log("Strava Auth Response Data:", data);
        handleSuccessfulAuth(data);

    } catch (error) {
        console.error('Error exchanging Strava token:', error);
        showError(`Strava authentication failed: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

function handleSuccessfulAuth(authData) {
    if (authData.access_token) {
        stravatoken = authData.access_token;
        document.getElementById('strava_auth').style.display = "none";

        // Update main sidebar profile (if still needed)
        const profileContainer = document.getElementById('athlete-info');
        const profileImg = document.getElementById('strava_profile');
        const profileName = document.getElementById('strava-username');
        if (profileImg) profileImg.src = authData.athlete.profile_medium;
        if (profileName) profileName.textContent = `${authData.athlete.firstname} ${authData.athlete.lastname}`;
        if (profileContainer) profileContainer.classList.remove('hidden');

        // Update footer profile info
        if (footerProfileImg) footerProfileImg.src = authData.athlete.profile_medium;
        if (footerProfileName) footerProfileName.textContent = `${authData.athlete.firstname} ${authData.athlete.lastname}`;
        if (footerAthleteInfo) footerAthleteInfo.classList.remove('hidden');

        userid = authData.athlete.id;

        // Show the filter section now that user is authenticated
        if (activityFilterDiv) activityFilterDiv.classList.remove('hidden');

        // Add listener to the fetch button *after* auth
        if (fetchFilteredButton) {
            fetchFilteredButton.addEventListener('click', handleFetchFilteredActivities);
        } else {
             console.error("Fetch filtered activities button not found.");
        }

        // Add listener for logout button and make it visible
        if (logoutButton) {
            logoutButton.classList.remove('hidden'); // Show logout button on successful auth
            logoutButton.addEventListener('click', () => {
                // Basic logout: Clear token, reload page to show auth button
                console.log("Logging out...");
                stravatoken = null;
                // Hide footer info and logout button immediately
                if (footerAthleteInfo) footerAthleteInfo.classList.add('hidden');
                if (logoutButton) logoutButton.classList.add('hidden');
                // Optionally clear local storage if used
                window.location.href = window.location.pathname; // Reload without query params
            });
        } else {
            console.error("Logout button not found.");
        }

        // Trigger initial fetch with default/empty filters
        handleFetchFilteredActivities();

    } else {
        console.error("Access token not found in Strava auth response:", authData);
        showError("Strava authentication succeeded but no access token was received.");
    }
}

// Updated fetchActivities to accept date range and count
async function fetchActivities(accessToken, beforeTimestamp = null, afterTimestamp = null, perPage = 30) {
    console.log(`Fetching activities with token: ${accessToken}, Before: ${beforeTimestamp}, After: ${afterTimestamp}, Count: ${perPage}`);
    const activitiesUrl = 'https://www.strava.com/api/v3/athlete/activities';
    const params = new URLSearchParams();

    // Add parameters if they exist
    if (beforeTimestamp) params.set('before', beforeTimestamp);
    if (afterTimestamp) params.set('after', afterTimestamp);
    params.set('per_page', Math.min(perPage, 100).toString()); // Ensure max 100

    showLoading(true, "Fetching Strava activities...");
    try {
        const response = await fetch(`${activitiesUrl}?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Strava activities fetch failed: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
        }

        const activities = await response.json();
        console.log("Parsed Activities:", activities);
        handleActivitiesResponse(activities);

    } catch (error) {
        console.error('Error fetching Strava activities:', error);
        showError(`Failed to fetch activities: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

async function fetchDetailedActivity(activityId) {
    if (!stravatoken) {
        showError("Not authenticated with Strava.");
        return;
    }
    if (!activityId) {
        showError("No Activity ID provided.");
        return;
    }

    console.log(`Fetching detailed data for activity ID: ${activityId}`);
    const detailedActivityUrl = `https://www.strava.com/api/v3/activities/${activityId}`;

    showLoading(true, "Fetching activity details...");
    try {
        const response = await fetch(detailedActivityUrl, {
            headers: { 'Authorization': `Bearer ${stravatoken}` }
        });
console.log(`[fetchDetailedActivity] Called for activity ID: ${activityId}`);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Strava detailed activity fetch failed: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
        }

        const detailedActivityData = await response.json();
        console.log("Detailed Activity Data:", detailedActivityData);
        await displayDetailedActivity(detailedActivityData); // Make sure this awaits

    } catch (error) {
        console.error('Error fetching Strava detailed activity:', error);
        showError(`Failed to fetch activity details: ${error.message}`);
    } finally {
        showLoading(false);
console.log(`[fetchDetailedActivity] Successfully fetched data, about to call displayDetailedActivity.`);
    }
}

// --- Display Detailed Activity (3D) ---
async function displayDetailedActivity(activityData) {
    if (!activityData?.map?.polyline) {
        showError("Detailed activity data is missing map polyline.");
        console.error("Missing polyline:", activityData);
        return;
    }
console.log(`[displayDetailedActivity] Called with data:`, activityData);
    if (!map3d || !Polyline3DElement || !AltitudeMode || !encoding) {
        showError("Map or necessary 3D components not ready.");
        return;
    }

    actid = activityData.id;

console.log(`[displayDetailedActivity] Passed initial polyline and map component checks.`);
    // Hide photo display when new activity is loaded - REMOVED as popovers are used now

    // --- Polyline Display ---
    showLoading(true, "Processing activity route...");

    // Remove previous polyline
    console.log(`[displayDetailedActivity] Checking for previous polyline. previousPolyline exists: ${!!previousPolyline}`); // Log check
    if (previousPolyline) {
        try {
            console.log(`[displayDetailedActivity] Attempting to remove previous polyline.`); // Log attempt
            map3d.removeChild(previousPolyline);
            console.log(`[displayDetailedActivity] Successfully removed previous polyline.`); // Log success
        } catch (e) {
            console.warn("[displayDetailedActivity] Could not remove previous polyline:", e); // Log warning on error
        }
        previousPolyline = null;
    }

    // Check and define detailedPolyline *after* removal logic
    console.log(`[displayDetailedActivity] Checking activityData.map.polyline:`, activityData?.map?.polyline); // Log check
    if (!activityData?.map?.polyline || typeof activityData.map.polyline !== 'string' || activityData.map.polyline.trim() === '') {
        showError("Detailed activity data is missing a valid map polyline string.");
        console.error("[displayDetailedActivity] Missing or invalid polyline:", activityData?.map?.polyline); // Log error
        showLoading(false); // Ensure loading indicator is hidden
        return; // Stop execution if polyline is invalid
    }
    const detailedPolyline = activityData.map.polyline; // Define it here

    // Decode polyline using GMP library
    let decodedPathLatLng;
    console.log(`[displayDetailedActivity] Attempting to decode polyline: ${detailedPolyline}`); // Log before try
    try {
        decodedPathLatLng = encoding.decodePath(detailedPolyline);
        if (!decodedPathLatLng || decodedPathLatLng.length === 0) {
            throw new Error("Decoded path is empty or invalid.");
        }
        console.log(`[displayDetailedActivity] Successfully decoded polyline. Path length: ${decodedPathLatLng.length}`); // Log success
    } catch (e) {
        console.error("[displayDetailedActivity] GMP polyline decoding failed:", e); // Log error
        showError(`Failed to decode activity route: ${e.message}`);
        showLoading(false);
        return; // Exit if decoding fails
    }

    // Convert LatLng objects to simple {lat, lng} literals
    const pathLatLngLiterals = decodedPathLatLng.map(p => ({ lat: p.lat(), lng: p.lng() }));

    // Create new 3D Polyline clamped to ground with custom styling
    const routePolyline = new Polyline3DElement({
        coordinates: decodedPathLatLng, // Pass the array of LatLng objects directly
        strokeColor: 'red',       // Main line color
        strokeWidth: 20,          // Increased main line width in pixels
        outerColor: 'white',      // Outline color
        outerWidth: 0.5,          // Outline width as percentage (0.0 to 1.0) of strokeWidth
        altitudeMode: AltitudeMode.CLAMP_TO_GROUND, // Clamp directly to ground
    });

console.log(`[displayDetailedActivity] Appended routePolyline to map.`);
    // Add polyline to map
    map3d.appendChild(routePolyline);
    previousPolyline = routePolyline; // Store reference

    // --- Map Camera ---
    // Calculate bounds and fly camera
    if (pathLatLngLiterals.length > 0) { // Use pathLatLngLiterals
        const bounds = new LatLngBounds();
        decodedPathLatLng.forEach(p => bounds.extend(p)); // Use LatLng objects directly
 
        if (!bounds.isEmpty()) {
            const center = bounds.getCenter().toJSON(); // Get center {lat, lng}
            // Estimate range based on diagonal distance (simple approximation)
            const ne = bounds.getNorthEast().toJSON();
            const sw = bounds.getSouthWest().toJSON();
            const diagonalDistance = google.maps.geometry.spherical.computeDistanceBetween(
                new LatLng(ne.lat, ne.lng),
                new LatLng(sw.lat, sw.lng)
            );
            const range = Math.max(1000, diagonalDistance * 1.5); // Ensure minimum range, add buffer

            console.log(`[displayDetailedActivity] About to call flyToLocation. Center:`, { center, range }); // Log before call
            await flyToLocation(center, range, 60, 0); // Await camera movement
            console.log(`[displayDetailedActivity] flyToLocation call completed.`); // Log after call
        }
    }
    showLoading(false); // Hide loading after polyline processing and camera flight start

    // --- Update UI with Stats (Imperial Units) ---
    const metersToFeet = 3.28084;
    const kmToMiles = 0.621371;
    const mpsToMph = 2.23694;

    const distanceMiles = (activityData.distance / 1000 * kmToMiles).toFixed(2);
    const movingTimeSeconds = activityData.moving_time;
    const elevationGainFeet = (activityData.total_elevation_gain * metersToFeet).toFixed(0) || 'N/A';
    const avgSpeedMps = activityData.average_speed || 0;
    const maxSpeedMps = activityData.max_speed || 0;

    // Convert speeds to mph
    const avgSpeedMph = (avgSpeedMps * mpsToMph).toFixed(1);
    const maxSpeedMph = (maxSpeedMps * mpsToMph).toFixed(1);

    // Format time (remains the same)
console.log(`[displayDetailedActivity] UI stats updated.`);
    const hours = Math.floor(movingTimeSeconds / 3600);
    const minutes = Math.floor((movingTimeSeconds % 3600) / 60);
    const seconds = movingTimeSeconds % 60;
    const movingTimeFormatted = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    // Populate UI elements with Imperial units
    if (activityNameEl) activityNameEl.textContent = activityData.name || 'Unnamed Activity';
console.log(`[displayDetailedActivity] Attempting to configure elevation profile widget.`);
    if (activityDistEl) activityDistEl.textContent = `${distanceMiles} mi`; // Use miles
    if (activityTimeEl) activityTimeEl.textContent = movingTimeFormatted;
console.log(`[displayDetailedActivity] gmp-elevation element is defined.`);
console.log(`[displayDetailedActivity] Checking activityElevEl:`, activityElevEl);
    if (activityElevEl) activityElevEl.textContent = `${elevationGainFeet} ft`; // Use feet
console.log(`[displayDetailedActivity] Checking activityAvgSpeedEl:`, activityAvgSpeedEl);
    if (activityAvgSpeedEl) activityAvgSpeedEl.textContent = `${avgSpeedMph} mph`; // Use mph
console.log(`[displayDetailedActivity] Checking activityMaxSpeedEl:`, activityMaxSpeedEl);
    if (activityMaxSpeedEl) activityMaxSpeedEl.textContent = `${maxSpeedMph} mph`; // Use mph
console.log(`[displayDetailedActivity] Checking statsContainer:`, statsContainer);
    if (statsContainer) statsContainer.classList.remove('hidden');
    // Removed misplaced log statement from here

    // Configure Elevation Profile Widget (already set to imperial in HTML)

    // Clear path first - We found commenting this out fixes the error.
    // if (elevationProfileWidget) {
    //     elevationProfileWidget.path = [];
console.log(`[displayDetailedActivity] Checking elevationProfileWidget before if:`, elevationProfileWidget);
console.log(`[displayDetailedActivity] Checking pathLatLngLiterals.length before if:`, pathLatLngLiterals?.length);
    // Removed misplaced log from here
    // }
    if (elevationProfileWidget && pathLatLngLiterals.length > 0) { // Check the length of the *literals* array
    // Removed misplaced log from here
        try {
            // Ensure the component is defined
console.log(`[displayDetailedActivity] Awaiting customElements.whenDefined('gmp-elevation')...`);
            await customElements.whenDefined('gmp-elevation'); // Re-enabled await
            console.log(`[displayDetailedActivity] customElements.whenDefined('gmp-elevation') resolved.`);

// Downsample the path if it's too long
            const maxPoints = 300; // Target maximum points for the profile
console.log(`[displayDetailedActivity] Calling downsamplePath with decodedPathLatLng (length: ${decodedPathLatLng?.length}) and maxPoints: ${maxPoints}`);
            const downsampledPath = downsamplePath(decodedPathLatLng, maxPoints); // Pass LatLng array
            console.log(`[displayDetailedActivity] Downsampled path created. Length: ${downsampledPath?.length}`); // Added log correctly here
            // console.log(`Original path points: ${decodedPathLatLng.length}, Downsampled to: ${downsampledPath.length}`); // Temporarily comment out this log


            // Check if path is valid *before* assignment
            if (Array.isArray(downsampledPath) && downsampledPath.length > 0) { // Keep check as > 0 based on error msg
                // Log the first point's lat/lng for verification
                const firstPoint = downsampledPath[0];
                console.log(`Attempting to set elevation path with ${downsampledPath.length} LatLng points. First point: {lat: ${firstPoint.lat()}, lng: ${firstPoint.lng()}}`); // Keep this log
                try {
                    console.log(`[displayDetailedActivity] Attempting to assign downsampled path to elevation widget.`); // Added log before assignment
                    elevationProfileWidget.path = downsampledPath; // Pass array of LatLng objects
                    console.log("[displayDetailedActivity] Successfully assigned path to elevation widget."); // Corrected log after assignment
                } catch (elevationError) {
                    console.error("[displayDetailedActivity] Error directly setting elevation path:", elevationError); // Added prefix
                    console.error("Path data that caused error:", JSON.stringify(downsampledPath)); // Log the problematic data
                    showError(`Failed to display elevation profile: ${elevationError.message}`);
                }
            } else {
console.log(`[displayDetailedActivity] Finished elevation profile widget configuration.`);
                console.warn("Downsampled path is empty or invalid (length <= 0), not setting elevation path.");
                // Explicitly clear path here if needed, maybe differently?
                // elevationProfileWidget.path = null; // Or some other valid empty state?
console.log(`[downsamplePath] Called with path length: ${path?.length}, maxPoints: ${maxPoints}`);
                // For now, just log that we are not setting it.
            }

        } catch (e) {
            console.error("Error setting elevation path:", e);
            showError("Could not display elevation profile.");
        }
    } else if (elevationProfileWidget) {
         // If pathLatLngLiterals is empty, ensure the path is cleared.
         // Since setting path = [] caused issues, maybe setting to null or undefined is safer?
         // Let's try null. If that fails, we might need to leave it uncleared or find another way.
         elevationProfileWidget.path = null; // Clear path if no data using null instead of []
    }


    // Fetch photos for the selected activity
    // Removed misplaced log statement from here
    await getPhotos(stravatoken, activityData.id);
}

// --- Downsampling Function (Handles LatLng objects) ---
function downsamplePath(path, maxPoints) {
    if (!path || path.length <= maxPoints) {
        return path; // No need to downsample
console.log(`[displayDetailedActivity] About to call getPhotos for activity ID: ${activityData.id}`);
    }

    const originalLength = path.length;
    const keepEvery = Math.ceil(originalLength / maxPoints);
    const newPath = [];

    for (let i = 0; i < originalLength; i += keepEvery) {
        newPath.push(path[i]);
    }

    // Ensure the last point is always included
    if (newPath[newPath.length - 1] !== path[originalLength - 1]) {
        newPath.push(path[originalLength - 1]);
    }
console.log(`[downsamplePath] Returning new path. Length: ${newPath?.length}`); // Log before returning

    return newPath;
}


// --- UI Handlers ---
function handleActivitiesResponse(activities) {
    if (!activities || activities.length === 0) {
        console.log("No activities found.");
        showError("No recent Strava activities found.");
        return;
    }

    const actSelectContainer = document.getElementById("act_select");
    selectList = document.getElementById("select_lst"); // Assign to module var
    if (!selectList || !actSelectContainer) {
        showError("Activity selection UI elements not found.");
        return;
    }

    actSelectContainer.classList.remove('hidden');
    selectList.innerHTML = ''; // Clear previous options

    let defaultOption = document.createElement('option');
    defaultOption.textContent = 'Select an Activity...';
    defaultOption.disabled = true;
    defaultOption.selected = true;
    selectList.appendChild(defaultOption);

    activities.forEach((activity) => {
        let option = document.createElement('option');
        option.textContent = activity.name;
        option.value = activity.id;
        selectList.appendChild(option);
    });

    // Add event listener (only once)
    selectList.onchange = (e) => { // Use onchange to avoid multiple listeners
        const selectedOption = e.target.options[e.target.selectedIndex];
        const activityId = selectedOption.value;

        if (activityId && activityId !== 'Select an Activity...') {
             // Clear existing stats when changing selection
             if (statsContainer) statsContainer.classList.add('hidden');
             // hidePhotoDisplay(); // REMOVED - Popovers handle photo display
             // DO NOT Clear elevation widget path here - let displayDetailedActivity handle it
             // Remove previous polyline and markers
             if (previousPolyline) {
                 try { map3d.removeChild(previousPolyline); } catch (e) { console.warn("Error removing previous polyline:", e); }
                 previousPolyline = null;
             }
             if (photoMarkers.size > 0) {
                 photoMarkers.forEach(marker => { try { map3d.removeChild(marker); } catch (e) { console.warn("Error removing photo marker:", e); } });
                 photoMarkers.clear();
             }

             fetchDetailedActivity(activityId);
        }
    };

    // Add a visual cue after fetching activities
    if (selectList && activities.length > 0) {
        selectList.focus(); // Focus the dropdown
        // Optionally add a temporary highlight or message
        const selectLabel = document.querySelector('label[for="select_lst"]');
        if (selectLabel) {
            const originalText = selectLabel.textContent;
            selectLabel.textContent = "Select an Activity to View!";
            selectLabel.classList.add('text-indigo-600', 'font-semibold');
            setTimeout(() => {
                selectLabel.textContent = originalText;
                selectLabel.classList.remove('text-indigo-600', 'font-semibold');
            }, 3000); // Revert after 3 seconds
        }
    }

    // Auto-select and trigger the first activity if available
    if (selectList.options.length > 1) { // Check if there's more than the placeholder
        selectList.selectedIndex = 1; // Select the first actual activity
        // Trigger the change event to load the activity
        const event = new Event('change', { bubbles: true });
        selectList.dispatchEvent(event);
        console.log(`Auto-selected first activity: ${selectList.options[1].textContent}`);
    }
}

// --- Photo Display Handlers --- (REMOVED - Handled by Popovers)

// --- New Handler for Filtered Fetch ---
function handleFetchFilteredActivities() {
    if (!stravatoken) {
        showError("Not authenticated with Strava.");
        return;
    }
    if (!startDateInput || !endDateInput || !activityCountInput) {
         showError("Filter input elements not found.");
         return;
    }

    const startDate = startDateInput.value; // YYYY-MM-DD
    const endDate = endDateInput.value;     // YYYY-MM-DD
    const count = parseInt(activityCountInput.value, 10) || 30;

    // Convert dates to Unix timestamps (seconds) for Strava API
    // 'before' is the end date (set to end of day)
    // 'after' is the start date (set to start of day)
    let beforeTimestamp = null;
    if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999); // Set to end of the selected day
        beforeTimestamp = Math.floor(endOfDay.getTime() / 1000);
    }

    let afterTimestamp = null;
    if (startDate) {
        const startOfDay = new Date(startDate);
        startOfDay.setHours(0, 0, 0, 0); // Set to start of the selected day
        afterTimestamp = Math.floor(startOfDay.getTime() / 1000);
    }

    // Call the updated fetchActivities function
    fetchActivities(stravatoken, beforeTimestamp, afterTimestamp, count);
}

// --- Set Initial Date Inputs ---
function setInitialDateInputs() {
    const today = new Date();
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(today.getDate() - 90);

    // Format YYYY-MM-DD
    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    if (startDateInput) {
        startDateInput.value = formatDate(ninetyDaysAgo);
    }
    if (endDateInput) {
        endDateInput.value = formatDate(today);
    }
}

// --- Main Initialization ---
async function initApp() {
    console.log("Initializing App...");
    // Get DOM elements needed early
    mapHost = document.getElementById("map3d-host");
    const stravaConnectButton = document.getElementById('strava-connect-button'); // Get the new button
    // pacInput = document.getElementById("pac-input"); // REMOVED reference
    loadingIndicator = document.getElementById('loading-indicator');
    loadingText = document.getElementById('loading-text');
    errorMessageDiv = document.getElementById('error-message');
    statsContainer = document.getElementById('activity-stats');
    activityNameEl = document.getElementById('activity-name');
    activityDistEl = document.getElementById('activity-distance');
    activityTimeEl = document.getElementById('activity-time');
    activityElevEl = document.getElementById('activity-elevation');
    activityAvgSpeedEl = document.getElementById('activity-avg-speed'); // Get new elements
    activityMaxSpeedEl = document.getElementById('activity-max-speed');
    elevationProfileWidget = document.getElementById('elevation-profile'); // Get widget element
    activityAvgSpeedEl = document.getElementById('activity-avg-speed');
    activityMaxSpeedEl = document.getElementById('activity-max-speed');
    elevationProfileWidget = document.getElementById('elevation-profile');
    // Get filter elements
    activityFilterDiv = document.getElementById('activity-filter');
    startDateInput = document.getElementById('start-date');
    endDateInput = document.getElementById('end-date');
    activityCountInput = document.getElementById('activity-count');
    fetchFilteredButton = document.getElementById('fetch-filtered-activities');
    // Get photo display elements - REMOVED
    // photoDisplayDiv = document.getElementById('photo-display');
    // selectedPhotoImg = document.getElementById('selected-photo-img');
    // selectedPhotoCaption = document.getElementById('selected-photo-caption');
    // Get footer elements
    footerAthleteInfo = document.getElementById('footer-athlete-info');
    footerProfileImg = document.getElementById('footer-strava_profile');
    footerProfileName = document.getElementById('footer-strava-username');
    logoutButton = document.getElementById('logout-button');


    if (!mapHost || !activityFilterDiv || !fetchFilteredButton /*|| !photoDisplayDiv*/ || !footerAthleteInfo || !logoutButton) { // Removed photoDisplayDiv check
        showError("Essential HTML elements (#map3d-host, filter, footer) are missing.");
        return;
    }

    // Set initial date inputs
    setInitialDateInputs();

    showLoading(true, "Loading Google Maps...");
    const loader = new Loader({
        apiKey: import.meta.env.VITE_GMP_API_KEY,
        version: "alpha", // Reverting to alpha channel as requested
        libraries: ["maps3d", "marker", "elevation", "places", "geometry", "core"]
    });

    try {
        await loader.load();
        console.log("Google Maps API loaded.");

        // Import necessary classes *after* API is loaded
        ({ Map3DElement, Marker3DInteractiveElement, Polyline3DElement, AltitudeMode, MapMode, PopoverElement } = await google.maps.importLibrary("maps3d")); // Added PopoverElement
        ({ PinElement } = await google.maps.importLibrary("marker"));
        ({ ElevationService, ElevationElement } = await google.maps.importLibrary("elevation")); // Import ElevationElement
        ({ Place } = await google.maps.importLibrary("places")); // Autocomplete already removed
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
        mapHost.appendChild(map3d);
        console.log("3D Map initialized.");

        // Add basic controls (optional)
        // map3d.compassEnabled = true;
        // map3d.zoomControlEnabled = true;

        // Ensure Autocomplete setup is removed

        // --- Strava Auth Flow ---
        const urlParams = new URLSearchParams(window.location.search);
        const temp_token = urlParams.get('code');
        if (temp_token) {
            // Clear the code from the URL
            window.history.replaceState({}, document.title, window.location.pathname);
            await exchangeToken(temp_token);
        } else {
            // Show auth button and set up dynamic link if no code present
            const stravaAuthDiv = document.getElementById('strava_auth');
            if (stravaAuthDiv) stravaAuthDiv.style.display = 'flex'; // Use flex to maintain centering

            if (stravaConnectButton) {
                const clientId = import.meta.env.VITE_STRAVA_CLIENT_ID;
                const redirectUri = import.meta.env.VITE_STRAVA_REDIRECT_URI; // Read from .env.*
                const stravaAuthScope = 'read_all,activity:read_all'; // Keep scope consistent

                if (!clientId || !redirectUri) {
                    console.error("Strava Client ID or Redirect URI missing from environment variables.");
                    showError("Configuration error: Cannot initiate Strava connection.");
                } else {
                    const stravaAuthUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&approval_prompt=auto&scope=${stravaAuthScope}`;
                    console.log("Strava Auth URL constructed:", stravaAuthUrl); // Log for debugging

                    stravaConnectButton.addEventListener('click', () => {
                        showLoading(true, "Redirecting to Strava..."); // Show loading indicator
                        window.location.href = stravaAuthUrl;
                    });
                }
            } else {
                console.error("Strava connect button not found.");
                showError("UI Error: Strava connect button missing.");
            }

            showLoading(false); // Hide loading if waiting for auth
        }

    } catch (error) {
        console.error("Initialization failed:", error);
        showError(`Map initialization failed: ${error.message}. Check API key or network connection.`);
        showLoading(false);
    }
}

// Start the application
initApp();
