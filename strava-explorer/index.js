// Removed require('dotenv').config(); - Vite handles .env loading

// Use ES module imports
import mapboxgl from 'mapbox-gl';
// Removed: import stravaApi from 'strava-v3';
import polyline from '@mapbox/polyline';
import * as turf_helpers from '@turf/helpers';
import turf_bbox from '@turf/bbox';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';

// Removed: stravaApi.config({...}); - Handled directly in fetch

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

var map = new mapboxgl.Map({
    container: 'map',
    zoom: 3,
    center: [-114.34411, 32.6141],
    pitch: 0,
    bearing: 0,
    style: 'mapbox://styles/rsbaumann/ckkeu7v0w1ly117qha6hja6yk',
    preserveDrawingBuffer: true,
    projection: 'globe'
});

// Ensure geocoder is imported correctly - assuming MapboxGeocoder is the class
map.addControl(
    new MapboxGeocoder({
        accessToken: mapboxgl.accessToken,
        mapboxgl: mapboxgl
    })
);

map.addControl(new mapboxgl.FullscreenControl());
map.addControl(new mapboxgl.NavigationControl());

// Authenticate to the Strava API using OAuth
var userid, actid;
var queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
var temp_token = urlParams.get('code');
var stravatoken;
var markers = [];

function getPhotos(stravatoken, activityid, map) {
    if (markers.length >0) {
        markers.forEach(function(marker) {
            marker.remove()
        });
        markers = [];
    }

    let photoURL = 'https://www.strava.com/api/v3/activities/' + activityid + '/photos?photo_sources=true&access_token=' + stravatoken + '&size=1000'
    fetch(photoURL)
        .then(response => response.json())
        .then(photos => {
            if (photos.length > 0) {
                photos.forEach(function (photo) {

                    // create DOM element for the marker
                    const el = document.createElement('div');
                    const img = document.createElement('img');
                    img.id = photo.unique_id;
                    img.src = photo.urls["1000"]
                    img.style.height = '100px';
                    img.style.width = '190px';
                    el.appendChild(img);

                    let popup = new mapboxgl.Popup()
                    .setLngLat([ photo.location[1], photo.location[0] ])
                    .setHTML(el.outerHTML)
                    .addTo(map);

                })
            }
        });
}


// Function to exchange auth code for token using fetch
async function exchangeToken(code) {
    const tokenUrl = 'https://www.strava.com/oauth/token';
    const params = new URLSearchParams({
        client_id: import.meta.env.VITE_STRAVA_CLIENT_ID,
        client_secret: import.meta.env.VITE_STRAVA_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code'
    });

    try {
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Strava token exchange failed: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        console.log("Strava Auth Response Data:", data); // Log the whole auth response
        handleSuccessfulAuth(data);

    } catch (error) {
        console.error('Error exchanging Strava token:', error);
        // Handle error appropriately, e.g., show message to user
    }
}

// Function to handle successful authentication and fetch activities
function handleSuccessfulAuth(authData) {
    if (authData.access_token) {
        stravatoken = authData.access_token; // Store the token globally (or better, manage state)
        // Hide the auth button
        document.getElementById('strava_auth').style.display = "none";

        // Get info about athlete from the auth response
        const profile_photo_url = authData.athlete.profile_medium;
        const strava_username = `${authData.athlete.firstname} ${authData.athlete.lastname}`;
        userid = authData.athlete.id;

        // Update DOM with athlete info
        const profileContainer = document.getElementById('athlete-info');
        const profileImg = document.getElementById('strava_profile');
        const profileName = document.getElementById('strava-username');

        if (profileImg) profileImg.src = profile_photo_url;
        if (profileName) profileName.textContent = strava_username;
        if (profileContainer) profileContainer.classList.remove('hidden');

        // Fetch activities using the new token
        fetchActivities(stravatoken);
    } else {
        console.error("Access token not found in Strava auth response:", authData);
    }
}

// Function to fetch activities using fetch
async function fetchActivities(accessToken) {
    console.log("Fetching activities with token:", accessToken);
    const activitiesUrl = 'https://www.strava.com/api/v3/athlete/activities';
    // Revert query parameters to fetch latest 30 activities
    const params = new URLSearchParams({
        per_page: '30' // Fetch latest 30 activities
    });

    try {
        const response = await fetch(`${activitiesUrl}?${params.toString()}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Strava activities fetch failed: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
        }

        // Log raw text first
        const rawResponseText = await response.text();
        console.log("Raw Activities Response Text:", rawResponseText);

        // Then parse
        const activities = JSON.parse(rawResponseText); // Parse the logged text
        console.log("Parsed Activities:", activities); // Log the parsed activities array
        handleActivitiesResponse(activities);

    } catch (error) {
        console.error('Error fetching Strava activities:', error);
        // Handle error appropriately
    }
}

// Function to fetch detailed data for a specific activity
async function fetchDetailedActivity(activityId) {
    if (!stravatoken) {
        console.error("No Strava token available to fetch detailed activity.");
        return;
    }
    if (!activityId) {
        console.error("No Activity ID provided to fetch detailed activity.");
        return;
    }

    console.log(`Fetching detailed data for activity ID: ${activityId}`);
    const detailedActivityUrl = `https://www.strava.com/api/v3/activities/${activityId}`;
    // include_all_efforts=false is default, so not strictly needed unless overriding

    try {
        const response = await fetch(detailedActivityUrl, {
            headers: {
                'Authorization': `Bearer ${stravatoken}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Strava detailed activity fetch failed: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
        }

        const detailedActivityData = await response.json();
        console.log("Detailed Activity Data:", detailedActivityData);
        displayDetailedActivity(detailedActivityData); // Process the detailed data

    } catch (error) {
        console.error('Error fetching Strava detailed activity:', error);
        // Handle error appropriately
    }
}

// Function to display the detailed activity data (polyline, stats)
function displayDetailedActivity(activityData) {
    if (!activityData || !activityData.map || !activityData.map.polyline) {
        console.error("Detailed activity data is missing map polyline:", activityData);
        // Handle missing polyline - maybe show summary or error
        // For now, just log and return
        return;
    }

    const detailedPolyline = activityData.map.polyline;
    actid = activityData.id; // Update global actid if needed

    // Decode polyline and update map
    let geojson = turf_helpers.feature(polyline.toGeoJSON(detailedPolyline));
    let bounding_box = turf_bbox(geojson);

    map.fitBounds(bounding_box, {
        padding: 40 // Increased padding slightly
    });

    // Ensure 'route' source exists before setting data
    if (map.getSource('route')) {
         map.getSource('route').setData(geojson);
    } else {
        // Add source and layer if they don't exist yet
         map.addSource("route", { "type": "geojson", "data": geojson });
         map.addLayer({
             "id": "route",
             "slot": 'middle',
             "type": "line",
             "source": "route",
             "paint": { "line-color": "orange", "line-width": 4 }, // Changed color/width slightly
             "layout": { "line-join": "round" }
         });
    }

    // --- TODO: Update UI with Stats ---
    const distance = (activityData.distance / 1000).toFixed(2); // meters to km
    const movingTimeSeconds = activityData.moving_time; // seconds
    const elevationGain = activityData.total_elevation_gain; // meters

    // Convert moving time to hh:mm:ss (simple example)
    const hours = Math.floor(movingTimeSeconds / 3600);
    const minutes = Math.floor((movingTimeSeconds % 3600) / 60);
    const seconds = movingTimeSeconds % 60;
    const movingTimeFormatted = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    console.log(`Stats - Distance: ${distance} km, Time: ${movingTimeFormatted}, Elev Gain: ${elevationGain} m`);

    // Populate the new HTML elements
    const statsContainer = document.getElementById('activity-stats');
    document.getElementById('activity-name').textContent = activityData.name || 'Unnamed Activity';
    document.getElementById('activity-distance').textContent = `${distance} km`;
    document.getElementById('activity-time').textContent = movingTimeFormatted;
    document.getElementById('activity-elevation').textContent = `${elevationGain} m`;

    // Make the stats container visible
    if (statsContainer) {
        statsContainer.classList.remove('hidden');
    }

    // Fetch photos for the selected activity
    getPhotos(stravatoken, activityData.id, map);
}


// Function to process the fetched activities and update the UI
function handleActivitiesResponse(activities) {
    if (!activities || activities.length === 0) {
        console.log("No activities found or empty response.");
        // Handle case with no activities
        return;
    }

    const actSelectContainer = document.getElementById("act_select");
    if (actSelectContainer) actSelectContainer.classList.remove('hidden'); // Unhide dropdown container
    const select_lst = document.getElementById("select_lst");
    select_lst.innerHTML = ''; // Clear previous options

    // Add a default option
    let defaultOption = document.createElement('option');
    defaultOption.textContent = 'Select an Activity...';
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select_lst.appendChild(defaultOption);


    activities.forEach((activity, index) => {
        let option = document.createElement('option');
        option.textContent = activity.name; // Use textContent for safety
        option.value = activity.id; // Store activity ID in value
        // Store necessary data directly on the option element for easy access later
        option.dataset.polyline = activity.map?.summary_polyline || '';
        option.dataset.index = index; // Keep index if needed elsewhere
        select_lst.appendChild(option);
    });

    // --- MODIFIED Event Listener ---
    select_lst.addEventListener('change', function (e) {
        const selectedOption = e.target.options[e.target.selectedIndex];
        const activityId = selectedOption.value;

        if (activityId && activityId !== 'Select an Activity...') {
             fetchDetailedActivity(activityId); // Call function to fetch detailed data
        }
    });

    // --- REMOVED Default loading of first activity's summary polyline ---
    // We now only load detailed data when an activity is explicitly selected.
}

// --- Main execution flow ---
if (temp_token) {
    exchangeToken(temp_token); // Call the new fetch-based token exchange function
}
// The rest of the map initialization code remains below...

map.on('load', function () {

    //Trigger a screenshot
    var map_div = document.getElementById('map');
    var snapshot = document.getElementById('snapshot');
    var ctx = snapshot.getContext('2d');
    var scale = window.devicePixelRatio;

    snapshot.height = map_div.offsetHeight * scale;
    snapshot.width = map_div.offsetWidth * scale;

    map.on('resize', function () {
        snapshot.height = map_div.offsetHeight * scale;
        snapshot.width = map_div.offsetWidth * scale;
    });

    document.getElementById('take_snap').addEventListener('click', function (e) {
        var png = map.getCanvas().toDataURL();
        var copy = new Image();
        copy.src = png;
        copy.onload = function () {
            ctx.drawImage(copy, 0, 0);
            logo();
            textbox();
            var a = document.createElement("a"); //Create <a>
            a.href = snapshot.toDataURL('image/jpeg', 1.0); //Image Base64 Goes here
            a.download = "snapshot.jpeg"; //File name Here
            a.click(); //Downloaded file
        };
    });

    function textbox() {
        // OpenStreetMap and Mapbox attribution are required by
        // the Mapbox terms of service: https://www.mapbox.com/tos/#[YmdMYmdM]

        // set text sizing
        var text = '© Mapbox © OpenStreetMap';
        if (snapshot.width < 300) text = '© OSM';
        var fontsize = 14;
        var height = (fontsize + 6) * scale;
        var width = ((text.length + 3) / fontsize * 100) * scale;

        // draw attribution to canvas
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillRect(snapshot.width - width, snapshot.height - height, width, height);
        ctx.font = (fontsize * scale) + 'px Arial';
        ctx.fillStyle = 'black';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(text, snapshot.width - width + 5, snapshot.height - 5);
    }

    function logo() {
        // OpenStreetMap and Mapbox attribution are required by
        // the Mapbox terms of service: https://www.mapbox.com/tos/#[YmdMYmdM]
        var img = new Image();

        // use the Mapbox logo within the LogoControl as the source image
        var a = document.querySelector('a.mapboxgl-ctrl-logo');
        console.log(a)
        var style = window.getComputedStyle(a, false);

        // remove "url('')" from the background-image property
        var dataURL = style.backgroundImage.slice(5, -2);

        // logo size
        var logoHeight = style.height.replace('px', '');
        var logoWidth = style.width.replace('px', '');
        var logoSVG = firefoxBugFix(dataURL, logoHeight * scale, logoWidth * scale);

        var logo = { 'image': logoSVG, 'height': logoHeight * scale, 'width': logoWidth * scale };
        img.src = logo.image;

        // draw the logo in img (when ready)
        img.onload = function () {
            ctx.drawImage(img, 5, snapshot.height - logo.height - 5, logo.width, logo.height);
        };
    }


    function firefoxBugFix(dataURL, height, width) {
        // Firefox requires SVG to have height and width specified
        // in the root SVG object when drawing to canvas

        // get raw SVG markup by removing the data type, charset, and escaped quotes
        var svg = unescape(dataURL.replace('data:image/svg+xml;charset=utf-8,', '').replace(/\\'/g, '"'));
        var newHeader = "height= \"" + height + "px\" width= \"" + width + "px\"";
        var newSvg = svg.replace('<svg', '<svg ' + newHeader);
        var newBase64 = btoa(newSvg);
        var newDataURL = 'data:image/svg+xml;base64,' + newBase64;

        return newDataURL;
    }

});
