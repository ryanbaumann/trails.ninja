# Migration Plan: Strava Explorer (Mapbox GL JS to GMP Photorealistic 3D)

**Goal:** Migrate the `strava-explorer` application from Mapbox GL JS to Google Maps Platform Maps JavaScript API (`v=alpha`), leveraging Photorealistic 3D Tiles, while maintaining existing functionality (Strava auth, activity display, polyline rendering, photo markers/popups). Replace Mapbox Geocoder with Google Places Autocomplete. Investigate alternatives for the snapshot feature.

**Target Stack:** Google Maps Platform Maps JavaScript API (`v=alpha` with `maps`, `places`, `maps3d` libraries), `Polyline3DElement`, `Marker3DInteractiveElement`, `InfoWindow`, Places Autocomplete, Vanilla JS, Vite, Tailwind CSS, Strava API.

---

**Phase 1: Setup and Basic Map Initialization**

1.  **Google Cloud Project Setup:**
    *   Ensure a Google Cloud Project exists with billing enabled.
    *   Enable APIs: "Maps JavaScript API", "Map Tiles API", "Places API".
    *   Create and restrict an API Key (for JS API, Map Tiles, Places).
2.  **Environment Variable Update (`strava-explorer/.env`):**
    *   Remove `VITE_MAPBOX_ACCESS_TOKEN`.
    *   Add `VITE_GMP_API_KEY=YOUR_GMP_API_KEY`.
    *   Ensure `.env` is in `.gitignore`.
3.  **HTML Modification (`index.html`):**
    *   Remove Mapbox GL JS CSS link.
    *   Remove Mapbox Geocoder CSS link.
    *   Remove Mapbox Geocoder JS script.
    *   Replace `<script type="module" src="/index.js">` with the GMP JS API asynchronous loader script, loading `maps`, `places`, and `maps3d` libraries from `v=alpha`. The loader should call a global `initializeApp` function on success.

    ```html
    <!-- Placeholder for GMP Loader Script -->
    <script>
      (g=>{var h,a,k,p="The Google Maps JavaScript API",c="google",l="importLibrary",q="__ib__",m=document,b=window;b=b[c]||(b[c]={});var d=b.maps||(b.maps={}),r=new Set,e=new URLSearchParams,u=()=>h||(h=new Promise(async(f,n)=>{await (a=m.createElement("script"));e.set("libraries",[...r]+"");for(k in g)e.set(k.replace(/[A-Z]/g,t=>"_"+t[0].toLowerCase()),g[k]);e.set("callback",c+".maps."+q);a.src=`https://maps.${c}apis.com/maps/api/js?`+e;d[q]=f;a.onerror=()=>h=n(Error(p+" could not load."));a.nonce=m.querySelector("script[nonce]")?.nonce||"";m.head.append(a)}));d[l]?console.warn(p+" only loads once. Ignoring:",g):d[l]=(f,...n)=>r.add(f)&&u().then(()=>d[l])})({
        key: import.meta.env.VITE_GMP_API_KEY, // Access key via Vite env var
        v: "alpha",
        libraries: "maps,places,maps3d"
      }).then(() => {
        initializeApp(); // Call global init function
      }).catch(e => console.error("Error loading Google Maps API", e));

      function initializeApp() {
        import('/index.js').then(module => {
          module.initApp(); // Call exported function from index.js
        }).catch(e => console.error("Error loading app module", e));
      }
    </script>
    ```
4.  **JavaScript Initialization (`index.js`):**
    *   Remove Mapbox GL JS imports.
    *   Remove Mapbox token assignment.
    *   Export a new `async function initApp()`.
    *   Inside `initApp`:
        *   Import necessary GMP libraries: `const { Map } = await google.maps.importLibrary("maps");`, `const { Polyline3DElement, Marker3DInteractiveElement, AltitudeMode } = await google.maps.importLibrary("maps3d");`, `const { InfoWindow } = await google.maps.importLibrary("marker");`, `const { Autocomplete } = await google.maps.importLibrary("places");`.
        *   Instantiate `google.maps.Map` targeting `#map`.
        *   Set `MapOptions`:
            *   `center`: `{lat: 32.6141, lng: -114.34411}`
            *   `zoom`: `3` (or adjust)
            *   `tilt`: `75`
            *   `heading`: `0`
            *   `disableDefaultUI: true` (or configure specific controls later)
    *   Refactor existing code into `initApp` or functions called by it.

**Phase 2: Feature Migration**

5.  **Strava Authentication & Data Fetching:**
    *   Logic remains largely unchanged. Verify `import.meta.env` access for Strava keys.
6.  **Polyline Display (Revised):**
    *   Remove Mapbox source/layer logic.
    *   Keep polyline decoding logic (`@mapbox/polyline`, `@turf/helpers`, `@turf/bbox`).
    *   Inside `displayDetailedActivity`:
        *   Decode polyline to `[{lat: ..., lng: ...}, ...]` format.
        *   Create `new Polyline3DElement({...})` with coordinates, styling (`strokeColor: 'orange'`, `strokeWidth: 10`), and `altitudeMode: AltitudeMode.CLAMP_TO_GROUND`.
        *   Add to map: `routePolyline.map = map;`. Store reference.
    *   Update activity change logic: `previousPolyline.map = null;` before adding new one.
7.  **Map Bounds/Camera:**
    *   Replace `map.fitBounds(mapboxBounds, ...)` with GMP `map.fitBounds(googleLatLngBounds, padding)`. Convert bbox format.
    *   After `fitBounds`, re-apply `map.setTilt(75);` and potentially adjust heading/zoom.
8.  **Geocoder Replacement:**
    *   Remove Mapbox Geocoder control.
    *   Add `<input type="text" id="pac-input">` to `index.html`.
    *   In `initApp`:
        *   Get input element.
        *   Create `new Autocomplete(input, { fields: ["place_id", "geometry", "name"] });`.
        *   Add `place_changed` listener to fit map bounds (`map.fitBounds`, then `map.setTilt(75)`) or center/zoom (`map.setCenter`, `map.setZoom`, `map.setTilt(75)`) based on `place.geometry`.
9.  **Map Controls:**
    *   Remove Mapbox controls.
    *   Add desired GMP controls via `map.setOptions({ fullscreenControl: true, zoomControl: true, ... });`.
10. **Strava Photo Popups (Revised):**
    *   Remove Mapbox Popup logic.
    *   Inside `getPhotos`:
        *   Clear previous markers/InfoWindows.
        *   For each photo:
            *   Create HTML content string (`el.outerHTML`).
            *   Create `new InfoWindow({ content: el.outerHTML });`.
            *   Create `new Marker3DInteractiveElement({ position: {lat, lng}, altitudeMode: AltitudeMode.CLAMP_TO_GROUND });`.
            *   Add `'gmp-click'` listener to the marker: `marker.addEventListener('gmp-click', () => { infowindow.open({ map: map, anchor: marker }); });`.
            *   Add marker to map: `marker.map = map;`.
            *   Store references to marker and infowindow.
    *   Update cleanup logic: `marker.map = null;`, `infowindow.close();`.

**Phase 3: Snapshot Functionality & Cleanup**

11. **Snapshot Feature Investigation:**
    *   Acknowledge complexity with 3D/WebGL capture in `v=alpha`. `map.getCanvas()` likely won't work.
    *   **Initial Action:** Comment out existing snapshot logic (`take_snap` listener, `textbox`, `logo` functions). Revisit post-migration. Explore alternatives like `html2canvas` or accept limitations.
12. **Dependency Cleanup:**
    *   `npm uninstall mapbox-gl @mapbox/mapbox-gl-geocoder` (or `yarn remove ...`).
    *   Keep `@mapbox/polyline`, `@turf/bbox`, `@turf/helpers`.
    *   Optional: `npm install --save-dev @types/google.maps`.
    *   Run `npm install` / `yarn install`.
13. **Code Refinement & Testing:**
    *   Test all features thoroughly: Auth, activity selection, polyline rendering/updates, camera control (`fitBounds`, tilt), Places Autocomplete, photo markers/InfoWindows, map controls.
    *   Refactor for clarity, error handling, and async/await usage.

**Potential Challenges:**

*   API Differences (Camera control, event handling).
*   Performance of Photorealistic 3D Tiles.
*   `v=alpha` stability and potential API changes.
*   Snapshot feature implementation.
*   Adding 3D elements to the map (`.map = map` vs. DOM manipulation - verify correct method).
*   Altitude handling for polylines/markers if `CLAMP_TO_GROUND` isn't sufficient.

---