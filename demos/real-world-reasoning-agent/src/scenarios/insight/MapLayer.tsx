import { useEffect } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import { analyzeLocation } from './controller';
import { insight } from './store';

/** Click anywhere on the map → analyze that exact spot (slot A, or B if A is set and B empty). */
export function InsightMapLayer() {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const l = map.addListener('click', (e: google.maps.MapMouseEvent) => {
      const ll = e.latLng;
      if (!ll) return;
      const loc = { lat: ll.lat(), lng: ll.lng() };
      const s = insight();
      const slot = s.activeSlot;
      if (slot === 'A') {
        // Fresh subject A clears prior compare B.
        s.setDossier('B', null);
        s.setActiveSlot('B');
      }
      void analyzeLocation(loc, slot);
    });
    return () => l.remove();
  }, [map]);
  return null;
}
