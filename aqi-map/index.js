"use strict";

const mapboxgl = require('mapbox-gl');
const MapboxGeocoder = require('@mapbox/mapbox-gl-geocoder');
const turfHelpers = require("@turf/helpers");
const turfTruncate = require("@turf/truncate").default;
const turfCleanCoords = require('@turf/clean-coords').default;
const d3 = require("d3-tricontour");

mapboxgl.accessToken = 'pk.eyJ1IjoicnNiYXVtYW5uIiwiYSI6ImNqdzg5aWxkYzF1azI0OW5uaWVmazhleXUifQ.XAm1dRGmXuRAMSQm0TJKXg';

var map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/rsbaumann/cks3iz3ka5dag18mljlnfp0xx?optimize=true',
  center: [-103.59179687498357, 40.66995747013945],
  zoom: 3,
  hash: true,
  projection: 'albers'
});

map.addControl(
  new MapboxGeocoder({
    accessToken: mapboxgl.accessToken,
    mapboxgl: mapboxgl,
    marker: {
      color: 'blue'
    },
  })
);

map.addControl(new mapboxgl.GeolocateControl({}));

var geojson_data = {
  "type": "FeatureCollection",
  "features": []
}
var points_for_contours = [];

const isLatitude = num => isFinite(num) && Math.abs(num) <= 90 && num != 0;
const isLongitude = num => isFinite(num) && Math.abs(num) <= 180 && num != 0;

map.on('style.load', function () {
  var all_range = 'https://www.purpleair.com/data.json?exclude=true&fields=pm_1,pm_cf_1,humidity'
  fetch(all_range)
    .then(response => response.json())
    .then(mydata => {
      mydata.data.forEach(function (row) {
        let data = {}
        data['id'] = row[0];
        data['pm_cf1'] = row[1];
        data['age'] = row[2];
        data['pm_1'] = row[3];
        data['conf'] = row[4];
        data['humidity'] = row[5];
        data['type'] = parseInt(row[6]);
        data['label'] = row[7];
        data['lat'] = row[8];
        data['long'] = row[9];
        data['isOwner'] = row[10];
        data['flags'] = row[11];
        data['CH'] = row[12];
        data['aqi_raw'] = aqiFromPM(data['pm_1']);

        if (
          (data['age'] <= 10) && // only include sensors updating in last 10 mins
          (isLongitude(data['long'])) &&
          (isLatitude(data['lat'])) &&
          (data['flags'] == 0) && // remove sensors with faults
          (data['type'] == 0) && // Only include outdoor sensors
          (data['conf'] >= 96) // Only include high confidence sensor values
        ) {
          // Contour calculator
          points_for_contours.push([parseFloat(data['long']), parseFloat(data['lat']), data['aqi_raw']]);
          geojson_data.features.push(turfTruncate(turfCleanCoords({
            "type": "Feature",
            "id": data['id'],
            "properties": {
              "aqi_raw": data['aqi_raw'],
              "name": data['label'],
              "pm_1": data['pm_1'],
              "pm_cf1": data['pm_cf1'],
              "conf": data['conf'],
              "humidity": data['humidity'],
              "description": getAQIDescription(data['aqi_raw']),
              "message": getAQIMessage(data['aqi_raw'])
            },
            "geometry": {
              "type": "Point",
              "coordinates": [
                parseFloat(data['long']),
                parseFloat(data['lat'])
              ]
            }
          }), {
            precision: 6
          }))
        }
      });

      var breaks = [0, 25, 50, 75, 100, 125, 150, 200, 250, 300, 350]
      const tric = d3.tricontour().thresholds(breaks);
      var contours = tric(points_for_contours)
      var features = [];
      contours.forEach(function (c) {
        var value = c.value;
        delete c.value;
        features.push({
          "type": "Feature",
          "geometry": c,
          "properties": {
            "value": value
          }
        })

      })

      var contours = turfHelpers.featureCollection(features);

      map.addSource('isobands', {
        type: 'geojson',
        data: contours,
        buffer: 10
      });

      map.addLayer({
        id: "ranges",
        type: "fill",
        source: "isobands",
        paint: {
          "fill-color": [
            'interpolate', ['linear'],
            ["get", "value"],
            0,
            '#8fec74',
            50,
            '#77c853',
            51,
            '#ffff00',
            100,
            '#dfb743',
            101,
            '#f5ba2a',
            150,
            '#d3781c',
            151,
            '#da5340',
            200,
            '#bc2f26',
            201,
            '#9c2424',
            300,
            '#661414',
            301,
            '#76205d',
            400,
            '#521541'
          ],
          "fill-opacity": 0.5
        }
      }, 'water')

      map.addSource('sensors', {
        type: 'geojson',
        data: geojson_data,
        cluster: true,
        buffer: 25,
        clusterMaxZoom: 14,
        clusterRadius: 28,
        clusterProperties: {
          "sum": ["+", ["get", "aqi_raw"]],
          "max": ["max", ["get", "aqi_raw"]]
        }
      });

      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'sensors',
        filter: ['has', 'sum'],
        paint: {
          'circle-color': [
            'interpolate', ['linear'],
            ["/", ['get', 'sum'],
              ["get", "point_count"]
            ],
            0,
            '#8fec74',
            50,
            '#77c853',
            51,
            '#ffff00',
            100,
            '#dfb743',
            101,
            '#f5ba2a',
            150,
            '#d3781c',
            151,
            '#da5340',
            200,
            '#bc2f26',
            201,
            '#9c2424',
            300,
            '#661414',
            301,
            '#76205d',
            400,
            '#521541'
          ],
          'circle-stroke-color': "white",
          'circle-stroke-width': 1,
          'circle-radius': [
            'interpolate', ['exponential', 1.2],
            ["zoom"],
            0,
            15,
            18,
            30
          ]
        }
      }, 'water-point-label');



      map.addLayer({
        id: 'cluster-count-label',
        type: 'symbol',
        source: 'sensors',
        filter: ['has', 'sum'],
        layout: {
          'text-field': ["number-format", ["/", ['get', 'sum'],
            ["get", "point_count"]
          ], {
              "max-fraction-digits": 1
            }],
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 12,
        },
        paint: {
          'text-halo-color': "rgba(255, 255, 255, 1)",
          'text-halo-width': [
            'interpolate', ['exponential', 1.2],
            ["zoom"],
            0,
            1,
            18,
            3
          ]
        }
      });

      map.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: 'sensors',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': [
            'interpolate', ['linear'],
            ["get", "aqi_raw"],
            0,
            '#8fec74',
            50,
            '#77c853',
            51,
            '#ffff00',
            100,
            '#dfb743',
            101,
            '#f5ba2a',
            150,
            '#d3781c',
            151,
            '#da5340',
            200,
            '#bc2f26',
            201,
            '#9c2424',
            300,
            '#661414',
            301,
            '#76205d',
            400,
            '#521541'
          ],
          'circle-stroke-color': "rgba(255, 255, 255, 1)",
          'circle-stroke-width': 1,
          'circle-radius': [
            'interpolate', ['exponential', 1.2],
            ["zoom"],
            0,
            15,
            18,
            30
          ]
        }
      }, 'water-point-label');

      map.addLayer({
        id: 'unclustered-point-label',
        type: 'symbol',
        source: 'sensors',
        filter: ['!', ['has', 'point_count']],
        layout: {
          'text-field': ["number-format", ["get", "aqi_raw"], {
            "max-fraction-digits": 1
          }],
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 12
        },
        paint: {
          'text-halo-color': "rgba(255, 255, 255, 1)",
          'text-halo-width': [
            'interpolate', ['exponential', 1.2],
            ["zoom"],
            0,
            1,
            18,
            3
          ]
        }
      });

      map.on('click', 'clusters', function (e) {
        var features = map.queryRenderedFeatures(e.point, {
          layers: ['clusters']
        });
        var clusterId = features[0].properties.cluster_id;
        map.getSource('sensors').getClusterExpansionZoom(
          clusterId,
          function (err, zoom) {
            if (err) return;

            map.easeTo({
              center: features[0].geometry.coordinates,
              zoom: zoom
            });
          }
        );
      });

      map.on('preclick', 'unclustered-point', function (e) {
        var coordinates = e.features[0].geometry.coordinates.slice();
        var label = e.features[0].properties.name;
        var aqi_raw = e.features[0].properties.aqi_raw;
        var pm_cf1 = e.features[0].properties.pm_cf1;
        var pm_1 = e.features[0].properties.pm_1;
        var conf = e.features[0].properties.conf;
        var humidity = e.features[0].properties.humidity;
        var description = e.features[0].properties.description;

        while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
          coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
        }

        new mapboxgl.Popup()
          .setLngLat(coordinates)
          .setHTML(
            "<div class='inline-flex flex--center-cross flex--column'>" +
            "<div class='px6 py6 bg-lighten75 color-black round txt-s'>" +
            "<li> <span class='txt-bold'> Name: </span>" + label + "</li>" +
            "<li> <span class='txt-bold'> AQI: </span>" + aqi_raw + '</li>' +
            "<li> <span class='txt-bold'> Description: </span>" + description + '</li>' +
            "<li> <span class='txt-bold'> PM_1: </span>" + pm_1 + '</li>' +
            "<li> <span class='txt-bold'> PM_cf1: </span>" + pm_cf1 + '</li>' +
            "<li> <span class='txt-bold'> Conf: </span>" + conf + '</li>' +
            "<li> <span class='txt-bold'> Humidity: </span>" + humidity + '</li>' +
            "</div>" +
            "</div>"
          )
          .addTo(map);
      });

      map.on('mouseenter', 'clusters', function () {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'clusters', function () {
        map.getCanvas().style.cursor = '';
      });
    })
});

function aqiFromPM(pm) {

  if (isNaN(pm)) return 0;
  if (pm == undefined) return 0;
  if (pm < 0) return 0;
  if (pm > 1000) return 0;
  /*
        Good                              0 - 50         0.0 - 15.0         0.0 – 12.0
  Moderate                        51 - 100           >15.0 - 40        12.1 – 35.4
  Unhealthy for Sensitive Groups   101 – 150     >40 – 65          35.5 – 55.4
  Unhealthy                                 151 – 200         > 65 – 150       55.5 – 150.4
  Very Unhealthy                    201 – 300 > 150 – 250     150.5 – 250.4
  Hazardous                                 301 – 400         > 250 – 350     250.5 – 350.4
  Hazardous                                 401 – 500         > 350 – 500     350.5 – 500
  */
  if (pm > 350.5) {
    return calcAQI(pm, 500, 401, 500, 350.5);
  } else if (pm > 250.5) {
    return calcAQI(pm, 400, 301, 350.4, 250.5);
  } else if (pm > 150.5) {
    return calcAQI(pm, 300, 201, 250.4, 150.5);
  } else if (pm > 55.5) {
    return calcAQI(pm, 200, 151, 150.4, 55.5);
  } else if (pm > 35.5) {
    return calcAQI(pm, 150, 101, 55.4, 35.5);
  } else if (pm > 12.1) {
    return calcAQI(pm, 100, 51, 35.4, 12.1);
  } else if (pm >= 0) {
    return calcAQI(pm, 50, 0, 12, 0);
  } else {
    return undefined;
  }

}
function bplFromPM(pm) {
  if (isNaN(pm)) return 0;
  if (pm == undefined) return 0;
  if (pm < 0) return 0;
  /*
        Good                              0 - 50         0.0 - 15.0         0.0 – 12.0
  Moderate                        51 - 100           >15.0 - 40        12.1 – 35.4
  Unhealthy for Sensitive Groups   101 – 150     >40 – 65          35.5 – 55.4
  Unhealthy                                 151 – 200         > 65 – 150       55.5 – 150.4
  Very Unhealthy                    201 – 300 > 150 – 250     150.5 – 250.4
  Hazardous                                 301 – 400         > 250 – 350     250.5 – 350.4
  Hazardous                                 401 – 500         > 350 – 500     350.5 – 500
  */
  if (pm > 350.5) {
    return 401;
  } else if (pm > 250.5) {
    return 301;
  } else if (pm > 150.5) {
    return 201;
  } else if (pm > 55.5) {
    return 151;
  } else if (pm > 35.5) {
    return 101;
  } else if (pm > 12.1) {
    return 51;
  } else if (pm >= 0) {
    return 0;
  } else {
    return 0;
  }

}
function bphFromPM(pm) {
  //return 0;
  if (isNaN(pm)) return 0;
  if (pm == undefined) return 0;
  if (pm < 0) return 0;
  /*
        Good                              0 - 50         0.0 - 15.0         0.0 – 12.0
  Moderate                        51 - 100           >15.0 - 40        12.1 – 35.4
  Unhealthy for Sensitive Groups   101 – 150     >40 – 65          35.5 – 55.4
  Unhealthy                                 151 – 200         > 65 – 150       55.5 – 150.4
  Very Unhealthy                    201 – 300 > 150 – 250     150.5 – 250.4
  Hazardous                                 301 – 400         > 250 – 350     250.5 – 350.4
  Hazardous                                 401 – 500         > 350 – 500     350.5 – 500
  */
  if (pm > 350.5) {
    return 500;
  } else if (pm > 250.5) {
    return 500;
  } else if (pm > 150.5) {
    return 300;
  } else if (pm > 55.5) {
    return 200;
  } else if (pm > 35.5) {
    return 150;
  } else if (pm > 12.1) {
    return 100;
  } else if (pm >= 0) {
    return 50;
  } else {
    return 0;
  }

}

function calcAQI(Cp, Ih, Il, BPh, BPl) {

  var a = (Ih - Il);
  var b = (BPh - BPl);
  var c = (Cp - BPl);
  return Math.round((a / b) * c + Il);

}


function getAQIDescription(aqi) {
  if (aqi >= 401) {
    return 'Hazardous';
  } else if (aqi >= 301) {
    return 'Hazardous';
  } else if (aqi >= 201) {
    return 'Very Unhealthy';
  } else if (aqi >= 151) {
    return 'Unhealthy';
  } else if (aqi >= 101) {
    return 'Unhealthy for Sensitive Groups';
  } else if (aqi >= 51) {
    return 'Moderate';
  } else if (aqi >= 0) {
    return 'Good';
  } else {
    return undefined;
  }
}

function getAQIMessage(aqi) {
  if (aqi >= 401) {
    return '>401: Health alert: everyone may experience more serious health effects';
  } else if (aqi >= 301) {
    return '301-400: Health alert: everyone may experience more serious health effects';
  } else if (aqi >= 201) {
    return '201-300: Health warnings of emergency conditions. The entire population is more likely to be affected. ';
  } else if (aqi >= 151) {
    return '151-200: Everyone may begin to experience health effects; members of sensitive groups may experience more serious health effects.';
  } else if (aqi >= 101) {
    return '101-150: Members of sensitive groups may experience health effects. The general public is not likely to be affected.';
  } else if (aqi >= 51) {
    return '51-100: Air quality is acceptable; however, for some pollutants there may be a moderate health concern for a very small number of people who are unusually sensitive to air pollution.';
  } else if (aqi >= 0) {
    return '0-50: Air quality is considered satisfactory, and air pollution poses little or no risk';
  } else {
    return undefined;
  }
}
