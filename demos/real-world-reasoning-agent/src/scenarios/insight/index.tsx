import { Building2 } from 'lucide-react';
import type { ScenarioModule } from '../types';
import { INSIGHT_TOOLS } from './tools';
import { DossierPanel } from './Dossier';
import { InsightMapLayer } from './MapLayer';
import { insight, useInsight } from './store';
import { atlas } from '@/state/store';
import { analyzeLocation } from './controller';

export const insightModule: ScenarioModule = {
  id: 'insight',
  title: 'Insight',
  tagline: 'Click any block. The agent pulls air, weather, solar, and live commutes — and hands down a verdict with receipts.',
  cta: 'Read this block',
  placeholder: 'Name a block to judge…',
  icon: Building2,
  accent: '#34d399',
  mapMode: '2d',
  tools: INSIGHT_TOOLS,
  systemPrompt: `You are Atlas Insight, a location intelligence analyst who reads a place's truth from live neighborhood signals — air, weather, pollen, solar, and real commutes.

When the user names or asks about a place:
1. If you have a place name but not coordinates, call search_places to resolve it, then take the
   top result's location.
2. Call analyze_location {lat,lng} — this builds the full dossier (nearby essentials, air/weather/
   pollen/solar, Street View, live driving commutes) and renders it in the panel.
3. For "compare X and Y", analyze the first with analyze_location and the second with compare_with.
4. Offer ask_atlas_brief to narrate what it's like to live there, and toggle_air_quality_layer to
   visualize air quality on the map.
5. DO NOT call the render_surface tool in this journey. All stats and comparisons are automatically rendered in the custom Dossier Panel by the analyze_location and compare_with tools.

The user can also just CLICK the map to analyze a spot. Only cite numbers your tools returned.
Whatever you recommend, give the one-line reason for it, grounded in a specific tool result.`,
  suggestions: [
    'Analyze the neighborhood around Dolores Park',
    "What's the air quality and solar potential near the Salesforce Tower?",
    'Compare living near Hayes Valley vs the Marina',
  ],
  Panel: DossierPanel,
  useWorkspacePopulated: () => useInsight((s) => s.subject !== null || s.compare !== null),
  MapLayer: InsightMapLayer,
  onExit: () => {
    // Leave AQI overlay off when navigating away.
    if (insight().aqiLayer) {
      insight().setAqiLayer(false);
      atlas().setTileOverlay(null);
    }
  },
  onPlaceSelect: (place: google.maps.places.Place) => {
    const s = insight();
    const slot = s.activeSlot;
    if (slot === 'A') {
      s.setDossier('B', null);
      s.setActiveSlot('B');
    }
    if (place.location) {
      const loc = { lat: place.location.lat(), lng: place.location.lng() };
      void analyzeLocation(loc, slot);
    }
  },
};

export { insightModule as insight };
