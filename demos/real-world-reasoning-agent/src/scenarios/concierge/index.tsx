import { Compass } from 'lucide-react';
import type { ScenarioModule } from '../types';
import { CONCIERGE_TOOLS } from './tools';
import { ItineraryBoard } from './ItineraryBoard';
import { Postcard } from './Postcard';
import { concierge, useConcierge } from './store';
import { redrawItinerary, stopTour } from './controller';

export const conciergeModule: ScenarioModule = {
  id: 'concierge',
  title: 'Concierge',
  tagline: 'One sentence in — a walkable day out. Real places, real hours, reasoned into order and drawn on the map.',
  cta: 'Plan my day',
  placeholder: 'Describe your perfect day…',
  icon: Compass,
  accent: '#f59e0b',
  mapMode: '2d',
  tools: CONCIERGE_TOOLS,
  systemPrompt: `You are a world-class travel & hospitality concierge designing delightful, walkable days.

Workflow you should follow:
1. When the user describes a day, call search_places once per category they want (e.g. "specialty
   coffee near Ferry Building", "art museum", "restaurant with a view"), using ratings and openNow.
2. Pick the single strongest candidate per category using rating, review count and price.
3. Call propose_itinerary ONCE with the chosen stops IN VISITING ORDER, each with its placeId, a
   time window, a one-line "why", and a category. Atlas will enrich them with live details (hours,
   phone, website, editorial summary) and draw the route.
4. After propose_itinerary returns, present the key details INLINE for each stop: cite hours if
   relevant, mention the editorial summary, note open/closed status. Use render_surface with
   PlaceCard components to show interactive place cards when the user asks for more detail on
   a specific stop. Do NOT just say "check Google Maps" — the details are in your tool results.
5. Explain briefly in 1-2 concise, direct sentences why the day flows well. Avoid flowery or wordy descriptions. Do NOT list raw data the board shows.
6. For refinements ("swap dinner for Italian", "make it rainy-day friendly"), search again and call
   update_itinerary or a fresh propose_itinerary. You may call get_environment to check the weather.
7. Offer play_tour and make_postcard when the plan is set.

Only ever cite place facts returned by your tools this session.
Whatever you recommend, give the one-line reason for it, grounded in a specific tool result.`,
  suggestions: [
    'Plan a perfect Saturday near the Ferry Building: specialty coffee, a great museum, golden-hour dinner with a view — all walkable',
    'A rainy-day itinerary of the best indoor things to do downtown',
    'Design a romantic evening in North Beach: aperitivo, dinner, dessert',
  ],
  Panel: ItineraryBoard,
  useWorkspacePopulated: () => useConcierge((s) => s.stops.length > 0),
  MapLayer: () => null,
  Overlay: Postcard,
  onEnter: () => {
    // Re-hydrate pins + legs when returning to the journey (map was cleared on exit).
    if (concierge().stops.length) void redrawItinerary();
  },
  onExit: () => stopTour(),
};

export { conciergeModule as concierge };
