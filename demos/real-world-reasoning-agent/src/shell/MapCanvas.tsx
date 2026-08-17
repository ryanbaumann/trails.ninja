import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Map,
  Map3D,
  Marker3D,
  AdvancedMarker,
  MapMode,
  ColorScheme,
  Pin,
  useMap,
  useMap3D,
} from '@vis.gl/react-google-maps';
import { useAtlas } from '@/state/store';
import { useMission } from '@/mission/store';
import { focusMissionCandidate } from '@/mission/controller';
import { AreaEditor } from '@/mission/AreaEditor';
import { SCENARIOS } from '@/scenarios/registry';
import { MAP_ID, USAGE_ATTRIBUTION_ID } from '@/lib/config';
import { DEFAULT_CITY_PRESET } from '@/lib/cities';
import { aqiTileUrl, pollenTileUrl } from '@/services/env';
import type { LatLng, MarkerSpec } from '@/lib/types';
import type { MissionCandidate } from '@/mission/types';
import { intentRequiresMode, resolveCamera } from './cameraDirector';
import { AtlasMarker } from './AtlasMarker';
import { MarkerPlaceCard } from './MarkerPlaceCard';

export function MapCanvas() {
  const scenarioId = useAtlas((s) => s.activeScenario);
  const mode = useAtlas((s) => s.mapMode);
  const Overlay = SCENARIOS[scenarioId].Overlay;
  return (
    <>
      <MapLoadingSkeleton />
      {mode === '3d' ? <Scene3D /> : <Scene2D />}
      {Overlay && <Overlay />}
    </>
  );
}

function MapLoadingSkeleton() {
  const map = useMap();
  const map3d = useMap3D();
  
  // A small delay avoids flashing the skeleton on fast loads
  const [show, setShow] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setShow(true), 400);
    return () => clearTimeout(id);
  }, []);

  if (map || map3d || !show) return null;

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 0,
    }}>
      <div style={{
         animation: 'atlas-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
         display: 'flex',
         flexDirection: 'column',
         alignItems: 'center',
         gap: 16,
         color: 'var(--text-dim)',
      }}>
        <Loader2 size={32} className="copilot-dock__mic-spin" />
        <div style={{ fontSize: 14, letterSpacing: 1, textTransform: 'uppercase' }}>Loading Map...</div>
      </div>
    </div>
  );
}

/** Renders the active scenario's own in-map layer (pins, overlays, click hooks). */
function ScenarioMapLayer() {
  const scenarioId = useAtlas((s) => s.activeScenario);
  const Layer = SCENARIOS[scenarioId].MapLayer;
  return <Layer />;
}

function Scene2D() {
  const scenarioId = useAtlas((s) => s.activeScenario);
  const cityId = useAtlas((s) => s.cityId);
  const cities = useAtlas((s) => s.cities);
  const preset = cities.find((c) => c.id === cityId) ?? DEFAULT_CITY_PRESET;
  // Toggling 2D/3D unmounts one scene and mounts the other, so `defaultCenter`
  // decides where you land. Seeding it from the last reported camera makes the
  // switch a change of representation rather than a jump back to the city
  // default — you keep looking at whatever you were looking at.
  const start = useAtlasCameraStart(preset);
  return (
    <Map
      className="gm-fill"
      mapId={MAP_ID}
      defaultCenter={start.center}
      defaultZoom={start.zoom}
      colorScheme={ColorScheme.DARK}
      gestureHandling="greedy"
      disableDefaultUI
      clickableIcons={false}
      internalUsageAttributionIds={[USAGE_ATTRIBUTION_ID]}
    >
      <Markers2D />
      <Routes2D />
      <Polygons2D />
      <MissionGeometry2D />
      {scenarioId === 'scout' ? <AreaEditor /> : null}
      <TileOverlay />
      <Camera2D />
      <ScenarioMapLayer />
    </Map>
  );
}

/**
 * Where a freshly mounted scene should start: the last reported camera when there
 * is one, otherwise the city preset. Read once, at mount, via getState — this must
 * NOT subscribe, or every camera report would re-render the scene.
 */
function useAtlasCameraStart(preset: { center: LatLng; zoom: number }): {
  center: LatLng;
  zoom: number;
  heading?: number;
  tilt?: number;
} {
  const [start] = useState(() => {
    const report = useAtlas.getState().cameraReport;
    if (!report) return { center: preset.center, zoom: preset.zoom };
    return {
      center: { lat: report.lat, lng: report.lng },
      zoom: report.zoom ?? preset.zoom,
      heading: report.heading,
      tilt: report.tilt,
    };
  });
  return start;
}

function Markers2D() {
  const markers = useAtlas((s) => s.markers);
  const setCamera = useAtlas((s) => s.setCamera);
  const selectedId = useAtlas((s) => s.selectedMarkerId);
  const selectMarker = useAtlas((s) => s.selectMarker);
  const selected = useMemo(() => markers.find((m) => m.id === selectedId) ?? null, [markers, selectedId]);
  return (
    <>
      {markers.map((m) => (
        <AdvancedMarker
          key={m.id}
          position={m.position}
          title={m.title}
          zIndex={m.id === selectedId ? 12 : m.kind === 'dot' ? 1 : 5}
          onClick={() => {
            selectMarker(m.id);
            const candidateId = m.meta?.candidateId;
            if (typeof candidateId === 'string') focusMissionCandidate(candidateId);
            setCamera({ kind: 'fly', center: m.position, zoom: 16.5 });
          }}
        >
          <AtlasMarker marker={m} selected={m.id === selectedId} />
        </AdvancedMarker>
      ))}
      {selected && !selected.meta?.candidateId && <MarkerPlaceCard marker={selected} />}
    </>
  );
}

function Camera2D() {
  const map = useMap();
  const intent = useAtlas((s) => s.cameraIntent);
  const viewport = useAtlas((s) => s.viewport);
  const cameraOwner = useAtlas((s) => s.cameraOwner);
  const clearCamera = useAtlas((s) => s.clearCamera);
  const setCameraOwner = useAtlas((s) => s.setCameraOwner);
  const setReport = useAtlas((s) => s.setCameraReport);
  const setMapMode = useAtlas((s) => s.setMapMode);

  useEffect(() => {
    if (!map) return;
    const l = map.addListener('idle', () => {
      const c = map.getCenter();
      if (c) setReport({ lat: c.lat(), lng: c.lng(), zoom: map.getZoom() });
    });
    // A user gesture hands the camera to the person until the next run. Without
    // this the agent yanks the viewport back while they are still reading it.
    const drag = map.addListener('dragstart', () => setCameraOwner('user'));
    return () => {
      l.remove();
      drag.remove();
    };
  }, [map, setReport, setCameraOwner]);

  useEffect(() => {
    if (!map || !intent) return;

    // A photoreal-3D intent cannot run on the 2D map. Switch the map into 3D and
    // leave the intent in the store — Camera3D consumes it once Scene3D mounts.
    // Returning WITHOUT clearCamera() is the whole point: this effect used to
    // fall through every branch and then clear, which is why "orbit this tower"
    // outside Cinema looked like it did nothing.
    if (cameraOwner !== 'user' && intentRequiresMode(intent) === '3d') {
      setMapMode('3d');
      return;
    }

    const command = resolveCamera(intent, { viewport, owner: cameraOwner, mode: '2d' });
    const preset = () => {
      const state = useAtlas.getState();
      return state.cities.find((c) => c.id === state.cityId) ?? DEFAULT_CITY_PRESET;
    };

    if (command.kind === 'move') {
      map.moveCamera({
        center: command.center,
        zoom: command.zoom ?? map.getZoom() ?? preset().zoom,
        heading: command.heading,
        tilt: command.tilt,
      });
    } else if (command.kind === 'pan') {
      const targetZoom = command.zoom ?? map.getZoom() ?? preset().zoom;
      const currentZoom = map.getZoom() ?? preset().zoom;
      map.panTo(command.center);
      if (Math.abs(targetZoom - currentZoom) > 0.1) {
        // Tween zoom over ~600ms
        const steps = 20;
        const delta = (targetZoom - currentZoom) / steps;
        let step = 0;
        const zoomInterval = setInterval(() => {
          step++;
          if (step >= steps) {
            clearInterval(zoomInterval);
            map.setZoom(targetZoom);
          } else {
            map.setZoom(currentZoom + delta * step);
          }
        }, 30);
      }
      if (command.heading !== undefined) map.setHeading(command.heading);
      if (command.tilt !== undefined) map.setTilt(command.tilt);
    } else if (command.kind === 'fit') {
      const b = new google.maps.LatLngBounds();
      command.bounds.forEach((p) => b.extend(p));
      if (!b.isEmpty()) map.fitBounds(b, command.padding);
    }

    // Expose to window for smoke test assertions
    if (command.kind !== 'none' && typeof window !== 'undefined') {
      (window as any).__atlasCameraIntent = intent;
    }
    clearCamera();
  }, [map, intent, viewport, cameraOwner, clearCamera, setMapMode]);

  return null;
}

function Routes2D() {
  const map = useMap();
  const routes = useAtlas((s) => s.routes);
  useEffect(() => {
    if (!map) return;
    const lines = routes.flatMap((r) => {
      const casing = new google.maps.Polyline({
        path: r.path,
        strokeColor: '#0b0e14',
        strokeOpacity: r.dashed ? 0 : 0.55,
        strokeWeight: (r.width ?? 5) + 4,
        zIndex: (r.z ?? 1) * 10,
        map,
      });
      const line = new google.maps.Polyline({
        path: r.path,
        strokeColor: r.color ?? '#22d3ee',
        strokeOpacity: r.dashed ? 0 : (r.opacity ?? 0.95),
        strokeWeight: r.width ?? 5,
        zIndex: (r.z ?? 1) * 10 + 1,
        map,
        ...(r.dashed
          ? {
              icons: [
                {
                  icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 },
                  offset: '0',
                  repeat: '14px',
                 },
              ],
            }
          : {}),
      });
      return [casing, line];
    });
    return () => lines.forEach((l) => l.setMap(null));
  }, [map, routes]);
  return null;
}

function Polygons2D() {
  const map = useMap();
  const polygons = useAtlas((s) => s.polygons);
  useEffect(() => {
    if (!map) return;
    const shapes = polygons.map(
      (p) =>
        new google.maps.Polygon({
          paths: p.path,
          fillColor: p.fill ?? '#f87171',
          fillOpacity: p.opacity ?? 0.14,
          strokeColor: p.stroke ?? p.fill ?? '#f87171',
          strokeOpacity: 0.8,
          strokeWeight: 1.5,
          clickable: false,
          map,
        }),
    );
    return () => shapes.forEach((s) => s.setMap(null));
  }, [map, polygons]);
  return null;
}

/** Reach hull + suggested route for the focused/approved mission candidate (2D). */
function missionFocus(candidates: MissionCandidate[], selectedId?: string, winnerId?: string): MissionCandidate | undefined {
  if (winnerId) return candidates.find((c) => c.id === winnerId);
  if (selectedId) return candidates.find((c) => c.id === selectedId);
  return undefined;
}

function MissionGeometry2D() {
  const map = useMap();
  const mission = useMission((s) => s.mission);
  useEffect(() => {
    if (!map) return;
    const winnerId = mission.decision?.approvedAt ? mission.decision.candidateId : undefined;
    const focus = missionFocus(mission.candidates, mission.selectedCandidateId, winnerId);
    const shapes: Array<{ setMap: (m: google.maps.Map | null) => void }> = [];
    // Drawn search area (outer ring + exclusion holes).
    if (mission.area?.path?.length) {
      shapes.push(
        new google.maps.Polygon({
          paths: [mission.area.path as LatLng[], ...((mission.area.excludedPaths ?? []) as LatLng[][])],
          fillColor: '#34d399',
          fillOpacity: 0.08,
          strokeColor: '#34d399',
          strokeOpacity: 0.9,
          strokeWeight: 2,
          clickable: false,
          zIndex: 1,
          map,
        }),
      );
    }
    if (focus?.reachPath?.length) {
      shapes.push(
        new google.maps.Polygon({
          paths: focus.reachPath as LatLng[],
          fillColor: '#60a5fa',
          fillOpacity: 0.12,
          strokeColor: '#60a5fa',
          strokeOpacity: 0.85,
          strokeWeight: 1.5,
          clickable: false,
          zIndex: 2,
          map,
        }),
      );
    }
    if (winnerId && focus?.routePath?.length) {
      shapes.push(
        new google.maps.Polyline({
          path: focus.routePath as LatLng[],
          strokeColor: '#fbbf24',
          strokeOpacity: 0.95,
          strokeWeight: 5,
          zIndex: 30,
          map,
        }),
      );
    }
    return () => shapes.forEach((s) => s.setMap(null));
  }, [map, mission]);
  return null;
}

/** Dynamic raster tile overlay for environment layers. */
function TileOverlay() {
  const map = useMap();
  const layer = useAtlas((s) => s.tileOverlay);
  useEffect(() => {
    if (!map || !layer) return;
    const type = new google.maps.ImageMapType({
      name: layer.toUpperCase(),
      tileSize: new google.maps.Size(256, 256),
      opacity: 0.7,
      getTileUrl: (coord, zoom) =>
        layer === 'pollen'
          ? pollenTileUrl(zoom, coord.x, coord.y)
          : aqiTileUrl(zoom, coord.x, coord.y),
    });
    map.overlayMapTypes.push(type);
    return () => {
      const idx = map.overlayMapTypes.getArray().indexOf(type);
      if (idx >= 0) map.overlayMapTypes.removeAt(idx);
    };
  }, [map, layer]);
  return null;
}

/* ------------------------------------------------------------------ 3D */

function Scene3D() {
  const cityId = useAtlas((s) => s.cityId);
  const cities = useAtlas((s) => s.cities);
  const preset = cities.find((c) => c.id === cityId) ?? DEFAULT_CITY_PRESET;
  const start = useAtlasCameraStart(preset);
  return (
    <Map3D
      className="gm-fill"
      internalUsageAttributionIds={[USAGE_ATTRIBUTION_ID]}
      mode={MapMode.HYBRID}
      defaultCenter={{ ...start.center, altitude: 160 }}
      // Zoom and range are different units for the same idea. Approximating one
      // from the other keeps the 2D→3D switch roughly framed on the same area
      // instead of always arriving at a fixed city-wide altitude.
      defaultRange={rangeForZoom(start.zoom)}
      defaultTilt={start.tilt ?? 62}
      defaultHeading={start.heading ?? 20}
    >
      <Markers3D />
      <MissionReach3D />
      <Camera3D />
      <ScenarioMapLayer />
    </Map3D>
  );
}

/**
 * Camera range (metres from the target) that frames roughly the same ground area
 * as a 2D zoom level. Web-Mercator halves the visible span per zoom step, so the
 * relationship is exponential; the constant is picked so z13 ≈ the old 2200m
 * default. Clamped to keep an extreme zoom from producing an unusable camera.
 */
function rangeForZoom(zoom: number): number {
  return Math.min(20000, Math.max(150, 2200 * 2 ** (13 - zoom)));
}

function Markers3D() {
  const markers = useAtlas((s) => s.markers);
  return (
    <>
      {markers.map((m: MarkerSpec) => (
        <Marker3D
          key={m.id}
          position={{ ...m.position, altitude: 40 }}
          label={m.title ?? m.glyph}
          title={m.title}
          altitudeMode={'RELATIVE_TO_GROUND' as unknown as google.maps.maps3d.AltitudeMode}
        >
          <Pin
            background={m.color ?? '#f472b6'}
            borderColor="#ffffff"
            glyphColor="#0b0e14"
            glyph={m.glyph ?? m.label ?? '•'}
            scale={1.15}
          />
        </Marker3D>
      ))}
    </>
  );
}

/**
 * Reach hull + route for the approved winner in the 3D reveal. Uses the maps3d
 * vector web components when the library exposes them; if it does not, the
 * reveal degrades gracefully to the marker + camera orbit (no throw).
 */
function MissionReach3D() {
  const map3d = useMap3D();
  const mission = useMission((s) => s.mission);
  useEffect(() => {
    if (!map3d) return;
    const decision = mission.decision;
    if (!decision?.approvedAt) return;
    const winner = mission.candidates.find((c) => c.id === decision.candidateId);
    if (!winner?.location) return;
    const created: Element[] = [];
    try {
      if (winner.reachPath?.length && customElements.get('gmp-polygon-3d')) {
        const poly = document.createElement('gmp-polygon-3d') as unknown as {
          setAttribute: (k: string, v: string) => void;
          outerCoordinates: Array<{ lat: number; lng: number }>;
        } & Element;
        poly.setAttribute('altitude-mode', 'clamp-to-ground');
        poly.setAttribute('fill-color', 'rgba(96, 165, 250, 0.25)');
        poly.setAttribute('stroke-color', '#60a5fa');
        poly.setAttribute('stroke-width', '2');
        poly.outerCoordinates = winner.reachPath.map((p) => ({ lat: p.lat, lng: p.lng }));
        map3d.appendChild(poly);
        created.push(poly);
      }
      if (winner.routePath?.length && customElements.get('gmp-polyline-3d')) {
        const line = document.createElement('gmp-polyline-3d') as unknown as {
          setAttribute: (k: string, v: string) => void;
          coordinates: Array<{ lat: number; lng: number }>;
        } & Element;
        line.setAttribute('altitude-mode', 'clamp-to-ground');
        line.setAttribute('stroke-color', '#fbbf24');
        line.setAttribute('stroke-width', '6');
        line.coordinates = winner.routePath.map((p) => ({ lat: p.lat, lng: p.lng }));
        map3d.appendChild(line);
        created.push(line);
      }
    } catch {
      /* maps3d vector elements unavailable — reveal keeps marker + orbit only. */
    }
    return () => created.forEach((el) => el.remove());
  }, [map3d, mission]);
  return null;
}

function Camera3D() {
  const map3d = useMap3D();
  const intent = useAtlas((s) => s.cameraIntent);
  const cameraOwner = useAtlas((s) => s.cameraOwner);
  const clearCamera = useAtlas((s) => s.clearCamera);
  const setReport = useAtlas((s) => s.setCameraReport);
  const setCameraOwner = useAtlas((s) => s.setCameraOwner);

  // Report the 3D camera the way Camera2D reports the 2D one. Without this the
  // store's cameraReport goes stale the moment you enter 3D, so switching back to
  // 2D would return you to wherever you were before the 3D flight — and the
  // shareable URL would carry the wrong coordinates.
  useEffect(() => {
    if (!map3d) return;
    const report = () => {
      // Unlike the 2D map's LatLng, Map3DElement exposes lat/lng as plain
      // accessors rather than methods.
      const center = map3d.center;
      const lat = center?.lat;
      const lng = center?.lng;
      if (typeof lat !== 'number' || typeof lng !== 'number') return;
      setReport({
        lat,
        lng,
        // Invert rangeForZoom so a 3D→2D switch lands at a comparable framing.
        zoom: map3d.range ? Math.round((13 - Math.log2(map3d.range / 2200)) * 100) / 100 : undefined,
        heading: map3d.heading ?? undefined,
        tilt: map3d.tilt ?? undefined,
      });
    };
    const onGesture = () => setCameraOwner('user');
    map3d.addEventListener('gmp-centerchange', report);
    // A drag in 3D hands the camera to the person, exactly as dragstart does in 2D.
    map3d.addEventListener('pointerdown', onGesture);
    report();
    return () => {
      map3d.removeEventListener('gmp-centerchange', report);
      map3d.removeEventListener('pointerdown', onGesture);
    };
  }, [map3d, setReport, setCameraOwner]);

  useEffect(() => {
    if (!map3d || !intent) return;
    // Same reducer as 2D: the 2D/3D split is now only in how a resolved command
    // is executed, not in what each mode decides a given intent means.
    const command = resolveCamera(intent, { owner: cameraOwner, mode: '3d' });

    if (command.kind === 'fly3d') {
      Promise.resolve(
        map3d.flyCameraTo({
          endCamera: {
            center: {
              lat: command.center.lat,
              lng: command.center.lng,
              altitude: command.center.altitude ?? 120,
            },
            tilt: command.tilt ?? 60,
            heading: command.heading ?? 0,
            range: command.range ?? 1500,
          },
          durationMillis: command.durationMs ?? 3500,
        }),
      ).catch((err: unknown) => {
        // Interrupted or superseded by user gesture or another camera transition.
        if (err instanceof Error && (err.name === 'AbortError' || err.message?.includes('Transition was skipped'))) return;
      });
    } else if (command.kind === 'orbit3d') {
      Promise.resolve(
        map3d.flyCameraAround({
          camera: {
            center: {
              lat: command.center.lat,
              lng: command.center.lng,
              altitude: command.center.altitude ?? 120,
            },
            tilt: command.tilt ?? 55,
            range: command.range ?? 900,
          },
          durationMillis: command.durationMs ?? 20000,
          repeatCount: command.repeatCount ?? 1,
        }),
      ).catch((err: unknown) => {
        // Interrupted or superseded by user gesture or another camera transition.
        if (err instanceof Error && (err.name === 'AbortError' || err.message?.includes('Transition was skipped'))) return;
      });
    } else if (command.kind === 'stop3d') {
      map3d.stopCameraAnimation();
    }

    if (command.kind !== 'none' && typeof window !== 'undefined') {
      (window as any).__atlasCameraIntent = intent;
    }
    clearCamera();
  }, [map3d, intent, cameraOwner, clearCamera]);

  return null;
}
