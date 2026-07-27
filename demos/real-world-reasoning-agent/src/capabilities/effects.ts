export interface EffectPoint {
  lat: number;
  lng: number;
}

export interface EffectMarker {
  position: EffectPoint;
  label?: string;
  color?: string;
  title?: string;
  placeId?: string;
}

export interface EffectRoute {
  path: EffectPoint[];
  color?: string;
}

export type HostEffect =
  | {
      type: 'map.fly';
      center: EffectPoint;
      zoom?: number;
      heading?: number;
      tilt?: number;
    }
  | { type: 'map.add-markers'; markers: EffectMarker[] }
  | { type: 'map.replace-markers'; scope: string; markers: EffectMarker[] }
  | { type: 'map.fit'; points: EffectPoint[] }
  | { type: 'map.replace-route'; scope: string; route: EffectRoute | null }
  | { type: 'map.add-route'; route: EffectRoute }
  /** Focus one already-placed marker, by placeId. Selection is a map state
   *  change like any other, so it travels as an effect rather than a direct
   *  store call from inside a tool handler. */
  | { type: 'map.select-place'; placeId: string | null }
  | { type: 'map.clear' }
  | { type: 'chat.notice'; title: string; body: string };

export interface CapabilityExecution<T = Record<string, unknown>> {
  data: T;
  effects: HostEffect[];
}

export interface CapabilityCancellation {
  readonly aborted: boolean;
  subscribe?(listener: () => void): () => void;
}

export interface CapabilityContext {
  cancellation?: CapabilityCancellation;
}

export interface CapabilityDefinition<T = Record<string, unknown>> {
  manifest: import('./manifest').CapabilityManifest;
  execute(args: Record<string, unknown>, context?: CapabilityContext): Promise<CapabilityExecution<T>>;
}

export interface FixtureHostSnapshot {
  mapMode: '2d' | '3d';
  camera: Record<string, unknown> | null;
  markers: EffectMarker[];
  routes: unknown[];
  polygons: unknown[];
  tileOverlay: 'aqi' | 'pollen' | null;
  selectedMarkerId: string | null;
  notices: Array<{ title: string; body: string }>;
}

export function emptyHostSnapshot(mapMode: '2d' | '3d' = '2d'): FixtureHostSnapshot {
  return {
    mapMode,
    camera: null,
    markers: [],
    routes: [],
    polygons: [],
    tileOverlay: null,
    selectedMarkerId: null,
    notices: [],
  };
}

export function applyEffects(
  initial: FixtureHostSnapshot,
  effects: readonly HostEffect[],
): FixtureHostSnapshot {
  return effects.reduce<FixtureHostSnapshot>((state, effect) => {
    switch (effect.type) {
      case 'map.fly':
        return {
          ...state,
          camera: state.mapMode === '3d'
            ? {
                kind: 'fly3d',
                center: { ...effect.center, altitude: 60 },
                range: 1400,
                tilt: effect.tilt ?? 60,
                heading: effect.heading ?? 0,
              }
            : {
                kind: 'fly',
                center: effect.center,
                zoom: effect.zoom ?? 15,
                ...(effect.heading == null ? {} : { heading: effect.heading }),
                ...(effect.tilt == null ? {} : { tilt: effect.tilt }),
                animate: true,
              },
        };
      case 'map.add-markers':
        return { ...state, markers: [...state.markers, ...effect.markers] };
      case 'map.replace-markers':
        return { ...state, markers: [...effect.markers] };
      case 'map.fit':
        return { ...state, camera: { kind: 'fit', bounds: [...effect.points] } };
      case 'map.replace-route':
        return { ...state, routes: effect.route ? [{ ...effect.route }] : [] };
      case 'map.add-route':
        return { ...state, routes: [...state.routes, { ...effect.route }] };
      case 'map.select-place':
        return { ...state, selectedMarkerId: effect.placeId };
      case 'map.clear':
        return {
          ...state,
          markers: [],
          routes: [],
          polygons: [],
          tileOverlay: null,
          selectedMarkerId: null,
        };
      case 'chat.notice':
        return { ...state, notices: [...state.notices, { title: effect.title, body: effect.body }] };
    }
  }, structuredClone(initial));
}
