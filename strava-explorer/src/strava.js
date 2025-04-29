// strava-explorer/strava.js

// --- Module-Level Variables ---
let stravatoken = null;
let userid = null;

// --- Environment Variables ---
const STRAVA_CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = import.meta.env.VITE_STRAVA_CLIENT_SECRET;
const STRAVA_REDIRECT_URI = import.meta.env.VITE_STRAVA_REDIRECT_URI;

// --- Helper Functions (Dependencies - will be passed or imported if moved to utils) ---
let showLoading = (isLoading, text) => console.log(`Loading: ${isLoading}, Text: ${text}`);
let showError = (message) => console.error(`Error: ${message}`);

// Function to set helper dependencies (called from index.js)
export function setHelpers(helpers) {
    showLoading = helpers.showLoading;
    showError = helpers.showError;
}

// --- Strava Auth ---
export async function exchangeToken(code) {
    if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
        throw new Error("Strava Client ID or Secret is missing from environment variables.");
    }
    const tokenUrl = 'https://www.strava.com/oauth/token';
    const params = new URLSearchParams({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
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
        if (data.access_token) {
            stravatoken = data.access_token;
            userid = data.athlete?.id;
            return data; // Return the full auth data including athlete info
        } else {
            throw new Error("Access token not found in Strava auth response.");
        }
    } catch (error) {
        console.error('Error exchanging Strava token:', error);
        showError(`Strava authentication failed: ${error.message}`);
        throw error; // Re-throw error to be caught by caller
    } finally {
        showLoading(false);
    }
}

export function getStravaToken() {
    return stravatoken;
}

export function getUserId() {
    return userid;
}

export function clearStravaToken() {
    stravatoken = null;
    userid = null;
}

export function getStravaAuthUrl() {
    if (!STRAVA_CLIENT_ID || !STRAVA_REDIRECT_URI) {
        console.error("Strava Client ID or Redirect URI missing from environment variables.");
        showError("Configuration error: Cannot initiate Strava connection.");
        return null;
    }
    const stravaAuthScope = 'read_all,activity:read_all';
    return `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(STRAVA_REDIRECT_URI)}&approval_prompt=auto&scope=${stravaAuthScope}`;
}


// --- Strava API Fetching ---

export async function fetchActivities(accessToken, beforeTimestamp = null, afterTimestamp = null, perPage = 30) {
    console.log(`Fetching activities with token: ${accessToken ? '******' : 'null'}, Before: ${beforeTimestamp}, After: ${afterTimestamp}, Count: ${perPage}`);
    if (!accessToken) throw new Error("Strava access token is required.");

    const activitiesUrl = 'https://www.strava.com/api/v3/athlete/activities';
    const params = new URLSearchParams();

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
        return activities;

    } catch (error) {
        console.error('Error fetching Strava activities:', error);
        showError(`Failed to fetch activities: ${error.message}`);
        throw error;
    } finally {
        showLoading(false);
    }
}

export async function fetchDetailedActivityData(activityId, accessToken) {
    if (!accessToken) {
        showError("Not authenticated with Strava.");
        throw new Error("Not authenticated with Strava.");
    }
    if (!activityId) {
        showError("No Activity ID provided.");
        throw new Error("No Activity ID provided.");
    }

    console.log(`Fetching detailed data for activity ID: ${activityId}`);
    const detailedActivityUrl = `https://www.strava.com/api/v3/activities/${activityId}`;

    showLoading(true, "Fetching activity details...");
    try {
        const response = await fetch(detailedActivityUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        console.log(`[fetchDetailedActivityData] Called for activity ID: ${activityId}`);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Strava detailed activity fetch failed: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
        }

        const detailedActivityData = await response.json();
        console.log("Detailed Activity Data:", detailedActivityData);
        return detailedActivityData;

    } catch (error) {
        console.error('Error fetching Strava detailed activity:', error);
        showError(`Failed to fetch activity details: ${error.message}`);
        throw error;
    } finally {
        showLoading(false);
        console.log(`[fetchDetailedActivityData] Successfully fetched data for ${activityId}.`);
    }
}


export async function fetchPhotoData(activityId, accessToken) {
    console.log(`[fetchPhotoData] Called for activity ID: ${activityId}`);
    if (!accessToken) throw new Error("Strava access token is required.");
    if (!activityId) throw new Error("Activity ID is required.");

    let photoURL = `https://www.strava.com/api/v3/activities/${activityId}/photos?photo_sources=true&access_token=${accessToken}&size=1000`;
    showLoading(true, "Fetching activity photos...");
    try {
        const response = await fetch(photoURL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const photos = await response.json();
        console.log(`[fetchPhotoData] Received ${photos.length} photos from Strava:`, photos);
        return photos;
    } catch (error) {
        console.error("Error fetching Strava photos:", error);
        showError(`Failed to load photos: ${error.message}`);
        throw error; // Re-throw
    } finally {
        showLoading(false);
    }
}