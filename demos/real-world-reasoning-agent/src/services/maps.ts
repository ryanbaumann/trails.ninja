/**
 * Non-React access to Google Maps libraries. Once <APIProvider> has bootstrapped
 * the loader, `google.maps.importLibrary` resolves instantly (cached). Services
 * use these instead of the React `useMapsLibrary` hook.
 */

type Libs = {
  places: google.maps.PlacesLibrary;
  routes: google.maps.RoutesLibrary;
  marker: google.maps.MarkerLibrary;
  geometry: google.maps.GeometryLibrary;
  maps: google.maps.MapsLibrary;
  maps3d: google.maps.Maps3DLibrary;
  core: google.maps.CoreLibrary;
};

const cache = new Map<string, unknown>();

async function waitForMapsLoader(timeoutMs = 8000): Promise<typeof google.maps> {
  const started = Date.now();
  while (typeof globalThis.google === 'undefined' || !globalThis.google.maps?.importLibrary) {
    if (Date.now() - started > timeoutMs) {
      throw new Error('Google Maps JavaScript API is still loading. Try again in a moment.');
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return globalThis.google.maps;
}

export async function lib<K extends keyof Libs>(name: K): Promise<Libs[K]> {
  if (cache.has(name)) return cache.get(name) as Libs[K];
  const maps = await waitForMapsLoader();
  const loaded = (await maps.importLibrary(name)) as Libs[K];
  cache.set(name, loaded);
  return loaded;
}

/** True once the base Maps JS loader is present on the page. */
export function mapsReady(): boolean {
  return typeof globalThis.google !== 'undefined' && !!globalThis.google.maps?.importLibrary;
}

