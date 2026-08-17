import { create } from 'zustand';
import type {
  CameraIntent,
  CameraReport,
  ChatMsg,
  MarkerSpec,
  PolygonSpec,
  RouteSpec,
  ScenarioId,
  Toast,
  ToolEvent,
} from '@/lib/types';
import { uid } from '@/lib/id';
import { CITIES, type CityPreset } from '@/lib/cities';
import { MODELS } from '@/lib/config';
import { sanitizeDiagnostic, type SanitizedDiagnostic } from '@/diagnostics/telemetry';
import { NO_PADDING, type CameraOwner, type ViewportPadding } from '@/shell/cameraDirector';

type ApiHealth = 'ok' | 'degraded' | 'down';

/** Copilot chat-model thinking choice for the admin panel. 'default' = env / per-scenario. */
export type ThinkingChoice = 'default' | 'low' | 'medium' | 'high';

const SCENARIOS: ScenarioId[] = ['concierge', 'insight', 'fleet', 'cinema', 'adstudio', 'scout'];

/** Bounded tool-event log kept for the session (was 24 per journey × 6). */
const TELEMETRY_CAP = 48;

export interface AtlasState {
  /* ---- app ---- */
  activeScenario: ScenarioId;
  mapMode: '2d' | '3d';
  drawerOpen: boolean;
  landingDismissed: boolean;
  keyDialogOpen: boolean;
  cityId: string;
  /** Prompt carried in via a replay link (?prompt=), auto-run once on load. */
  pendingPrompt: string | null;
  toasts: Toast[];
  apiHealth: ApiHealth;
  cities: CityPreset[];
  setScenario: (id: ScenarioId) => void;
  setMapMode: (m: '2d' | '3d') => void;
  setDrawer: (open: boolean) => void;
  toggleDrawer: () => void;
  setKeyDialogOpen: (open: boolean) => void;
  dockMinimized: boolean;
  toggleDock: () => void;
  setDockMinimized: (minimized: boolean) => void;
  setCityId: (id: string) => void;
  addCityPreset: (city: CityPreset) => void;
  dismissLanding: () => void;
  clearPendingPrompt: () => void;
  pushToast: (kind: Toast['kind'], text: string) => void;
  dismissToast: (id: string) => void;
  setApiHealth: (h: ApiHealth) => void;

  /* ---- admin (hidden model/thinking tuner) ---- */
  adminOpen: boolean;
  chatModel: string;
  chatThinking: ThinkingChoice;
  toggleAdmin: () => void;
  setAdminOpen: (open: boolean) => void;
  setChatModel: (model: string) => void;
  setChatThinking: (choice: ThinkingChoice) => void;

  /* ---- camera ---- */
  /** Chrome that overlaps the map cell (the mobile sheet). Zero on desktop,
   *  where the map owns a real grid cell and nothing floats over it. */
  viewport: ViewportPadding;
  /** A user gesture takes the camera until the next agent run. */
  cameraOwner: CameraOwner;
  setViewport: (padding: ViewportPadding) => void;
  setCameraOwner: (owner: CameraOwner) => void;
  cameraIntent: CameraIntent | null;
  cameraReport: CameraReport | null;
  /** False while camera movement derives from a user-selected exact location. */
  cameraUrlSync: boolean;
  setCamera: (intent: CameraIntent) => void;
  clearCamera: () => void;
  setCameraReport: (r: CameraReport) => void;
  setCameraUrlSync: (enabled: boolean) => void;

  /* ---- map decorations ---- */
  markers: MarkerSpec[];
  routes: RouteSpec[];
  polygons: PolygonSpec[];
  tileOverlay: 'aqi' | 'pollen' | null;
  selectedMarkerId: string | null;
  setMarkers: (m: MarkerSpec[]) => void;
  addMarkers: (m: MarkerSpec[]) => void;
  removeMarkers: (ids: string[]) => void;
  clearMarkers: () => void;
  setRoutes: (r: RouteSpec[]) => void;
  addRoute: (r: RouteSpec) => void;
  clearRoutes: () => void;
  setPolygons: (p: PolygonSpec[]) => void;
  clearPolygons: () => void;
  setTileOverlay: (t: 'aqi' | 'pollen' | null) => void;
  selectMarker: (id: string | null) => void;
  clearMap: () => void;

  /* ---- session ----
   * One agent, one transcript, one in-flight flag. `activeScenario` selects the
   * recipe (prompt + capability profile); it no longer partitions session state,
   * so switching recipes continues the same conversation instead of swapping to
   * a parallel one. */
  transcript: ChatMsg[];
  telemetry: ToolEvent[];
  /** True while a copilot query is in flight. */
  running: boolean;
  /** Prompt to re-run after an interrupted query (Stop / navigate away). */
  resumable: string | null;
  /** Clickable "next action" chips proposed after the last answer. */
  followups: string[];
  addMsg: (msg: ChatMsg) => void;
  updateMsg: (id: string, patch: Partial<ChatMsg>) => void;
  appendToMsg: (id: string, delta: string) => void;
  setRunning: (b: boolean) => void;
  setResumable: (prompt: string | null) => void;
  setFollowups: (suggestions: string[]) => void;
  pushTool: (ev: ToolEvent) => void;
  updateTool: (id: string, patch: Partial<ToolEvent>) => void;
  clearChat: () => void;
  /** Clear the bounded telemetry log (diagnostics Clear). */
  clearAllTelemetry: () => void;
}

// Parse initial state from URL parameters
const getInitialStateFromUrl = () => {
  if (typeof window === 'undefined') {
    return {
      activeScenario: 'concierge' as ScenarioId,
      mapMode: '2d' as '2d' | '3d',
      drawerOpen: true,
      dockMinimized: false,
      landingDismissed: false,
      cityId: 'sf',
      pendingPrompt: null as string | null,
      cameraIntent: null as CameraIntent | null,
      tileOverlay: null as 'aqi' | 'pollen' | null,
      selectedMarkerId: null as string | null,
      adminOpen: false,
    };
  }

  const params = new URLSearchParams(window.location.search);
  const rawScenario = params.get('scenario') as ScenarioId;
  const activeScenario = SCENARIOS.includes(rawScenario) ? rawScenario : 'concierge';
  const mapMode = (params.get('mode') as '2d' | '3d') || '2d';
  
  // Drawer: honor an explicit ?drawer= param; otherwise default open only on
  // wide screens. On phones/tablets the drawer is a modal slide-over, so it
  // starts closed to keep the map, rail, and header visible on entry.
  const isWideScreen = typeof window !== 'undefined' && window.innerWidth >= 1024;
  const drawerOpen = isWideScreen
    ? params.get('drawer') !== 'false'
    : false;
  
  const cityId = params.get('city') || 'sf';

  // Replay link: a shared run carries the original prompt so it re-runs live for
  // the recipient. Cap defensively (matches REPLAY_PROMPT_MAX in lib/share).
  const rawPrompt = params.get('prompt');
  const pendingPrompt = rawPrompt ? rawPrompt.slice(0, 500) : null;

  // If a scenario, a prompt, or camera coordinates are in the URL, the landing
  // page should be dismissed so the shared run opens straight into the journey.
  const hasConfigInUrl =
    params.has('scenario') || params.has('prompt') || params.has('lat') || params.has('lng');
  const landingDismissed = params.get('landing') === 'true' || hasConfigInUrl;

  const tileOverlay = (params.get('overlay') as 'aqi' | 'pollen' | null) || null;
  const selectedMarkerId = params.get('marker') || null;

  let cameraIntent: CameraIntent | null = null;
  const latStr = params.get('lat');
  const lngStr = params.get('lng');
  const zoomStr = params.get('zoom');
  const headingStr = params.get('heading');
  const tiltStr = params.get('tilt');

  if (latStr && lngStr) {
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    if (!isNaN(lat) && !isNaN(lng)) {
      cameraIntent = {
        kind: 'fly',
        center: { lat, lng },
        zoom: zoomStr ? parseFloat(zoomStr) : undefined,
        heading: headingStr ? parseFloat(headingStr) : undefined,
        tilt: tiltStr ? parseFloat(tiltStr) : undefined,
      };
    }
  }

  return {
    activeScenario,
    mapMode,
    drawerOpen,
    dockMinimized: false,
    landingDismissed,
    cityId,
    pendingPrompt,
    cameraIntent,
    tileOverlay,
    selectedMarkerId,
    adminOpen: params.get('admin') === '1',
  };
};

const initialState = getInitialStateFromUrl();

export const useAtlas = create<AtlasState>((set) => ({
  /* app */
  activeScenario: initialState.activeScenario,
  mapMode: initialState.mapMode,
  drawerOpen: initialState.drawerOpen,
  landingDismissed: initialState.landingDismissed,
  keyDialogOpen: false,
  cityId: initialState.cityId,
  pendingPrompt: initialState.pendingPrompt,
  toasts: [],
  apiHealth: 'ok',
  cities: CITIES,
  setScenario: (id) => set({ activeScenario: id }),
  setMapMode: (m) => set({ mapMode: m }),
  setDrawer: (open) => set({ drawerOpen: open }),
  toggleDrawer: () => set((s) => ({ drawerOpen: !s.drawerOpen })),
  setKeyDialogOpen: (open) => set({ keyDialogOpen: open }),
  dockMinimized: initialState.dockMinimized,
  toggleDock: () => set((s) => ({ dockMinimized: !s.dockMinimized })),
  setDockMinimized: (minimized) => set({ dockMinimized: minimized }),
  setCityId: (id) => set((s) => {
    const preset = s.cities.find((c) => c.id === id);
    if (preset) {
      return {
        cityId: id,
        cameraIntent: {
          kind: 'fly',
          center: preset.center,
          zoom: preset.zoom,
        }
      };
    }
    return { cityId: id };
  }),
  addCityPreset: (city) => set((s) => ({
    cities: [...s.cities.filter((c) => c.id !== city.id), city]
  })),
  dismissLanding: () => set({ landingDismissed: true }),
  clearPendingPrompt: () => set({ pendingPrompt: null }),

  /* admin */
  adminOpen: initialState.adminOpen,
  chatModel: MODELS.chat,
  chatThinking: 'default' as ThinkingChoice,
  toggleAdmin: () => set((s) => ({ adminOpen: !s.adminOpen })),
  setAdminOpen: (open) => set({ adminOpen: open }),
  setChatModel: (model) => set({ chatModel: model }),
  setChatThinking: (choice) => set({ chatThinking: choice }),

  pushToast: (kind, text) =>
    set((s) => ({ toasts: [...s.toasts, { id: uid('toast'), kind, text }].slice(-4) })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setApiHealth: (h) => set({ apiHealth: h }),

  /* camera */
  viewport: NO_PADDING,
  cameraOwner: 'agent',
  setViewport: (padding) => set({ viewport: padding }),
  setCameraOwner: (owner) => set({ cameraOwner: owner }),
  cameraIntent: initialState.cameraIntent,
  cameraReport: null,
  cameraUrlSync: true,
  setCamera: (intent) => set({ cameraIntent: intent, cameraOwner: 'agent' }),
  clearCamera: () => set({ cameraIntent: null }),
  setCameraReport: (r) => set({ cameraReport: r }),
  setCameraUrlSync: (enabled) => set({ cameraUrlSync: enabled, cameraReport: null }),

  /* map decorations */
  markers: [],
  routes: [],
  polygons: [],
  tileOverlay: initialState.tileOverlay,
  selectedMarkerId: initialState.selectedMarkerId,
  setMarkers: (m) => set({ markers: m }),
  addMarkers: (m) => set((s) => ({ markers: [...s.markers, ...m] })),
  removeMarkers: (ids) => set((s) => ({ markers: s.markers.filter((x) => !ids.includes(x.id)) })),
  clearMarkers: () => set({ markers: [] }),
  setRoutes: (r) => set({ routes: r }),
  addRoute: (r) => set((s) => ({ routes: [...s.routes.filter((x) => x.id !== r.id), r] })),
  clearRoutes: () => set({ routes: [] }),
  setPolygons: (p) => set({ polygons: p }),
  clearPolygons: () => set({ polygons: [] }),
  setTileOverlay: (t) => set({ tileOverlay: t }),
  selectMarker: (id) => set({ selectedMarkerId: id }),
  clearMap: () => set({ markers: [], routes: [], polygons: [], tileOverlay: null, selectedMarkerId: null }),

  /* session */
  transcript: [],
  telemetry: [],
  running: false,
  resumable: null,
  followups: [],
  addMsg: (msg) => set((s) => ({ transcript: [...s.transcript, msg] })),
  updateMsg: (id, patch) =>
    set((s) => ({ transcript: s.transcript.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
  appendToMsg: (id, delta) =>
    set((s) => ({
      transcript: s.transcript.map((m) =>
        m.id === id ? { ...m, text: (m.text ?? '') + delta } : m,
      ),
    })),
  setRunning: (b) => set({ running: b }),
  setResumable: (prompt) => set({ resumable: prompt }),
  setFollowups: (suggestions) => set({ followups: suggestions }),
  // Stamp the active recipe so the flat log still supports per-recipe diagnostics.
  pushTool: (ev) =>
    set((s) => ({
      telemetry: [...s.telemetry, { scenario: s.activeScenario, ...ev }].slice(-TELEMETRY_CAP),
    })),
  updateTool: (id, patch) =>
    set((s) => ({ telemetry: s.telemetry.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),
  clearChat: () => set({ transcript: [], telemetry: [], resumable: null, followups: [] }),
  clearAllTelemetry: () => set({ telemetry: [] }),
}));

/**
 * Collect the store's bounded per-scenario telemetry as SANITIZED diagnostics —
 * the only shape allowed to leave the browser (reliability §5). Content-bearing
 * summaries/values/ids are dropped by sanitizeDiagnostic.
 */
export function collectSanitizedDiagnostics(): SanitizedDiagnostic[] {
  const { telemetry, activeScenario } = useAtlas.getState();
  return telemetry.map((ev) => sanitizeDiagnostic({ ...ev, scenario: ev.scenario ?? activeScenario }));
}

/** Non-React access for the AI engine / services. */
export const atlas = useAtlas.getState;
