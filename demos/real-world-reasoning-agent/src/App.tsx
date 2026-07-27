import { useEffect, useRef } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { GMP_BROWSER_KEY, MAPS_VERSION, MAPS_LIBRARIES } from '@/lib/config';
import { useAtlas } from '@/state/store';
import { SCENARIOS } from '@/scenarios/registry';
import type { ScenarioId } from '@/lib/types';
import { MapCanvas } from '@/shell/MapCanvas';
import { AgentCanvas } from '@/shell/AgentCanvas';
import { CopilotDock } from '@/shell/CopilotDock';
import { StatusBar } from '@/shell/StatusBar';
import { Landing } from '@/shell/Landing';
import { MapErrorNotice } from '@/shell/MapErrorNotice';
import { AudioPill } from '@/shell/AudioPill';
import { AdminPanel } from '@/shell/AdminPanel';
import { Toasts } from '@/shell/Toasts';
import { stopSpeech } from '@/ai/tts';
import { abortCopilot, runPendingReplayPrompt } from '@/ai/session';
import { genui } from '@/genui/store';
import { cameraReportForUrl, scrubReplayParams } from '@/lib/share';

export default function App() {
  const scenario = useAtlas((s) => s.activeScenario);
  const setMapMode = useAtlas((s) => s.setMapMode);
  const clearMap = useAtlas((s) => s.clearMap);
  const setApiHealth = useAtlas((s) => s.setApiHealth);
  const landingDismissed = useAtlas((s) => s.landingDismissed);
  const setAccent = useRef<string>('');
  const prev = useRef<ScenarioId | null>(null);

  // Google Maps calls this global on the window when the browser key is
  // missing/invalid/referrer-blocked. It never throws through APIProvider's
  // onError in that case, so this is the only reliable signal for auth failure.
  useEffect(() => {
    window.gm_authFailure = () => setApiHealth('down');
    return () => {
      delete window.gm_authFailure;
    };
  }, [setApiHealth]);

  // Re-arm the map + copilot dressing whenever the journey changes.
  useEffect(() => {
    const mod = SCENARIOS[scenario];
    if (prev.current && prev.current !== scenario) {
      // Re-arm for the new recipe: cancel the in-flight query (recorded as
      // resumable) and silence any speech so nothing bleeds onto the new screen.
      // The session transcript deliberately survives — it is one conversation.
      abortCopilot();
      stopSpeech();
      SCENARIOS[prev.current].onExit?.();
      clearMap();
      genui().clearScenario(prev.current);
    }
    setMapMode(mod.mapMode);
    document.documentElement.style.setProperty('--accent', mod.accent);
    document.documentElement.style.setProperty('--accent-soft', `${mod.accent}28`);
    setAccent.current = mod.accent;
    mod.onEnter?.();
    prev.current = scenario;
  }, [scenario, setMapMode, clearMap]);

  // Replay links (?prompt=) auto-run their prompt once the shell has mounted, so
  // a shared run reasons live for the recipient. A short delay lets the map init
  // before the first tool call; the model round-trip adds further headroom.
  useEffect(() => {
    const id = setTimeout(() => runPendingReplayPrompt(), 600);
    return () => clearTimeout(id);
  }, []);

  // Scrub the raw prompt/mission params from the address bar immediately on
  // mount (the pending prompt was already captured into state). Defense-in-depth
  // for reliability §5 so the raw prompt doesn't linger in history/Referer.
  useEffect(() => {
    const scrubbed = scrubReplayParams(window.location.search);
    if (scrubbed !== null) {
      const pathname = window.location.pathname.replace(/^\/\/+/, '/');
      window.history.replaceState(window.history.state, '', `${pathname}${scrubbed}`);
    }
  }, []);

  // Synchronize state changes back to URL parameters.
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let lastUrl = window.location.search;

    const syncUrl = () => {
      const state = useAtlas.getState();
      const params = new URLSearchParams();

      params.set('scenario', state.activeScenario);
      params.set('mode', state.mapMode);
      params.set('drawer', String(state.drawerOpen));
      params.set('landing', String(state.landingDismissed));
      params.set('city', state.cityId);

      if (state.tileOverlay) {
        params.set('overlay', state.tileOverlay);
      }
      if (state.selectedMarkerId) {
        params.set('marker', state.selectedMarkerId);
      }

      const cameraReport = cameraReportForUrl(state.cameraUrlSync, state.cameraReport);
      if (cameraReport) {
        params.set('lat', cameraReport.lat.toFixed(5));
        params.set('lng', cameraReport.lng.toFixed(5));
        if (cameraReport.zoom !== undefined) {
          params.set('zoom', cameraReport.zoom.toFixed(2));
        }
        if (cameraReport.heading !== undefined) {
          params.set('heading', Math.round(cameraReport.heading).toString());
        }
        if (cameraReport.tilt !== undefined) {
          params.set('tilt', Math.round(cameraReport.tilt).toString());
        }
      }

      const newSearch = `?${params.toString()}`;
      if (newSearch !== lastUrl) {
        lastUrl = newSearch;
        const pathname = window.location.pathname.replace(/^\/\/+/, '/');
        const newUrl = `${pathname}${newSearch}`;
        window.history.replaceState(null, '', newUrl);
      }
    };

    const debouncedSync = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(syncUrl, 300);
    };

    const unsub = useAtlas.subscribe(() => {
      debouncedSync();
    });

    return () => {
      unsub();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  return (
    <APIProvider
      apiKey={GMP_BROWSER_KEY}
      version={MAPS_VERSION}
      libraries={[...MAPS_LIBRARIES]}
      onError={() => setApiHealth('down')}
    >
      {/* One layout grid: rail | map | agent canvas, with the composer spanning
          the bottom. The map is a real grid cell, so its usable rectangle is a
          declared value rather than something the camera measures off the DOM. */}
      <div className="atlas-app-shell">
        <div className="atlas-app-shell__map">
          <MapCanvas />
          <MapErrorNotice />
        </div>
        {landingDismissed ? <>
          <AudioPill />
          <StatusBar />
          <AgentCanvas />
          <CopilotDock />
          <AdminPanel />
          <Toasts />
        </> : null}
        <Landing />
      </div>
    </APIProvider>
  );
}
