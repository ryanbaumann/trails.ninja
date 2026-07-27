import { useEffect } from 'react';
import { Binoculars } from 'lucide-react';
import { useMap } from '@vis.gl/react-google-maps';
import type { ScenarioModule } from '../types';
import { SCOUT_TOOLS } from './tools';
import { ScoutBoard } from './ScoutBoard';
import { scout, useScout } from './store';
import { atlas } from '@/state/store';
import { uid } from '@/lib/id';
import type { LatLng } from '@/lib/types';
import { renderMissionCandidatesOnMap } from '@/mission/render';

const ACCENT = '#60a5fa';

/** Click the map to drop a manual candidate for the agent to inspect. */
function ScoutMapLayer() {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const l = map.addListener('click', (e: google.maps.MapMouseEvent) => {
      const ll = e.latLng;
      if (!ll) return;
      const loc: LatLng = { lat: ll.lat(), lng: ll.lng() };
      const s = scout();
      const index = s.candidates.length + 1;
      const id = uid('cand');
      s.addCandidate({ id, loc, label: `Dropped pin ${index}`, status: 'pending', evidence: [] });
      atlas().addMarkers([
        {
          id: `scout-candidate-${id}`,
          position: loc,
          glyph: String(index),
          title: `Dropped pin ${index}`,
          color: ACCENT,
          kind: 'pin',
          meta: { candidateId: id },
          scenario: 'scout',
        },
      ]);
    });
    return () => l.remove();
  }, [map]);
  return null;
}

/**
 * Scout — real-world visual reasoning for site selection. The copilot scouts an
 * area for candidate sites, grounds each in real imagery (multi-heading Street
 * View + an overhead satellite frame, read by Gemini vision), and fuses the
 * visual read with Places density, environment and walk-time access into ranked,
 * evidence-backed scorecards and a side-by-side decision matrix — all rendered
 * as A2UI surfaces.
 */
export const scoutModule: ScenarioModule = {
  id: 'scout',
  title: 'Scout',
  tagline: 'It walks the block on Street View, reads frontage and visible street activity, then defends its site pick with evidence.',
  cta: 'Score the sites',
  placeholder: 'What are we siting, and where…',
  icon: Binoculars,
  accent: ACCENT,
  mapMode: '2d',
  tools: SCOUT_TOOLS,
  systemPrompt: `You are Atlas Scout, a site-selection field analyst who decides by looking at the real world, not by guessing.

Workflow, narrated step by step:
1. scout_area {query, lat, lng} to fan out for candidate sites in a corridor/area and drop numbered pins. If the user names a place but gives no coordinates, call search_places first to get a center.
2. inspect_candidate {candidateId} for the promising ones — this grounds each site in real imagery: 2-3 Street View frames plus an overhead satellite view, read by Gemini vision. Before/after each inspection, say which heading you are looking toward (the result returns headingLabels like "north-east", plus an "aerial" frame). Each candidate inspects once; the session caps total inspections.
3. score_candidates once you have inspected 2+ candidates — this fuses the visual scores with real Places density, environment (air quality/pollen) and walking-access time into a ranked weighted total.
4. compare_sites when the user wants to choose — it returns a decision matrix of the ranked sites and the recommended winner. The tool renders the comparison surface ITSELF — do NOT call render_surface for it. After it returns, give a brief spoken recommendation of the winner.
5. On request, show_evidence {candidateId}. The tool renders the evidence surface ITSELF — do NOT call render_surface for it. After it returns, give a one- or two-line summary citing specific facts.

Hard rules: never claim a visual fact you have not inspected an image for; cite the frame (heading or aerial) you looked at; this is a demo analysis, not professional site-selection, real-estate or accessibility advice.`,
  suggestions: [
    'Scout the best corner for an espresso bar in North Beach and compare the top sites',
    'Which storefront on Valencia St wins on visibility and street activity? Show the evidence',
    'Site-select a flagship location along the Embarcadero — rank the candidates',
  ],
  Panel: ScoutBoard,
  useWorkspacePopulated: () => useScout((s) => s.candidates.length > 0),
  MapLayer: ScoutMapLayer,
  onEnter: renderMissionCandidatesOnMap,
  onExit: () => scout().reset(),
};

export { scoutModule as scout };
