import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Box, Code2, KeyRound, Map as MapIcon } from 'lucide-react';
import { useAtlas } from '@/state/store';
import { getGeminiCredentialSnapshot, subscribeGeminiCredential } from '@/ai/client';
import { lib } from '@/services/maps';
import { placeDetails } from '@/services/places';
import { SCENARIOS } from '@/scenarios/registry';
import { HowItsBuilt } from '@/shell/HowItsBuilt';
import { GeminiKeyDialog } from '@/shell/GeminiKeyDialog';

export function StatusBar() {
  const report = useAtlas((s) => s.cameraReport);
  const health = useAtlas((s) => s.apiHealth);
  const cities = useAtlas((s) => s.cities);
  const cityId = useAtlas((s) => s.cityId);
  const [howOpen, setHowOpen] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);
  const credential = useSyncExternalStore(
    subscribeGeminiCredential,
    getGeminiCredentialSnapshot,
    getGeminiCredentialSnapshot,
  );
  const dot = health === 'ok' ? 'var(--good)' : health === 'degraded' ? 'var(--warn)' : 'var(--bad)';
  const healthLabel = health === 'ok' ? 'live' : health === 'degraded' ? 'degraded' : 'offline';
  const healthTitle =
    health === 'ok'
      ? 'Maps renderer is live'
      : health === 'degraded'
        ? 'Degraded — some services slow or failing'
        : 'Offline — Google Maps failed to load';

  return (
    <>
    <div className="glass atlas-statusbar">
      <span className="atlas-statusbar__brand">ATLAS</span>
      {report && (
        <span className="atlas-statusbar__coords atlas-statusbar__hide-sm">
          {report.lat.toFixed(4)}, {report.lng.toFixed(4)}
          {report.zoom != null ? ` · z${report.zoom.toFixed(1)}` : ''}
        </span>
      )}
      <span className="atlas-statusbar__health" title={healthTitle}>
        <span className="atlas-statusbar__dot" style={{ background: dot }} />
        <span className="atlas-statusbar__hide-xs">{healthLabel}</span>
      </span>
      <span className="atlas-statusbar__sep atlas-statusbar__hide-sm">·</span>
      <MapModeToggle />
      <span className="atlas-statusbar__sep">·</span>
      <button
        type="button"
        className="atlas-statusbar__link"
        onClick={() => setHowOpen(true)}
        title="See the prompt and tools behind this journey"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          color: 'inherit',
          font: 'inherit',
          padding: 0,
        }}
      >
        <Code2 size={13} aria-hidden="true" />
        <span className="atlas-statusbar__hide-xs">How it's built</span>
      </button>
      <span className="atlas-statusbar__sep">·</span>
      <button
        type="button"
        className="atlas-statusbar__link atlas-statusbar__service"
        onClick={() => setKeyOpen(true)}
        title={credential.source === 'byok' ? 'Personal Gemini key connected for this tab' : 'Connect or manage a Gemini key'}
      >
        <KeyRound size={13} aria-hidden="true" />
        <span className="atlas-statusbar__hide-xs">{credential.source === 'byok' ? 'Personal AI' : 'AI key'}</span>
      </button>
      <span className="atlas-statusbar__sep">·</span>
      <a
        className="atlas-statusbar__link atlas-statusbar__service"
        href="https://github.com/ryanbaumann/fieldwork/tree/main/demos/real-world-reasoning-agent"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="View Atlas source in the Fieldwork repository"
        title="View source in Fieldwork"
      >
        <Code2 size={13} aria-hidden="true" />
        <span className="atlas-statusbar__hide-xs">Source</span>
      </a>
      <span className="atlas-statusbar__sep">·</span>
      <select
        className="atlas-statusbar__city"
        value={cityId}
        onChange={(e) => useAtlas.getState().setCityId(e.target.value)}
        aria-label="City"
      >
        {cities.map((c) => (
          <option key={c.id} value={c.id} style={{ background: '#111827' }}>
            {c.name}
          </option>
        ))}
      </select>
      <PlaceAutocompleteSearch />
    </div>
    <HowItsBuilt open={howOpen} onClose={() => setHowOpen(false)} />
    <GeminiKeyDialog open={keyOpen} onClose={() => setKeyOpen(false)} />
    </>
  );
}

/**
 * Switch the map between the 2D vector basemap and the photorealistic 3D map.
 *
 * Until now `mapMode` was only ever set from the active recipe's static
 * declaration, so photoreal 3D was reachable only by choosing Cinema, and there
 * was no way back. Making it a real control also means the agent's `map.fly`
 * effects resolve to genuine 3D fly-overs (see `applyAtlasEffects`) in whatever
 * recipe you are in, rather than pitching the flat map.
 */
function MapModeToggle() {
  const mode = useAtlas((s) => s.mapMode);
  const setMapMode = useAtlas((s) => s.setMapMode);
  const is3d = mode === '3d';
  return (
    <button
      type="button"
      className="atlas-statusbar__link atlas-statusbar__service"
      onClick={() => setMapMode(is3d ? '2d' : '3d')}
      aria-pressed={is3d}
      title={is3d ? 'Photorealistic 3D — switch back to the 2D map' : 'Switch to the photorealistic 3D map'}
    >
      {is3d ? <Box size={13} aria-hidden="true" /> : <MapIcon size={13} aria-hidden="true" />}
      <span className="atlas-statusbar__hide-xs">{is3d ? '3D' : '2D'}</span>
    </button>
  );
}

function PlaceAutocompleteSearch() {
  const hostRef = useRef<HTMLSpanElement>(null);
  type PlaceAutocompleteEl = HTMLElement & { 
    placeholder?: string; 
    requestedLanguage?: string; 
    requestedRegion?: string;
    includedRegionCodes?: string[];
  };
  const setMarkers = useAtlas((s) => s.setMarkers);
  const selectMarker = useAtlas((s) => s.selectMarker);
  const setCamera = useAtlas((s) => s.setCamera);
  const pushToast = useAtlas((s) => s.pushToast);
  const cityId = useAtlas((s) => s.cityId);
  const cities = useAtlas((s) => s.cities);
  const preset = cities.find((c) => c.id === cityId) ?? cities[0];

  useEffect(() => {
    let disposed = false;
    let element: PlaceAutocompleteEl | null = null;
    const onSelect = async (event: Event) => {
      const customEvent = event as Event & {
        placePrediction?: { toPlace?: () => google.maps.places.Place };
        detail?: { placePrediction?: { toPlace?: () => google.maps.places.Place } };
      };
      const place = customEvent.placePrediction?.toPlace?.() ?? customEvent.detail?.placePrediction?.toPlace?.();
      if (!place) return;
      try {
        await place.fetchFields({ fields: ['id', 'displayName', 'location', 'formattedAddress', 'rating', 'photos'] });
        if (disposed || !place.location) return;
        const id = place.id;
        const marker = {
          id: `search-${id}`,
          position: { lat: place.location.lat(), lng: place.location.lng() },
          title: place.displayName ?? 'Selected place',
          glyph: '⌕',
          color: '#6d5ef3',
          kind: 'pin' as const,
          placeId: id,
        };
        setMarkers([marker]);
        selectMarker(marker.id);
        setCamera({ kind: 'fly', center: marker.position, zoom: 16.5 });
        if (id) void placeDetails(id).catch(() => undefined);

        // Notify active scenario
        const scenarioId = useAtlas.getState().activeScenario;
        const scenarioMod = SCENARIOS[scenarioId];
        if (scenarioMod?.onPlaceSelect) {
          void scenarioMod.onPlaceSelect(place);
        }
      } catch (err) {
        pushToast('warn', `Place selection failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    };

    void (async () => {
      await lib('places');
      if (disposed || !hostRef.current) return;
      const ctor = customElements.get('gmp-place-autocomplete');
      if (!ctor) return;
      element = new ctor() as PlaceAutocompleteEl;
      element.className = 'atlas-place-autocomplete';
      element.placeholder = 'Search places';
      element.requestedLanguage = 'en';
      element.requestedRegion = preset.country;
      element.includedRegionCodes = [preset.country];
      element.addEventListener('gmp-select', onSelect);
      hostRef.current.replaceChildren(element);
    })();

    return () => {
      disposed = true;
      element?.removeEventListener('gmp-select', onSelect);
      hostRef.current?.replaceChildren();
    };
  }, [preset.country, pushToast, selectMarker, setCamera, setMarkers]);

  return <span className="atlas-place-autocomplete-host" ref={hostRef} aria-label="Search places with Places UI Kit" />;
}
