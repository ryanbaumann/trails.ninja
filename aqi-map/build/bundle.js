(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";

var mapboxgl = require('mapbox-gl');

var MapboxGeocoder = require('@mapbox/mapbox-gl-geocoder');

var turfHelpers = require("@turf/helpers");

var turfTruncate = require("@turf/truncate")["default"];

var turfCleanCoords = require('@turf/clean-coords')["default"];

var d3 = require("d3-tricontour");

mapboxgl.accessToken = 'pk.eyJ1IjoicnNiYXVtYW5uIiwiYSI6ImNqdzg5aWxkYzF1azI0OW5uaWVmazhleXUifQ.XAm1dRGmXuRAMSQm0TJKXg';
var map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/rsbaumann/cks3iz3ka5dag18mljlnfp0xx?optimize=true',
  center: [-103.59179687498357, 40.66995747013945],
  zoom: 3,
  hash: true
});
map.addControl(new MapboxGeocoder({
  accessToken: mapboxgl.accessToken,
  mapboxgl: mapboxgl,
  marker: {
    color: 'blue'
  }
}));
map.addControl(new mapboxgl.GeolocateControl({}));
var geojson_data = {
  "type": "FeatureCollection",
  "features": []
};
var points_for_contours = [];

var isLatitude = function isLatitude(num) {
  return isFinite(num) && Math.abs(num) <= 90 && num != 0;
};

var isLongitude = function isLongitude(num) {
  return isFinite(num) && Math.abs(num) <= 180 && num != 0;
};

map.on('style.load', function () {
  var x = 0;
  var all_range = 'https://www.purpleair.com/data.json?opt=1/mAQI/a10/cC5&fetch=true&fields=pm_1,pm_cf_1,humidity';
  fetch(all_range).then(function (response) {
    return response.json();
  }).then(function (mydata) {
    mydata.data.forEach(function (row) {
      var data = {};
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
      data['AQI'] = aqiFromPM(data['pm_1']);

      if (data['age'] <= 10 && isLongitude(data['long']) && isLatitude(data['lat']) && data['flags'] == 0 && data['type'] == 0 // Only include outdoor sensors
      //(data['conf'] >= 90)   // only include high confidence sensor readings
      ) {
        // Contour calculator
        points_for_contours.push([parseFloat(data['long']), parseFloat(data['lat']), data['AQI']]);
        geojson_data.features.push(turfTruncate(turfCleanCoords({
          "type": "Feature",
          "id": data['id'],
          "properties": {
            "aqi": data['AQI'],
            "name": data['label'],
            "pm_1": data['pm_1'],
            "pm_cf1": data['pm_cf1'],
            "conf": data['conf'],
            "humidity": data['humidity'],
            "description": getAQIDescription(data['AQI']),
            "message": getAQIMessage(data['AQI'])
          },
          "geometry": {
            "type": "Point",
            "coordinates": [parseFloat(data['long']), parseFloat(data['lat'])]
          }
        }), {
          precision: 6
        }));
      }
    });
    var breaks = [0, 25, 50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300];
    var tric = d3.tricontour().thresholds(breaks);
    var contours = tric(points_for_contours);
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
      });
    });
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
        "fill-color": ['interpolate', ['linear'], ["get", "value"], 0, '#00e400', 51, '#ffff00', 101, '#ff7e00', 151, '#ff0000', 201, '#8f3f97', 301, '#7e0023'],
        "fill-opacity": 0.25
      }
    }, 'water');
    map.addSource('sensors', {
      type: 'geojson',
      data: geojson_data,
      cluster: true,
      buffer: 25,
      clusterMaxZoom: 14,
      clusterRadius: 25,
      clusterProperties: {
        "sum": ["+", ["get", "aqi"]],
        "max": ["max", ["get", "aqi"]]
      }
    });
    var colors = ['#731525', '#8B1A4A', '#EA3423', '#FEFF54', '#34eb4c'];
    map.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'sensors',
      filter: ['has', 'sum'],
      paint: {
        'circle-color': ['interpolate', ['linear'], ["/", ['get', 'sum'], ["get", "point_count"]], 0, '#00e400', 51, '#ffff00', 101, '#ff7e00', 151, '#ff0000', 201, '#8f3f97', 301, '#7e0023'],
        'circle-stroke-color': "white",
        'circle-stroke-width': 1,
        'circle-radius': ['interpolate', ['exponential', 1.2], ["zoom"], 0, 15, 18, 30]
      }
    }, 'water-point-label');
    map.addLayer({
      id: 'cluster-count-label',
      type: 'symbol',
      source: 'sensors',
      filter: ['has', 'sum'],
      layout: {
        'text-field': ["number-format", ["/", ['get', 'sum'], ["get", "point_count"]], {
          "max-fraction-digits": 1
        }],
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-size': 12
      },
      paint: {
        'text-halo-color': "white",
        'text-halo-width': 1
      }
    });
    map.addLayer({
      id: 'unclustered-point',
      type: 'circle',
      source: 'sensors',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': ['interpolate', ['linear'], ["get", "aqi"], 0, '#00e400', 51, '#ffff00', 101, '#ff7e00', 151, '#ff0000', 201, '#8f3f97', 301, '#7e0023'],
        'circle-stroke-color': "white",
        'circle-stroke-width': 1,
        'circle-radius': ['interpolate', ['exponential', 1.2], ["zoom"], 0, 15, 18, 30]
      }
    }, 'water-point-label');
    map.addLayer({
      id: 'unclustered-point-label',
      type: 'symbol',
      source: 'sensors',
      filter: ['!', ['has', 'point_count']],
      layout: {
        'text-field': ["number-format", ["get", "aqi"], {
          "max-fraction-digits": 1
        }],
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-size': 12
      },
      paint: {
        'text-halo-color': "white",
        'text-halo-width': 1
      }
    });
    map.on('click', 'clusters', function (e) {
      var features = map.queryRenderedFeatures(e.point, {
        layers: ['clusters']
      });
      var clusterId = features[0].properties.cluster_id;
      map.getSource('sensors').getClusterExpansionZoom(clusterId, function (err, zoom) {
        if (err) return;
        map.easeTo({
          center: features[0].geometry.coordinates,
          zoom: zoom
        });
      });
    });
    map.on('click', 'unclustered-point', function (e) {
      var coordinates = e.features[0].geometry.coordinates.slice();
      var label = e.features[0].properties.name;
      var aqi = e.features[0].properties.aqi;
      var pm_cf1 = e.features[0].properties.pm_cf1;
      var pm_1 = e.features[0].properties.pm_1;
      var conf = e.features[0].properties.conf;
      var humidity = e.features[0].properties.humidity;
      var description = e.features[0].properties.description;

      while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
        coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
      }

      new mapboxgl.Popup().setLngLat(coordinates).setHTML("<div class='inline-flex flex--center-cross flex--column'>" + "<div class='px6 py6 bg-lighten75 color-black round txt-s'>" + '<li>Name: ' + label + '</li>' + '<li>AQI: ' + aqi + '</li>' + '<li>Description: ' + description + '</li>' + '<li>PM_1: ' + pm_1 + '</li>' + '<li>PM_cf1: ' + pm_cf1 + '</li>' + '<li>Conf: ' + conf + '</li>' + '<li>Humidity: ' + humidity + '</li>' + "</div>" + "</div>").addTo(map);
    });
    map.on('mouseenter', 'clusters', function () {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'clusters', function () {
      map.getCanvas().style.cursor = '';
    });
  });
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
  var a = Ih - Il;
  var b = BPh - BPl;
  var c = Cp - BPl;
  return Math.round(a / b * c + Il);
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

},{"@mapbox/mapbox-gl-geocoder":5,"@turf/clean-coords":25,"@turf/helpers":26,"@turf/truncate":29,"d3-tricontour":177,"mapbox-gl":185}],2:[function(require,module,exports){
'use strict';
/**
 * Validators are functions which assert certain type.
 * They can return a string which can then be used
 * to display a helpful error message.
 * They can also return a function for a custom error message.
 */
var isPlainObject = require('is-plain-obj');
var xtend = require('xtend');

var DEFAULT_ERROR_PATH = 'value';
var NEWLINE_INDENT = '\n  ';

var v = {};

/**
 * Runners
 *
 * Take root validators and run assertion
 */
v.assert = function(rootValidator, options) {
  options = options || {};
  return function(value) {
    var message = validate(rootValidator, value);
    // all good
    if (!message) {
      return;
    }

    var errorMessage = processMessage(message, options);

    if (options.apiName) {
      errorMessage = options.apiName + ': ' + errorMessage;
    }

    throw new Error(errorMessage);
  };
};

/**
 * Higher Order Validators
 *
 * validators which take other validators as input
 * and output a new validator
 */
v.shape = function shape(validatorObj) {
  var validators = objectEntries(validatorObj);
  return function shapeValidator(value) {
    var validationResult = validate(v.plainObject, value);

    if (validationResult) {
      return validationResult;
    }

    var key, validator;
    var errorMessages = [];

    for (var i = 0; i < validators.length; i++) {
      key = validators[i].key;
      validator = validators[i].value;
      validationResult = validate(validator, value[key]);

      if (validationResult) {
        // return [key].concat(validationResult);
        errorMessages.push([key].concat(validationResult));
      }
    }

    if (errorMessages.length < 2) {
      return errorMessages[0];
    }

    // enumerate all the error messages
    return function(options) {
      errorMessages = errorMessages.map(function(message) {
        var key = message[0];
        var renderedMessage = processMessage(message, options)
          .split('\n')
          .join(NEWLINE_INDENT); // indents any inner nesting
        return '- ' + key + ': ' + renderedMessage;
      });

      var objectId = options.path.join('.');
      var ofPhrase = objectId === DEFAULT_ERROR_PATH ? '' : ' of ' + objectId;

      return (
        'The following properties' +
        ofPhrase +
        ' have invalid values:' +
        NEWLINE_INDENT +
        errorMessages.join(NEWLINE_INDENT)
      );
    };
  };
};

v.strictShape = function strictShape(validatorObj) {
  var shapeValidator = v.shape(validatorObj);
  return function strictShapeValidator(value) {
    var shapeResult = shapeValidator(value);
    if (shapeResult) {
      return shapeResult;
    }

    var invalidKeys = Object.keys(value).reduce(function(memo, valueKey) {
      if (validatorObj[valueKey] === undefined) {
        memo.push(valueKey);
      }
      return memo;
    }, []);

    if (invalidKeys.length !== 0) {
      return function() {
        return 'The following keys are invalid: ' + invalidKeys.join(', ');
      };
    }
  };
};

v.arrayOf = function arrayOf(validator) {
  return createArrayValidator(validator);
};

v.tuple = function tuple() {
  var validators = Array.isArray(arguments[0])
    ? arguments[0]
    : Array.prototype.slice.call(arguments);
  return createArrayValidator(validators);
};

// Currently array validation fails when the first invalid item is found.
function createArrayValidator(validators) {
  var validatingTuple = Array.isArray(validators);
  var getValidator = function(index) {
    if (validatingTuple) {
      return validators[index];
    }
    return validators;
  };

  return function arrayValidator(value) {
    var validationResult = validate(v.plainArray, value);
    if (validationResult) {
      return validationResult;
    }

    if (validatingTuple && value.length !== validators.length) {
      return 'an array with ' + validators.length + ' items';
    }

    for (var i = 0; i < value.length; i++) {
      validationResult = validate(getValidator(i), value[i]);
      if (validationResult) {
        return [i].concat(validationResult);
      }
    }
  };
}

v.required = function required(validator) {
  function requiredValidator(value) {
    if (value == null) {
      return function(options) {
        return formatErrorMessage(
          options,
          isArrayCulprit(options.path)
            ? 'cannot be undefined/null.'
            : 'is required.'
        );
      };
    }
    return validator.apply(this, arguments);
  }
  requiredValidator.__required = true;

  return requiredValidator;
};

v.oneOfType = function oneOfType() {
  var validators = Array.isArray(arguments[0])
    ? arguments[0]
    : Array.prototype.slice.call(arguments);
  return function oneOfTypeValidator(value) {
    var messages = validators
      .map(function(validator) {
        return validate(validator, value);
      })
      .filter(Boolean);

    // If we don't have as many messages as no. of validators,
    // then at least one validator was ok with the value.
    if (messages.length !== validators.length) {
      return;
    }

    // check primitive type
    if (
      messages.every(function(message) {
        return message.length === 1 && typeof message[0] === 'string';
      })
    ) {
      return orList(
        messages.map(function(m) {
          return m[0];
        })
      );
    }

    // Complex oneOfTypes like
    // `v.oneOftypes(v.shape({name: v.string})`, `v.shape({name: v.number}))`
    // are complex ¯\_(ツ)_/¯. For the current scope only returning the longest message.
    return messages.reduce(function(max, arr) {
      return arr.length > max.length ? arr : max;
    });
  };
};

/**
 * Meta Validators
 * which take options as argument (not validators)
 * and return a new primitive validator
 */
v.equal = function equal(compareWith) {
  return function equalValidator(value) {
    if (value !== compareWith) {
      return JSON.stringify(compareWith);
    }
  };
};

v.oneOf = function oneOf() {
  var options = Array.isArray(arguments[0])
    ? arguments[0]
    : Array.prototype.slice.call(arguments);
  var validators = options.map(function(value) {
    return v.equal(value);
  });

  return v.oneOfType.apply(this, validators);
};

v.range = function range(compareWith) {
  var min = compareWith[0];
  var max = compareWith[1];
  return function rangeValidator(value) {
    var validationResult = validate(v.number, value);

    if (validationResult || value < min || value > max) {
      return 'number between ' + min + ' & ' + max + ' (inclusive)';
    }
  };
};

/**
 * Primitive validators
 *
 * simple validators which return a string or undefined
 */
v.any = function any() {
  return;
};

v.boolean = function boolean(value) {
  if (typeof value !== 'boolean') {
    return 'boolean';
  }
};

v.number = function number(value) {
  if (typeof value !== 'number') {
    return 'number';
  }
};

v.plainArray = function plainArray(value) {
  if (!Array.isArray(value)) {
    return 'array';
  }
};

v.plainObject = function plainObject(value) {
  if (!isPlainObject(value)) {
    return 'object';
  }
};

v.string = function string(value) {
  if (typeof value !== 'string') {
    return 'string';
  }
};

v.func = function func(value) {
  if (typeof value !== 'function') {
    return 'function';
  }
};

function validate(validator, value) {
  // assertions are optional by default unless wrapped in v.require
  if (value == null && !validator.hasOwnProperty('__required')) {
    return;
  }

  var result = validator(value);

  if (result) {
    return Array.isArray(result) ? result : [result];
  }
}

function processMessage(message, options) {
  // message array follows the convention
  // [...path, result]
  // path is an array of object keys / array indices
  // result is output of the validator
  var len = message.length;

  var result = message[len - 1];
  var path = message.slice(0, len - 1);

  if (path.length === 0) {
    path = [DEFAULT_ERROR_PATH];
  }
  options = xtend(options, { path: path });

  return typeof result === 'function'
    ? result(options) // allows customization of result
    : formatErrorMessage(options, prettifyResult(result));
}

function orList(list) {
  if (list.length < 2) {
    return list[0];
  }
  if (list.length === 2) {
    return list.join(' or ');
  }
  return list.slice(0, -1).join(', ') + ', or ' + list.slice(-1);
}

function prettifyResult(result) {
  return 'must be ' + addArticle(result) + '.';
}

function addArticle(nounPhrase) {
  if (/^an? /.test(nounPhrase)) {
    return nounPhrase;
  }
  if (/^[aeiou]/i.test(nounPhrase)) {
    return 'an ' + nounPhrase;
  }
  if (/^[a-z]/i.test(nounPhrase)) {
    return 'a ' + nounPhrase;
  }
  return nounPhrase;
}

function formatErrorMessage(options, prettyResult) {
  var arrayCulprit = isArrayCulprit(options.path);
  var output = options.path.join('.') + ' ' + prettyResult;
  var prepend = arrayCulprit ? 'Item at position ' : '';

  return prepend + output;
}

function isArrayCulprit(path) {
  return typeof path[path.length - 1] == 'number' || typeof path[0] == 'number';
}

function objectEntries(obj) {
  return Object.keys(obj || {}).map(function(key) {
    return { key: key, value: obj[key] };
  });
}

v.validate = validate;
v.processMessage = processMessage;

module.exports = v;

},{"is-plain-obj":183,"xtend":192}],3:[function(require,module,exports){
'use strict';
var nanoid = require('nanoid')

/**
 * Construct a new mapbox event client to send interaction events to the mapbox event service
 * @param {Object} options options with which to create the service
 * @param {String} options.accessToken the mapbox access token to make requests
 * @param {Number} [options.flushInterval=1000] the number of ms after which to flush the event queue
 * @param {Number} [options.maxQueueSize=100] the number of events to queue before flushing
 * @private
 */
function MapboxEventManager(options) {
  this.origin = options.origin || 'https://api.mapbox.com';
  this.endpoint = 'events/v2';
  this.access_token = options.accessToken;
  this.version = '0.2.0'
  this.sessionID = this.generateSessionID();
  this.userAgent = this.getUserAgent();

  this.options = options;
  this.send = this.send.bind(this);


  // parse global options to be sent with each request
  this.countries = (options.countries) ? options.countries.split(",") : null;
  this.types = (options.types) ? options.types.split(",") : null;
  this.bbox = (options.bbox) ? options.bbox : null;
  this.language = (options.language) ? options.language.split(",") : null;
  this.limit = (options.limit) ? +options.limit : null;
  this.locale = navigator.language || null;
  this.enableEventLogging = this.shouldEnableLogging(options);
  this.eventQueue = new Array();
  this.flushInterval = options.flushInterval || 1000;
  this.maxQueueSize = options.maxQueueSize || 100;
  this.timer = (this.flushInterval) ? setTimeout(this.flush.bind(this), this.flushInterval) : null;
  // keep some state to deduplicate requests if necessary
  this.lastSentInput = "";
  this.lastSentIndex = 0;
}

MapboxEventManager.prototype = {
  /**
     * Send a search.select event to the mapbox events service
     * This event marks the array index of the item selected by the user out of the array of possible options
     * @private
     * @param {Object} selected the geojson feature selected by the user
     * @param {Object} geocoder a mapbox-gl-geocoder instance
     * @returns {Promise}
     */
  select: function(selected, geocoder){
    var resultIndex = this.getSelectedIndex(selected, geocoder);
    var payload = this.getEventPayload('search.select', geocoder);
    payload.resultIndex = resultIndex;
    payload.resultPlaceName  = selected.place_name;
    payload.resultId = selected.id;
    if ((resultIndex === this.lastSentIndex && payload.queryString === this.lastSentInput) || resultIndex == -1) {
      // don't log duplicate events if the user re-selected the same feature on the same search
      return;
    }
    this.lastSentIndex = resultIndex;
    this.lastSentInput = payload.queryString;
    if (!payload.queryString) return; // will be rejected
    return this.push(payload)
  },

  /**
     * Send a search-start event to the mapbox events service
     * This turnstile event marks when a user starts a new search
     * @private
     * @param {Object} geocoder a mapbox-gl-geocoder instance
     * @returns {Promise}
     */
  start: function(geocoder){
    var payload = this.getEventPayload('search.start', geocoder);
    if (!payload.queryString) return; // will be rejected
    return this.push(payload);
  },

  /**
   * Send a search-keyevent event to the mapbox events service
   * This event records each keypress in sequence
   * @private
   * @param {Object} keyEvent the keydown event to log
   * @param {Object} geocoder a mapbox-gl-geocoder instance
   * 
   */
  keyevent: function(keyEvent, geocoder){

    //pass invalid event
    if (!keyEvent.key) return;
    // don't send events for keys that don't change the input
    // TAB, ESC, LEFT, RIGHT, ENTER, UP, DOWN
    if (keyEvent.metaKey || [9, 27, 37, 39, 13, 38, 40].indexOf(keyEvent.keyCode) !== -1) return;
    var payload = this.getEventPayload('search.keystroke', geocoder);
    payload.lastAction = keyEvent.key;
    if (!payload.queryString) return; // will be rejected
    return this.push(payload);
  },

  /**
   * Send an event to the events service
   *
   * The event is skipped if the instance is not enabled to send logging events
   *
   * @private
   * @param {Object} payload the http POST body of the event
   * @param {Function} [callback] a callback function to invoke when the send has completed
   * @returns {Promise}
   */
  send: function (payload, callback) {
    if (!this.enableEventLogging) {
      if (callback) return callback();
      return;
    }
    var options = this.getRequestOptions(payload);
    this.request(options, function(err){
      if (err) return this.handleError(err, callback);
      if (callback) {
        return callback();
      }
    }.bind(this))
  },
  /**
   * Get http request options
   * @private
   * @param {*} payload
   */
  getRequestOptions: function(payload){
    if (!Array.isArray(payload)) payload = [payload];
    var options = {
      // events must be sent with POST
      method: "POST",
      host: this.origin,
      path: this.endpoint +  "?access_token=" + this.access_token,
      headers: {
        'Content-Type': 'application/json'
      },
      body:JSON.stringify(payload) //events are arrays
    }
    return options
  },

  /**
   * Get the event payload to send to the events service
   * Most payload properties are shared across all events
   * @private
   * @param {String} event the name of the event to send to the events service. Valid options are 'search.start', 'search.select', 'search.feedback'.
   * @param {Object} geocoder a mapbox-gl-geocoder instance
   * @returns {Object} an event payload
   */
  getEventPayload: function (event, geocoder) {
    var proximity;
    if (!geocoder.options.proximity) proximity = null;
    else proximity = [geocoder.options.proximity.longitude, geocoder.options.proximity.latitude];

    var zoom = (geocoder._map) ? geocoder._map.getZoom() : undefined;
    var payload = {
      event: event,
      created: +new Date(),
      sessionIdentifier: this.sessionID,
      country: this.countries,
      userAgent: this.userAgent,
      language: this.language,
      bbox: this.bbox,
      types: this.types,
      endpoint: 'mapbox.places',
      // fuzzyMatch: search.fuzzy, //todo  --> add to plugin
      proximity: proximity,
      limit: geocoder.options.limit,
      // routing: search.routing, //todo --> add to plugin
      mapZoom: zoom,
      keyboardLocale: this.locale
    }

    // get the text in the search bar
    if (event === "search.select"){
      payload.queryString = geocoder.inputString;
    }else if (event != "search.select" && geocoder._inputEl){
      payload.queryString = geocoder._inputEl.value;
    }else{
      payload.queryString = geocoder.inputString;
    }
    return payload;
  },

  /**
   * Wraps the request function for easier testing
   * Make an http request and invoke a callback
   * @private
   * @param {Object} opts options describing the http request to be made
   * @param {Function} callback the callback to invoke when the http request is completed
   */
  request: function (opts, callback) {
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
      if (this.readyState == 4 ) {
        if (this.status == 204){
          //success
          return callback(null);
        }else {
          return callback(this.statusText);
        }
      }
    };

    xhttp.open(opts.method, opts.host + '/' + opts.path, true);
    for (var header in opts.headers){
      var headerValue = opts.headers[header];
      xhttp.setRequestHeader(header, headerValue)
    }
    xhttp.send(opts.body);
  },

  /**
   * Handle an error that occurred while making a request
   * @param {Object} err an error instance to log
   * @private
   */
  handleError: function (err, callback) {
    if (callback) return callback(err);
  },

  /**
   * Generate a session ID to be returned with all of the searches made by this geocoder instance
   * ID is random and cannot be tracked across sessions
   * @private
   */
  generateSessionID: function () {
    return nanoid();
  },

  /**
   * Get a user agent string to send with the request to the events service
   * @private
   */
  getUserAgent: function () {
    return 'mapbox-gl-geocoder.' + this.version + "." + navigator.userAgent;
  },

  /**
     * Get the 0-based numeric index of the item that the user selected out of the list of options
     * @private
     * @param {Object} selected the geojson feature selected by the user
     * @param {Object} geocoder a Mapbox-GL-Geocoder instance
     * @returns {Number} the index of the selected result
     */
  getSelectedIndex: function(selected, geocoder){
    if (!geocoder._typeahead) return;
    var results = geocoder._typeahead.data;
    var selectedID = selected.id;
    var resultIDs = results.map(function (feature) {
      return feature.id;
    });
    var selectedIdx = resultIDs.indexOf(selectedID);
    return selectedIdx;
  },

  /**
     * Check whether events should be logged
     * Clients using a localGeocoder or an origin other than mapbox should not have events logged
     * @private
     */
  shouldEnableLogging: function(options){
    if (options.enableEventLogging === false) return false;
    if (options.origin && options.origin.indexOf('api.mapbox.com') == -1) return false;
    // hard to make sense of events when a local instance is suplementing results from origin
    if (options.localGeocoder) return false;
    // hard to make sense of events when a custom filter is in use
    if (options.filter) return false;
    return true;
  },

  /**
   * Flush out the event queue by sending events to the events service
   * @private
   */
  flush: function(){
    if (this.eventQueue.length > 0){
      this.send(this.eventQueue);
      this.eventQueue = new Array();
    }
    // //reset the timer
    if (this.timer)  clearTimeout(this.timer);
    if (this.flushInterval) this.timer = setTimeout(this.flush.bind(this), this.flushInterval)
  },

  /**
   * Push event into the pending queue
   * @param {Object} evt the event to send to the events service
   * @param {Boolean} forceFlush indicates that the event queue should be flushed after adding this event regardless of size of the queue
   * @private
   */
  push: function(evt, forceFlush){
    this.eventQueue.push(evt);
    if (this.eventQueue.length >= this.maxQueueSize || forceFlush){
      this.flush();
    }
  },

  /**
   * Flush any remaining events from the queue before it is removed
   * @private
   */
  remove: function(){
    this.flush();
  }
}



module.exports = MapboxEventManager;

},{"nanoid":186}],4:[function(require,module,exports){
module.exports = {
  'fr': {
    'name': 'France',
    'bbox': [[-4.59235, 41.380007], [9.560016, 51.148506]]
  },
  'us': {
    'name': 'United States',
    'bbox': [[-171.791111, 18.91619], [-66.96466, 71.357764]]
  },
  'ru': {
    'name': 'Russia',
    'bbox': [[19.66064, 41.151416], [190.10042, 81.2504]]
  },
  'ca': {
    'name': 'Canada',
    'bbox': [[-140.99778, 41.675105], [-52.648099, 83.23324]]
  }
};

},{}],5:[function(require,module,exports){
'use strict';

var Typeahead = require('suggestions');
var debounce = require('lodash.debounce');
var extend = require('xtend');
var EventEmitter = require('events').EventEmitter;
var exceptions = require('./exceptions');
var MapboxClient = require('@mapbox/mapbox-sdk');
var mbxGeocoder = require('@mapbox/mapbox-sdk/services/geocoding');
var MapboxEventManager = require('./events');
var localization = require('./localization');
var subtag = require('subtag');


const GEOCODE_REQUEST_TYPE = {
  FORWARD: 0,
  LOCAL: 1,
  REVERSE: 2,
};

/**
 * A geocoder component using the [Mapbox Geocoding API](https://docs.mapbox.com/api/search/#geocoding)
 * @class MapboxGeocoder
 * @param {Object} options
 * @param {String} options.accessToken Required.
 * @param {String} [options.origin=https://api.mapbox.com] Use to set a custom API origin.
 * @param {Object} [options.mapboxgl] A [mapbox-gl](https://github.com/mapbox/mapbox-gl-js) instance to use when creating [Markers](https://docs.mapbox.com/mapbox-gl-js/api/#marker). Required if `options.marker` is `true`.
 * @param {Number} [options.zoom=16] On geocoded result what zoom level should the map animate to when a `bbox` isn't found in the response. If a `bbox` is found the map will fit to the `bbox`.
 * @param {Boolean|Object} [options.flyTo=true] If `false`, animating the map to a selected result is disabled. If `true`, animating the map will use the default animation parameters. If an object, it will be passed as `options` to the map [`flyTo`](https://docs.mapbox.com/mapbox-gl-js/api/#map#flyto) or [`fitBounds`](https://docs.mapbox.com/mapbox-gl-js/api/#map#fitbounds) method providing control over the animation of the transition.
 * @param {String} [options.placeholder=Search] Override the default placeholder attribute value.
 * @param {Object} [options.proximity] a proximity argument: this is
 * a geographical point given as an object with `latitude` and `longitude`
 * properties. Search results closer to this point will be given
 * higher priority.
 * @param {Boolean} [options.trackProximity=true] If `true`, the geocoder proximity will automatically update based on the map view.
 * @param {Boolean} [options.collapsed=false] If `true`, the geocoder control will collapse until hovered or in focus.
 * @param {Boolean} [options.clearAndBlurOnEsc=false] If `true`, the geocoder control will clear it's contents and blur when user presses the escape key.
 * @param {Boolean} [options.clearOnBlur=false] If `true`, the geocoder control will clear its value when the input blurs.
 * @param {Array} [options.bbox] a bounding box argument: this is
 * a bounding box given as an array in the format `[minX, minY, maxX, maxY]`.
 * Search results will be limited to the bounding box.
 * @param {string} [options.countries] a comma separated list of country codes to
 * limit results to specified country or countries.
 * @param {string} [options.types] a comma seperated list of types that filter
 * results to match those specified. See https://docs.mapbox.com/api/search/#data-types
 * for available types.
 * If reverseGeocode is enabled and no type is specified, the type defaults to POIs. Otherwise, if you configure more than one type, the first type will be used.
 * @param {Number} [options.minLength=2] Minimum number of characters to enter before results are shown.
 * @param {Number} [options.limit=5] Maximum number of results to show.
 * @param {string} [options.language] Specify the language to use for response text and query result weighting. Options are IETF language tags comprised of a mandatory ISO 639-1 language code and optionally one or more IETF subtags for country or script. More than one value can also be specified, separated by commas. Defaults to the browser's language settings.
 * @param {Function} [options.filter] A function which accepts a Feature in the [Carmen GeoJSON](https://github.com/mapbox/carmen/blob/master/carmen-geojson.md) format to filter out results from the Geocoding API response before they are included in the suggestions list. Return `true` to keep the item, `false` otherwise.
 * @param {Function} [options.localGeocoder] A function accepting the query string which performs local geocoding to supplement results from the Mapbox Geocoding API. Expected to return an Array of GeoJSON Features in the [Carmen GeoJSON](https://github.com/mapbox/carmen/blob/master/carmen-geojson.md) format.
 * @param {Function} [options.externalGeocoder] A function accepting the query string and current features list which performs geocoding to supplement results from the Mapbox Geocoding API. Expected to return a Promise which resolves to an Array of GeoJSON Features in the [Carmen GeoJSON](https://github.com/mapbox/carmen/blob/master/carmen-geojson.md) format.
 * @param {distance|score} [options.reverseMode=distance] - Set the factors that are used to sort nearby results.
 * @param {boolean} [options.reverseGeocode=false] If `true`, enable reverse geocoding mode. In reverse geocoding, search input is expected to be coordinates in the form `lat, lon`, with suggestions being the reverse geocodes.
 * @param {Boolean} [options.enableEventLogging=true] Allow Mapbox to collect anonymous usage statistics from the plugin.
 * @param {Boolean|Object} [options.marker=true]  If `true`, a [Marker](https://docs.mapbox.com/mapbox-gl-js/api/#marker) will be added to the map at the location of the user-selected result using a default set of Marker options.  If the value is an object, the marker will be constructed using these options. If `false`, no marker will be added to the map. Requires that `options.mapboxgl` also be set.
 * @param {Function} [options.render] A function that specifies how the results should be rendered in the dropdown menu. This function should accepts a single [Carmen GeoJSON](https://github.com/mapbox/carmen/blob/master/carmen-geojson.md) object as input and return a string. Any HTML in the returned string will be rendered.
 * @param {Function} [options.getItemValue] A function that specifies how the selected result should be rendered in the search bar. This function should accept a single [Carmen GeoJSON](https://github.com/mapbox/carmen/blob/master/carmen-geojson.md) object as input and return a string. HTML tags in the output string will not be rendered. Defaults to `(item) => item.place_name`.
 * @param {String} [options.mode=mapbox.places] A string specifying the geocoding [endpoint](https://docs.mapbox.com/api/search/#endpoints) to query. Options are `mapbox.places` and `mapbox.places-permanent`. The `mapbox.places-permanent` mode requires an enterprise license for permanent geocodes.
 * @param {Boolean} [options.localGeocoderOnly=false] If `true`, indicates that the `localGeocoder` results should be the only ones returned to the user. If `false`, indicates that the `localGeocoder` results should be combined with those from the Mapbox API with the `localGeocoder` results ranked higher.
 * @example
 * var geocoder = new MapboxGeocoder({ accessToken: mapboxgl.accessToken });
 * map.addControl(geocoder);
 * @return {MapboxGeocoder} `this`
 *
 */

function MapboxGeocoder(options) {
  this._eventEmitter = new EventEmitter();
  this.options = extend({}, this.options, options);
  this.inputString = '';
  this.fresh = true;
  this.lastSelected = null;
}

MapboxGeocoder.prototype = {
  options: {
    zoom: 16,
    flyTo: true,
    trackProximity: true,
    minLength: 2,
    reverseGeocode: false,
    limit: 5,
    origin: 'https://api.mapbox.com',
    enableEventLogging: true,
    marker: true,
    mapboxgl: null,
    collapsed: false,
    clearAndBlurOnEsc: false,
    clearOnBlur: false,
    getItemValue: function(item) {
      return item.place_name
    },
    render: function(item) {
      var placeName = item.place_name.split(',');
      return '<div class="mapboxgl-ctrl-geocoder--suggestion"><div class="mapboxgl-ctrl-geocoder--suggestion-title">' + placeName[0]+ '</div><div class="mapboxgl-ctrl-geocoder--suggestion-address">' + placeName.splice(1, placeName.length).join(',') + '</div></div>';
    }
  },

  /**
   * Add the geocoder to a container. The container can be either a `mapboxgl.Map`, an `HTMLElement` or a CSS selector string.
   *
   * If the container is a [`mapboxgl.Map`](https://docs.mapbox.com/mapbox-gl-js/api/map/), this function will behave identically to [`Map.addControl(geocoder)`](https://docs.mapbox.com/mapbox-gl-js/api/map/#map#addcontrol).
   * If the container is an instance of [`HTMLElement`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement), then the geocoder will be appended as a child of that [`HTMLElement`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement).
   * If the container is a [CSS selector string](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors), the geocoder will be appended to the element returned from the query.
   *
   * This function will throw an error if the container is none of the above.
   * It will also throw an error if the referenced HTML element cannot be found in the `document.body`.
   *
   * For example, if the HTML body contains the element `<div id='geocoder-container'></div>`, the following script will append the geocoder to `#geocoder-container`:
   *
   * ```javascript
   * var geocoder = new MapboxGeocoder({ accessToken: mapboxgl.accessToken });
   * geocoder.addTo('#geocoder-container');
   * ```
   * @param {String|HTMLElement|mapboxgl.Map} container A reference to the container to which to add the geocoder
   */
  addTo: function(container){

    function addToExistingContainer (geocoder, container) {
      if (!document.body.contains(container)) {
        throw new Error("Element provided to #addTo() exists, but is not in the DOM")
      }
      const el = geocoder.onAdd(); //returns the input elements, which are then added to the requested html container
      container.appendChild(el);
    }

    // if the container is a map, add the control like normal
    if (container._controlContainer){
      //  it's a mapbox-gl map, add like normal
      container.addControl(this);
    }
    // if the container is an HTMLElement, then set the parent to be that element
    else if (container instanceof HTMLElement) {
      addToExistingContainer(this, container);
    }
    // if the container is a string, treat it as a CSS query
    else if (typeof container == 'string'){
      const parent = document.querySelectorAll(container);
      if (parent.length === 0){
        throw new Error("Element ", container, "not found.")
      }

      if (parent.length > 1){
        throw new Error("Geocoder can only be added to a single html element")
      }

      addToExistingContainer(this, parent[0]);
    }else{
      throw new Error("Error: addTo must be a mapbox-gl-js map, an html element, or a CSS selector query for a single html element")
    }
  },

  onAdd: function(map) {
    if (map && typeof map != 'string'){
      this._map = map;
    }

    this.setLanguage();

    if (!this.options.localGeocoderOnly){
      this.geocoderService = mbxGeocoder(
        MapboxClient({
          accessToken: this.options.accessToken,
          origin: this.options.origin
        })
      );
    }

    if (this.options.localGeocoderOnly && !this.options.localGeocoder){
      throw new Error("A localGeocoder function must be specified to use localGeocoderOnly mode")
    }

    this.eventManager = new MapboxEventManager(this.options);

    this._onChange = this._onChange.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onPaste = this._onPaste.bind(this);
    this._onBlur = this._onBlur.bind(this);
    this._showButton = this._showButton.bind(this);
    this._hideButton = this._hideButton.bind(this);
    this._onQueryResult = this._onQueryResult.bind(this);
    this.clear = this.clear.bind(this);
    this._updateProximity = this._updateProximity.bind(this);
    this._collapse = this._collapse.bind(this);
    this._unCollapse = this._unCollapse.bind(this);
    this._clear = this._clear.bind(this);
    this._clearOnBlur = this._clearOnBlur.bind(this);

    var el = (this.container = document.createElement('div'));
    el.className = 'mapboxgl-ctrl-geocoder mapboxgl-ctrl';

    var searchIcon = this.createIcon('search', '<path d="M7.4 2.5c-2.7 0-4.9 2.2-4.9 4.9s2.2 4.9 4.9 4.9c1 0 1.8-.2 2.5-.8l3.7 3.7c.2.2.4.3.8.3.7 0 1.1-.4 1.1-1.1 0-.3-.1-.5-.3-.8L11.4 10c.4-.8.8-1.6.8-2.5.1-2.8-2.1-5-4.8-5zm0 1.6c1.8 0 3.2 1.4 3.2 3.2s-1.4 3.2-3.2 3.2-3.3-1.3-3.3-3.1 1.4-3.3 3.3-3.3z"/>')

    this._inputEl = document.createElement('input');
    this._inputEl.type = 'text';
    this._inputEl.className = 'mapboxgl-ctrl-geocoder--input';

    this.setPlaceholder();

    if (this.options.collapsed) {
      this._collapse();
      this.container.addEventListener('mouseenter', this._unCollapse);
      this.container.addEventListener('mouseleave', this._collapse);
      this._inputEl.addEventListener('focus', this._unCollapse);
    }

    if (this.options.collapsed || this.options.clearOnBlur) {
      this._inputEl.addEventListener('blur', this._onBlur);
    }

    this._inputEl.addEventListener('keydown', debounce(this._onKeyDown, 200));
    this._inputEl.addEventListener('paste', this._onPaste);
    this._inputEl.addEventListener('change', this._onChange);
    this.container.addEventListener('mouseenter', this._showButton);
    this.container.addEventListener('mouseleave', this._hideButton);
    this._inputEl.addEventListener('keyup', function(e){
      this.eventManager.keyevent(e, this);
    }.bind(this));

    var actions = document.createElement('div');
    actions.classList.add('mapboxgl-ctrl-geocoder--pin-right');

    this._clearEl = document.createElement('button');
    this._clearEl.setAttribute('aria-label', 'Clear');
    this._clearEl.addEventListener('click', this.clear);
    this._clearEl.className = 'mapboxgl-ctrl-geocoder--button';

    var buttonIcon = this.createIcon('close', '<path d="M3.8 2.5c-.6 0-1.3.7-1.3 1.3 0 .3.2.7.5.8L7.2 9 3 13.2c-.3.3-.5.7-.5 1 0 .6.7 1.3 1.3 1.3.3 0 .7-.2 1-.5L9 10.8l4.2 4.2c.2.3.7.3 1 .3.6 0 1.3-.7 1.3-1.3 0-.3-.2-.7-.3-1l-4.4-4L15 4.6c.3-.2.5-.5.5-.8 0-.7-.7-1.3-1.3-1.3-.3 0-.7.2-1 .3L9 7.1 4.8 2.8c-.3-.1-.7-.3-1-.3z"/>')
    this._clearEl.appendChild(buttonIcon);

    this._loadingEl = this.createIcon('loading', '<path fill="#333" d="M4.4 4.4l.8.8c2.1-2.1 5.5-2.1 7.6 0l.8-.8c-2.5-2.5-6.7-2.5-9.2 0z"/><path opacity=".1" d="M12.8 12.9c-2.1 2.1-5.5 2.1-7.6 0-2.1-2.1-2.1-5.5 0-7.7l-.8-.8c-2.5 2.5-2.5 6.7 0 9.2s6.6 2.5 9.2 0 2.5-6.6 0-9.2l-.8.8c2.2 2.1 2.2 5.6 0 7.7z"/>');

    actions.appendChild(this._clearEl);
    actions.appendChild(this._loadingEl);

    el.appendChild(searchIcon);
    el.appendChild(this._inputEl);
    el.appendChild(actions);

    this._typeahead = new Typeahead(this._inputEl, [], {
      filter: false,
      minLength: this.options.minLength,
      limit: this.options.limit
    });

    this.setRenderFunction(this.options.render);
    this._typeahead.getItemValue = this.options.getItemValue;

    this.mapMarker = null;
    this._handleMarker = this._handleMarker.bind(this);
    if (this._map){
      if (this.options.trackProximity ) {
        this._updateProximity();
        this._map.on('moveend', this._updateProximity);
      }
      this._mapboxgl = this.options.mapboxgl;
      if (!this._mapboxgl && this.options.marker) {
        // eslint-disable-next-line no-console
        console.error("No mapboxgl detected in options. Map markers are disabled. Please set options.mapboxgl.");
        this.options.marker = false;
      }
    }
    return el;
  },

  createIcon: function(name, path) {
    var icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('class', 'mapboxgl-ctrl-geocoder--icon mapboxgl-ctrl-geocoder--icon-' + name);
    icon.setAttribute('viewBox', '0 0 18 18');
    icon.setAttribute('xml:space','preserve');
    icon.setAttribute('width', 18);
    icon.setAttribute('height', 18);
    // IE does not have innerHTML for SVG nodes
    if (!('innerHTML' in icon)) {
      var SVGNodeContainer = document.createElement('div');
      SVGNodeContainer.innerHTML = '<svg>' + path.valueOf().toString() + '</svg>';
      var SVGNode = SVGNodeContainer.firstChild,
        SVGPath = SVGNode.firstChild;
      icon.appendChild(SVGPath);
    } else {
      icon.innerHTML = path;
    }
    return icon;
  },

  onRemove: function() {
    this.container.parentNode.removeChild(this.container);

    if (this.options.trackProximity && this._map) {
      this._map.off('moveend', this._updateProximity);
    }

    this._removeMarker();

    this._map = null;

    return this;
  },

  _onPaste: function(e){
    var value = (e.clipboardData || window.clipboardData).getData('text');
    if (value.length >= this.options.minLength) {
      this._geocode(value);
    }
  },

  _onKeyDown: function(e) {
    var ESC_KEY_CODE = 27,
      TAB_KEY_CODE = 9;

    if (e.keyCode === ESC_KEY_CODE && this.options.clearAndBlurOnEsc) {
      this._clear(e);
      return this._inputEl.blur();
    }

    // if target has shadowRoot, then get the actual active element inside the shadowRoot
    var target = e.target && e.target.shadowRoot
      ? e.target.shadowRoot.activeElement
      : e.target;
    var value = target ? target.value : '';

    if (!value) {
      this.fresh = true;
      // the user has removed all the text
      if (e.keyCode !== TAB_KEY_CODE) this.clear(e);
      return (this._clearEl.style.display = 'none');
    }

    // TAB, ESC, LEFT, RIGHT, ENTER, UP, DOWN
    if ((e.metaKey || [TAB_KEY_CODE, ESC_KEY_CODE, 37, 39, 13, 38, 40].indexOf(e.keyCode) !== -1))
      return;

    if (target.value.length >= this.options.minLength) {
      this._geocode(target.value);
    }
  },

  _showButton: function() {
    if (this._typeahead.selected) this._clearEl.style.display = 'block';
  },

  _hideButton: function() {
    if (this._typeahead.selected) this._clearEl.style.display = 'none';
  },

  _onBlur: function(e) {
    if (this.options.clearOnBlur) {
      this._clearOnBlur(e);
    }
    if (this.options.collapsed) {
      this._collapse();
    }
  },
  _onChange: function() {
    var selected = this._typeahead.selected;
    if (selected  && JSON.stringify(selected) !== this.lastSelected) {
      this._clearEl.style.display = 'none';
      if (this.options.flyTo) {
        var flyOptions;
        if (selected.properties && exceptions[selected.properties.short_code]) {
          // Certain geocoder search results return (and therefore zoom to fit)
          // an unexpectedly large bounding box: for example, both Russia and the
          // USA span both sides of -180/180, or France includes the island of
          // Reunion in the Indian Ocean. An incomplete list of these exceptions
          // at ./exceptions.json provides "reasonable" bounding boxes as a
          // short-term solution; this may be amended as necessary.
          flyOptions = extend({}, this.options.flyTo);
          if (this._map){
            this._map.fitBounds(exceptions[selected.properties.short_code].bbox, flyOptions);
          }
        } else if (selected.bbox) {
          var bbox = selected.bbox;
          flyOptions = extend({}, this.options.flyTo);
          if (this._map){
            this._map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], flyOptions);
          }
        } else {
          var defaultFlyOptions = {
            zoom: this.options.zoom
          }
          flyOptions = extend({}, defaultFlyOptions, this.options.flyTo);
          //  ensure that center is not overriden by custom options
          if (selected.center) {
            flyOptions.center = selected.center;
          } else if (selected.geometry && selected.geometry.type && selected.geometry.type === 'Point' && selected.geometry.coordinates) {
            flyOptions.center = selected.geometry.coordinates;
          }

          if (this._map){
            this._map.flyTo(flyOptions);
          }
        }
      }
      if (this.options.marker && this._mapboxgl){
        this._handleMarker(selected);
      }

      // After selecting a feature, re-focus the textarea and set
      // cursor at start.
      this._inputEl.focus();
      this._inputEl.scrollLeft = 0;
      this._inputEl.setSelectionRange(0, 0);
      this.lastSelected = JSON.stringify(selected);
      this._eventEmitter.emit('result', { result: selected });
      this.eventManager.select(selected, this);
    }
  },

  _requestType: function(options, search) {
    var type;
    const reverseGeocodeCoordRgx = /^[ ]*(-?\d+\.?\d*)[, ]+(-?\d+\.?\d*)[ ]*$/;
    if (options.localGeocoderOnly) {
      type = GEOCODE_REQUEST_TYPE.LOCAL;
    } else if (options.reverseGeocode && reverseGeocodeCoordRgx.test(search)) {
      type = GEOCODE_REQUEST_TYPE.REVERSE;
    } else {
      type = GEOCODE_REQUEST_TYPE.FORWARD;
    }
    return type;
  },

  _setupConfig: function(requestType, search) {
    // Possible config properties to pass to client
    const keys = [
      'bbox',
      'limit',
      'proximity',
      'countries',
      'types',
      'language',
      'reverseMode',
      'mode'
    ];
    const spacesOrCommaRgx = /[\s,]+/;

    var self = this;
    var config = keys.reduce(function(config, key) {
      if (!self.options[key]) {
        return config;
      }

      // countries, types, and language need to be passed in as arrays to client
      // https://github.com/mapbox/mapbox-sdk-js/blob/master/services/geocoding.js#L38-L47
      ['countries', 'types', 'language'].indexOf(key) > -1
        ? (config[key] = self.options[key].split(spacesOrCommaRgx))
        : (config[key] = self.options[key]);

      const isCoordKey =
        typeof self.options[key].longitude === 'number' &&
        typeof self.options[key].latitude  === 'number';

      if (key === 'proximity' && isCoordKey) {
        const lng = self.options[key].longitude;
        const lat = self.options[key].latitude;

        config[key] = [lng, lat];
      }

      return config;
    }, {});

    switch (requestType) {
    case GEOCODE_REQUEST_TYPE.REVERSE: {
      var coords = search.split(spacesOrCommaRgx).map(function(c) {
        return parseFloat(c, 10);
      }).reverse();

      // client only accepts one type for reverseGeocode, so
      // use first config type if one, if not default to poi
      config.types ? [config.types[0]] : ["poi"];
      config = extend(config, { query: coords, limit: 1 });

      // drop proximity which may have been set by trackProximity
      // since it's not supported by the reverseGeocoder
      if ('proximity' in config) {
        delete config.proximity;
      }
    } break;
    case GEOCODE_REQUEST_TYPE.FORWARD: {
      // Ensure that any reverse geocoding looking request is cleaned up
      // to be processed as only a forward geocoding request by the server.
      const reverseGeocodeCoordRgx = /^[ ]*(-?\d+\.?\d*)[, ]+(-?\d+\.?\d*)*[ ]*$/;
      if (reverseGeocodeCoordRgx.test(search)) {
        search = search.replace(/,/g, ' ');
      }
      config = extend(config, { query: search });
    } break;
    }

    return config;
  },

  _geocode: function(searchInput) {
    this.inputString = searchInput;
    this._loadingEl.style.display = 'block';
    this._eventEmitter.emit('loading', { query: searchInput });

    const requestType = this._requestType(this.options, searchInput);
    const config = this._setupConfig(requestType, searchInput);

    var request;
    switch (requestType) {
    case GEOCODE_REQUEST_TYPE.LOCAL:
      request = Promise.resolve();
      break;
    case GEOCODE_REQUEST_TYPE.FORWARD:
      request = this.geocoderService.forwardGeocode(config).send();
      break;
    case GEOCODE_REQUEST_TYPE.REVERSE:
      request = this.geocoderService.reverseGeocode(config).send();
      break;
    }

    var localGeocoderRes = this.options.localGeocoder ? this.options.localGeocoder(searchInput) || [] : [];
    var externalGeocoderRes = [];

    var geocoderError = null;
    request.catch(function(error) {
      geocoderError = error;
    }.bind(this))
      .then(
        function(response) {
          this._loadingEl.style.display = 'none';

          var res = {};

          if (!response){
            res = {
              type: 'FeatureCollection',
              features: []
            }
          } else if (response.statusCode == '200') {
            res = response.body;
            res.request = response.request
            res.headers = response.headers
          }

          res.config = config;

          if (this.fresh){
            this.eventManager.start(this);
            this.fresh = false;
          }

          // supplement Mapbox Geocoding API results with locally populated results
          res.features = res.features
            ? localGeocoderRes.concat(res.features)
            : localGeocoderRes;

          if (this.options.externalGeocoder) {

            externalGeocoderRes = this.options.externalGeocoder(searchInput, res.features) || [];
            // supplement Mapbox Geocoding API results with features returned by a promise
            return externalGeocoderRes.then(function(features) {
              res.features = res.features ? features.concat(res.features) : features;
              return res;
            }, function(){
              // on error, display the original result
              return res;
            });
          }
          return res;

        }.bind(this)).then(
        function(res) {
          if (geocoderError) {
            throw geocoderError;
          }

          // apply results filter if provided
          if (this.options.filter && res.features.length) {
            res.features = res.features.filter(this.options.filter);
          }

          if (res.features.length) {
            this._clearEl.style.display = 'block';
            this._eventEmitter.emit('results', res);
            this._typeahead.update(res.features);
          } else {
            this._clearEl.style.display = 'none';
            this._typeahead.selected = null;
            this._renderNoResults();
            this._eventEmitter.emit('results', res);
          }

        }.bind(this)
      ).catch(
        function(err) {
          this._loadingEl.style.display = 'none';

          // in the event of an error in the Mapbox Geocoding API still display results from the localGeocoder
          if ((localGeocoderRes.length && this.options.localGeocoder) || (externalGeocoderRes.length && this.options.externalGeocoder) ) {
            this._clearEl.style.display = 'block';
            this._typeahead.update(localGeocoderRes);
          } else {
            this._clearEl.style.display = 'none';
            this._typeahead.selected = null;
            this._renderError();
          }

          this._eventEmitter.emit('results', { features: localGeocoderRes });
          this._eventEmitter.emit('error', { error: err });
        }.bind(this)
      );

    return request;
  },

  /**
   * Shared logic for clearing input
   * @param {Event} [ev] the event that triggered the clear, if available
   * @private
   *
   */
  _clear: function(ev) {
    if (ev) ev.preventDefault();
    this._inputEl.value = '';
    this._typeahead.selected = null;
    this._typeahead.clear();
    this._onChange();
    this._clearEl.style.display = 'none';
    this._removeMarker();
    this.lastSelected = null;
    this._eventEmitter.emit('clear');
    this.fresh = true;
  },

  /**
   * Clear and then focus the input.
   * @param {Event} [ev] the event that triggered the clear, if available
   *
   */
  clear: function(ev) {
    this._clear(ev);
    this._inputEl.focus();
  },


  /**
   * Clear the input, without refocusing it. Used to implement clearOnBlur
   * constructor option.
   * @param {Event} [ev] the blur event
   * @private
   */
  _clearOnBlur: function(ev) {
    var ctx = this;

    /*
     * If relatedTarget is not found, assume user targeted the suggestions list.
     * In that case, do not clear on blur. There are other edge cases where
     * ev.relatedTarget could be null. Clicking on list always results in null
     * relatedtarget because of upstream behavior in `suggestions`.
     *
     * The ideal solution would be to check if ev.relatedTarget is a child of
     * the list. See issue #258 for details on why we can't do that yet.
     */
    if (ev.relatedTarget) {
      ctx._clear(ev);
    }
  },

  _onQueryResult: function(response) {
    var results = response.body;
    if (!results.features.length) return;
    var result = results.features[0];
    this._typeahead.selected = result;
    this._inputEl.value = result.place_name;
    this._onChange();
  },

  _updateProximity: function() {
    // proximity is designed for local scale, if the user is looking at the whole world,
    // it doesn't make sense to factor in the arbitrary centre of the map
    if (!this._map){
      return;
    }
    if (this._map.getZoom() > 9) {
      var center = this._map.getCenter().wrap();
      this.setProximity({ longitude: center.lng, latitude: center.lat });
    } else {
      this.setProximity(null);
    }
  },

  _collapse: function() {
    // do not collapse if input is in focus
    if (!this._inputEl.value && this._inputEl !== document.activeElement) this.container.classList.add('mapboxgl-ctrl-geocoder--collapsed');
  },

  _unCollapse: function() {
    this.container.classList.remove('mapboxgl-ctrl-geocoder--collapsed');
  },

  /**
   * Set & query the input
   * @param {string} searchInput location name or other search input
   * @returns {MapboxGeocoder} this
   */
  query: function(searchInput) {
    this._geocode(searchInput).then(this._onQueryResult);
    return this;
  },

  _renderError: function(){
    var errorMessage = "<div class='mapbox-gl-geocoder--error'>There was an error reaching the server</div>"
    this._renderMessage(errorMessage);
  },

  _renderNoResults: function(){
    var errorMessage = "<div class='mapbox-gl-geocoder--error mapbox-gl-geocoder--no-results'>No results found</div>";
    this._renderMessage(errorMessage);
  },

  _renderMessage: function(msg){
    this._typeahead.update([]);
    this._typeahead.selected = null;
    this._typeahead.clear();
    this._typeahead.renderError(msg);
  },

  /**
   * Get the text to use as the search bar placeholder
   *
   * If placeholder is provided in options, then use options.placeholder
   * Otherwise, if language is provided in options, then use the localized string of the first language if available
   * Otherwise use the default
   *
   * @returns {String} the value to use as the search bar placeholder
   * @private
   */
  _getPlaceholderText: function(){
    if (this.options.placeholder) return this.options.placeholder;
    if (this.options.language){
      var firstLanguage = this.options.language.split(",")[0];
      var language = subtag.language(firstLanguage);
      var localizedValue = localization.placeholder[language];
      if (localizedValue)  return localizedValue;
    }
    return 'Search';
  },

  /**
   * Set input
   * @param {string} searchInput location name or other search input
   * @returns {MapboxGeocoder} this
   */
  setInput: function(searchInput) {
    // Set input value to passed value and clear everything else.
    this._inputEl.value = searchInput;
    this._typeahead.selected = null;
    this._typeahead.clear();
    if (searchInput.length >= this.options.minLength) {
      this._geocode(searchInput);
    }
    return this;
  },

  /**
   * Set proximity
   * @param {Object} proximity The new `options.proximity` value. This is a geographical point given as an object with `latitude` and `longitude` properties.
   * @returns {MapboxGeocoder} this
   */
  setProximity: function(proximity) {
    this.options.proximity = proximity;
    return this;
  },

  /**
   * Get proximity
   * @returns {Object} The geocoder proximity
   */
  getProximity: function() {
    return this.options.proximity;
  },

  /**
   * Set the render function used in the results dropdown
   * @param {Function} fn The function to use as a render function. This function accepts a single [Carmen GeoJSON](https://github.com/mapbox/carmen/blob/master/carmen-geojson.md) object as input and returns a string.
   * @returns {MapboxGeocoder} this
   */
  setRenderFunction: function(fn){
    if (fn && typeof(fn) == "function"){
      this._typeahead.render = fn;
    }
    return this;
  },

  /**
   * Get the function used to render the results dropdown
   *
   * @returns {Function} the render function
   */
  getRenderFunction: function(){
    return this._typeahead.render;
  },

  /**
   * Get the language to use in UI elements and when making search requests
   *
   * Look first at the explicitly set options otherwise use the browser's language settings
   * @param {String} language Specify the language to use for response text and query result weighting. Options are IETF language tags comprised of a mandatory ISO 639-1 language code and optionally one or more IETF subtags for country or script. More than one value can also be specified, separated by commas.
   * @returns {MapboxGeocoder} this
   */
  setLanguage: function(language){
    var browserLocale = navigator.language || navigator.userLanguage || navigator.browserLanguage;
    this.options.language = language || this.options.language || browserLocale;
    return this;
  },

  /**
   * Get the language to use in UI elements and when making search requests
   * @returns {String} The language(s) used by the plugin, if any
   */
  getLanguage: function(){
    return this.options.language;
  },

  /**
   * Get the zoom level the map will move to when there is no bounding box on the selected result
   * @returns {Number} the map zoom
   */
  getZoom: function(){
    return this.options.zoom;
  },

  /**
   * Set the zoom level
   * @param {Number} zoom The zoom level that the map should animate to when a `bbox` isn't found in the response. If a `bbox` is found the map will fit to the `bbox`.
   * @returns {MapboxGeocoder} this
   */
  setZoom: function(zoom){
    this.options.zoom = zoom;
    return this;
  },

  /**
   * Get the parameters used to fly to the selected response, if any
   * @returns {Boolean|Object} The `flyTo` option
   */
  getFlyTo: function(){
    return this.options.flyTo;
  },

  /**
   * Set the flyTo options
   * @param {Boolean|Object} flyTo If false, animating the map to a selected result is disabled. If true, animating the map will use the default animation parameters. If an object, it will be passed as `options` to the map [`flyTo`](https://docs.mapbox.com/mapbox-gl-js/api/#map#flyto) or [`fitBounds`](https://docs.mapbox.com/mapbox-gl-js/api/#map#fitbounds) method providing control over the animation of the transition.
   */
  setFlyTo: function(flyTo){
    this.options.flyTo = flyTo;
    return this;
  },

  /**
   * Get the value of the placeholder string
   * @returns {String} The input element's placeholder value
   */
  getPlaceholder: function(){
    return this.options.placeholder;
  },

  /**
   * Set the value of the input element's placeholder
   * @param {String} placeholder the text to use as the input element's placeholder
   * @returns {MapboxGeocoder} this
   */
  setPlaceholder: function(placeholder){
    this.placeholder = (placeholder) ? placeholder : this._getPlaceholderText();
    this._inputEl.placeholder = this.placeholder;
    this._inputEl.setAttribute('aria-label', this.placeholder);
    return this
  },

  /**
   * Get the bounding box used by the plugin
   * @returns {Array<Number>} the bounding box, if any
   */
  getBbox: function(){
    return this.options.bbox;
  },

  /**
   * Set the bounding box to limit search results to
   * @param {Array<Number>} bbox a bounding box given as an array in the format [minX, minY, maxX, maxY].
   * @returns {MapboxGeocoder} this
   */
  setBbox: function(bbox){
    this.options.bbox = bbox;
    return this;
  },

  /**
   * Get a list of the countries to limit search results to
   * @returns {String} a comma separated list of countries to limit to, if any
   */
  getCountries: function(){
    return this.options.countries;
  },

  /**
   * Set the countries to limit search results to
   * @param {String} countries a comma separated list of countries to limit to
   * @returns {MapboxGeocoder} this
   */
  setCountries: function(countries){
    this.options.countries = countries;
    return this;
  },

  /**
   * Get a list of the types to limit search results to
   * @returns {String} a comma separated list of types to limit to
   */
  getTypes: function(){
    return this.options.types;
  },

  /**
   * Set the types to limit search results to
   * @param {String} countries a comma separated list of types to limit to
   * @returns {MapboxGeocoder} this
   */
  setTypes: function(types){
    this.options.types = types;
    return this;
  },

  /**
   * Get the minimum number of characters typed to trigger results used in the plugin
   * @returns {Number} The minimum length in characters before a search is triggered
   */
  getMinLength: function(){
    return this.options.minLength;
  },

  /**
   * Set the minimum number of characters typed to trigger results used by the plugin
   * @param {Number} minLength the minimum length in characters
   * @returns {MapboxGeocoder} this
   */
  setMinLength: function(minLength){
    this.options.minLength = minLength;
    if (this._typeahead)  this._typeahead.options.minLength = minLength;
    return this;
  },

  /**
   * Get the limit value for the number of results to display used by the plugin
   * @returns {Number} The limit value for the number of results to display used by the plugin
   */
  getLimit: function(){
    return this.options.limit;
  },

  /**
   * Set the limit value for the number of results to display used by the plugin
   * @param {Number} limit the number of search results to return
   * @returns {MapboxGeocoder}
   */
  setLimit: function(limit){
    this.options.limit = limit;
    if (this._typeahead) this._typeahead.options.limit = limit;
    return this;
  },

  /**
   * Get the filter function used by the plugin
   * @returns {Function} the filter function
   */
  getFilter: function(){
    return this.options.filter;
  },

  /**
   * Set the filter function used by the plugin.
   * @param {Function} filter A function which accepts a Feature in the [Carmen GeoJSON](https://github.com/mapbox/carmen/blob/master/carmen-geojson.md) format to filter out results from the Geocoding API response before they are included in the suggestions list. Return `true` to keep the item, `false` otherwise.
   * @returns {MapboxGeocoder} this
   */
  setFilter: function(filter){
    this.options.filter = filter;
    return this;
  },

  /**
   * Set the geocoding endpoint used by the plugin.
   * @param {Function} origin A function which accepts an HTTPS URL to specify the endpoint to query results from.
   * @returns {MapboxGeocoder} this
   */
  setOrigin: function(origin){
    this.options.origin = origin;
    this.geocoderService = mbxGeocoder(
      MapboxClient({
        accessToken: this.options.accessToken,
        origin: this.options.origin
      })
    );
    return this;
  },

  /**
   * Get the geocoding endpoint the plugin is currently set to
   * @returns {Function} the endpoint URL
   */
  getOrigin: function(){
    return this.options.origin;
  },

  /**
   * Handle the placement of a result marking the selected result
   * @private
   * @param {Object} selected the selected geojson feature
   * @returns {MapboxGeocoder} this
   */
  _handleMarker: function(selected){
    // clean up any old marker that might be present
    if (!this._map){
      return;
    }
    this._removeMarker();
    var defaultMarkerOptions = {
      color: '#4668F2'
    }
    var markerOptions = extend({}, defaultMarkerOptions, this.options.marker)
    this.mapMarker = new this._mapboxgl.Marker(markerOptions);
    if (selected.center) {
      this.mapMarker
        .setLngLat(selected.center)
        .addTo(this._map);
    } else if (selected.geometry && selected.geometry.type && selected.geometry.type === 'Point' && selected.geometry.coordinates) {
      this.mapMarker
        .setLngLat(selected.geometry.coordinates)
        .addTo(this._map);
    }
    return this;
  },

  /**
   * Handle the removal of a result marker
   * @private
   */
  _removeMarker: function(){
    if (this.mapMarker){
      this.mapMarker.remove();
      this.mapMarker = null;
    }
  },

  /**
   * Subscribe to events that happen within the plugin.
   * @param {String} type name of event. Available events and the data passed into their respective event objects are:
   *
   * - __clear__ `Emitted when the input is cleared`
   * - __loading__ `{ query } Emitted when the geocoder is looking up a query`
   * - __results__ `{ results } Fired when the geocoder returns a response`
   * - __result__ `{ result } Fired when input is set`
   * - __error__ `{ error } Error as string`
   * @param {Function} fn function that's called when the event is emitted.
   * @returns {MapboxGeocoder} this;
   */
  on: function(type, fn) {
    this._eventEmitter.on(type, fn);
    return this;
  },

  /**
   * Remove an event
   * @returns {MapboxGeocoder} this
   * @param {String} type Event name.
   * @param {Function} fn Function that should unsubscribe to the event emitted.
   */
  off: function(type, fn) {
    this._eventEmitter.removeListener(type, fn);
    this.eventManager.remove();
    return this;
  }
};

module.exports = MapboxGeocoder;

},{"./events":3,"./exceptions":4,"./localization":6,"@mapbox/mapbox-sdk":7,"@mapbox/mapbox-sdk/services/geocoding":18,"events":31,"lodash.debounce":184,"subtag":188,"suggestions":189,"xtend":192}],6:[function(require,module,exports){
'use strict';

/**
 * Localized values for the placeholder string
 * 
 * @private
 */
var placeholder = {
  // list drawn from https://docs.mapbox.com/api/search/#language-coverage
  'de': 'Suche', // german
  'it': 'Ricerca', //italian
  'en': 'Search', // english
  'nl': 'Zoeken', //dutch
  'fr': 'Chercher',  //french
  'ca': 'Cerca', //catalan
  'he': 'לחפש', //hebrew
  'ja': 'サーチ',  //japanese
  'lv': 'Meklēt', //latvian
  'pt': 'Procurar', //portuguese 
  'sr': 'Претрага', //serbian
  'zh': '搜索', //chinese-simplified
  'cs': 'Vyhledávání', //czech
  'hu': 'Keresés', //hungarian
  'ka': 'ძიება', // georgian
  'nb': 'Søke', //norwegian
  'sk': 'Vyhľadávanie', //slovak
  'th': 'ค้นหา', //thai
  'fi': 'Hae',//finnish
  'is': 'Leita',//icelandic
  'ko': '수색',//korean
  'pl':  'Szukaj', //polish
  'sl': 'Iskanje', //slovenian
  'fa': 'جستجو',  //persian(aka farsi)
  'ru': 'Поиск'//russian
}

module.exports = {placeholder: placeholder};

},{}],7:[function(require,module,exports){
'use strict';

var client = require('./lib/client');

module.exports = client;

},{"./lib/client":8}],8:[function(require,module,exports){
'use strict';

var browser = require('./browser-layer');
var MapiClient = require('../classes/mapi-client');

function BrowserClient(options) {
  MapiClient.call(this, options);
}
BrowserClient.prototype = Object.create(MapiClient.prototype);
BrowserClient.prototype.constructor = BrowserClient;

BrowserClient.prototype.sendRequest = browser.browserSend;
BrowserClient.prototype.abortRequest = browser.browserAbort;

/**
 * Create a client for the browser.
 *
 * @param {Object} options
 * @param {string} options.accessToken
 * @param {string} [options.origin]
 * @returns {MapiClient}
 */
function createBrowserClient(options) {
  return new BrowserClient(options);
}

module.exports = createBrowserClient;

},{"../classes/mapi-client":10,"./browser-layer":9}],9:[function(require,module,exports){
'use strict';

var MapiResponse = require('../classes/mapi-response');
var MapiError = require('../classes/mapi-error');
var constants = require('../constants');
var parseHeaders = require('../helpers/parse-headers');

// Keys are request IDs, values are XHRs.
var requestsUnderway = {};

function browserAbort(request) {
  var xhr = requestsUnderway[request.id];
  if (!xhr) return;
  xhr.abort();
  delete requestsUnderway[request.id];
}

function createResponse(request, xhr) {
  return new MapiResponse(request, {
    body: xhr.response,
    headers: parseHeaders(xhr.getAllResponseHeaders()),
    statusCode: xhr.status
  });
}

function normalizeBrowserProgressEvent(event) {
  var total = event.total;
  var transferred = event.loaded;
  var percent = (100 * transferred) / total;
  return {
    total: total,
    transferred: transferred,
    percent: percent
  };
}

function sendRequestXhr(request, xhr) {
  return new Promise(function(resolve, reject) {
    xhr.onprogress = function(event) {
      request.emitter.emit(
        constants.EVENT_PROGRESS_DOWNLOAD,
        normalizeBrowserProgressEvent(event)
      );
    };

    var file = request.file;
    if (file) {
      xhr.upload.onprogress = function(event) {
        request.emitter.emit(
          constants.EVENT_PROGRESS_UPLOAD,
          normalizeBrowserProgressEvent(event)
        );
      };
    }

    xhr.onerror = function(error) {
      reject(error);
    };

    xhr.onabort = function() {
      var mapiError = new MapiError({
        request: request,
        type: constants.ERROR_REQUEST_ABORTED
      });
      reject(mapiError);
    };

    xhr.onload = function() {
      delete requestsUnderway[request.id];
      if (xhr.status < 200 || xhr.status >= 400) {
        var mapiError = new MapiError({
          request: request,
          body: xhr.response,
          statusCode: xhr.status
        });
        reject(mapiError);
        return;
      }
      resolve(xhr);
    };

    var body = request.body;

    // matching service needs to send a www-form-urlencoded request
    if (typeof body === 'string') {
      xhr.send(body);
    } else if (body) {
      xhr.send(JSON.stringify(body));
    } else if (file) {
      xhr.send(file);
    } else {
      xhr.send();
    }

    requestsUnderway[request.id] = xhr;
  }).then(function(xhr) {
    return createResponse(request, xhr);
  });
}

// The accessToken argument gives this function flexibility
// for Mapbox's internal client.
function createRequestXhr(request, accessToken) {
  var url = request.url(accessToken);
  var xhr = new window.XMLHttpRequest();
  xhr.open(request.method, url);
  Object.keys(request.headers).forEach(function(key) {
    xhr.setRequestHeader(key, request.headers[key]);
  });
  return xhr;
}

function browserSend(request) {
  return Promise.resolve().then(function() {
    var xhr = createRequestXhr(request, request.client.accessToken);
    return sendRequestXhr(request, xhr);
  });
}

module.exports = {
  browserAbort: browserAbort,
  sendRequestXhr: sendRequestXhr,
  browserSend: browserSend,
  createRequestXhr: createRequestXhr
};

},{"../classes/mapi-error":11,"../classes/mapi-response":13,"../constants":14,"../helpers/parse-headers":15}],10:[function(require,module,exports){
'use strict';

var parseToken = require('@mapbox/parse-mapbox-token');
var MapiRequest = require('./mapi-request');
var constants = require('../constants');

/**
 * A low-level Mapbox API client. Use it to create service clients
 * that share the same configuration.
 *
 * Services and `MapiRequest`s use the underlying `MapiClient` to
 * determine how to create, send, and abort requests in a way
 * that is appropriate to the configuration and environment
 * (Node or the browser).
 *
 * @class MapiClient
 * @property {string} accessToken - The Mapbox access token assigned
 *   to this client.
 * @property {string} [origin] - The origin
 *   to use for API requests. Defaults to https://api.mapbox.com.
 */

function MapiClient(options) {
  if (!options || !options.accessToken) {
    throw new Error('Cannot create a client without an access token');
  }
  // Try parsing the access token to determine right away if it's valid.
  parseToken(options.accessToken);

  this.accessToken = options.accessToken;
  this.origin = options.origin || constants.API_ORIGIN;
}

MapiClient.prototype.createRequest = function createRequest(requestOptions) {
  return new MapiRequest(this, requestOptions);
};

module.exports = MapiClient;

},{"../constants":14,"./mapi-request":12,"@mapbox/parse-mapbox-token":24}],11:[function(require,module,exports){
'use strict';

var constants = require('../constants');

/**
 * A Mapbox API error.
 *
 * If there's an error during the API transaction,
 * the Promise returned by `MapiRequest`'s [`send`](#send)
 * method should reject with a `MapiError`.
 *
 * @class MapiError
 * @hideconstructor
 * @property {MapiRequest} request - The errored request.
 * @property {string} type - The type of error. Usually this is `'HttpError'`.
 *   If the request was aborted, so the error was
 *   not sent from the server, the type will be
 *   `'RequestAbortedError'`.
 * @property {number} [statusCode] - The numeric status code of
 *   the HTTP response.
 * @property {Object | string} [body] - If the server sent a response body,
 *   this property exposes that response, parsed as JSON if possible.
 * @property {string} [message] - Whatever message could be derived from the
 *   call site and HTTP response.
 *
 * @param {MapiRequest} options.request
 * @param {number} [options.statusCode]
 * @param {string} [options.body]
 * @param {string} [options.message]
 * @param {string} [options.type]
 */
function MapiError(options) {
  var errorType = options.type || constants.ERROR_HTTP;

  var body;
  if (options.body) {
    try {
      body = JSON.parse(options.body);
    } catch (e) {
      body = options.body;
    }
  } else {
    body = null;
  }

  var message = options.message || null;
  if (!message) {
    if (typeof body === 'string') {
      message = body;
    } else if (body && typeof body.message === 'string') {
      message = body.message;
    } else if (errorType === constants.ERROR_REQUEST_ABORTED) {
      message = 'Request aborted';
    }
  }

  this.message = message;
  this.type = errorType;
  this.statusCode = options.statusCode || null;
  this.request = options.request;
  this.body = body;
}

module.exports = MapiError;

},{"../constants":14}],12:[function(require,module,exports){
'use strict';

var parseToken = require('@mapbox/parse-mapbox-token');
var xtend = require('xtend');
var EventEmitter = require('eventemitter3');
var urlUtils = require('../helpers/url-utils');
var constants = require('../constants');

var requestId = 1;

/**
 * A Mapbox API request.
 *
 * Note that creating a `MapiRequest` does *not* send the request automatically.
 * Use the request's `send` method to send it off and get a `Promise`.
 *
 * The `emitter` property is an `EventEmitter` that emits the following events:
 *
 * - `'response'` - Listeners will be called with a `MapiResponse`.
 * - `'error'` - Listeners will be called with a `MapiError`.
 * - `'downloadProgress'` - Listeners will be called with `ProgressEvents`.
 * - `'uploadProgress'` - Listeners will be called with `ProgressEvents`.
 *   Upload events are only available when the request includes a file.
 *
 * @class MapiRequest
 * @property {EventEmitter} emitter - An event emitter. See above.
 * @property {MapiClient} client - This request's `MapiClient`.
 * @property {MapiResponse|null} response - If this request has been sent and received
 *   a response, the response is available on this property.
 * @property {MapiError|Error|null} error - If this request has been sent and
 *   received an error in response, the error is available on this property.
 * @property {boolean} aborted - If the request has been aborted
 *   (via [`abort`](#abort)), this property will be `true`.
 * @property {boolean} sent - If the request has been sent, this property will
 *   be `true`. You cannot send the same request twice, so if you need to create
 *   a new request that is the equivalent of an existing one, use
 *   [`clone`](#clone).
 * @property {string} path - The request's path, including colon-prefixed route
 *   parameters.
 * @property {string} origin - The request's origin.
 * @property {string} method - The request's HTTP method.
 * @property {Object} query - A query object, which will be transformed into
 *   a URL query string.
 * @property {Object} params - A route parameters object, whose values will
 *   be interpolated the path.
 * @property {Object} headers - The request's headers.
 * @property {Object|string|null} body - Data to send with the request.
 *   If the request has a body, it will also be sent with the header
 *   `'Content-Type: application/json'`.
 * @property {Blob|ArrayBuffer|string|ReadStream} file - A file to
 *   send with the request. The browser client accepts Blobs and ArrayBuffers;
 *   the Node client accepts strings (filepaths) and ReadStreams.
 * @property {string} encoding - The encoding of the response.
 * @property {string} sendFileAs - The method to send the `file`. Options are
 *   `data` (x-www-form-urlencoded) or `form` (multipart/form-data).
 */

/**
 * @ignore
 * @param {MapiClient} client
 * @param {Object} options
 * @param {string} options.method
 * @param {string} options.path
 * @param {Object} [options.query={}]
 * @param {Object} [options.params={}]
 * @param {string} [options.origin]
 * @param {Object} [options.headers]
 * @param {Object} [options.body=null]
 * @param {Blob|ArrayBuffer|string|ReadStream} [options.file=null]
 * @param {string} [options.encoding=utf8]
 */
function MapiRequest(client, options) {
  if (!client) {
    throw new Error('MapiRequest requires a client');
  }
  if (!options || !options.path || !options.method) {
    throw new Error(
      'MapiRequest requires an options object with path and method properties'
    );
  }

  var defaultHeaders = {};
  if (options.body) {
    defaultHeaders['content-type'] = 'application/json';
  }

  var headersWithDefaults = xtend(defaultHeaders, options.headers);

  // Disallows duplicate header names of mixed case,
  // e.g. Content-Type and content-type.
  var headers = Object.keys(headersWithDefaults).reduce(function(memo, name) {
    memo[name.toLowerCase()] = headersWithDefaults[name];
    return memo;
  }, {});

  this.id = requestId++;
  this._options = options;

  this.emitter = new EventEmitter();
  this.client = client;
  this.response = null;
  this.error = null;
  this.sent = false;
  this.aborted = false;
  this.path = options.path;
  this.method = options.method;
  this.origin = options.origin || client.origin;
  this.query = options.query || {};
  this.params = options.params || {};
  this.body = options.body || null;
  this.file = options.file || null;
  this.encoding = options.encoding || 'utf8';
  this.sendFileAs = options.sendFileAs || null;
  this.headers = headers;
}

/**
 * Get the URL of the request.
 *
 * @param {string} [accessToken] - By default, the access token of the request's
 *   client is used.
 * @return {string}
 */
MapiRequest.prototype.url = function url(accessToken) {
  var url = urlUtils.prependOrigin(this.path, this.origin);
  url = urlUtils.appendQueryObject(url, this.query);
  var routeParams = this.params;
  var actualAccessToken =
    accessToken == null ? this.client.accessToken : accessToken;
  if (actualAccessToken) {
    url = urlUtils.appendQueryParam(url, 'access_token', actualAccessToken);
    var accessTokenOwnerId = parseToken(actualAccessToken).user;
    routeParams = xtend({ ownerId: accessTokenOwnerId }, routeParams);
  }
  url = urlUtils.interpolateRouteParams(url, routeParams);
  return url;
};

/**
 * Send the request. Returns a Promise that resolves with a `MapiResponse`.
 * You probably want to use `response.body`.
 *
 * `send` only retrieves the first page of paginated results. You can get
 * the next page by using the `MapiResponse`'s [`nextPage`](#nextpage)
 * function, or iterate through all pages using [`eachPage`](#eachpage)
 * instead of `send`.
 *
 * @returns {Promise<MapiResponse>}
 */
MapiRequest.prototype.send = function send() {
  var self = this;

  if (self.sent) {
    throw new Error(
      'This request has already been sent. Check the response and error properties. Create a new request with clone().'
    );
  }
  self.sent = true;

  return self.client.sendRequest(self).then(
    function(response) {
      self.response = response;
      self.emitter.emit(constants.EVENT_RESPONSE, response);
      return response;
    },
    function(error) {
      self.error = error;
      self.emitter.emit(constants.EVENT_ERROR, error);
      throw error;
    }
  );
};

/**
 * Abort the request.
 *
 * Any pending `Promise` returned by [`send`](#send) will be rejected with
 * an error with `type: 'RequestAbortedError'`. If you've created a request
 * that might be aborted, you need to catch and handle such errors.
 *
 * This method will also abort any requests created while fetching subsequent
 * pages via [`eachPage`](#eachpage).
 *
 * If the request has not been sent or has already been aborted, nothing
 * will happen.
 */
MapiRequest.prototype.abort = function abort() {
  if (this._nextPageRequest) {
    this._nextPageRequest.abort();
    delete this._nextPageRequest;
  }

  if (this.response || this.error || this.aborted) return;

  this.aborted = true;
  this.client.abortRequest(this);
};

/**
 * Invoke a callback for each page of a paginated API response.
 *
 * The callback should have the following signature:
 *
 * ```js
 * (
 *   error: MapiError,
 *   response: MapiResponse,
 *   next: () => void
 * ) => void
 * ```
 *
 * **The next page will not be fetched until you've invoked the
 * `next` callback**, indicating that you're ready for it.
 *
 * @param {Function} callback
 */
MapiRequest.prototype.eachPage = function eachPage(callback) {
  var self = this;

  function handleResponse(response) {
    function getNextPage() {
      delete self._nextPageRequest;
      var nextPageRequest = response.nextPage();
      if (nextPageRequest) {
        self._nextPageRequest = nextPageRequest;
        getPage(nextPageRequest);
      }
    }
    callback(null, response, getNextPage);
  }

  function handleError(error) {
    callback(error, null, function() {});
  }

  function getPage(request) {
    request.send().then(handleResponse, handleError);
  }
  getPage(this);
};

/**
 * Clone this request.
 *
 * Each request can only be sent *once*. So if you'd like to send the
 * same request again, clone it and send away.
 *
 * @returns {MapiRequest} - A new `MapiRequest` configured just like this one.
 */
MapiRequest.prototype.clone = function clone() {
  return this._extend();
};

/**
 * @ignore
 */
MapiRequest.prototype._extend = function _extend(options) {
  var extendedOptions = xtend(this._options, options);
  return new MapiRequest(this.client, extendedOptions);
};

module.exports = MapiRequest;

},{"../constants":14,"../helpers/url-utils":17,"@mapbox/parse-mapbox-token":24,"eventemitter3":181,"xtend":192}],13:[function(require,module,exports){
'use strict';

var parseLinkHeader = require('../helpers/parse-link-header');

/**
 * A Mapbox API response.
 *
 * @class MapiResponse
 * @property {Object} body - The response body, parsed as JSON.
 * @property {string} rawBody - The raw response body.
 * @property {number} statusCode - The response's status code.
 * @property {Object} headers - The parsed response headers.
 * @property {Object} links - The parsed response links.
 * @property {MapiRequest} request - The response's originating `MapiRequest`.
 */

/**
 * @ignore
 * @param {MapiRequest} request
 * @param {Object} responseData
 * @param {Object} responseData.headers
 * @param {string} responseData.body
 * @param {number} responseData.statusCode
 */
function MapiResponse(request, responseData) {
  this.request = request;
  this.headers = responseData.headers;
  this.rawBody = responseData.body;
  this.statusCode = responseData.statusCode;
  try {
    this.body = JSON.parse(responseData.body || '{}');
  } catch (parseError) {
    this.body = responseData.body;
  }
  this.links = parseLinkHeader(this.headers.link);
}

/**
 * Check if there is a next page that you can fetch.
 *
 * @returns {boolean}
 */
MapiResponse.prototype.hasNextPage = function hasNextPage() {
  return !!this.links.next;
};

/**
 * Create a request for the next page, if there is one.
 * If there is no next page, returns `null`.
 *
 * @returns {MapiRequest | null}
 */
MapiResponse.prototype.nextPage = function nextPage() {
  if (!this.hasNextPage()) return null;
  return this.request._extend({
    path: this.links.next.url
  });
};

module.exports = MapiResponse;

},{"../helpers/parse-link-header":16}],14:[function(require,module,exports){
'use strict';

module.exports = {
  API_ORIGIN: 'https://api.mapbox.com',
  EVENT_PROGRESS_DOWNLOAD: 'downloadProgress',
  EVENT_PROGRESS_UPLOAD: 'uploadProgress',
  EVENT_ERROR: 'error',
  EVENT_RESPONSE: 'response',
  ERROR_HTTP: 'HttpError',
  ERROR_REQUEST_ABORTED: 'RequestAbortedError'
};

},{}],15:[function(require,module,exports){
'use strict';

function parseSingleHeader(raw) {
  var boundary = raw.indexOf(':');
  var name = raw
    .substring(0, boundary)
    .trim()
    .toLowerCase();
  var value = raw.substring(boundary + 1).trim();
  return {
    name: name,
    value: value
  };
}

/**
 * Parse raw headers into an object with lowercase properties.
 * Does not fully parse headings into more complete data structure,
 * as larger libraries might do. Also does not deal with duplicate
 * headers because Node doesn't seem to deal with those well, so
 * we shouldn't let the browser either, for consistency.
 *
 * @param {string} raw
 * @returns {Object}
 */
function parseHeaders(raw) {
  var headers = {};
  if (!raw) {
    return headers;
  }

  raw
    .trim()
    .split(/[\r|\n]+/)
    .forEach(function(rawHeader) {
      var parsed = parseSingleHeader(rawHeader);
      headers[parsed.name] = parsed.value;
    });

  return headers;
}

module.exports = parseHeaders;

},{}],16:[function(require,module,exports){
'use strict';

// Like https://github.com/thlorenz/lib/parse-link-header but without any
// additional dependencies.

function parseParam(param) {
  var parts = param.match(/\s*(.+)\s*=\s*"?([^"]+)"?/);
  if (!parts) return null;

  return {
    key: parts[1],
    value: parts[2]
  };
}

function parseLink(link) {
  var parts = link.match(/<?([^>]*)>(.*)/);
  if (!parts) return null;

  var linkUrl = parts[1];
  var linkParams = parts[2].split(';');
  var rel = null;
  var parsedLinkParams = linkParams.reduce(function(result, param) {
    var parsed = parseParam(param);
    if (!parsed) return result;
    if (parsed.key === 'rel') {
      if (!rel) {
        rel = parsed.value;
      }
      return result;
    }
    result[parsed.key] = parsed.value;
    return result;
  }, {});
  if (!rel) return null;

  return {
    url: linkUrl,
    rel: rel,
    params: parsedLinkParams
  };
}

/**
 * Parse a Link header.
 *
 * @param {string} linkHeader
 * @returns {{
 *   [string]: {
 *     url: string,
 *     params: { [string]: string }
 *   }
 * }}
 */
function parseLinkHeader(linkHeader) {
  if (!linkHeader) return {};

  return linkHeader.split(/,\s*</).reduce(function(result, link) {
    var parsed = parseLink(link);
    if (!parsed) return result;
    // rel value can be multiple whitespace-separated rels.
    var splitRel = parsed.rel.split(/\s+/);
    splitRel.forEach(function(rel) {
      if (!result[rel]) {
        result[rel] = {
          url: parsed.url,
          params: parsed.params
        };
      }
    });
    return result;
  }, {});
}

module.exports = parseLinkHeader;

},{}],17:[function(require,module,exports){
'use strict';

// Encode each item of an array individually. The comma
// delimiters should not themselves be encoded.
function encodeArray(arrayValue) {
  return arrayValue.map(encodeURIComponent).join(',');
}

function encodeValue(value) {
  if (Array.isArray(value)) {
    return encodeArray(value);
  }
  return encodeURIComponent(String(value));
}

/**
 * Append a query parameter to a URL.
 *
 * @param {string} url
 * @param {string} key
 * @param {string|number|boolean|Array<*>>} [value] - Provide an array
 *   if the value is a list and commas between values need to be
 *   preserved, unencoded.
 * @returns {string} - Modified URL.
 */
function appendQueryParam(url, key, value) {
  if (value === false || value === null) {
    return url;
  }
  var punctuation = /\?/.test(url) ? '&' : '?';
  var query = encodeURIComponent(key);
  if (value !== undefined && value !== '' && value !== true) {
    query += '=' + encodeValue(value);
  }
  return '' + url + punctuation + query;
}

/**
 * Derive a query string from an object and append it
 * to a URL.
 *
 * @param {string} url
 * @param {Object} [queryObject] - Values should be primitives.
 * @returns {string} - Modified URL.
 */
function appendQueryObject(url, queryObject) {
  if (!queryObject) {
    return url;
  }

  var result = url;
  Object.keys(queryObject).forEach(function(key) {
    var value = queryObject[key];
    if (value === undefined) {
      return;
    }
    if (Array.isArray(value)) {
      value = value
        .filter(function(v) {
          return v !== null && v !== undefined;
        })
        .join(',');
    }
    result = appendQueryParam(result, key, value);
  });
  return result;
}

/**
 * Prepend an origin to a URL. If the URL already has an
 * origin, do nothing.
 *
 * @param {string} url
 * @param {string} origin
 * @returns {string} - Modified URL.
 */
function prependOrigin(url, origin) {
  if (!origin) {
    return url;
  }

  if (url.slice(0, 4) === 'http') {
    return url;
  }

  var delimiter = url[0] === '/' ? '' : '/';
  return '' + origin.replace(/\/$/, '') + delimiter + url;
}

/**
 * Interpolate values into a route with express-style,
 * colon-prefixed route parameters.
 *
 * @param {string} route
 * @param {Object} [params] - Values should be primitives
 *   or arrays of primitives. Provide an array if the value
 *   is a list and commas between values need to be
 *   preserved, unencoded.
 * @returns {string} - Modified URL.
 */
function interpolateRouteParams(route, params) {
  if (!params) {
    return route;
  }
  return route.replace(/\/:([a-zA-Z0-9]+)/g, function(_, paramId) {
    var value = params[paramId];
    if (value === undefined) {
      throw new Error('Unspecified route parameter ' + paramId);
    }
    var preppedValue = encodeValue(value);
    return '/' + preppedValue;
  });
}

module.exports = {
  appendQueryObject: appendQueryObject,
  appendQueryParam: appendQueryParam,
  prependOrigin: prependOrigin,
  interpolateRouteParams: interpolateRouteParams
};

},{}],18:[function(require,module,exports){
'use strict';

var xtend = require('xtend');
var v = require('./service-helpers/validator');
var pick = require('./service-helpers/pick');
var stringifyBooleans = require('./service-helpers/stringify-booleans');
var createServiceFactory = require('./service-helpers/create-service-factory');

/**
 * Geocoding API service.
 *
 * Learn more about this service and its responses in
 * [the HTTP service documentation](https://docs.mapbox.com/api/search/#geocoding).
 */
var Geocoding = {};

var featureTypes = [
  'country',
  'region',
  'postcode',
  'district',
  'place',
  'locality',
  'neighborhood',
  'address',
  'poi',
  'poi.landmark'
];

/**
 * Search for a place.
 *
 * See the [public documentation](https://docs.mapbox.com/api/search/#forward-geocoding).
 *
 * @param {Object} config
 * @param {string} config.query - A place name.
 * @param {'mapbox.places'|'mapbox.places-permanent'} [config.mode="mapbox.places"] - Either `mapbox.places` for ephemeral geocoding, or `mapbox.places-permanent` for storing results and batch geocoding.
 * @param {Array<string>} [config.countries] - Limits results to the specified countries.
 *   Each item in the array should be an [ISO 3166 alpha 2 country code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2).
 * @param {Coordinates} [config.proximity] - Bias local results based on a provided location.
 * @param {Array<'country'|'region'|'postcode'|'district'|'place'|'locality'|'neighborhood'|'address'|'poi'|'poi.landmark'>} [config.types] - Filter results by feature types.
 * @param {boolean} [config.autocomplete=true] - Return autocomplete results or not.
 * @param {BoundingBox} [config.bbox] - Limit results to a bounding box.
 * @param {number} [config.limit=5] - Limit the number of results returned.
 * @param {Array<string>} [config.language] - Specify the language to use for response text and, for forward geocoding, query result weighting.
 *  Options are [IETF language tags](https://en.wikipedia.org/wiki/IETF_language_tag) comprised of a mandatory
 *  [ISO 639-1 language code](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes) and optionally one or more IETF subtags for country or script.
 * @param {boolean} [config.routing=false] - Specify whether to request additional metadata about the recommended navigation destination. Only applicable for address features.
 * @return {MapiRequest}
 *
 * @example
 * geocodingClient.forwardGeocode({
 *   query: 'Paris, France',
 *   limit: 2
 * })
 *   .send()
 *   .then(response => {
 *     const match = response.body;
 *   });
 *
 * @example
 * // geocoding with proximity
 * geocodingClient.forwardGeocode({
 *   query: 'Paris, France',
 *   proximity: [-95.4431142, 33.6875431]
 * })
 *   .send()
 *   .then(response => {
 *     const match = response.body;
 *   });
 *
 * // geocoding with countries
 * geocodingClient.forwardGeocode({
 *   query: 'Paris, France',
 *   countries: ['fr']
 * })
 *   .send()
 *   .then(response => {
 *     const match = response.body;
 *   });
 *
 * // geocoding with bounding box
 * geocodingClient.forwardGeocode({
 *   query: 'Paris, France',
 *   bbox: [2.14, 48.72, 2.55, 48.96]
 * })
 *   .send()
 *   .then(response => {
 *     const match = response.body;
 *   });
 */
Geocoding.forwardGeocode = function(config) {
  v.assertShape({
    query: v.required(v.string),
    mode: v.oneOf('mapbox.places', 'mapbox.places-permanent'),
    countries: v.arrayOf(v.string),
    proximity: v.coordinates,
    types: v.arrayOf(v.oneOf(featureTypes)),
    autocomplete: v.boolean,
    bbox: v.arrayOf(v.number),
    limit: v.number,
    language: v.arrayOf(v.string),
    routing: v.boolean
  })(config);

  config.mode = config.mode || 'mapbox.places';

  var query = stringifyBooleans(
    xtend(
      { country: config.countries },
      pick(config, [
        'proximity',
        'types',
        'autocomplete',
        'bbox',
        'limit',
        'language',
        'routing'
      ])
    )
  );

  return this.client.createRequest({
    method: 'GET',
    path: '/geocoding/v5/:mode/:query.json',
    params: pick(config, ['mode', 'query']),
    query: query
  });
};

/**
 * Search for places near coordinates.
 *
 * See the [public documentation](https://docs.mapbox.com/api/search/#reverse-geocoding).
 *
 * @param {Object} config
 * @param {Coordinates} config.query - Coordinates at which features will be searched.
 * @param {'mapbox.places'|'mapbox.places-permanent'} [config.mode="mapbox.places"] - Either `mapbox.places` for ephemeral geocoding, or `mapbox.places-permanent` for storing results and batch geocoding.
 * @param {Array<string>} [config.countries] - Limits results to the specified countries.
 *   Each item in the array should be an [ISO 3166 alpha 2 country code](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2).
 * @param {Array<'country'|'region'|'postcode'|'district'|'place'|'locality'|'neighborhood'|'address'|'poi'|'poi.landmark'>} [config.types] - Filter results by feature types.
 * @param {BoundingBox} [config.bbox] - Limit results to a bounding box.
 * @param {number} [config.limit=1] - Limit the number of results returned. If using this option, you must provide a single item for `types`.
 * @param {Array<string>} [config.language] - Specify the language to use for response text and, for forward geocoding, query result weighting.
 *  Options are [IETF language tags](https://en.wikipedia.org/wiki/IETF_language_tag) comprised of a mandatory
 *  [ISO 639-1 language code](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes) and optionally one or more IETF subtags for country or script.
 * @param {'distance'|'score'} [config.reverseMode='distance'] - Set the factors that are used to sort nearby results.
 * @param {boolean} [config.routing=false] - Specify whether to request additional metadata about the recommended navigation destination. Only applicable for address features.
 * @return {MapiRequest}
 *
 * @example
 * geocodingClient.reverseGeocode({
 *   query: [-95.4431142, 33.6875431]
 * })
 *   .send()
 *   .then(response => {
 *     // GeoJSON document with geocoding matches
 *     const match = response.body;
 *   });
 */
Geocoding.reverseGeocode = function(config) {
  v.assertShape({
    query: v.required(v.coordinates),
    mode: v.oneOf('mapbox.places', 'mapbox.places-permanent'),
    countries: v.arrayOf(v.string),
    types: v.arrayOf(v.oneOf(featureTypes)),
    bbox: v.arrayOf(v.number),
    limit: v.number,
    language: v.arrayOf(v.string),
    reverseMode: v.oneOf('distance', 'score'),
    routing: v.boolean
  })(config);

  config.mode = config.mode || 'mapbox.places';

  var query = stringifyBooleans(
    xtend(
      { country: config.countries },
      pick(config, [
        'country',
        'types',
        'bbox',
        'limit',
        'language',
        'reverseMode',
        'routing'
      ])
    )
  );

  return this.client.createRequest({
    method: 'GET',
    path: '/geocoding/v5/:mode/:query.json',
    params: pick(config, ['mode', 'query']),
    query: query
  });
};

module.exports = createServiceFactory(Geocoding);

},{"./service-helpers/create-service-factory":19,"./service-helpers/pick":21,"./service-helpers/stringify-booleans":22,"./service-helpers/validator":23,"xtend":192}],19:[function(require,module,exports){
'use strict';

var MapiClient = require('../../lib/classes/mapi-client');
// This will create the environment-appropriate client.
var createClient = require('../../lib/client');

function createServiceFactory(ServicePrototype) {
  return function(clientOrConfig) {
    var client;
    if (MapiClient.prototype.isPrototypeOf(clientOrConfig)) {
      client = clientOrConfig;
    } else {
      client = createClient(clientOrConfig);
    }
    var service = Object.create(ServicePrototype);
    service.client = client;
    return service;
  };
}

module.exports = createServiceFactory;

},{"../../lib/classes/mapi-client":10,"../../lib/client":8}],20:[function(require,module,exports){
'use strict';

function objectMap(obj, cb) {
  return Object.keys(obj).reduce(function(result, key) {
    result[key] = cb(key, obj[key]);
    return result;
  }, {});
}

module.exports = objectMap;

},{}],21:[function(require,module,exports){
'use strict';

/**
 * Create a new object by picking properties off an existing object.
 * The second param can be overloaded as a callback for
 * more fine grained picking of properties.
 * @param {Object} source
 * @param {Array<string>|function(string, Object):boolean} keys
 * @returns {Object}
 */
function pick(source, keys) {
  var filter = function(key, val) {
    return keys.indexOf(key) !== -1 && val !== undefined;
  };

  if (typeof keys === 'function') {
    filter = keys;
  }

  return Object.keys(source)
    .filter(function(key) {
      return filter(key, source[key]);
    })
    .reduce(function(result, key) {
      result[key] = source[key];
      return result;
    }, {});
}

module.exports = pick;

},{}],22:[function(require,module,exports){
'use strict';

var objectMap = require('./object-map');

/**
 * Stringify all the boolean values in an object, so true becomes "true".
 *
 * @param {Object} obj
 * @returns {Object}
 */
function stringifyBoolean(obj) {
  return objectMap(obj, function(_, value) {
    return typeof value === 'boolean' ? JSON.stringify(value) : value;
  });
}

module.exports = stringifyBoolean;

},{"./object-map":20}],23:[function(require,module,exports){
(function (global){(function (){
'use strict';

var xtend = require('xtend');
var v = require('@mapbox/fusspot');

function file(value) {
  // If we're in a browser so Blob is available, the file must be that.
  // In Node, however, it could be a filepath or a pipeable (Readable) stream.
  if (typeof window !== 'undefined') {
    if (value instanceof global.Blob || value instanceof global.ArrayBuffer) {
      return;
    }
    return 'Blob or ArrayBuffer';
  }
  if (typeof value === 'string' || value.pipe !== undefined) {
    return;
  }
  return 'Filename or Readable stream';
}

function assertShape(validatorObj, apiName) {
  return v.assert(v.strictShape(validatorObj), apiName);
}

function date(value) {
  var msg = 'date';
  if (typeof value === 'boolean') {
    return msg;
  }
  try {
    var date = new Date(value);
    if (date.getTime && isNaN(date.getTime())) {
      return msg;
    }
  } catch (e) {
    return msg;
  }
}

function coordinates(value) {
  return v.tuple(v.number, v.number)(value);
}

module.exports = xtend(v, {
  file: file,
  date: date,
  coordinates: coordinates,
  assertShape: assertShape
});

}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"@mapbox/fusspot":2,"xtend":192}],24:[function(require,module,exports){
'use strict';

var base64 = require('base-64');

var tokenCache = {};

function parseToken(token) {
  if (tokenCache[token]) {
    return tokenCache[token];
  }

  var parts = token.split('.');
  var usage = parts[0];
  var rawPayload = parts[1];
  if (!rawPayload) {
    throw new Error('Invalid token');
  }

  var parsedPayload = parsePaylod(rawPayload);

  var result = {
    usage: usage,
    user: parsedPayload.u
  };
  if (has(parsedPayload, 'a')) result.authorization = parsedPayload.a;
  if (has(parsedPayload, 'exp')) result.expires = parsedPayload.exp * 1000;
  if (has(parsedPayload, 'iat')) result.created = parsedPayload.iat * 1000;
  if (has(parsedPayload, 'scopes')) result.scopes = parsedPayload.scopes;
  if (has(parsedPayload, 'client')) result.client = parsedPayload.client;
  if (has(parsedPayload, 'll')) result.lastLogin = parsedPayload.ll;
  if (has(parsedPayload, 'iu')) result.impersonator = parsedPayload.iu;

  tokenCache[token] = result;
  return result;
}

function parsePaylod(rawPayload) {
  try {
    return JSON.parse(base64.decode(rawPayload));
  } catch (parseError) {
    throw new Error('Invalid token');
  }
}

function has(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

module.exports = parseToken;

},{"base-64":30}],25:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _helpers = require("@turf/helpers");

var _invariant = require("@turf/invariant");

// To-Do => Improve Typescript GeoJSON handling

/**
 * Removes redundant coordinates from any GeoJSON Geometry.
 *
 * @name cleanCoords
 * @param {Geometry|Feature} geojson Feature or Geometry
 * @param {Object} [options={}] Optional parameters
 * @param {boolean} [options.mutate=false] allows GeoJSON input to be mutated
 * @returns {Geometry|Feature} the cleaned input Feature/Geometry
 * @example
 * var line = turf.lineString([[0, 0], [0, 2], [0, 5], [0, 8], [0, 8], [0, 10]]);
 * var multiPoint = turf.multiPoint([[0, 0], [0, 0], [2, 2]]);
 *
 * turf.cleanCoords(line).geometry.coordinates;
 * //= [[0, 0], [0, 10]]
 *
 * turf.cleanCoords(multiPoint).geometry.coordinates;
 * //= [[0, 0], [2, 2]]
 */
function cleanCoords(geojson, options) {
  if (options === void 0) {
    options = {};
  } // Backwards compatible with v4.0


  var mutate = typeof options === "object" ? options.mutate : options;
  if (!geojson) throw new Error("geojson is required");
  var type = (0, _invariant.getType)(geojson); // Store new "clean" points in this Array

  var newCoords = [];

  switch (type) {
    case "LineString":
      newCoords = cleanLine(geojson);
      break;

    case "MultiLineString":
    case "Polygon":
      (0, _invariant.getCoords)(geojson).forEach(function (line) {
        newCoords.push(cleanLine(line));
      });
      break;

    case "MultiPolygon":
      (0, _invariant.getCoords)(geojson).forEach(function (polygons) {
        var polyPoints = [];
        polygons.forEach(function (ring) {
          polyPoints.push(cleanLine(ring));
        });
        newCoords.push(polyPoints);
      });
      break;

    case "Point":
      return geojson;

    case "MultiPoint":
      var existing = {};
      (0, _invariant.getCoords)(geojson).forEach(function (coord) {
        var key = coord.join("-");

        if (!Object.prototype.hasOwnProperty.call(existing, key)) {
          newCoords.push(coord);
          existing[key] = true;
        }
      });
      break;

    default:
      throw new Error(type + " geometry not supported");
  } // Support input mutation


  if (geojson.coordinates) {
    if (mutate === true) {
      geojson.coordinates = newCoords;
      return geojson;
    }

    return {
      type: type,
      coordinates: newCoords
    };
  } else {
    if (mutate === true) {
      geojson.geometry.coordinates = newCoords;
      return geojson;
    }

    return (0, _helpers.feature)({
      type: type,
      coordinates: newCoords
    }, geojson.properties, {
      bbox: geojson.bbox,
      id: geojson.id
    });
  }
}
/**
 * Clean Coords
 *
 * @private
 * @param {Array<number>|LineString} line Line
 * @returns {Array<number>} Cleaned coordinates
 */


function cleanLine(line) {
  var points = (0, _invariant.getCoords)(line); // handle "clean" segment

  if (points.length === 2 && !equals(points[0], points[1])) return points;
  var newPoints = [];
  var secondToLast = points.length - 1;
  var newPointsLength = newPoints.length;
  newPoints.push(points[0]);

  for (var i = 1; i < secondToLast; i++) {
    var prevAddedPoint = newPoints[newPoints.length - 1];
    if (points[i][0] === prevAddedPoint[0] && points[i][1] === prevAddedPoint[1]) continue;else {
      newPoints.push(points[i]);
      newPointsLength = newPoints.length;

      if (newPointsLength > 2) {
        if (isPointOnLineSegment(newPoints[newPointsLength - 3], newPoints[newPointsLength - 1], newPoints[newPointsLength - 2])) newPoints.splice(newPoints.length - 2, 1);
      }
    }
  }

  newPoints.push(points[points.length - 1]);
  newPointsLength = newPoints.length;
  if (equals(points[0], points[points.length - 1]) && newPointsLength < 4) throw new Error("invalid polygon");
  if (isPointOnLineSegment(newPoints[newPointsLength - 3], newPoints[newPointsLength - 1], newPoints[newPointsLength - 2])) newPoints.splice(newPoints.length - 2, 1);
  return newPoints;
}
/**
 * Compares two points and returns if they are equals
 *
 * @private
 * @param {Position} pt1 point
 * @param {Position} pt2 point
 * @returns {boolean} true if they are equals
 */


function equals(pt1, pt2) {
  return pt1[0] === pt2[0] && pt1[1] === pt2[1];
}
/**
 * Returns if `point` is on the segment between `start` and `end`.
 * Borrowed from `@turf/boolean-point-on-line` to speed up the evaluation (instead of using the module as dependency)
 *
 * @private
 * @param {Position} start coord pair of start of line
 * @param {Position} end coord pair of end of line
 * @param {Position} point coord pair of point to check
 * @returns {boolean} true/false
 */


function isPointOnLineSegment(start, end, point) {
  var x = point[0],
      y = point[1];
  var startX = start[0],
      startY = start[1];
  var endX = end[0],
      endY = end[1];
  var dxc = x - startX;
  var dyc = y - startY;
  var dxl = endX - startX;
  var dyl = endY - startY;
  var cross = dxc * dyl - dyc * dxl;
  if (cross !== 0) return false;else if (Math.abs(dxl) >= Math.abs(dyl)) return dxl > 0 ? startX <= x && x <= endX : endX <= x && x <= startX;else return dyl > 0 ? startY <= y && y <= endY : endY <= y && y <= startY;
}

var _default = cleanCoords;
exports.default = _default;

},{"@turf/helpers":26,"@turf/invariant":27}],26:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.feature = feature;
exports.geometry = geometry;
exports.point = point;
exports.points = points;
exports.polygon = polygon;
exports.polygons = polygons;
exports.lineString = lineString;
exports.lineStrings = lineStrings;
exports.featureCollection = featureCollection;
exports.multiLineString = multiLineString;
exports.multiPoint = multiPoint;
exports.multiPolygon = multiPolygon;
exports.geometryCollection = geometryCollection;
exports.round = round;
exports.radiansToLength = radiansToLength;
exports.lengthToRadians = lengthToRadians;
exports.lengthToDegrees = lengthToDegrees;
exports.bearingToAzimuth = bearingToAzimuth;
exports.radiansToDegrees = radiansToDegrees;
exports.degreesToRadians = degreesToRadians;
exports.convertLength = convertLength;
exports.convertArea = convertArea;
exports.isNumber = isNumber;
exports.isObject = isObject;
exports.validateBBox = validateBBox;
exports.validateId = validateId;
exports.areaFactors = exports.unitsFactors = exports.factors = exports.earthRadius = void 0;

/**
 * @module helpers
 */

/**
 * Earth Radius used with the Harvesine formula and approximates using a spherical (non-ellipsoid) Earth.
 *
 * @memberof helpers
 * @type {number}
 */
var earthRadius = 6371008.8;
/**
 * Unit of measurement factors using a spherical (non-ellipsoid) earth radius.
 *
 * @memberof helpers
 * @type {Object}
 */

exports.earthRadius = earthRadius;
var factors = {
  centimeters: earthRadius * 100,
  centimetres: earthRadius * 100,
  degrees: earthRadius / 111325,
  feet: earthRadius * 3.28084,
  inches: earthRadius * 39.37,
  kilometers: earthRadius / 1000,
  kilometres: earthRadius / 1000,
  meters: earthRadius,
  metres: earthRadius,
  miles: earthRadius / 1609.344,
  millimeters: earthRadius * 1000,
  millimetres: earthRadius * 1000,
  nauticalmiles: earthRadius / 1852,
  radians: 1,
  yards: earthRadius * 1.0936
};
/**
 * Units of measurement factors based on 1 meter.
 *
 * @memberof helpers
 * @type {Object}
 */

exports.factors = factors;
var unitsFactors = {
  centimeters: 100,
  centimetres: 100,
  degrees: 1 / 111325,
  feet: 3.28084,
  inches: 39.37,
  kilometers: 1 / 1000,
  kilometres: 1 / 1000,
  meters: 1,
  metres: 1,
  miles: 1 / 1609.344,
  millimeters: 1000,
  millimetres: 1000,
  nauticalmiles: 1 / 1852,
  radians: 1 / earthRadius,
  yards: 1.0936133
};
/**
 * Area of measurement factors based on 1 square meter.
 *
 * @memberof helpers
 * @type {Object}
 */

exports.unitsFactors = unitsFactors;
var areaFactors = {
  acres: 0.000247105,
  centimeters: 10000,
  centimetres: 10000,
  feet: 10.763910417,
  hectares: 0.0001,
  inches: 1550.003100006,
  kilometers: 0.000001,
  kilometres: 0.000001,
  meters: 1,
  metres: 1,
  miles: 3.86e-7,
  millimeters: 1000000,
  millimetres: 1000000,
  yards: 1.195990046
};
/**
 * Wraps a GeoJSON {@link Geometry} in a GeoJSON {@link Feature}.
 *
 * @name feature
 * @param {Geometry} geometry input geometry
 * @param {Object} [properties={}] an Object of key-value pairs to add as properties
 * @param {Object} [options={}] Optional Parameters
 * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
 * @param {string|number} [options.id] Identifier associated with the Feature
 * @returns {Feature} a GeoJSON Feature
 * @example
 * var geometry = {
 *   "type": "Point",
 *   "coordinates": [110, 50]
 * };
 *
 * var feature = turf.feature(geometry);
 *
 * //=feature
 */

exports.areaFactors = areaFactors;

function feature(geom, properties, options) {
  if (options === void 0) {
    options = {};
  }

  var feat = {
    type: "Feature"
  };

  if (options.id === 0 || options.id) {
    feat.id = options.id;
  }

  if (options.bbox) {
    feat.bbox = options.bbox;
  }

  feat.properties = properties || {};
  feat.geometry = geom;
  return feat;
}
/**
 * Creates a GeoJSON {@link Geometry} from a Geometry string type & coordinates.
 * For GeometryCollection type use `helpers.geometryCollection`
 *
 * @name geometry
 * @param {string} type Geometry Type
 * @param {Array<any>} coordinates Coordinates
 * @param {Object} [options={}] Optional Parameters
 * @returns {Geometry} a GeoJSON Geometry
 * @example
 * var type = "Point";
 * var coordinates = [110, 50];
 * var geometry = turf.geometry(type, coordinates);
 * // => geometry
 */


function geometry(type, coordinates, _options) {
  if (_options === void 0) {
    _options = {};
  }

  switch (type) {
    case "Point":
      return point(coordinates).geometry;

    case "LineString":
      return lineString(coordinates).geometry;

    case "Polygon":
      return polygon(coordinates).geometry;

    case "MultiPoint":
      return multiPoint(coordinates).geometry;

    case "MultiLineString":
      return multiLineString(coordinates).geometry;

    case "MultiPolygon":
      return multiPolygon(coordinates).geometry;

    default:
      throw new Error(type + " is invalid");
  }
}
/**
 * Creates a {@link Point} {@link Feature} from a Position.
 *
 * @name point
 * @param {Array<number>} coordinates longitude, latitude position (each in decimal degrees)
 * @param {Object} [properties={}] an Object of key-value pairs to add as properties
 * @param {Object} [options={}] Optional Parameters
 * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
 * @param {string|number} [options.id] Identifier associated with the Feature
 * @returns {Feature<Point>} a Point feature
 * @example
 * var point = turf.point([-75.343, 39.984]);
 *
 * //=point
 */


function point(coordinates, properties, options) {
  if (options === void 0) {
    options = {};
  }

  if (!coordinates) {
    throw new Error("coordinates is required");
  }

  if (!Array.isArray(coordinates)) {
    throw new Error("coordinates must be an Array");
  }

  if (coordinates.length < 2) {
    throw new Error("coordinates must be at least 2 numbers long");
  }

  if (!isNumber(coordinates[0]) || !isNumber(coordinates[1])) {
    throw new Error("coordinates must contain numbers");
  }

  var geom = {
    type: "Point",
    coordinates: coordinates
  };
  return feature(geom, properties, options);
}
/**
 * Creates a {@link Point} {@link FeatureCollection} from an Array of Point coordinates.
 *
 * @name points
 * @param {Array<Array<number>>} coordinates an array of Points
 * @param {Object} [properties={}] Translate these properties to each Feature
 * @param {Object} [options={}] Optional Parameters
 * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north]
 * associated with the FeatureCollection
 * @param {string|number} [options.id] Identifier associated with the FeatureCollection
 * @returns {FeatureCollection<Point>} Point Feature
 * @example
 * var points = turf.points([
 *   [-75, 39],
 *   [-80, 45],
 *   [-78, 50]
 * ]);
 *
 * //=points
 */


function points(coordinates, properties, options) {
  if (options === void 0) {
    options = {};
  }

  return featureCollection(coordinates.map(function (coords) {
    return point(coords, properties);
  }), options);
}
/**
 * Creates a {@link Polygon} {@link Feature} from an Array of LinearRings.
 *
 * @name polygon
 * @param {Array<Array<Array<number>>>} coordinates an array of LinearRings
 * @param {Object} [properties={}] an Object of key-value pairs to add as properties
 * @param {Object} [options={}] Optional Parameters
 * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
 * @param {string|number} [options.id] Identifier associated with the Feature
 * @returns {Feature<Polygon>} Polygon Feature
 * @example
 * var polygon = turf.polygon([[[-5, 52], [-4, 56], [-2, 51], [-7, 54], [-5, 52]]], { name: 'poly1' });
 *
 * //=polygon
 */


function polygon(coordinates, properties, options) {
  if (options === void 0) {
    options = {};
  }

  for (var _i = 0, coordinates_1 = coordinates; _i < coordinates_1.length; _i++) {
    var ring = coordinates_1[_i];

    if (ring.length < 4) {
      throw new Error("Each LinearRing of a Polygon must have 4 or more Positions.");
    }

    for (var j = 0; j < ring[ring.length - 1].length; j++) {
      // Check if first point of Polygon contains two numbers
      if (ring[ring.length - 1][j] !== ring[0][j]) {
        throw new Error("First and last Position are not equivalent.");
      }
    }
  }

  var geom = {
    type: "Polygon",
    coordinates: coordinates
  };
  return feature(geom, properties, options);
}
/**
 * Creates a {@link Polygon} {@link FeatureCollection} from an Array of Polygon coordinates.
 *
 * @name polygons
 * @param {Array<Array<Array<Array<number>>>>} coordinates an array of Polygon coordinates
 * @param {Object} [properties={}] an Object of key-value pairs to add as properties
 * @param {Object} [options={}] Optional Parameters
 * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
 * @param {string|number} [options.id] Identifier associated with the FeatureCollection
 * @returns {FeatureCollection<Polygon>} Polygon FeatureCollection
 * @example
 * var polygons = turf.polygons([
 *   [[[-5, 52], [-4, 56], [-2, 51], [-7, 54], [-5, 52]]],
 *   [[[-15, 42], [-14, 46], [-12, 41], [-17, 44], [-15, 42]]],
 * ]);
 *
 * //=polygons
 */


function polygons(coordinates, properties, options) {
  if (options === void 0) {
    options = {};
  }

  return featureCollection(coordinates.map(function (coords) {
    return polygon(coords, properties);
  }), options);
}
/**
 * Creates a {@link LineString} {@link Feature} from an Array of Positions.
 *
 * @name lineString
 * @param {Array<Array<number>>} coordinates an array of Positions
 * @param {Object} [properties={}] an Object of key-value pairs to add as properties
 * @param {Object} [options={}] Optional Parameters
 * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
 * @param {string|number} [options.id] Identifier associated with the Feature
 * @returns {Feature<LineString>} LineString Feature
 * @example
 * var linestring1 = turf.lineString([[-24, 63], [-23, 60], [-25, 65], [-20, 69]], {name: 'line 1'});
 * var linestring2 = turf.lineString([[-14, 43], [-13, 40], [-15, 45], [-10, 49]], {name: 'line 2'});
 *
 * //=linestring1
 * //=linestring2
 */


function lineString(coordinates, properties, options) {
  if (options === void 0) {
    options = {};
  }

  if (coordinates.length < 2) {
    throw new Error("coordinates must be an array of two or more positions");
  }

  var geom = {
    type: "LineString",
    coordinates: coordinates
  };
  return feature(geom, properties, options);
}
/**
 * Creates a {@link LineString} {@link FeatureCollection} from an Array of LineString coordinates.
 *
 * @name lineStrings
 * @param {Array<Array<Array<number>>>} coordinates an array of LinearRings
 * @param {Object} [properties={}] an Object of key-value pairs to add as properties
 * @param {Object} [options={}] Optional Parameters
 * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north]
 * associated with the FeatureCollection
 * @param {string|number} [options.id] Identifier associated with the FeatureCollection
 * @returns {FeatureCollection<LineString>} LineString FeatureCollection
 * @example
 * var linestrings = turf.lineStrings([
 *   [[-24, 63], [-23, 60], [-25, 65], [-20, 69]],
 *   [[-14, 43], [-13, 40], [-15, 45], [-10, 49]]
 * ]);
 *
 * //=linestrings
 */


function lineStrings(coordinates, properties, options) {
  if (options === void 0) {
    options = {};
  }

  return featureCollection(coordinates.map(function (coords) {
    return lineString(coords, properties);
  }), options);
}
/**
 * Takes one or more {@link Feature|Features} and creates a {@link FeatureCollection}.
 *
 * @name featureCollection
 * @param {Feature[]} features input features
 * @param {Object} [options={}] Optional Parameters
 * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
 * @param {string|number} [options.id] Identifier associated with the Feature
 * @returns {FeatureCollection} FeatureCollection of Features
 * @example
 * var locationA = turf.point([-75.343, 39.984], {name: 'Location A'});
 * var locationB = turf.point([-75.833, 39.284], {name: 'Location B'});
 * var locationC = turf.point([-75.534, 39.123], {name: 'Location C'});
 *
 * var collection = turf.featureCollection([
 *   locationA,
 *   locationB,
 *   locationC
 * ]);
 *
 * //=collection
 */


function featureCollection(features, options) {
  if (options === void 0) {
    options = {};
  }

  var fc = {
    type: "FeatureCollection"
  };

  if (options.id) {
    fc.id = options.id;
  }

  if (options.bbox) {
    fc.bbox = options.bbox;
  }

  fc.features = features;
  return fc;
}
/**
 * Creates a {@link Feature<MultiLineString>} based on a
 * coordinate array. Properties can be added optionally.
 *
 * @name multiLineString
 * @param {Array<Array<Array<number>>>} coordinates an array of LineStrings
 * @param {Object} [properties={}] an Object of key-value pairs to add as properties
 * @param {Object} [options={}] Optional Parameters
 * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
 * @param {string|number} [options.id] Identifier associated with the Feature
 * @returns {Feature<MultiLineString>} a MultiLineString feature
 * @throws {Error} if no coordinates are passed
 * @example
 * var multiLine = turf.multiLineString([[[0,0],[10,10]]]);
 *
 * //=multiLine
 */


function multiLineString(coordinates, properties, options) {
  if (options === void 0) {
    options = {};
  }

  var geom = {
    type: "MultiLineString",
    coordinates: coordinates
  };
  return feature(geom, properties, options);
}
/**
 * Creates a {@link Feature<MultiPoint>} based on a
 * coordinate array. Properties can be added optionally.
 *
 * @name multiPoint
 * @param {Array<Array<number>>} coordinates an array of Positions
 * @param {Object} [properties={}] an Object of key-value pairs to add as properties
 * @param {Object} [options={}] Optional Parameters
 * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
 * @param {string|number} [options.id] Identifier associated with the Feature
 * @returns {Feature<MultiPoint>} a MultiPoint feature
 * @throws {Error} if no coordinates are passed
 * @example
 * var multiPt = turf.multiPoint([[0,0],[10,10]]);
 *
 * //=multiPt
 */


function multiPoint(coordinates, properties, options) {
  if (options === void 0) {
    options = {};
  }

  var geom = {
    type: "MultiPoint",
    coordinates: coordinates
  };
  return feature(geom, properties, options);
}
/**
 * Creates a {@link Feature<MultiPolygon>} based on a
 * coordinate array. Properties can be added optionally.
 *
 * @name multiPolygon
 * @param {Array<Array<Array<Array<number>>>>} coordinates an array of Polygons
 * @param {Object} [properties={}] an Object of key-value pairs to add as properties
 * @param {Object} [options={}] Optional Parameters
 * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
 * @param {string|number} [options.id] Identifier associated with the Feature
 * @returns {Feature<MultiPolygon>} a multipolygon feature
 * @throws {Error} if no coordinates are passed
 * @example
 * var multiPoly = turf.multiPolygon([[[[0,0],[0,10],[10,10],[10,0],[0,0]]]]);
 *
 * //=multiPoly
 *
 */


function multiPolygon(coordinates, properties, options) {
  if (options === void 0) {
    options = {};
  }

  var geom = {
    type: "MultiPolygon",
    coordinates: coordinates
  };
  return feature(geom, properties, options);
}
/**
 * Creates a {@link Feature<GeometryCollection>} based on a
 * coordinate array. Properties can be added optionally.
 *
 * @name geometryCollection
 * @param {Array<Geometry>} geometries an array of GeoJSON Geometries
 * @param {Object} [properties={}] an Object of key-value pairs to add as properties
 * @param {Object} [options={}] Optional Parameters
 * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
 * @param {string|number} [options.id] Identifier associated with the Feature
 * @returns {Feature<GeometryCollection>} a GeoJSON GeometryCollection Feature
 * @example
 * var pt = turf.geometry("Point", [100, 0]);
 * var line = turf.geometry("LineString", [[101, 0], [102, 1]]);
 * var collection = turf.geometryCollection([pt, line]);
 *
 * // => collection
 */


function geometryCollection(geometries, properties, options) {
  if (options === void 0) {
    options = {};
  }

  var geom = {
    type: "GeometryCollection",
    geometries: geometries
  };
  return feature(geom, properties, options);
}
/**
 * Round number to precision
 *
 * @param {number} num Number
 * @param {number} [precision=0] Precision
 * @returns {number} rounded number
 * @example
 * turf.round(120.4321)
 * //=120
 *
 * turf.round(120.4321, 2)
 * //=120.43
 */


function round(num, precision) {
  if (precision === void 0) {
    precision = 0;
  }

  if (precision && !(precision >= 0)) {
    throw new Error("precision must be a positive number");
  }

  var multiplier = Math.pow(10, precision || 0);
  return Math.round(num * multiplier) / multiplier;
}
/**
 * Convert a distance measurement (assuming a spherical Earth) from radians to a more friendly unit.
 * Valid units: miles, nauticalmiles, inches, yards, meters, metres, kilometers, centimeters, feet
 *
 * @name radiansToLength
 * @param {number} radians in radians across the sphere
 * @param {string} [units="kilometers"] can be degrees, radians, miles, inches, yards, metres,
 * meters, kilometres, kilometers.
 * @returns {number} distance
 */


function radiansToLength(radians, units) {
  if (units === void 0) {
    units = "kilometers";
  }

  var factor = factors[units];

  if (!factor) {
    throw new Error(units + " units is invalid");
  }

  return radians * factor;
}
/**
 * Convert a distance measurement (assuming a spherical Earth) from a real-world unit into radians
 * Valid units: miles, nauticalmiles, inches, yards, meters, metres, kilometers, centimeters, feet
 *
 * @name lengthToRadians
 * @param {number} distance in real units
 * @param {string} [units="kilometers"] can be degrees, radians, miles, inches, yards, metres,
 * meters, kilometres, kilometers.
 * @returns {number} radians
 */


function lengthToRadians(distance, units) {
  if (units === void 0) {
    units = "kilometers";
  }

  var factor = factors[units];

  if (!factor) {
    throw new Error(units + " units is invalid");
  }

  return distance / factor;
}
/**
 * Convert a distance measurement (assuming a spherical Earth) from a real-world unit into degrees
 * Valid units: miles, nauticalmiles, inches, yards, meters, metres, centimeters, kilometres, feet
 *
 * @name lengthToDegrees
 * @param {number} distance in real units
 * @param {string} [units="kilometers"] can be degrees, radians, miles, inches, yards, metres,
 * meters, kilometres, kilometers.
 * @returns {number} degrees
 */


function lengthToDegrees(distance, units) {
  return radiansToDegrees(lengthToRadians(distance, units));
}
/**
 * Converts any bearing angle from the north line direction (positive clockwise)
 * and returns an angle between 0-360 degrees (positive clockwise), 0 being the north line
 *
 * @name bearingToAzimuth
 * @param {number} bearing angle, between -180 and +180 degrees
 * @returns {number} angle between 0 and 360 degrees
 */


function bearingToAzimuth(bearing) {
  var angle = bearing % 360;

  if (angle < 0) {
    angle += 360;
  }

  return angle;
}
/**
 * Converts an angle in radians to degrees
 *
 * @name radiansToDegrees
 * @param {number} radians angle in radians
 * @returns {number} degrees between 0 and 360 degrees
 */


function radiansToDegrees(radians) {
  var degrees = radians % (2 * Math.PI);
  return degrees * 180 / Math.PI;
}
/**
 * Converts an angle in degrees to radians
 *
 * @name degreesToRadians
 * @param {number} degrees angle between 0 and 360 degrees
 * @returns {number} angle in radians
 */


function degreesToRadians(degrees) {
  var radians = degrees % 360;
  return radians * Math.PI / 180;
}
/**
 * Converts a length to the requested unit.
 * Valid units: miles, nauticalmiles, inches, yards, meters, metres, kilometers, centimeters, feet
 *
 * @param {number} length to be converted
 * @param {Units} [originalUnit="kilometers"] of the length
 * @param {Units} [finalUnit="kilometers"] returned unit
 * @returns {number} the converted length
 */


function convertLength(length, originalUnit, finalUnit) {
  if (originalUnit === void 0) {
    originalUnit = "kilometers";
  }

  if (finalUnit === void 0) {
    finalUnit = "kilometers";
  }

  if (!(length >= 0)) {
    throw new Error("length must be a positive number");
  }

  return radiansToLength(lengthToRadians(length, originalUnit), finalUnit);
}
/**
 * Converts a area to the requested unit.
 * Valid units: kilometers, kilometres, meters, metres, centimetres, millimeters, acres, miles, yards, feet, inches, hectares
 * @param {number} area to be converted
 * @param {Units} [originalUnit="meters"] of the distance
 * @param {Units} [finalUnit="kilometers"] returned unit
 * @returns {number} the converted area
 */


function convertArea(area, originalUnit, finalUnit) {
  if (originalUnit === void 0) {
    originalUnit = "meters";
  }

  if (finalUnit === void 0) {
    finalUnit = "kilometers";
  }

  if (!(area >= 0)) {
    throw new Error("area must be a positive number");
  }

  var startFactor = areaFactors[originalUnit];

  if (!startFactor) {
    throw new Error("invalid original units");
  }

  var finalFactor = areaFactors[finalUnit];

  if (!finalFactor) {
    throw new Error("invalid final units");
  }

  return area / startFactor * finalFactor;
}
/**
 * isNumber
 *
 * @param {*} num Number to validate
 * @returns {boolean} true/false
 * @example
 * turf.isNumber(123)
 * //=true
 * turf.isNumber('foo')
 * //=false
 */


function isNumber(num) {
  return !isNaN(num) && num !== null && !Array.isArray(num);
}
/**
 * isObject
 *
 * @param {*} input variable to validate
 * @returns {boolean} true/false
 * @example
 * turf.isObject({elevation: 10})
 * //=true
 * turf.isObject('foo')
 * //=false
 */


function isObject(input) {
  return !!input && input.constructor === Object;
}
/**
 * Validate BBox
 *
 * @private
 * @param {Array<number>} bbox BBox to validate
 * @returns {void}
 * @throws Error if BBox is not valid
 * @example
 * validateBBox([-180, -40, 110, 50])
 * //=OK
 * validateBBox([-180, -40])
 * //=Error
 * validateBBox('Foo')
 * //=Error
 * validateBBox(5)
 * //=Error
 * validateBBox(null)
 * //=Error
 * validateBBox(undefined)
 * //=Error
 */


function validateBBox(bbox) {
  if (!bbox) {
    throw new Error("bbox is required");
  }

  if (!Array.isArray(bbox)) {
    throw new Error("bbox must be an Array");
  }

  if (bbox.length !== 4 && bbox.length !== 6) {
    throw new Error("bbox must be an Array of 4 or 6 numbers");
  }

  bbox.forEach(function (num) {
    if (!isNumber(num)) {
      throw new Error("bbox must only contain numbers");
    }
  });
}
/**
 * Validate Id
 *
 * @private
 * @param {string|number} id Id to validate
 * @returns {void}
 * @throws Error if Id is not valid
 * @example
 * validateId([-180, -40, 110, 50])
 * //=Error
 * validateId([-180, -40])
 * //=Error
 * validateId('Foo')
 * //=OK
 * validateId(5)
 * //=OK
 * validateId(null)
 * //=Error
 * validateId(undefined)
 * //=Error
 */


function validateId(id) {
  if (!id) {
    throw new Error("id is required");
  }

  if (["string", "number"].indexOf(typeof id) === -1) {
    throw new Error("id must be a number or a string");
  }
}

},{}],27:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getCoord = getCoord;
exports.getCoords = getCoords;
exports.containsNumber = containsNumber;
exports.geojsonType = geojsonType;
exports.featureOf = featureOf;
exports.collectionOf = collectionOf;
exports.getGeom = getGeom;
exports.getType = getType;

var _helpers = require("@turf/helpers");

/**
 * Unwrap a coordinate from a Point Feature, Geometry or a single coordinate.
 *
 * @name getCoord
 * @param {Array<number>|Geometry<Point>|Feature<Point>} coord GeoJSON Point or an Array of numbers
 * @returns {Array<number>} coordinates
 * @example
 * var pt = turf.point([10, 10]);
 *
 * var coord = turf.getCoord(pt);
 * //= [10, 10]
 */
function getCoord(coord) {
  if (!coord) {
    throw new Error("coord is required");
  }

  if (!Array.isArray(coord)) {
    if (coord.type === "Feature" && coord.geometry !== null && coord.geometry.type === "Point") {
      return coord.geometry.coordinates;
    }

    if (coord.type === "Point") {
      return coord.coordinates;
    }
  }

  if (Array.isArray(coord) && coord.length >= 2 && !Array.isArray(coord[0]) && !Array.isArray(coord[1])) {
    return coord;
  }

  throw new Error("coord must be GeoJSON Point or an Array of numbers");
}
/**
 * Unwrap coordinates from a Feature, Geometry Object or an Array
 *
 * @name getCoords
 * @param {Array<any>|Geometry|Feature} coords Feature, Geometry Object or an Array
 * @returns {Array<any>} coordinates
 * @example
 * var poly = turf.polygon([[[119.32, -8.7], [119.55, -8.69], [119.51, -8.54], [119.32, -8.7]]]);
 *
 * var coords = turf.getCoords(poly);
 * //= [[[119.32, -8.7], [119.55, -8.69], [119.51, -8.54], [119.32, -8.7]]]
 */


function getCoords(coords) {
  if (Array.isArray(coords)) {
    return coords;
  } // Feature


  if (coords.type === "Feature") {
    if (coords.geometry !== null) {
      return coords.geometry.coordinates;
    }
  } else {
    // Geometry
    if (coords.coordinates) {
      return coords.coordinates;
    }
  }

  throw new Error("coords must be GeoJSON Feature, Geometry Object or an Array");
}
/**
 * Checks if coordinates contains a number
 *
 * @name containsNumber
 * @param {Array<any>} coordinates GeoJSON Coordinates
 * @returns {boolean} true if Array contains a number
 */


function containsNumber(coordinates) {
  if (coordinates.length > 1 && (0, _helpers.isNumber)(coordinates[0]) && (0, _helpers.isNumber)(coordinates[1])) {
    return true;
  }

  if (Array.isArray(coordinates[0]) && coordinates[0].length) {
    return containsNumber(coordinates[0]);
  }

  throw new Error("coordinates must only contain numbers");
}
/**
 * Enforce expectations about types of GeoJSON objects for Turf.
 *
 * @name geojsonType
 * @param {GeoJSON} value any GeoJSON object
 * @param {string} type expected GeoJSON type
 * @param {string} name name of calling function
 * @throws {Error} if value is not the expected type.
 */


function geojsonType(value, type, name) {
  if (!type || !name) {
    throw new Error("type and name required");
  }

  if (!value || value.type !== type) {
    throw new Error("Invalid input to " + name + ": must be a " + type + ", given " + value.type);
  }
}
/**
 * Enforce expectations about types of {@link Feature} inputs for Turf.
 * Internally this uses {@link geojsonType} to judge geometry types.
 *
 * @name featureOf
 * @param {Feature} feature a feature with an expected geometry type
 * @param {string} type expected GeoJSON type
 * @param {string} name name of calling function
 * @throws {Error} error if value is not the expected type.
 */


function featureOf(feature, type, name) {
  if (!feature) {
    throw new Error("No feature passed");
  }

  if (!name) {
    throw new Error(".featureOf() requires a name");
  }

  if (!feature || feature.type !== "Feature" || !feature.geometry) {
    throw new Error("Invalid input to " + name + ", Feature with geometry required");
  }

  if (!feature.geometry || feature.geometry.type !== type) {
    throw new Error("Invalid input to " + name + ": must be a " + type + ", given " + feature.geometry.type);
  }
}
/**
 * Enforce expectations about types of {@link FeatureCollection} inputs for Turf.
 * Internally this uses {@link geojsonType} to judge geometry types.
 *
 * @name collectionOf
 * @param {FeatureCollection} featureCollection a FeatureCollection for which features will be judged
 * @param {string} type expected GeoJSON type
 * @param {string} name name of calling function
 * @throws {Error} if value is not the expected type.
 */


function collectionOf(featureCollection, type, name) {
  if (!featureCollection) {
    throw new Error("No featureCollection passed");
  }

  if (!name) {
    throw new Error(".collectionOf() requires a name");
  }

  if (!featureCollection || featureCollection.type !== "FeatureCollection") {
    throw new Error("Invalid input to " + name + ", FeatureCollection required");
  }

  for (var _i = 0, _a = featureCollection.features; _i < _a.length; _i++) {
    var feature = _a[_i];

    if (!feature || feature.type !== "Feature" || !feature.geometry) {
      throw new Error("Invalid input to " + name + ", Feature with geometry required");
    }

    if (!feature.geometry || feature.geometry.type !== type) {
      throw new Error("Invalid input to " + name + ": must be a " + type + ", given " + feature.geometry.type);
    }
  }
}
/**
 * Get Geometry from Feature or Geometry Object
 *
 * @param {Feature|Geometry} geojson GeoJSON Feature or Geometry Object
 * @returns {Geometry|null} GeoJSON Geometry Object
 * @throws {Error} if geojson is not a Feature or Geometry Object
 * @example
 * var point = {
 *   "type": "Feature",
 *   "properties": {},
 *   "geometry": {
 *     "type": "Point",
 *     "coordinates": [110, 40]
 *   }
 * }
 * var geom = turf.getGeom(point)
 * //={"type": "Point", "coordinates": [110, 40]}
 */


function getGeom(geojson) {
  if (geojson.type === "Feature") {
    return geojson.geometry;
  }

  return geojson;
}
/**
 * Get GeoJSON object's type, Geometry type is prioritize.
 *
 * @param {GeoJSON} geojson GeoJSON object
 * @param {string} [name="geojson"] name of the variable to display in error message (unused)
 * @returns {string} GeoJSON type
 * @example
 * var point = {
 *   "type": "Feature",
 *   "properties": {},
 *   "geometry": {
 *     "type": "Point",
 *     "coordinates": [110, 40]
 *   }
 * }
 * var geom = turf.getType(point)
 * //="Point"
 */


function getType(geojson, _name) {
  if (geojson.type === "FeatureCollection") {
    return "FeatureCollection";
  }

  if (geojson.type === "GeometryCollection") {
    return "GeometryCollection";
  }

  if (geojson.type === "Feature" && geojson.geometry !== null) {
    return geojson.geometry.type;
  }

  return geojson.type;
}

},{"@turf/helpers":26}],28:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.coordAll = coordAll;
exports.coordEach = coordEach;
exports.coordReduce = coordReduce;
exports.featureEach = featureEach;
exports.featureReduce = featureReduce;
exports.findPoint = findPoint;
exports.findSegment = findSegment;
exports.flattenEach = flattenEach;
exports.flattenReduce = flattenReduce;
exports.geomEach = geomEach;
exports.geomReduce = geomReduce;
exports.lineEach = lineEach;
exports.lineReduce = lineReduce;
exports.propEach = propEach;
exports.propReduce = propReduce;
exports.segmentEach = segmentEach;
exports.segmentReduce = segmentReduce;

var _helpers = require("@turf/helpers");

/**
 * Callback for coordEach
 *
 * @callback coordEachCallback
 * @param {Array<number>} currentCoord The current coordinate being processed.
 * @param {number} coordIndex The current index of the coordinate being processed.
 * @param {number} featureIndex The current index of the Feature being processed.
 * @param {number} multiFeatureIndex The current index of the Multi-Feature being processed.
 * @param {number} geometryIndex The current index of the Geometry being processed.
 */

/**
 * Iterate over coordinates in any GeoJSON object, similar to Array.forEach()
 *
 * @name coordEach
 * @param {FeatureCollection|Feature|Geometry} geojson any GeoJSON object
 * @param {Function} callback a method that takes (currentCoord, coordIndex, featureIndex, multiFeatureIndex)
 * @param {boolean} [excludeWrapCoord=false] whether or not to include the final coordinate of LinearRings that wraps the ring in its iteration.
 * @returns {void}
 * @example
 * var features = turf.featureCollection([
 *   turf.point([26, 37], {"foo": "bar"}),
 *   turf.point([36, 53], {"hello": "world"})
 * ]);
 *
 * turf.coordEach(features, function (currentCoord, coordIndex, featureIndex, multiFeatureIndex, geometryIndex) {
 *   //=currentCoord
 *   //=coordIndex
 *   //=featureIndex
 *   //=multiFeatureIndex
 *   //=geometryIndex
 * });
 */
function coordEach(geojson, callback, excludeWrapCoord) {
  // Handles null Geometry -- Skips this GeoJSON
  if (geojson === null) return;
  var j,
      k,
      l,
      geometry,
      stopG,
      coords,
      geometryMaybeCollection,
      wrapShrink = 0,
      coordIndex = 0,
      isGeometryCollection,
      type = geojson.type,
      isFeatureCollection = type === "FeatureCollection",
      isFeature = type === "Feature",
      stop = isFeatureCollection ? geojson.features.length : 1; // This logic may look a little weird. The reason why it is that way
  // is because it's trying to be fast. GeoJSON supports multiple kinds
  // of objects at its root: FeatureCollection, Features, Geometries.
  // This function has the responsibility of handling all of them, and that
  // means that some of the `for` loops you see below actually just don't apply
  // to certain inputs. For instance, if you give this just a
  // Point geometry, then both loops are short-circuited and all we do
  // is gradually rename the input until it's called 'geometry'.
  //
  // This also aims to allocate as few resources as possible: just a
  // few numbers and booleans, rather than any temporary arrays as would
  // be required with the normalization approach.

  for (var featureIndex = 0; featureIndex < stop; featureIndex++) {
    geometryMaybeCollection = isFeatureCollection ? geojson.features[featureIndex].geometry : isFeature ? geojson.geometry : geojson;
    isGeometryCollection = geometryMaybeCollection ? geometryMaybeCollection.type === "GeometryCollection" : false;
    stopG = isGeometryCollection ? geometryMaybeCollection.geometries.length : 1;

    for (var geomIndex = 0; geomIndex < stopG; geomIndex++) {
      var multiFeatureIndex = 0;
      var geometryIndex = 0;
      geometry = isGeometryCollection ? geometryMaybeCollection.geometries[geomIndex] : geometryMaybeCollection; // Handles null Geometry -- Skips this geometry

      if (geometry === null) continue;
      coords = geometry.coordinates;
      var geomType = geometry.type;
      wrapShrink = excludeWrapCoord && (geomType === "Polygon" || geomType === "MultiPolygon") ? 1 : 0;

      switch (geomType) {
        case null:
          break;

        case "Point":
          if (callback(coords, coordIndex, featureIndex, multiFeatureIndex, geometryIndex) === false) return false;
          coordIndex++;
          multiFeatureIndex++;
          break;

        case "LineString":
        case "MultiPoint":
          for (j = 0; j < coords.length; j++) {
            if (callback(coords[j], coordIndex, featureIndex, multiFeatureIndex, geometryIndex) === false) return false;
            coordIndex++;
            if (geomType === "MultiPoint") multiFeatureIndex++;
          }

          if (geomType === "LineString") multiFeatureIndex++;
          break;

        case "Polygon":
        case "MultiLineString":
          for (j = 0; j < coords.length; j++) {
            for (k = 0; k < coords[j].length - wrapShrink; k++) {
              if (callback(coords[j][k], coordIndex, featureIndex, multiFeatureIndex, geometryIndex) === false) return false;
              coordIndex++;
            }

            if (geomType === "MultiLineString") multiFeatureIndex++;
            if (geomType === "Polygon") geometryIndex++;
          }

          if (geomType === "Polygon") multiFeatureIndex++;
          break;

        case "MultiPolygon":
          for (j = 0; j < coords.length; j++) {
            geometryIndex = 0;

            for (k = 0; k < coords[j].length; k++) {
              for (l = 0; l < coords[j][k].length - wrapShrink; l++) {
                if (callback(coords[j][k][l], coordIndex, featureIndex, multiFeatureIndex, geometryIndex) === false) return false;
                coordIndex++;
              }

              geometryIndex++;
            }

            multiFeatureIndex++;
          }

          break;

        case "GeometryCollection":
          for (j = 0; j < geometry.geometries.length; j++) if (coordEach(geometry.geometries[j], callback, excludeWrapCoord) === false) return false;

          break;

        default:
          throw new Error("Unknown Geometry Type");
      }
    }
  }
}
/**
 * Callback for coordReduce
 *
 * The first time the callback function is called, the values provided as arguments depend
 * on whether the reduce method has an initialValue argument.
 *
 * If an initialValue is provided to the reduce method:
 *  - The previousValue argument is initialValue.
 *  - The currentValue argument is the value of the first element present in the array.
 *
 * If an initialValue is not provided:
 *  - The previousValue argument is the value of the first element present in the array.
 *  - The currentValue argument is the value of the second element present in the array.
 *
 * @callback coordReduceCallback
 * @param {*} previousValue The accumulated value previously returned in the last invocation
 * of the callback, or initialValue, if supplied.
 * @param {Array<number>} currentCoord The current coordinate being processed.
 * @param {number} coordIndex The current index of the coordinate being processed.
 * Starts at index 0, if an initialValue is provided, and at index 1 otherwise.
 * @param {number} featureIndex The current index of the Feature being processed.
 * @param {number} multiFeatureIndex The current index of the Multi-Feature being processed.
 * @param {number} geometryIndex The current index of the Geometry being processed.
 */

/**
 * Reduce coordinates in any GeoJSON object, similar to Array.reduce()
 *
 * @name coordReduce
 * @param {FeatureCollection|Geometry|Feature} geojson any GeoJSON object
 * @param {Function} callback a method that takes (previousValue, currentCoord, coordIndex)
 * @param {*} [initialValue] Value to use as the first argument to the first call of the callback.
 * @param {boolean} [excludeWrapCoord=false] whether or not to include the final coordinate of LinearRings that wraps the ring in its iteration.
 * @returns {*} The value that results from the reduction.
 * @example
 * var features = turf.featureCollection([
 *   turf.point([26, 37], {"foo": "bar"}),
 *   turf.point([36, 53], {"hello": "world"})
 * ]);
 *
 * turf.coordReduce(features, function (previousValue, currentCoord, coordIndex, featureIndex, multiFeatureIndex, geometryIndex) {
 *   //=previousValue
 *   //=currentCoord
 *   //=coordIndex
 *   //=featureIndex
 *   //=multiFeatureIndex
 *   //=geometryIndex
 *   return currentCoord;
 * });
 */


function coordReduce(geojson, callback, initialValue, excludeWrapCoord) {
  var previousValue = initialValue;
  coordEach(geojson, function (currentCoord, coordIndex, featureIndex, multiFeatureIndex, geometryIndex) {
    if (coordIndex === 0 && initialValue === undefined) previousValue = currentCoord;else previousValue = callback(previousValue, currentCoord, coordIndex, featureIndex, multiFeatureIndex, geometryIndex);
  }, excludeWrapCoord);
  return previousValue;
}
/**
 * Callback for propEach
 *
 * @callback propEachCallback
 * @param {Object} currentProperties The current Properties being processed.
 * @param {number} featureIndex The current index of the Feature being processed.
 */

/**
 * Iterate over properties in any GeoJSON object, similar to Array.forEach()
 *
 * @name propEach
 * @param {FeatureCollection|Feature} geojson any GeoJSON object
 * @param {Function} callback a method that takes (currentProperties, featureIndex)
 * @returns {void}
 * @example
 * var features = turf.featureCollection([
 *     turf.point([26, 37], {foo: 'bar'}),
 *     turf.point([36, 53], {hello: 'world'})
 * ]);
 *
 * turf.propEach(features, function (currentProperties, featureIndex) {
 *   //=currentProperties
 *   //=featureIndex
 * });
 */


function propEach(geojson, callback) {
  var i;

  switch (geojson.type) {
    case "FeatureCollection":
      for (i = 0; i < geojson.features.length; i++) {
        if (callback(geojson.features[i].properties, i) === false) break;
      }

      break;

    case "Feature":
      callback(geojson.properties, 0);
      break;
  }
}
/**
 * Callback for propReduce
 *
 * The first time the callback function is called, the values provided as arguments depend
 * on whether the reduce method has an initialValue argument.
 *
 * If an initialValue is provided to the reduce method:
 *  - The previousValue argument is initialValue.
 *  - The currentValue argument is the value of the first element present in the array.
 *
 * If an initialValue is not provided:
 *  - The previousValue argument is the value of the first element present in the array.
 *  - The currentValue argument is the value of the second element present in the array.
 *
 * @callback propReduceCallback
 * @param {*} previousValue The accumulated value previously returned in the last invocation
 * of the callback, or initialValue, if supplied.
 * @param {*} currentProperties The current Properties being processed.
 * @param {number} featureIndex The current index of the Feature being processed.
 */

/**
 * Reduce properties in any GeoJSON object into a single value,
 * similar to how Array.reduce works. However, in this case we lazily run
 * the reduction, so an array of all properties is unnecessary.
 *
 * @name propReduce
 * @param {FeatureCollection|Feature} geojson any GeoJSON object
 * @param {Function} callback a method that takes (previousValue, currentProperties, featureIndex)
 * @param {*} [initialValue] Value to use as the first argument to the first call of the callback.
 * @returns {*} The value that results from the reduction.
 * @example
 * var features = turf.featureCollection([
 *     turf.point([26, 37], {foo: 'bar'}),
 *     turf.point([36, 53], {hello: 'world'})
 * ]);
 *
 * turf.propReduce(features, function (previousValue, currentProperties, featureIndex) {
 *   //=previousValue
 *   //=currentProperties
 *   //=featureIndex
 *   return currentProperties
 * });
 */


function propReduce(geojson, callback, initialValue) {
  var previousValue = initialValue;
  propEach(geojson, function (currentProperties, featureIndex) {
    if (featureIndex === 0 && initialValue === undefined) previousValue = currentProperties;else previousValue = callback(previousValue, currentProperties, featureIndex);
  });
  return previousValue;
}
/**
 * Callback for featureEach
 *
 * @callback featureEachCallback
 * @param {Feature<any>} currentFeature The current Feature being processed.
 * @param {number} featureIndex The current index of the Feature being processed.
 */

/**
 * Iterate over features in any GeoJSON object, similar to
 * Array.forEach.
 *
 * @name featureEach
 * @param {FeatureCollection|Feature|Geometry} geojson any GeoJSON object
 * @param {Function} callback a method that takes (currentFeature, featureIndex)
 * @returns {void}
 * @example
 * var features = turf.featureCollection([
 *   turf.point([26, 37], {foo: 'bar'}),
 *   turf.point([36, 53], {hello: 'world'})
 * ]);
 *
 * turf.featureEach(features, function (currentFeature, featureIndex) {
 *   //=currentFeature
 *   //=featureIndex
 * });
 */


function featureEach(geojson, callback) {
  if (geojson.type === "Feature") {
    callback(geojson, 0);
  } else if (geojson.type === "FeatureCollection") {
    for (var i = 0; i < geojson.features.length; i++) {
      if (callback(geojson.features[i], i) === false) break;
    }
  }
}
/**
 * Callback for featureReduce
 *
 * The first time the callback function is called, the values provided as arguments depend
 * on whether the reduce method has an initialValue argument.
 *
 * If an initialValue is provided to the reduce method:
 *  - The previousValue argument is initialValue.
 *  - The currentValue argument is the value of the first element present in the array.
 *
 * If an initialValue is not provided:
 *  - The previousValue argument is the value of the first element present in the array.
 *  - The currentValue argument is the value of the second element present in the array.
 *
 * @callback featureReduceCallback
 * @param {*} previousValue The accumulated value previously returned in the last invocation
 * of the callback, or initialValue, if supplied.
 * @param {Feature} currentFeature The current Feature being processed.
 * @param {number} featureIndex The current index of the Feature being processed.
 */

/**
 * Reduce features in any GeoJSON object, similar to Array.reduce().
 *
 * @name featureReduce
 * @param {FeatureCollection|Feature|Geometry} geojson any GeoJSON object
 * @param {Function} callback a method that takes (previousValue, currentFeature, featureIndex)
 * @param {*} [initialValue] Value to use as the first argument to the first call of the callback.
 * @returns {*} The value that results from the reduction.
 * @example
 * var features = turf.featureCollection([
 *   turf.point([26, 37], {"foo": "bar"}),
 *   turf.point([36, 53], {"hello": "world"})
 * ]);
 *
 * turf.featureReduce(features, function (previousValue, currentFeature, featureIndex) {
 *   //=previousValue
 *   //=currentFeature
 *   //=featureIndex
 *   return currentFeature
 * });
 */


function featureReduce(geojson, callback, initialValue) {
  var previousValue = initialValue;
  featureEach(geojson, function (currentFeature, featureIndex) {
    if (featureIndex === 0 && initialValue === undefined) previousValue = currentFeature;else previousValue = callback(previousValue, currentFeature, featureIndex);
  });
  return previousValue;
}
/**
 * Get all coordinates from any GeoJSON object.
 *
 * @name coordAll
 * @param {FeatureCollection|Feature|Geometry} geojson any GeoJSON object
 * @returns {Array<Array<number>>} coordinate position array
 * @example
 * var features = turf.featureCollection([
 *   turf.point([26, 37], {foo: 'bar'}),
 *   turf.point([36, 53], {hello: 'world'})
 * ]);
 *
 * var coords = turf.coordAll(features);
 * //= [[26, 37], [36, 53]]
 */


function coordAll(geojson) {
  var coords = [];
  coordEach(geojson, function (coord) {
    coords.push(coord);
  });
  return coords;
}
/**
 * Callback for geomEach
 *
 * @callback geomEachCallback
 * @param {Geometry} currentGeometry The current Geometry being processed.
 * @param {number} featureIndex The current index of the Feature being processed.
 * @param {Object} featureProperties The current Feature Properties being processed.
 * @param {Array<number>} featureBBox The current Feature BBox being processed.
 * @param {number|string} featureId The current Feature Id being processed.
 */

/**
 * Iterate over each geometry in any GeoJSON object, similar to Array.forEach()
 *
 * @name geomEach
 * @param {FeatureCollection|Feature|Geometry} geojson any GeoJSON object
 * @param {Function} callback a method that takes (currentGeometry, featureIndex, featureProperties, featureBBox, featureId)
 * @returns {void}
 * @example
 * var features = turf.featureCollection([
 *     turf.point([26, 37], {foo: 'bar'}),
 *     turf.point([36, 53], {hello: 'world'})
 * ]);
 *
 * turf.geomEach(features, function (currentGeometry, featureIndex, featureProperties, featureBBox, featureId) {
 *   //=currentGeometry
 *   //=featureIndex
 *   //=featureProperties
 *   //=featureBBox
 *   //=featureId
 * });
 */


function geomEach(geojson, callback) {
  var i,
      j,
      g,
      geometry,
      stopG,
      geometryMaybeCollection,
      isGeometryCollection,
      featureProperties,
      featureBBox,
      featureId,
      featureIndex = 0,
      isFeatureCollection = geojson.type === "FeatureCollection",
      isFeature = geojson.type === "Feature",
      stop = isFeatureCollection ? geojson.features.length : 1; // This logic may look a little weird. The reason why it is that way
  // is because it's trying to be fast. GeoJSON supports multiple kinds
  // of objects at its root: FeatureCollection, Features, Geometries.
  // This function has the responsibility of handling all of them, and that
  // means that some of the `for` loops you see below actually just don't apply
  // to certain inputs. For instance, if you give this just a
  // Point geometry, then both loops are short-circuited and all we do
  // is gradually rename the input until it's called 'geometry'.
  //
  // This also aims to allocate as few resources as possible: just a
  // few numbers and booleans, rather than any temporary arrays as would
  // be required with the normalization approach.

  for (i = 0; i < stop; i++) {
    geometryMaybeCollection = isFeatureCollection ? geojson.features[i].geometry : isFeature ? geojson.geometry : geojson;
    featureProperties = isFeatureCollection ? geojson.features[i].properties : isFeature ? geojson.properties : {};
    featureBBox = isFeatureCollection ? geojson.features[i].bbox : isFeature ? geojson.bbox : undefined;
    featureId = isFeatureCollection ? geojson.features[i].id : isFeature ? geojson.id : undefined;
    isGeometryCollection = geometryMaybeCollection ? geometryMaybeCollection.type === "GeometryCollection" : false;
    stopG = isGeometryCollection ? geometryMaybeCollection.geometries.length : 1;

    for (g = 0; g < stopG; g++) {
      geometry = isGeometryCollection ? geometryMaybeCollection.geometries[g] : geometryMaybeCollection; // Handle null Geometry

      if (geometry === null) {
        if (callback(null, featureIndex, featureProperties, featureBBox, featureId) === false) return false;
        continue;
      }

      switch (geometry.type) {
        case "Point":
        case "LineString":
        case "MultiPoint":
        case "Polygon":
        case "MultiLineString":
        case "MultiPolygon":
          {
            if (callback(geometry, featureIndex, featureProperties, featureBBox, featureId) === false) return false;
            break;
          }

        case "GeometryCollection":
          {
            for (j = 0; j < geometry.geometries.length; j++) {
              if (callback(geometry.geometries[j], featureIndex, featureProperties, featureBBox, featureId) === false) return false;
            }

            break;
          }

        default:
          throw new Error("Unknown Geometry Type");
      }
    } // Only increase `featureIndex` per each feature


    featureIndex++;
  }
}
/**
 * Callback for geomReduce
 *
 * The first time the callback function is called, the values provided as arguments depend
 * on whether the reduce method has an initialValue argument.
 *
 * If an initialValue is provided to the reduce method:
 *  - The previousValue argument is initialValue.
 *  - The currentValue argument is the value of the first element present in the array.
 *
 * If an initialValue is not provided:
 *  - The previousValue argument is the value of the first element present in the array.
 *  - The currentValue argument is the value of the second element present in the array.
 *
 * @callback geomReduceCallback
 * @param {*} previousValue The accumulated value previously returned in the last invocation
 * of the callback, or initialValue, if supplied.
 * @param {Geometry} currentGeometry The current Geometry being processed.
 * @param {number} featureIndex The current index of the Feature being processed.
 * @param {Object} featureProperties The current Feature Properties being processed.
 * @param {Array<number>} featureBBox The current Feature BBox being processed.
 * @param {number|string} featureId The current Feature Id being processed.
 */

/**
 * Reduce geometry in any GeoJSON object, similar to Array.reduce().
 *
 * @name geomReduce
 * @param {FeatureCollection|Feature|Geometry} geojson any GeoJSON object
 * @param {Function} callback a method that takes (previousValue, currentGeometry, featureIndex, featureProperties, featureBBox, featureId)
 * @param {*} [initialValue] Value to use as the first argument to the first call of the callback.
 * @returns {*} The value that results from the reduction.
 * @example
 * var features = turf.featureCollection([
 *     turf.point([26, 37], {foo: 'bar'}),
 *     turf.point([36, 53], {hello: 'world'})
 * ]);
 *
 * turf.geomReduce(features, function (previousValue, currentGeometry, featureIndex, featureProperties, featureBBox, featureId) {
 *   //=previousValue
 *   //=currentGeometry
 *   //=featureIndex
 *   //=featureProperties
 *   //=featureBBox
 *   //=featureId
 *   return currentGeometry
 * });
 */


function geomReduce(geojson, callback, initialValue) {
  var previousValue = initialValue;
  geomEach(geojson, function (currentGeometry, featureIndex, featureProperties, featureBBox, featureId) {
    if (featureIndex === 0 && initialValue === undefined) previousValue = currentGeometry;else previousValue = callback(previousValue, currentGeometry, featureIndex, featureProperties, featureBBox, featureId);
  });
  return previousValue;
}
/**
 * Callback for flattenEach
 *
 * @callback flattenEachCallback
 * @param {Feature} currentFeature The current flattened feature being processed.
 * @param {number} featureIndex The current index of the Feature being processed.
 * @param {number} multiFeatureIndex The current index of the Multi-Feature being processed.
 */

/**
 * Iterate over flattened features in any GeoJSON object, similar to
 * Array.forEach.
 *
 * @name flattenEach
 * @param {FeatureCollection|Feature|Geometry} geojson any GeoJSON object
 * @param {Function} callback a method that takes (currentFeature, featureIndex, multiFeatureIndex)
 * @example
 * var features = turf.featureCollection([
 *     turf.point([26, 37], {foo: 'bar'}),
 *     turf.multiPoint([[40, 30], [36, 53]], {hello: 'world'})
 * ]);
 *
 * turf.flattenEach(features, function (currentFeature, featureIndex, multiFeatureIndex) {
 *   //=currentFeature
 *   //=featureIndex
 *   //=multiFeatureIndex
 * });
 */


function flattenEach(geojson, callback) {
  geomEach(geojson, function (geometry, featureIndex, properties, bbox, id) {
    // Callback for single geometry
    var type = geometry === null ? null : geometry.type;

    switch (type) {
      case null:
      case "Point":
      case "LineString":
      case "Polygon":
        if (callback((0, _helpers.feature)(geometry, properties, {
          bbox: bbox,
          id: id
        }), featureIndex, 0) === false) return false;
        return;
    }

    var geomType; // Callback for multi-geometry

    switch (type) {
      case "MultiPoint":
        geomType = "Point";
        break;

      case "MultiLineString":
        geomType = "LineString";
        break;

      case "MultiPolygon":
        geomType = "Polygon";
        break;
    }

    for (var multiFeatureIndex = 0; multiFeatureIndex < geometry.coordinates.length; multiFeatureIndex++) {
      var coordinate = geometry.coordinates[multiFeatureIndex];
      var geom = {
        type: geomType,
        coordinates: coordinate
      };
      if (callback((0, _helpers.feature)(geom, properties), featureIndex, multiFeatureIndex) === false) return false;
    }
  });
}
/**
 * Callback for flattenReduce
 *
 * The first time the callback function is called, the values provided as arguments depend
 * on whether the reduce method has an initialValue argument.
 *
 * If an initialValue is provided to the reduce method:
 *  - The previousValue argument is initialValue.
 *  - The currentValue argument is the value of the first element present in the array.
 *
 * If an initialValue is not provided:
 *  - The previousValue argument is the value of the first element present in the array.
 *  - The currentValue argument is the value of the second element present in the array.
 *
 * @callback flattenReduceCallback
 * @param {*} previousValue The accumulated value previously returned in the last invocation
 * of the callback, or initialValue, if supplied.
 * @param {Feature} currentFeature The current Feature being processed.
 * @param {number} featureIndex The current index of the Feature being processed.
 * @param {number} multiFeatureIndex The current index of the Multi-Feature being processed.
 */

/**
 * Reduce flattened features in any GeoJSON object, similar to Array.reduce().
 *
 * @name flattenReduce
 * @param {FeatureCollection|Feature|Geometry} geojson any GeoJSON object
 * @param {Function} callback a method that takes (previousValue, currentFeature, featureIndex, multiFeatureIndex)
 * @param {*} [initialValue] Value to use as the first argument to the first call of the callback.
 * @returns {*} The value that results from the reduction.
 * @example
 * var features = turf.featureCollection([
 *     turf.point([26, 37], {foo: 'bar'}),
 *     turf.multiPoint([[40, 30], [36, 53]], {hello: 'world'})
 * ]);
 *
 * turf.flattenReduce(features, function (previousValue, currentFeature, featureIndex, multiFeatureIndex) {
 *   //=previousValue
 *   //=currentFeature
 *   //=featureIndex
 *   //=multiFeatureIndex
 *   return currentFeature
 * });
 */


function flattenReduce(geojson, callback, initialValue) {
  var previousValue = initialValue;
  flattenEach(geojson, function (currentFeature, featureIndex, multiFeatureIndex) {
    if (featureIndex === 0 && multiFeatureIndex === 0 && initialValue === undefined) previousValue = currentFeature;else previousValue = callback(previousValue, currentFeature, featureIndex, multiFeatureIndex);
  });
  return previousValue;
}
/**
 * Callback for segmentEach
 *
 * @callback segmentEachCallback
 * @param {Feature<LineString>} currentSegment The current Segment being processed.
 * @param {number} featureIndex The current index of the Feature being processed.
 * @param {number} multiFeatureIndex The current index of the Multi-Feature being processed.
 * @param {number} geometryIndex The current index of the Geometry being processed.
 * @param {number} segmentIndex The current index of the Segment being processed.
 * @returns {void}
 */

/**
 * Iterate over 2-vertex line segment in any GeoJSON object, similar to Array.forEach()
 * (Multi)Point geometries do not contain segments therefore they are ignored during this operation.
 *
 * @param {FeatureCollection|Feature|Geometry} geojson any GeoJSON
 * @param {Function} callback a method that takes (currentSegment, featureIndex, multiFeatureIndex, geometryIndex, segmentIndex)
 * @returns {void}
 * @example
 * var polygon = turf.polygon([[[-50, 5], [-40, -10], [-50, -10], [-40, 5], [-50, 5]]]);
 *
 * // Iterate over GeoJSON by 2-vertex segments
 * turf.segmentEach(polygon, function (currentSegment, featureIndex, multiFeatureIndex, geometryIndex, segmentIndex) {
 *   //=currentSegment
 *   //=featureIndex
 *   //=multiFeatureIndex
 *   //=geometryIndex
 *   //=segmentIndex
 * });
 *
 * // Calculate the total number of segments
 * var total = 0;
 * turf.segmentEach(polygon, function () {
 *     total++;
 * });
 */


function segmentEach(geojson, callback) {
  flattenEach(geojson, function (feature, featureIndex, multiFeatureIndex) {
    var segmentIndex = 0; // Exclude null Geometries

    if (!feature.geometry) return; // (Multi)Point geometries do not contain segments therefore they are ignored during this operation.

    var type = feature.geometry.type;
    if (type === "Point" || type === "MultiPoint") return; // Generate 2-vertex line segments

    var previousCoords;
    var previousFeatureIndex = 0;
    var previousMultiIndex = 0;
    var prevGeomIndex = 0;
    if (coordEach(feature, function (currentCoord, coordIndex, featureIndexCoord, multiPartIndexCoord, geometryIndex) {
      // Simulating a meta.coordReduce() since `reduce` operations cannot be stopped by returning `false`
      if (previousCoords === undefined || featureIndex > previousFeatureIndex || multiPartIndexCoord > previousMultiIndex || geometryIndex > prevGeomIndex) {
        previousCoords = currentCoord;
        previousFeatureIndex = featureIndex;
        previousMultiIndex = multiPartIndexCoord;
        prevGeomIndex = geometryIndex;
        segmentIndex = 0;
        return;
      }

      var currentSegment = (0, _helpers.lineString)([previousCoords, currentCoord], feature.properties);
      if (callback(currentSegment, featureIndex, multiFeatureIndex, geometryIndex, segmentIndex) === false) return false;
      segmentIndex++;
      previousCoords = currentCoord;
    }) === false) return false;
  });
}
/**
 * Callback for segmentReduce
 *
 * The first time the callback function is called, the values provided as arguments depend
 * on whether the reduce method has an initialValue argument.
 *
 * If an initialValue is provided to the reduce method:
 *  - The previousValue argument is initialValue.
 *  - The currentValue argument is the value of the first element present in the array.
 *
 * If an initialValue is not provided:
 *  - The previousValue argument is the value of the first element present in the array.
 *  - The currentValue argument is the value of the second element present in the array.
 *
 * @callback segmentReduceCallback
 * @param {*} previousValue The accumulated value previously returned in the last invocation
 * of the callback, or initialValue, if supplied.
 * @param {Feature<LineString>} currentSegment The current Segment being processed.
 * @param {number} featureIndex The current index of the Feature being processed.
 * @param {number} multiFeatureIndex The current index of the Multi-Feature being processed.
 * @param {number} geometryIndex The current index of the Geometry being processed.
 * @param {number} segmentIndex The current index of the Segment being processed.
 */

/**
 * Reduce 2-vertex line segment in any GeoJSON object, similar to Array.reduce()
 * (Multi)Point geometries do not contain segments therefore they are ignored during this operation.
 *
 * @param {FeatureCollection|Feature|Geometry} geojson any GeoJSON
 * @param {Function} callback a method that takes (previousValue, currentSegment, currentIndex)
 * @param {*} [initialValue] Value to use as the first argument to the first call of the callback.
 * @returns {void}
 * @example
 * var polygon = turf.polygon([[[-50, 5], [-40, -10], [-50, -10], [-40, 5], [-50, 5]]]);
 *
 * // Iterate over GeoJSON by 2-vertex segments
 * turf.segmentReduce(polygon, function (previousSegment, currentSegment, featureIndex, multiFeatureIndex, geometryIndex, segmentIndex) {
 *   //= previousSegment
 *   //= currentSegment
 *   //= featureIndex
 *   //= multiFeatureIndex
 *   //= geometryIndex
 *   //= segmentIndex
 *   return currentSegment
 * });
 *
 * // Calculate the total number of segments
 * var initialValue = 0
 * var total = turf.segmentReduce(polygon, function (previousValue) {
 *     previousValue++;
 *     return previousValue;
 * }, initialValue);
 */


function segmentReduce(geojson, callback, initialValue) {
  var previousValue = initialValue;
  var started = false;
  segmentEach(geojson, function (currentSegment, featureIndex, multiFeatureIndex, geometryIndex, segmentIndex) {
    if (started === false && initialValue === undefined) previousValue = currentSegment;else previousValue = callback(previousValue, currentSegment, featureIndex, multiFeatureIndex, geometryIndex, segmentIndex);
    started = true;
  });
  return previousValue;
}
/**
 * Callback for lineEach
 *
 * @callback lineEachCallback
 * @param {Feature<LineString>} currentLine The current LineString|LinearRing being processed
 * @param {number} featureIndex The current index of the Feature being processed
 * @param {number} multiFeatureIndex The current index of the Multi-Feature being processed
 * @param {number} geometryIndex The current index of the Geometry being processed
 */

/**
 * Iterate over line or ring coordinates in LineString, Polygon, MultiLineString, MultiPolygon Features or Geometries,
 * similar to Array.forEach.
 *
 * @name lineEach
 * @param {Geometry|Feature<LineString|Polygon|MultiLineString|MultiPolygon>} geojson object
 * @param {Function} callback a method that takes (currentLine, featureIndex, multiFeatureIndex, geometryIndex)
 * @example
 * var multiLine = turf.multiLineString([
 *   [[26, 37], [35, 45]],
 *   [[36, 53], [38, 50], [41, 55]]
 * ]);
 *
 * turf.lineEach(multiLine, function (currentLine, featureIndex, multiFeatureIndex, geometryIndex) {
 *   //=currentLine
 *   //=featureIndex
 *   //=multiFeatureIndex
 *   //=geometryIndex
 * });
 */


function lineEach(geojson, callback) {
  // validation
  if (!geojson) throw new Error("geojson is required");
  flattenEach(geojson, function (feature, featureIndex, multiFeatureIndex) {
    if (feature.geometry === null) return;
    var type = feature.geometry.type;
    var coords = feature.geometry.coordinates;

    switch (type) {
      case "LineString":
        if (callback(feature, featureIndex, multiFeatureIndex, 0, 0) === false) return false;
        break;

      case "Polygon":
        for (var geometryIndex = 0; geometryIndex < coords.length; geometryIndex++) {
          if (callback((0, _helpers.lineString)(coords[geometryIndex], feature.properties), featureIndex, multiFeatureIndex, geometryIndex) === false) return false;
        }

        break;
    }
  });
}
/**
 * Callback for lineReduce
 *
 * The first time the callback function is called, the values provided as arguments depend
 * on whether the reduce method has an initialValue argument.
 *
 * If an initialValue is provided to the reduce method:
 *  - The previousValue argument is initialValue.
 *  - The currentValue argument is the value of the first element present in the array.
 *
 * If an initialValue is not provided:
 *  - The previousValue argument is the value of the first element present in the array.
 *  - The currentValue argument is the value of the second element present in the array.
 *
 * @callback lineReduceCallback
 * @param {*} previousValue The accumulated value previously returned in the last invocation
 * of the callback, or initialValue, if supplied.
 * @param {Feature<LineString>} currentLine The current LineString|LinearRing being processed.
 * @param {number} featureIndex The current index of the Feature being processed
 * @param {number} multiFeatureIndex The current index of the Multi-Feature being processed
 * @param {number} geometryIndex The current index of the Geometry being processed
 */

/**
 * Reduce features in any GeoJSON object, similar to Array.reduce().
 *
 * @name lineReduce
 * @param {Geometry|Feature<LineString|Polygon|MultiLineString|MultiPolygon>} geojson object
 * @param {Function} callback a method that takes (previousValue, currentLine, featureIndex, multiFeatureIndex, geometryIndex)
 * @param {*} [initialValue] Value to use as the first argument to the first call of the callback.
 * @returns {*} The value that results from the reduction.
 * @example
 * var multiPoly = turf.multiPolygon([
 *   turf.polygon([[[12,48],[2,41],[24,38],[12,48]], [[9,44],[13,41],[13,45],[9,44]]]),
 *   turf.polygon([[[5, 5], [0, 0], [2, 2], [4, 4], [5, 5]]])
 * ]);
 *
 * turf.lineReduce(multiPoly, function (previousValue, currentLine, featureIndex, multiFeatureIndex, geometryIndex) {
 *   //=previousValue
 *   //=currentLine
 *   //=featureIndex
 *   //=multiFeatureIndex
 *   //=geometryIndex
 *   return currentLine
 * });
 */


function lineReduce(geojson, callback, initialValue) {
  var previousValue = initialValue;
  lineEach(geojson, function (currentLine, featureIndex, multiFeatureIndex, geometryIndex) {
    if (featureIndex === 0 && initialValue === undefined) previousValue = currentLine;else previousValue = callback(previousValue, currentLine, featureIndex, multiFeatureIndex, geometryIndex);
  });
  return previousValue;
}
/**
 * Finds a particular 2-vertex LineString Segment from a GeoJSON using `@turf/meta` indexes.
 *
 * Negative indexes are permitted.
 * Point & MultiPoint will always return null.
 *
 * @param {FeatureCollection|Feature|Geometry} geojson Any GeoJSON Feature or Geometry
 * @param {Object} [options={}] Optional parameters
 * @param {number} [options.featureIndex=0] Feature Index
 * @param {number} [options.multiFeatureIndex=0] Multi-Feature Index
 * @param {number} [options.geometryIndex=0] Geometry Index
 * @param {number} [options.segmentIndex=0] Segment Index
 * @param {Object} [options.properties={}] Translate Properties to output LineString
 * @param {BBox} [options.bbox={}] Translate BBox to output LineString
 * @param {number|string} [options.id={}] Translate Id to output LineString
 * @returns {Feature<LineString>} 2-vertex GeoJSON Feature LineString
 * @example
 * var multiLine = turf.multiLineString([
 *     [[10, 10], [50, 30], [30, 40]],
 *     [[-10, -10], [-50, -30], [-30, -40]]
 * ]);
 *
 * // First Segment (defaults are 0)
 * turf.findSegment(multiLine);
 * // => Feature<LineString<[[10, 10], [50, 30]]>>
 *
 * // First Segment of 2nd Multi Feature
 * turf.findSegment(multiLine, {multiFeatureIndex: 1});
 * // => Feature<LineString<[[-10, -10], [-50, -30]]>>
 *
 * // Last Segment of Last Multi Feature
 * turf.findSegment(multiLine, {multiFeatureIndex: -1, segmentIndex: -1});
 * // => Feature<LineString<[[-50, -30], [-30, -40]]>>
 */


function findSegment(geojson, options) {
  // Optional Parameters
  options = options || {};
  if (!(0, _helpers.isObject)(options)) throw new Error("options is invalid");
  var featureIndex = options.featureIndex || 0;
  var multiFeatureIndex = options.multiFeatureIndex || 0;
  var geometryIndex = options.geometryIndex || 0;
  var segmentIndex = options.segmentIndex || 0; // Find FeatureIndex

  var properties = options.properties;
  var geometry;

  switch (geojson.type) {
    case "FeatureCollection":
      if (featureIndex < 0) featureIndex = geojson.features.length + featureIndex;
      properties = properties || geojson.features[featureIndex].properties;
      geometry = geojson.features[featureIndex].geometry;
      break;

    case "Feature":
      properties = properties || geojson.properties;
      geometry = geojson.geometry;
      break;

    case "Point":
    case "MultiPoint":
      return null;

    case "LineString":
    case "Polygon":
    case "MultiLineString":
    case "MultiPolygon":
      geometry = geojson;
      break;

    default:
      throw new Error("geojson is invalid");
  } // Find SegmentIndex


  if (geometry === null) return null;
  var coords = geometry.coordinates;

  switch (geometry.type) {
    case "Point":
    case "MultiPoint":
      return null;

    case "LineString":
      if (segmentIndex < 0) segmentIndex = coords.length + segmentIndex - 1;
      return (0, _helpers.lineString)([coords[segmentIndex], coords[segmentIndex + 1]], properties, options);

    case "Polygon":
      if (geometryIndex < 0) geometryIndex = coords.length + geometryIndex;
      if (segmentIndex < 0) segmentIndex = coords[geometryIndex].length + segmentIndex - 1;
      return (0, _helpers.lineString)([coords[geometryIndex][segmentIndex], coords[geometryIndex][segmentIndex + 1]], properties, options);

    case "MultiLineString":
      if (multiFeatureIndex < 0) multiFeatureIndex = coords.length + multiFeatureIndex;
      if (segmentIndex < 0) segmentIndex = coords[multiFeatureIndex].length + segmentIndex - 1;
      return (0, _helpers.lineString)([coords[multiFeatureIndex][segmentIndex], coords[multiFeatureIndex][segmentIndex + 1]], properties, options);

    case "MultiPolygon":
      if (multiFeatureIndex < 0) multiFeatureIndex = coords.length + multiFeatureIndex;
      if (geometryIndex < 0) geometryIndex = coords[multiFeatureIndex].length + geometryIndex;
      if (segmentIndex < 0) segmentIndex = coords[multiFeatureIndex][geometryIndex].length - segmentIndex - 1;
      return (0, _helpers.lineString)([coords[multiFeatureIndex][geometryIndex][segmentIndex], coords[multiFeatureIndex][geometryIndex][segmentIndex + 1]], properties, options);
  }

  throw new Error("geojson is invalid");
}
/**
 * Finds a particular Point from a GeoJSON using `@turf/meta` indexes.
 *
 * Negative indexes are permitted.
 *
 * @param {FeatureCollection|Feature|Geometry} geojson Any GeoJSON Feature or Geometry
 * @param {Object} [options={}] Optional parameters
 * @param {number} [options.featureIndex=0] Feature Index
 * @param {number} [options.multiFeatureIndex=0] Multi-Feature Index
 * @param {number} [options.geometryIndex=0] Geometry Index
 * @param {number} [options.coordIndex=0] Coord Index
 * @param {Object} [options.properties={}] Translate Properties to output Point
 * @param {BBox} [options.bbox={}] Translate BBox to output Point
 * @param {number|string} [options.id={}] Translate Id to output Point
 * @returns {Feature<Point>} 2-vertex GeoJSON Feature Point
 * @example
 * var multiLine = turf.multiLineString([
 *     [[10, 10], [50, 30], [30, 40]],
 *     [[-10, -10], [-50, -30], [-30, -40]]
 * ]);
 *
 * // First Segment (defaults are 0)
 * turf.findPoint(multiLine);
 * // => Feature<Point<[10, 10]>>
 *
 * // First Segment of the 2nd Multi-Feature
 * turf.findPoint(multiLine, {multiFeatureIndex: 1});
 * // => Feature<Point<[-10, -10]>>
 *
 * // Last Segment of last Multi-Feature
 * turf.findPoint(multiLine, {multiFeatureIndex: -1, coordIndex: -1});
 * // => Feature<Point<[-30, -40]>>
 */


function findPoint(geojson, options) {
  // Optional Parameters
  options = options || {};
  if (!(0, _helpers.isObject)(options)) throw new Error("options is invalid");
  var featureIndex = options.featureIndex || 0;
  var multiFeatureIndex = options.multiFeatureIndex || 0;
  var geometryIndex = options.geometryIndex || 0;
  var coordIndex = options.coordIndex || 0; // Find FeatureIndex

  var properties = options.properties;
  var geometry;

  switch (geojson.type) {
    case "FeatureCollection":
      if (featureIndex < 0) featureIndex = geojson.features.length + featureIndex;
      properties = properties || geojson.features[featureIndex].properties;
      geometry = geojson.features[featureIndex].geometry;
      break;

    case "Feature":
      properties = properties || geojson.properties;
      geometry = geojson.geometry;
      break;

    case "Point":
    case "MultiPoint":
      return null;

    case "LineString":
    case "Polygon":
    case "MultiLineString":
    case "MultiPolygon":
      geometry = geojson;
      break;

    default:
      throw new Error("geojson is invalid");
  } // Find Coord Index


  if (geometry === null) return null;
  var coords = geometry.coordinates;

  switch (geometry.type) {
    case "Point":
      return (0, _helpers.point)(coords, properties, options);

    case "MultiPoint":
      if (multiFeatureIndex < 0) multiFeatureIndex = coords.length + multiFeatureIndex;
      return (0, _helpers.point)(coords[multiFeatureIndex], properties, options);

    case "LineString":
      if (coordIndex < 0) coordIndex = coords.length + coordIndex;
      return (0, _helpers.point)(coords[coordIndex], properties, options);

    case "Polygon":
      if (geometryIndex < 0) geometryIndex = coords.length + geometryIndex;
      if (coordIndex < 0) coordIndex = coords[geometryIndex].length + coordIndex;
      return (0, _helpers.point)(coords[geometryIndex][coordIndex], properties, options);

    case "MultiLineString":
      if (multiFeatureIndex < 0) multiFeatureIndex = coords.length + multiFeatureIndex;
      if (coordIndex < 0) coordIndex = coords[multiFeatureIndex].length + coordIndex;
      return (0, _helpers.point)(coords[multiFeatureIndex][coordIndex], properties, options);

    case "MultiPolygon":
      if (multiFeatureIndex < 0) multiFeatureIndex = coords.length + multiFeatureIndex;
      if (geometryIndex < 0) geometryIndex = coords[multiFeatureIndex].length + geometryIndex;
      if (coordIndex < 0) coordIndex = coords[multiFeatureIndex][geometryIndex].length - coordIndex;
      return (0, _helpers.point)(coords[multiFeatureIndex][geometryIndex][coordIndex], properties, options);
  }

  throw new Error("geojson is invalid");
}

},{"@turf/helpers":26}],29:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _meta = require("@turf/meta");

/**
 * Takes a GeoJSON Feature or FeatureCollection and truncates the precision of the geometry.
 *
 * @name truncate
 * @param {GeoJSON} geojson any GeoJSON Feature, FeatureCollection, Geometry or GeometryCollection.
 * @param {Object} [options={}] Optional parameters
 * @param {number} [options.precision=6] coordinate decimal precision
 * @param {number} [options.coordinates=3] maximum number of coordinates (primarly used to remove z coordinates)
 * @param {boolean} [options.mutate=false] allows GeoJSON input to be mutated (significant performance increase if true)
 * @returns {GeoJSON} layer with truncated geometry
 * @example
 * var point = turf.point([
 *     70.46923055566859,
 *     58.11088890802906,
 *     1508
 * ]);
 * var options = {precision: 3, coordinates: 2};
 * var truncated = turf.truncate(point, options);
 * //=truncated.geometry.coordinates => [70.469, 58.111]
 *
 * //addToMap
 * var addToMap = [truncated];
 */
function truncate(geojson, options) {
  if (options === void 0) {
    options = {};
  } // Optional parameters


  var precision = options.precision;
  var coordinates = options.coordinates;
  var mutate = options.mutate; // default params

  precision = precision === undefined || precision === null || isNaN(precision) ? 6 : precision;
  coordinates = coordinates === undefined || coordinates === null || isNaN(coordinates) ? 3 : coordinates; // validation

  if (!geojson) throw new Error("<geojson> is required");
  if (typeof precision !== "number") throw new Error("<precision> must be a number");
  if (typeof coordinates !== "number") throw new Error("<coordinates> must be a number"); // prevent input mutation

  if (mutate === false || mutate === undefined) geojson = JSON.parse(JSON.stringify(geojson));
  var factor = Math.pow(10, precision); // Truncate Coordinates

  (0, _meta.coordEach)(geojson, function (coords) {
    truncateCoords(coords, factor, coordinates);
  });
  return geojson;
}
/**
 * Truncate Coordinates - Mutates coordinates in place
 *
 * @private
 * @param {Array<any>} coords Geometry Coordinates
 * @param {number} factor rounding factor for coordinate decimal precision
 * @param {number} coordinates maximum number of coordinates (primarly used to remove z coordinates)
 * @returns {Array<any>} mutated coordinates
 */


function truncateCoords(coords, factor, coordinates) {
  // Remove extra coordinates (usually elevation coordinates and more)
  if (coords.length > coordinates) coords.splice(coordinates, coords.length); // Truncate coordinate decimals

  for (var i = 0; i < coords.length; i++) {
    coords[i] = Math.round(coords[i] * factor) / factor;
  }

  return coords;
}

var _default = truncate;
exports.default = _default;

},{"@turf/meta":28}],30:[function(require,module,exports){
(function (global){(function (){
/*! http://mths.be/base64 v0.1.0 by @mathias | MIT license */
;(function(root) {

	// Detect free variables `exports`.
	var freeExports = typeof exports == 'object' && exports;

	// Detect free variable `module`.
	var freeModule = typeof module == 'object' && module &&
		module.exports == freeExports && module;

	// Detect free variable `global`, from Node.js or Browserified code, and use
	// it as `root`.
	var freeGlobal = typeof global == 'object' && global;
	if (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal) {
		root = freeGlobal;
	}

	/*--------------------------------------------------------------------------*/

	var InvalidCharacterError = function(message) {
		this.message = message;
	};
	InvalidCharacterError.prototype = new Error;
	InvalidCharacterError.prototype.name = 'InvalidCharacterError';

	var error = function(message) {
		// Note: the error messages used throughout this file match those used by
		// the native `atob`/`btoa` implementation in Chromium.
		throw new InvalidCharacterError(message);
	};

	var TABLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
	// http://whatwg.org/html/common-microsyntaxes.html#space-character
	var REGEX_SPACE_CHARACTERS = /[\t\n\f\r ]/g;

	// `decode` is designed to be fully compatible with `atob` as described in the
	// HTML Standard. http://whatwg.org/html/webappapis.html#dom-windowbase64-atob
	// The optimized base64-decoding algorithm used is based on @atk’s excellent
	// implementation. https://gist.github.com/atk/1020396
	var decode = function(input) {
		input = String(input)
			.replace(REGEX_SPACE_CHARACTERS, '');
		var length = input.length;
		if (length % 4 == 0) {
			input = input.replace(/==?$/, '');
			length = input.length;
		}
		if (
			length % 4 == 1 ||
			// http://whatwg.org/C#alphanumeric-ascii-characters
			/[^+a-zA-Z0-9/]/.test(input)
		) {
			error(
				'Invalid character: the string to be decoded is not correctly encoded.'
			);
		}
		var bitCounter = 0;
		var bitStorage;
		var buffer;
		var output = '';
		var position = -1;
		while (++position < length) {
			buffer = TABLE.indexOf(input.charAt(position));
			bitStorage = bitCounter % 4 ? bitStorage * 64 + buffer : buffer;
			// Unless this is the first of a group of 4 characters…
			if (bitCounter++ % 4) {
				// …convert the first 8 bits to a single ASCII character.
				output += String.fromCharCode(
					0xFF & bitStorage >> (-2 * bitCounter & 6)
				);
			}
		}
		return output;
	};

	// `encode` is designed to be fully compatible with `btoa` as described in the
	// HTML Standard: http://whatwg.org/html/webappapis.html#dom-windowbase64-btoa
	var encode = function(input) {
		input = String(input);
		if (/[^\0-\xFF]/.test(input)) {
			// Note: no need to special-case astral symbols here, as surrogates are
			// matched, and the input is supposed to only contain ASCII anyway.
			error(
				'The string to be encoded contains characters outside of the ' +
				'Latin1 range.'
			);
		}
		var padding = input.length % 3;
		var output = '';
		var position = -1;
		var a;
		var b;
		var c;
		var d;
		var buffer;
		// Make sure any padding is handled outside of the loop.
		var length = input.length - padding;

		while (++position < length) {
			// Read three bytes, i.e. 24 bits.
			a = input.charCodeAt(position) << 16;
			b = input.charCodeAt(++position) << 8;
			c = input.charCodeAt(++position);
			buffer = a + b + c;
			// Turn the 24 bits into four chunks of 6 bits each, and append the
			// matching character for each of them to the output.
			output += (
				TABLE.charAt(buffer >> 18 & 0x3F) +
				TABLE.charAt(buffer >> 12 & 0x3F) +
				TABLE.charAt(buffer >> 6 & 0x3F) +
				TABLE.charAt(buffer & 0x3F)
			);
		}

		if (padding == 2) {
			a = input.charCodeAt(position) << 8;
			b = input.charCodeAt(++position);
			buffer = a + b;
			output += (
				TABLE.charAt(buffer >> 10) +
				TABLE.charAt((buffer >> 4) & 0x3F) +
				TABLE.charAt((buffer << 2) & 0x3F) +
				'='
			);
		} else if (padding == 1) {
			buffer = input.charCodeAt(position);
			output += (
				TABLE.charAt(buffer >> 2) +
				TABLE.charAt((buffer << 4) & 0x3F) +
				'=='
			);
		}

		return output;
	};

	var base64 = {
		'encode': encode,
		'decode': decode,
		'version': '0.1.0'
	};

	// Some AMD build optimizers, like r.js, check for specific condition patterns
	// like the following:
	if (
		typeof define == 'function' &&
		typeof define.amd == 'object' &&
		define.amd
	) {
		define(function() {
			return base64;
		});
	}	else if (freeExports && !freeExports.nodeType) {
		if (freeModule) { // in Node.js or RingoJS v0.8.0+
			freeModule.exports = base64;
		} else { // in Narwhal or RingoJS v0.7.0-
			for (var key in base64) {
				base64.hasOwnProperty(key) && (freeExports[key] = base64[key]);
			}
		}
	} else { // in Rhino or a web browser
		root.base64 = base64;
	}

}(this));

}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],31:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

var R = typeof Reflect === 'object' ? Reflect : null
var ReflectApply = R && typeof R.apply === 'function'
  ? R.apply
  : function ReflectApply(target, receiver, args) {
    return Function.prototype.apply.call(target, receiver, args);
  }

var ReflectOwnKeys
if (R && typeof R.ownKeys === 'function') {
  ReflectOwnKeys = R.ownKeys
} else if (Object.getOwnPropertySymbols) {
  ReflectOwnKeys = function ReflectOwnKeys(target) {
    return Object.getOwnPropertyNames(target)
      .concat(Object.getOwnPropertySymbols(target));
  };
} else {
  ReflectOwnKeys = function ReflectOwnKeys(target) {
    return Object.getOwnPropertyNames(target);
  };
}

function ProcessEmitWarning(warning) {
  if (console && console.warn) console.warn(warning);
}

var NumberIsNaN = Number.isNaN || function NumberIsNaN(value) {
  return value !== value;
}

function EventEmitter() {
  EventEmitter.init.call(this);
}
module.exports = EventEmitter;
module.exports.once = once;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._eventsCount = 0;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
var defaultMaxListeners = 10;

function checkListener(listener) {
  if (typeof listener !== 'function') {
    throw new TypeError('The "listener" argument must be of type Function. Received type ' + typeof listener);
  }
}

Object.defineProperty(EventEmitter, 'defaultMaxListeners', {
  enumerable: true,
  get: function() {
    return defaultMaxListeners;
  },
  set: function(arg) {
    if (typeof arg !== 'number' || arg < 0 || NumberIsNaN(arg)) {
      throw new RangeError('The value of "defaultMaxListeners" is out of range. It must be a non-negative number. Received ' + arg + '.');
    }
    defaultMaxListeners = arg;
  }
});

EventEmitter.init = function() {

  if (this._events === undefined ||
      this._events === Object.getPrototypeOf(this)._events) {
    this._events = Object.create(null);
    this._eventsCount = 0;
  }

  this._maxListeners = this._maxListeners || undefined;
};

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== 'number' || n < 0 || NumberIsNaN(n)) {
    throw new RangeError('The value of "n" is out of range. It must be a non-negative number. Received ' + n + '.');
  }
  this._maxListeners = n;
  return this;
};

function _getMaxListeners(that) {
  if (that._maxListeners === undefined)
    return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}

EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return _getMaxListeners(this);
};

EventEmitter.prototype.emit = function emit(type) {
  var args = [];
  for (var i = 1; i < arguments.length; i++) args.push(arguments[i]);
  var doError = (type === 'error');

  var events = this._events;
  if (events !== undefined)
    doError = (doError && events.error === undefined);
  else if (!doError)
    return false;

  // If there is no 'error' event listener then throw.
  if (doError) {
    var er;
    if (args.length > 0)
      er = args[0];
    if (er instanceof Error) {
      // Note: The comments on the `throw` lines are intentional, they show
      // up in Node's output if this results in an unhandled exception.
      throw er; // Unhandled 'error' event
    }
    // At least give some kind of context to the user
    var err = new Error('Unhandled error.' + (er ? ' (' + er.message + ')' : ''));
    err.context = er;
    throw err; // Unhandled 'error' event
  }

  var handler = events[type];

  if (handler === undefined)
    return false;

  if (typeof handler === 'function') {
    ReflectApply(handler, this, args);
  } else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      ReflectApply(listeners[i], this, args);
  }

  return true;
};

function _addListener(target, type, listener, prepend) {
  var m;
  var events;
  var existing;

  checkListener(listener);

  events = target._events;
  if (events === undefined) {
    events = target._events = Object.create(null);
    target._eventsCount = 0;
  } else {
    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (events.newListener !== undefined) {
      target.emit('newListener', type,
                  listener.listener ? listener.listener : listener);

      // Re-assign `events` because a newListener handler could have caused the
      // this._events to be assigned to a new object
      events = target._events;
    }
    existing = events[type];
  }

  if (existing === undefined) {
    // Optimize the case of one listener. Don't need the extra array object.
    existing = events[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === 'function') {
      // Adding the second element, need to change to array.
      existing = events[type] =
        prepend ? [listener, existing] : [existing, listener];
      // If we've already got an array, just append.
    } else if (prepend) {
      existing.unshift(listener);
    } else {
      existing.push(listener);
    }

    // Check for listener leak
    m = _getMaxListeners(target);
    if (m > 0 && existing.length > m && !existing.warned) {
      existing.warned = true;
      // No error code for this since it is a Warning
      // eslint-disable-next-line no-restricted-syntax
      var w = new Error('Possible EventEmitter memory leak detected. ' +
                          existing.length + ' ' + String(type) + ' listeners ' +
                          'added. Use emitter.setMaxListeners() to ' +
                          'increase limit');
      w.name = 'MaxListenersExceededWarning';
      w.emitter = target;
      w.type = type;
      w.count = existing.length;
      ProcessEmitWarning(w);
    }
  }

  return target;
}

EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.prependListener =
    function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };

function onceWrapper() {
  if (!this.fired) {
    this.target.removeListener(this.type, this.wrapFn);
    this.fired = true;
    if (arguments.length === 0)
      return this.listener.call(this.target);
    return this.listener.apply(this.target, arguments);
  }
}

function _onceWrap(target, type, listener) {
  var state = { fired: false, wrapFn: undefined, target: target, type: type, listener: listener };
  var wrapped = onceWrapper.bind(state);
  wrapped.listener = listener;
  state.wrapFn = wrapped;
  return wrapped;
}

EventEmitter.prototype.once = function once(type, listener) {
  checkListener(listener);
  this.on(type, _onceWrap(this, type, listener));
  return this;
};

EventEmitter.prototype.prependOnceListener =
    function prependOnceListener(type, listener) {
      checkListener(listener);
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };

// Emits a 'removeListener' event if and only if the listener was removed.
EventEmitter.prototype.removeListener =
    function removeListener(type, listener) {
      var list, events, position, i, originalListener;

      checkListener(listener);

      events = this._events;
      if (events === undefined)
        return this;

      list = events[type];
      if (list === undefined)
        return this;

      if (list === listener || list.listener === listener) {
        if (--this._eventsCount === 0)
          this._events = Object.create(null);
        else {
          delete events[type];
          if (events.removeListener)
            this.emit('removeListener', type, list.listener || listener);
        }
      } else if (typeof list !== 'function') {
        position = -1;

        for (i = list.length - 1; i >= 0; i--) {
          if (list[i] === listener || list[i].listener === listener) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }

        if (position < 0)
          return this;

        if (position === 0)
          list.shift();
        else {
          spliceOne(list, position);
        }

        if (list.length === 1)
          events[type] = list[0];

        if (events.removeListener !== undefined)
          this.emit('removeListener', type, originalListener || listener);
      }

      return this;
    };

EventEmitter.prototype.off = EventEmitter.prototype.removeListener;

EventEmitter.prototype.removeAllListeners =
    function removeAllListeners(type) {
      var listeners, events, i;

      events = this._events;
      if (events === undefined)
        return this;

      // not listening for removeListener, no need to emit
      if (events.removeListener === undefined) {
        if (arguments.length === 0) {
          this._events = Object.create(null);
          this._eventsCount = 0;
        } else if (events[type] !== undefined) {
          if (--this._eventsCount === 0)
            this._events = Object.create(null);
          else
            delete events[type];
        }
        return this;
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        var keys = Object.keys(events);
        var key;
        for (i = 0; i < keys.length; ++i) {
          key = keys[i];
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = Object.create(null);
        this._eventsCount = 0;
        return this;
      }

      listeners = events[type];

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners);
      } else if (listeners !== undefined) {
        // LIFO order
        for (i = listeners.length - 1; i >= 0; i--) {
          this.removeListener(type, listeners[i]);
        }
      }

      return this;
    };

function _listeners(target, type, unwrap) {
  var events = target._events;

  if (events === undefined)
    return [];

  var evlistener = events[type];
  if (evlistener === undefined)
    return [];

  if (typeof evlistener === 'function')
    return unwrap ? [evlistener.listener || evlistener] : [evlistener];

  return unwrap ?
    unwrapListeners(evlistener) : arrayClone(evlistener, evlistener.length);
}

EventEmitter.prototype.listeners = function listeners(type) {
  return _listeners(this, type, true);
};

EventEmitter.prototype.rawListeners = function rawListeners(type) {
  return _listeners(this, type, false);
};

EventEmitter.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};

EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events = this._events;

  if (events !== undefined) {
    var evlistener = events[type];

    if (typeof evlistener === 'function') {
      return 1;
    } else if (evlistener !== undefined) {
      return evlistener.length;
    }
  }

  return 0;
}

EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? ReflectOwnKeys(this._events) : [];
};

function arrayClone(arr, n) {
  var copy = new Array(n);
  for (var i = 0; i < n; ++i)
    copy[i] = arr[i];
  return copy;
}

function spliceOne(list, index) {
  for (; index + 1 < list.length; index++)
    list[index] = list[index + 1];
  list.pop();
}

function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}

function once(emitter, name) {
  return new Promise(function (resolve, reject) {
    function errorListener(err) {
      emitter.removeListener(name, resolver);
      reject(err);
    }

    function resolver() {
      if (typeof emitter.removeListener === 'function') {
        emitter.removeListener('error', errorListener);
      }
      resolve([].slice.call(arguments));
    };

    eventTargetAgnosticAddListener(emitter, name, resolver, { once: true });
    if (name !== 'error') {
      addErrorHandlerIfEventEmitter(emitter, errorListener, { once: true });
    }
  });
}

function addErrorHandlerIfEventEmitter(emitter, handler, flags) {
  if (typeof emitter.on === 'function') {
    eventTargetAgnosticAddListener(emitter, 'error', handler, flags);
  }
}

function eventTargetAgnosticAddListener(emitter, name, listener, flags) {
  if (typeof emitter.on === 'function') {
    if (flags.once) {
      emitter.once(name, listener);
    } else {
      emitter.on(name, listener);
    }
  } else if (typeof emitter.addEventListener === 'function') {
    // EventTarget does not have `error` event semantics like Node
    // EventEmitters, we do not listen for `error` events here.
    emitter.addEventListener(name, function wrapListener(arg) {
      // IE does not have builtin `{ once: true }` support so we
      // have to do it manually.
      if (flags.once) {
        emitter.removeEventListener(name, wrapListener);
      }
      listener(arg);
    });
  } else {
    throw new TypeError('The "emitter" argument must be of type EventEmitter. Received type ' + typeof emitter);
  }
}

},{}],32:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

function _default(map) {
  var entries = [];

  for (var key in map) entries.push({
    key: key,
    value: map[key]
  });

  return entries;
}

},{}],33:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "nest", {
  enumerable: true,
  get: function () {
    return _nest.default;
  }
});
Object.defineProperty(exports, "set", {
  enumerable: true,
  get: function () {
    return _set.default;
  }
});
Object.defineProperty(exports, "map", {
  enumerable: true,
  get: function () {
    return _map.default;
  }
});
Object.defineProperty(exports, "keys", {
  enumerable: true,
  get: function () {
    return _keys.default;
  }
});
Object.defineProperty(exports, "values", {
  enumerable: true,
  get: function () {
    return _values.default;
  }
});
Object.defineProperty(exports, "entries", {
  enumerable: true,
  get: function () {
    return _entries.default;
  }
});

var _nest = _interopRequireDefault(require("./nest"));

var _set = _interopRequireDefault(require("./set"));

var _map = _interopRequireDefault(require("./map"));

var _keys = _interopRequireDefault(require("./keys"));

var _values = _interopRequireDefault(require("./values"));

var _entries = _interopRequireDefault(require("./entries"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

},{"./entries":32,"./keys":34,"./map":35,"./nest":36,"./set":37,"./values":38}],34:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

function _default(map) {
  var keys = [];

  for (var key in map) keys.push(key);

  return keys;
}

},{}],35:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.prefix = void 0;
var prefix = "$";
exports.prefix = prefix;

function Map() {}

Map.prototype = map.prototype = {
  constructor: Map,
  has: function (key) {
    return prefix + key in this;
  },
  get: function (key) {
    return this[prefix + key];
  },
  set: function (key, value) {
    this[prefix + key] = value;
    return this;
  },
  remove: function (key) {
    var property = prefix + key;
    return property in this && delete this[property];
  },
  clear: function () {
    for (var property in this) if (property[0] === prefix) delete this[property];
  },
  keys: function () {
    var keys = [];

    for (var property in this) if (property[0] === prefix) keys.push(property.slice(1));

    return keys;
  },
  values: function () {
    var values = [];

    for (var property in this) if (property[0] === prefix) values.push(this[property]);

    return values;
  },
  entries: function () {
    var entries = [];

    for (var property in this) if (property[0] === prefix) entries.push({
      key: property.slice(1),
      value: this[property]
    });

    return entries;
  },
  size: function () {
    var size = 0;

    for (var property in this) if (property[0] === prefix) ++size;

    return size;
  },
  empty: function () {
    for (var property in this) if (property[0] === prefix) return false;

    return true;
  },
  each: function (f) {
    for (var property in this) if (property[0] === prefix) f(this[property], property.slice(1), this);
  }
};

function map(object, f) {
  var map = new Map(); // Copy constructor.

  if (object instanceof Map) object.each(function (value, key) {
    map.set(key, value);
  }); // Index array by numeric index or specified key function.
  else if (Array.isArray(object)) {
    var i = -1,
        n = object.length,
        o;
    if (f == null) while (++i < n) map.set(i, object[i]);else while (++i < n) map.set(f(o = object[i], i, object), o);
  } // Convert object to map.
  else if (object) for (var key in object) map.set(key, object[key]);
  return map;
}

var _default = map;
exports.default = _default;

},{}],36:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _map = _interopRequireDefault(require("./map"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _default() {
  var keys = [],
      sortKeys = [],
      sortValues,
      rollup,
      nest;

  function apply(array, depth, createResult, setResult) {
    if (depth >= keys.length) {
      if (sortValues != null) array.sort(sortValues);
      return rollup != null ? rollup(array) : array;
    }

    var i = -1,
        n = array.length,
        key = keys[depth++],
        keyValue,
        value,
        valuesByKey = (0, _map.default)(),
        values,
        result = createResult();

    while (++i < n) {
      if (values = valuesByKey.get(keyValue = key(value = array[i]) + "")) {
        values.push(value);
      } else {
        valuesByKey.set(keyValue, [value]);
      }
    }

    valuesByKey.each(function (values, key) {
      setResult(result, key, apply(values, depth, createResult, setResult));
    });
    return result;
  }

  function entries(map, depth) {
    if (++depth > keys.length) return map;
    var array,
        sortKey = sortKeys[depth - 1];
    if (rollup != null && depth >= keys.length) array = map.entries();else array = [], map.each(function (v, k) {
      array.push({
        key: k,
        values: entries(v, depth)
      });
    });
    return sortKey != null ? array.sort(function (a, b) {
      return sortKey(a.key, b.key);
    }) : array;
  }

  return nest = {
    object: function (array) {
      return apply(array, 0, createObject, setObject);
    },
    map: function (array) {
      return apply(array, 0, createMap, setMap);
    },
    entries: function (array) {
      return entries(apply(array, 0, createMap, setMap), 0);
    },
    key: function (d) {
      keys.push(d);
      return nest;
    },
    sortKeys: function (order) {
      sortKeys[keys.length - 1] = order;
      return nest;
    },
    sortValues: function (order) {
      sortValues = order;
      return nest;
    },
    rollup: function (f) {
      rollup = f;
      return nest;
    }
  };
}

function createObject() {
  return {};
}

function setObject(object, key, value) {
  object[key] = value;
}

function createMap() {
  return (0, _map.default)();
}

function setMap(map, key, value) {
  map.set(key, value);
}

},{"./map":35}],37:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _map = _interopRequireWildcard(require("./map"));

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function Set() {}

var proto = _map.default.prototype;
Set.prototype = set.prototype = {
  constructor: Set,
  has: proto.has,
  add: function (value) {
    value += "";
    this[_map.prefix + value] = value;
    return this;
  },
  remove: proto.remove,
  clear: proto.clear,
  values: proto.keys,
  size: proto.size,
  empty: proto.empty,
  each: proto.each
};

function set(object, f) {
  var set = new Set(); // Copy constructor.

  if (object instanceof Set) object.each(function (value) {
    set.add(value);
  }); // Otherwise, assume it’s an array.
  else if (object) {
    var i = -1,
        n = object.length;
    if (f == null) while (++i < n) set.add(object[i]);else while (++i < n) set.add(f(object[i], i, object));
  }
  return set;
}

var _default = set;
exports.default = _default;

},{"./map":35}],38:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

function _default(map) {
  var values = [];

  for (var key in map) values.push(map[key]);

  return values;
}

},{}],39:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.map = exports.slice = void 0;
var array = Array.prototype;
var slice = array.slice;
exports.slice = slice;
var map = array.map;
exports.map = map;

},{}],40:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

function _default(a, b) {
  return a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
}

},{}],41:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.bisectLeft = exports.bisectRight = void 0;

var _ascending = _interopRequireDefault(require("./ascending"));

var _bisector = _interopRequireDefault(require("./bisector"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var ascendingBisect = (0, _bisector.default)(_ascending.default);
var bisectRight = ascendingBisect.right;
exports.bisectRight = bisectRight;
var bisectLeft = ascendingBisect.left;
exports.bisectLeft = bisectLeft;
var _default = bisectRight;
exports.default = _default;

},{"./ascending":40,"./bisector":42}],42:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _ascending = _interopRequireDefault(require("./ascending"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _default(compare) {
  if (compare.length === 1) compare = ascendingComparator(compare);
  return {
    left: function (a, x, lo, hi) {
      if (lo == null) lo = 0;
      if (hi == null) hi = a.length;

      while (lo < hi) {
        var mid = lo + hi >>> 1;
        if (compare(a[mid], x) < 0) lo = mid + 1;else hi = mid;
      }

      return lo;
    },
    right: function (a, x, lo, hi) {
      if (lo == null) lo = 0;
      if (hi == null) hi = a.length;

      while (lo < hi) {
        var mid = lo + hi >>> 1;
        if (compare(a[mid], x) > 0) hi = mid;else lo = mid + 1;
      }

      return lo;
    }
  };
}

function ascendingComparator(f) {
  return function (d, x) {
    return (0, _ascending.default)(f(d), x);
  };
}

},{"./ascending":40}],43:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

function _default(x) {
  return function () {
    return x;
  };
}

},{}],44:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _pairs = require("./pairs");

function _default(values0, values1, reduce) {
  var n0 = values0.length,
      n1 = values1.length,
      values = new Array(n0 * n1),
      i0,
      i1,
      i,
      value0;
  if (reduce == null) reduce = _pairs.pair;

  for (i0 = i = 0; i0 < n0; ++i0) {
    for (value0 = values0[i0], i1 = 0; i1 < n1; ++i1, ++i) {
      values[i] = reduce(value0, values1[i1]);
    }
  }

  return values;
}

},{"./pairs":57}],45:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

function _default(a, b) {
  return b < a ? -1 : b > a ? 1 : b >= a ? 0 : NaN;
}

},{}],46:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _variance = _interopRequireDefault(require("./variance"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _default(array, f) {
  var v = (0, _variance.default)(array, f);
  return v ? Math.sqrt(v) : v;
}

},{"./variance":69}],47:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

function _default(values, valueof) {
  var n = values.length,
      i = -1,
      value,
      min,
      max;

  if (valueof == null) {
    while (++i < n) {
      // Find the first comparable value.
      if ((value = values[i]) != null && value >= value) {
        min = max = value;

        while (++i < n) {
          // Compare the remaining values.
          if ((value = values[i]) != null) {
            if (min > value) min = value;
            if (max < value) max = value;
          }
        }
      }
    }
  } else {
    while (++i < n) {
      // Find the first comparable value.
      if ((value = valueof(values[i], i, values)) != null && value >= value) {
        min = max = value;

        while (++i < n) {
          // Compare the remaining values.
          if ((value = valueof(values[i], i, values)) != null) {
            if (min > value) min = value;
            if (max < value) max = value;
          }
        }
      }
    }
  }

  return [min, max];
}

},{}],48:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _array = require("./array");

var _bisect = _interopRequireDefault(require("./bisect"));

var _constant = _interopRequireDefault(require("./constant"));

var _extent = _interopRequireDefault(require("./extent"));

var _identity = _interopRequireDefault(require("./identity"));

var _range = _interopRequireDefault(require("./range"));

var _ticks = require("./ticks");

var _sturges = _interopRequireDefault(require("./threshold/sturges"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _default() {
  var value = _identity.default,
      domain = _extent.default,
      threshold = _sturges.default;

  function histogram(data) {
    var i,
        n = data.length,
        x,
        values = new Array(n);

    for (i = 0; i < n; ++i) {
      values[i] = value(data[i], i, data);
    }

    var xz = domain(values),
        x0 = xz[0],
        x1 = xz[1],
        tz = threshold(values, x0, x1); // Convert number of thresholds into uniform thresholds.

    if (!Array.isArray(tz)) {
      tz = (0, _ticks.tickStep)(x0, x1, tz);
      tz = (0, _range.default)(Math.ceil(x0 / tz) * tz, x1, tz); // exclusive
    } // Remove any thresholds outside the domain.


    var m = tz.length;

    while (tz[0] <= x0) tz.shift(), --m;

    while (tz[m - 1] > x1) tz.pop(), --m;

    var bins = new Array(m + 1),
        bin; // Initialize bins.

    for (i = 0; i <= m; ++i) {
      bin = bins[i] = [];
      bin.x0 = i > 0 ? tz[i - 1] : x0;
      bin.x1 = i < m ? tz[i] : x1;
    } // Assign data to bins by value, ignoring any outside the domain.


    for (i = 0; i < n; ++i) {
      x = values[i];

      if (x0 <= x && x <= x1) {
        bins[(0, _bisect.default)(tz, x, 0, m)].push(data[i]);
      }
    }

    return bins;
  }

  histogram.value = function (_) {
    return arguments.length ? (value = typeof _ === "function" ? _ : (0, _constant.default)(_), histogram) : value;
  };

  histogram.domain = function (_) {
    return arguments.length ? (domain = typeof _ === "function" ? _ : (0, _constant.default)([_[0], _[1]]), histogram) : domain;
  };

  histogram.thresholds = function (_) {
    return arguments.length ? (threshold = typeof _ === "function" ? _ : Array.isArray(_) ? (0, _constant.default)(_array.slice.call(_)) : (0, _constant.default)(_), histogram) : threshold;
  };

  return histogram;
}

},{"./array":39,"./bisect":41,"./constant":43,"./extent":47,"./identity":49,"./range":60,"./threshold/sturges":66,"./ticks":67}],49:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

function _default(x) {
  return x;
}

},{}],50:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "bisect", {
  enumerable: true,
  get: function () {
    return _bisect.default;
  }
});
Object.defineProperty(exports, "bisectRight", {
  enumerable: true,
  get: function () {
    return _bisect.bisectRight;
  }
});
Object.defineProperty(exports, "bisectLeft", {
  enumerable: true,
  get: function () {
    return _bisect.bisectLeft;
  }
});
Object.defineProperty(exports, "ascending", {
  enumerable: true,
  get: function () {
    return _ascending.default;
  }
});
Object.defineProperty(exports, "bisector", {
  enumerable: true,
  get: function () {
    return _bisector.default;
  }
});
Object.defineProperty(exports, "cross", {
  enumerable: true,
  get: function () {
    return _cross.default;
  }
});
Object.defineProperty(exports, "descending", {
  enumerable: true,
  get: function () {
    return _descending.default;
  }
});
Object.defineProperty(exports, "deviation", {
  enumerable: true,
  get: function () {
    return _deviation.default;
  }
});
Object.defineProperty(exports, "extent", {
  enumerable: true,
  get: function () {
    return _extent.default;
  }
});
Object.defineProperty(exports, "histogram", {
  enumerable: true,
  get: function () {
    return _histogram.default;
  }
});
Object.defineProperty(exports, "thresholdFreedmanDiaconis", {
  enumerable: true,
  get: function () {
    return _freedmanDiaconis.default;
  }
});
Object.defineProperty(exports, "thresholdScott", {
  enumerable: true,
  get: function () {
    return _scott.default;
  }
});
Object.defineProperty(exports, "thresholdSturges", {
  enumerable: true,
  get: function () {
    return _sturges.default;
  }
});
Object.defineProperty(exports, "max", {
  enumerable: true,
  get: function () {
    return _max.default;
  }
});
Object.defineProperty(exports, "mean", {
  enumerable: true,
  get: function () {
    return _mean.default;
  }
});
Object.defineProperty(exports, "median", {
  enumerable: true,
  get: function () {
    return _median.default;
  }
});
Object.defineProperty(exports, "merge", {
  enumerable: true,
  get: function () {
    return _merge.default;
  }
});
Object.defineProperty(exports, "min", {
  enumerable: true,
  get: function () {
    return _min.default;
  }
});
Object.defineProperty(exports, "pairs", {
  enumerable: true,
  get: function () {
    return _pairs.default;
  }
});
Object.defineProperty(exports, "permute", {
  enumerable: true,
  get: function () {
    return _permute.default;
  }
});
Object.defineProperty(exports, "quantile", {
  enumerable: true,
  get: function () {
    return _quantile.default;
  }
});
Object.defineProperty(exports, "range", {
  enumerable: true,
  get: function () {
    return _range.default;
  }
});
Object.defineProperty(exports, "scan", {
  enumerable: true,
  get: function () {
    return _scan.default;
  }
});
Object.defineProperty(exports, "shuffle", {
  enumerable: true,
  get: function () {
    return _shuffle.default;
  }
});
Object.defineProperty(exports, "sum", {
  enumerable: true,
  get: function () {
    return _sum.default;
  }
});
Object.defineProperty(exports, "ticks", {
  enumerable: true,
  get: function () {
    return _ticks.default;
  }
});
Object.defineProperty(exports, "tickIncrement", {
  enumerable: true,
  get: function () {
    return _ticks.tickIncrement;
  }
});
Object.defineProperty(exports, "tickStep", {
  enumerable: true,
  get: function () {
    return _ticks.tickStep;
  }
});
Object.defineProperty(exports, "transpose", {
  enumerable: true,
  get: function () {
    return _transpose.default;
  }
});
Object.defineProperty(exports, "variance", {
  enumerable: true,
  get: function () {
    return _variance.default;
  }
});
Object.defineProperty(exports, "zip", {
  enumerable: true,
  get: function () {
    return _zip.default;
  }
});

var _bisect = _interopRequireWildcard(require("./bisect"));

var _ascending = _interopRequireDefault(require("./ascending"));

var _bisector = _interopRequireDefault(require("./bisector"));

var _cross = _interopRequireDefault(require("./cross"));

var _descending = _interopRequireDefault(require("./descending"));

var _deviation = _interopRequireDefault(require("./deviation"));

var _extent = _interopRequireDefault(require("./extent"));

var _histogram = _interopRequireDefault(require("./histogram"));

var _freedmanDiaconis = _interopRequireDefault(require("./threshold/freedmanDiaconis"));

var _scott = _interopRequireDefault(require("./threshold/scott"));

var _sturges = _interopRequireDefault(require("./threshold/sturges"));

var _max = _interopRequireDefault(require("./max"));

var _mean = _interopRequireDefault(require("./mean"));

var _median = _interopRequireDefault(require("./median"));

var _merge = _interopRequireDefault(require("./merge"));

var _min = _interopRequireDefault(require("./min"));

var _pairs = _interopRequireDefault(require("./pairs"));

var _permute = _interopRequireDefault(require("./permute"));

var _quantile = _interopRequireDefault(require("./quantile"));

var _range = _interopRequireDefault(require("./range"));

var _scan = _interopRequireDefault(require("./scan"));

var _shuffle = _interopRequireDefault(require("./shuffle"));

var _sum = _interopRequireDefault(require("./sum"));

var _ticks = _interopRequireWildcard(require("./ticks"));

var _transpose = _interopRequireDefault(require("./transpose"));

var _variance = _interopRequireDefault(require("./variance"));

var _zip = _interopRequireDefault(require("./zip"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

},{"./ascending":40,"./bisect":41,"./bisector":42,"./cross":44,"./descending":45,"./deviation":46,"./extent":47,"./histogram":48,"./max":51,"./mean":52,"./median":53,"./merge":54,"./min":55,"./pairs":57,"./permute":58,"./quantile":59,"./range":60,"./scan":61,"./shuffle":62,"./sum":63,"./threshold/freedmanDiaconis":64,"./threshold/scott":65,"./threshold/sturges":66,"./ticks":67,"./transpose":68,"./variance":69,"./zip":70}],51:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

function _default(values, valueof) {
  var n = values.length,
      i = -1,
      value,
      max;

  if (valueof == null) {
    while (++i < n) {
      // Find the first comparable value.
      if ((value = values[i]) != null && value >= value) {
        max = value;

        while (++i < n) {
          // Compare the remaining values.
          if ((value = values[i]) != null && value > max) {
            max = value;
          }
        }
      }
    }
  } else {
    while (++i < n) {
      // Find the first comparable value.
      if ((value = valueof(values[i], i, values)) != null && value >= value) {
        max = value;

        while (++i < n) {
          // Compare the remaining values.
          if ((value = valueof(values[i], i, values)) != null && value > max) {
            max = value;
          }
        }
      }
    }
  }

  return max;
}

},{}],52:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _number = _interopRequireDefault(require("./number"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _default(values, valueof) {
  var n = values.length,
      m = n,
      i = -1,
      value,
      sum = 0;

  if (valueof == null) {
    while (++i < n) {
      if (!isNaN(value = (0, _number.default)(values[i]))) sum += value;else --m;
    }
  } else {
    while (++i < n) {
      if (!isNaN(value = (0, _number.default)(valueof(values[i], i, values)))) sum += value;else --m;
    }
  }

  if (m) return sum / m;
}

},{"./number":56}],53:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _ascending = _interopRequireDefault(require("./ascending"));

var _number = _interopRequireDefault(require("./number"));

var _quantile = _interopRequireDefault(require("./quantile"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _default(values, valueof) {
  var n = values.length,
      i = -1,
      value,
      numbers = [];

  if (valueof == null) {
    while (++i < n) {
      if (!isNaN(value = (0, _number.default)(values[i]))) {
        numbers.push(value);
      }
    }
  } else {
    while (++i < n) {
      if (!isNaN(value = (0, _number.default)(valueof(values[i], i, values)))) {
        numbers.push(value);
      }
    }
  }

  return (0, _quantile.default)(numbers.sort(_ascending.default), 0.5);
}

},{"./ascending":40,"./number":56,"./quantile":59}],54:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

function _default(arrays) {
  var n = arrays.length,
      m,
      i = -1,
      j = 0,
      merged,
      array;

  while (++i < n) j += arrays[i].length;

  merged = new Array(j);

  while (--n >= 0) {
    array = arrays[n];
    m = array.length;

    while (--m >= 0) {
      merged[--j] = array[m];
    }
  }

  return merged;
}

},{}],55:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

function _default(values, valueof) {
  var n = values.length,
      i = -1,
      value,
      min;

  if (valueof == null) {
    while (++i < n) {
      // Find the first comparable value.
      if ((value = values[i]) != null && value >= value) {
        min = value;

        while (++i < n) {
          // Compare the remaining values.
          if ((value = values[i]) != null && min > value) {
            min = value;
          }
        }
      }
    }
  } else {
    while (++i < n) {
      // Find the first comparable value.
      if ((value = valueof(values[i], i, values)) != null && value >= value) {
        min = value;

        while (++i < n) {
          // Compare the remaining values.
          if ((value = valueof(values[i], i, values)) != null && min > value) {
            min = value;
          }
        }
      }
    }
  }

  return min;
}

},{}],56:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

function _default(x) {
  return x === null ? NaN : +x;
}

},{}],57:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;
exports.pair = pair;

function _default(array, f) {
  if (f == null) f = pair;
  var i = 0,
      n = array.length - 1,
      p = array[0],
      pairs = new Array(n < 0 ? 0 : n);

  while (i < n) pairs[i] = f(p, p = array[++i]);

  return pairs;
}

function pair(a, b) {
  return [a, b];
}

},{}],58:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

function _default(array, indexes) {
  var i = indexes.length,
      permutes = new Array(i);

  while (i--) permutes[i] = array[indexes[i]];

  return permutes;
}

},{}],59:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _number = _interopRequireDefault(require("./number"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _default(values, p, valueof) {
  if (valueof == null) valueof = _number.default;
  if (!(n = values.length)) return;
  if ((p = +p) <= 0 || n < 2) return +valueof(values[0], 0, values);
  if (p >= 1) return +valueof(values[n - 1], n - 1, values);
  var n,
      i = (n - 1) * p,
      i0 = Math.floor(i),
      value0 = +valueof(values[i0], i0, values),
      value1 = +valueof(values[i0 + 1], i0 + 1, values);
  return value0 + (value1 - value0) * (i - i0);
}

},{"./number":56}],60:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

function _default(start, stop, step) {
  start = +start, stop = +stop, step = (n = arguments.length) < 2 ? (stop = start, start = 0, 1) : n < 3 ? 1 : +step;
  var i = -1,
      n = Math.max(0, Math.ceil((stop - start) / step)) | 0,
      range = new Array(n);

  while (++i < n) {
    range[i] = start + i * step;
  }

  return range;
}

},{}],61:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _ascending = _interopRequireDefault(require("./ascending"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _default(values, compare) {
  if (!(n = values.length)) return;
  var n,
      i = 0,
      j = 0,
      xi,
      xj = values[j];
  if (compare == null) compare = _ascending.default;

  while (++i < n) {
    if (compare(xi = values[i], xj) < 0 || compare(xj, xj) !== 0) {
      xj = xi, j = i;
    }
  }

  if (compare(xj, xj) === 0) return j;
}

},{"./ascending":40}],62:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

function _default(array, i0, i1) {
  var m = (i1 == null ? array.length : i1) - (i0 = i0 == null ? 0 : +i0),
      t,
      i;

  while (m) {
    i = Math.random() * m-- | 0;
    t = array[m + i0];
    array[m + i0] = array[i + i0];
    array[i + i0] = t;
  }

  return array;
}

},{}],63:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

function _default(values, valueof) {
  var n = values.length,
      i = -1,
      value,
      sum = 0;

  if (valueof == null) {
    while (++i < n) {
      if (value = +values[i]) sum += value; // Note: zero and null are equivalent.
    }
  } else {
    while (++i < n) {
      if (value = +valueof(values[i], i, values)) sum += value;
    }
  }

  return sum;
}

},{}],64:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _array = require("../array");

var _ascending = _interopRequireDefault(require("../ascending"));

var _number = _interopRequireDefault(require("../number"));

var _quantile = _interopRequireDefault(require("../quantile"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _default(values, min, max) {
  values = _array.map.call(values, _number.default).sort(_ascending.default);
  return Math.ceil((max - min) / (2 * ((0, _quantile.default)(values, 0.75) - (0, _quantile.default)(values, 0.25)) * Math.pow(values.length, -1 / 3)));
}

},{"../array":39,"../ascending":40,"../number":56,"../quantile":59}],65:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _deviation = _interopRequireDefault(require("../deviation"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _default(values, min, max) {
  return Math.ceil((max - min) / (3.5 * (0, _deviation.default)(values) * Math.pow(values.length, -1 / 3)));
}

},{"../deviation":46}],66:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

function _default(values) {
  return Math.ceil(Math.log(values.length) / Math.LN2) + 1;
}

},{}],67:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;
exports.tickIncrement = tickIncrement;
exports.tickStep = tickStep;
var e10 = Math.sqrt(50),
    e5 = Math.sqrt(10),
    e2 = Math.sqrt(2);

function _default(start, stop, count) {
  var reverse,
      i = -1,
      n,
      ticks,
      step;
  stop = +stop, start = +start, count = +count;
  if (start === stop && count > 0) return [start];
  if (reverse = stop < start) n = start, start = stop, stop = n;
  if ((step = tickIncrement(start, stop, count)) === 0 || !isFinite(step)) return [];

  if (step > 0) {
    start = Math.ceil(start / step);
    stop = Math.floor(stop / step);
    ticks = new Array(n = Math.ceil(stop - start + 1));

    while (++i < n) ticks[i] = (start + i) * step;
  } else {
    start = Math.floor(start * step);
    stop = Math.ceil(stop * step);
    ticks = new Array(n = Math.ceil(start - stop + 1));

    while (++i < n) ticks[i] = (start - i) / step;
  }

  if (reverse) ticks.reverse();
  return ticks;
}

function tickIncrement(start, stop, count) {
  var step = (stop - start) / Math.max(0, count),
      power = Math.floor(Math.log(step) / Math.LN10),
      error = step / Math.pow(10, power);
  return power >= 0 ? (error >= e10 ? 10 : error >= e5 ? 5 : error >= e2 ? 2 : 1) * Math.pow(10, power) : -Math.pow(10, -power) / (error >= e10 ? 10 : error >= e5 ? 5 : error >= e2 ? 2 : 1);
}

function tickStep(start, stop, count) {
  var step0 = Math.abs(stop - start) / Math.max(0, count),
      step1 = Math.pow(10, Math.floor(Math.log(step0) / Math.LN10)),
      error = step0 / step1;
  if (error >= e10) step1 *= 10;else if (error >= e5) step1 *= 5;else if (error >= e2) step1 *= 2;
  return stop < start ? -step1 : step1;
}

},{}],68:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _min = _interopRequireDefault(require("./min"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _default(matrix) {
  if (!(n = matrix.length)) return [];

  for (var i = -1, m = (0, _min.default)(matrix, length), transpose = new Array(m); ++i < m;) {
    for (var j = -1, n, row = transpose[i] = new Array(n); ++j < n;) {
      row[j] = matrix[j][i];
    }
  }

  return transpose;
}

function length(d) {
  return d.length;
}

},{"./min":55}],69:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _number = _interopRequireDefault(require("./number"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _default(values, valueof) {
  var n = values.length,
      m = 0,
      i = -1,
      mean = 0,
      value,
      delta,
      sum = 0;

  if (valueof == null) {
    while (++i < n) {
      if (!isNaN(value = (0, _number.default)(values[i]))) {
        delta = value - mean;
        mean += delta / ++m;
        sum += delta * (value - mean);
      }
    }
  } else {
    while (++i < n) {
      if (!isNaN(value = (0, _number.default)(valueof(values[i], i, values)))) {
        delta = value - mean;
        mean += delta / ++m;
        sum += delta * (value - mean);
      }
    }
  }

  if (m > 1) return sum / (m - 1);
}

},{"./number":56}],70:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _transpose = _interopRequireDefault(require("./transpose"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _default() {
  return (0, _transpose.default)(arguments);
}

},{"./transpose":68}],71:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Color = Color;
exports.default = color;
exports.rgbConvert = rgbConvert;
exports.rgb = rgb;
exports.Rgb = Rgb;
exports.hslConvert = hslConvert;
exports.hsl = hsl;
exports.brighter = exports.darker = void 0;

var _define = _interopRequireWildcard(require("./define.js"));

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function Color() {}

var darker = 0.7;
exports.darker = darker;
var brighter = 1 / darker;
exports.brighter = brighter;
var reI = "\\s*([+-]?\\d+)\\s*",
    reN = "\\s*([+-]?\\d*\\.?\\d+(?:[eE][+-]?\\d+)?)\\s*",
    reP = "\\s*([+-]?\\d*\\.?\\d+(?:[eE][+-]?\\d+)?)%\\s*",
    reHex = /^#([0-9a-f]{3,8})$/,
    reRgbInteger = new RegExp("^rgb\\(" + [reI, reI, reI] + "\\)$"),
    reRgbPercent = new RegExp("^rgb\\(" + [reP, reP, reP] + "\\)$"),
    reRgbaInteger = new RegExp("^rgba\\(" + [reI, reI, reI, reN] + "\\)$"),
    reRgbaPercent = new RegExp("^rgba\\(" + [reP, reP, reP, reN] + "\\)$"),
    reHslPercent = new RegExp("^hsl\\(" + [reN, reP, reP] + "\\)$"),
    reHslaPercent = new RegExp("^hsla\\(" + [reN, reP, reP, reN] + "\\)$");
var named = {
  aliceblue: 0xf0f8ff,
  antiquewhite: 0xfaebd7,
  aqua: 0x00ffff,
  aquamarine: 0x7fffd4,
  azure: 0xf0ffff,
  beige: 0xf5f5dc,
  bisque: 0xffe4c4,
  black: 0x000000,
  blanchedalmond: 0xffebcd,
  blue: 0x0000ff,
  blueviolet: 0x8a2be2,
  brown: 0xa52a2a,
  burlywood: 0xdeb887,
  cadetblue: 0x5f9ea0,
  chartreuse: 0x7fff00,
  chocolate: 0xd2691e,
  coral: 0xff7f50,
  cornflowerblue: 0x6495ed,
  cornsilk: 0xfff8dc,
  crimson: 0xdc143c,
  cyan: 0x00ffff,
  darkblue: 0x00008b,
  darkcyan: 0x008b8b,
  darkgoldenrod: 0xb8860b,
  darkgray: 0xa9a9a9,
  darkgreen: 0x006400,
  darkgrey: 0xa9a9a9,
  darkkhaki: 0xbdb76b,
  darkmagenta: 0x8b008b,
  darkolivegreen: 0x556b2f,
  darkorange: 0xff8c00,
  darkorchid: 0x9932cc,
  darkred: 0x8b0000,
  darksalmon: 0xe9967a,
  darkseagreen: 0x8fbc8f,
  darkslateblue: 0x483d8b,
  darkslategray: 0x2f4f4f,
  darkslategrey: 0x2f4f4f,
  darkturquoise: 0x00ced1,
  darkviolet: 0x9400d3,
  deeppink: 0xff1493,
  deepskyblue: 0x00bfff,
  dimgray: 0x696969,
  dimgrey: 0x696969,
  dodgerblue: 0x1e90ff,
  firebrick: 0xb22222,
  floralwhite: 0xfffaf0,
  forestgreen: 0x228b22,
  fuchsia: 0xff00ff,
  gainsboro: 0xdcdcdc,
  ghostwhite: 0xf8f8ff,
  gold: 0xffd700,
  goldenrod: 0xdaa520,
  gray: 0x808080,
  green: 0x008000,
  greenyellow: 0xadff2f,
  grey: 0x808080,
  honeydew: 0xf0fff0,
  hotpink: 0xff69b4,
  indianred: 0xcd5c5c,
  indigo: 0x4b0082,
  ivory: 0xfffff0,
  khaki: 0xf0e68c,
  lavender: 0xe6e6fa,
  lavenderblush: 0xfff0f5,
  lawngreen: 0x7cfc00,
  lemonchiffon: 0xfffacd,
  lightblue: 0xadd8e6,
  lightcoral: 0xf08080,
  lightcyan: 0xe0ffff,
  lightgoldenrodyellow: 0xfafad2,
  lightgray: 0xd3d3d3,
  lightgreen: 0x90ee90,
  lightgrey: 0xd3d3d3,
  lightpink: 0xffb6c1,
  lightsalmon: 0xffa07a,
  lightseagreen: 0x20b2aa,
  lightskyblue: 0x87cefa,
  lightslategray: 0x778899,
  lightslategrey: 0x778899,
  lightsteelblue: 0xb0c4de,
  lightyellow: 0xffffe0,
  lime: 0x00ff00,
  limegreen: 0x32cd32,
  linen: 0xfaf0e6,
  magenta: 0xff00ff,
  maroon: 0x800000,
  mediumaquamarine: 0x66cdaa,
  mediumblue: 0x0000cd,
  mediumorchid: 0xba55d3,
  mediumpurple: 0x9370db,
  mediumseagreen: 0x3cb371,
  mediumslateblue: 0x7b68ee,
  mediumspringgreen: 0x00fa9a,
  mediumturquoise: 0x48d1cc,
  mediumvioletred: 0xc71585,
  midnightblue: 0x191970,
  mintcream: 0xf5fffa,
  mistyrose: 0xffe4e1,
  moccasin: 0xffe4b5,
  navajowhite: 0xffdead,
  navy: 0x000080,
  oldlace: 0xfdf5e6,
  olive: 0x808000,
  olivedrab: 0x6b8e23,
  orange: 0xffa500,
  orangered: 0xff4500,
  orchid: 0xda70d6,
  palegoldenrod: 0xeee8aa,
  palegreen: 0x98fb98,
  paleturquoise: 0xafeeee,
  palevioletred: 0xdb7093,
  papayawhip: 0xffefd5,
  peachpuff: 0xffdab9,
  peru: 0xcd853f,
  pink: 0xffc0cb,
  plum: 0xdda0dd,
  powderblue: 0xb0e0e6,
  purple: 0x800080,
  rebeccapurple: 0x663399,
  red: 0xff0000,
  rosybrown: 0xbc8f8f,
  royalblue: 0x4169e1,
  saddlebrown: 0x8b4513,
  salmon: 0xfa8072,
  sandybrown: 0xf4a460,
  seagreen: 0x2e8b57,
  seashell: 0xfff5ee,
  sienna: 0xa0522d,
  silver: 0xc0c0c0,
  skyblue: 0x87ceeb,
  slateblue: 0x6a5acd,
  slategray: 0x708090,
  slategrey: 0x708090,
  snow: 0xfffafa,
  springgreen: 0x00ff7f,
  steelblue: 0x4682b4,
  tan: 0xd2b48c,
  teal: 0x008080,
  thistle: 0xd8bfd8,
  tomato: 0xff6347,
  turquoise: 0x40e0d0,
  violet: 0xee82ee,
  wheat: 0xf5deb3,
  white: 0xffffff,
  whitesmoke: 0xf5f5f5,
  yellow: 0xffff00,
  yellowgreen: 0x9acd32
};
(0, _define.default)(Color, color, {
  copy: function (channels) {
    return Object.assign(new this.constructor(), this, channels);
  },
  displayable: function () {
    return this.rgb().displayable();
  },
  hex: color_formatHex,
  // Deprecated! Use color.formatHex.
  formatHex: color_formatHex,
  formatHsl: color_formatHsl,
  formatRgb: color_formatRgb,
  toString: color_formatRgb
});

function color_formatHex() {
  return this.rgb().formatHex();
}

function color_formatHsl() {
  return hslConvert(this).formatHsl();
}

function color_formatRgb() {
  return this.rgb().formatRgb();
}

function color(format) {
  var m, l;
  format = (format + "").trim().toLowerCase();
  return (m = reHex.exec(format)) ? (l = m[1].length, m = parseInt(m[1], 16), l === 6 ? rgbn(m) // #ff0000
  : l === 3 ? new Rgb(m >> 8 & 0xf | m >> 4 & 0xf0, m >> 4 & 0xf | m & 0xf0, (m & 0xf) << 4 | m & 0xf, 1) // #f00
  : l === 8 ? rgba(m >> 24 & 0xff, m >> 16 & 0xff, m >> 8 & 0xff, (m & 0xff) / 0xff) // #ff000000
  : l === 4 ? rgba(m >> 12 & 0xf | m >> 8 & 0xf0, m >> 8 & 0xf | m >> 4 & 0xf0, m >> 4 & 0xf | m & 0xf0, ((m & 0xf) << 4 | m & 0xf) / 0xff) // #f000
  : null // invalid hex
  ) : (m = reRgbInteger.exec(format)) ? new Rgb(m[1], m[2], m[3], 1) // rgb(255, 0, 0)
  : (m = reRgbPercent.exec(format)) ? new Rgb(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, 1) // rgb(100%, 0%, 0%)
  : (m = reRgbaInteger.exec(format)) ? rgba(m[1], m[2], m[3], m[4]) // rgba(255, 0, 0, 1)
  : (m = reRgbaPercent.exec(format)) ? rgba(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, m[4]) // rgb(100%, 0%, 0%, 1)
  : (m = reHslPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, 1) // hsl(120, 50%, 50%)
  : (m = reHslaPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, m[4]) // hsla(120, 50%, 50%, 1)
  : named.hasOwnProperty(format) ? rgbn(named[format]) // eslint-disable-line no-prototype-builtins
  : format === "transparent" ? new Rgb(NaN, NaN, NaN, 0) : null;
}

function rgbn(n) {
  return new Rgb(n >> 16 & 0xff, n >> 8 & 0xff, n & 0xff, 1);
}

function rgba(r, g, b, a) {
  if (a <= 0) r = g = b = NaN;
  return new Rgb(r, g, b, a);
}

function rgbConvert(o) {
  if (!(o instanceof Color)) o = color(o);
  if (!o) return new Rgb();
  o = o.rgb();
  return new Rgb(o.r, o.g, o.b, o.opacity);
}

function rgb(r, g, b, opacity) {
  return arguments.length === 1 ? rgbConvert(r) : new Rgb(r, g, b, opacity == null ? 1 : opacity);
}

function Rgb(r, g, b, opacity) {
  this.r = +r;
  this.g = +g;
  this.b = +b;
  this.opacity = +opacity;
}

(0, _define.default)(Rgb, rgb, (0, _define.extend)(Color, {
  brighter: function (k) {
    k = k == null ? brighter : Math.pow(brighter, k);
    return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
  },
  darker: function (k) {
    k = k == null ? darker : Math.pow(darker, k);
    return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
  },
  rgb: function () {
    return this;
  },
  displayable: function () {
    return -0.5 <= this.r && this.r < 255.5 && -0.5 <= this.g && this.g < 255.5 && -0.5 <= this.b && this.b < 255.5 && 0 <= this.opacity && this.opacity <= 1;
  },
  hex: rgb_formatHex,
  // Deprecated! Use color.formatHex.
  formatHex: rgb_formatHex,
  formatRgb: rgb_formatRgb,
  toString: rgb_formatRgb
}));

function rgb_formatHex() {
  return "#" + hex(this.r) + hex(this.g) + hex(this.b);
}

function rgb_formatRgb() {
  var a = this.opacity;
  a = isNaN(a) ? 1 : Math.max(0, Math.min(1, a));
  return (a === 1 ? "rgb(" : "rgba(") + Math.max(0, Math.min(255, Math.round(this.r) || 0)) + ", " + Math.max(0, Math.min(255, Math.round(this.g) || 0)) + ", " + Math.max(0, Math.min(255, Math.round(this.b) || 0)) + (a === 1 ? ")" : ", " + a + ")");
}

function hex(value) {
  value = Math.max(0, Math.min(255, Math.round(value) || 0));
  return (value < 16 ? "0" : "") + value.toString(16);
}

function hsla(h, s, l, a) {
  if (a <= 0) h = s = l = NaN;else if (l <= 0 || l >= 1) h = s = NaN;else if (s <= 0) h = NaN;
  return new Hsl(h, s, l, a);
}

function hslConvert(o) {
  if (o instanceof Hsl) return new Hsl(o.h, o.s, o.l, o.opacity);
  if (!(o instanceof Color)) o = color(o);
  if (!o) return new Hsl();
  if (o instanceof Hsl) return o;
  o = o.rgb();
  var r = o.r / 255,
      g = o.g / 255,
      b = o.b / 255,
      min = Math.min(r, g, b),
      max = Math.max(r, g, b),
      h = NaN,
      s = max - min,
      l = (max + min) / 2;

  if (s) {
    if (r === max) h = (g - b) / s + (g < b) * 6;else if (g === max) h = (b - r) / s + 2;else h = (r - g) / s + 4;
    s /= l < 0.5 ? max + min : 2 - max - min;
    h *= 60;
  } else {
    s = l > 0 && l < 1 ? 0 : h;
  }

  return new Hsl(h, s, l, o.opacity);
}

function hsl(h, s, l, opacity) {
  return arguments.length === 1 ? hslConvert(h) : new Hsl(h, s, l, opacity == null ? 1 : opacity);
}

function Hsl(h, s, l, opacity) {
  this.h = +h;
  this.s = +s;
  this.l = +l;
  this.opacity = +opacity;
}

(0, _define.default)(Hsl, hsl, (0, _define.extend)(Color, {
  brighter: function (k) {
    k = k == null ? brighter : Math.pow(brighter, k);
    return new Hsl(this.h, this.s, this.l * k, this.opacity);
  },
  darker: function (k) {
    k = k == null ? darker : Math.pow(darker, k);
    return new Hsl(this.h, this.s, this.l * k, this.opacity);
  },
  rgb: function () {
    var h = this.h % 360 + (this.h < 0) * 360,
        s = isNaN(h) || isNaN(this.s) ? 0 : this.s,
        l = this.l,
        m2 = l + (l < 0.5 ? l : 1 - l) * s,
        m1 = 2 * l - m2;
    return new Rgb(hsl2rgb(h >= 240 ? h - 240 : h + 120, m1, m2), hsl2rgb(h, m1, m2), hsl2rgb(h < 120 ? h + 240 : h - 120, m1, m2), this.opacity);
  },
  displayable: function () {
    return (0 <= this.s && this.s <= 1 || isNaN(this.s)) && 0 <= this.l && this.l <= 1 && 0 <= this.opacity && this.opacity <= 1;
  },
  formatHsl: function () {
    var a = this.opacity;
    a = isNaN(a) ? 1 : Math.max(0, Math.min(1, a));
    return (a === 1 ? "hsl(" : "hsla(") + (this.h || 0) + ", " + (this.s || 0) * 100 + "%, " + (this.l || 0) * 100 + "%" + (a === 1 ? ")" : ", " + a + ")");
  }
}));
/* From FvD 13.37, CSS Color Module Level 3 */

function hsl2rgb(h, m1, m2) {
  return (h < 60 ? m1 + (m2 - m1) * h / 60 : h < 180 ? m2 : h < 240 ? m1 + (m2 - m1) * (240 - h) / 60 : m1) * 255;
}

},{"./define.js":73}],72:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = cubehelix;
exports.Cubehelix = Cubehelix;

var _define = _interopRequireWildcard(require("./define.js"));

var _color = require("./color.js");

var _math = require("./math.js");

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

var A = -0.14861,
    B = +1.78277,
    C = -0.29227,
    D = -0.90649,
    E = +1.97294,
    ED = E * D,
    EB = E * B,
    BC_DA = B * C - D * A;

function cubehelixConvert(o) {
  if (o instanceof Cubehelix) return new Cubehelix(o.h, o.s, o.l, o.opacity);
  if (!(o instanceof _color.Rgb)) o = (0, _color.rgbConvert)(o);
  var r = o.r / 255,
      g = o.g / 255,
      b = o.b / 255,
      l = (BC_DA * b + ED * r - EB * g) / (BC_DA + ED - EB),
      bl = b - l,
      k = (E * (g - l) - C * bl) / D,
      s = Math.sqrt(k * k + bl * bl) / (E * l * (1 - l)),
      // NaN if l=0 or l=1
  h = s ? Math.atan2(k, bl) * _math.rad2deg - 120 : NaN;
  return new Cubehelix(h < 0 ? h + 360 : h, s, l, o.opacity);
}

function cubehelix(h, s, l, opacity) {
  return arguments.length === 1 ? cubehelixConvert(h) : new Cubehelix(h, s, l, opacity == null ? 1 : opacity);
}

function Cubehelix(h, s, l, opacity) {
  this.h = +h;
  this.s = +s;
  this.l = +l;
  this.opacity = +opacity;
}

(0, _define.default)(Cubehelix, cubehelix, (0, _define.extend)(_color.Color, {
  brighter: function (k) {
    k = k == null ? _color.brighter : Math.pow(_color.brighter, k);
    return new Cubehelix(this.h, this.s, this.l * k, this.opacity);
  },
  darker: function (k) {
    k = k == null ? _color.darker : Math.pow(_color.darker, k);
    return new Cubehelix(this.h, this.s, this.l * k, this.opacity);
  },
  rgb: function () {
    var h = isNaN(this.h) ? 0 : (this.h + 120) * _math.deg2rad,
        l = +this.l,
        a = isNaN(this.s) ? 0 : this.s * l * (1 - l),
        cosh = Math.cos(h),
        sinh = Math.sin(h);
    return new _color.Rgb(255 * (l + a * (A * cosh + B * sinh)), 255 * (l + a * (C * cosh + D * sinh)), 255 * (l + a * (E * cosh)), this.opacity);
  }
}));

},{"./color.js":71,"./define.js":73,"./math.js":76}],73:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;
exports.extend = extend;

function _default(constructor, factory, prototype) {
  constructor.prototype = factory.prototype = prototype;
  prototype.constructor = constructor;
}

function extend(parent, definition) {
  var prototype = Object.create(parent.prototype);

  for (var key in definition) prototype[key] = definition[key];

  return prototype;
}

},{}],74:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "color", {
  enumerable: true,
  get: function () {
    return _color.default;
  }
});
Object.defineProperty(exports, "rgb", {
  enumerable: true,
  get: function () {
    return _color.rgb;
  }
});
Object.defineProperty(exports, "hsl", {
  enumerable: true,
  get: function () {
    return _color.hsl;
  }
});
Object.defineProperty(exports, "lab", {
  enumerable: true,
  get: function () {
    return _lab.default;
  }
});
Object.defineProperty(exports, "hcl", {
  enumerable: true,
  get: function () {
    return _lab.hcl;
  }
});
Object.defineProperty(exports, "lch", {
  enumerable: true,
  get: function () {
    return _lab.lch;
  }
});
Object.defineProperty(exports, "gray", {
  enumerable: true,
  get: function () {
    return _lab.gray;
  }
});
Object.defineProperty(exports, "cubehelix", {
  enumerable: true,
  get: function () {
    return _cubehelix.default;
  }
});

var _color = _interopRequireWildcard(require("./color.js"));

var _lab = _interopRequireWildcard(require("./lab.js"));

var _cubehelix = _interopRequireDefault(require("./cubehelix.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

},{"./color.js":71,"./cubehelix.js":72,"./lab.js":75}],75:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.gray = gray;
exports.default = lab;
exports.Lab = Lab;
exports.lch = lch;
exports.hcl = hcl;
exports.Hcl = Hcl;

var _define = _interopRequireWildcard(require("./define.js"));

var _color = require("./color.js");

var _math = require("./math.js");

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

// https://observablehq.com/@mbostock/lab-and-rgb
var K = 18,
    Xn = 0.96422,
    Yn = 1,
    Zn = 0.82521,
    t0 = 4 / 29,
    t1 = 6 / 29,
    t2 = 3 * t1 * t1,
    t3 = t1 * t1 * t1;

function labConvert(o) {
  if (o instanceof Lab) return new Lab(o.l, o.a, o.b, o.opacity);
  if (o instanceof Hcl) return hcl2lab(o);
  if (!(o instanceof _color.Rgb)) o = (0, _color.rgbConvert)(o);
  var r = rgb2lrgb(o.r),
      g = rgb2lrgb(o.g),
      b = rgb2lrgb(o.b),
      y = xyz2lab((0.2225045 * r + 0.7168786 * g + 0.0606169 * b) / Yn),
      x,
      z;
  if (r === g && g === b) x = z = y;else {
    x = xyz2lab((0.4360747 * r + 0.3850649 * g + 0.1430804 * b) / Xn);
    z = xyz2lab((0.0139322 * r + 0.0971045 * g + 0.7141733 * b) / Zn);
  }
  return new Lab(116 * y - 16, 500 * (x - y), 200 * (y - z), o.opacity);
}

function gray(l, opacity) {
  return new Lab(l, 0, 0, opacity == null ? 1 : opacity);
}

function lab(l, a, b, opacity) {
  return arguments.length === 1 ? labConvert(l) : new Lab(l, a, b, opacity == null ? 1 : opacity);
}

function Lab(l, a, b, opacity) {
  this.l = +l;
  this.a = +a;
  this.b = +b;
  this.opacity = +opacity;
}

(0, _define.default)(Lab, lab, (0, _define.extend)(_color.Color, {
  brighter: function (k) {
    return new Lab(this.l + K * (k == null ? 1 : k), this.a, this.b, this.opacity);
  },
  darker: function (k) {
    return new Lab(this.l - K * (k == null ? 1 : k), this.a, this.b, this.opacity);
  },
  rgb: function () {
    var y = (this.l + 16) / 116,
        x = isNaN(this.a) ? y : y + this.a / 500,
        z = isNaN(this.b) ? y : y - this.b / 200;
    x = Xn * lab2xyz(x);
    y = Yn * lab2xyz(y);
    z = Zn * lab2xyz(z);
    return new _color.Rgb(lrgb2rgb(3.1338561 * x - 1.6168667 * y - 0.4906146 * z), lrgb2rgb(-0.9787684 * x + 1.9161415 * y + 0.0334540 * z), lrgb2rgb(0.0719453 * x - 0.2289914 * y + 1.4052427 * z), this.opacity);
  }
}));

function xyz2lab(t) {
  return t > t3 ? Math.pow(t, 1 / 3) : t / t2 + t0;
}

function lab2xyz(t) {
  return t > t1 ? t * t * t : t2 * (t - t0);
}

function lrgb2rgb(x) {
  return 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
}

function rgb2lrgb(x) {
  return (x /= 255) <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

function hclConvert(o) {
  if (o instanceof Hcl) return new Hcl(o.h, o.c, o.l, o.opacity);
  if (!(o instanceof Lab)) o = labConvert(o);
  if (o.a === 0 && o.b === 0) return new Hcl(NaN, 0 < o.l && o.l < 100 ? 0 : NaN, o.l, o.opacity);

  var h = Math.atan2(o.b, o.a) * _math.rad2deg;

  return new Hcl(h < 0 ? h + 360 : h, Math.sqrt(o.a * o.a + o.b * o.b), o.l, o.opacity);
}

function lch(l, c, h, opacity) {
  return arguments.length === 1 ? hclConvert(l) : new Hcl(h, c, l, opacity == null ? 1 : opacity);
}

function hcl(h, c, l, opacity) {
  return arguments.length === 1 ? hclConvert(h) : new Hcl(h, c, l, opacity == null ? 1 : opacity);
}

function Hcl(h, c, l, opacity) {
  this.h = +h;
  this.c = +c;
  this.l = +l;
  this.opacity = +opacity;
}

function hcl2lab(o) {
  if (isNaN(o.h)) return new Lab(o.l, 0, 0, o.opacity);
  var h = o.h * _math.deg2rad;
  return new Lab(o.l, Math.cos(h) * o.c, Math.sin(h) * o.c, o.opacity);
}

(0, _define.default)(Hcl, hcl, (0, _define.extend)(_color.Color, {
  brighter: function (k) {
    return new Hcl(this.h, this.c, this.l + K * (k == null ? 1 : k), this.opacity);
  },
  darker: function (k) {
    return new Hcl(this.h, this.c, this.l - K * (k == null ? 1 : k), this.opacity);
  },
  rgb: function () {
    return hcl2lab(this).rgb();
  }
}));

},{"./color.js":71,"./define.js":73,"./math.js":76}],76:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.rad2deg = exports.deg2rad = void 0;
var deg2rad = Math.PI / 180;
exports.deg2rad = deg2rad;
var rad2deg = 180 / Math.PI;
exports.rad2deg = rad2deg;

},{}],77:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _delaunator = _interopRequireDefault(require("delaunator"));

var _path = _interopRequireDefault(require("./path.js"));

var _polygon = _interopRequireDefault(require("./polygon.js"));

var _voronoi = _interopRequireDefault(require("./voronoi.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const tau = 2 * Math.PI,
      pow = Math.pow;

function pointX(p) {
  return p[0];
}

function pointY(p) {
  return p[1];
} // A triangulation is collinear if all its triangles have a non-null area


function collinear(d) {
  const {
    triangles,
    coords
  } = d;

  for (let i = 0; i < triangles.length; i += 3) {
    const a = 2 * triangles[i],
          b = 2 * triangles[i + 1],
          c = 2 * triangles[i + 2],
          cross = (coords[c] - coords[a]) * (coords[b + 1] - coords[a + 1]) - (coords[b] - coords[a]) * (coords[c + 1] - coords[a + 1]);
    if (cross > 1e-10) return false;
  }

  return true;
}

function jitter(x, y, r) {
  return [x + Math.sin(x + y) * r, y + Math.cos(x - y) * r];
}

class Delaunay {
  static from(points, fx = pointX, fy = pointY, that) {
    return new Delaunay("length" in points ? flatArray(points, fx, fy, that) : Float64Array.from(flatIterable(points, fx, fy, that)));
  }

  constructor(points) {
    this._delaunator = new _delaunator.default(points);
    this.inedges = new Int32Array(points.length / 2);
    this._hullIndex = new Int32Array(points.length / 2);
    this.points = this._delaunator.coords;

    this._init();
  }

  update() {
    this._delaunator.update();

    this._init();

    return this;
  }

  _init() {
    const d = this._delaunator,
          points = this.points; // check for collinear

    if (d.hull && d.hull.length > 2 && collinear(d)) {
      this.collinear = Int32Array.from({
        length: points.length / 2
      }, (_, i) => i).sort((i, j) => points[2 * i] - points[2 * j] || points[2 * i + 1] - points[2 * j + 1]); // for exact neighbors

      const e = this.collinear[0],
            f = this.collinear[this.collinear.length - 1],
            bounds = [points[2 * e], points[2 * e + 1], points[2 * f], points[2 * f + 1]],
            r = 1e-8 * Math.hypot(bounds[3] - bounds[1], bounds[2] - bounds[0]);

      for (let i = 0, n = points.length / 2; i < n; ++i) {
        const p = jitter(points[2 * i], points[2 * i + 1], r);
        points[2 * i] = p[0];
        points[2 * i + 1] = p[1];
      }

      this._delaunator = new _delaunator.default(points);
    } else {
      delete this.collinear;
    }

    const halfedges = this.halfedges = this._delaunator.halfedges;
    const hull = this.hull = this._delaunator.hull;
    const triangles = this.triangles = this._delaunator.triangles;
    const inedges = this.inedges.fill(-1);

    const hullIndex = this._hullIndex.fill(-1); // Compute an index from each point to an (arbitrary) incoming halfedge
    // Used to give the first neighbor of each point; for this reason,
    // on the hull we give priority to exterior halfedges


    for (let e = 0, n = halfedges.length; e < n; ++e) {
      const p = triangles[e % 3 === 2 ? e - 2 : e + 1];
      if (halfedges[e] === -1 || inedges[p] === -1) inedges[p] = e;
    }

    for (let i = 0, n = hull.length; i < n; ++i) {
      hullIndex[hull[i]] = i;
    } // degenerate case: 1 or 2 (distinct) points


    if (hull.length <= 2 && hull.length > 0) {
      this.triangles = new Int32Array(3).fill(-1);
      this.halfedges = new Int32Array(3).fill(-1);
      this.triangles[0] = hull[0];
      this.triangles[1] = hull[1];
      this.triangles[2] = hull[1];
      inedges[hull[0]] = 1;
      if (hull.length === 2) inedges[hull[1]] = 0;
    }
  }

  voronoi(bounds) {
    return new _voronoi.default(this, bounds);
  }

  *neighbors(i) {
    const {
      inedges,
      hull,
      _hullIndex,
      halfedges,
      triangles,
      collinear
    } = this; // degenerate case with several collinear points

    if (collinear) {
      const l = collinear.indexOf(i);
      if (l > 0) yield collinear[l - 1];
      if (l < collinear.length - 1) yield collinear[l + 1];
      return;
    }

    const e0 = inedges[i];
    if (e0 === -1) return; // coincident point

    let e = e0,
        p0 = -1;

    do {
      yield p0 = triangles[e];
      e = e % 3 === 2 ? e - 2 : e + 1;
      if (triangles[e] !== i) return; // bad triangulation

      e = halfedges[e];

      if (e === -1) {
        const p = hull[(_hullIndex[i] + 1) % hull.length];
        if (p !== p0) yield p;
        return;
      }
    } while (e !== e0);
  }

  find(x, y, i = 0) {
    if ((x = +x, x !== x) || (y = +y, y !== y)) return -1;
    const i0 = i;
    let c;

    while ((c = this._step(i, x, y)) >= 0 && c !== i && c !== i0) i = c;

    return c;
  }

  _step(i, x, y) {
    const {
      inedges,
      hull,
      _hullIndex,
      halfedges,
      triangles,
      points
    } = this;
    if (inedges[i] === -1 || !points.length) return (i + 1) % (points.length >> 1);
    let c = i;
    let dc = pow(x - points[i * 2], 2) + pow(y - points[i * 2 + 1], 2);
    const e0 = inedges[i];
    let e = e0;

    do {
      let t = triangles[e];
      const dt = pow(x - points[t * 2], 2) + pow(y - points[t * 2 + 1], 2);
      if (dt < dc) dc = dt, c = t;
      e = e % 3 === 2 ? e - 2 : e + 1;
      if (triangles[e] !== i) break; // bad triangulation

      e = halfedges[e];

      if (e === -1) {
        e = hull[(_hullIndex[i] + 1) % hull.length];

        if (e !== t) {
          if (pow(x - points[e * 2], 2) + pow(y - points[e * 2 + 1], 2) < dc) return e;
        }

        break;
      }
    } while (e !== e0);

    return c;
  }

  render(context) {
    const buffer = context == null ? context = new _path.default() : undefined;
    const {
      points,
      halfedges,
      triangles
    } = this;

    for (let i = 0, n = halfedges.length; i < n; ++i) {
      const j = halfedges[i];
      if (j < i) continue;
      const ti = triangles[i] * 2;
      const tj = triangles[j] * 2;
      context.moveTo(points[ti], points[ti + 1]);
      context.lineTo(points[tj], points[tj + 1]);
    }

    this.renderHull(context);
    return buffer && buffer.value();
  }

  renderPoints(context, r = 2) {
    const buffer = context == null ? context = new _path.default() : undefined;
    const {
      points
    } = this;

    for (let i = 0, n = points.length; i < n; i += 2) {
      const x = points[i],
            y = points[i + 1];
      context.moveTo(x + r, y);
      context.arc(x, y, r, 0, tau);
    }

    return buffer && buffer.value();
  }

  renderHull(context) {
    const buffer = context == null ? context = new _path.default() : undefined;
    const {
      hull,
      points
    } = this;
    const h = hull[0] * 2,
          n = hull.length;
    context.moveTo(points[h], points[h + 1]);

    for (let i = 1; i < n; ++i) {
      const h = 2 * hull[i];
      context.lineTo(points[h], points[h + 1]);
    }

    context.closePath();
    return buffer && buffer.value();
  }

  hullPolygon() {
    const polygon = new _polygon.default();
    this.renderHull(polygon);
    return polygon.value();
  }

  renderTriangle(i, context) {
    const buffer = context == null ? context = new _path.default() : undefined;
    const {
      points,
      triangles
    } = this;
    const t0 = triangles[i *= 3] * 2;
    const t1 = triangles[i + 1] * 2;
    const t2 = triangles[i + 2] * 2;
    context.moveTo(points[t0], points[t0 + 1]);
    context.lineTo(points[t1], points[t1 + 1]);
    context.lineTo(points[t2], points[t2 + 1]);
    context.closePath();
    return buffer && buffer.value();
  }

  *trianglePolygons() {
    const {
      triangles
    } = this;

    for (let i = 0, n = triangles.length / 3; i < n; ++i) {
      yield this.trianglePolygon(i);
    }
  }

  trianglePolygon(i) {
    const polygon = new _polygon.default();
    this.renderTriangle(i, polygon);
    return polygon.value();
  }

}

exports.default = Delaunay;

function flatArray(points, fx, fy, that) {
  const n = points.length;
  const array = new Float64Array(n * 2);

  for (let i = 0; i < n; ++i) {
    const p = points[i];
    array[i * 2] = fx.call(that, p, i, points);
    array[i * 2 + 1] = fy.call(that, p, i, points);
  }

  return array;
}

function* flatIterable(points, fx, fy, that) {
  let i = 0;

  for (const p of points) {
    yield fx.call(that, p, i, points);
    yield fy.call(that, p, i, points);
    ++i;
  }
}

},{"./path.js":79,"./polygon.js":80,"./voronoi.js":81,"delaunator":173}],78:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "Delaunay", {
  enumerable: true,
  get: function () {
    return _delaunay.default;
  }
});
Object.defineProperty(exports, "Voronoi", {
  enumerable: true,
  get: function () {
    return _voronoi.default;
  }
});

var _delaunay = _interopRequireDefault(require("./delaunay.js"));

var _voronoi = _interopRequireDefault(require("./voronoi.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

},{"./delaunay.js":77,"./voronoi.js":81}],79:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
const epsilon = 1e-6;

class Path {
  constructor() {
    this._x0 = this._y0 = // start of current subpath
    this._x1 = this._y1 = null; // end of current subpath

    this._ = "";
  }

  moveTo(x, y) {
    this._ += `M${this._x0 = this._x1 = +x},${this._y0 = this._y1 = +y}`;
  }

  closePath() {
    if (this._x1 !== null) {
      this._x1 = this._x0, this._y1 = this._y0;
      this._ += "Z";
    }
  }

  lineTo(x, y) {
    this._ += `L${this._x1 = +x},${this._y1 = +y}`;
  }

  arc(x, y, r) {
    x = +x, y = +y, r = +r;
    const x0 = x + r;
    const y0 = y;
    if (r < 0) throw new Error("negative radius");
    if (this._x1 === null) this._ += `M${x0},${y0}`;else if (Math.abs(this._x1 - x0) > epsilon || Math.abs(this._y1 - y0) > epsilon) this._ += "L" + x0 + "," + y0;
    if (!r) return;
    this._ += `A${r},${r},0,1,1,${x - r},${y}A${r},${r},0,1,1,${this._x1 = x0},${this._y1 = y0}`;
  }

  rect(x, y, w, h) {
    this._ += `M${this._x0 = this._x1 = +x},${this._y0 = this._y1 = +y}h${+w}v${+h}h${-w}Z`;
  }

  value() {
    return this._ || null;
  }

}

exports.default = Path;

},{}],80:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

class Polygon {
  constructor() {
    this._ = [];
  }

  moveTo(x, y) {
    this._.push([x, y]);
  }

  closePath() {
    this._.push(this._[0].slice());
  }

  lineTo(x, y) {
    this._.push([x, y]);
  }

  value() {
    return this._.length ? this._ : null;
  }

}

exports.default = Polygon;

},{}],81:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _path = _interopRequireDefault(require("./path.js"));

var _polygon = _interopRequireDefault(require("./polygon.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class Voronoi {
  constructor(delaunay, [xmin, ymin, xmax, ymax] = [0, 0, 960, 500]) {
    if (!((xmax = +xmax) >= (xmin = +xmin)) || !((ymax = +ymax) >= (ymin = +ymin))) throw new Error("invalid bounds");
    this.delaunay = delaunay;
    this._circumcenters = new Float64Array(delaunay.points.length * 2);
    this.vectors = new Float64Array(delaunay.points.length * 2);
    this.xmax = xmax, this.xmin = xmin;
    this.ymax = ymax, this.ymin = ymin;

    this._init();
  }

  update() {
    this.delaunay.update();

    this._init();

    return this;
  }

  _init() {
    const {
      delaunay: {
        points,
        hull,
        triangles
      },
      vectors
    } = this; // Compute circumcenters.

    const circumcenters = this.circumcenters = this._circumcenters.subarray(0, triangles.length / 3 * 2);

    for (let i = 0, j = 0, n = triangles.length, x, y; i < n; i += 3, j += 2) {
      const t1 = triangles[i] * 2;
      const t2 = triangles[i + 1] * 2;
      const t3 = triangles[i + 2] * 2;
      const x1 = points[t1];
      const y1 = points[t1 + 1];
      const x2 = points[t2];
      const y2 = points[t2 + 1];
      const x3 = points[t3];
      const y3 = points[t3 + 1];
      const dx = x2 - x1;
      const dy = y2 - y1;
      const ex = x3 - x1;
      const ey = y3 - y1;
      const bl = dx * dx + dy * dy;
      const cl = ex * ex + ey * ey;
      const ab = (dx * ey - dy * ex) * 2;

      if (!ab) {
        // degenerate case (collinear diagram)
        x = (x1 + x3) / 2 - 1e8 * ey;
        y = (y1 + y3) / 2 + 1e8 * ex;
      } else if (Math.abs(ab) < 1e-8) {
        // almost equal points (degenerate triangle)
        x = (x1 + x3) / 2;
        y = (y1 + y3) / 2;
      } else {
        const d = 1 / ab;
        x = x1 + (ey * bl - dy * cl) * d;
        y = y1 + (dx * cl - ex * bl) * d;
      }

      circumcenters[j] = x;
      circumcenters[j + 1] = y;
    } // Compute exterior cell rays.


    let h = hull[hull.length - 1];
    let p0,
        p1 = h * 4;
    let x0,
        x1 = points[2 * h];
    let y0,
        y1 = points[2 * h + 1];
    vectors.fill(0);

    for (let i = 0; i < hull.length; ++i) {
      h = hull[i];
      p0 = p1, x0 = x1, y0 = y1;
      p1 = h * 4, x1 = points[2 * h], y1 = points[2 * h + 1];
      vectors[p0 + 2] = vectors[p1] = y0 - y1;
      vectors[p0 + 3] = vectors[p1 + 1] = x1 - x0;
    }
  }

  render(context) {
    const buffer = context == null ? context = new _path.default() : undefined;
    const {
      delaunay: {
        halfedges,
        inedges,
        hull
      },
      circumcenters,
      vectors
    } = this;
    if (hull.length <= 1) return null;

    for (let i = 0, n = halfedges.length; i < n; ++i) {
      const j = halfedges[i];
      if (j < i) continue;
      const ti = Math.floor(i / 3) * 2;
      const tj = Math.floor(j / 3) * 2;
      const xi = circumcenters[ti];
      const yi = circumcenters[ti + 1];
      const xj = circumcenters[tj];
      const yj = circumcenters[tj + 1];

      this._renderSegment(xi, yi, xj, yj, context);
    }

    let h0,
        h1 = hull[hull.length - 1];

    for (let i = 0; i < hull.length; ++i) {
      h0 = h1, h1 = hull[i];
      const t = Math.floor(inedges[h1] / 3) * 2;
      const x = circumcenters[t];
      const y = circumcenters[t + 1];
      const v = h0 * 4;

      const p = this._project(x, y, vectors[v + 2], vectors[v + 3]);

      if (p) this._renderSegment(x, y, p[0], p[1], context);
    }

    return buffer && buffer.value();
  }

  renderBounds(context) {
    const buffer = context == null ? context = new _path.default() : undefined;
    context.rect(this.xmin, this.ymin, this.xmax - this.xmin, this.ymax - this.ymin);
    return buffer && buffer.value();
  }

  renderCell(i, context) {
    const buffer = context == null ? context = new _path.default() : undefined;

    const points = this._clip(i);

    if (points === null || !points.length) return;
    context.moveTo(points[0], points[1]);
    let n = points.length;

    while (points[0] === points[n - 2] && points[1] === points[n - 1] && n > 1) n -= 2;

    for (let i = 2; i < n; i += 2) {
      if (points[i] !== points[i - 2] || points[i + 1] !== points[i - 1]) context.lineTo(points[i], points[i + 1]);
    }

    context.closePath();
    return buffer && buffer.value();
  }

  *cellPolygons() {
    const {
      delaunay: {
        points
      }
    } = this;

    for (let i = 0, n = points.length / 2; i < n; ++i) {
      const cell = this.cellPolygon(i);
      if (cell) cell.index = i, yield cell;
    }
  }

  cellPolygon(i) {
    const polygon = new _polygon.default();
    this.renderCell(i, polygon);
    return polygon.value();
  }

  _renderSegment(x0, y0, x1, y1, context) {
    let S;

    const c0 = this._regioncode(x0, y0);

    const c1 = this._regioncode(x1, y1);

    if (c0 === 0 && c1 === 0) {
      context.moveTo(x0, y0);
      context.lineTo(x1, y1);
    } else if (S = this._clipSegment(x0, y0, x1, y1, c0, c1)) {
      context.moveTo(S[0], S[1]);
      context.lineTo(S[2], S[3]);
    }
  }

  contains(i, x, y) {
    if ((x = +x, x !== x) || (y = +y, y !== y)) return false;
    return this.delaunay._step(i, x, y) === i;
  }

  *neighbors(i) {
    const ci = this._clip(i);

    if (ci) for (const j of this.delaunay.neighbors(i)) {
      const cj = this._clip(j); // find the common edge


      if (cj) loop: for (let ai = 0, li = ci.length; ai < li; ai += 2) {
        for (let aj = 0, lj = cj.length; aj < lj; aj += 2) {
          if (ci[ai] == cj[aj] && ci[ai + 1] == cj[aj + 1] && ci[(ai + 2) % li] == cj[(aj + lj - 2) % lj] && ci[(ai + 3) % li] == cj[(aj + lj - 1) % lj]) {
            yield j;
            break loop;
          }
        }
      }
    }
  }

  _cell(i) {
    const {
      circumcenters,
      delaunay: {
        inedges,
        halfedges,
        triangles
      }
    } = this;
    const e0 = inedges[i];
    if (e0 === -1) return null; // coincident point

    const points = [];
    let e = e0;

    do {
      const t = Math.floor(e / 3);
      points.push(circumcenters[t * 2], circumcenters[t * 2 + 1]);
      e = e % 3 === 2 ? e - 2 : e + 1;
      if (triangles[e] !== i) break; // bad triangulation

      e = halfedges[e];
    } while (e !== e0 && e !== -1);

    return points;
  }

  _clip(i) {
    // degenerate case (1 valid point: return the box)
    if (i === 0 && this.delaunay.hull.length === 1) {
      return [this.xmax, this.ymin, this.xmax, this.ymax, this.xmin, this.ymax, this.xmin, this.ymin];
    }

    const points = this._cell(i);

    if (points === null) return null;
    const {
      vectors: V
    } = this;
    const v = i * 4;
    return V[v] || V[v + 1] ? this._clipInfinite(i, points, V[v], V[v + 1], V[v + 2], V[v + 3]) : this._clipFinite(i, points);
  }

  _clipFinite(i, points) {
    const n = points.length;
    let P = null;
    let x0,
        y0,
        x1 = points[n - 2],
        y1 = points[n - 1];

    let c0,
        c1 = this._regioncode(x1, y1);

    let e0, e1;

    for (let j = 0; j < n; j += 2) {
      x0 = x1, y0 = y1, x1 = points[j], y1 = points[j + 1];
      c0 = c1, c1 = this._regioncode(x1, y1);

      if (c0 === 0 && c1 === 0) {
        e0 = e1, e1 = 0;
        if (P) P.push(x1, y1);else P = [x1, y1];
      } else {
        let S, sx0, sy0, sx1, sy1;

        if (c0 === 0) {
          if ((S = this._clipSegment(x0, y0, x1, y1, c0, c1)) === null) continue;
          [sx0, sy0, sx1, sy1] = S;
        } else {
          if ((S = this._clipSegment(x1, y1, x0, y0, c1, c0)) === null) continue;
          [sx1, sy1, sx0, sy0] = S;
          e0 = e1, e1 = this._edgecode(sx0, sy0);
          if (e0 && e1) this._edge(i, e0, e1, P, P.length);
          if (P) P.push(sx0, sy0);else P = [sx0, sy0];
        }

        e0 = e1, e1 = this._edgecode(sx1, sy1);
        if (e0 && e1) this._edge(i, e0, e1, P, P.length);
        if (P) P.push(sx1, sy1);else P = [sx1, sy1];
      }
    }

    if (P) {
      e0 = e1, e1 = this._edgecode(P[0], P[1]);
      if (e0 && e1) this._edge(i, e0, e1, P, P.length);
    } else if (this.contains(i, (this.xmin + this.xmax) / 2, (this.ymin + this.ymax) / 2)) {
      return [this.xmax, this.ymin, this.xmax, this.ymax, this.xmin, this.ymax, this.xmin, this.ymin];
    }

    return P;
  }

  _clipSegment(x0, y0, x1, y1, c0, c1) {
    while (true) {
      if (c0 === 0 && c1 === 0) return [x0, y0, x1, y1];
      if (c0 & c1) return null;
      let x,
          y,
          c = c0 || c1;
      if (c & 0b1000) x = x0 + (x1 - x0) * (this.ymax - y0) / (y1 - y0), y = this.ymax;else if (c & 0b0100) x = x0 + (x1 - x0) * (this.ymin - y0) / (y1 - y0), y = this.ymin;else if (c & 0b0010) y = y0 + (y1 - y0) * (this.xmax - x0) / (x1 - x0), x = this.xmax;else y = y0 + (y1 - y0) * (this.xmin - x0) / (x1 - x0), x = this.xmin;
      if (c0) x0 = x, y0 = y, c0 = this._regioncode(x0, y0);else x1 = x, y1 = y, c1 = this._regioncode(x1, y1);
    }
  }

  _clipInfinite(i, points, vx0, vy0, vxn, vyn) {
    let P = Array.from(points),
        p;
    if (p = this._project(P[0], P[1], vx0, vy0)) P.unshift(p[0], p[1]);
    if (p = this._project(P[P.length - 2], P[P.length - 1], vxn, vyn)) P.push(p[0], p[1]);

    if (P = this._clipFinite(i, P)) {
      for (let j = 0, n = P.length, c0, c1 = this._edgecode(P[n - 2], P[n - 1]); j < n; j += 2) {
        c0 = c1, c1 = this._edgecode(P[j], P[j + 1]);
        if (c0 && c1) j = this._edge(i, c0, c1, P, j), n = P.length;
      }
    } else if (this.contains(i, (this.xmin + this.xmax) / 2, (this.ymin + this.ymax) / 2)) {
      P = [this.xmin, this.ymin, this.xmax, this.ymin, this.xmax, this.ymax, this.xmin, this.ymax];
    }

    return P;
  }

  _edge(i, e0, e1, P, j) {
    while (e0 !== e1) {
      let x, y;

      switch (e0) {
        case 0b0101:
          e0 = 0b0100;
          continue;
        // top-left

        case 0b0100:
          e0 = 0b0110, x = this.xmax, y = this.ymin;
          break;
        // top

        case 0b0110:
          e0 = 0b0010;
          continue;
        // top-right

        case 0b0010:
          e0 = 0b1010, x = this.xmax, y = this.ymax;
          break;
        // right

        case 0b1010:
          e0 = 0b1000;
          continue;
        // bottom-right

        case 0b1000:
          e0 = 0b1001, x = this.xmin, y = this.ymax;
          break;
        // bottom

        case 0b1001:
          e0 = 0b0001;
          continue;
        // bottom-left

        case 0b0001:
          e0 = 0b0101, x = this.xmin, y = this.ymin;
          break;
        // left
      }

      if ((P[j] !== x || P[j + 1] !== y) && this.contains(i, x, y)) {
        P.splice(j, 0, x, y), j += 2;
      }
    }

    if (P.length > 4) {
      for (let i = 0; i < P.length; i += 2) {
        const j = (i + 2) % P.length,
              k = (i + 4) % P.length;
        if (P[i] === P[j] && P[j] === P[k] || P[i + 1] === P[j + 1] && P[j + 1] === P[k + 1]) P.splice(j, 2), i -= 2;
      }
    }

    return j;
  }

  _project(x0, y0, vx, vy) {
    let t = Infinity,
        c,
        x,
        y;

    if (vy < 0) {
      // top
      if (y0 <= this.ymin) return null;
      if ((c = (this.ymin - y0) / vy) < t) y = this.ymin, x = x0 + (t = c) * vx;
    } else if (vy > 0) {
      // bottom
      if (y0 >= this.ymax) return null;
      if ((c = (this.ymax - y0) / vy) < t) y = this.ymax, x = x0 + (t = c) * vx;
    }

    if (vx > 0) {
      // right
      if (x0 >= this.xmax) return null;
      if ((c = (this.xmax - x0) / vx) < t) x = this.xmax, y = y0 + (t = c) * vy;
    } else if (vx < 0) {
      // left
      if (x0 <= this.xmin) return null;
      if ((c = (this.xmin - x0) / vx) < t) x = this.xmin, y = y0 + (t = c) * vy;
    }

    return [x, y];
  }

  _edgecode(x, y) {
    return (x === this.xmin ? 0b0001 : x === this.xmax ? 0b0010 : 0b0000) | (y === this.ymin ? 0b0100 : y === this.ymax ? 0b1000 : 0b0000);
  }

  _regioncode(x, y) {
    return (x < this.xmin ? 0b0001 : x > this.xmax ? 0b0010 : 0b0000) | (y < this.ymin ? 0b0100 : y > this.ymax ? 0b1000 : 0b0000);
  }

}

exports.default = Voronoi;

},{"./path.js":79,"./polygon.js":80}],82:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = defaultLocale;
exports.formatPrefix = exports.format = void 0;

var _locale = _interopRequireDefault(require("./locale.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var locale;
var format;
exports.format = format;
var formatPrefix;
exports.formatPrefix = formatPrefix;
defaultLocale({
  decimal: ".",
  thousands: ",",
  grouping: [3],
  currency: ["$", ""],
  minus: "-"
});

function defaultLocale(definition) {
  locale = (0, _locale.default)(definition);
  exports.format = format = locale.format;
  exports.formatPrefix = formatPrefix = locale.formatPrefix;
  return locale;
}

},{"./locale.js":94}],83:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _formatDecimal = require("./formatDecimal.js");

function _default(x) {
  return x = (0, _formatDecimal.formatDecimalParts)(Math.abs(x)), x ? x[1] : NaN;
}

},{"./formatDecimal.js":84}],84:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;
exports.formatDecimalParts = formatDecimalParts;

function _default(x) {
  return Math.abs(x = Math.round(x)) >= 1e21 ? x.toLocaleString("en").replace(/,/g, "") : x.toString(10);
} // Computes the decimal coefficient and exponent of the specified number x with
// significant digits p, where x is positive and p is in [1, 21] or undefined.
// For example, formatDecimalParts(1.23) returns ["123", 0].


function formatDecimalParts(x, p) {
  if ((i = (x = p ? x.toExponential(p - 1) : x.toExponential()).indexOf("e")) < 0) return null; // NaN, ±Infinity

  var i,
      coefficient = x.slice(0, i); // The string returned by toExponential either has the form \d\.\d+e[-+]\d+
  // (e.g., 1.2e+3) or the form \de[-+]\d+ (e.g., 1e+3).

  return [coefficient.length > 1 ? coefficient[0] + coefficient.slice(2) : coefficient, +x.slice(i + 1)];
}

},{}],85:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

function _default(grouping, thousands) {
  return function (value, width) {
    var i = value.length,
        t = [],
        j = 0,
        g = grouping[0],
        length = 0;

    while (i > 0 && g > 0) {
      if (length + g + 1 > width) g = Math.max(1, width - length);
      t.push(value.substring(i -= g, i + g));
      if ((length += g + 1) > width) break;
      g = grouping[j = (j + 1) % grouping.length];
    }

    return t.reverse().join(thousands);
  };
}

},{}],86:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

function _default(numerals) {
  return function (value) {
    return value.replace(/[0-9]/g, function (i) {
      return numerals[+i];
    });
  };
}

},{}],87:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;
exports.prefixExponent = void 0;

var _formatDecimal = require("./formatDecimal.js");

var prefixExponent;
exports.prefixExponent = prefixExponent;

function _default(x, p) {
  var d = (0, _formatDecimal.formatDecimalParts)(x, p);
  if (!d) return x + "";
  var coefficient = d[0],
      exponent = d[1],
      i = exponent - (exports.prefixExponent = prefixExponent = Math.max(-8, Math.min(8, Math.floor(exponent / 3))) * 3) + 1,
      n = coefficient.length;
  return i === n ? coefficient : i > n ? coefficient + new Array(i - n + 1).join("0") : i > 0 ? coefficient.slice(0, i) + "." + coefficient.slice(i) : "0." + new Array(1 - i).join("0") + (0, _formatDecimal.formatDecimalParts)(x, Math.max(0, p + i - 1))[0]; // less than 1y!
}

},{"./formatDecimal.js":84}],88:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _formatDecimal = require("./formatDecimal.js");

function _default(x, p) {
  var d = (0, _formatDecimal.formatDecimalParts)(x, p);
  if (!d) return x + "";
  var coefficient = d[0],
      exponent = d[1];
  return exponent < 0 ? "0." + new Array(-exponent).join("0") + coefficient : coefficient.length > exponent + 1 ? coefficient.slice(0, exponent + 1) + "." + coefficient.slice(exponent + 1) : coefficient + new Array(exponent - coefficient.length + 2).join("0");
}

},{"./formatDecimal.js":84}],89:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = formatSpecifier;
exports.FormatSpecifier = FormatSpecifier;
// [[fill]align][sign][symbol][0][width][,][.precision][~][type]
var re = /^(?:(.)?([<>=^]))?([+\-( ])?([$#])?(0)?(\d+)?(,)?(\.\d+)?(~)?([a-z%])?$/i;

function formatSpecifier(specifier) {
  if (!(match = re.exec(specifier))) throw new Error("invalid format: " + specifier);
  var match;
  return new FormatSpecifier({
    fill: match[1],
    align: match[2],
    sign: match[3],
    symbol: match[4],
    zero: match[5],
    width: match[6],
    comma: match[7],
    precision: match[8] && match[8].slice(1),
    trim: match[9],
    type: match[10]
  });
}

formatSpecifier.prototype = FormatSpecifier.prototype; // instanceof

function FormatSpecifier(specifier) {
  this.fill = specifier.fill === undefined ? " " : specifier.fill + "";
  this.align = specifier.align === undefined ? ">" : specifier.align + "";
  this.sign = specifier.sign === undefined ? "-" : specifier.sign + "";
  this.symbol = specifier.symbol === undefined ? "" : specifier.symbol + "";
  this.zero = !!specifier.zero;
  this.width = specifier.width === undefined ? undefined : +specifier.width;
  this.comma = !!specifier.comma;
  this.precision = specifier.precision === undefined ? undefined : +specifier.precision;
  this.trim = !!specifier.trim;
  this.type = specifier.type === undefined ? "" : specifier.type + "";
}

FormatSpecifier.prototype.toString = function () {
  return this.fill + this.align + this.sign + this.symbol + (this.zero ? "0" : "") + (this.width === undefined ? "" : Math.max(1, this.width | 0)) + (this.comma ? "," : "") + (this.precision === undefined ? "" : "." + Math.max(0, this.precision | 0)) + (this.trim ? "~" : "") + this.type;
};

},{}],90:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

// Trims insignificant zeros, e.g., replaces 1.2000k with 1.2k.
function _default(s) {
  out: for (var n = s.length, i = 1, i0 = -1, i1; i < n; ++i) {
    switch (s[i]) {
      case ".":
        i0 = i1 = i;
        break;

      case "0":
        if (i0 === 0) i0 = i;
        i1 = i;
        break;

      default:
        if (!+s[i]) break out;
        if (i0 > 0) i0 = 0;
        break;
    }
  }

  return i0 > 0 ? s.slice(0, i0) + s.slice(i1 + 1) : s;
}

},{}],91:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _formatDecimal = _interopRequireDefault(require("./formatDecimal.js"));

var _formatPrefixAuto = _interopRequireDefault(require("./formatPrefixAuto.js"));

var _formatRounded = _interopRequireDefault(require("./formatRounded.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _default = {
  "%": function (x, p) {
    return (x * 100).toFixed(p);
  },
  "b": function (x) {
    return Math.round(x).toString(2);
  },
  "c": function (x) {
    return x + "";
  },
  "d": _formatDecimal.default,
  "e": function (x, p) {
    return x.toExponential(p);
  },
  "f": function (x, p) {
    return x.toFixed(p);
  },
  "g": function (x, p) {
    return x.toPrecision(p);
  },
  "o": function (x) {
    return Math.round(x).toString(8);
  },
  "p": function (x, p) {
    return (0, _formatRounded.default)(x * 100, p);
  },
  "r": _formatRounded.default,
  "s": _formatPrefixAuto.default,
  "X": function (x) {
    return Math.round(x).toString(16).toUpperCase();
  },
  "x": function (x) {
    return Math.round(x).toString(16);
  }
};
exports.default = _default;

},{"./formatDecimal.js":84,"./formatPrefixAuto.js":87,"./formatRounded.js":88}],92:[function(require,module,exports){
arguments[4][49][0].apply(exports,arguments)
},{"dup":49}],93:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "formatDefaultLocale", {
  enumerable: true,
  get: function () {
    return _defaultLocale.default;
  }
});
Object.defineProperty(exports, "format", {
  enumerable: true,
  get: function () {
    return _defaultLocale.format;
  }
});
Object.defineProperty(exports, "formatPrefix", {
  enumerable: true,
  get: function () {
    return _defaultLocale.formatPrefix;
  }
});
Object.defineProperty(exports, "formatLocale", {
  enumerable: true,
  get: function () {
    return _locale.default;
  }
});
Object.defineProperty(exports, "formatSpecifier", {
  enumerable: true,
  get: function () {
    return _formatSpecifier.default;
  }
});
Object.defineProperty(exports, "FormatSpecifier", {
  enumerable: true,
  get: function () {
    return _formatSpecifier.FormatSpecifier;
  }
});
Object.defineProperty(exports, "precisionFixed", {
  enumerable: true,
  get: function () {
    return _precisionFixed.default;
  }
});
Object.defineProperty(exports, "precisionPrefix", {
  enumerable: true,
  get: function () {
    return _precisionPrefix.default;
  }
});
Object.defineProperty(exports, "precisionRound", {
  enumerable: true,
  get: function () {
    return _precisionRound.default;
  }
});

var _defaultLocale = _interopRequireWildcard(require("./defaultLocale.js"));

var _locale = _interopRequireDefault(require("./locale.js"));

var _formatSpecifier = _interopRequireWildcard(require("./formatSpecifier.js"));

var _precisionFixed = _interopRequireDefault(require("./precisionFixed.js"));

var _precisionPrefix = _interopRequireDefault(require("./precisionPrefix.js"));

var _precisionRound = _interopRequireDefault(require("./precisionRound.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

},{"./defaultLocale.js":82,"./formatSpecifier.js":89,"./locale.js":94,"./precisionFixed.js":95,"./precisionPrefix.js":96,"./precisionRound.js":97}],94:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _exponent = _interopRequireDefault(require("./exponent.js"));

var _formatGroup = _interopRequireDefault(require("./formatGroup.js"));

var _formatNumerals = _interopRequireDefault(require("./formatNumerals.js"));

var _formatSpecifier = _interopRequireDefault(require("./formatSpecifier.js"));

var _formatTrim = _interopRequireDefault(require("./formatTrim.js"));

var _formatTypes = _interopRequireDefault(require("./formatTypes.js"));

var _formatPrefixAuto = require("./formatPrefixAuto.js");

var _identity = _interopRequireDefault(require("./identity.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var map = Array.prototype.map,
    prefixes = ["y", "z", "a", "f", "p", "n", "µ", "m", "", "k", "M", "G", "T", "P", "E", "Z", "Y"];

function _default(locale) {
  var group = locale.grouping === undefined || locale.thousands === undefined ? _identity.default : (0, _formatGroup.default)(map.call(locale.grouping, Number), locale.thousands + ""),
      currencyPrefix = locale.currency === undefined ? "" : locale.currency[0] + "",
      currencySuffix = locale.currency === undefined ? "" : locale.currency[1] + "",
      decimal = locale.decimal === undefined ? "." : locale.decimal + "",
      numerals = locale.numerals === undefined ? _identity.default : (0, _formatNumerals.default)(map.call(locale.numerals, String)),
      percent = locale.percent === undefined ? "%" : locale.percent + "",
      minus = locale.minus === undefined ? "-" : locale.minus + "",
      nan = locale.nan === undefined ? "NaN" : locale.nan + "";

  function newFormat(specifier) {
    specifier = (0, _formatSpecifier.default)(specifier);
    var fill = specifier.fill,
        align = specifier.align,
        sign = specifier.sign,
        symbol = specifier.symbol,
        zero = specifier.zero,
        width = specifier.width,
        comma = specifier.comma,
        precision = specifier.precision,
        trim = specifier.trim,
        type = specifier.type; // The "n" type is an alias for ",g".

    if (type === "n") comma = true, type = "g"; // The "" type, and any invalid type, is an alias for ".12~g".
    else if (!_formatTypes.default[type]) precision === undefined && (precision = 12), trim = true, type = "g"; // If zero fill is specified, padding goes after sign and before digits.

    if (zero || fill === "0" && align === "=") zero = true, fill = "0", align = "="; // Compute the prefix and suffix.
    // For SI-prefix, the suffix is lazily computed.

    var prefix = symbol === "$" ? currencyPrefix : symbol === "#" && /[boxX]/.test(type) ? "0" + type.toLowerCase() : "",
        suffix = symbol === "$" ? currencySuffix : /[%p]/.test(type) ? percent : ""; // What format function should we use?
    // Is this an integer type?
    // Can this type generate exponential notation?

    var formatType = _formatTypes.default[type],
        maybeSuffix = /[defgprs%]/.test(type); // Set the default precision if not specified,
    // or clamp the specified precision to the supported range.
    // For significant precision, it must be in [1, 21].
    // For fixed precision, it must be in [0, 20].

    precision = precision === undefined ? 6 : /[gprs]/.test(type) ? Math.max(1, Math.min(21, precision)) : Math.max(0, Math.min(20, precision));

    function format(value) {
      var valuePrefix = prefix,
          valueSuffix = suffix,
          i,
          n,
          c;

      if (type === "c") {
        valueSuffix = formatType(value) + valueSuffix;
        value = "";
      } else {
        value = +value; // Determine the sign. -0 is not less than 0, but 1 / -0 is!

        var valueNegative = value < 0 || 1 / value < 0; // Perform the initial formatting.

        value = isNaN(value) ? nan : formatType(Math.abs(value), precision); // Trim insignificant zeros.

        if (trim) value = (0, _formatTrim.default)(value); // If a negative value rounds to zero after formatting, and no explicit positive sign is requested, hide the sign.

        if (valueNegative && +value === 0 && sign !== "+") valueNegative = false; // Compute the prefix and suffix.

        valuePrefix = (valueNegative ? sign === "(" ? sign : minus : sign === "-" || sign === "(" ? "" : sign) + valuePrefix;
        valueSuffix = (type === "s" ? prefixes[8 + _formatPrefixAuto.prefixExponent / 3] : "") + valueSuffix + (valueNegative && sign === "(" ? ")" : ""); // Break the formatted value into the integer “value” part that can be
        // grouped, and fractional or exponential “suffix” part that is not.

        if (maybeSuffix) {
          i = -1, n = value.length;

          while (++i < n) {
            if (c = value.charCodeAt(i), 48 > c || c > 57) {
              valueSuffix = (c === 46 ? decimal + value.slice(i + 1) : value.slice(i)) + valueSuffix;
              value = value.slice(0, i);
              break;
            }
          }
        }
      } // If the fill character is not "0", grouping is applied before padding.


      if (comma && !zero) value = group(value, Infinity); // Compute the padding.

      var length = valuePrefix.length + value.length + valueSuffix.length,
          padding = length < width ? new Array(width - length + 1).join(fill) : ""; // If the fill character is "0", grouping is applied after padding.

      if (comma && zero) value = group(padding + value, padding.length ? width - valueSuffix.length : Infinity), padding = ""; // Reconstruct the final output based on the desired alignment.

      switch (align) {
        case "<":
          value = valuePrefix + value + valueSuffix + padding;
          break;

        case "=":
          value = valuePrefix + padding + value + valueSuffix;
          break;

        case "^":
          value = padding.slice(0, length = padding.length >> 1) + valuePrefix + value + valueSuffix + padding.slice(length);
          break;

        default:
          value = padding + valuePrefix + value + valueSuffix;
          break;
      }

      return numerals(value);
    }

    format.toString = function () {
      return specifier + "";
    };

    return format;
  }

  function formatPrefix(specifier, value) {
    var f = newFormat((specifier = (0, _formatSpecifier.default)(specifier), specifier.type = "f", specifier)),
        e = Math.max(-8, Math.min(8, Math.floor((0, _exponent.default)(value) / 3))) * 3,
        k = Math.pow(10, -e),
        prefix = prefixes[8 + e / 3];
    return function (value) {
      return f(k * value) + prefix;
    };
  }

  return {
    format: newFormat,
    formatPrefix: formatPrefix
  };
}

},{"./exponent.js":83,"./formatGroup.js":85,"./formatNumerals.js":86,"./formatPrefixAuto.js":87,"./formatSpecifier.js":89,"./formatTrim.js":90,"./formatTypes.js":91,"./identity.js":92}],95:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _exponent = _interopRequireDefault(require("./exponent.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _default(step) {
  return Math.max(0, -(0, _exponent.default)(Math.abs(step)));
}

},{"./exponent.js":83}],96:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _exponent = _interopRequireDefault(require("./exponent.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _default(step, value) {
  return Math.max(0, Math.max(-8, Math.min(8, Math.floor((0, _exponent.default)(value) / 3))) * 3 - (0, _exponent.default)(Math.abs(step)));
}

},{"./exponent.js":83}],97:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _exponent = _interopRequireDefault(require("./exponent.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _default(step, max) {
  step = Math.abs(step), max = Math.abs(max) - step;
  return Math.max(0, (0, _exponent.default)(max) - (0, _exponent.default)(step)) + 1;
}

},{"./exponent.js":83}],98:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;
exports.genericArray = genericArray;

var _value = _interopRequireDefault(require("./value.js"));

var _numberArray = _interopRequireWildcard(require("./numberArray.js"));

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _default(a, b) {
  return ((0, _numberArray.isNumberArray)(b) ? _numberArray.default : genericArray)(a, b);
}

function genericArray(a, b) {
  var nb = b ? b.length : 0,
      na = a ? Math.min(nb, a.length) : 0,
      x = new Array(na),
      c = new Array(nb),
      i;

  for (i = 0; i < na; ++i) x[i] = (0, _value.default)(a[i], b[i]);

  for (; i < nb; ++i) c[i] = b[i];

  return function (t) {
    for (i = 0; i < na; ++i) c[i] = x[i](t);

    return c;
  };
}

},{"./numberArray.js":112,"./value.js":122}],99:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.basis = basis;
exports.default = _default;

function basis(t1, v0, v1, v2, v3) {
  var t2 = t1 * t1,
      t3 = t2 * t1;
  return ((1 - 3 * t1 + 3 * t2 - t3) * v0 + (4 - 6 * t2 + 3 * t3) * v1 + (1 + 3 * t1 + 3 * t2 - 3 * t3) * v2 + t3 * v3) / 6;
}

function _default(values) {
  var n = values.length - 1;
  return function (t) {
    var i = t <= 0 ? t = 0 : t >= 1 ? (t = 1, n - 1) : Math.floor(t * n),
        v1 = values[i],
        v2 = values[i + 1],
        v0 = i > 0 ? values[i - 1] : 2 * v1 - v2,
        v3 = i < n - 1 ? values[i + 2] : 2 * v2 - v1;
    return basis((t - i / n) * n, v0, v1, v2, v3);
  };
}

},{}],100:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _basis = require("./basis.js");

function _default(values) {
  var n = values.length;
  return function (t) {
    var i = Math.floor(((t %= 1) < 0 ? ++t : t) * n),
        v0 = values[(i + n - 1) % n],
        v1 = values[i % n],
        v2 = values[(i + 1) % n],
        v3 = values[(i + 2) % n];
    return (0, _basis.basis)((t - i / n) * n, v0, v1, v2, v3);
  };
}

},{"./basis.js":99}],101:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.hue = hue;
exports.gamma = gamma;
exports.default = nogamma;

var _constant = _interopRequireDefault(require("./constant.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function linear(a, d) {
  return function (t) {
    return a + t * d;
  };
}

function exponential(a, b, y) {
  return a = Math.pow(a, y), b = Math.pow(b, y) - a, y = 1 / y, function (t) {
    return Math.pow(a + t * b, y);
  };
}

function hue(a, b) {
  var d = b - a;
  return d ? linear(a, d > 180 || d < -180 ? d - 360 * Math.round(d / 360) : d) : (0, _constant.default)(isNaN(a) ? b : a);
}

function gamma(y) {
  return (y = +y) === 1 ? nogamma : function (a, b) {
    return b - a ? exponential(a, b, y) : (0, _constant.default)(isNaN(a) ? b : a);
  };
}

function nogamma(a, b) {
  var d = b - a;
  return d ? linear(a, d) : (0, _constant.default)(isNaN(a) ? b : a);
}

},{"./constant.js":102}],102:[function(require,module,exports){
arguments[4][43][0].apply(exports,arguments)
},{"dup":43}],103:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.cubehelixLong = exports.default = void 0;

var _d3Color = require("d3-color");

var _color = _interopRequireWildcard(require("./color.js"));

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function cubehelix(hue) {
  return function cubehelixGamma(y) {
    y = +y;

    function cubehelix(start, end) {
      var h = hue((start = (0, _d3Color.cubehelix)(start)).h, (end = (0, _d3Color.cubehelix)(end)).h),
          s = (0, _color.default)(start.s, end.s),
          l = (0, _color.default)(start.l, end.l),
          opacity = (0, _color.default)(start.opacity, end.opacity);
      return function (t) {
        start.h = h(t);
        start.s = s(t);
        start.l = l(Math.pow(t, y));
        start.opacity = opacity(t);
        return start + "";
      };
    }

    cubehelix.gamma = cubehelixGamma;
    return cubehelix;
  }(1);
}

var _default = cubehelix(_color.hue);

exports.default = _default;
var cubehelixLong = cubehelix(_color.default);
exports.cubehelixLong = cubehelixLong;

},{"./color.js":101,"d3-color":74}],104:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

function _default(a, b) {
  var d = new Date();
  return a = +a, b = +b, function (t) {
    return d.setTime(a * (1 - t) + b * t), d;
  };
}

},{}],105:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

function _default(range) {
  var n = range.length;
  return function (t) {
    return range[Math.max(0, Math.min(n - 1, Math.floor(t * n)))];
  };
}

},{}],106:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.hclLong = exports.default = void 0;

var _d3Color = require("d3-color");

var _color = _interopRequireWildcard(require("./color.js"));

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function hcl(hue) {
  return function (start, end) {
    var h = hue((start = (0, _d3Color.hcl)(start)).h, (end = (0, _d3Color.hcl)(end)).h),
        c = (0, _color.default)(start.c, end.c),
        l = (0, _color.default)(start.l, end.l),
        opacity = (0, _color.default)(start.opacity, end.opacity);
    return function (t) {
      start.h = h(t);
      start.c = c(t);
      start.l = l(t);
      start.opacity = opacity(t);
      return start + "";
    };
  };
}

var _default = hcl(_color.hue);

exports.default = _default;
var hclLong = hcl(_color.default);
exports.hclLong = hclLong;

},{"./color.js":101,"d3-color":74}],107:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.hslLong = exports.default = void 0;

var _d3Color = require("d3-color");

var _color = _interopRequireWildcard(require("./color.js"));

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function hsl(hue) {
  return function (start, end) {
    var h = hue((start = (0, _d3Color.hsl)(start)).h, (end = (0, _d3Color.hsl)(end)).h),
        s = (0, _color.default)(start.s, end.s),
        l = (0, _color.default)(start.l, end.l),
        opacity = (0, _color.default)(start.opacity, end.opacity);
    return function (t) {
      start.h = h(t);
      start.s = s(t);
      start.l = l(t);
      start.opacity = opacity(t);
      return start + "";
    };
  };
}

var _default = hsl(_color.hue);

exports.default = _default;
var hslLong = hsl(_color.default);
exports.hslLong = hslLong;

},{"./color.js":101,"d3-color":74}],108:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _color = require("./color.js");

function _default(a, b) {
  var i = (0, _color.hue)(+a, +b);
  return function (t) {
    var x = i(t);
    return x - 360 * Math.floor(x / 360);
  };
}

},{"./color.js":101}],109:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "interpolate", {
  enumerable: true,
  get: function () {
    return _value.default;
  }
});
Object.defineProperty(exports, "interpolateArray", {
  enumerable: true,
  get: function () {
    return _array.default;
  }
});
Object.defineProperty(exports, "interpolateBasis", {
  enumerable: true,
  get: function () {
    return _basis.default;
  }
});
Object.defineProperty(exports, "interpolateBasisClosed", {
  enumerable: true,
  get: function () {
    return _basisClosed.default;
  }
});
Object.defineProperty(exports, "interpolateDate", {
  enumerable: true,
  get: function () {
    return _date.default;
  }
});
Object.defineProperty(exports, "interpolateDiscrete", {
  enumerable: true,
  get: function () {
    return _discrete.default;
  }
});
Object.defineProperty(exports, "interpolateHue", {
  enumerable: true,
  get: function () {
    return _hue.default;
  }
});
Object.defineProperty(exports, "interpolateNumber", {
  enumerable: true,
  get: function () {
    return _number.default;
  }
});
Object.defineProperty(exports, "interpolateNumberArray", {
  enumerable: true,
  get: function () {
    return _numberArray.default;
  }
});
Object.defineProperty(exports, "interpolateObject", {
  enumerable: true,
  get: function () {
    return _object.default;
  }
});
Object.defineProperty(exports, "interpolateRound", {
  enumerable: true,
  get: function () {
    return _round.default;
  }
});
Object.defineProperty(exports, "interpolateString", {
  enumerable: true,
  get: function () {
    return _string.default;
  }
});
Object.defineProperty(exports, "interpolateTransformCss", {
  enumerable: true,
  get: function () {
    return _index.interpolateTransformCss;
  }
});
Object.defineProperty(exports, "interpolateTransformSvg", {
  enumerable: true,
  get: function () {
    return _index.interpolateTransformSvg;
  }
});
Object.defineProperty(exports, "interpolateZoom", {
  enumerable: true,
  get: function () {
    return _zoom.default;
  }
});
Object.defineProperty(exports, "interpolateRgb", {
  enumerable: true,
  get: function () {
    return _rgb.default;
  }
});
Object.defineProperty(exports, "interpolateRgbBasis", {
  enumerable: true,
  get: function () {
    return _rgb.rgbBasis;
  }
});
Object.defineProperty(exports, "interpolateRgbBasisClosed", {
  enumerable: true,
  get: function () {
    return _rgb.rgbBasisClosed;
  }
});
Object.defineProperty(exports, "interpolateHsl", {
  enumerable: true,
  get: function () {
    return _hsl.default;
  }
});
Object.defineProperty(exports, "interpolateHslLong", {
  enumerable: true,
  get: function () {
    return _hsl.hslLong;
  }
});
Object.defineProperty(exports, "interpolateLab", {
  enumerable: true,
  get: function () {
    return _lab.default;
  }
});
Object.defineProperty(exports, "interpolateHcl", {
  enumerable: true,
  get: function () {
    return _hcl.default;
  }
});
Object.defineProperty(exports, "interpolateHclLong", {
  enumerable: true,
  get: function () {
    return _hcl.hclLong;
  }
});
Object.defineProperty(exports, "interpolateCubehelix", {
  enumerable: true,
  get: function () {
    return _cubehelix.default;
  }
});
Object.defineProperty(exports, "interpolateCubehelixLong", {
  enumerable: true,
  get: function () {
    return _cubehelix.cubehelixLong;
  }
});
Object.defineProperty(exports, "piecewise", {
  enumerable: true,
  get: function () {
    return _piecewise.default;
  }
});
Object.defineProperty(exports, "quantize", {
  enumerable: true,
  get: function () {
    return _quantize.default;
  }
});

var _value = _interopRequireDefault(require("./value.js"));

var _array = _interopRequireDefault(require("./array.js"));

var _basis = _interopRequireDefault(require("./basis.js"));

var _basisClosed = _interopRequireDefault(require("./basisClosed.js"));

var _date = _interopRequireDefault(require("./date.js"));

var _discrete = _interopRequireDefault(require("./discrete.js"));

var _hue = _interopRequireDefault(require("./hue.js"));

var _number = _interopRequireDefault(require("./number.js"));

var _numberArray = _interopRequireDefault(require("./numberArray.js"));

var _object = _interopRequireDefault(require("./object.js"));

var _round = _interopRequireDefault(require("./round.js"));

var _string = _interopRequireDefault(require("./string.js"));

var _index = require("./transform/index.js");

var _zoom = _interopRequireDefault(require("./zoom.js"));

var _rgb = _interopRequireWildcard(require("./rgb.js"));

var _hsl = _interopRequireWildcard(require("./hsl.js"));

var _lab = _interopRequireDefault(require("./lab.js"));

var _hcl = _interopRequireWildcard(require("./hcl.js"));

var _cubehelix = _interopRequireWildcard(require("./cubehelix.js"));

var _piecewise = _interopRequireDefault(require("./piecewise.js"));

var _quantize = _interopRequireDefault(require("./quantize.js"));

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

},{"./array.js":98,"./basis.js":99,"./basisClosed.js":100,"./cubehelix.js":103,"./date.js":104,"./discrete.js":105,"./hcl.js":106,"./hsl.js":107,"./hue.js":108,"./lab.js":110,"./number.js":111,"./numberArray.js":112,"./object.js":113,"./piecewise.js":114,"./quantize.js":115,"./rgb.js":116,"./round.js":117,"./string.js":118,"./transform/index.js":120,"./value.js":122,"./zoom.js":123}],110:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = lab;

var _d3Color = require("d3-color");

var _color = _interopRequireDefault(require("./color.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function lab(start, end) {
  var l = (0, _color.default)((start = (0, _d3Color.lab)(start)).l, (end = (0, _d3Color.lab)(end)).l),
      a = (0, _color.default)(start.a, end.a),
      b = (0, _color.default)(start.b, end.b),
      opacity = (0, _color.default)(start.opacity, end.opacity);
  return function (t) {
    start.l = l(t);
    start.a = a(t);
    start.b = b(t);
    start.opacity = opacity(t);
    return start + "";
  };
}

},{"./color.js":101,"d3-color":74}],111:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

function _default(a, b) {
  return a = +a, b = +b, function (t) {
    return a * (1 - t) + b * t;
  };
}

},{}],112:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;
exports.isNumberArray = isNumberArray;

function _default(a, b) {
  if (!b) b = [];
  var n = a ? Math.min(b.length, a.length) : 0,
      c = b.slice(),
      i;
  return function (t) {
    for (i = 0; i < n; ++i) c[i] = a[i] * (1 - t) + b[i] * t;

    return c;
  };
}

function isNumberArray(x) {
  return ArrayBuffer.isView(x) && !(x instanceof DataView);
}

},{}],113:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _value = _interopRequireDefault(require("./value.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _default(a, b) {
  var i = {},
      c = {},
      k;
  if (a === null || typeof a !== "object") a = {};
  if (b === null || typeof b !== "object") b = {};

  for (k in b) {
    if (k in a) {
      i[k] = (0, _value.default)(a[k], b[k]);
    } else {
      c[k] = b[k];
    }
  }

  return function (t) {
    for (k in i) c[k] = i[k](t);

    return c;
  };
}

},{"./value.js":122}],114:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = piecewise;

function piecewise(interpolate, values) {
  var i = 0,
      n = values.length - 1,
      v = values[0],
      I = new Array(n < 0 ? 0 : n);

  while (i < n) I[i] = interpolate(v, v = values[++i]);

  return function (t) {
    var i = Math.max(0, Math.min(n - 1, Math.floor(t *= n)));
    return I[i](t - i);
  };
}

},{}],115:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

function _default(interpolator, n) {
  var samples = new Array(n);

  for (var i = 0; i < n; ++i) samples[i] = interpolator(i / (n - 1));

  return samples;
}

},{}],116:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.rgbBasisClosed = exports.rgbBasis = exports.default = void 0;

var _d3Color = require("d3-color");

var _basis = _interopRequireDefault(require("./basis.js"));

var _basisClosed = _interopRequireDefault(require("./basisClosed.js"));

var _color = _interopRequireWildcard(require("./color.js"));

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _default = function rgbGamma(y) {
  var color = (0, _color.gamma)(y);

  function rgb(start, end) {
    var r = color((start = (0, _d3Color.rgb)(start)).r, (end = (0, _d3Color.rgb)(end)).r),
        g = color(start.g, end.g),
        b = color(start.b, end.b),
        opacity = (0, _color.default)(start.opacity, end.opacity);
    return function (t) {
      start.r = r(t);
      start.g = g(t);
      start.b = b(t);
      start.opacity = opacity(t);
      return start + "";
    };
  }

  rgb.gamma = rgbGamma;
  return rgb;
}(1);

exports.default = _default;

function rgbSpline(spline) {
  return function (colors) {
    var n = colors.length,
        r = new Array(n),
        g = new Array(n),
        b = new Array(n),
        i,
        color;

    for (i = 0; i < n; ++i) {
      color = (0, _d3Color.rgb)(colors[i]);
      r[i] = color.r || 0;
      g[i] = color.g || 0;
      b[i] = color.b || 0;
    }

    r = spline(r);
    g = spline(g);
    b = spline(b);
    color.opacity = 1;
    return function (t) {
      color.r = r(t);
      color.g = g(t);
      color.b = b(t);
      return color + "";
    };
  };
}

var rgbBasis = rgbSpline(_basis.default);
exports.rgbBasis = rgbBasis;
var rgbBasisClosed = rgbSpline(_basisClosed.default);
exports.rgbBasisClosed = rgbBasisClosed;

},{"./basis.js":99,"./basisClosed.js":100,"./color.js":101,"d3-color":74}],117:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

function _default(a, b) {
  return a = +a, b = +b, function (t) {
    return Math.round(a * (1 - t) + b * t);
  };
}

},{}],118:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _number = _interopRequireDefault(require("./number.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var reA = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g,
    reB = new RegExp(reA.source, "g");

function zero(b) {
  return function () {
    return b;
  };
}

function one(b) {
  return function (t) {
    return b(t) + "";
  };
}

function _default(a, b) {
  var bi = reA.lastIndex = reB.lastIndex = 0,
      // scan index for next number in b
  am,
      // current match in a
  bm,
      // current match in b
  bs,
      // string preceding current number in b, if any
  i = -1,
      // index in s
  s = [],
      // string constants and placeholders
  q = []; // number interpolators
  // Coerce inputs to strings.

  a = a + "", b = b + ""; // Interpolate pairs of numbers in a & b.

  while ((am = reA.exec(a)) && (bm = reB.exec(b))) {
    if ((bs = bm.index) > bi) {
      // a string precedes the next number in b
      bs = b.slice(bi, bs);
      if (s[i]) s[i] += bs; // coalesce with previous string
      else s[++i] = bs;
    }

    if ((am = am[0]) === (bm = bm[0])) {
      // numbers in a & b match
      if (s[i]) s[i] += bm; // coalesce with previous string
      else s[++i] = bm;
    } else {
      // interpolate non-matching numbers
      s[++i] = null;
      q.push({
        i: i,
        x: (0, _number.default)(am, bm)
      });
    }

    bi = reB.lastIndex;
  } // Add remains of b.


  if (bi < b.length) {
    bs = b.slice(bi);
    if (s[i]) s[i] += bs; // coalesce with previous string
    else s[++i] = bs;
  } // Special optimization for only a single match.
  // Otherwise, interpolate each of the numbers and rejoin the string.


  return s.length < 2 ? q[0] ? one(q[0].x) : zero(b) : (b = q.length, function (t) {
    for (var i = 0, o; i < b; ++i) s[(o = q[i]).i] = o.x(t);

    return s.join("");
  });
}

},{"./number.js":111}],119:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;
exports.identity = void 0;
var degrees = 180 / Math.PI;
var identity = {
  translateX: 0,
  translateY: 0,
  rotate: 0,
  skewX: 0,
  scaleX: 1,
  scaleY: 1
};
exports.identity = identity;

function _default(a, b, c, d, e, f) {
  var scaleX, scaleY, skewX;
  if (scaleX = Math.sqrt(a * a + b * b)) a /= scaleX, b /= scaleX;
  if (skewX = a * c + b * d) c -= a * skewX, d -= b * skewX;
  if (scaleY = Math.sqrt(c * c + d * d)) c /= scaleY, d /= scaleY, skewX /= scaleY;
  if (a * d < b * c) a = -a, b = -b, skewX = -skewX, scaleX = -scaleX;
  return {
    translateX: e,
    translateY: f,
    rotate: Math.atan2(b, a) * degrees,
    skewX: Math.atan(skewX) * degrees,
    scaleX: scaleX,
    scaleY: scaleY
  };
}

},{}],120:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.interpolateTransformSvg = exports.interpolateTransformCss = void 0;

var _number = _interopRequireDefault(require("../number.js"));

var _parse = require("./parse.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function interpolateTransform(parse, pxComma, pxParen, degParen) {
  function pop(s) {
    return s.length ? s.pop() + " " : "";
  }

  function translate(xa, ya, xb, yb, s, q) {
    if (xa !== xb || ya !== yb) {
      var i = s.push("translate(", null, pxComma, null, pxParen);
      q.push({
        i: i - 4,
        x: (0, _number.default)(xa, xb)
      }, {
        i: i - 2,
        x: (0, _number.default)(ya, yb)
      });
    } else if (xb || yb) {
      s.push("translate(" + xb + pxComma + yb + pxParen);
    }
  }

  function rotate(a, b, s, q) {
    if (a !== b) {
      if (a - b > 180) b += 360;else if (b - a > 180) a += 360; // shortest path

      q.push({
        i: s.push(pop(s) + "rotate(", null, degParen) - 2,
        x: (0, _number.default)(a, b)
      });
    } else if (b) {
      s.push(pop(s) + "rotate(" + b + degParen);
    }
  }

  function skewX(a, b, s, q) {
    if (a !== b) {
      q.push({
        i: s.push(pop(s) + "skewX(", null, degParen) - 2,
        x: (0, _number.default)(a, b)
      });
    } else if (b) {
      s.push(pop(s) + "skewX(" + b + degParen);
    }
  }

  function scale(xa, ya, xb, yb, s, q) {
    if (xa !== xb || ya !== yb) {
      var i = s.push(pop(s) + "scale(", null, ",", null, ")");
      q.push({
        i: i - 4,
        x: (0, _number.default)(xa, xb)
      }, {
        i: i - 2,
        x: (0, _number.default)(ya, yb)
      });
    } else if (xb !== 1 || yb !== 1) {
      s.push(pop(s) + "scale(" + xb + "," + yb + ")");
    }
  }

  return function (a, b) {
    var s = [],
        // string constants and placeholders
    q = []; // number interpolators

    a = parse(a), b = parse(b);
    translate(a.translateX, a.translateY, b.translateX, b.translateY, s, q);
    rotate(a.rotate, b.rotate, s, q);
    skewX(a.skewX, b.skewX, s, q);
    scale(a.scaleX, a.scaleY, b.scaleX, b.scaleY, s, q);
    a = b = null; // gc

    return function (t) {
      var i = -1,
          n = q.length,
          o;

      while (++i < n) s[(o = q[i]).i] = o.x(t);

      return s.join("");
    };
  };
}

var interpolateTransformCss = interpolateTransform(_parse.parseCss, "px, ", "px)", "deg)");
exports.interpolateTransformCss = interpolateTransformCss;
var interpolateTransformSvg = interpolateTransform(_parse.parseSvg, ", ", ")", ")");
exports.interpolateTransformSvg = interpolateTransformSvg;

},{"../number.js":111,"./parse.js":121}],121:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.parseCss = parseCss;
exports.parseSvg = parseSvg;

var _decompose = _interopRequireWildcard(require("./decompose.js"));

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

var cssNode, cssRoot, cssView, svgNode;

function parseCss(value) {
  if (value === "none") return _decompose.identity;
  if (!cssNode) cssNode = document.createElement("DIV"), cssRoot = document.documentElement, cssView = document.defaultView;
  cssNode.style.transform = value;
  value = cssView.getComputedStyle(cssRoot.appendChild(cssNode), null).getPropertyValue("transform");
  cssRoot.removeChild(cssNode);
  value = value.slice(7, -1).split(",");
  return (0, _decompose.default)(+value[0], +value[1], +value[2], +value[3], +value[4], +value[5]);
}

function parseSvg(value) {
  if (value == null) return _decompose.identity;
  if (!svgNode) svgNode = document.createElementNS("http://www.w3.org/2000/svg", "g");
  svgNode.setAttribute("transform", value);
  if (!(value = svgNode.transform.baseVal.consolidate())) return _decompose.identity;
  value = value.matrix;
  return (0, _decompose.default)(value.a, value.b, value.c, value.d, value.e, value.f);
}

},{"./decompose.js":119}],122:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _d3Color = require("d3-color");

var _rgb = _interopRequireDefault(require("./rgb.js"));

var _array = require("./array.js");

var _date = _interopRequireDefault(require("./date.js"));

var _number = _interopRequireDefault(require("./number.js"));

var _object = _interopRequireDefault(require("./object.js"));

var _string = _interopRequireDefault(require("./string.js"));

var _constant = _interopRequireDefault(require("./constant.js"));

var _numberArray = _interopRequireWildcard(require("./numberArray.js"));

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _default(a, b) {
  var t = typeof b,
      c;
  return b == null || t === "boolean" ? (0, _constant.default)(b) : (t === "number" ? _number.default : t === "string" ? (c = (0, _d3Color.color)(b)) ? (b = c, _rgb.default) : _string.default : b instanceof _d3Color.color ? _rgb.default : b instanceof Date ? _date.default : (0, _numberArray.isNumberArray)(b) ? _numberArray.default : Array.isArray(b) ? _array.genericArray : typeof b.valueOf !== "function" && typeof b.toString !== "function" || isNaN(b) ? _object.default : _number.default)(a, b);
}

},{"./array.js":98,"./constant.js":102,"./date.js":104,"./number.js":111,"./numberArray.js":112,"./object.js":113,"./rgb.js":116,"./string.js":118,"d3-color":74}],123:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;
var rho = Math.SQRT2,
    rho2 = 2,
    rho4 = 4,
    epsilon2 = 1e-12;

function cosh(x) {
  return ((x = Math.exp(x)) + 1 / x) / 2;
}

function sinh(x) {
  return ((x = Math.exp(x)) - 1 / x) / 2;
}

function tanh(x) {
  return ((x = Math.exp(2 * x)) - 1) / (x + 1);
} // p0 = [ux0, uy0, w0]
// p1 = [ux1, uy1, w1]


function _default(p0, p1) {
  var ux0 = p0[0],
      uy0 = p0[1],
      w0 = p0[2],
      ux1 = p1[0],
      uy1 = p1[1],
      w1 = p1[2],
      dx = ux1 - ux0,
      dy = uy1 - uy0,
      d2 = dx * dx + dy * dy,
      i,
      S; // Special case for u0 ≅ u1.

  if (d2 < epsilon2) {
    S = Math.log(w1 / w0) / rho;

    i = function (t) {
      return [ux0 + t * dx, uy0 + t * dy, w0 * Math.exp(rho * t * S)];
    };
  } // General case.
  else {
    var d1 = Math.sqrt(d2),
        b0 = (w1 * w1 - w0 * w0 + rho4 * d2) / (2 * w0 * rho2 * d1),
        b1 = (w1 * w1 - w0 * w0 - rho4 * d2) / (2 * w1 * rho2 * d1),
        r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0),
        r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
    S = (r1 - r0) / rho;

    i = function (t) {
      var s = t * S,
          coshr0 = cosh(r0),
          u = w0 / (rho2 * d1) * (coshr0 * tanh(rho * s + r0) - sinh(r0));
      return [ux0 + u * dx, uy0 + u * dy, w0 * coshr0 / cosh(rho * s + r0)];
    };
  }

  i.duration = S * 1000;
  return i;
}

},{}],124:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "scaleBand", {
  enumerable: true,
  get: function () {
    return _band.default;
  }
});
Object.defineProperty(exports, "scalePoint", {
  enumerable: true,
  get: function () {
    return _band.point;
  }
});
Object.defineProperty(exports, "scaleIdentity", {
  enumerable: true,
  get: function () {
    return _identity.default;
  }
});
Object.defineProperty(exports, "scaleLinear", {
  enumerable: true,
  get: function () {
    return _linear.default;
  }
});
Object.defineProperty(exports, "scaleLog", {
  enumerable: true,
  get: function () {
    return _log.default;
  }
});
Object.defineProperty(exports, "scaleOrdinal", {
  enumerable: true,
  get: function () {
    return _ordinal.default;
  }
});
Object.defineProperty(exports, "scaleImplicit", {
  enumerable: true,
  get: function () {
    return _ordinal.implicit;
  }
});
Object.defineProperty(exports, "scalePow", {
  enumerable: true,
  get: function () {
    return _pow.default;
  }
});
Object.defineProperty(exports, "scaleSqrt", {
  enumerable: true,
  get: function () {
    return _pow.sqrt;
  }
});
Object.defineProperty(exports, "scaleQuantile", {
  enumerable: true,
  get: function () {
    return _quantile.default;
  }
});
Object.defineProperty(exports, "scaleQuantize", {
  enumerable: true,
  get: function () {
    return _quantize.default;
  }
});
Object.defineProperty(exports, "scaleThreshold", {
  enumerable: true,
  get: function () {
    return _threshold.default;
  }
});
Object.defineProperty(exports, "scaleTime", {
  enumerable: true,
  get: function () {
    return _time.default;
  }
});
Object.defineProperty(exports, "scaleUtc", {
  enumerable: true,
  get: function () {
    return _utcTime.default;
  }
});
Object.defineProperty(exports, "schemeCategory10", {
  enumerable: true,
  get: function () {
    return _category.default;
  }
});
Object.defineProperty(exports, "schemeCategory20b", {
  enumerable: true,
  get: function () {
    return _category20b.default;
  }
});
Object.defineProperty(exports, "schemeCategory20c", {
  enumerable: true,
  get: function () {
    return _category20c.default;
  }
});
Object.defineProperty(exports, "schemeCategory20", {
  enumerable: true,
  get: function () {
    return _category2.default;
  }
});
Object.defineProperty(exports, "interpolateCubehelixDefault", {
  enumerable: true,
  get: function () {
    return _cubehelix.default;
  }
});
Object.defineProperty(exports, "interpolateRainbow", {
  enumerable: true,
  get: function () {
    return _rainbow.default;
  }
});
Object.defineProperty(exports, "interpolateWarm", {
  enumerable: true,
  get: function () {
    return _rainbow.warm;
  }
});
Object.defineProperty(exports, "interpolateCool", {
  enumerable: true,
  get: function () {
    return _rainbow.cool;
  }
});
Object.defineProperty(exports, "interpolateViridis", {
  enumerable: true,
  get: function () {
    return _viridis.default;
  }
});
Object.defineProperty(exports, "interpolateMagma", {
  enumerable: true,
  get: function () {
    return _viridis.magma;
  }
});
Object.defineProperty(exports, "interpolateInferno", {
  enumerable: true,
  get: function () {
    return _viridis.inferno;
  }
});
Object.defineProperty(exports, "interpolatePlasma", {
  enumerable: true,
  get: function () {
    return _viridis.plasma;
  }
});
Object.defineProperty(exports, "scaleSequential", {
  enumerable: true,
  get: function () {
    return _sequential.default;
  }
});

var _band = _interopRequireWildcard(require("./src/band"));

var _identity = _interopRequireDefault(require("./src/identity"));

var _linear = _interopRequireDefault(require("./src/linear"));

var _log = _interopRequireDefault(require("./src/log"));

var _ordinal = _interopRequireWildcard(require("./src/ordinal"));

var _pow = _interopRequireWildcard(require("./src/pow"));

var _quantile = _interopRequireDefault(require("./src/quantile"));

var _quantize = _interopRequireDefault(require("./src/quantize"));

var _threshold = _interopRequireDefault(require("./src/threshold"));

var _time = _interopRequireDefault(require("./src/time"));

var _utcTime = _interopRequireDefault(require("./src/utcTime"));

var _category = _interopRequireDefault(require("./src/category10"));

var _category20b = _interopRequireDefault(require("./src/category20b"));

var _category20c = _interopRequireDefault(require("./src/category20c"));

var _category2 = _interopRequireDefault(require("./src/category20"));

var _cubehelix = _interopRequireDefault(require("./src/cubehelix"));

var _rainbow = _interopRequireWildcard(require("./src/rainbow"));

var _viridis = _interopRequireWildcard(require("./src/viridis"));

var _sequential = _interopRequireDefault(require("./src/sequential"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

},{"./src/band":126,"./src/category10":127,"./src/category20":128,"./src/category20b":129,"./src/category20c":130,"./src/cubehelix":134,"./src/identity":135,"./src/linear":136,"./src/log":137,"./src/ordinal":140,"./src/pow":141,"./src/quantile":142,"./src/quantize":143,"./src/rainbow":144,"./src/sequential":145,"./src/threshold":146,"./src/time":148,"./src/utcTime":149,"./src/viridis":150}],125:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.slice = exports.map = void 0;
var array = Array.prototype;
var map = array.map;
exports.map = map;
var slice = array.slice;
exports.slice = slice;

},{}],126:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = band;
exports.point = point;

var _d3Array = require("d3-array");

var _ordinal = _interopRequireDefault(require("./ordinal"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function band() {
  var scale = (0, _ordinal.default)().unknown(undefined),
      domain = scale.domain,
      ordinalRange = scale.range,
      range = [0, 1],
      step,
      bandwidth,
      round = false,
      paddingInner = 0,
      paddingOuter = 0,
      align = 0.5;
  delete scale.unknown;

  function rescale() {
    var n = domain().length,
        reverse = range[1] < range[0],
        start = range[reverse - 0],
        stop = range[1 - reverse];
    step = (stop - start) / Math.max(1, n - paddingInner + paddingOuter * 2);
    if (round) step = Math.floor(step);
    start += (stop - start - step * (n - paddingInner)) * align;
    bandwidth = step * (1 - paddingInner);
    if (round) start = Math.round(start), bandwidth = Math.round(bandwidth);
    var values = (0, _d3Array.range)(n).map(function (i) {
      return start + step * i;
    });
    return ordinalRange(reverse ? values.reverse() : values);
  }

  scale.domain = function (_) {
    return arguments.length ? (domain(_), rescale()) : domain();
  };

  scale.range = function (_) {
    return arguments.length ? (range = [+_[0], +_[1]], rescale()) : range.slice();
  };

  scale.rangeRound = function (_) {
    return range = [+_[0], +_[1]], round = true, rescale();
  };

  scale.bandwidth = function () {
    return bandwidth;
  };

  scale.step = function () {
    return step;
  };

  scale.round = function (_) {
    return arguments.length ? (round = !!_, rescale()) : round;
  };

  scale.padding = function (_) {
    return arguments.length ? (paddingInner = paddingOuter = Math.max(0, Math.min(1, _)), rescale()) : paddingInner;
  };

  scale.paddingInner = function (_) {
    return arguments.length ? (paddingInner = Math.max(0, Math.min(1, _)), rescale()) : paddingInner;
  };

  scale.paddingOuter = function (_) {
    return arguments.length ? (paddingOuter = Math.max(0, Math.min(1, _)), rescale()) : paddingOuter;
  };

  scale.align = function (_) {
    return arguments.length ? (align = Math.max(0, Math.min(1, _)), rescale()) : align;
  };

  scale.copy = function () {
    return band().domain(domain()).range(range).round(round).paddingInner(paddingInner).paddingOuter(paddingOuter).align(align);
  };

  return rescale();
}

function pointish(scale) {
  var copy = scale.copy;
  scale.padding = scale.paddingOuter;
  delete scale.paddingInner;
  delete scale.paddingOuter;

  scale.copy = function () {
    return pointish(copy());
  };

  return scale;
}

function point() {
  return pointish(band().paddingInner(1));
}

},{"./ordinal":140,"d3-array":50}],127:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _colors = _interopRequireDefault(require("./colors"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _default = (0, _colors.default)("1f77b4ff7f0e2ca02cd627289467bd8c564be377c27f7f7fbcbd2217becf");

exports.default = _default;

},{"./colors":131}],128:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _colors = _interopRequireDefault(require("./colors"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _default = (0, _colors.default)("1f77b4aec7e8ff7f0effbb782ca02c98df8ad62728ff98969467bdc5b0d58c564bc49c94e377c2f7b6d27f7f7fc7c7c7bcbd22dbdb8d17becf9edae5");

exports.default = _default;

},{"./colors":131}],129:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _colors = _interopRequireDefault(require("./colors"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _default = (0, _colors.default)("393b795254a36b6ecf9c9ede6379398ca252b5cf6bcedb9c8c6d31bd9e39e7ba52e7cb94843c39ad494ad6616be7969c7b4173a55194ce6dbdde9ed6");

exports.default = _default;

},{"./colors":131}],130:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _colors = _interopRequireDefault(require("./colors"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _default = (0, _colors.default)("3182bd6baed69ecae1c6dbefe6550dfd8d3cfdae6bfdd0a231a35474c476a1d99bc7e9c0756bb19e9ac8bcbddcdadaeb636363969696bdbdbdd9d9d9");

exports.default = _default;

},{"./colors":131}],131:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

function _default(s) {
  return s.match(/.{6}/g).map(function (x) {
    return "#" + x;
  });
}

},{}],132:[function(require,module,exports){
arguments[4][43][0].apply(exports,arguments)
},{"dup":43}],133:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.deinterpolateLinear = deinterpolateLinear;
exports.copy = copy;
exports.default = continuous;

var _d3Array = require("d3-array");

var _d3Interpolate = require("d3-interpolate");

var _array = require("./array");

var _constant = _interopRequireDefault(require("./constant"));

var _number = _interopRequireDefault(require("./number"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var unit = [0, 1];

function deinterpolateLinear(a, b) {
  return (b -= a = +a) ? function (x) {
    return (x - a) / b;
  } : (0, _constant.default)(b);
}

function deinterpolateClamp(deinterpolate) {
  return function (a, b) {
    var d = deinterpolate(a = +a, b = +b);
    return function (x) {
      return x <= a ? 0 : x >= b ? 1 : d(x);
    };
  };
}

function reinterpolateClamp(reinterpolate) {
  return function (a, b) {
    var r = reinterpolate(a = +a, b = +b);
    return function (t) {
      return t <= 0 ? a : t >= 1 ? b : r(t);
    };
  };
}

function bimap(domain, range, deinterpolate, reinterpolate) {
  var d0 = domain[0],
      d1 = domain[1],
      r0 = range[0],
      r1 = range[1];
  if (d1 < d0) d0 = deinterpolate(d1, d0), r0 = reinterpolate(r1, r0);else d0 = deinterpolate(d0, d1), r0 = reinterpolate(r0, r1);
  return function (x) {
    return r0(d0(x));
  };
}

function polymap(domain, range, deinterpolate, reinterpolate) {
  var j = Math.min(domain.length, range.length) - 1,
      d = new Array(j),
      r = new Array(j),
      i = -1; // Reverse descending domains.

  if (domain[j] < domain[0]) {
    domain = domain.slice().reverse();
    range = range.slice().reverse();
  }

  while (++i < j) {
    d[i] = deinterpolate(domain[i], domain[i + 1]);
    r[i] = reinterpolate(range[i], range[i + 1]);
  }

  return function (x) {
    var i = (0, _d3Array.bisect)(domain, x, 1, j) - 1;
    return r[i](d[i](x));
  };
}

function copy(source, target) {
  return target.domain(source.domain()).range(source.range()).interpolate(source.interpolate()).clamp(source.clamp());
} // deinterpolate(a, b)(x) takes a domain value x in [a,b] and returns the corresponding parameter t in [0,1].
// reinterpolate(a, b)(t) takes a parameter t in [0,1] and returns the corresponding domain value x in [a,b].


function continuous(deinterpolate, reinterpolate) {
  var domain = unit,
      range = unit,
      interpolate = _d3Interpolate.interpolate,
      clamp = false,
      piecewise,
      output,
      input;

  function rescale() {
    piecewise = Math.min(domain.length, range.length) > 2 ? polymap : bimap;
    output = input = null;
    return scale;
  }

  function scale(x) {
    return (output || (output = piecewise(domain, range, clamp ? deinterpolateClamp(deinterpolate) : deinterpolate, interpolate)))(+x);
  }

  scale.invert = function (y) {
    return (input || (input = piecewise(range, domain, deinterpolateLinear, clamp ? reinterpolateClamp(reinterpolate) : reinterpolate)))(+y);
  };

  scale.domain = function (_) {
    return arguments.length ? (domain = _array.map.call(_, _number.default), rescale()) : domain.slice();
  };

  scale.range = function (_) {
    return arguments.length ? (range = _array.slice.call(_), rescale()) : range.slice();
  };

  scale.rangeRound = function (_) {
    return range = _array.slice.call(_), interpolate = _d3Interpolate.interpolateRound, rescale();
  };

  scale.clamp = function (_) {
    return arguments.length ? (clamp = !!_, rescale()) : clamp;
  };

  scale.interpolate = function (_) {
    return arguments.length ? (interpolate = _, rescale()) : interpolate;
  };

  return rescale();
}

},{"./array":125,"./constant":132,"./number":139,"d3-array":50,"d3-interpolate":109}],134:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _d3Color = require("d3-color");

var _d3Interpolate = require("d3-interpolate");

var _default = (0, _d3Interpolate.interpolateCubehelixLong)((0, _d3Color.cubehelix)(300, 0.5, 0.0), (0, _d3Color.cubehelix)(-240, 0.5, 1.0));

exports.default = _default;

},{"d3-color":74,"d3-interpolate":109}],135:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = identity;

var _array = require("./array");

var _linear = require("./linear");

var _number = _interopRequireDefault(require("./number"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function identity() {
  var domain = [0, 1];

  function scale(x) {
    return +x;
  }

  scale.invert = scale;

  scale.domain = scale.range = function (_) {
    return arguments.length ? (domain = _array.map.call(_, _number.default), scale) : domain.slice();
  };

  scale.copy = function () {
    return identity().domain(domain);
  };

  return (0, _linear.linearish)(scale);
}

},{"./array":125,"./linear":136,"./number":139}],136:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.linearish = linearish;
exports.default = linear;

var _d3Array = require("d3-array");

var _d3Interpolate = require("d3-interpolate");

var _continuous = _interopRequireWildcard(require("./continuous"));

var _tickFormat = _interopRequireDefault(require("./tickFormat"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function linearish(scale) {
  var domain = scale.domain;

  scale.ticks = function (count) {
    var d = domain();
    return (0, _d3Array.ticks)(d[0], d[d.length - 1], count == null ? 10 : count);
  };

  scale.tickFormat = function (count, specifier) {
    return (0, _tickFormat.default)(domain(), count, specifier);
  };

  scale.nice = function (count) {
    if (count == null) count = 10;
    var d = domain(),
        i0 = 0,
        i1 = d.length - 1,
        start = d[i0],
        stop = d[i1],
        step;

    if (stop < start) {
      step = start, start = stop, stop = step;
      step = i0, i0 = i1, i1 = step;
    }

    step = (0, _d3Array.tickIncrement)(start, stop, count);

    if (step > 0) {
      start = Math.floor(start / step) * step;
      stop = Math.ceil(stop / step) * step;
      step = (0, _d3Array.tickIncrement)(start, stop, count);
    } else if (step < 0) {
      start = Math.ceil(start * step) / step;
      stop = Math.floor(stop * step) / step;
      step = (0, _d3Array.tickIncrement)(start, stop, count);
    }

    if (step > 0) {
      d[i0] = Math.floor(start / step) * step;
      d[i1] = Math.ceil(stop / step) * step;
      domain(d);
    } else if (step < 0) {
      d[i0] = Math.ceil(start * step) / step;
      d[i1] = Math.floor(stop * step) / step;
      domain(d);
    }

    return scale;
  };

  return scale;
}

function linear() {
  var scale = (0, _continuous.default)(_continuous.deinterpolateLinear, _d3Interpolate.interpolateNumber);

  scale.copy = function () {
    return (0, _continuous.copy)(scale, linear());
  };

  return linearish(scale);
}

},{"./continuous":133,"./tickFormat":147,"d3-array":50,"d3-interpolate":109}],137:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = log;

var _d3Array = require("d3-array");

var _d3Format = require("d3-format");

var _constant = _interopRequireDefault(require("./constant"));

var _nice = _interopRequireDefault(require("./nice"));

var _continuous = _interopRequireWildcard(require("./continuous"));

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function deinterpolate(a, b) {
  return (b = Math.log(b / a)) ? function (x) {
    return Math.log(x / a) / b;
  } : (0, _constant.default)(b);
}

function reinterpolate(a, b) {
  return a < 0 ? function (t) {
    return -Math.pow(-b, t) * Math.pow(-a, 1 - t);
  } : function (t) {
    return Math.pow(b, t) * Math.pow(a, 1 - t);
  };
}

function pow10(x) {
  return isFinite(x) ? +("1e" + x) : x < 0 ? 0 : x;
}

function powp(base) {
  return base === 10 ? pow10 : base === Math.E ? Math.exp : function (x) {
    return Math.pow(base, x);
  };
}

function logp(base) {
  return base === Math.E ? Math.log : base === 10 && Math.log10 || base === 2 && Math.log2 || (base = Math.log(base), function (x) {
    return Math.log(x) / base;
  });
}

function reflect(f) {
  return function (x) {
    return -f(-x);
  };
}

function log() {
  var scale = (0, _continuous.default)(deinterpolate, reinterpolate).domain([1, 10]),
      domain = scale.domain,
      base = 10,
      logs = logp(10),
      pows = powp(10);

  function rescale() {
    logs = logp(base), pows = powp(base);
    if (domain()[0] < 0) logs = reflect(logs), pows = reflect(pows);
    return scale;
  }

  scale.base = function (_) {
    return arguments.length ? (base = +_, rescale()) : base;
  };

  scale.domain = function (_) {
    return arguments.length ? (domain(_), rescale()) : domain();
  };

  scale.ticks = function (count) {
    var d = domain(),
        u = d[0],
        v = d[d.length - 1],
        r;
    if (r = v < u) i = u, u = v, v = i;
    var i = logs(u),
        j = logs(v),
        p,
        k,
        t,
        n = count == null ? 10 : +count,
        z = [];

    if (!(base % 1) && j - i < n) {
      i = Math.round(i) - 1, j = Math.round(j) + 1;
      if (u > 0) for (; i < j; ++i) {
        for (k = 1, p = pows(i); k < base; ++k) {
          t = p * k;
          if (t < u) continue;
          if (t > v) break;
          z.push(t);
        }
      } else for (; i < j; ++i) {
        for (k = base - 1, p = pows(i); k >= 1; --k) {
          t = p * k;
          if (t < u) continue;
          if (t > v) break;
          z.push(t);
        }
      }
    } else {
      z = (0, _d3Array.ticks)(i, j, Math.min(j - i, n)).map(pows);
    }

    return r ? z.reverse() : z;
  };

  scale.tickFormat = function (count, specifier) {
    if (specifier == null) specifier = base === 10 ? ".0e" : ",";
    if (typeof specifier !== "function") specifier = (0, _d3Format.format)(specifier);
    if (count === Infinity) return specifier;
    if (count == null) count = 10;
    var k = Math.max(1, base * count / scale.ticks().length); // TODO fast estimate?

    return function (d) {
      var i = d / pows(Math.round(logs(d)));
      if (i * base < base - 0.5) i *= base;
      return i <= k ? specifier(d) : "";
    };
  };

  scale.nice = function () {
    return domain((0, _nice.default)(domain(), {
      floor: function (x) {
        return pows(Math.floor(logs(x)));
      },
      ceil: function (x) {
        return pows(Math.ceil(logs(x)));
      }
    }));
  };

  scale.copy = function () {
    return (0, _continuous.copy)(scale, log().base(base));
  };

  return scale;
}

},{"./constant":132,"./continuous":133,"./nice":138,"d3-array":50,"d3-format":93}],138:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

function _default(domain, interval) {
  domain = domain.slice();
  var i0 = 0,
      i1 = domain.length - 1,
      x0 = domain[i0],
      x1 = domain[i1],
      t;

  if (x1 < x0) {
    t = i0, i0 = i1, i1 = t;
    t = x0, x0 = x1, x1 = t;
  }

  domain[i0] = interval.floor(x0);
  domain[i1] = interval.ceil(x1);
  return domain;
}

},{}],139:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

function _default(x) {
  return +x;
}

},{}],140:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = ordinal;
exports.implicit = void 0;

var _d3Collection = require("d3-collection");

var _array = require("./array");

var implicit = {
  name: "implicit"
};
exports.implicit = implicit;

function ordinal(range) {
  var index = (0, _d3Collection.map)(),
      domain = [],
      unknown = implicit;
  range = range == null ? [] : _array.slice.call(range);

  function scale(d) {
    var key = d + "",
        i = index.get(key);

    if (!i) {
      if (unknown !== implicit) return unknown;
      index.set(key, i = domain.push(d));
    }

    return range[(i - 1) % range.length];
  }

  scale.domain = function (_) {
    if (!arguments.length) return domain.slice();
    domain = [], index = (0, _d3Collection.map)();
    var i = -1,
        n = _.length,
        d,
        key;

    while (++i < n) if (!index.has(key = (d = _[i]) + "")) index.set(key, domain.push(d));

    return scale;
  };

  scale.range = function (_) {
    return arguments.length ? (range = _array.slice.call(_), scale) : range.slice();
  };

  scale.unknown = function (_) {
    return arguments.length ? (unknown = _, scale) : unknown;
  };

  scale.copy = function () {
    return ordinal().domain(domain).range(range).unknown(unknown);
  };

  return scale;
}

},{"./array":125,"d3-collection":33}],141:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = pow;
exports.sqrt = sqrt;

var _constant = _interopRequireDefault(require("./constant"));

var _linear = require("./linear");

var _continuous = _interopRequireWildcard(require("./continuous"));

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function raise(x, exponent) {
  return x < 0 ? -Math.pow(-x, exponent) : Math.pow(x, exponent);
}

function pow() {
  var exponent = 1,
      scale = (0, _continuous.default)(deinterpolate, reinterpolate),
      domain = scale.domain;

  function deinterpolate(a, b) {
    return (b = raise(b, exponent) - (a = raise(a, exponent))) ? function (x) {
      return (raise(x, exponent) - a) / b;
    } : (0, _constant.default)(b);
  }

  function reinterpolate(a, b) {
    b = raise(b, exponent) - (a = raise(a, exponent));
    return function (t) {
      return raise(a + b * t, 1 / exponent);
    };
  }

  scale.exponent = function (_) {
    return arguments.length ? (exponent = +_, domain(domain())) : exponent;
  };

  scale.copy = function () {
    return (0, _continuous.copy)(scale, pow().exponent(exponent));
  };

  return (0, _linear.linearish)(scale);
}

function sqrt() {
  return pow().exponent(0.5);
}

},{"./constant":132,"./continuous":133,"./linear":136}],142:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = quantile;

var _d3Array = require("d3-array");

var _array = require("./array");

function quantile() {
  var domain = [],
      range = [],
      thresholds = [];

  function rescale() {
    var i = 0,
        n = Math.max(1, range.length);
    thresholds = new Array(n - 1);

    while (++i < n) thresholds[i - 1] = (0, _d3Array.quantile)(domain, i / n);

    return scale;
  }

  function scale(x) {
    if (!isNaN(x = +x)) return range[(0, _d3Array.bisect)(thresholds, x)];
  }

  scale.invertExtent = function (y) {
    var i = range.indexOf(y);
    return i < 0 ? [NaN, NaN] : [i > 0 ? thresholds[i - 1] : domain[0], i < thresholds.length ? thresholds[i] : domain[domain.length - 1]];
  };

  scale.domain = function (_) {
    if (!arguments.length) return domain.slice();
    domain = [];

    for (var i = 0, n = _.length, d; i < n; ++i) if (d = _[i], d != null && !isNaN(d = +d)) domain.push(d);

    domain.sort(_d3Array.ascending);
    return rescale();
  };

  scale.range = function (_) {
    return arguments.length ? (range = _array.slice.call(_), rescale()) : range.slice();
  };

  scale.quantiles = function () {
    return thresholds.slice();
  };

  scale.copy = function () {
    return quantile().domain(domain).range(range);
  };

  return scale;
}

},{"./array":125,"d3-array":50}],143:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = quantize;

var _d3Array = require("d3-array");

var _array = require("./array");

var _linear = require("./linear");

function quantize() {
  var x0 = 0,
      x1 = 1,
      n = 1,
      domain = [0.5],
      range = [0, 1];

  function scale(x) {
    if (x <= x) return range[(0, _d3Array.bisect)(domain, x, 0, n)];
  }

  function rescale() {
    var i = -1;
    domain = new Array(n);

    while (++i < n) domain[i] = ((i + 1) * x1 - (i - n) * x0) / (n + 1);

    return scale;
  }

  scale.domain = function (_) {
    return arguments.length ? (x0 = +_[0], x1 = +_[1], rescale()) : [x0, x1];
  };

  scale.range = function (_) {
    return arguments.length ? (n = (range = _array.slice.call(_)).length - 1, rescale()) : range.slice();
  };

  scale.invertExtent = function (y) {
    var i = range.indexOf(y);
    return i < 0 ? [NaN, NaN] : i < 1 ? [x0, domain[0]] : i >= n ? [domain[n - 1], x1] : [domain[i - 1], domain[i]];
  };

  scale.copy = function () {
    return quantize().domain([x0, x1]).range(range);
  };

  return (0, _linear.linearish)(scale);
}

},{"./array":125,"./linear":136,"d3-array":50}],144:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;
exports.cool = exports.warm = void 0;

var _d3Color = require("d3-color");

var _d3Interpolate = require("d3-interpolate");

var warm = (0, _d3Interpolate.interpolateCubehelixLong)((0, _d3Color.cubehelix)(-100, 0.75, 0.35), (0, _d3Color.cubehelix)(80, 1.50, 0.8));
exports.warm = warm;
var cool = (0, _d3Interpolate.interpolateCubehelixLong)((0, _d3Color.cubehelix)(260, 0.75, 0.35), (0, _d3Color.cubehelix)(80, 1.50, 0.8));
exports.cool = cool;
var rainbow = (0, _d3Color.cubehelix)();

function _default(t) {
  if (t < 0 || t > 1) t -= Math.floor(t);
  var ts = Math.abs(t - 0.5);
  rainbow.h = 360 * t - 100;
  rainbow.s = 1.5 - 1.5 * ts;
  rainbow.l = 0.8 - 0.9 * ts;
  return rainbow + "";
}

},{"d3-color":74,"d3-interpolate":109}],145:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = sequential;

var _linear = require("./linear");

function sequential(interpolator) {
  var x0 = 0,
      x1 = 1,
      clamp = false;

  function scale(x) {
    var t = (x - x0) / (x1 - x0);
    return interpolator(clamp ? Math.max(0, Math.min(1, t)) : t);
  }

  scale.domain = function (_) {
    return arguments.length ? (x0 = +_[0], x1 = +_[1], scale) : [x0, x1];
  };

  scale.clamp = function (_) {
    return arguments.length ? (clamp = !!_, scale) : clamp;
  };

  scale.interpolator = function (_) {
    return arguments.length ? (interpolator = _, scale) : interpolator;
  };

  scale.copy = function () {
    return sequential(interpolator).domain([x0, x1]).clamp(clamp);
  };

  return (0, _linear.linearish)(scale);
}

},{"./linear":136}],146:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = threshold;

var _d3Array = require("d3-array");

var _array = require("./array");

function threshold() {
  var domain = [0.5],
      range = [0, 1],
      n = 1;

  function scale(x) {
    if (x <= x) return range[(0, _d3Array.bisect)(domain, x, 0, n)];
  }

  scale.domain = function (_) {
    return arguments.length ? (domain = _array.slice.call(_), n = Math.min(domain.length, range.length - 1), scale) : domain.slice();
  };

  scale.range = function (_) {
    return arguments.length ? (range = _array.slice.call(_), n = Math.min(domain.length, range.length - 1), scale) : range.slice();
  };

  scale.invertExtent = function (y) {
    var i = range.indexOf(y);
    return [domain[i - 1], domain[i]];
  };

  scale.copy = function () {
    return threshold().domain(domain).range(range);
  };

  return scale;
}

},{"./array":125,"d3-array":50}],147:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _d3Array = require("d3-array");

var _d3Format = require("d3-format");

function _default(domain, count, specifier) {
  var start = domain[0],
      stop = domain[domain.length - 1],
      step = (0, _d3Array.tickStep)(start, stop, count == null ? 10 : count),
      precision;
  specifier = (0, _d3Format.formatSpecifier)(specifier == null ? ",f" : specifier);

  switch (specifier.type) {
    case "s":
      {
        var value = Math.max(Math.abs(start), Math.abs(stop));
        if (specifier.precision == null && !isNaN(precision = (0, _d3Format.precisionPrefix)(step, value))) specifier.precision = precision;
        return (0, _d3Format.formatPrefix)(specifier, value);
      }

    case "":
    case "e":
    case "g":
    case "p":
    case "r":
      {
        if (specifier.precision == null && !isNaN(precision = (0, _d3Format.precisionRound)(step, Math.max(Math.abs(start), Math.abs(stop))))) specifier.precision = precision - (specifier.type === "e");
        break;
      }

    case "f":
    case "%":
      {
        if (specifier.precision == null && !isNaN(precision = (0, _d3Format.precisionFixed)(step))) specifier.precision = precision - (specifier.type === "%") * 2;
        break;
      }
  }

  return (0, _d3Format.format)(specifier);
}

},{"d3-array":50,"d3-format":93}],148:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.calendar = calendar;
exports.default = _default;

var _d3Array = require("d3-array");

var _d3Interpolate = require("d3-interpolate");

var _d3Time = require("d3-time");

var _d3TimeFormat = require("d3-time-format");

var _array = require("./array");

var _continuous = _interopRequireWildcard(require("./continuous"));

var _nice = _interopRequireDefault(require("./nice"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

var durationSecond = 1000,
    durationMinute = durationSecond * 60,
    durationHour = durationMinute * 60,
    durationDay = durationHour * 24,
    durationWeek = durationDay * 7,
    durationMonth = durationDay * 30,
    durationYear = durationDay * 365;

function date(t) {
  return new Date(t);
}

function number(t) {
  return t instanceof Date ? +t : +new Date(+t);
}

function calendar(year, month, week, day, hour, minute, second, millisecond, format) {
  var scale = (0, _continuous.default)(_continuous.deinterpolateLinear, _d3Interpolate.interpolateNumber),
      invert = scale.invert,
      domain = scale.domain;
  var formatMillisecond = format(".%L"),
      formatSecond = format(":%S"),
      formatMinute = format("%I:%M"),
      formatHour = format("%I %p"),
      formatDay = format("%a %d"),
      formatWeek = format("%b %d"),
      formatMonth = format("%B"),
      formatYear = format("%Y");
  var tickIntervals = [[second, 1, durationSecond], [second, 5, 5 * durationSecond], [second, 15, 15 * durationSecond], [second, 30, 30 * durationSecond], [minute, 1, durationMinute], [minute, 5, 5 * durationMinute], [minute, 15, 15 * durationMinute], [minute, 30, 30 * durationMinute], [hour, 1, durationHour], [hour, 3, 3 * durationHour], [hour, 6, 6 * durationHour], [hour, 12, 12 * durationHour], [day, 1, durationDay], [day, 2, 2 * durationDay], [week, 1, durationWeek], [month, 1, durationMonth], [month, 3, 3 * durationMonth], [year, 1, durationYear]];

  function tickFormat(date) {
    return (second(date) < date ? formatMillisecond : minute(date) < date ? formatSecond : hour(date) < date ? formatMinute : day(date) < date ? formatHour : month(date) < date ? week(date) < date ? formatDay : formatWeek : year(date) < date ? formatMonth : formatYear)(date);
  }

  function tickInterval(interval, start, stop, step) {
    if (interval == null) interval = 10; // If a desired tick count is specified, pick a reasonable tick interval
    // based on the extent of the domain and a rough estimate of tick size.
    // Otherwise, assume interval is already a time interval and use it.

    if (typeof interval === "number") {
      var target = Math.abs(stop - start) / interval,
          i = (0, _d3Array.bisector)(function (i) {
        return i[2];
      }).right(tickIntervals, target);

      if (i === tickIntervals.length) {
        step = (0, _d3Array.tickStep)(start / durationYear, stop / durationYear, interval);
        interval = year;
      } else if (i) {
        i = tickIntervals[target / tickIntervals[i - 1][2] < tickIntervals[i][2] / target ? i - 1 : i];
        step = i[1];
        interval = i[0];
      } else {
        step = Math.max((0, _d3Array.tickStep)(start, stop, interval), 1);
        interval = millisecond;
      }
    }

    return step == null ? interval : interval.every(step);
  }

  scale.invert = function (y) {
    return new Date(invert(y));
  };

  scale.domain = function (_) {
    return arguments.length ? domain(_array.map.call(_, number)) : domain().map(date);
  };

  scale.ticks = function (interval, step) {
    var d = domain(),
        t0 = d[0],
        t1 = d[d.length - 1],
        r = t1 < t0,
        t;
    if (r) t = t0, t0 = t1, t1 = t;
    t = tickInterval(interval, t0, t1, step);
    t = t ? t.range(t0, t1 + 1) : []; // inclusive stop

    return r ? t.reverse() : t;
  };

  scale.tickFormat = function (count, specifier) {
    return specifier == null ? tickFormat : format(specifier);
  };

  scale.nice = function (interval, step) {
    var d = domain();
    return (interval = tickInterval(interval, d[0], d[d.length - 1], step)) ? domain((0, _nice.default)(d, interval)) : scale;
  };

  scale.copy = function () {
    return (0, _continuous.copy)(scale, calendar(year, month, week, day, hour, minute, second, millisecond, format));
  };

  return scale;
}

function _default() {
  return calendar(_d3Time.timeYear, _d3Time.timeMonth, _d3Time.timeWeek, _d3Time.timeDay, _d3Time.timeHour, _d3Time.timeMinute, _d3Time.timeSecond, _d3Time.timeMillisecond, _d3TimeFormat.timeFormat).domain([new Date(2000, 0, 1), new Date(2000, 0, 2)]);
}

},{"./array":125,"./continuous":133,"./nice":138,"d3-array":50,"d3-interpolate":109,"d3-time":159,"d3-time-format":152}],149:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _time = require("./time");

var _d3TimeFormat = require("d3-time-format");

var _d3Time = require("d3-time");

function _default() {
  return (0, _time.calendar)(_d3Time.utcYear, _d3Time.utcMonth, _d3Time.utcWeek, _d3Time.utcDay, _d3Time.utcHour, _d3Time.utcMinute, _d3Time.utcSecond, _d3Time.utcMillisecond, _d3TimeFormat.utcFormat).domain([Date.UTC(2000, 0, 1), Date.UTC(2000, 0, 2)]);
}

},{"./time":148,"d3-time":159,"d3-time-format":152}],150:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.plasma = exports.inferno = exports.magma = exports.default = void 0;

var _colors = _interopRequireDefault(require("./colors"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function ramp(range) {
  var n = range.length;
  return function (t) {
    return range[Math.max(0, Math.min(n - 1, Math.floor(t * n)))];
  };
}

var _default = ramp((0, _colors.default)("44015444025645045745055946075a46085c460a5d460b5e470d60470e6147106347116447136548146748166848176948186a481a6c481b6d481c6e481d6f481f70482071482173482374482475482576482677482878482979472a7a472c7a472d7b472e7c472f7d46307e46327e46337f463480453581453781453882443983443a83443b84433d84433e85423f854240864241864142874144874045884046883f47883f48893e49893e4a893e4c8a3d4d8a3d4e8a3c4f8a3c508b3b518b3b528b3a538b3a548c39558c39568c38588c38598c375a8c375b8d365c8d365d8d355e8d355f8d34608d34618d33628d33638d32648e32658e31668e31678e31688e30698e306a8e2f6b8e2f6c8e2e6d8e2e6e8e2e6f8e2d708e2d718e2c718e2c728e2c738e2b748e2b758e2a768e2a778e2a788e29798e297a8e297b8e287c8e287d8e277e8e277f8e27808e26818e26828e26828e25838e25848e25858e24868e24878e23888e23898e238a8d228b8d228c8d228d8d218e8d218f8d21908d21918c20928c20928c20938c1f948c1f958b1f968b1f978b1f988b1f998a1f9a8a1e9b8a1e9c891e9d891f9e891f9f881fa0881fa1881fa1871fa28720a38620a48621a58521a68522a78522a88423a98324aa8325ab8225ac8226ad8127ad8128ae8029af7f2ab07f2cb17e2db27d2eb37c2fb47c31b57b32b67a34b67935b77937b87838b9773aba763bbb753dbc743fbc7340bd7242be7144bf7046c06f48c16e4ac16d4cc26c4ec36b50c46a52c56954c56856c66758c7655ac8645cc8635ec96260ca6063cb5f65cb5e67cc5c69cd5b6ccd5a6ece5870cf5773d05675d05477d1537ad1517cd2507fd34e81d34d84d44b86d54989d5488bd6468ed64590d74393d74195d84098d83e9bd93c9dd93ba0da39a2da37a5db36a8db34aadc32addc30b0dd2fb2dd2db5de2bb8de29bade28bddf26c0df25c2df23c5e021c8e020cae11fcde11dd0e11cd2e21bd5e21ad8e219dae319dde318dfe318e2e418e5e419e7e419eae51aece51befe51cf1e51df4e61ef6e620f8e621fbe723fde725"));

exports.default = _default;
var magma = ramp((0, _colors.default)("00000401000501010601010802010902020b02020d03030f03031204041405041606051806051a07061c08071e0907200a08220b09240c09260d0a290e0b2b100b2d110c2f120d31130d34140e36150e38160f3b180f3d19103f1a10421c10441d11471e114920114b21114e22115024125325125527125829115a2a115c2c115f2d11612f116331116533106734106936106b38106c390f6e3b0f703d0f713f0f72400f74420f75440f764510774710784910784a10794c117a4e117b4f127b51127c52137c54137d56147d57157e59157e5a167e5c167f5d177f5f187f601880621980641a80651a80671b80681c816a1c816b1d816d1d816e1e81701f81721f817320817521817621817822817922827b23827c23827e24828025828125818326818426818627818827818928818b29818c29818e2a81902a81912b81932b80942c80962c80982d80992d809b2e7f9c2e7f9e2f7fa02f7fa1307ea3307ea5317ea6317da8327daa337dab337cad347cae347bb0357bb2357bb3367ab5367ab73779b83779ba3878bc3978bd3977bf3a77c03a76c23b75c43c75c53c74c73d73c83e73ca3e72cc3f71cd4071cf4070d0416fd2426fd3436ed5446dd6456cd8456cd9466bdb476adc4869de4968df4a68e04c67e24d66e34e65e44f64e55064e75263e85362e95462ea5661eb5760ec5860ed5a5fee5b5eef5d5ef05f5ef1605df2625df2645cf3655cf4675cf4695cf56b5cf66c5cf66e5cf7705cf7725cf8745cf8765cf9785df9795df97b5dfa7d5efa7f5efa815ffb835ffb8560fb8761fc8961fc8a62fc8c63fc8e64fc9065fd9266fd9467fd9668fd9869fd9a6afd9b6bfe9d6cfe9f6dfea16efea36ffea571fea772fea973feaa74feac76feae77feb078feb27afeb47bfeb67cfeb77efeb97ffebb81febd82febf84fec185fec287fec488fec68afec88cfeca8dfecc8ffecd90fecf92fed194fed395fed597fed799fed89afdda9cfddc9efddea0fde0a1fde2a3fde3a5fde5a7fde7a9fde9aafdebacfcecaefceeb0fcf0b2fcf2b4fcf4b6fcf6b8fcf7b9fcf9bbfcfbbdfcfdbf"));
exports.magma = magma;
var inferno = ramp((0, _colors.default)("00000401000501010601010802010a02020c02020e03021004031204031405041706041907051b08051d09061f0a07220b07240c08260d08290e092b10092d110a30120a32140b34150b37160b39180c3c190c3e1b0c411c0c431e0c451f0c48210c4a230c4c240c4f260c51280b53290b552b0b572d0b592f0a5b310a5c320a5e340a5f3609613809623909633b09643d09653e0966400a67420a68440a68450a69470b6a490b6a4a0c6b4c0c6b4d0d6c4f0d6c510e6c520e6d540f6d550f6d57106e59106e5a116e5c126e5d126e5f136e61136e62146e64156e65156e67166e69166e6a176e6c186e6d186e6f196e71196e721a6e741a6e751b6e771c6d781c6d7a1d6d7c1d6d7d1e6d7f1e6c801f6c82206c84206b85216b87216b88226a8a226a8c23698d23698f24699025689225689326679526679727669827669a28659b29649d29649f2a63a02a63a22b62a32c61a52c60a62d60a82e5fa92e5eab2f5ead305dae305cb0315bb1325ab3325ab43359b63458b73557b93556ba3655bc3754bd3853bf3952c03a51c13a50c33b4fc43c4ec63d4dc73e4cc83f4bca404acb4149cc4248ce4347cf4446d04545d24644d34743d44842d54a41d74b3fd84c3ed94d3dda4e3cdb503bdd513ade5238df5337e05536e15635e25734e35933e45a31e55c30e65d2fe75e2ee8602de9612bea632aeb6429eb6628ec6726ed6925ee6a24ef6c23ef6e21f06f20f1711ff1731df2741cf3761bf37819f47918f57b17f57d15f67e14f68013f78212f78410f8850ff8870ef8890cf98b0bf98c0af98e09fa9008fa9207fa9407fb9606fb9706fb9906fb9b06fb9d07fc9f07fca108fca309fca50afca60cfca80dfcaa0ffcac11fcae12fcb014fcb216fcb418fbb61afbb81dfbba1ffbbc21fbbe23fac026fac228fac42afac62df9c72ff9c932f9cb35f8cd37f8cf3af7d13df7d340f6d543f6d746f5d949f5db4cf4dd4ff4df53f4e156f3e35af3e55df2e661f2e865f2ea69f1ec6df1ed71f1ef75f1f179f2f27df2f482f3f586f3f68af4f88ef5f992f6fa96f8fb9af9fc9dfafda1fcffa4"));
exports.inferno = inferno;
var plasma = ramp((0, _colors.default)("0d088710078813078916078a19068c1b068d1d068e20068f2206902406912605912805922a05932c05942e05952f059631059733059735049837049938049a3a049a3c049b3e049c3f049c41049d43039e44039e46039f48039f4903a04b03a14c02a14e02a25002a25102a35302a35502a45601a45801a45901a55b01a55c01a65e01a66001a66100a76300a76400a76600a76700a86900a86a00a86c00a86e00a86f00a87100a87201a87401a87501a87701a87801a87a02a87b02a87d03a87e03a88004a88104a78305a78405a78606a68707a68808a68a09a58b0aa58d0ba58e0ca48f0da4910ea3920fa39410a29511a19613a19814a099159f9a169f9c179e9d189d9e199da01a9ca11b9ba21d9aa31e9aa51f99a62098a72197a82296aa2395ab2494ac2694ad2793ae2892b02991b12a90b22b8fb32c8eb42e8db52f8cb6308bb7318ab83289ba3388bb3488bc3587bd3786be3885bf3984c03a83c13b82c23c81c33d80c43e7fc5407ec6417dc7427cc8437bc9447aca457acb4679cc4778cc4977cd4a76ce4b75cf4c74d04d73d14e72d24f71d35171d45270d5536fd5546ed6556dd7566cd8576bd9586ada5a6ada5b69db5c68dc5d67dd5e66de5f65de6164df6263e06363e16462e26561e26660e3685fe4695ee56a5de56b5de66c5ce76e5be76f5ae87059e97158e97257ea7457eb7556eb7655ec7754ed7953ed7a52ee7b51ef7c51ef7e50f07f4ff0804ef1814df1834cf2844bf3854bf3874af48849f48948f58b47f58c46f68d45f68f44f79044f79143f79342f89441f89540f9973ff9983ef99a3efa9b3dfa9c3cfa9e3bfb9f3afba139fba238fca338fca537fca636fca835fca934fdab33fdac33fdae32fdaf31fdb130fdb22ffdb42ffdb52efeb72dfeb82cfeba2cfebb2bfebd2afebe2afec029fdc229fdc328fdc527fdc627fdc827fdca26fdcb26fccd25fcce25fcd025fcd225fbd324fbd524fbd724fad824fada24f9dc24f9dd25f8df25f8e125f7e225f7e425f6e626f6e826f5e926f5eb27f4ed27f3ee27f3f027f2f227f1f426f1f525f0f724f0f921"));
exports.plasma = plasma;

},{"./colors":131}],151:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = defaultLocale;
exports.utcParse = exports.utcFormat = exports.timeParse = exports.timeFormat = void 0;

var _locale = _interopRequireDefault(require("./locale.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var locale;
var timeFormat;
exports.timeFormat = timeFormat;
var timeParse;
exports.timeParse = timeParse;
var utcFormat;
exports.utcFormat = utcFormat;
var utcParse;
exports.utcParse = utcParse;
defaultLocale({
  dateTime: "%x, %X",
  date: "%-m/%-d/%Y",
  time: "%-I:%M:%S %p",
  periods: ["AM", "PM"],
  days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  shortDays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  shortMonths: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
});

function defaultLocale(definition) {
  locale = (0, _locale.default)(definition);
  exports.timeFormat = timeFormat = locale.format;
  exports.timeParse = timeParse = locale.parse;
  exports.utcFormat = utcFormat = locale.utcFormat;
  exports.utcParse = utcParse = locale.utcParse;
  return locale;
}

},{"./locale.js":155}],152:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "timeFormatDefaultLocale", {
  enumerable: true,
  get: function () {
    return _defaultLocale.default;
  }
});
Object.defineProperty(exports, "timeFormat", {
  enumerable: true,
  get: function () {
    return _defaultLocale.timeFormat;
  }
});
Object.defineProperty(exports, "timeParse", {
  enumerable: true,
  get: function () {
    return _defaultLocale.timeParse;
  }
});
Object.defineProperty(exports, "utcFormat", {
  enumerable: true,
  get: function () {
    return _defaultLocale.utcFormat;
  }
});
Object.defineProperty(exports, "utcParse", {
  enumerable: true,
  get: function () {
    return _defaultLocale.utcParse;
  }
});
Object.defineProperty(exports, "timeFormatLocale", {
  enumerable: true,
  get: function () {
    return _locale.default;
  }
});
Object.defineProperty(exports, "isoFormat", {
  enumerable: true,
  get: function () {
    return _isoFormat.default;
  }
});
Object.defineProperty(exports, "isoParse", {
  enumerable: true,
  get: function () {
    return _isoParse.default;
  }
});

var _defaultLocale = _interopRequireWildcard(require("./defaultLocale.js"));

var _locale = _interopRequireDefault(require("./locale.js"));

var _isoFormat = _interopRequireDefault(require("./isoFormat.js"));

var _isoParse = _interopRequireDefault(require("./isoParse.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

},{"./defaultLocale.js":151,"./isoFormat.js":153,"./isoParse.js":154,"./locale.js":155}],153:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.isoSpecifier = void 0;

var _defaultLocale = require("./defaultLocale.js");

var isoSpecifier = "%Y-%m-%dT%H:%M:%S.%LZ";
exports.isoSpecifier = isoSpecifier;

function formatIsoNative(date) {
  return date.toISOString();
}

var formatIso = Date.prototype.toISOString ? formatIsoNative : (0, _defaultLocale.utcFormat)(isoSpecifier);
var _default = formatIso;
exports.default = _default;

},{"./defaultLocale.js":151}],154:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _isoFormat = require("./isoFormat.js");

var _defaultLocale = require("./defaultLocale.js");

function parseIsoNative(string) {
  var date = new Date(string);
  return isNaN(date) ? null : date;
}

var parseIso = +new Date("2000-01-01T00:00:00.000Z") ? parseIsoNative : (0, _defaultLocale.utcParse)(_isoFormat.isoSpecifier);
var _default = parseIso;
exports.default = _default;

},{"./defaultLocale.js":151,"./isoFormat.js":153}],155:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = formatLocale;

var _d3Time = require("d3-time");

function localDate(d) {
  if (0 <= d.y && d.y < 100) {
    var date = new Date(-1, d.m, d.d, d.H, d.M, d.S, d.L);
    date.setFullYear(d.y);
    return date;
  }

  return new Date(d.y, d.m, d.d, d.H, d.M, d.S, d.L);
}

function utcDate(d) {
  if (0 <= d.y && d.y < 100) {
    var date = new Date(Date.UTC(-1, d.m, d.d, d.H, d.M, d.S, d.L));
    date.setUTCFullYear(d.y);
    return date;
  }

  return new Date(Date.UTC(d.y, d.m, d.d, d.H, d.M, d.S, d.L));
}

function newDate(y, m, d) {
  return {
    y: y,
    m: m,
    d: d,
    H: 0,
    M: 0,
    S: 0,
    L: 0
  };
}

function formatLocale(locale) {
  var locale_dateTime = locale.dateTime,
      locale_date = locale.date,
      locale_time = locale.time,
      locale_periods = locale.periods,
      locale_weekdays = locale.days,
      locale_shortWeekdays = locale.shortDays,
      locale_months = locale.months,
      locale_shortMonths = locale.shortMonths;
  var periodRe = formatRe(locale_periods),
      periodLookup = formatLookup(locale_periods),
      weekdayRe = formatRe(locale_weekdays),
      weekdayLookup = formatLookup(locale_weekdays),
      shortWeekdayRe = formatRe(locale_shortWeekdays),
      shortWeekdayLookup = formatLookup(locale_shortWeekdays),
      monthRe = formatRe(locale_months),
      monthLookup = formatLookup(locale_months),
      shortMonthRe = formatRe(locale_shortMonths),
      shortMonthLookup = formatLookup(locale_shortMonths);
  var formats = {
    "a": formatShortWeekday,
    "A": formatWeekday,
    "b": formatShortMonth,
    "B": formatMonth,
    "c": null,
    "d": formatDayOfMonth,
    "e": formatDayOfMonth,
    "f": formatMicroseconds,
    "g": formatYearISO,
    "G": formatFullYearISO,
    "H": formatHour24,
    "I": formatHour12,
    "j": formatDayOfYear,
    "L": formatMilliseconds,
    "m": formatMonthNumber,
    "M": formatMinutes,
    "p": formatPeriod,
    "q": formatQuarter,
    "Q": formatUnixTimestamp,
    "s": formatUnixTimestampSeconds,
    "S": formatSeconds,
    "u": formatWeekdayNumberMonday,
    "U": formatWeekNumberSunday,
    "V": formatWeekNumberISO,
    "w": formatWeekdayNumberSunday,
    "W": formatWeekNumberMonday,
    "x": null,
    "X": null,
    "y": formatYear,
    "Y": formatFullYear,
    "Z": formatZone,
    "%": formatLiteralPercent
  };
  var utcFormats = {
    "a": formatUTCShortWeekday,
    "A": formatUTCWeekday,
    "b": formatUTCShortMonth,
    "B": formatUTCMonth,
    "c": null,
    "d": formatUTCDayOfMonth,
    "e": formatUTCDayOfMonth,
    "f": formatUTCMicroseconds,
    "g": formatUTCYearISO,
    "G": formatUTCFullYearISO,
    "H": formatUTCHour24,
    "I": formatUTCHour12,
    "j": formatUTCDayOfYear,
    "L": formatUTCMilliseconds,
    "m": formatUTCMonthNumber,
    "M": formatUTCMinutes,
    "p": formatUTCPeriod,
    "q": formatUTCQuarter,
    "Q": formatUnixTimestamp,
    "s": formatUnixTimestampSeconds,
    "S": formatUTCSeconds,
    "u": formatUTCWeekdayNumberMonday,
    "U": formatUTCWeekNumberSunday,
    "V": formatUTCWeekNumberISO,
    "w": formatUTCWeekdayNumberSunday,
    "W": formatUTCWeekNumberMonday,
    "x": null,
    "X": null,
    "y": formatUTCYear,
    "Y": formatUTCFullYear,
    "Z": formatUTCZone,
    "%": formatLiteralPercent
  };
  var parses = {
    "a": parseShortWeekday,
    "A": parseWeekday,
    "b": parseShortMonth,
    "B": parseMonth,
    "c": parseLocaleDateTime,
    "d": parseDayOfMonth,
    "e": parseDayOfMonth,
    "f": parseMicroseconds,
    "g": parseYear,
    "G": parseFullYear,
    "H": parseHour24,
    "I": parseHour24,
    "j": parseDayOfYear,
    "L": parseMilliseconds,
    "m": parseMonthNumber,
    "M": parseMinutes,
    "p": parsePeriod,
    "q": parseQuarter,
    "Q": parseUnixTimestamp,
    "s": parseUnixTimestampSeconds,
    "S": parseSeconds,
    "u": parseWeekdayNumberMonday,
    "U": parseWeekNumberSunday,
    "V": parseWeekNumberISO,
    "w": parseWeekdayNumberSunday,
    "W": parseWeekNumberMonday,
    "x": parseLocaleDate,
    "X": parseLocaleTime,
    "y": parseYear,
    "Y": parseFullYear,
    "Z": parseZone,
    "%": parseLiteralPercent
  }; // These recursive directive definitions must be deferred.

  formats.x = newFormat(locale_date, formats);
  formats.X = newFormat(locale_time, formats);
  formats.c = newFormat(locale_dateTime, formats);
  utcFormats.x = newFormat(locale_date, utcFormats);
  utcFormats.X = newFormat(locale_time, utcFormats);
  utcFormats.c = newFormat(locale_dateTime, utcFormats);

  function newFormat(specifier, formats) {
    return function (date) {
      var string = [],
          i = -1,
          j = 0,
          n = specifier.length,
          c,
          pad,
          format;
      if (!(date instanceof Date)) date = new Date(+date);

      while (++i < n) {
        if (specifier.charCodeAt(i) === 37) {
          string.push(specifier.slice(j, i));
          if ((pad = pads[c = specifier.charAt(++i)]) != null) c = specifier.charAt(++i);else pad = c === "e" ? " " : "0";
          if (format = formats[c]) c = format(date, pad);
          string.push(c);
          j = i + 1;
        }
      }

      string.push(specifier.slice(j, i));
      return string.join("");
    };
  }

  function newParse(specifier, Z) {
    return function (string) {
      var d = newDate(1900, undefined, 1),
          i = parseSpecifier(d, specifier, string += "", 0),
          week,
          day;
      if (i != string.length) return null; // If a UNIX timestamp is specified, return it.

      if ("Q" in d) return new Date(d.Q);
      if ("s" in d) return new Date(d.s * 1000 + ("L" in d ? d.L : 0)); // If this is utcParse, never use the local timezone.

      if (Z && !("Z" in d)) d.Z = 0; // The am-pm flag is 0 for AM, and 1 for PM.

      if ("p" in d) d.H = d.H % 12 + d.p * 12; // If the month was not specified, inherit from the quarter.

      if (d.m === undefined) d.m = "q" in d ? d.q : 0; // Convert day-of-week and week-of-year to day-of-year.

      if ("V" in d) {
        if (d.V < 1 || d.V > 53) return null;
        if (!("w" in d)) d.w = 1;

        if ("Z" in d) {
          week = utcDate(newDate(d.y, 0, 1)), day = week.getUTCDay();
          week = day > 4 || day === 0 ? _d3Time.utcMonday.ceil(week) : (0, _d3Time.utcMonday)(week);
          week = _d3Time.utcDay.offset(week, (d.V - 1) * 7);
          d.y = week.getUTCFullYear();
          d.m = week.getUTCMonth();
          d.d = week.getUTCDate() + (d.w + 6) % 7;
        } else {
          week = localDate(newDate(d.y, 0, 1)), day = week.getDay();
          week = day > 4 || day === 0 ? _d3Time.timeMonday.ceil(week) : (0, _d3Time.timeMonday)(week);
          week = _d3Time.timeDay.offset(week, (d.V - 1) * 7);
          d.y = week.getFullYear();
          d.m = week.getMonth();
          d.d = week.getDate() + (d.w + 6) % 7;
        }
      } else if ("W" in d || "U" in d) {
        if (!("w" in d)) d.w = "u" in d ? d.u % 7 : "W" in d ? 1 : 0;
        day = "Z" in d ? utcDate(newDate(d.y, 0, 1)).getUTCDay() : localDate(newDate(d.y, 0, 1)).getDay();
        d.m = 0;
        d.d = "W" in d ? (d.w + 6) % 7 + d.W * 7 - (day + 5) % 7 : d.w + d.U * 7 - (day + 6) % 7;
      } // If a time zone is specified, all fields are interpreted as UTC and then
      // offset according to the specified time zone.


      if ("Z" in d) {
        d.H += d.Z / 100 | 0;
        d.M += d.Z % 100;
        return utcDate(d);
      } // Otherwise, all fields are in local time.


      return localDate(d);
    };
  }

  function parseSpecifier(d, specifier, string, j) {
    var i = 0,
        n = specifier.length,
        m = string.length,
        c,
        parse;

    while (i < n) {
      if (j >= m) return -1;
      c = specifier.charCodeAt(i++);

      if (c === 37) {
        c = specifier.charAt(i++);
        parse = parses[c in pads ? specifier.charAt(i++) : c];
        if (!parse || (j = parse(d, string, j)) < 0) return -1;
      } else if (c != string.charCodeAt(j++)) {
        return -1;
      }
    }

    return j;
  }

  function parsePeriod(d, string, i) {
    var n = periodRe.exec(string.slice(i));
    return n ? (d.p = periodLookup[n[0].toLowerCase()], i + n[0].length) : -1;
  }

  function parseShortWeekday(d, string, i) {
    var n = shortWeekdayRe.exec(string.slice(i));
    return n ? (d.w = shortWeekdayLookup[n[0].toLowerCase()], i + n[0].length) : -1;
  }

  function parseWeekday(d, string, i) {
    var n = weekdayRe.exec(string.slice(i));
    return n ? (d.w = weekdayLookup[n[0].toLowerCase()], i + n[0].length) : -1;
  }

  function parseShortMonth(d, string, i) {
    var n = shortMonthRe.exec(string.slice(i));
    return n ? (d.m = shortMonthLookup[n[0].toLowerCase()], i + n[0].length) : -1;
  }

  function parseMonth(d, string, i) {
    var n = monthRe.exec(string.slice(i));
    return n ? (d.m = monthLookup[n[0].toLowerCase()], i + n[0].length) : -1;
  }

  function parseLocaleDateTime(d, string, i) {
    return parseSpecifier(d, locale_dateTime, string, i);
  }

  function parseLocaleDate(d, string, i) {
    return parseSpecifier(d, locale_date, string, i);
  }

  function parseLocaleTime(d, string, i) {
    return parseSpecifier(d, locale_time, string, i);
  }

  function formatShortWeekday(d) {
    return locale_shortWeekdays[d.getDay()];
  }

  function formatWeekday(d) {
    return locale_weekdays[d.getDay()];
  }

  function formatShortMonth(d) {
    return locale_shortMonths[d.getMonth()];
  }

  function formatMonth(d) {
    return locale_months[d.getMonth()];
  }

  function formatPeriod(d) {
    return locale_periods[+(d.getHours() >= 12)];
  }

  function formatQuarter(d) {
    return 1 + ~~(d.getMonth() / 3);
  }

  function formatUTCShortWeekday(d) {
    return locale_shortWeekdays[d.getUTCDay()];
  }

  function formatUTCWeekday(d) {
    return locale_weekdays[d.getUTCDay()];
  }

  function formatUTCShortMonth(d) {
    return locale_shortMonths[d.getUTCMonth()];
  }

  function formatUTCMonth(d) {
    return locale_months[d.getUTCMonth()];
  }

  function formatUTCPeriod(d) {
    return locale_periods[+(d.getUTCHours() >= 12)];
  }

  function formatUTCQuarter(d) {
    return 1 + ~~(d.getUTCMonth() / 3);
  }

  return {
    format: function (specifier) {
      var f = newFormat(specifier += "", formats);

      f.toString = function () {
        return specifier;
      };

      return f;
    },
    parse: function (specifier) {
      var p = newParse(specifier += "", false);

      p.toString = function () {
        return specifier;
      };

      return p;
    },
    utcFormat: function (specifier) {
      var f = newFormat(specifier += "", utcFormats);

      f.toString = function () {
        return specifier;
      };

      return f;
    },
    utcParse: function (specifier) {
      var p = newParse(specifier += "", true);

      p.toString = function () {
        return specifier;
      };

      return p;
    }
  };
}

var pads = {
  "-": "",
  "_": " ",
  "0": "0"
},
    numberRe = /^\s*\d+/,
    // note: ignores next directive
percentRe = /^%/,
    requoteRe = /[\\^$*+?|[\]().{}]/g;

function pad(value, fill, width) {
  var sign = value < 0 ? "-" : "",
      string = (sign ? -value : value) + "",
      length = string.length;
  return sign + (length < width ? new Array(width - length + 1).join(fill) + string : string);
}

function requote(s) {
  return s.replace(requoteRe, "\\$&");
}

function formatRe(names) {
  return new RegExp("^(?:" + names.map(requote).join("|") + ")", "i");
}

function formatLookup(names) {
  var map = {},
      i = -1,
      n = names.length;

  while (++i < n) map[names[i].toLowerCase()] = i;

  return map;
}

function parseWeekdayNumberSunday(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 1));
  return n ? (d.w = +n[0], i + n[0].length) : -1;
}

function parseWeekdayNumberMonday(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 1));
  return n ? (d.u = +n[0], i + n[0].length) : -1;
}

function parseWeekNumberSunday(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.U = +n[0], i + n[0].length) : -1;
}

function parseWeekNumberISO(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.V = +n[0], i + n[0].length) : -1;
}

function parseWeekNumberMonday(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.W = +n[0], i + n[0].length) : -1;
}

function parseFullYear(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 4));
  return n ? (d.y = +n[0], i + n[0].length) : -1;
}

function parseYear(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.y = +n[0] + (+n[0] > 68 ? 1900 : 2000), i + n[0].length) : -1;
}

function parseZone(d, string, i) {
  var n = /^(Z)|([+-]\d\d)(?::?(\d\d))?/.exec(string.slice(i, i + 6));
  return n ? (d.Z = n[1] ? 0 : -(n[2] + (n[3] || "00")), i + n[0].length) : -1;
}

function parseQuarter(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 1));
  return n ? (d.q = n[0] * 3 - 3, i + n[0].length) : -1;
}

function parseMonthNumber(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.m = n[0] - 1, i + n[0].length) : -1;
}

function parseDayOfMonth(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.d = +n[0], i + n[0].length) : -1;
}

function parseDayOfYear(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 3));
  return n ? (d.m = 0, d.d = +n[0], i + n[0].length) : -1;
}

function parseHour24(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.H = +n[0], i + n[0].length) : -1;
}

function parseMinutes(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.M = +n[0], i + n[0].length) : -1;
}

function parseSeconds(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.S = +n[0], i + n[0].length) : -1;
}

function parseMilliseconds(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 3));
  return n ? (d.L = +n[0], i + n[0].length) : -1;
}

function parseMicroseconds(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 6));
  return n ? (d.L = Math.floor(n[0] / 1000), i + n[0].length) : -1;
}

function parseLiteralPercent(d, string, i) {
  var n = percentRe.exec(string.slice(i, i + 1));
  return n ? i + n[0].length : -1;
}

function parseUnixTimestamp(d, string, i) {
  var n = numberRe.exec(string.slice(i));
  return n ? (d.Q = +n[0], i + n[0].length) : -1;
}

function parseUnixTimestampSeconds(d, string, i) {
  var n = numberRe.exec(string.slice(i));
  return n ? (d.s = +n[0], i + n[0].length) : -1;
}

function formatDayOfMonth(d, p) {
  return pad(d.getDate(), p, 2);
}

function formatHour24(d, p) {
  return pad(d.getHours(), p, 2);
}

function formatHour12(d, p) {
  return pad(d.getHours() % 12 || 12, p, 2);
}

function formatDayOfYear(d, p) {
  return pad(1 + _d3Time.timeDay.count((0, _d3Time.timeYear)(d), d), p, 3);
}

function formatMilliseconds(d, p) {
  return pad(d.getMilliseconds(), p, 3);
}

function formatMicroseconds(d, p) {
  return formatMilliseconds(d, p) + "000";
}

function formatMonthNumber(d, p) {
  return pad(d.getMonth() + 1, p, 2);
}

function formatMinutes(d, p) {
  return pad(d.getMinutes(), p, 2);
}

function formatSeconds(d, p) {
  return pad(d.getSeconds(), p, 2);
}

function formatWeekdayNumberMonday(d) {
  var day = d.getDay();
  return day === 0 ? 7 : day;
}

function formatWeekNumberSunday(d, p) {
  return pad(_d3Time.timeSunday.count((0, _d3Time.timeYear)(d) - 1, d), p, 2);
}

function dISO(d) {
  var day = d.getDay();
  return day >= 4 || day === 0 ? (0, _d3Time.timeThursday)(d) : _d3Time.timeThursday.ceil(d);
}

function formatWeekNumberISO(d, p) {
  d = dISO(d);
  return pad(_d3Time.timeThursday.count((0, _d3Time.timeYear)(d), d) + ((0, _d3Time.timeYear)(d).getDay() === 4), p, 2);
}

function formatWeekdayNumberSunday(d) {
  return d.getDay();
}

function formatWeekNumberMonday(d, p) {
  return pad(_d3Time.timeMonday.count((0, _d3Time.timeYear)(d) - 1, d), p, 2);
}

function formatYear(d, p) {
  return pad(d.getFullYear() % 100, p, 2);
}

function formatYearISO(d, p) {
  d = dISO(d);
  return pad(d.getFullYear() % 100, p, 2);
}

function formatFullYear(d, p) {
  return pad(d.getFullYear() % 10000, p, 4);
}

function formatFullYearISO(d, p) {
  var day = d.getDay();
  d = day >= 4 || day === 0 ? (0, _d3Time.timeThursday)(d) : _d3Time.timeThursday.ceil(d);
  return pad(d.getFullYear() % 10000, p, 4);
}

function formatZone(d) {
  var z = d.getTimezoneOffset();
  return (z > 0 ? "-" : (z *= -1, "+")) + pad(z / 60 | 0, "0", 2) + pad(z % 60, "0", 2);
}

function formatUTCDayOfMonth(d, p) {
  return pad(d.getUTCDate(), p, 2);
}

function formatUTCHour24(d, p) {
  return pad(d.getUTCHours(), p, 2);
}

function formatUTCHour12(d, p) {
  return pad(d.getUTCHours() % 12 || 12, p, 2);
}

function formatUTCDayOfYear(d, p) {
  return pad(1 + _d3Time.utcDay.count((0, _d3Time.utcYear)(d), d), p, 3);
}

function formatUTCMilliseconds(d, p) {
  return pad(d.getUTCMilliseconds(), p, 3);
}

function formatUTCMicroseconds(d, p) {
  return formatUTCMilliseconds(d, p) + "000";
}

function formatUTCMonthNumber(d, p) {
  return pad(d.getUTCMonth() + 1, p, 2);
}

function formatUTCMinutes(d, p) {
  return pad(d.getUTCMinutes(), p, 2);
}

function formatUTCSeconds(d, p) {
  return pad(d.getUTCSeconds(), p, 2);
}

function formatUTCWeekdayNumberMonday(d) {
  var dow = d.getUTCDay();
  return dow === 0 ? 7 : dow;
}

function formatUTCWeekNumberSunday(d, p) {
  return pad(_d3Time.utcSunday.count((0, _d3Time.utcYear)(d) - 1, d), p, 2);
}

function UTCdISO(d) {
  var day = d.getUTCDay();
  return day >= 4 || day === 0 ? (0, _d3Time.utcThursday)(d) : _d3Time.utcThursday.ceil(d);
}

function formatUTCWeekNumberISO(d, p) {
  d = UTCdISO(d);
  return pad(_d3Time.utcThursday.count((0, _d3Time.utcYear)(d), d) + ((0, _d3Time.utcYear)(d).getUTCDay() === 4), p, 2);
}

function formatUTCWeekdayNumberSunday(d) {
  return d.getUTCDay();
}

function formatUTCWeekNumberMonday(d, p) {
  return pad(_d3Time.utcMonday.count((0, _d3Time.utcYear)(d) - 1, d), p, 2);
}

function formatUTCYear(d, p) {
  return pad(d.getUTCFullYear() % 100, p, 2);
}

function formatUTCYearISO(d, p) {
  d = UTCdISO(d);
  return pad(d.getUTCFullYear() % 100, p, 2);
}

function formatUTCFullYear(d, p) {
  return pad(d.getUTCFullYear() % 10000, p, 4);
}

function formatUTCFullYearISO(d, p) {
  var day = d.getUTCDay();
  d = day >= 4 || day === 0 ? (0, _d3Time.utcThursday)(d) : _d3Time.utcThursday.ceil(d);
  return pad(d.getUTCFullYear() % 10000, p, 4);
}

function formatUTCZone() {
  return "+0000";
}

function formatLiteralPercent() {
  return "%";
}

function formatUnixTimestamp(d) {
  return +d;
}

function formatUnixTimestampSeconds(d) {
  return Math.floor(+d / 1000);
}

},{"d3-time":159}],156:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.days = exports.default = void 0;

var _interval = _interopRequireDefault(require("./interval.js"));

var _duration = require("./duration.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var day = (0, _interval.default)(function (date) {
  date.setHours(0, 0, 0, 0);
}, function (date, step) {
  date.setDate(date.getDate() + step);
}, function (start, end) {
  return (end - start - (end.getTimezoneOffset() - start.getTimezoneOffset()) * _duration.durationMinute) / _duration.durationDay;
}, function (date) {
  return date.getDate() - 1;
});
var _default = day;
exports.default = _default;
var days = day.range;
exports.days = days;

},{"./duration.js":157,"./interval.js":160}],157:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.durationWeek = exports.durationDay = exports.durationHour = exports.durationMinute = exports.durationSecond = void 0;
var durationSecond = 1e3;
exports.durationSecond = durationSecond;
var durationMinute = 6e4;
exports.durationMinute = durationMinute;
var durationHour = 36e5;
exports.durationHour = durationHour;
var durationDay = 864e5;
exports.durationDay = durationDay;
var durationWeek = 6048e5;
exports.durationWeek = durationWeek;

},{}],158:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.hours = exports.default = void 0;

var _interval = _interopRequireDefault(require("./interval.js"));

var _duration = require("./duration.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var hour = (0, _interval.default)(function (date) {
  date.setTime(date - date.getMilliseconds() - date.getSeconds() * _duration.durationSecond - date.getMinutes() * _duration.durationMinute);
}, function (date, step) {
  date.setTime(+date + step * _duration.durationHour);
}, function (start, end) {
  return (end - start) / _duration.durationHour;
}, function (date) {
  return date.getHours();
});
var _default = hour;
exports.default = _default;
var hours = hour.range;
exports.hours = hours;

},{"./duration.js":157,"./interval.js":160}],159:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "timeInterval", {
  enumerable: true,
  get: function () {
    return _interval.default;
  }
});
Object.defineProperty(exports, "timeMillisecond", {
  enumerable: true,
  get: function () {
    return _millisecond.default;
  }
});
Object.defineProperty(exports, "timeMilliseconds", {
  enumerable: true,
  get: function () {
    return _millisecond.milliseconds;
  }
});
Object.defineProperty(exports, "utcMillisecond", {
  enumerable: true,
  get: function () {
    return _millisecond.default;
  }
});
Object.defineProperty(exports, "utcMilliseconds", {
  enumerable: true,
  get: function () {
    return _millisecond.milliseconds;
  }
});
Object.defineProperty(exports, "timeSecond", {
  enumerable: true,
  get: function () {
    return _second.default;
  }
});
Object.defineProperty(exports, "timeSeconds", {
  enumerable: true,
  get: function () {
    return _second.seconds;
  }
});
Object.defineProperty(exports, "utcSecond", {
  enumerable: true,
  get: function () {
    return _second.default;
  }
});
Object.defineProperty(exports, "utcSeconds", {
  enumerable: true,
  get: function () {
    return _second.seconds;
  }
});
Object.defineProperty(exports, "timeMinute", {
  enumerable: true,
  get: function () {
    return _minute.default;
  }
});
Object.defineProperty(exports, "timeMinutes", {
  enumerable: true,
  get: function () {
    return _minute.minutes;
  }
});
Object.defineProperty(exports, "timeHour", {
  enumerable: true,
  get: function () {
    return _hour.default;
  }
});
Object.defineProperty(exports, "timeHours", {
  enumerable: true,
  get: function () {
    return _hour.hours;
  }
});
Object.defineProperty(exports, "timeDay", {
  enumerable: true,
  get: function () {
    return _day.default;
  }
});
Object.defineProperty(exports, "timeDays", {
  enumerable: true,
  get: function () {
    return _day.days;
  }
});
Object.defineProperty(exports, "timeWeek", {
  enumerable: true,
  get: function () {
    return _week.sunday;
  }
});
Object.defineProperty(exports, "timeWeeks", {
  enumerable: true,
  get: function () {
    return _week.sundays;
  }
});
Object.defineProperty(exports, "timeSunday", {
  enumerable: true,
  get: function () {
    return _week.sunday;
  }
});
Object.defineProperty(exports, "timeSundays", {
  enumerable: true,
  get: function () {
    return _week.sundays;
  }
});
Object.defineProperty(exports, "timeMonday", {
  enumerable: true,
  get: function () {
    return _week.monday;
  }
});
Object.defineProperty(exports, "timeMondays", {
  enumerable: true,
  get: function () {
    return _week.mondays;
  }
});
Object.defineProperty(exports, "timeTuesday", {
  enumerable: true,
  get: function () {
    return _week.tuesday;
  }
});
Object.defineProperty(exports, "timeTuesdays", {
  enumerable: true,
  get: function () {
    return _week.tuesdays;
  }
});
Object.defineProperty(exports, "timeWednesday", {
  enumerable: true,
  get: function () {
    return _week.wednesday;
  }
});
Object.defineProperty(exports, "timeWednesdays", {
  enumerable: true,
  get: function () {
    return _week.wednesdays;
  }
});
Object.defineProperty(exports, "timeThursday", {
  enumerable: true,
  get: function () {
    return _week.thursday;
  }
});
Object.defineProperty(exports, "timeThursdays", {
  enumerable: true,
  get: function () {
    return _week.thursdays;
  }
});
Object.defineProperty(exports, "timeFriday", {
  enumerable: true,
  get: function () {
    return _week.friday;
  }
});
Object.defineProperty(exports, "timeFridays", {
  enumerable: true,
  get: function () {
    return _week.fridays;
  }
});
Object.defineProperty(exports, "timeSaturday", {
  enumerable: true,
  get: function () {
    return _week.saturday;
  }
});
Object.defineProperty(exports, "timeSaturdays", {
  enumerable: true,
  get: function () {
    return _week.saturdays;
  }
});
Object.defineProperty(exports, "timeMonth", {
  enumerable: true,
  get: function () {
    return _month.default;
  }
});
Object.defineProperty(exports, "timeMonths", {
  enumerable: true,
  get: function () {
    return _month.months;
  }
});
Object.defineProperty(exports, "timeYear", {
  enumerable: true,
  get: function () {
    return _year.default;
  }
});
Object.defineProperty(exports, "timeYears", {
  enumerable: true,
  get: function () {
    return _year.years;
  }
});
Object.defineProperty(exports, "utcMinute", {
  enumerable: true,
  get: function () {
    return _utcMinute.default;
  }
});
Object.defineProperty(exports, "utcMinutes", {
  enumerable: true,
  get: function () {
    return _utcMinute.utcMinutes;
  }
});
Object.defineProperty(exports, "utcHour", {
  enumerable: true,
  get: function () {
    return _utcHour.default;
  }
});
Object.defineProperty(exports, "utcHours", {
  enumerable: true,
  get: function () {
    return _utcHour.utcHours;
  }
});
Object.defineProperty(exports, "utcDay", {
  enumerable: true,
  get: function () {
    return _utcDay.default;
  }
});
Object.defineProperty(exports, "utcDays", {
  enumerable: true,
  get: function () {
    return _utcDay.utcDays;
  }
});
Object.defineProperty(exports, "utcWeek", {
  enumerable: true,
  get: function () {
    return _utcWeek.utcSunday;
  }
});
Object.defineProperty(exports, "utcWeeks", {
  enumerable: true,
  get: function () {
    return _utcWeek.utcSundays;
  }
});
Object.defineProperty(exports, "utcSunday", {
  enumerable: true,
  get: function () {
    return _utcWeek.utcSunday;
  }
});
Object.defineProperty(exports, "utcSundays", {
  enumerable: true,
  get: function () {
    return _utcWeek.utcSundays;
  }
});
Object.defineProperty(exports, "utcMonday", {
  enumerable: true,
  get: function () {
    return _utcWeek.utcMonday;
  }
});
Object.defineProperty(exports, "utcMondays", {
  enumerable: true,
  get: function () {
    return _utcWeek.utcMondays;
  }
});
Object.defineProperty(exports, "utcTuesday", {
  enumerable: true,
  get: function () {
    return _utcWeek.utcTuesday;
  }
});
Object.defineProperty(exports, "utcTuesdays", {
  enumerable: true,
  get: function () {
    return _utcWeek.utcTuesdays;
  }
});
Object.defineProperty(exports, "utcWednesday", {
  enumerable: true,
  get: function () {
    return _utcWeek.utcWednesday;
  }
});
Object.defineProperty(exports, "utcWednesdays", {
  enumerable: true,
  get: function () {
    return _utcWeek.utcWednesdays;
  }
});
Object.defineProperty(exports, "utcThursday", {
  enumerable: true,
  get: function () {
    return _utcWeek.utcThursday;
  }
});
Object.defineProperty(exports, "utcThursdays", {
  enumerable: true,
  get: function () {
    return _utcWeek.utcThursdays;
  }
});
Object.defineProperty(exports, "utcFriday", {
  enumerable: true,
  get: function () {
    return _utcWeek.utcFriday;
  }
});
Object.defineProperty(exports, "utcFridays", {
  enumerable: true,
  get: function () {
    return _utcWeek.utcFridays;
  }
});
Object.defineProperty(exports, "utcSaturday", {
  enumerable: true,
  get: function () {
    return _utcWeek.utcSaturday;
  }
});
Object.defineProperty(exports, "utcSaturdays", {
  enumerable: true,
  get: function () {
    return _utcWeek.utcSaturdays;
  }
});
Object.defineProperty(exports, "utcMonth", {
  enumerable: true,
  get: function () {
    return _utcMonth.default;
  }
});
Object.defineProperty(exports, "utcMonths", {
  enumerable: true,
  get: function () {
    return _utcMonth.utcMonths;
  }
});
Object.defineProperty(exports, "utcYear", {
  enumerable: true,
  get: function () {
    return _utcYear.default;
  }
});
Object.defineProperty(exports, "utcYears", {
  enumerable: true,
  get: function () {
    return _utcYear.utcYears;
  }
});

var _interval = _interopRequireDefault(require("./interval.js"));

var _millisecond = _interopRequireWildcard(require("./millisecond.js"));

var _second = _interopRequireWildcard(require("./second.js"));

var _minute = _interopRequireWildcard(require("./minute.js"));

var _hour = _interopRequireWildcard(require("./hour.js"));

var _day = _interopRequireWildcard(require("./day.js"));

var _week = require("./week.js");

var _month = _interopRequireWildcard(require("./month.js"));

var _year = _interopRequireWildcard(require("./year.js"));

var _utcMinute = _interopRequireWildcard(require("./utcMinute.js"));

var _utcHour = _interopRequireWildcard(require("./utcHour.js"));

var _utcDay = _interopRequireWildcard(require("./utcDay.js"));

var _utcWeek = require("./utcWeek.js");

var _utcMonth = _interopRequireWildcard(require("./utcMonth.js"));

var _utcYear = _interopRequireWildcard(require("./utcYear.js"));

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

},{"./day.js":156,"./hour.js":158,"./interval.js":160,"./millisecond.js":161,"./minute.js":162,"./month.js":163,"./second.js":164,"./utcDay.js":165,"./utcHour.js":166,"./utcMinute.js":167,"./utcMonth.js":168,"./utcWeek.js":169,"./utcYear.js":170,"./week.js":171,"./year.js":172}],160:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = newInterval;
var t0 = new Date(),
    t1 = new Date();

function newInterval(floori, offseti, count, field) {
  function interval(date) {
    return floori(date = arguments.length === 0 ? new Date() : new Date(+date)), date;
  }

  interval.floor = function (date) {
    return floori(date = new Date(+date)), date;
  };

  interval.ceil = function (date) {
    return floori(date = new Date(date - 1)), offseti(date, 1), floori(date), date;
  };

  interval.round = function (date) {
    var d0 = interval(date),
        d1 = interval.ceil(date);
    return date - d0 < d1 - date ? d0 : d1;
  };

  interval.offset = function (date, step) {
    return offseti(date = new Date(+date), step == null ? 1 : Math.floor(step)), date;
  };

  interval.range = function (start, stop, step) {
    var range = [],
        previous;
    start = interval.ceil(start);
    step = step == null ? 1 : Math.floor(step);
    if (!(start < stop) || !(step > 0)) return range; // also handles Invalid Date

    do range.push(previous = new Date(+start)), offseti(start, step), floori(start); while (previous < start && start < stop);

    return range;
  };

  interval.filter = function (test) {
    return newInterval(function (date) {
      if (date >= date) while (floori(date), !test(date)) date.setTime(date - 1);
    }, function (date, step) {
      if (date >= date) {
        if (step < 0) while (++step <= 0) {
          while (offseti(date, -1), !test(date)) {} // eslint-disable-line no-empty

        } else while (--step >= 0) {
          while (offseti(date, +1), !test(date)) {} // eslint-disable-line no-empty

        }
      }
    });
  };

  if (count) {
    interval.count = function (start, end) {
      t0.setTime(+start), t1.setTime(+end);
      floori(t0), floori(t1);
      return Math.floor(count(t0, t1));
    };

    interval.every = function (step) {
      step = Math.floor(step);
      return !isFinite(step) || !(step > 0) ? null : !(step > 1) ? interval : interval.filter(field ? function (d) {
        return field(d) % step === 0;
      } : function (d) {
        return interval.count(0, d) % step === 0;
      });
    };
  }

  return interval;
}

},{}],161:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.milliseconds = exports.default = void 0;

var _interval = _interopRequireDefault(require("./interval.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var millisecond = (0, _interval.default)(function () {// noop
}, function (date, step) {
  date.setTime(+date + step);
}, function (start, end) {
  return end - start;
}); // An optimized implementation for this simple case.

millisecond.every = function (k) {
  k = Math.floor(k);
  if (!isFinite(k) || !(k > 0)) return null;
  if (!(k > 1)) return millisecond;
  return (0, _interval.default)(function (date) {
    date.setTime(Math.floor(date / k) * k);
  }, function (date, step) {
    date.setTime(+date + step * k);
  }, function (start, end) {
    return (end - start) / k;
  });
};

var _default = millisecond;
exports.default = _default;
var milliseconds = millisecond.range;
exports.milliseconds = milliseconds;

},{"./interval.js":160}],162:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.minutes = exports.default = void 0;

var _interval = _interopRequireDefault(require("./interval.js"));

var _duration = require("./duration.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var minute = (0, _interval.default)(function (date) {
  date.setTime(date - date.getMilliseconds() - date.getSeconds() * _duration.durationSecond);
}, function (date, step) {
  date.setTime(+date + step * _duration.durationMinute);
}, function (start, end) {
  return (end - start) / _duration.durationMinute;
}, function (date) {
  return date.getMinutes();
});
var _default = minute;
exports.default = _default;
var minutes = minute.range;
exports.minutes = minutes;

},{"./duration.js":157,"./interval.js":160}],163:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.months = exports.default = void 0;

var _interval = _interopRequireDefault(require("./interval.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var month = (0, _interval.default)(function (date) {
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
}, function (date, step) {
  date.setMonth(date.getMonth() + step);
}, function (start, end) {
  return end.getMonth() - start.getMonth() + (end.getFullYear() - start.getFullYear()) * 12;
}, function (date) {
  return date.getMonth();
});
var _default = month;
exports.default = _default;
var months = month.range;
exports.months = months;

},{"./interval.js":160}],164:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.seconds = exports.default = void 0;

var _interval = _interopRequireDefault(require("./interval.js"));

var _duration = require("./duration.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var second = (0, _interval.default)(function (date) {
  date.setTime(date - date.getMilliseconds());
}, function (date, step) {
  date.setTime(+date + step * _duration.durationSecond);
}, function (start, end) {
  return (end - start) / _duration.durationSecond;
}, function (date) {
  return date.getUTCSeconds();
});
var _default = second;
exports.default = _default;
var seconds = second.range;
exports.seconds = seconds;

},{"./duration.js":157,"./interval.js":160}],165:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.utcDays = exports.default = void 0;

var _interval = _interopRequireDefault(require("./interval.js"));

var _duration = require("./duration.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var utcDay = (0, _interval.default)(function (date) {
  date.setUTCHours(0, 0, 0, 0);
}, function (date, step) {
  date.setUTCDate(date.getUTCDate() + step);
}, function (start, end) {
  return (end - start) / _duration.durationDay;
}, function (date) {
  return date.getUTCDate() - 1;
});
var _default = utcDay;
exports.default = _default;
var utcDays = utcDay.range;
exports.utcDays = utcDays;

},{"./duration.js":157,"./interval.js":160}],166:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.utcHours = exports.default = void 0;

var _interval = _interopRequireDefault(require("./interval.js"));

var _duration = require("./duration.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var utcHour = (0, _interval.default)(function (date) {
  date.setUTCMinutes(0, 0, 0);
}, function (date, step) {
  date.setTime(+date + step * _duration.durationHour);
}, function (start, end) {
  return (end - start) / _duration.durationHour;
}, function (date) {
  return date.getUTCHours();
});
var _default = utcHour;
exports.default = _default;
var utcHours = utcHour.range;
exports.utcHours = utcHours;

},{"./duration.js":157,"./interval.js":160}],167:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.utcMinutes = exports.default = void 0;

var _interval = _interopRequireDefault(require("./interval.js"));

var _duration = require("./duration.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var utcMinute = (0, _interval.default)(function (date) {
  date.setUTCSeconds(0, 0);
}, function (date, step) {
  date.setTime(+date + step * _duration.durationMinute);
}, function (start, end) {
  return (end - start) / _duration.durationMinute;
}, function (date) {
  return date.getUTCMinutes();
});
var _default = utcMinute;
exports.default = _default;
var utcMinutes = utcMinute.range;
exports.utcMinutes = utcMinutes;

},{"./duration.js":157,"./interval.js":160}],168:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.utcMonths = exports.default = void 0;

var _interval = _interopRequireDefault(require("./interval.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var utcMonth = (0, _interval.default)(function (date) {
  date.setUTCDate(1);
  date.setUTCHours(0, 0, 0, 0);
}, function (date, step) {
  date.setUTCMonth(date.getUTCMonth() + step);
}, function (start, end) {
  return end.getUTCMonth() - start.getUTCMonth() + (end.getUTCFullYear() - start.getUTCFullYear()) * 12;
}, function (date) {
  return date.getUTCMonth();
});
var _default = utcMonth;
exports.default = _default;
var utcMonths = utcMonth.range;
exports.utcMonths = utcMonths;

},{"./interval.js":160}],169:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.utcSaturdays = exports.utcFridays = exports.utcThursdays = exports.utcWednesdays = exports.utcTuesdays = exports.utcMondays = exports.utcSundays = exports.utcSaturday = exports.utcFriday = exports.utcThursday = exports.utcWednesday = exports.utcTuesday = exports.utcMonday = exports.utcSunday = void 0;

var _interval = _interopRequireDefault(require("./interval.js"));

var _duration = require("./duration.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function utcWeekday(i) {
  return (0, _interval.default)(function (date) {
    date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 7 - i) % 7);
    date.setUTCHours(0, 0, 0, 0);
  }, function (date, step) {
    date.setUTCDate(date.getUTCDate() + step * 7);
  }, function (start, end) {
    return (end - start) / _duration.durationWeek;
  });
}

var utcSunday = utcWeekday(0);
exports.utcSunday = utcSunday;
var utcMonday = utcWeekday(1);
exports.utcMonday = utcMonday;
var utcTuesday = utcWeekday(2);
exports.utcTuesday = utcTuesday;
var utcWednesday = utcWeekday(3);
exports.utcWednesday = utcWednesday;
var utcThursday = utcWeekday(4);
exports.utcThursday = utcThursday;
var utcFriday = utcWeekday(5);
exports.utcFriday = utcFriday;
var utcSaturday = utcWeekday(6);
exports.utcSaturday = utcSaturday;
var utcSundays = utcSunday.range;
exports.utcSundays = utcSundays;
var utcMondays = utcMonday.range;
exports.utcMondays = utcMondays;
var utcTuesdays = utcTuesday.range;
exports.utcTuesdays = utcTuesdays;
var utcWednesdays = utcWednesday.range;
exports.utcWednesdays = utcWednesdays;
var utcThursdays = utcThursday.range;
exports.utcThursdays = utcThursdays;
var utcFridays = utcFriday.range;
exports.utcFridays = utcFridays;
var utcSaturdays = utcSaturday.range;
exports.utcSaturdays = utcSaturdays;

},{"./duration.js":157,"./interval.js":160}],170:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.utcYears = exports.default = void 0;

var _interval = _interopRequireDefault(require("./interval.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var utcYear = (0, _interval.default)(function (date) {
  date.setUTCMonth(0, 1);
  date.setUTCHours(0, 0, 0, 0);
}, function (date, step) {
  date.setUTCFullYear(date.getUTCFullYear() + step);
}, function (start, end) {
  return end.getUTCFullYear() - start.getUTCFullYear();
}, function (date) {
  return date.getUTCFullYear();
}); // An optimized implementation for this simple case.

utcYear.every = function (k) {
  return !isFinite(k = Math.floor(k)) || !(k > 0) ? null : (0, _interval.default)(function (date) {
    date.setUTCFullYear(Math.floor(date.getUTCFullYear() / k) * k);
    date.setUTCMonth(0, 1);
    date.setUTCHours(0, 0, 0, 0);
  }, function (date, step) {
    date.setUTCFullYear(date.getUTCFullYear() + step * k);
  });
};

var _default = utcYear;
exports.default = _default;
var utcYears = utcYear.range;
exports.utcYears = utcYears;

},{"./interval.js":160}],171:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.saturdays = exports.fridays = exports.thursdays = exports.wednesdays = exports.tuesdays = exports.mondays = exports.sundays = exports.saturday = exports.friday = exports.thursday = exports.wednesday = exports.tuesday = exports.monday = exports.sunday = void 0;

var _interval = _interopRequireDefault(require("./interval.js"));

var _duration = require("./duration.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function weekday(i) {
  return (0, _interval.default)(function (date) {
    date.setDate(date.getDate() - (date.getDay() + 7 - i) % 7);
    date.setHours(0, 0, 0, 0);
  }, function (date, step) {
    date.setDate(date.getDate() + step * 7);
  }, function (start, end) {
    return (end - start - (end.getTimezoneOffset() - start.getTimezoneOffset()) * _duration.durationMinute) / _duration.durationWeek;
  });
}

var sunday = weekday(0);
exports.sunday = sunday;
var monday = weekday(1);
exports.monday = monday;
var tuesday = weekday(2);
exports.tuesday = tuesday;
var wednesday = weekday(3);
exports.wednesday = wednesday;
var thursday = weekday(4);
exports.thursday = thursday;
var friday = weekday(5);
exports.friday = friday;
var saturday = weekday(6);
exports.saturday = saturday;
var sundays = sunday.range;
exports.sundays = sundays;
var mondays = monday.range;
exports.mondays = mondays;
var tuesdays = tuesday.range;
exports.tuesdays = tuesdays;
var wednesdays = wednesday.range;
exports.wednesdays = wednesdays;
var thursdays = thursday.range;
exports.thursdays = thursdays;
var fridays = friday.range;
exports.fridays = fridays;
var saturdays = saturday.range;
exports.saturdays = saturdays;

},{"./duration.js":157,"./interval.js":160}],172:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.years = exports.default = void 0;

var _interval = _interopRequireDefault(require("./interval.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var year = (0, _interval.default)(function (date) {
  date.setMonth(0, 1);
  date.setHours(0, 0, 0, 0);
}, function (date, step) {
  date.setFullYear(date.getFullYear() + step);
}, function (start, end) {
  return end.getFullYear() - start.getFullYear();
}, function (date) {
  return date.getFullYear();
}); // An optimized implementation for this simple case.

year.every = function (k) {
  return !isFinite(k = Math.floor(k)) || !(k > 0) ? null : (0, _interval.default)(function (date) {
    date.setFullYear(Math.floor(date.getFullYear() / k) * k);
    date.setMonth(0, 1);
    date.setHours(0, 0, 0, 0);
  }, function (date, step) {
    date.setFullYear(date.getFullYear() + step * k);
  });
};

var _default = year;
exports.default = _default;
var years = year.range;
exports.years = years;

},{"./interval.js":160}],173:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
const EPSILON = Math.pow(2, -52);
const EDGE_STACK = new Uint32Array(512);

class Delaunator {
  static from(points, getX = defaultGetX, getY = defaultGetY) {
    const n = points.length;
    const coords = new Float64Array(n * 2);

    for (let i = 0; i < n; i++) {
      const p = points[i];
      coords[2 * i] = getX(p);
      coords[2 * i + 1] = getY(p);
    }

    return new Delaunator(coords);
  }

  constructor(coords) {
    const n = coords.length >> 1;
    if (n > 0 && typeof coords[0] !== 'number') throw new Error('Expected coords to contain numbers.');
    this.coords = coords; // arrays that will store the triangulation graph

    const maxTriangles = Math.max(2 * n - 5, 0);
    this._triangles = new Uint32Array(maxTriangles * 3);
    this._halfedges = new Int32Array(maxTriangles * 3); // temporary arrays for tracking the edges of the advancing convex hull

    this._hashSize = Math.ceil(Math.sqrt(n));
    this._hullPrev = new Uint32Array(n); // edge to prev edge

    this._hullNext = new Uint32Array(n); // edge to next edge

    this._hullTri = new Uint32Array(n); // edge to adjacent triangle

    this._hullHash = new Int32Array(this._hashSize).fill(-1); // angular edge hash
    // temporary arrays for sorting points

    this._ids = new Uint32Array(n);
    this._dists = new Float64Array(n);
    this.update();
  }

  update() {
    const {
      coords,
      _hullPrev: hullPrev,
      _hullNext: hullNext,
      _hullTri: hullTri,
      _hullHash: hullHash
    } = this;
    const n = coords.length >> 1; // populate an array of point indices; calculate input data bbox

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (let i = 0; i < n; i++) {
      const x = coords[2 * i];
      const y = coords[2 * i + 1];
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      this._ids[i] = i;
    }

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    let minDist = Infinity;
    let i0, i1, i2; // pick a seed point close to the center

    for (let i = 0; i < n; i++) {
      const d = dist(cx, cy, coords[2 * i], coords[2 * i + 1]);

      if (d < minDist) {
        i0 = i;
        minDist = d;
      }
    }

    const i0x = coords[2 * i0];
    const i0y = coords[2 * i0 + 1];
    minDist = Infinity; // find the point closest to the seed

    for (let i = 0; i < n; i++) {
      if (i === i0) continue;
      const d = dist(i0x, i0y, coords[2 * i], coords[2 * i + 1]);

      if (d < minDist && d > 0) {
        i1 = i;
        minDist = d;
      }
    }

    let i1x = coords[2 * i1];
    let i1y = coords[2 * i1 + 1];
    let minRadius = Infinity; // find the third point which forms the smallest circumcircle with the first two

    for (let i = 0; i < n; i++) {
      if (i === i0 || i === i1) continue;
      const r = circumradius(i0x, i0y, i1x, i1y, coords[2 * i], coords[2 * i + 1]);

      if (r < minRadius) {
        i2 = i;
        minRadius = r;
      }
    }

    let i2x = coords[2 * i2];
    let i2y = coords[2 * i2 + 1];

    if (minRadius === Infinity) {
      // order collinear points by dx (or dy if all x are identical)
      // and return the list as a hull
      for (let i = 0; i < n; i++) {
        this._dists[i] = coords[2 * i] - coords[0] || coords[2 * i + 1] - coords[1];
      }

      quicksort(this._ids, this._dists, 0, n - 1);
      const hull = new Uint32Array(n);
      let j = 0;

      for (let i = 0, d0 = -Infinity; i < n; i++) {
        const id = this._ids[i];

        if (this._dists[id] > d0) {
          hull[j++] = id;
          d0 = this._dists[id];
        }
      }

      this.hull = hull.subarray(0, j);
      this.triangles = new Uint32Array(0);
      this.halfedges = new Uint32Array(0);
      return;
    } // swap the order of the seed points for counter-clockwise orientation


    if (orient(i0x, i0y, i1x, i1y, i2x, i2y)) {
      const i = i1;
      const x = i1x;
      const y = i1y;
      i1 = i2;
      i1x = i2x;
      i1y = i2y;
      i2 = i;
      i2x = x;
      i2y = y;
    }

    const center = circumcenter(i0x, i0y, i1x, i1y, i2x, i2y);
    this._cx = center.x;
    this._cy = center.y;

    for (let i = 0; i < n; i++) {
      this._dists[i] = dist(coords[2 * i], coords[2 * i + 1], center.x, center.y);
    } // sort the points by distance from the seed triangle circumcenter


    quicksort(this._ids, this._dists, 0, n - 1); // set up the seed triangle as the starting hull

    this._hullStart = i0;
    let hullSize = 3;
    hullNext[i0] = hullPrev[i2] = i1;
    hullNext[i1] = hullPrev[i0] = i2;
    hullNext[i2] = hullPrev[i1] = i0;
    hullTri[i0] = 0;
    hullTri[i1] = 1;
    hullTri[i2] = 2;
    hullHash.fill(-1);
    hullHash[this._hashKey(i0x, i0y)] = i0;
    hullHash[this._hashKey(i1x, i1y)] = i1;
    hullHash[this._hashKey(i2x, i2y)] = i2;
    this.trianglesLen = 0;

    this._addTriangle(i0, i1, i2, -1, -1, -1);

    for (let k = 0, xp, yp; k < this._ids.length; k++) {
      const i = this._ids[k];
      const x = coords[2 * i];
      const y = coords[2 * i + 1]; // skip near-duplicate points

      if (k > 0 && Math.abs(x - xp) <= EPSILON && Math.abs(y - yp) <= EPSILON) continue;
      xp = x;
      yp = y; // skip seed triangle points

      if (i === i0 || i === i1 || i === i2) continue; // find a visible edge on the convex hull using edge hash

      let start = 0;

      for (let j = 0, key = this._hashKey(x, y); j < this._hashSize; j++) {
        start = hullHash[(key + j) % this._hashSize];
        if (start !== -1 && start !== hullNext[start]) break;
      }

      start = hullPrev[start];
      let e = start,
          q;

      while (q = hullNext[e], !orient(x, y, coords[2 * e], coords[2 * e + 1], coords[2 * q], coords[2 * q + 1])) {
        e = q;

        if (e === start) {
          e = -1;
          break;
        }
      }

      if (e === -1) continue; // likely a near-duplicate point; skip it
      // add the first triangle from the point

      let t = this._addTriangle(e, i, hullNext[e], -1, -1, hullTri[e]); // recursively flip triangles from the point until they satisfy the Delaunay condition


      hullTri[i] = this._legalize(t + 2);
      hullTri[e] = t; // keep track of boundary triangles on the hull

      hullSize++; // walk forward through the hull, adding more triangles and flipping recursively

      let n = hullNext[e];

      while (q = hullNext[n], orient(x, y, coords[2 * n], coords[2 * n + 1], coords[2 * q], coords[2 * q + 1])) {
        t = this._addTriangle(n, i, q, hullTri[i], -1, hullTri[n]);
        hullTri[i] = this._legalize(t + 2);
        hullNext[n] = n; // mark as removed

        hullSize--;
        n = q;
      } // walk backward from the other side, adding more triangles and flipping


      if (e === start) {
        while (q = hullPrev[e], orient(x, y, coords[2 * q], coords[2 * q + 1], coords[2 * e], coords[2 * e + 1])) {
          t = this._addTriangle(q, i, e, -1, hullTri[e], hullTri[q]);

          this._legalize(t + 2);

          hullTri[q] = t;
          hullNext[e] = e; // mark as removed

          hullSize--;
          e = q;
        }
      } // update the hull indices


      this._hullStart = hullPrev[i] = e;
      hullNext[e] = hullPrev[n] = i;
      hullNext[i] = n; // save the two new edges in the hash table

      hullHash[this._hashKey(x, y)] = i;
      hullHash[this._hashKey(coords[2 * e], coords[2 * e + 1])] = e;
    }

    this.hull = new Uint32Array(hullSize);

    for (let i = 0, e = this._hullStart; i < hullSize; i++) {
      this.hull[i] = e;
      e = hullNext[e];
    } // trim typed triangle mesh arrays


    this.triangles = this._triangles.subarray(0, this.trianglesLen);
    this.halfedges = this._halfedges.subarray(0, this.trianglesLen);
  }

  _hashKey(x, y) {
    return Math.floor(pseudoAngle(x - this._cx, y - this._cy) * this._hashSize) % this._hashSize;
  }

  _legalize(a) {
    const {
      _triangles: triangles,
      _halfedges: halfedges,
      coords
    } = this;
    let i = 0;
    let ar = 0; // recursion eliminated with a fixed-size stack

    while (true) {
      const b = halfedges[a];
      /* if the pair of triangles doesn't satisfy the Delaunay condition
       * (p1 is inside the circumcircle of [p0, pl, pr]), flip them,
       * then do the same check/flip recursively for the new pair of triangles
       *
       *           pl                    pl
       *          /||\                  /  \
       *       al/ || \bl            al/    \a
       *        /  ||  \              /      \
       *       /  a||b  \    flip    /___ar___\
       *     p0\   ||   /p1   =>   p0\---bl---/p1
       *        \  ||  /              \      /
       *       ar\ || /br             b\    /br
       *          \||/                  \  /
       *           pr                    pr
       */

      const a0 = a - a % 3;
      ar = a0 + (a + 2) % 3;

      if (b === -1) {
        // convex hull edge
        if (i === 0) break;
        a = EDGE_STACK[--i];
        continue;
      }

      const b0 = b - b % 3;
      const al = a0 + (a + 1) % 3;
      const bl = b0 + (b + 2) % 3;
      const p0 = triangles[ar];
      const pr = triangles[a];
      const pl = triangles[al];
      const p1 = triangles[bl];
      const illegal = inCircle(coords[2 * p0], coords[2 * p0 + 1], coords[2 * pr], coords[2 * pr + 1], coords[2 * pl], coords[2 * pl + 1], coords[2 * p1], coords[2 * p1 + 1]);

      if (illegal) {
        triangles[a] = p1;
        triangles[b] = p0;
        const hbl = halfedges[bl]; // edge swapped on the other side of the hull (rare); fix the halfedge reference

        if (hbl === -1) {
          let e = this._hullStart;

          do {
            if (this._hullTri[e] === bl) {
              this._hullTri[e] = a;
              break;
            }

            e = this._hullPrev[e];
          } while (e !== this._hullStart);
        }

        this._link(a, hbl);

        this._link(b, halfedges[ar]);

        this._link(ar, bl);

        const br = b0 + (b + 1) % 3; // don't worry about hitting the cap: it can only happen on extremely degenerate input

        if (i < EDGE_STACK.length) {
          EDGE_STACK[i++] = br;
        }
      } else {
        if (i === 0) break;
        a = EDGE_STACK[--i];
      }
    }

    return ar;
  }

  _link(a, b) {
    this._halfedges[a] = b;
    if (b !== -1) this._halfedges[b] = a;
  } // add a new triangle given vertex indices and adjacent half-edge ids


  _addTriangle(i0, i1, i2, a, b, c) {
    const t = this.trianglesLen;
    this._triangles[t] = i0;
    this._triangles[t + 1] = i1;
    this._triangles[t + 2] = i2;

    this._link(t, a);

    this._link(t + 1, b);

    this._link(t + 2, c);

    this.trianglesLen += 3;
    return t;
  }

} // monotonically increases with real angle, but doesn't need expensive trigonometry


exports.default = Delaunator;

function pseudoAngle(dx, dy) {
  const p = dx / (Math.abs(dx) + Math.abs(dy));
  return (dy > 0 ? 3 - p : 1 + p) / 4; // [0..1]
}

function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
} // return 2d orientation sign if we're confident in it through J. Shewchuk's error bound check


function orientIfSure(px, py, rx, ry, qx, qy) {
  const l = (ry - py) * (qx - px);
  const r = (rx - px) * (qy - py);
  return Math.abs(l - r) >= 3.3306690738754716e-16 * Math.abs(l + r) ? l - r : 0;
} // a more robust orientation test that's stable in a given triangle (to fix robustness issues)


function orient(rx, ry, qx, qy, px, py) {
  const sign = orientIfSure(px, py, rx, ry, qx, qy) || orientIfSure(rx, ry, qx, qy, px, py) || orientIfSure(qx, qy, px, py, rx, ry);
  return sign < 0;
}

function inCircle(ax, ay, bx, by, cx, cy, px, py) {
  const dx = ax - px;
  const dy = ay - py;
  const ex = bx - px;
  const ey = by - py;
  const fx = cx - px;
  const fy = cy - py;
  const ap = dx * dx + dy * dy;
  const bp = ex * ex + ey * ey;
  const cp = fx * fx + fy * fy;
  return dx * (ey * cp - bp * fy) - dy * (ex * cp - bp * fx) + ap * (ex * fy - ey * fx) < 0;
}

function circumradius(ax, ay, bx, by, cx, cy) {
  const dx = bx - ax;
  const dy = by - ay;
  const ex = cx - ax;
  const ey = cy - ay;
  const bl = dx * dx + dy * dy;
  const cl = ex * ex + ey * ey;
  const d = 0.5 / (dx * ey - dy * ex);
  const x = (ey * bl - dy * cl) * d;
  const y = (dx * cl - ex * bl) * d;
  return x * x + y * y;
}

function circumcenter(ax, ay, bx, by, cx, cy) {
  const dx = bx - ax;
  const dy = by - ay;
  const ex = cx - ax;
  const ey = cy - ay;
  const bl = dx * dx + dy * dy;
  const cl = ex * ex + ey * ey;
  const d = 0.5 / (dx * ey - dy * ex);
  const x = ax + (ey * bl - dy * cl) * d;
  const y = ay + (dx * cl - ex * bl) * d;
  return {
    x,
    y
  };
}

function quicksort(ids, dists, left, right) {
  if (right - left <= 20) {
    for (let i = left + 1; i <= right; i++) {
      const temp = ids[i];
      const tempDist = dists[temp];
      let j = i - 1;

      while (j >= left && dists[ids[j]] > tempDist) ids[j + 1] = ids[j--];

      ids[j + 1] = temp;
    }
  } else {
    const median = left + right >> 1;
    let i = left + 1;
    let j = right;
    swap(ids, median, i);
    if (dists[ids[left]] > dists[ids[right]]) swap(ids, left, right);
    if (dists[ids[i]] > dists[ids[right]]) swap(ids, i, right);
    if (dists[ids[left]] > dists[ids[i]]) swap(ids, left, i);
    const temp = ids[i];
    const tempDist = dists[temp];

    while (true) {
      do i++; while (dists[ids[i]] < tempDist);

      do j--; while (dists[ids[j]] > tempDist);

      if (j < i) break;
      swap(ids, i, j);
    }

    ids[left + 1] = ids[j];
    ids[j] = temp;

    if (right - i + 1 >= j - left) {
      quicksort(ids, dists, i, right);
      quicksort(ids, dists, left, j - 1);
    } else {
      quicksort(ids, dists, left, j - 1);
      quicksort(ids, dists, i, right);
    }
  }
}

function swap(arr, i, j) {
  const tmp = arr[i];
  arr[i] = arr[j];
  arr[j] = tmp;
}

function defaultGetX(p) {
  return p[0];
}

function defaultGetY(p) {
  return p[1];
}

},{}],174:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

// https://github.com/d3/d3-contour/blob/master/src/area.js
function _default(ring) {
  var i = 0,
      n = ring.length,
      area = ring[n - 1][1] * ring[0][0] - ring[n - 1][0] * ring[0][1];

  while (++i < n) area += ring[i - 1][1] * ring[i][0] - ring[i - 1][0] * ring[i][1];

  return area;
}

},{}],175:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

// https://github.com/d3/d3-contour/blob/master/src/contains.js
function _default(ring, hole) {
  var i = -1,
      n = hole.length,
      c;

  while (++i < n) if (c = ringContains(ring, hole[i])) return c;

  return 0;
}

function ringContains(ring, point) {
  var x = point[0],
      y = point[1],
      contains = -1;

  for (var i = 0, n = ring.length, j = n - 1; i < n; j = i++) {
    var pi = ring[i],
        xi = pi[0],
        yi = pi[1],
        pj = ring[j],
        xj = pj[0],
        yj = pj[1];
    if (segmentContains(pi, pj, point)) return 0;
    if (yi > y !== yj > y && x < (xj - xi) * (y - yi) / (yj - yi) + xi) contains = -contains;
  }

  return contains;
}

function segmentContains(a, b, c) {
  var i;
  return collinear(a, b, c) && within(a[i = +(a[0] === b[0])], c[i], b[i]);
}

function collinear(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) === (c[0] - a[0]) * (b[1] - a[1]);
}

function within(p, q, r) {
  return p <= q && q <= r || r <= q && q <= p;
}

},{}],176:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

// https://github.com/d3/d3-array/blob/master/src/extent.js
function _default(values) {
  let min, max;

  for (const value of values) {
    if (value != null) {
      if (min === undefined) {
        if (value >= value) min = max = value;
      } else {
        if (min > value) min = value;
        if (max < value) max = value;
      }
    }
  }

  return [min, max];
}

},{}],177:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "tricontour", {
  enumerable: true,
  get: function () {
    return _tricontour.default;
  }
});

var _tricontour = _interopRequireDefault(require("./tricontour.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

},{"./tricontour.js":180}],178:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

// https://github.com/d3/d3-array/blob/master/src/merge.js
function* flatten(arrays) {
  for (const array of arrays) {
    yield* array;
  }
}

function _default(arrays) {
  return Array.from(flatten(arrays));
}

},{}],179:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _contains = _interopRequireDefault(require("./contains.js"));

var _area = _interopRequireDefault(require("./area.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// sorts the polygons so that the holes are grouped with their parent polygon
// https://github.com/d3/d3-contour/blob/master/src/contours.js
function _default(rings) {
  const polygons = [],
        holes = [];

  for (const ring of rings) {
    if ((0, _area.default)(ring) > 0) polygons.push([ring]);else holes.push(ring);
  }

  holes.forEach(function (hole) {
    for (var i = 0, n = polygons.length, polygon; i < n; ++i) {
      if ((0, _contains.default)((polygon = polygons[i])[0], hole) !== -1) {
        polygon.push(hole);
        return;
      }
    }
  });
  return polygons;
}

},{"./area.js":174,"./contains.js":175}],180:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _d3Delaunay = require("d3-delaunay");

var _d3Scale = require("d3-scale");

var _extent = _interopRequireDefault(require("./extent.js"));

var _merge = _interopRequireDefault(require("./merge.js"));

var _ringsort = _interopRequireDefault(require("./ringsort.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _default() {
  // accessors
  let x = d => d[0],
      y = d => d[1],
      value = d => isFinite(+d[2]) ? +d[2] : 0,
      triangulate = _d3Delaunay.Delaunay.from,
      pointInterpolate = (i, j, a) => {
    const {
      points
    } = triangulation;
    const A = [points[2 * i], points[2 * i + 1]],
          B = [points[2 * j], points[2 * j + 1]];
    return [a * B[0] + (1 - a) * A[0], a * B[1] + (1 - a) * A[1]];
  },
      ringsort = _ringsort.default;

  let thresholds, values, triangulation;

  function init(points) {
    triangulation = triangulate(points, x, y);
    values = Array.from(points, value);

    if (typeof thresholds !== "object") {
      thresholds = (0, _d3Scale.scaleLinear)().domain((0, _extent.default)(values)).nice().ticks(thresholds);
    }
  }

  function* tricontours(points) {
    init(points);

    for (const threshold of thresholds) {
      const polygon = tricontour(triangulation, values, threshold);
      yield {
        type: "MultiPolygon",
        coordinates: polygon,
        value: threshold
      };
    }
  }

  function contour(points, threshold) {
    init(points);
    return {
      type: "MultiPolygon",
      coordinates: tricontour(triangulation, values, threshold),
      value: threshold
    };
  }

  function* isobands(points) {
    init(points);
    let p0, p1, th0;

    for (const th of thresholds) {
      if (p1) p0 = p1;
      p1 = (0, _merge.default)(tricontour(triangulation, values, th));

      if (p0) {
        yield {
          type: "MultiPolygon",
          coordinates: ringsort(p0.concat(p1.map(ring => ring.slice().reverse()))),
          value: th0,
          valueMax: th
        };
      }

      th0 = th;
    }
  }

  const contours = function (data) {
    return [...tricontours(data)];
  }; // API


  contours.x = _ => _ ? (x = _, contours) : x;

  contours.y = _ => _ ? (y = _, contours) : y;

  contours.value = _ => _ ? (value = _, contours) : value;

  contours.thresholds = _ => _ ? (thresholds = _, contours) : thresholds;

  contours.triangulate = _ => _ ? (triangulate = _, contours) : triangulate;

  contours.pointInterpolate = _ => _ ? (pointInterpolate = _, contours) : pointInterpolate;

  contours.ringsort = _ => _ ? (ringsort = _, contours) : ringsort;

  contours.contours = tricontours;
  contours.contour = contour;
  contours.isobands = isobands; // expose the internals (useful for debugging, not part of the API)

  contours._values = () => values;

  contours._thresholds = () => thresholds;

  contours._triangulation = () => triangulation;

  return contours; // navigate a triangle

  function next(i) {
    return i % 3 === 2 ? i - 2 : i + 1;
  }

  function prev(i) {
    return i % 3 === 0 ? i + 2 : i - 1;
  }

  function tricontour(triangulation, values, v0 = 0) {
    // sanity check
    for (const d of values) if (!isFinite(d)) throw ["Invalid value", d];

    const {
      halfedges,
      hull,
      inedges,
      triangles
    } = triangulation,
          n = values.length;

    function edgealpha(i) {
      return alpha(triangles[i], triangles[next(i)]);
    }

    function alpha(i, j) {
      const u = values[i],
            v = values[j];

      if ((u - v0) * (v - v0) <= 0 && u - v) {
        return (v0 - u) / Math.abs(u - v);
      }
    } // create the path from the first exit; cancel visited halfedges


    const rings = [],
          visited = new Uint8Array(halfedges.length).fill(0);
    let path, i, j, k, a;

    for (k = 0; k < halfedges.length; k++) {
      if (visited[k]) continue;
      i = k;
      path = [];

      while ((a = edgealpha(i)) > 0) {
        const [ti, tj] = [triangles[i], triangles[j = next(i)]]; // is our tour done?

        if (path.length && ti === path[0].ti && tj === path[0].tj || path.length > 2 * n) break;
        visited[i] = 1;
        path.push({
          ti,
          tj,
          a
        }); // jump into the adjacent triangle

        if ((j = halfedges[i]) > -1) {
          if (edgealpha(j = next(j)) > 0) {
            i = j;
            continue;
          }

          if (edgealpha(j = next(j)) > 0) {
            i = j;
            continue;
          } // debugger;

        } // or follow the hull
        else {
          let h = (hull.indexOf(triangles[i]) + 1) % hull.length;

          while (values[hull[h]] < v0) {
            // debugger;
            h = (h + 1) % hull.length;
          }

          while (values[hull[h]] >= v0) {
            path.push({
              ti: hull[h],
              tj: hull[h],
              a: 0
            });
            h = (h + 1) % hull.length;
          } // take that entry


          j = inedges[hull[h]];
          path.push({
            ti: hull[h],
            tj: triangles[j],
            a: alpha(hull[h], triangles[j])
          });
          if (edgealpha(i = next(j)) > 0) continue;
          if (edgealpha(i = prev(j)) > 0) continue;
        }
      }

      if (path.length) {
        path.push(path[0]);
        rings.push(path.map(({
          ti,
          tj,
          a
        }) => pointInterpolate(ti, tj, a)));
      }
    } // special case all values on the hull are >=v0, add the hull


    if (hull.every(d => values[d] >= v0)) {
      rings.unshift(Array.from(hull).concat([hull[0]]).map(i => pointInterpolate(i, i, 0)));
    }

    return ringsort(rings); // return [rings] if we don't need to sort
  }
}

},{"./extent.js":176,"./merge.js":178,"./ringsort.js":179,"d3-delaunay":78,"d3-scale":124}],181:[function(require,module,exports){
'use strict';

var has = Object.prototype.hasOwnProperty
  , prefix = '~';

/**
 * Constructor to create a storage for our `EE` objects.
 * An `Events` instance is a plain object whose properties are event names.
 *
 * @constructor
 * @private
 */
function Events() {}

//
// We try to not inherit from `Object.prototype`. In some engines creating an
// instance in this way is faster than calling `Object.create(null)` directly.
// If `Object.create(null)` is not supported we prefix the event names with a
// character to make sure that the built-in object properties are not
// overridden or used as an attack vector.
//
if (Object.create) {
  Events.prototype = Object.create(null);

  //
  // This hack is needed because the `__proto__` property is still inherited in
  // some old browsers like Android 4, iPhone 5.1, Opera 11 and Safari 5.
  //
  if (!new Events().__proto__) prefix = false;
}

/**
 * Representation of a single event listener.
 *
 * @param {Function} fn The listener function.
 * @param {*} context The context to invoke the listener with.
 * @param {Boolean} [once=false] Specify if the listener is a one-time listener.
 * @constructor
 * @private
 */
function EE(fn, context, once) {
  this.fn = fn;
  this.context = context;
  this.once = once || false;
}

/**
 * Add a listener for a given event.
 *
 * @param {EventEmitter} emitter Reference to the `EventEmitter` instance.
 * @param {(String|Symbol)} event The event name.
 * @param {Function} fn The listener function.
 * @param {*} context The context to invoke the listener with.
 * @param {Boolean} once Specify if the listener is a one-time listener.
 * @returns {EventEmitter}
 * @private
 */
function addListener(emitter, event, fn, context, once) {
  if (typeof fn !== 'function') {
    throw new TypeError('The listener must be a function');
  }

  var listener = new EE(fn, context || emitter, once)
    , evt = prefix ? prefix + event : event;

  if (!emitter._events[evt]) emitter._events[evt] = listener, emitter._eventsCount++;
  else if (!emitter._events[evt].fn) emitter._events[evt].push(listener);
  else emitter._events[evt] = [emitter._events[evt], listener];

  return emitter;
}

/**
 * Clear event by name.
 *
 * @param {EventEmitter} emitter Reference to the `EventEmitter` instance.
 * @param {(String|Symbol)} evt The Event name.
 * @private
 */
function clearEvent(emitter, evt) {
  if (--emitter._eventsCount === 0) emitter._events = new Events();
  else delete emitter._events[evt];
}

/**
 * Minimal `EventEmitter` interface that is molded against the Node.js
 * `EventEmitter` interface.
 *
 * @constructor
 * @public
 */
function EventEmitter() {
  this._events = new Events();
  this._eventsCount = 0;
}

/**
 * Return an array listing the events for which the emitter has registered
 * listeners.
 *
 * @returns {Array}
 * @public
 */
EventEmitter.prototype.eventNames = function eventNames() {
  var names = []
    , events
    , name;

  if (this._eventsCount === 0) return names;

  for (name in (events = this._events)) {
    if (has.call(events, name)) names.push(prefix ? name.slice(1) : name);
  }

  if (Object.getOwnPropertySymbols) {
    return names.concat(Object.getOwnPropertySymbols(events));
  }

  return names;
};

/**
 * Return the listeners registered for a given event.
 *
 * @param {(String|Symbol)} event The event name.
 * @returns {Array} The registered listeners.
 * @public
 */
EventEmitter.prototype.listeners = function listeners(event) {
  var evt = prefix ? prefix + event : event
    , handlers = this._events[evt];

  if (!handlers) return [];
  if (handlers.fn) return [handlers.fn];

  for (var i = 0, l = handlers.length, ee = new Array(l); i < l; i++) {
    ee[i] = handlers[i].fn;
  }

  return ee;
};

/**
 * Return the number of listeners listening to a given event.
 *
 * @param {(String|Symbol)} event The event name.
 * @returns {Number} The number of listeners.
 * @public
 */
EventEmitter.prototype.listenerCount = function listenerCount(event) {
  var evt = prefix ? prefix + event : event
    , listeners = this._events[evt];

  if (!listeners) return 0;
  if (listeners.fn) return 1;
  return listeners.length;
};

/**
 * Calls each of the listeners registered for a given event.
 *
 * @param {(String|Symbol)} event The event name.
 * @returns {Boolean} `true` if the event had listeners, else `false`.
 * @public
 */
EventEmitter.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
  var evt = prefix ? prefix + event : event;

  if (!this._events[evt]) return false;

  var listeners = this._events[evt]
    , len = arguments.length
    , args
    , i;

  if (listeners.fn) {
    if (listeners.once) this.removeListener(event, listeners.fn, undefined, true);

    switch (len) {
      case 1: return listeners.fn.call(listeners.context), true;
      case 2: return listeners.fn.call(listeners.context, a1), true;
      case 3: return listeners.fn.call(listeners.context, a1, a2), true;
      case 4: return listeners.fn.call(listeners.context, a1, a2, a3), true;
      case 5: return listeners.fn.call(listeners.context, a1, a2, a3, a4), true;
      case 6: return listeners.fn.call(listeners.context, a1, a2, a3, a4, a5), true;
    }

    for (i = 1, args = new Array(len -1); i < len; i++) {
      args[i - 1] = arguments[i];
    }

    listeners.fn.apply(listeners.context, args);
  } else {
    var length = listeners.length
      , j;

    for (i = 0; i < length; i++) {
      if (listeners[i].once) this.removeListener(event, listeners[i].fn, undefined, true);

      switch (len) {
        case 1: listeners[i].fn.call(listeners[i].context); break;
        case 2: listeners[i].fn.call(listeners[i].context, a1); break;
        case 3: listeners[i].fn.call(listeners[i].context, a1, a2); break;
        case 4: listeners[i].fn.call(listeners[i].context, a1, a2, a3); break;
        default:
          if (!args) for (j = 1, args = new Array(len -1); j < len; j++) {
            args[j - 1] = arguments[j];
          }

          listeners[i].fn.apply(listeners[i].context, args);
      }
    }
  }

  return true;
};

/**
 * Add a listener for a given event.
 *
 * @param {(String|Symbol)} event The event name.
 * @param {Function} fn The listener function.
 * @param {*} [context=this] The context to invoke the listener with.
 * @returns {EventEmitter} `this`.
 * @public
 */
EventEmitter.prototype.on = function on(event, fn, context) {
  return addListener(this, event, fn, context, false);
};

/**
 * Add a one-time listener for a given event.
 *
 * @param {(String|Symbol)} event The event name.
 * @param {Function} fn The listener function.
 * @param {*} [context=this] The context to invoke the listener with.
 * @returns {EventEmitter} `this`.
 * @public
 */
EventEmitter.prototype.once = function once(event, fn, context) {
  return addListener(this, event, fn, context, true);
};

/**
 * Remove the listeners of a given event.
 *
 * @param {(String|Symbol)} event The event name.
 * @param {Function} fn Only remove the listeners that match this function.
 * @param {*} context Only remove the listeners that have this context.
 * @param {Boolean} once Only remove one-time listeners.
 * @returns {EventEmitter} `this`.
 * @public
 */
EventEmitter.prototype.removeListener = function removeListener(event, fn, context, once) {
  var evt = prefix ? prefix + event : event;

  if (!this._events[evt]) return this;
  if (!fn) {
    clearEvent(this, evt);
    return this;
  }

  var listeners = this._events[evt];

  if (listeners.fn) {
    if (
      listeners.fn === fn &&
      (!once || listeners.once) &&
      (!context || listeners.context === context)
    ) {
      clearEvent(this, evt);
    }
  } else {
    for (var i = 0, events = [], length = listeners.length; i < length; i++) {
      if (
        listeners[i].fn !== fn ||
        (once && !listeners[i].once) ||
        (context && listeners[i].context !== context)
      ) {
        events.push(listeners[i]);
      }
    }

    //
    // Reset the array, or remove it completely if we have no more listeners.
    //
    if (events.length) this._events[evt] = events.length === 1 ? events[0] : events;
    else clearEvent(this, evt);
  }

  return this;
};

/**
 * Remove all listeners, or those of the specified event.
 *
 * @param {(String|Symbol)} [event] The event name.
 * @returns {EventEmitter} `this`.
 * @public
 */
EventEmitter.prototype.removeAllListeners = function removeAllListeners(event) {
  var evt;

  if (event) {
    evt = prefix ? prefix + event : event;
    if (this._events[evt]) clearEvent(this, evt);
  } else {
    this._events = new Events();
    this._eventsCount = 0;
  }

  return this;
};

//
// Alias methods names because people roll like that.
//
EventEmitter.prototype.off = EventEmitter.prototype.removeListener;
EventEmitter.prototype.addListener = EventEmitter.prototype.on;

//
// Expose the prefix.
//
EventEmitter.prefixed = prefix;

//
// Allow `EventEmitter` to be imported as module namespace.
//
EventEmitter.EventEmitter = EventEmitter;

//
// Expose the module.
//
if ('undefined' !== typeof module) {
  module.exports = EventEmitter;
}

},{}],182:[function(require,module,exports){
/*
 * Fuzzy
 * https://github.com/myork/fuzzy
 *
 * Copyright (c) 2012 Matt York
 * Licensed under the MIT license.
 */

(function() {

var root = this;

var fuzzy = {};

// Use in node or in browser
if (typeof exports !== 'undefined') {
  module.exports = fuzzy;
} else {
  root.fuzzy = fuzzy;
}

// Return all elements of `array` that have a fuzzy
// match against `pattern`.
fuzzy.simpleFilter = function(pattern, array) {
  return array.filter(function(str) {
    return fuzzy.test(pattern, str);
  });
};

// Does `pattern` fuzzy match `str`?
fuzzy.test = function(pattern, str) {
  return fuzzy.match(pattern, str) !== null;
};

// If `pattern` matches `str`, wrap each matching character
// in `opts.pre` and `opts.post`. If no match, return null
fuzzy.match = function(pattern, str, opts) {
  opts = opts || {};
  var patternIdx = 0
    , result = []
    , len = str.length
    , totalScore = 0
    , currScore = 0
    // prefix
    , pre = opts.pre || ''
    // suffix
    , post = opts.post || ''
    // String to compare against. This might be a lowercase version of the
    // raw string
    , compareString =  opts.caseSensitive && str || str.toLowerCase()
    , ch;

  pattern = opts.caseSensitive && pattern || pattern.toLowerCase();

  // For each character in the string, either add it to the result
  // or wrap in template if it's the next string in the pattern
  for(var idx = 0; idx < len; idx++) {
    ch = str[idx];
    if(compareString[idx] === pattern[patternIdx]) {
      ch = pre + ch + post;
      patternIdx += 1;

      // consecutive characters should increase the score more than linearly
      currScore += 1 + currScore;
    } else {
      currScore = 0;
    }
    totalScore += currScore;
    result[result.length] = ch;
  }

  // return rendered string if we have a match for every char
  if(patternIdx === pattern.length) {
    // if the string is an exact match with pattern, totalScore should be maxed
    totalScore = (compareString === pattern) ? Infinity : totalScore;
    return {rendered: result.join(''), score: totalScore};
  }

  return null;
};

// The normal entry point. Filters `arr` for matches against `pattern`.
// It returns an array with matching values of the type:
//
//     [{
//         string:   '<b>lah' // The rendered string
//       , index:    2        // The index of the element in `arr`
//       , original: 'blah'   // The original element in `arr`
//     }]
//
// `opts` is an optional argument bag. Details:
//
//    opts = {
//        // string to put before a matching character
//        pre:     '<b>'
//
//        // string to put after matching character
//      , post:    '</b>'
//
//        // Optional function. Input is an entry in the given arr`,
//        // output should be the string to test `pattern` against.
//        // In this example, if `arr = [{crying: 'koala'}]` we would return
//        // 'koala'.
//      , extract: function(arg) { return arg.crying; }
//    }
fuzzy.filter = function(pattern, arr, opts) {
  if(!arr || arr.length === 0) {
    return [];
  }
  if (typeof pattern !== 'string') {
    return arr;
  }
  opts = opts || {};
  return arr
    .reduce(function(prev, element, idx, arr) {
      var str = element;
      if(opts.extract) {
        str = opts.extract(element);
      }
      var rendered = fuzzy.match(pattern, str, opts);
      if(rendered != null) {
        prev[prev.length] = {
            string: rendered.rendered
          , score: rendered.score
          , index: idx
          , original: element
        };
      }
      return prev;
    }, [])

    // Sort by score. Browsers are inconsistent wrt stable/unstable
    // sorting, so force stable by using the index in the case of tie.
    // See http://ofb.net/~sethml/is-sort-stable.html
    .sort(function(a,b) {
      var compare = b.score - a.score;
      if(compare) return compare;
      return a.index - b.index;
    });
};


}());


},{}],183:[function(require,module,exports){
'use strict';
var toString = Object.prototype.toString;

module.exports = function (x) {
	var prototype;
	return toString.call(x) === '[object Object]' && (prototype = Object.getPrototypeOf(x), prototype === null || prototype === Object.getPrototypeOf({}));
};

},{}],184:[function(require,module,exports){
(function (global){(function (){
/**
 * lodash (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright jQuery Foundation and other contributors <https://jquery.org/>
 * Released under MIT license <https://lodash.com/license>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 */

/** Used as the `TypeError` message for "Functions" methods. */
var FUNC_ERROR_TEXT = 'Expected a function';

/** Used as references for various `Number` constants. */
var NAN = 0 / 0;

/** `Object#toString` result references. */
var symbolTag = '[object Symbol]';

/** Used to match leading and trailing whitespace. */
var reTrim = /^\s+|\s+$/g;

/** Used to detect bad signed hexadecimal string values. */
var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;

/** Used to detect binary string values. */
var reIsBinary = /^0b[01]+$/i;

/** Used to detect octal string values. */
var reIsOctal = /^0o[0-7]+$/i;

/** Built-in method references without a dependency on `root`. */
var freeParseInt = parseInt;

/** Detect free variable `global` from Node.js. */
var freeGlobal = typeof global == 'object' && global && global.Object === Object && global;

/** Detect free variable `self`. */
var freeSelf = typeof self == 'object' && self && self.Object === Object && self;

/** Used as a reference to the global object. */
var root = freeGlobal || freeSelf || Function('return this')();

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeMax = Math.max,
    nativeMin = Math.min;

/**
 * Gets the timestamp of the number of milliseconds that have elapsed since
 * the Unix epoch (1 January 1970 00:00:00 UTC).
 *
 * @static
 * @memberOf _
 * @since 2.4.0
 * @category Date
 * @returns {number} Returns the timestamp.
 * @example
 *
 * _.defer(function(stamp) {
 *   console.log(_.now() - stamp);
 * }, _.now());
 * // => Logs the number of milliseconds it took for the deferred invocation.
 */
var now = function() {
  return root.Date.now();
};

/**
 * Creates a debounced function that delays invoking `func` until after `wait`
 * milliseconds have elapsed since the last time the debounced function was
 * invoked. The debounced function comes with a `cancel` method to cancel
 * delayed `func` invocations and a `flush` method to immediately invoke them.
 * Provide `options` to indicate whether `func` should be invoked on the
 * leading and/or trailing edge of the `wait` timeout. The `func` is invoked
 * with the last arguments provided to the debounced function. Subsequent
 * calls to the debounced function return the result of the last `func`
 * invocation.
 *
 * **Note:** If `leading` and `trailing` options are `true`, `func` is
 * invoked on the trailing edge of the timeout only if the debounced function
 * is invoked more than once during the `wait` timeout.
 *
 * If `wait` is `0` and `leading` is `false`, `func` invocation is deferred
 * until to the next tick, similar to `setTimeout` with a timeout of `0`.
 *
 * See [David Corbacho's article](https://css-tricks.com/debouncing-throttling-explained-examples/)
 * for details over the differences between `_.debounce` and `_.throttle`.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Function
 * @param {Function} func The function to debounce.
 * @param {number} [wait=0] The number of milliseconds to delay.
 * @param {Object} [options={}] The options object.
 * @param {boolean} [options.leading=false]
 *  Specify invoking on the leading edge of the timeout.
 * @param {number} [options.maxWait]
 *  The maximum time `func` is allowed to be delayed before it's invoked.
 * @param {boolean} [options.trailing=true]
 *  Specify invoking on the trailing edge of the timeout.
 * @returns {Function} Returns the new debounced function.
 * @example
 *
 * // Avoid costly calculations while the window size is in flux.
 * jQuery(window).on('resize', _.debounce(calculateLayout, 150));
 *
 * // Invoke `sendMail` when clicked, debouncing subsequent calls.
 * jQuery(element).on('click', _.debounce(sendMail, 300, {
 *   'leading': true,
 *   'trailing': false
 * }));
 *
 * // Ensure `batchLog` is invoked once after 1 second of debounced calls.
 * var debounced = _.debounce(batchLog, 250, { 'maxWait': 1000 });
 * var source = new EventSource('/stream');
 * jQuery(source).on('message', debounced);
 *
 * // Cancel the trailing debounced invocation.
 * jQuery(window).on('popstate', debounced.cancel);
 */
function debounce(func, wait, options) {
  var lastArgs,
      lastThis,
      maxWait,
      result,
      timerId,
      lastCallTime,
      lastInvokeTime = 0,
      leading = false,
      maxing = false,
      trailing = true;

  if (typeof func != 'function') {
    throw new TypeError(FUNC_ERROR_TEXT);
  }
  wait = toNumber(wait) || 0;
  if (isObject(options)) {
    leading = !!options.leading;
    maxing = 'maxWait' in options;
    maxWait = maxing ? nativeMax(toNumber(options.maxWait) || 0, wait) : maxWait;
    trailing = 'trailing' in options ? !!options.trailing : trailing;
  }

  function invokeFunc(time) {
    var args = lastArgs,
        thisArg = lastThis;

    lastArgs = lastThis = undefined;
    lastInvokeTime = time;
    result = func.apply(thisArg, args);
    return result;
  }

  function leadingEdge(time) {
    // Reset any `maxWait` timer.
    lastInvokeTime = time;
    // Start the timer for the trailing edge.
    timerId = setTimeout(timerExpired, wait);
    // Invoke the leading edge.
    return leading ? invokeFunc(time) : result;
  }

  function remainingWait(time) {
    var timeSinceLastCall = time - lastCallTime,
        timeSinceLastInvoke = time - lastInvokeTime,
        result = wait - timeSinceLastCall;

    return maxing ? nativeMin(result, maxWait - timeSinceLastInvoke) : result;
  }

  function shouldInvoke(time) {
    var timeSinceLastCall = time - lastCallTime,
        timeSinceLastInvoke = time - lastInvokeTime;

    // Either this is the first call, activity has stopped and we're at the
    // trailing edge, the system time has gone backwards and we're treating
    // it as the trailing edge, or we've hit the `maxWait` limit.
    return (lastCallTime === undefined || (timeSinceLastCall >= wait) ||
      (timeSinceLastCall < 0) || (maxing && timeSinceLastInvoke >= maxWait));
  }

  function timerExpired() {
    var time = now();
    if (shouldInvoke(time)) {
      return trailingEdge(time);
    }
    // Restart the timer.
    timerId = setTimeout(timerExpired, remainingWait(time));
  }

  function trailingEdge(time) {
    timerId = undefined;

    // Only invoke if we have `lastArgs` which means `func` has been
    // debounced at least once.
    if (trailing && lastArgs) {
      return invokeFunc(time);
    }
    lastArgs = lastThis = undefined;
    return result;
  }

  function cancel() {
    if (timerId !== undefined) {
      clearTimeout(timerId);
    }
    lastInvokeTime = 0;
    lastArgs = lastCallTime = lastThis = timerId = undefined;
  }

  function flush() {
    return timerId === undefined ? result : trailingEdge(now());
  }

  function debounced() {
    var time = now(),
        isInvoking = shouldInvoke(time);

    lastArgs = arguments;
    lastThis = this;
    lastCallTime = time;

    if (isInvoking) {
      if (timerId === undefined) {
        return leadingEdge(lastCallTime);
      }
      if (maxing) {
        // Handle invocations in a tight loop.
        timerId = setTimeout(timerExpired, wait);
        return invokeFunc(lastCallTime);
      }
    }
    if (timerId === undefined) {
      timerId = setTimeout(timerExpired, wait);
    }
    return result;
  }
  debounced.cancel = cancel;
  debounced.flush = flush;
  return debounced;
}

/**
 * Checks if `value` is the
 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is classified as a `Symbol` primitive or object.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
 * @example
 *
 * _.isSymbol(Symbol.iterator);
 * // => true
 *
 * _.isSymbol('abc');
 * // => false
 */
function isSymbol(value) {
  return typeof value == 'symbol' ||
    (isObjectLike(value) && objectToString.call(value) == symbolTag);
}

/**
 * Converts `value` to a number.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to process.
 * @returns {number} Returns the number.
 * @example
 *
 * _.toNumber(3.2);
 * // => 3.2
 *
 * _.toNumber(Number.MIN_VALUE);
 * // => 5e-324
 *
 * _.toNumber(Infinity);
 * // => Infinity
 *
 * _.toNumber('3.2');
 * // => 3.2
 */
function toNumber(value) {
  if (typeof value == 'number') {
    return value;
  }
  if (isSymbol(value)) {
    return NAN;
  }
  if (isObject(value)) {
    var other = typeof value.valueOf == 'function' ? value.valueOf() : value;
    value = isObject(other) ? (other + '') : other;
  }
  if (typeof value != 'string') {
    return value === 0 ? value : +value;
  }
  value = value.replace(reTrim, '');
  var isBinary = reIsBinary.test(value);
  return (isBinary || reIsOctal.test(value))
    ? freeParseInt(value.slice(2), isBinary ? 2 : 8)
    : (reIsBadHex.test(value) ? NAN : +value);
}

module.exports = debounce;

}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],185:[function(require,module,exports){
(function (process){(function (){
"use strict";/* Mapbox GL JS is Copyright © 2020 Mapbox and subject to the Mapbox Terms of Service ((https://www.mapbox.com/legal/tos/). */(function(global,factory){typeof exports==='object'&&typeof module!=='undefined'?module.exports=factory():typeof define==='function'&&define.amd?define(factory):(global=typeof globalThis!=='undefined'?globalThis:global||self,global.mapboxgl=factory());})(void 0,function(){'use strict';/* eslint-disable */var shared,worker,mapboxgl;// define gets called three times: one for each chunk. we rely on the order
// they're imported to know which is which
var mapboxgl$1=mapboxgl;return mapboxgl$1;});

}).call(this)}).call(this,require('_process'))
},{"_process":187}],186:[function(require,module,exports){
(function (process){(function (){
// This file replaces `index.js` in bundlers like webpack or Rollup,
// according to `browser` config in `package.json`.

if (process.env.NODE_ENV !== 'production') {
  // All bundlers will remove this block in production bundle
  if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
    throw new Error(
      'React Native does not have a built-in secure random generator. ' +
      'If you don’t need unpredictable IDs, you can use `nanoid/non-secure`. ' +
      'For secure ID install `expo-random` locally and use `nanoid/async`.'
    )
  }
  if (typeof self === 'undefined' || (!self.crypto && !self.msCrypto)) {
    throw new Error(
      'Your browser does not have secure random generator. ' +
      'If you don’t need unpredictable IDs, you can use nanoid/non-secure.'
    )
  }
}

var crypto = self.crypto || self.msCrypto

// This alphabet uses a-z A-Z 0-9 _- symbols.
// Symbols are generated for smaller size.
// -_zyxwvutsrqponmlkjihgfedcba9876543210ZYXWVUTSRQPONMLKJIHGFEDCBA
var url = '-_'
// Loop from 36 to 0 (from z to a and 9 to 0 in Base36).
var i = 36
while (i--) {
  // 36 is radix. Number.prototype.toString(36) returns number
  // in Base36 representation. Base36 is like hex, but it uses 0–9 and a-z.
  url += i.toString(36)
}
// Loop from 36 to 10 (from Z to A in Base36).
i = 36
while (i-- - 10) {
  url += i.toString(36).toUpperCase()
}

module.exports = function (size) {
  var id = ''
  var bytes = crypto.getRandomValues(new Uint8Array(size || 21))
  i = size || 21

  // Compact alternative for `for (var i = 0; i < size; i++)`
  while (i--) {
    // We can’t use bytes bigger than the alphabet. 63 is 00111111 bitmask.
    // This mask reduces random byte 0-255 to 0-63 values.
    // There is no need in `|| ''` and `* 1.6` hacks in here,
    // because bitmask trim bytes exact to alphabet size.
    id += url[bytes[i] & 63]
  }
  return id
}

}).call(this)}).call(this,require('_process'))
},{"_process":187}],187:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],188:[function(require,module,exports){
!function(root, name, make) {
  if (typeof module != 'undefined' && module.exports) module.exports = make()
  else root[name] = make()
}(this, 'subtag', function() {

  var empty = ''
  var pattern = /^([a-zA-Z]{2,3})(?:[_-]+([a-zA-Z]{3})(?=$|[_-]+))?(?:[_-]+([a-zA-Z]{4})(?=$|[_-]+))?(?:[_-]+([a-zA-Z]{2}|[0-9]{3})(?=$|[_-]+))?/

  function match(tag) {
    return tag.match(pattern) || []
  }

  function split(tag) {
    return match(tag).filter(function(v, i) { return v && i })
  }

  function api(tag) {
    tag = match(tag)
    return {
      language: tag[1] || empty,
      extlang: tag[2] || empty,
      script: tag[3] || empty,
      region: tag[4] || empty
    }
  }

  function expose(target, key, value) {
    Object.defineProperty(target, key, {
      value: value,
      enumerable: true
    })
  }

  function part(position, pattern, type) {
    function method(tag) {
      return match(tag)[position] || empty
    }
    expose(method, 'pattern', pattern)
    expose(api, type, method)
  }

  part(1, /^[a-zA-Z]{2,3}$/, 'language')
  part(2, /^[a-zA-Z]{3}$/, 'extlang')
  part(3, /^[a-zA-Z]{4}$/, 'script')
  part(4, /^[a-zA-Z]{2}$|^[0-9]{3}$/, 'region')

  expose(api, 'split', split)

  return api
});

},{}],189:[function(require,module,exports){
'use strict';

/**
 * A typeahead component for inputs
 * @class Suggestions
 *
 * @param {HTMLInputElement} el A valid HTML input element
 * @param {Array} data An array of data used for results
 * @param {Object} options
 * @param {Number} [options.limit=5] Max number of results to display in the auto suggest list.
 * @param {Number} [options.minLength=2] Number of characters typed into an input to trigger suggestions.
 * @param {Boolean} [options.hideOnBlur=true] If `true`, hides the suggestions when focus is lost.
 * @return {Suggestions} `this`
 * @example
 * // in the browser
 * var input = document.querySelector('input');
 * var data = [
 *   'Roy Eldridge',
 *   'Roy Hargrove',
 *   'Rex Stewart'
 * ];
 *
 * new Suggestions(input, data);
 *
 * // with options
 * var input = document.querySelector('input');
 * var data = [{
 *   name: 'Roy Eldridge',
 *   year: 1911
 * }, {
 *   name: 'Roy Hargrove',
 *   year: 1969
 * }, {
 *   name: 'Rex Stewart',
 *   year: 1907
 * }];
 *
 * var typeahead = new Suggestions(input, data, {
 *   filter: false, // Disable filtering
 *   minLength: 3, // Number of characters typed into an input to trigger suggestions.
 *   limit: 3, //  Max number of results to display.
 *   hideOnBlur: false // Don't hide results when input loses focus
 * });
 *
 * // As we're passing an object of an arrays as data, override
 * // `getItemValue` by specifying the specific property to search on.
 * typeahead.getItemValue = function(item) { return item.name };
 *
 * input.addEventListener('change', function() {
 *   console.log(typeahead.selected); // Current selected item.
 * });
 *
 * // With browserify
 * var Suggestions = require('suggestions');
 *
 * new Suggestions(input, data);
 */
var Suggestions = require('./src/suggestions');
module.exports = Suggestions;

if (typeof window !== 'undefined') {
  window.Suggestions = Suggestions;
}

},{"./src/suggestions":191}],190:[function(require,module,exports){
'use strict';

var List = function(component) {
  this.component = component;
  this.items = [];
  this.active = 0;
  this.wrapper = document.createElement('div');
  this.wrapper.className = 'suggestions-wrapper';
  this.element = document.createElement('ul');
  this.element.className = 'suggestions';
  this.wrapper.appendChild(this.element);

  // selectingListItem is set to true in the time between the mousedown and mouseup when clicking an item in the list
  // mousedown on a list item will cause the input to blur which normally hides the list, so this flag is used to keep
  // the list open until the mouseup
  this.selectingListItem = false;

  component.el.parentNode.insertBefore(this.wrapper, component.el.nextSibling);
  return this;
};

List.prototype.show = function() {
  this.element.style.display = 'block';
};

List.prototype.hide = function() {
  this.element.style.display = 'none';
};

List.prototype.add = function(item) {
  this.items.push(item);
};

List.prototype.clear = function() {
  this.items = [];
  this.active = 0;
};

List.prototype.isEmpty = function() {
  return !this.items.length;
};

List.prototype.isVisible = function() {
  return this.element.style.display === 'block';
};

List.prototype.draw = function() {
  this.element.innerHTML = '';

  if (this.items.length === 0) {
    this.hide();
    return;
  }

  for (var i = 0; i < this.items.length; i++) {
    this.drawItem(this.items[i], this.active === i);
  }

  this.show();
};

List.prototype.drawItem = function(item, active) {
  var li = document.createElement('li'),
    a = document.createElement('a');

  if (active) li.className += ' active';

  a.innerHTML = item.string;

  li.appendChild(a);
  this.element.appendChild(li);

  li.addEventListener('mousedown', function() {
    this.selectingListItem = true;
  }.bind(this));

  li.addEventListener('mouseup', function() {
    this.handleMouseUp.call(this, item);
  }.bind(this));
};

List.prototype.handleMouseUp = function(item) {
  this.selectingListItem = false;
  this.component.value(item.original);
  this.clear();
  this.draw();
};

List.prototype.move = function(index) {
  this.active = index;
  this.draw();
};

List.prototype.previous = function() {
  this.move(this.active === 0 ? this.items.length - 1 : this.active - 1);
};

List.prototype.next = function() {
  this.move(this.active === this.items.length - 1 ? 0 : this.active + 1);
};

List.prototype.drawError = function(msg){
  var li = document.createElement('li');

  li.innerHTML = msg;

  this.element.appendChild(li);
  this.show();
}

module.exports = List;

},{}],191:[function(require,module,exports){
'use strict';

var extend = require('xtend');
var fuzzy = require('fuzzy');
var List = require('./list');

var Suggestions = function(el, data, options) {
  options = options || {};

  this.options = extend({
    minLength: 2,
    limit: 5,
    filter: true,
    hideOnBlur: true
  }, options);

  this.el = el;
  this.data = data || [];
  this.list = new List(this);

  this.query = '';
  this.selected = null;

  this.list.draw();

  this.el.addEventListener('keyup', function(e) {
    this.handleKeyUp(e.keyCode);
  }.bind(this), false);

  this.el.addEventListener('keydown', function(e) {
    this.handleKeyDown(e);
  }.bind(this));

  this.el.addEventListener('focus', function() {
    this.handleFocus();
  }.bind(this));

  this.el.addEventListener('blur', function() {
    this.handleBlur();
  }.bind(this));

  this.el.addEventListener('paste', function(e) {
    this.handlePaste(e);
  }.bind(this));

  // use user-provided render function if given, otherwise just use the default
  this.render = (this.options.render) ? this.options.render.bind(this) : this.render.bind(this)

  this.getItemValue = (this.options.getItemValue) ? this.options.getItemValue.bind(this) : this.getItemValue.bind(this);

  return this;
};

Suggestions.prototype.handleKeyUp = function(keyCode) {
  // 40 - DOWN
  // 38 - UP
  // 27 - ESC
  // 13 - ENTER
  // 9 - TAB

  if (keyCode === 40 ||
      keyCode === 38 ||
      keyCode === 27 ||
      keyCode === 13 ||
      keyCode === 9) return;

  this.handleInputChange(this.el.value);
};

Suggestions.prototype.handleKeyDown = function(e) {
  switch (e.keyCode) {
    case 13: // ENTER
    case 9: // TAB
      if (!this.list.isEmpty()) {
        if (this.list.isVisible()) {
          e.preventDefault();
        }
        this.value(this.list.items[this.list.active].original);
        this.list.hide();
      }
    break;
    case 27: // ESC
      if (!this.list.isEmpty()) this.list.hide();
    break;
    case 38: // UP
      this.list.previous();
    break;
    case 40: // DOWN
      this.list.next();
    break;
  }
};

Suggestions.prototype.handleBlur = function() {
  if (!this.list.selectingListItem && this.options.hideOnBlur) {
    this.list.hide();
  }
};

Suggestions.prototype.handlePaste = function(e) {
  if (e.clipboardData) {
    this.handleInputChange(e.clipboardData.getData('Text'));
  } else {
    var self = this;
    setTimeout(function () {
      self.handleInputChange(e.target.value);
    }, 100);
  }
};

Suggestions.prototype.handleInputChange = function(query) {
  this.query = this.normalize(query);

  this.list.clear();

  if (this.query.length < this.options.minLength) {
    this.list.draw();
    return;
  }

  this.getCandidates(function(data) {
    for (var i = 0; i < data.length; i++) {
      this.list.add(data[i]);
      if (i === (this.options.limit - 1)) break;
    }
    this.list.draw();
  }.bind(this));
};

Suggestions.prototype.handleFocus = function() {
  if (!this.list.isEmpty()) this.list.show();
  this.list.selectingListItem = false;
};

/**
 * Update data previously passed
 *
 * @param {Array} revisedData
 */
Suggestions.prototype.update = function(revisedData) {
  this.data = revisedData;
  this.handleKeyUp();
};

/**
 * Clears data
 */
Suggestions.prototype.clear = function() {
  this.data = [];
  this.list.clear();
};

/**
 * Normalize the results list and input value for matching
 *
 * @param {String} value
 * @return {String}
 */
Suggestions.prototype.normalize = function(value) {
  value = value.toLowerCase();
  return value;
};

/**
 * Evaluates whether an array item qualifies as a match with the current query
 *
 * @param {String} candidate a possible item from the array passed
 * @param {String} query the current query
 * @return {Boolean}
 */
Suggestions.prototype.match = function(candidate, query) {
  return candidate.indexOf(query) > -1;
};

Suggestions.prototype.value = function(value) {
  this.selected = value;
  this.el.value = this.getItemValue(value);

  if (document.createEvent) {
    var e = document.createEvent('HTMLEvents');
    e.initEvent('change', true, false);
    this.el.dispatchEvent(e);
  } else {
    this.el.fireEvent('onchange');
  }
};

Suggestions.prototype.getCandidates = function(callback) {
  var options = {
    pre: '<strong>',
    post: '</strong>',
    extract: function(d) { return this.getItemValue(d); }.bind(this)
  };
  var results;
  if(this.options.filter){
    results = fuzzy.filter(this.query, this.data, options);

    results = results.map(function(item){
      return {
        original: item.original,
        string: this.render(item.original, item.string)
      };
    }.bind(this))
  }else{
    results = this.data.map(function(d) {
      var renderedString = this.render(d);
      return {
        original: d,
        string: renderedString
      };
    }.bind(this));
  }
  callback(results);
};

/**
 * For a given item in the data array, return what should be used as the candidate string
 *
 * @param {Object|String} item an item from the data array
 * @return {String} item
 */
Suggestions.prototype.getItemValue = function(item) {
  return item;
};

/**
 * For a given item in the data array, return a string of html that should be rendered in the dropdown
 * @param {Object|String} item an item from the data array
 * @param {String} sourceFormatting a string that has pre-formatted html that should be passed directly through the render function 
 * @return {String} html
 */
Suggestions.prototype.render = function(item, sourceFormatting) {
  if (sourceFormatting){
    // use existing formatting on the source string
    return sourceFormatting;
  }
  var boldString = (item.original) ? this.getItemValue(item.original) : this.getItemValue(item);
  var indexString = this.normalize(boldString);
  var indexOfQuery = indexString.lastIndexOf(this.query);
  while (indexOfQuery > -1) {
    var endIndexOfQuery = indexOfQuery + this.query.length;
    boldString = boldString.slice(0, indexOfQuery) + '<strong>' + boldString.slice(indexOfQuery, endIndexOfQuery) + '</strong>' + boldString.slice(endIndexOfQuery);
    indexOfQuery = indexString.slice(0, indexOfQuery).lastIndexOf(this.query);
  }
  return boldString
}

/**
 * Render an custom error message in the suggestions list
 * @param {String} msg An html string to render as an error message
 */
Suggestions.prototype.renderError = function(msg){
  this.list.drawError(msg);
}

module.exports = Suggestions;

},{"./list":190,"fuzzy":182,"xtend":192}],192:[function(require,module,exports){
module.exports = extend

var hasOwnProperty = Object.prototype.hasOwnProperty;

function extend() {
    var target = {}

    for (var i = 0; i < arguments.length; i++) {
        var source = arguments[i]

        for (var key in source) {
            if (hasOwnProperty.call(source, key)) {
                target[key] = source[key]
            }
        }
    }

    return target
}

},{}]},{},[1]);