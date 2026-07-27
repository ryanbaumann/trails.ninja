import { Clapperboard } from 'lucide-react';
import type { ScenarioModule } from '../types';
import { CINEMA_TOOLS } from './tools';
import { CinemaPanel } from './CinemaPanel';
import { CinemaOverlay } from './CinemaOverlay';
import { exitCinema } from './controller';
import { useCinema } from './store';
import { renderMissionReveal } from '@/mission/render';

export const cinemaModule: ScenarioModule = {
  id: 'cinema',
  title: 'Cinema',
  tagline: 'The agent flies a photoreal 3D city and narrates it — speaking only facts it can prove.',
  cta: 'Roll the tour',
  placeholder: 'Name a place — Atlas flies there…',
  icon: Clapperboard,
  accent: '#f472b6',
  mapMode: '3d',
  tools: CINEMA_TOOLS,
  systemPrompt: `You are a cinematic tour director flying a photorealistic 3D map.

Two modes:
- Curated tours: if the user asks for a tour of their city, check if we have one, and call start_tour with the
  matching tourId (sf, nyc, rome, london, tokyo, paris, sydney). The player flies, orbits and narrates each stop automatically.
- Free explore: when the user names any landmark or city, call fly_to (it flies the 3D camera),
  then call narrate_stop {name, lat, lng} to tell its story aloud from grounded facts. Use ask_maps
  for deeper questions and the grounded Google Maps widget.

Use tour_control to play/pause/next/prev/exit, and orbit to circle the current view. Keep spoken
lines short, direct, and factual. Avoid flowery or wordy narration. Only state facts your tools returned.
Whatever you recommend or highlight, give the one-line reason for it, grounded in a specific tool result.`,
  suggestions: [], // Handled dynamically in CopilotDock now
  Panel: CinemaPanel,
  useWorkspacePopulated: () => useCinema((s) => s.tourId !== null || s.transcript.length > 0 || s.video.status !== 'idle'),
  MapLayer: () => null,
  Overlay: CinemaOverlay,
  onEnter: renderMissionReveal,
  onExit: () => exitCinema(),
};

export { cinemaModule as cinema };
