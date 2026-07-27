import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Hexagon, X } from 'lucide-react';
import { useMap } from '@vis.gl/react-google-maps';
import { TerraDraw, TerraDrawPolygonMode } from 'terra-draw';
import { TerraDrawGoogleMapsAdapter } from 'terra-draw-google-maps-adapter';
import { useAtlas } from '@/state/store';
import { useMission } from './store';
import type { LatLng } from '@/lib/types';
import { ringCenter } from './geometry';
import './AreaEditor.css';

/** GeoJSON rings are [lng,lat] and closed (first === last); Atlas uses {lat,lng} open rings. */
function ringToLatLng(ring: number[][]): LatLng[] {
  const open = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
    ? ring.slice(0, -1)
    : ring;
  return open.map(([lng, lat]) => ({ lat, lng }));
}

/**
 * Interactive area / exclusion editor built on Terra Draw (the maintained
 * successor to the deprecated Maps Drawing Library). Only mounted in the 2D
 * scene during an active mission. The first polygon becomes the search area;
 * any holes or additional polygons become exclusions.
 */
export function AreaEditor() {
  const map = useMap();
  const landingDismissed = useAtlas((s) => s.landingDismissed);
  const status = useMission((s) => s.mission.status);
  const setArea = useMission((s) => s.setArea);
  const hasArea = useMission((s) => Boolean(s.mission.area));
  const [drawing, setDrawing] = useState(false);
  const drawRef = useRef<TerraDraw | null>(null);

  const active = landingDismissed && status !== 'draft';

  useEffect(() => {
    if (!map || !active || !drawing) return;
    const draw = new TerraDraw({
      adapter: new TerraDrawGoogleMapsAdapter({ lib: google.maps, map }),
      modes: [new TerraDrawPolygonMode()],
    });
    draw.start();
    draw.setMode('polygon');
    drawRef.current = draw;

    const commit = () => {
      const polygons = draw
        .getSnapshot()
        .filter((f) => f.geometry.type === 'Polygon')
        .map((f) => f.geometry.coordinates as number[][][]);
      if (!polygons.length) return;
      const [firstOuter, ...firstHoles] = polygons[0];
      const excludedPaths = [
        ...firstHoles.map(ringToLatLng),
        ...polygons.slice(1).flatMap((rings) => rings.map(ringToLatLng)),
      ];
      const path = ringToLatLng(firstOuter);
      setArea({
        kind: 'polygon',
        center: ringCenter(path),
        path,
        excludedPaths: excludedPaths.length ? excludedPaths : undefined,
      });
    };
    draw.on('finish', commit);

    return () => {
      draw.off('finish', commit);
      try {
        draw.stop();
      } catch {
        /* adapter already torn down with the map */
      }
      drawRef.current = null;
    };
  }, [map, active, drawing, setArea]);

  if (!active) return null;

  const clearArea = () => {
    drawRef.current?.clear();
    setArea(undefined);
    setDrawing(false);
  };

  return createPortal(
    <div className="area-editor" role="group" aria-label="Search area editor">
      <button
        className={`area-editor__btn${drawing ? ' is-active' : ''}`}
        aria-pressed={drawing}
        onClick={() => setDrawing((v) => !v)}
      >
        <Hexagon size={13} aria-hidden="true" />
        {drawing ? 'Finish area' : hasArea ? 'Edit area' : 'Draw area'}
      </button>
      {(hasArea || drawing) && (
        <button className="area-editor__btn area-editor__btn--ghost" onClick={clearArea} aria-label="Clear search area">
          <X size={13} aria-hidden="true" /> Clear
        </button>
      )}
    </div>,
    document.body,
  );
}
