/**
 * Atlas app-domain types. The store, services, AI engine, shell and scenarios
 * all speak these compact shapes — never raw Google SDK objects cross the store
 * boundary (keeps state serializable and journeys decoupled).
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export type ScenarioId = 'concierge' | 'insight' | 'fleet' | 'cinema' | 'adstudio' | 'scout';
export type MapMode = '2d' | '3d';
export type TravelMode = 'WALK' | 'DRIVE' | 'BICYCLE' | 'TRANSIT' | 'TWO_WHEELER';

/* ------------------------------------------------------------------ Places */

export interface PlaceLite {
  id: string;
  name: string;
  location: LatLng;
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: number; // 0..4
  primaryType?: string;
  types?: string[];
  openNow?: boolean;
  regularOpeningHours?: string[];
  photoUri?: string; // ready-to-use Places photo URL (Photo.getURI)
  editorialSummary?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  phone?: string;
}

export interface AutocompleteHit {
  placeId: string;
  primaryText: string;
  secondaryText: string;
}

/* ------------------------------------------------------------------ Routes */

export interface RouteResult {
  path: LatLng[]; // decoded polyline
  encoded?: string; // encoded polyline when available (REST fallback)
  distanceMeters: number;
  durationSeconds: number;
  legs?: RouteLeg[];
}

export interface RouteLeg {
  path: LatLng[];
  distanceMeters: number;
  durationSeconds: number;
  start: LatLng;
  end: LatLng;
}

export interface MatrixCell {
  originIndex: number;
  destinationIndex: number;
  distanceMeters: number;
  durationSeconds: number;
  status: 'OK' | 'FAILED';
}

/* -------------------------------------------------------------- Environment */

export interface AirQuality {
  aqi: number;
  category: string;
  dominantPollutant?: string;
  color: string; // hex from official palette
}

export interface WeatherNow {
  tempC: number;
  feelsLikeC?: number;
  condition: string;
  humidity?: number;
  windKph?: number;
  iconType?: string;
  isDay?: boolean;
}

export interface PollenDay {
  date: string;
  grass?: { category: string; index: number };
  tree?: { category: string; index: number };
  weed?: { category: string; index: number };
}

export interface SolarInsight {
  maxPanels: number;
  maxAreaMeters2: number;
  sunshineHoursPerYear: number;
  yearlyEnergyKwh: number;
  carbonOffsetKgPerMwh?: number;
  boundingBox?: { sw: LatLng; ne: LatLng };
}

export interface EnvironmentSnapshot {
  air?: AirQuality;
  weather?: WeatherNow;
  pollen?: PollenDay;
  solar?: SolarInsight;
}

/* --------------------------------------------------------- Map decorations */

export interface MarkerSpec {
  id: string;
  position: LatLng;
  label?: string; // short glyph text (1-2 chars) OR full label depending on kind
  title?: string; // hover title
  color?: string; // accent hex
  kind?: 'pin' | 'dot' | 'chip' | 'category' | 'truck';
  glyph?: string; // PinElement glyphText
  heading?: number; // degrees, 0=N clockwise — rotates directional markers (e.g. truck) to face travel
  category?: string; // for category pins (maps to an icon glyph)
  placeId?: string;
  meta?: Record<string, unknown>;
  scenario?: ScenarioId;
}

export interface RouteSpec {
  id: string;
  path: LatLng[];
  color?: string;
  width?: number;
  dashed?: boolean;
  opacity?: number;
  z?: number;
  scenario?: ScenarioId;
}

export interface PolygonSpec {
  id: string;
  path: LatLng[];
  fill?: string;
  stroke?: string;
  opacity?: number;
  scenario?: ScenarioId;
}

/* -------------------------------------------------------------- Camera */

export type CameraIntent =
  | { kind: 'fly'; center: LatLng; zoom?: number; heading?: number; tilt?: number; animate?: boolean }
  | { kind: 'fit'; bounds: LatLng[]; padding?: number }
  | {
      kind: 'fly3d';
      center: LatLng & { altitude?: number };
      range?: number;
      heading?: number;
      tilt?: number;
      durationMs?: number;
    }
  | {
      kind: 'orbit3d';
      center: LatLng & { altitude?: number };
      range?: number;
      tilt?: number;
      repeatCount?: number;
      durationMs?: number;
    }
  | { kind: 'stop3d' };

export interface CameraReport {
  lat: number;
  lng: number;
  zoom?: number;
  heading?: number;
  tilt?: number;
}

/* -------------------------------------------------------------- Chat */

export type ChatRole = 'user' | 'model' | 'tool' | 'widget' | 'notice' | 'surface';

export interface ChatMsg {
  id: string;
  role: ChatRole;
  text?: string;
  streaming?: boolean;
  toolName?: string;
  widgetContextToken?: string; // grounded Maps widget
  notice?: { title: string; body: string };
  surfaceId?: string; // A2UI generative-UI surface (see src/genui)
  ts: number;
}

export interface ToolEvent {
  id: string;
  name: string;
  status: 'running' | 'ok' | 'error';
  summary?: string;
  details?: ToolEventDetail[];
  /** Recipe active when the event was recorded. Stamped by the store at push
   *  time so sanitized diagnostics keep per-recipe attribution now that the
   *  session owns one flat telemetry log. */
  scenario?: ScenarioId;
  ts: number;
}

export interface ToolEventDetail {
  label: string;
  value?: string;
  placeId?: string;
}

/* -------------------------------------------------------------- AI tools */

export interface ToolDefinition {
  declaration: import('@google/genai').FunctionDeclaration;
  /**
   * Executes the tool. `signal` is aborted when the copilot run is stopped or the
   * user navigates away — handlers with cancelable side effects (e.g. speech)
   * should check `signal?.aborted` before firing them.
   */
  handler: (args: Record<string, unknown>, signal?: AbortSignal) => Promise<unknown>;
}

/* -------------------------------------------------------------- Toasts */

export interface Toast {
  id: string;
  kind: 'info' | 'good' | 'warn' | 'bad';
  text: string;
}
