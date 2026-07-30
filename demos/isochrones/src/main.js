import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { installAnalytics } from '../../shared/analytics.mjs';
import { containsLocation, midpoint, nearbySearchRadius } from './geo.js';
import { createPlaceDetailsContent } from './place-details.js';
import './styles.css';

installAnalytics(import.meta.env.VITE_ANALYTICS_MEASUREMENT_ID);

const API_KEY = import.meta.env.VITE_GMP_API_KEY;
const DEFAULT_CENTER = { lat: 37.7749, lng: -122.4194 };
const ORIGIN_COLORS = { a: '#22d3ee', b: '#f472b6' };
const PLACE_TYPES = {
  coffee: ['cafe', 'coffee_shop'],
  food: ['restaurant', 'cafe'],
  drinks: ['bar'],
  outdoors: ['park'],
};

const state = {
  map: null,
  markerClass: null,
  placeClass: null,
  searchRankPreference: null,
  infoWindow: null,
  origins: { a: null, b: null },
  originNames: { a: '', b: '' },
  originMarkers: { a: null, b: null },
  activeOrigin: 'a',
  polygons: [],
  placeMarkers: [],
  searchGeneration: 0,
};

const mobileSheetQuery = window.matchMedia('(max-width: 860px)');

const elements = {
  panel: document.querySelector('.panel'),
  panelContent: document.querySelector('.panel-content'),
  panelToggle: document.querySelector('#panel-toggle'),
  map: document.querySelector('#map'),
  status: document.querySelector('#status'),
  findButton: document.querySelector('#find-button'),
  locateButton: document.querySelector('#locate-button'),
  results: document.querySelector('#results'),
  resultCount: document.querySelector('#result-count'),
  modeSelect: document.querySelector('#mode-select'),
  routingSelect: document.querySelector('#routing-select'),
  placeTypeSelect: document.querySelector('#place-type-select'),
  durationInput: document.querySelector('#duration-input'),
  durationLabel: document.querySelector('#duration-label'),
  searchSlots: {
    a: document.querySelector('#search-slot-a'),
    b: document.querySelector('#search-slot-b'),
  },
  originLabels: {
    a: document.querySelector('#origin-label-a'),
    b: document.querySelector('#origin-label-b'),
  },
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
  elements.panelToggle.setAttribute('aria-label', collapsed ? 'Show meeting controls' : 'Hide meeting controls');
  elements.panelToggle.textContent = collapsed ? 'Show' : 'Hide';
}

function clearPolygons() {
  state.polygons.forEach((polygon) => polygon.setMap(null));
  state.polygons = [];
}

function clearPlaceMarkers() {
  state.infoWindow?.close();
  state.placeMarkers.forEach((marker) => { marker.map = null; });
  state.placeMarkers = [];
}

function clearResults(message = 'Real places inside both travel areas will appear here.') {
  clearPlaceMarkers();
  elements.resultCount.textContent = '';
  elements.results.replaceChildren();
  const empty = document.createElement('p');
  empty.className = 'empty';
  empty.textContent = message;
  elements.results.append(empty);
}

function invalidateResults() {
  state.searchGeneration += 1;
  clearPolygons();
  clearResults();
  elements.findButton.disabled = !(state.origins.a && state.origins.b);
  setStatus(state.origins.a && state.origins.b
    ? 'Ready to find the overlap.'
    : 'Add both starting points to begin.');
}

function setActiveOrigin(originKey) {
  state.activeOrigin = originKey;
  document.querySelectorAll('[data-origin-choice]').forEach((button) => {
    const active = button.dataset.originChoice === originKey;
    button.setAttribute('aria-pressed', String(active));
  });
  document.querySelectorAll('[data-origin-control]').forEach((control) => {
    control.classList.toggle('is-active', control.dataset.originControl === originKey);
  });
}

function markerContent(label, className) {
  const marker = document.createElement('span');
  marker.className = className;
  marker.textContent = label;
  return marker;
}

function addMarkerContent(marker, content) {
  if (typeof marker.append === 'function') {
    marker.append(content);
  } else {
    marker.content = content;
  }
}

function createOriginMarker(originKey, position) {
  const marker = new state.markerClass({
    map: state.map,
    position,
    gmpDraggable: true,
    title: originKey === 'a' ? 'Your starting point' : 'Their starting point',
  });
  addMarkerContent(marker, markerContent(originKey.toUpperCase(), `origin-map-marker origin-map-marker-${originKey}`));
  marker.addListener('dragend', ({ latLng }) => {
    setOrigin(originKey, { lat: latLng.lat(), lng: latLng.lng() }, 'Dropped pin');
  });
  return marker;
}

function setOrigin(originKey, latLng, name = '') {
  if (!Number.isFinite(latLng.lat) || !Number.isFinite(latLng.lng)
    || latLng.lat < -90 || latLng.lat > 90 || latLng.lng < -180 || latLng.lng > 180) {
    setStatus('Choose a valid point on the map.', 'error');
    return;
  }

  state.origins[originKey] = latLng;
  state.originNames[originKey] = name;
  elements.originLabels[originKey].textContent = name || `${latLng.lat.toFixed(4)}, ${latLng.lng.toFixed(4)}`;

  if (state.originMarkers[originKey]) {
    state.originMarkers[originKey].position = latLng;
  } else {
    state.originMarkers[originKey] = createOriginMarker(originKey, latLng);
  }

  setActiveOrigin(originKey === 'a' && !state.origins.b ? 'b' : originKey);
  invalidateResults();
}

function geometryOf(geoJson) {
  return geoJson.type === 'Feature' ? geoJson.geometry : geoJson;
}

function polygonCoordinates(geoJson) {
  const geometry = geometryOf(geoJson);
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
}

function geoJsonToPaths(geoJson) {
  return polygonCoordinates(geoJson)
    .map((polygon) => polygon.map((ring) => ring.map(([lng, lat]) => ({ lat, lng }))));
}

function extendBounds(bounds, geoJson) {
  polygonCoordinates(geoJson).flat(2).forEach(([lng, lat]) => bounds.extend({ lat, lng }));
}

function drawTravelArea(geoJson, originKey) {
  geoJsonToPaths(geoJson).forEach((paths) => {
    const polygon = new google.maps.Polygon({
      paths,
      map: state.map,
      strokeColor: ORIGIN_COLORS[originKey],
      strokeOpacity: 0.95,
      strokeWeight: 2.25,
      fillColor: ORIGIN_COLORS[originKey],
      fillOpacity: 0.2,
      zIndex: originKey === 'a' ? 2 : 1,
    });
    state.polygons.push(polygon);
  });
}

async function requestIsochrone(origin) {
  const minutes = Number(elements.durationInput.value);
  const response = await fetch('/api/isochrones', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      location: { latitude: origin.lat, longitude: origin.lng },
      travelDuration: `${minutes * 60}s`,
      travelMode: elements.modeSelect.value,
      travelDirection: 'FROM',
      routingPreference: elements.routingSelect.value,
      enableSmoothing: true,
      polygonFidelity: 'MEDIUM',
    }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message || payload.error || 'Could not calculate a travel area.');
  return payload.isochrone.geoJson;
}

function placeLocation(place) {
  if (!place.location) return null;
  return { lat: place.location.lat(), lng: place.location.lng() };
}

function openPlaceDetails(place, marker, shouldFocus = false) {
  state.infoWindow.setContent(createPlaceDetailsContent(place));
  state.infoWindow.open({ map: state.map, anchor: marker, shouldFocus });
}

function showPlace(place, index) {
  const location = placeLocation(place);
  if (!location) return;

  const marker = new state.markerClass({
    map: state.map,
    position: location,
    title: place.displayName || `Meeting option ${index + 1}`,
  });
  addMarkerContent(marker, markerContent(String(index + 1), 'place-map-marker'));
  marker.addListener('click', () => {
    state.map.panTo(location);
    openPlaceDetails(place, marker);
    document.querySelector(`[data-result-index="${index}"]`)?.focus();
  });
  state.placeMarkers.push(marker);

  const card = document.createElement('article');
  card.className = 'place-result';
  const main = document.createElement('button');
  main.className = 'place-result-main';
  main.type = 'button';
  main.dataset.resultIndex = String(index);
  main.addEventListener('click', () => {
    state.map.panTo(location);
    state.map.setZoom(Math.max(state.map.getZoom() || 12, 14));
    setPanelExpanded(false);
    openPlaceDetails(place, marker, true);
  });

  const number = document.createElement('span');
  number.className = 'result-number';
  number.textContent = String(index + 1);
  const copy = document.createElement('span');
  const title = document.createElement('strong');
  title.textContent = place.displayName || 'Meeting place';
  const detail = document.createElement('span');
  detail.textContent = [place.primaryTypeDisplayName, place.formattedAddress].filter(Boolean).join(' · ');
  copy.append(title, detail);
  main.append(number, copy);
  card.append(main);

  if (place.googleMapsURI) {
    const link = document.createElement('a');
    link.href = place.googleMapsURI;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'Open in Maps';
    card.append(link);
  }
  elements.results.append(card);
}

function renderPlaces(places) {
  clearPlaceMarkers();
  elements.results.replaceChildren();
  elements.resultCount.textContent = places.length ? `${places.length} options` : 'No overlap';
  if (!places.length) {
    clearResults('No matching places appeared inside both travel areas. Try more time, a different mode, or another meeting type.');
    elements.resultCount.textContent = 'No overlap';
    return;
  }
  places.forEach(showPlace);
}

async function searchSharedPlaces(firstGeoJson, secondGeoJson) {
  const center = midpoint(state.origins.a, state.origins.b);
  const request = {
    fields: ['id', 'displayName', 'formattedAddress', 'location', 'googleMapsURI', 'primaryTypeDisplayName'],
    locationRestriction: {
      center,
      radius: nearbySearchRadius(state.origins.a, state.origins.b),
    },
    includedPrimaryTypes: PLACE_TYPES[elements.placeTypeSelect.value],
    maxResultCount: 20,
    rankPreference: state.searchRankPreference.POPULARITY,
    internalUsageAttributionIds: ['gmp_git_agentskills_v1'],
  };
  const { places } = await state.placeClass.searchNearby(request);
  return (places || []).filter((place) => {
    const location = placeLocation(place);
    return location
      && containsLocation(firstGeoJson, location)
      && containsLocation(secondGeoJson, location);
  }).slice(0, 6);
}

async function findMeetingPlaces() {
  if (!state.origins.a || !state.origins.b) return;
  const generation = ++state.searchGeneration;
  elements.findButton.disabled = true;
  clearPolygons();
  clearResults('Calculating both travel areas…');
  setStatus('Calculating both travel areas…');

  try {
    const [firstGeoJson, secondGeoJson] = await Promise.all([
      requestIsochrone(state.origins.a),
      requestIsochrone(state.origins.b),
    ]);
    if (generation !== state.searchGeneration) return;

    drawTravelArea(firstGeoJson, 'a');
    drawTravelArea(secondGeoJson, 'b');
    const bounds = new google.maps.LatLngBounds();
    extendBounds(bounds, firstGeoJson);
    extendBounds(bounds, secondGeoJson);
    state.map.fitBounds(bounds, window.matchMedia('(max-width: 860px)').matches
      ? { top: 48, right: 32, bottom: 180, left: 32 }
      : { top: 48, right: 48, bottom: 48, left: 48 });

    setStatus('Finding real places inside the overlap…');
    const places = await searchSharedPlaces(firstGeoJson, secondGeoJson);
    if (generation !== state.searchGeneration) return;
    renderPlaces(places);
    setStatus(places.length
      ? `Found ${places.length} places inside both ${elements.durationInput.value}-minute travel areas.`
      : 'The travel areas do not share a matching place yet.', places.length ? 'success' : 'neutral');
    setPanelExpanded(true);
  } catch (error) {
    if (generation !== state.searchGeneration) return;
    clearResults('The meeting search could not finish. Adjust the trip and try again.');
    setStatus(error.message, 'error');
  } finally {
    if (generation === state.searchGeneration) elements.findButton.disabled = false;
  }
}

async function attachPlaceSearch(originKey) {
  const autocomplete = new google.maps.places.PlaceAutocompleteElement({
    internalUsageAttributionIds: ['gmp_git_agentskills_v1'],
  });
  autocomplete.id = `place-search-${originKey}`;
  autocomplete.placeholder = originKey === 'a' ? 'Where are you starting?' : 'Where are they starting?';
  elements.searchSlots[originKey].append(autocomplete);
  autocomplete.addEventListener('gmp-select', async ({ placePrediction }) => {
    const place = placePrediction.toPlace();
    await place.fetchFields({ fields: ['location', 'displayName'] });
    if (!place.location) return;
    const latLng = { lat: place.location.lat(), lng: place.location.lng() };
    state.map.panTo(latLng);
    setOrigin(originKey, latLng, place.displayName || 'Selected place');
  });
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
    setOrigin('a', latLng, 'Your current location');
    state.map.panTo(latLng);
    state.map.setZoom(12);
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
  elements.findButton.addEventListener('click', findMeetingPlaces);
  document.querySelectorAll('[data-origin-choice]').forEach((button) => {
    button.addEventListener('click', () => setActiveOrigin(button.dataset.originChoice));
  });
  elements.durationInput.addEventListener('input', () => {
    elements.durationLabel.textContent = `${elements.durationInput.value} minutes`;
  });
  [elements.durationInput, elements.modeSelect, elements.routingSelect, elements.placeTypeSelect]
    .forEach((control) => control.addEventListener('change', () => {
      if (control === elements.modeSelect) {
        const driving = elements.modeSelect.value === 'DRIVE';
        elements.routingSelect.disabled = !driving;
        if (!driving) elements.routingSelect.value = 'TRAFFIC_UNAWARE';
      }
      invalidateResults();
    }));
}

async function initMap() {
  if (!API_KEY) {
    setStatus('Set VITE_GMP_API_KEY to load Google Maps and Places.', 'error');
    return;
  }

  setOptions({ key: API_KEY, v: 'weekly', authReferrerPolicy: 'origin' });
  try {
    const [{ Map, InfoWindow }, { AdvancedMarkerElement }, placesLibrary] = await Promise.all([
      importLibrary('maps'),
      importLibrary('marker'),
      importLibrary('places'),
    ]);
    state.markerClass = AdvancedMarkerElement;
    state.placeClass = placesLibrary.Place;
    state.searchRankPreference = placesLibrary.SearchNearbyRankPreference;
    state.infoWindow = new InfoWindow();
    state.map = new Map(elements.map, {
      center: DEFAULT_CENTER,
      zoom: 10,
      mapId: '9e6b48a5b3653026f9d7556d',
      colorScheme: 'DARK',
      clickableIcons: false,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      internalUsageAttributionIds: ['gmp_git_agentskills_v1'],
    });
  } catch (error) {
    console.error('Google Maps failed to load:', error);
    setStatus('Google Maps failed to load. Check the browser key and enabled APIs.', 'error');
    return;
  }

  state.map.addListener('click', ({ latLng }) => {
    setOrigin(state.activeOrigin, { lat: latLng.lat(), lng: latLng.lng() }, 'Dropped pin');
  });
  await Promise.all([attachPlaceSearch('a'), attachPlaceSearch('b')]);
}

bindUi();
initMap().catch((error) => {
  console.error('Initialization failed:', error);
  setStatus(`Initialization failed: ${error.message}`, 'error');
});
