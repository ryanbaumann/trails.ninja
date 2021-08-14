const mapboxgl = require('mapbox-gl');
const stravaApi = require('strava-v3');
var polyline = require('@mapbox/polyline');
var turf_helpers = require('@turf/helpers');
var turf_bbox = require('@turf/bbox').default;
var Analytics = require('analytics-node');
var geocoder = require('@mapbox/mapbox-gl-geocoder');

stravaApi.config({
    "client_id": "1495",
    "client_secret": "c6a039194dfd27cca3cfa042cb6beb741dbf6b4b",
    "redirect_uri": "localhost:9966"
});

var analytics = new Analytics('g1EKnYapBZxgZXSfhCTDgDxbMd5SuYcr');

mapboxgl.accessToken = 'pk.eyJ1IjoicnNiYXVtYW5uIiwiYSI6ImNraXcwOWxwMzA2bXgycm02MDFlNnZremMifQ.8GEyTCpTmNMDtAnxoa3egA';

var map = new mapboxgl.Map({
    container: 'map',
    zoom: 5,
    center: [-114.34411, 32.6141],
    pitch: 70,
    bearing: 0,
    style: 'mapbox://styles/rsbaumann/ckkeu7v0w1ly117qha6hja6yk?optimize=true',
    preserveDrawingBuffer: true,
    optimizeForTerrain: true
});

map.addControl(
    new geocoder({
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
stravaApi.oauth.getToken(temp_token).then(result => {
    if (result.access_token != undefined) {
        // Hide the auth button
        document.getElementById('strava_auth').style.display = "none";
        // Get info about athlete
        var strava_access_token = result.access_token;
        var profile_photo_url = result.athlete.profile_medium;
        var strava_username = result.athlete.firstname + " " + result.athlete.lastname;
        userid = result.athlete.id;

        analytics.identify({
            userId: result.athlete.id,
            traits: {
                name: strava_username,
                email: result.email,
                city: result.athlete.city,
                country: result.athlete.country,
                state: result.athlete.state,
                profile_url: profile_photo_url,
                strava_access_token: strava_access_token,
                createdAt: new Date()
            }
        });

        //Initalize API client for querying
        var strava = new stravaApi.client(strava_access_token);

        //Update DOM with athlete info
        body_el = document.getElementById('body');
        profile_el = document.getElementById('strava_profile');
        profile_el.setAttribute("src", profile_photo_url);
        profile_el.style.display = "";

        var node = document.createElement("p");
        var text_node = document.createTextNode(strava_username);
        node.appendChild(text_node);
        body.appendChild(node);

        strava.athlete.listActivities({}, function (err, payload, limits) {
            var activities = payload;

            document.getElementById("act_select").style.display = "";
            var select_lst = document.getElementById("select_lst");

            for (const key in activities) {
                let option = document.createElement('option');
                option.innerHTML += activities[key].name;
                option.setAttribute('id', activities[key].id);
                option.setAttribute('index', key);
                select_lst.appendChild(option);
            }

            select_lst.addEventListener('change', function (e) {
                for (const key in activities) {
                    if (activities[key].name == e.target.value) {
                        let geojson = turf_helpers.feature(polyline.toGeoJSON(activities[key].map.summary_polyline));
                        actid = activities[key].activity_id
                        let bounding_box = turf_bbox(geojson);

                        map.fitBounds(bounding_box, {
                            padding: 20
                        });
                        map.getSource('route').setData(geojson)
                    }
                }
            });

            var geojson = turf_helpers.feature(polyline.toGeoJSON(activities[0].map.summary_polyline));
            var bounding_box = turf_bbox(geojson);

            map.fitBounds(bounding_box, {
                padding: 20
            });

            map.addSource("route", {
                "type": "geojson",
                "data": geojson
            });
            map.addLayer({
                "id": "route",
                "type": "line",
                "source": "route",
                "paint": {
                    "line-color": "red",
                    "line-width": 5
                },
                "layout": {
                    "line-join": "round"
                }
            }, 'path-pedestrian-label')


        });
    }
});

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
        analytics.track({
            userId: userid,
            event: 'Created Snap',
            properties: {
                activity_id: actid,
                map_center: map.getCenter(),
                map_zoom: map.getZoom()
            }
        });
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
