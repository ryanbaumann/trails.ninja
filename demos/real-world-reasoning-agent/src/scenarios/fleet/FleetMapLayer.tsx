import { useEffect } from 'react';
import { AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { startFleet, stopFleet } from './sim';
import { useFleet } from './store';
import { useAtlas } from '@/state/store';
import { AtlasMarker } from '@/shell/AtlasMarker';

/**
 * Mounts the deck.gl fleet simulation onto the vis.gl map instance. All van
 * motion, trails and demand heat render through a single GoogleMapsOverlay
 * driven by the sim's rAF loop — this component only wires start/stop to the map.
 */
export function FleetMapLayer() {
  const map = useMap();
  const vans = useFleet((s) => s.vans);
  const jobs = useFleet((s) => s.jobs);
  const selectedVanId = useFleet((s) => s.selectedVanId);
  const selectVan = useFleet((s) => s.selectVan);
  const setFollow = useFleet((s) => s.setFollow);
  const addRoute = useAtlas((s) => s.addRoute);
  const clearRoutes = useAtlas((s) => s.clearRoutes);
  const setCamera = useAtlas((s) => s.setCamera);

  const cityId = useAtlas((s) => s.cityId);

  useEffect(() => {
    if (!map) return;
    void startFleet(map);
    return () => stopFleet();
  }, [map, cityId]);

  useEffect(() => {
    const van = vans.find((v) => v.id === selectedVanId);
    if (!van || van.routePath.length < 2) {
      clearRoutes();
      return;
    }
    addRoute({
      id: 'fleet-selected-route',
      path: van.routePath,
      color: van.status === 'returning' ? '#f59e0b' : '#22d3ee',
      width: 6,
      opacity: 0.95,
      z: 20,
      scenario: 'fleet',
    });
  }, [addRoute, clearRoutes, selectedVanId, vans]);

  return (
    <>
      {vans.map((v) => (
        <AdvancedMarker
          key={v.id}
          position={v.position}
          title={`${v.label} · ${v.status}`}
          zIndex={v.id === selectedVanId ? 30 : 15}
          onClick={() => {
            const next = selectedVanId === v.id ? null : v.id;
            selectVan(next);
            setFollow(next);
            if (next) setCamera({ kind: 'fly', center: v.position, zoom: 16 });
          }}
        >
          <AtlasMarker
            selected={v.id === selectedVanId}
            marker={{
              id: v.id,
              position: v.position,
              color: v.status === 'idle' ? '#8a93a6' : v.status === 'returning' ? '#f59e0b' : '#22d3ee',
              glyph: '🚚',
              kind: 'truck',
              heading: v.heading,
            }}
          />
        </AdvancedMarker>
      ))}
      {jobs.map((j) => (
        <AdvancedMarker
          key={j.id}
          position={j.pickup}
          title={`${j.label} · pickup ${j.status}`}
          zIndex={10}
        >
          <AtlasMarker
            selected={false}
            marker={{
              id: j.id,
              position: j.pickup,
              color: j.status === 'unassigned' ? '#f59e0b' : '#6d5ef3',
              glyph: '📦',
              kind: 'chip',
            }}
          />
        </AdvancedMarker>
      ))}
    </>
  );
}
