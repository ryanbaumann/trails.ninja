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
  projection: 'globe'
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

var geojson_data = {
  "type": "FeatureCollection",
  "features": []
}
var points_for_contours = [];

const isLatitude = num => isFinite(num) && Math.abs(num) <= 90 && num != 0;
const isLongitude = num => isFinite(num) && Math.abs(num) <= 180 && num != 0;

map.on('style.load', function () {
  map.setFog({});
  var all_range = 'https://map.purpleair.com/v1/sensors?token=QOPWTr%2FGog3iSDOz3T7CnxkvTbJ3xl0vO6EHEndu94OCT5%2F14jGY40jms06N710oqguuIgDgLVMYZf1VQc%2FNjwwxkVtlyYPm1d5A%2B5QrjgV5px%2FO5r3ske%2BMSUu1DvZCO1T02KVaeqM2aJAwZGI%2Fiw%3D%3D&fields=name,latitude,longitude,confidence,pm2.5_10minute,humidity&max_age=604800'
  document.getElementById("error_msg").innerHTML = "Data Loading..."
  fetch(all_range)
    .then(response => {
      if (!response.ok) {
        // get error message from body or default to response status
        const error = (data && data.message) || response.status;
        return Promise.reject(error);
      }
      else {
        return response.json()
      }
    })
    .catch(error => {
      console.error('Refresh too fast; try reloading your page in ~30 seconds!', error);
      document.getElementById("error_msg").innerHTML = "API Rate Limited: Reload page in ~30 seconds"
    })
    .then(mydata => {
      mydata.data.forEach(function (row) {
        let data = {}
        data['id'] = row[0];
        data['aqi_raw'] = row[6];
        data['conf'] = row[4];
        data['humidity'] = row[5];
        data['label'] = row[1];
        data['lat'] = row[2];
        data['long'] = row[3];

        if (
          (isLongitude(data['long'])) &&
          (isLatitude(data['lat'])) &&
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
              "conf": data['conf'],
              "humidity": data['humidity']
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
        var conf = e.features[0].properties.conf;
        var humidity = e.features[0].properties.humidity;

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

      document.getElementById("error_msg").innerHTML = "Map ready!"
    })
});
