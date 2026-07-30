import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { installAnalytics } from '../../shared/analytics.mjs';
import { AIR_QUALITY_HOST, LAYERS, heatmapTileUrl } from './layers.js';
import './styles.css';

installAnalytics(import.meta.env.VITE_ANALYTICS_MEASUREMENT_ID);

const API_KEY = import.meta.env.VITE_GMP_API_KEY;
const DEFAULT_CENTER = { lat: 37.7749, lng: -122.4194 };
const SOLUTION_ID = 'gmp_git_agentskills_v1';

const state = {
  map: null,
  markerClass: null,
  heatmapLayer: null,
  marker: null,
  activeLayer: 'US_AQI',
  opacity: 0.7,
  lookupController: null,
};

const mobileSheetQuery = window.matchMedia('(max-width: 860px)');

const elements = {
  panel: document.querySelector('.panel'),
  panelContent: document.querySelector('.panel-content'),
  panelToggle: document.querySelector('#panel-toggle'),
  map: document.querySelector('#map'),
  status: document.querySelector('#status'),
  locateButton: document.querySelector('#locate-button'),
  layerSelect: document.querySelector('#layer-select'),
  opacityInput: document.querySelector('#opacity-input'),
  opacityLabel: document.querySelector('#opacity-label'),
  legendBar: document.querySelector('#legend-bar'),
  legendMin: document.querySelector('#legend-min'),
  legendMax: document.querySelector('#legend-max'),
  searchSlot: document.querySelector('#search-slot'),
  conditions: document.querySelector('#conditions'),
  locationLabel: document.querySelector('#location-label'),
  aqiValue: document.querySelector('#aqi-value'),
  aqiCategory: document.querySelector('#aqi-category'),
  aqiIndexName: document.querySelector('#aqi-index-name'),
  aqiPollutant: document.querySelector('#aqi-pollutant'),
  pollutantList: document.querySelector('#pollutant-list'),
  pollutantDetails: document.querySelector('#pollutant-details'),
  pollutantEffects: document.querySelector('#pollutant-effects'),
  pollutantSources: document.querySelector('#pollutant-sources'),
  generalGuidance: document.querySelector('#general-guidance'),
  sensitiveGuidanceWrap: document.querySelector('#sensitive-guidance-wrap'),
  sensitiveGuidance: document.querySelector('#sensitive-guidance'),
  aqiTime: document.querySelector('#aqi-time'),
};

function setStatus(message, tone = 'neutral') {
  elements.status.textContent = message;
  elements.status.dataset.tone = tone;
}

function setPanelExpanded(expanded) {
  const collapsed = !expanded && mobileSheetQuery.matches;
  elements.panel.dataset.collapsed = String(collapsed);
  elements.panelContent.inert = collapsed;
  elements.panelToggle.setAttribute('aria-expanded', String(!collapsed));
  elements.panelToggle.setAttribute('aria-label', collapsed ? 'Show air quality details' : 'Hide air quality details');
  elements.panelToggle.textContent = collapsed ? 'Show' : 'Hide';
}

function applyLegend() {
  const layer = LAYERS[state.activeLayer];
  elements.legendBar.style.background = layer.gradient;
  elements.legendMin.textContent = layer.min;
  elements.legendMax.textContent = layer.max;
}

function applyHeatmap() {
  if (!state.map) return;
  state.map.overlayMapTypes.clear();
  state.heatmapLayer = new google.maps.ImageMapType({
    getTileUrl: (coordinate, zoom) => {
      return heatmapTileUrl(state.activeLayer, coordinate, zoom, API_KEY);
    },
    tileSize: new google.maps.Size(256, 256),
    maxZoom: 16,
    opacity: state.opacity,
    name: 'Air quality',
  });
  state.map.overlayMapTypes.push(state.heatmapLayer);
}

function rgbFromApiColor(color = {}) {
  const channel = (value) => Math.round((value || 0) * 255);
  return { red: channel(color.red), green: channel(color.green), blue: channel(color.blue) };
}

function readableTextColor({ red, green, blue }) {
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.58 ? '#08111f' : '#ffffff';
}

function pickIndex(indexes = []) {
  const preferred = LAYERS[state.activeLayer].indexCode;
  return indexes.find((index) => index.code === preferred) || indexes[0] || null;
}

function formatConcentration(concentration) {
  if (!concentration) return '';
  const units = {
    MICROGRAMS_PER_CUBIC_METER: 'µg/m³',
    PARTS_PER_BILLION: 'ppb',
    PARTS_PER_MILLION: 'ppm',
  };
  return `${concentration.value} ${units[concentration.units] || String(concentration.units || '').toLowerCase().replaceAll('_', ' ')}`.trim();
}

function renderPollutants(payload, dominantCode) {
  const pollutants = [...(payload.pollutants || [])]
    .sort((first, second) => Number(second.code === dominantCode) - Number(first.code === dominantCode))
    .slice(0, 4);
  elements.pollutantList.replaceChildren();
  pollutants.forEach((pollutant) => {
    const item = document.createElement('li');
    const name = document.createElement('strong');
    name.textContent = pollutant.displayName || pollutant.code;
    const value = document.createElement('span');
    value.textContent = formatConcentration(pollutant.concentration);
    item.append(name, value);
    elements.pollutantList.append(item);
  });

  const dominant = pollutants.find((pollutant) => pollutant.code === dominantCode);
  const additionalInfo = dominant?.additionalInfo;
  elements.pollutantDetails.hidden = !(additionalInfo?.effects || additionalInfo?.sources);
  elements.pollutantEffects.textContent = additionalInfo?.effects ? `Health effects: ${additionalInfo.effects}` : '';
  elements.pollutantSources.textContent = additionalInfo?.sources ? `Common sources: ${additionalInfo.sources}` : '';
}

function renderGuidance(recommendations = {}) {
  elements.generalGuidance.textContent = recommendations.generalPopulation
    || 'No general-population guidance was returned for this point.';
  const groups = [
    ['People with lung conditions', recommendations.lungDiseasePopulation],
    ['People with heart conditions', recommendations.heartDiseasePopulation],
    ['Older adults', recommendations.elderly],
    ['Children', recommendations.children],
    ['Pregnant people', recommendations.pregnantWomen],
    ['Athletes', recommendations.athletes],
  ].filter(([, guidance]) => guidance);
  elements.sensitiveGuidanceWrap.hidden = groups.length === 0;
  elements.sensitiveGuidance.replaceChildren();
  groups.forEach(([label, guidance]) => {
    const item = document.createElement('p');
    const heading = document.createElement('strong');
    heading.textContent = `${label}: `;
    item.append(heading, guidance);
    elements.sensitiveGuidance.append(item);
  });
}

function renderConditions(payload, latLng, locationName) {
  const index = pickIndex(payload.indexes);
  if (!index) {
    elements.conditions.hidden = true;
    setStatus('No air quality data is available for that point.', 'error');
    return;
  }

  elements.conditions.hidden = false;
  elements.locationLabel.textContent = locationName || 'Selected map point';
  elements.aqiValue.textContent = index.aqiDisplay || String(index.aqi ?? '–');
  const color = rgbFromApiColor(index.color);
  elements.aqiValue.style.background = `rgb(${color.red}, ${color.green}, ${color.blue})`;
  elements.aqiValue.style.color = readableTextColor(color);
  elements.aqiCategory.textContent = index.category || '';
  elements.aqiIndexName.textContent = index.displayName || index.code;
  elements.aqiPollutant.textContent = index.dominantPollutant
    ? `Dominant: ${index.dominantPollutant.toUpperCase()}`
    : '';

  renderGuidance(payload.healthRecommendations);
  renderPollutants(payload, index.dominantPollutant);

  const time = payload.dateTime ? new Date(payload.dateTime) : null;
  elements.aqiTime.textContent = time
    ? time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : 'Current';
  setStatus(`Current conditions loaded for ${latLng.lat.toFixed(3)}, ${latLng.lng.toFixed(3)}.`, 'success');
  setPanelExpanded(true);
}

async function lookupConditions(latLng, locationName = '') {
  if (!Number.isFinite(latLng.lat) || !Number.isFinite(latLng.lng)
    || latLng.lat < -90 || latLng.lat > 90 || latLng.lng < -180 || latLng.lng > 180) {
    setStatus('Choose a valid point on the map.', 'error');
    return;
  }

  state.lookupController?.abort();
  state.lookupController = new AbortController();
  setStatus('Checking current air quality…');
  placeMarker(latLng);

  try {
    const response = await fetch(`${AIR_QUALITY_HOST}/currentConditions:lookup?key=${API_KEY}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Goog-Maps-Solution-ID': SOLUTION_ID,
      },
      signal: state.lookupController.signal,
      body: JSON.stringify({
        location: { latitude: latLng.lat, longitude: latLng.lng },
        universalAqi: true,
        extraComputations: [
          'LOCAL_AQI',
          'HEALTH_RECOMMENDATIONS',
          'DOMINANT_POLLUTANT_CONCENTRATION',
          'POLLUTANT_CONCENTRATION',
          'POLLUTANT_ADDITIONAL_INFO',
        ],
        languageCode: 'en',
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message || 'Air Quality API request failed.');
    renderConditions(payload, latLng, locationName);
  } catch (error) {
    if (error.name === 'AbortError') return;
    elements.conditions.hidden = true;
    setStatus(error.message, 'error');
  }
}

function addMarkerContent(marker, content) {
  if (typeof marker.append === 'function') {
    marker.append(content);
  } else {
    marker.content = content;
  }
}

function placeMarker(latLng) {
  if (state.marker) {
    state.marker.position = latLng;
    return;
  }
  state.marker = new state.markerClass({
    map: state.map,
    position: latLng,
    title: 'Air quality lookup point',
  });
  const markerContent = document.createElement('span');
  markerContent.className = 'lookup-marker';
  markerContent.setAttribute('aria-hidden', 'true');
  addMarkerContent(state.marker, markerContent);
}

async function attachPlaceSearch(PlaceAutocompleteElement) {
  try {
    const autocomplete = new PlaceAutocompleteElement({
      internalUsageAttributionIds: [SOLUTION_ID],
    });
    autocomplete.id = 'place-search';
    autocomplete.placeholder = 'Search a city, address, or ZIP';
    elements.searchSlot.append(autocomplete);
    autocomplete.addEventListener('gmp-select', async ({ placePrediction }) => {
      const place = placePrediction.toPlace();
      await place.fetchFields({ fields: ['location', 'viewport', 'displayName'] });
      if (!place.location) return;
      const latLng = { lat: place.location.lat(), lng: place.location.lng() };
      if (place.viewport) {
        state.map.fitBounds(place.viewport, { top: 72, right: 48, bottom: 180, left: 48 });
      } else {
        state.map.setCenter(latLng);
        state.map.setZoom(10);
      }
      lookupConditions(latLng, place.displayName || 'Selected place');
    });
  } catch (error) {
    console.warn('Place search unavailable:', error);
    elements.searchSlot.textContent = 'Search is unavailable for this key. Tap the map instead.';
  }
}

function useCurrentLocation() {
  if (!navigator.geolocation) {
    setStatus('This browser does not provide location access.', 'error');
    return;
  }
  elements.locateButton.disabled = true;
  setStatus('Getting your location…');
  navigator.geolocation.getCurrentPosition(({ coords }) => {
    const latLng = { lat: coords.latitude, lng: coords.longitude };
    state.map.setCenter(latLng);
    state.map.setZoom(11);
    lookupConditions(latLng, 'Your location');
    elements.locateButton.disabled = false;
  }, (error) => {
    const message = error.code === error.PERMISSION_DENIED
      ? 'Location access was declined. Search or tap the map instead.'
      : 'Your location is unavailable right now. Search or tap the map instead.';
    setStatus(message, 'error');
    elements.locateButton.disabled = false;
  }, { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 });
}

function bindUi() {
  elements.panelToggle.addEventListener('click', () => {
    setPanelExpanded(elements.panel.dataset.collapsed === 'true');
  });
  elements.locateButton.addEventListener('click', useCurrentLocation);
  mobileSheetQuery.addEventListener('change', () => setPanelExpanded(true));
  elements.layerSelect.addEventListener('change', () => {
    state.activeLayer = elements.layerSelect.value;
    applyLegend();
    applyHeatmap();
  });
  elements.opacityInput.addEventListener('input', () => {
    state.opacity = Number(elements.opacityInput.value) / 100;
    elements.opacityLabel.textContent = `${elements.opacityInput.value}%`;
    if (state.heatmapLayer) state.heatmapLayer.setOpacity(state.opacity);
  });
  applyLegend();
}

async function init() {
  bindUi();
  if (!API_KEY) {
    setStatus('Set VITE_GMP_API_KEY with Maps JavaScript, Places, and Air Quality enabled.', 'error');
    return;
  }

  setOptions({ key: API_KEY, v: 'weekly', authReferrerPolicy: 'origin' });
  let Map;
  let PlaceAutocompleteElement;
  try {
    const [mapsLibrary, markerLibrary, placesLibrary] = await Promise.all([
      importLibrary('maps'),
      importLibrary('marker'),
      importLibrary('places'),
    ]);
    ({ Map } = mapsLibrary);
    state.markerClass = markerLibrary.AdvancedMarkerElement;
    ({ PlaceAutocompleteElement } = placesLibrary);
  } catch (error) {
    console.error('Google Maps failed to load:', error);
    setStatus('Google Maps failed to load. Check the browser key and enabled APIs.', 'error');
    return;
  }

  state.map = new Map(elements.map, {
    center: DEFAULT_CENTER,
    zoom: 9,
    mapId: '9e6b48a5b3653026f9d7556d',
    colorScheme: 'DARK',
    clickableIcons: false,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true,
    internalUsageAttributionIds: [SOLUTION_ID],
  });

  applyHeatmap();
  attachPlaceSearch(PlaceAutocompleteElement);
  state.map.addListener('click', ({ latLng }) => {
    lookupConditions({ lat: latLng.lat(), lng: latLng.lng() }, 'Selected map point');
  });
}

init().catch((error) => {
  console.error('Initialization failed:', error);
  setStatus(`Initialization failed: ${error.message}`, 'error');
});
