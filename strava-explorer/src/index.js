// strava-explorer/index.js - Main application orchestrator

import * as strava from './strava.js';
import * as gmp from './gmp.js';
import { setFollowCameraState, stopFollowCamera } from './followCamera.js'; // Import specific functions

// --- Module-Level Variables ---
let currentActivityId = null; // Keep track of the currently displayed activity ID
let currentRouteCoords = null; // Store the LatLng array for the current route

// --- DOM Element References ---
let mapHost, loadingIndicator, loadingText, errorMessageDiv, statsContainer, activityNameEl, activityDistEl, activityTimeEl, activityElevEl, activityAvgSpeedEl, activityMaxSpeedEl, elevationProfileWidget, selectList, activityFilterDiv, startDateInput, endDateInput, activityCountInput, fetchFilteredButton, footerAthleteInfo, footerProfileImg, footerProfileName, logoutButton, stravaConnectButton, stravaAuthDiv, followCameraToggle;

// --- Utility Functions (Passed to Modules) ---
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

// --- Initialization ---
async function initApp() {
    console.log("Initializing App...");
    // Get DOM elements
    mapHost = document.getElementById("map3d-host");
    stravaConnectButton = document.getElementById('strava-connect-button');
    stravaAuthDiv = document.getElementById('strava_auth');
    loadingIndicator = document.getElementById('loading-indicator');
    loadingText = document.getElementById('loading-text');
    errorMessageDiv = document.getElementById('error-message');
    statsContainer = document.getElementById('activity-stats');
    activityNameEl = document.getElementById('activity-name');
    activityDistEl = document.getElementById('activity-distance');
    activityTimeEl = document.getElementById('activity-time');
    activityElevEl = document.getElementById('activity-elevation');
    activityAvgSpeedEl = document.getElementById('activity-avg-speed');
    activityMaxSpeedEl = document.getElementById('activity-max-speed');
    elevationProfileWidget = document.getElementById('elevation-profile');
    activityFilterDiv = document.getElementById('activity-filter');
    startDateInput = document.getElementById('start-date');
    endDateInput = document.getElementById('end-date');
    activityCountInput = document.getElementById('activity-count');
    fetchFilteredButton = document.getElementById('fetch-filtered-activities');
    footerAthleteInfo = document.getElementById('footer-athlete-info');
    footerProfileImg = document.getElementById('footer-strava_profile');
    footerProfileName = document.getElementById('footer-strava-username');
    logoutButton = document.getElementById('logout-button');
    followCameraToggle = document.getElementById('follow-camera-toggle');

    if (!mapHost || !activityFilterDiv || !fetchFilteredButton || !footerAthleteInfo || !logoutButton || !stravaConnectButton || !stravaAuthDiv || !followCameraToggle) {
        showError("Essential HTML elements are missing. Cannot initialize.");
        return;
    }

    // Pass helper functions to modules
    const helpers = { showLoading, showError };
    strava.setHelpers(helpers);
    gmp.setHelpers(helpers);

    // Set initial date inputs for filters
    setInitialDateInputs();

    try {
        // Initialize Google Maps Platform
        await gmp.initMap(mapHost, import.meta.env.VITE_GMP_API_KEY);

        // --- Strava Auth Flow ---
        const urlParams = new URLSearchParams(window.location.search);
        const temp_token = urlParams.get('code');

        if (temp_token) {
            // Clear the code from the URL
            window.history.replaceState({}, document.title, window.location.pathname);
            const authData = await strava.exchangeToken(temp_token);
            handleSuccessfulAuth(authData);
        } else {
            // Show auth button and set up dynamic link if no code present
            stravaAuthDiv.style.display = 'flex'; // Use flex to maintain centering
            const authUrl = strava.getStravaAuthUrl();
            if (authUrl) {
                stravaConnectButton.addEventListener('click', () => {
                    showLoading(true, "Redirecting to Strava...");
                    window.location.href = authUrl;
                });
            } else {
                 console.error("Could not get Strava Auth URL."); // Error already shown by strava.js
            }
            showLoading(false); // Hide loading if waiting for auth
        }

    } catch (error) {
        console.error("Initialization failed:", error);
        // Error should have been shown by the module that failed (gmp.initMap or strava.exchangeToken)
        showLoading(false);
    }

    // Add listener for the follow camera toggle
    followCameraToggle.addEventListener('change', (event) => {
        const isChecked = event.target.checked;
        console.log(`Follow camera toggled: ${isChecked}`);
        if (isChecked && !currentRouteCoords) {
            showError("Cannot enable follow camera: No activity route loaded.");
            event.target.checked = false; // Revert toggle if no route
            return;
        }
        // Start immediately when toggled manually, no delay
        setFollowCameraState(isChecked, currentRouteCoords, false); // Use direct import
    });
}

// --- Authentication Handling ---
function handleSuccessfulAuth(authData) {
    if (!authData || !authData.access_token) {
        showError("Strava authentication succeeded but no access token was received.");
        console.error("Invalid authData received:", authData);
        return;
    }

    stravaAuthDiv.style.display = "none";

    // Update footer profile info
    if (footerProfileImg) footerProfileImg.src = authData.athlete.profile_medium;
    if (footerProfileName) footerProfileName.textContent = `${authData.athlete.firstname} ${authData.athlete.lastname}`;
    if (footerAthleteInfo) footerAthleteInfo.classList.remove('hidden');

    // Show the filter section
    if (activityFilterDiv) activityFilterDiv.classList.remove('hidden');

    // Add listener to the fetch button
    if (fetchFilteredButton) {
        fetchFilteredButton.addEventListener('click', handleFetchFilteredActivities);
    } else {
         console.error("Fetch filtered activities button not found.");
    }

    // Add listener for logout button and make it visible
    if (logoutButton) {
        logoutButton.classList.remove('hidden');
        logoutButton.addEventListener('click', handleLogout);
    } else {
        console.error("Logout button not found.");
    }

    // Trigger initial fetch with default filters
    handleFetchFilteredActivities();
}

function handleLogout() {
    console.log("Logging out...");
    strava.clearStravaToken(); // Clear token in the strava module
    // Hide footer info and logout button immediately
    if (footerAthleteInfo) footerAthleteInfo.classList.add('hidden');
    if (logoutButton) logoutButton.classList.add('hidden');
    // Reload page to show auth button and clear state
    window.location.href = window.location.pathname;
}


// --- Activity Fetching and Filtering ---
async function handleFetchFilteredActivities() {
    const token = strava.getStravaToken();
    if (!token) {
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

    // Convert dates to Unix timestamps (seconds)
    let beforeTimestamp = null;
    if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        beforeTimestamp = Math.floor(endOfDay.getTime() / 1000);
    }

    let afterTimestamp = null;
    if (startDate) {
        const startOfDay = new Date(startDate);
        startOfDay.setHours(0, 0, 0, 0);
        afterTimestamp = Math.floor(startOfDay.getTime() / 1000);
    }

    try {
        const activities = await strava.fetchActivities(token, beforeTimestamp, afterTimestamp, count);
        handleActivitiesResponse(activities);
    } catch (error) {
        // Error should have been shown by strava.fetchActivities
        console.error("Failed to fetch or handle activities:", error);
    }
}

// --- Activity List Handling ---
function handleActivitiesResponse(activities) {
    const actSelectContainer = document.getElementById("act_select");
    selectList = document.getElementById("select_lst"); // Assign to module var
    if (!selectList || !actSelectContainer) {
        showError("Activity selection UI elements not found.");
        return;
    }

    if (!activities || activities.length === 0) {
        console.log("No activities found for the selected filters.");
        showError("No Strava activities found matching the criteria.");
        selectList.innerHTML = '<option disabled selected>No activities found</option>';
        actSelectContainer.classList.remove('hidden'); // Show the (empty) dropdown
        // Clear previous activity display if any
        clearActivityDisplay();
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

    // Add event listener (replace previous if any)
    selectList.onchange = handleActivitySelectionChange;

    // Add a visual cue
    if (selectList && activities.length > 0) {
        selectList.focus();
        const selectLabel = document.querySelector('label[for="select_lst"]');
        if (selectLabel) {
            const originalText = selectLabel.textContent;
            selectLabel.textContent = "Select an Activity to View!";
            selectLabel.classList.add('text-indigo-600', 'font-semibold');
            setTimeout(() => {
                selectLabel.textContent = originalText;
                selectLabel.classList.remove('text-indigo-600', 'font-semibold');
            }, 3000);
        }
    }

    // Auto-select and trigger the first activity
    if (selectList.options.length > 1) {
        selectList.selectedIndex = 1;
        handleActivitySelectionChange({ target: selectList }); // Simulate event
        console.log(`Auto-selected first activity: ${selectList.options[1].textContent}`);
    } else {
        // If only the placeholder exists, clear any previous display
        clearActivityDisplay();
    }
}

function handleActivitySelectionChange(event) {
    const selectedOption = event.target.options[event.target.selectedIndex];
    const activityId = selectedOption.value;

    if (activityId && activityId !== 'Select an Activity...') {
         clearActivityDisplay(); // Clear map and stats before fetching new
         fetchAndDisplayDetailedActivity(activityId);
    }
}

// --- Detailed Activity Display ---
function clearActivityDisplay() {
    console.log("Clearing previous activity display (map elements, stats)...");
    // Clear map elements using GMP module functions and direct followCamera import
    stopFollowCamera(); // Stop any active animation (Use direct import)
    gmp.removePreviousPolyline();
    gmp.clearPhotoMarkers();
    currentRouteCoords = null; // Clear stored coordinates

    // Clear UI stats
    if (statsContainer) statsContainer.classList.add('hidden');
    if (activityNameEl) activityNameEl.textContent = '';
    if (activityDistEl) activityDistEl.textContent = '';
    if (activityTimeEl) activityTimeEl.textContent = '';
    if (activityElevEl) activityElevEl.textContent = '';
    if (activityAvgSpeedEl) activityAvgSpeedEl.textContent = '';
    if (activityMaxSpeedEl) activityMaxSpeedEl.textContent = '';

    // Clear elevation widget path
    if (elevationProfileWidget) {
        // Await definition before trying to set path (safer)
        customElements.whenDefined('gmp-elevation').then(() => {
            try {
                elevationProfileWidget.path = null; // Use null to clear
                console.log("Cleared elevation widget path.");
            } catch (e) {
                console.warn("Could not clear elevation widget path:", e);
            }
        });
    }
    currentActivityId = null;
    // Ensure toggle is off when activity cleared
    if (followCameraToggle) followCameraToggle.checked = false;
}


async function fetchAndDisplayDetailedActivity(activityId) {
    const token = strava.getStravaToken();
    if (!token) {
        showError("Cannot fetch details, not authenticated.");
        return;
    }
    if (!activityId) {
        showError("Cannot fetch details, no Activity ID provided.");
        return;
    }
    currentActivityId = activityId; // Store the ID of the activity being displayed

    try {
        const detailedActivityData = await strava.fetchDetailedActivityData(activityId, token);
        await displayDetailedActivity(detailedActivityData); // Pass data to display function
    } catch (error) {
        console.error(`Failed to fetch or display detailed activity ${activityId}:`, error);
        // Error should have been shown by strava.fetchDetailedActivityData or displayDetailedActivity
        // Optionally show a generic error here if needed
        // showError("Failed to load activity details.");
    }
}

async function displayDetailedActivity(activityData) {
    console.log(`[displayDetailedActivity] Called with data for activity ID: ${activityData?.id}`);
    if (!activityData?.map?.polyline) {
        showError("Detailed activity data is missing map polyline.");
        console.error("Missing polyline:", activityData);
        return;
    }
    // Use loose inequality (!=) to handle type difference (number vs string)
    if (activityData.id != currentActivityId) {
        console.warn(`[displayDetailedActivity] Stale data received for ${activityData.id}, expected ${currentActivityId}. Ignoring.`);
        return; // Avoid race condition where an old request finishes after a new one started
    }

    showLoading(true, "Processing activity route...");

    // --- Polyline and Camera ---
    const decodedPathLatLng = gmp.decodePolyline(activityData.map.polyline);
    if (decodedPathLatLng.length > 0) {
        gmp.displayPolyline(decodedPathLatLng); // Display on map

        // Calculate bounds and fly camera
        const LatLngBounds = gmp.getLatLngBoundsClass();
        const LatLng = gmp.getLatLngClass(); // Get LatLng class if needed for distance calc
        const bounds = new LatLngBounds();
        decodedPathLatLng.forEach(p => bounds.extend(p));

        if (!bounds.isEmpty() && google?.maps?.geometry?.spherical) { // Check if geometry library loaded
            const center = bounds.getCenter().toJSON();
            const ne = bounds.getNorthEast().toJSON();
            const sw = bounds.getSouthWest().toJSON();
            // Use GMP geometry library for distance calculation
            const diagonalDistance = google.maps.geometry.spherical.computeDistanceBetween(
                new LatLng(ne.lat, ne.lng),
                new LatLng(sw.lat, sw.lng)
            );
            const range = Math.max(1000, diagonalDistance * 1.5);
            console.log(`[displayDetailedActivity] Flying to bounds center. Range: ${range}`);
            await gmp.flyToLocation(center, range, 60, 0); // Await camera movement
        } else if (!bounds.isEmpty()) {
            // Fallback if geometry library not available (fly to center with default range)
            const center = bounds.getCenter().toJSON();
            console.warn("[displayDetailedActivity] Geometry library not available for range calculation. Using default range.");
            await gmp.flyToLocation(center, 5000, 60, 0); // Use a larger default range
        }
    } else {
        showError("Failed to decode or process activity route.");
        showLoading(false);
        showLoading(false);
        return; // Stop if polyline is bad
    }

    // Store coordinates for toggle use and start follow camera
    currentRouteCoords = decodedPathLatLng;
    if (followCameraToggle) followCameraToggle.checked = true; // Ensure toggle is ON by default for new route
    setFollowCameraState(true, currentRouteCoords, true); // Start with 5-second delay (Use direct import)

    showLoading(false); // Hide loading after polyline processing and camera flight start

    // --- Update UI Stats (Imperial Units) ---
    updateStatsUI(activityData);

    // --- Configure Elevation Profile Widget ---
    configureElevationWidget(decodedPathLatLng); // Pass the LatLng array

    // --- Fetch and Display Photos ---
    const token = strava.getStravaToken();
    if (token) {
        try {
            const photosData = await strava.fetchPhotoData(activityData.id, token);
            // Use loose equality (==) to handle type difference (number vs string)
            if (activityData.id == currentActivityId) { // Check again before displaying photos
                 await gmp.displayPhotoMarkers(photosData);
            } else {
                 console.warn(`[displayDetailedActivity] Stale photo data received for ${activityData.id}, expected ${currentActivityId}. Ignoring.`);
            }
        } catch (photoError) {
            console.error("Failed to fetch or display photos:", photoError);
            // Don't necessarily stop the whole process, just log the error
        }
    }
}

function updateStatsUI(activityData) {
    const metersToFeet = 3.28084;
    const kmToMiles = 0.621371;
    const mpsToMph = 2.23694;

    const distanceMiles = (activityData.distance / 1000 * kmToMiles).toFixed(2);
    const movingTimeSeconds = activityData.moving_time;
    const elevationGainFeet = (activityData.total_elevation_gain * metersToFeet).toFixed(0) || 'N/A';
    const avgSpeedMps = activityData.average_speed || 0;
    const maxSpeedMps = activityData.max_speed || 0;
    const avgSpeedMph = (avgSpeedMps * mpsToMph).toFixed(1);
    const maxSpeedMph = (maxSpeedMps * mpsToMph).toFixed(1);

    const hours = Math.floor(movingTimeSeconds / 3600);
    const minutes = Math.floor((movingTimeSeconds % 3600) / 60);
    const seconds = movingTimeSeconds % 60;
    const movingTimeFormatted = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    if (activityNameEl) activityNameEl.textContent = activityData.name || 'Unnamed Activity';
    if (activityDistEl) activityDistEl.textContent = `${distanceMiles} mi`;
    if (activityTimeEl) activityTimeEl.textContent = movingTimeFormatted;
    if (activityElevEl) activityElevEl.textContent = `${elevationGainFeet} ft`;
    if (activityAvgSpeedEl) activityAvgSpeedEl.textContent = `${avgSpeedMph} mph`;
    if (activityMaxSpeedEl) activityMaxSpeedEl.textContent = `${maxSpeedMph} mph`;
    if (statsContainer) statsContainer.classList.remove('hidden');
    console.log("[updateStatsUI] UI stats updated.");
}

async function configureElevationWidget(decodedPathLatLng) { // Expects array of LatLng objects
    if (!elevationProfileWidget) return;

    console.log(`[configureElevationWidget] Configuring elevation profile widget.`);
    try {
        await customElements.whenDefined('gmp-elevation');
        console.log(`[configureElevationWidget] gmp-elevation element is defined.`);

        if (decodedPathLatLng && decodedPathLatLng.length > 0) {
            const maxPoints = 300; // Target maximum points for the profile
            console.log(`[configureElevationWidget] Calling gmp.downsamplePath with path length: ${decodedPathLatLng.length}`);
            const downsampledPath = gmp.downsamplePath(decodedPathLatLng, maxPoints); // Use GMP module's downsampler
            console.log(`[configureElevationWidget] Downsampled path created. Length: ${downsampledPath?.length}`);

            if (Array.isArray(downsampledPath) && downsampledPath.length > 0) {
                 // Log the first point for verification
                 const firstPoint = downsampledPath[0];
                 console.log(`Attempting to set elevation path with ${downsampledPath.length} LatLng points. First point: {lat: ${firstPoint.lat()}, lng: ${firstPoint.lng()}}`);
                try {
                    elevationProfileWidget.path = downsampledPath; // Assign the LatLng array
                    console.log("[configureElevationWidget] Successfully assigned path to elevation widget.");
                } catch (elevationError) {
                    console.error("[configureElevationWidget] Error setting elevation path:", elevationError);
                    showError(`Failed to display elevation profile: ${elevationError.message}`);
                }
            } else {
                console.warn("[configureElevationWidget] Downsampled path is empty or invalid, clearing elevation path.");
                elevationProfileWidget.path = null; // Clear path if downsampling failed
            }
        } else {
            console.log("[configureElevationWidget] No valid path data, clearing elevation path.");
            elevationProfileWidget.path = null; // Clear path if no input data
        }
    } catch (e) {
        console.error("Error configuring elevation widget:", e);
        showError("Could not display elevation profile.");
        if (elevationProfileWidget) elevationProfileWidget.path = null; // Attempt to clear on error
    }
}


// --- UI Helpers ---
function setInitialDateInputs() {
    const today = new Date();
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(today.getDate() - 90);

    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    if (startDateInput) startDateInput.value = formatDate(ninetyDaysAgo);
    if (endDateInput) endDateInput.value = formatDate(today);
}


// --- Start Application ---
initApp();
