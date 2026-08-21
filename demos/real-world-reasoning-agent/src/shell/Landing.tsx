import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowRight, ArrowUpRight, KeyRound, LocateFixed, MapPin, ShieldCheck, Sparkles, X } from 'lucide-react';
import { GMP_BROWSER_KEY } from '@/lib/config';
import { getGeminiCredentialSnapshot, subscribeGeminiCredential } from '@/ai/client';
import type { LatLng } from '@/lib/types';
import { useAtlas } from '@/state/store';
import { startExplorerJourney } from '@/explorer/controller';
import { preflightCapabilities, type CapabilityStatus } from './capabilityPreflight';
import { useGenui } from '@/genui/store';

const DEFAULT_GOAL = 'Find a nearby café with the shortest verified walk; tell me whether I need a jacket.';
const EXAMPLES = [
  { label: 'Café · walk', prompt: 'Find a nearby café with the shortest verified walk.' },
  { label: 'Lunch + jacket', prompt: 'Find a nearby lunch spot with the shortest verified walk; tell me if I need a jacket.' },
  { label: 'Errand · drive', prompt: 'Find a nearby errand stop with the shortest verified drive.' },
];

type LocationState = 'sample' | 'locating' | 'using' | 'error';
export function Landing() {
  const dismissed = useAtlas((state) => state.landingDismissed);
  const cityId = useAtlas((state) => state.cityId);
  const cities = useAtlas((state) => state.cities);
  const apiHealth = useAtlas((state) => state.apiHealth);
  const setKeyDialogOpen = useAtlas((state) => state.setKeyDialogOpen);
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [locationState, setLocationState] = useState<LocationState>('sample');
  const [selectedLocation, setSelectedLocation] = useState<LatLng | null>(null);
  const credential = useSyncExternalStore(
    subscribeGeminiCredential,
    getGeminiCredentialSnapshot,
    getGeminiCredentialSnapshot,
  );
  const [capabilities, setCapabilities] = useState<CapabilityStatus | null>(null);
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false);
  const originalCityId = useRef(cityId);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setCapabilities(null);
    void preflightCapabilities(
      Boolean(GMP_BROWSER_KEY),
      apiHealth,
      credential.source === 'byok',
      controller.signal,
    ).then((status) => {
      if (active) setCapabilities(status);
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [apiHealth, credential.epoch, credential.source, online]);

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine !== false);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  if (dismissed) return null;

  const sampleCity = cities.find((item) => item.id === originalCityId.current) ?? cities[0];
  const liveStatus = capabilities?.mode === 'live' ? 'ready' : capabilities ? 'unavailable' : 'checking';
  const mapsReady = Boolean(
    capabilities?.browserMaps && capabilities.serverMaps && capabilities.online && capabilities.apiHealth === 'ok',
  );
  const needsGemini = mapsReady && capabilities?.gemini === false;
  const hostedGemini = Boolean(capabilities?.gemini && credential.source !== 'byok');

  const chooseExample = (example: string) => {
    setGoal(example);
    promptRef.current?.focus();
  };

  const stopUsingLocation = () => {
    setSelectedLocation(null);
    setLocationState('sample');
  };

  const useMyLocation = () => {
    if (locationState === 'using') {
      stopUsingLocation();
      return;
    }
    if (!navigator.geolocation) {
      setLocationState('error');
      return;
    }

    setLocationState('locating');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const center = { lat: position.coords.latitude, lng: position.coords.longitude };
        setSelectedLocation(center);
        setLocationState('using');
      },
      () => setLocationState('error'),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  };

  const start = () => {
    if (liveStatus !== 'ready') return;
    startExplorerJourney({
      goal: goal.trim() || DEFAULT_GOAL,
      cityId,
      mode: 'live',
      location: selectedLocation ?? undefined,
    });
  };

  return (
    <div className="atlas-cold-open">
      <div className="atlas-cold-open__scrim" />
      <main className="atlas-cold-open__content">
        <section className="atlas-cold-open__hero">
          <div className="atlas-cold-open__eyebrow"><Sparkles size={14} aria-hidden="true" /> One evidence-first decision</div>
          <h1>Find the right place.<br /><span>Prove it.</span></h1>
          <p>Describe what you need. Atlas checks real candidates, verifies travel time, and recommends one with evidence.</p>
          <a
            href="/"
            className="atlas-cold-open__labs-link"
          >
            See more demos & writing at ryanbaumann.dev <ArrowUpRight size={14} aria-hidden="true" style={{ marginLeft: 2, display: 'inline-block', verticalAlign: 'middle' }} />
          </a>
        </section>

        <section className="glass mission-brief" aria-label="Mission brief">
          <div className="mission-brief__header">
            <div><span className="mission-brief__kicker">60–90 second mission</span><h2>What should Atlas find?</h2></div>
            <span className={`mission-capability mission-capability--${liveStatus}`} role="status">
              {liveStatus === 'ready'
                ? '● Ready'
                : liveStatus === 'checking' ? 'Checking services…' : needsGemini ? 'Maps ready · Connect Gemini' : 'Live unavailable'}
            </span>
          </div>

          <label className="mission-field">
            <span>Goal</span>
            <textarea ref={promptRef} value={goal} onChange={(event) => setGoal(event.target.value)} rows={3} />
          </label>

          <div className="mission-examples" aria-label="Example goals">
            {EXAMPLES.map((example) => (
              <button key={example.prompt} type="button" className="mission-example" title={example.prompt} onClick={() => chooseExample(example.prompt)}>{example.label}</button>
            ))}
          </div>

          <div className="mission-location" aria-live="polite">
            <span><MapPin size={15} aria-hidden="true" /> {locationState === 'using' ? 'Using my location for this mission' : `Selected area: ${sampleCity.name}`}</span>
            <button type="button" onClick={useMyLocation} disabled={locationState === 'locating'}>
              {locationState === 'using' ? <X size={15} aria-hidden="true" /> : <LocateFixed size={15} aria-hidden="true" />}
              {locationState === 'using' ? 'Remove' : locationState === 'locating' ? 'Locating…' : 'Use my location'}
            </button>
          </div>
          {locationState === 'error' ? <p className="mission-location__error" role="status">Location was not shared. The selected area is still active.</p> : null}

          <div className={`mission-gemini${credential.source === 'byok' || hostedGemini ? ' is-ready' : ''}`}>
            <span>
              <KeyRound size={15} aria-hidden="true" />
              {credential.source === 'byok'
                ? 'Gemini connected · Personal key'
                : hostedGemini ? 'Gemini connected · Hosted' : 'Gemini is required for agent reasoning'}
            </span>
            <button type="button" onClick={() => setKeyDialogOpen(true)}>
              {credential.source === 'byok' ? 'Manage' : hostedGemini ? 'Use my key' : 'Connect key'}
            </button>
          </div>

          <div className="mission-actions" style={{ display: 'flex', gap: '12px', marginTop: '12px', width: '100%' }}>
            <button
              type="button"
              className="mission-launch"
              style={{ flex: 1 }}
              onClick={needsGemini ? () => setKeyDialogOpen(true) : start}
              disabled={liveStatus !== 'ready' && !needsGemini}
            >
              {liveStatus === 'ready'
                ? <>Find with live evidence <ArrowRight size={18} aria-hidden="true" /></>
                : liveStatus === 'checking' ? 'Checking services…' : needsGemini ? <>Connect Gemini to continue <KeyRound size={16} aria-hidden="true" style={{ marginLeft: 6, display: 'inline-block', verticalAlign: 'middle' }} /></> : 'Live services unavailable'}
            </button>
            <button
              type="button"
              className="mission-launch-secondary"
              style={{ flex: 'none' }}
              onClick={() => {
                useAtlas.getState().dismissLanding();
                useGenui.getState().clearScenario('scout');
              }}
            >
              Skip to Demos
            </button>
          </div>
          <div className="mission-privacy"><ShieldCheck size={13} aria-hidden="true" />
            {liveStatus === 'ready'
              ? 'Maps, grounding, and Gemini are ready. Device location is used only after you ask.'
              : liveStatus === 'checking'
                ? 'Verifying Maps, grounding, and both agent models before launch.'
                : needsGemini
                  ? 'Connect a Gemini key above; no reload is needed.'
                  : 'Check your connection and Maps configuration, then reload.'}
          </div>
        </section>
      </main>
    </div>
  );
}
