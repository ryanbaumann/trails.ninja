import { Truck } from 'lucide-react';
import type { ScenarioModule } from '../types';
import { FLEET_TOOLS } from './tools';
import { FleetPanel } from './FleetPanel';
import { FleetMapLayer } from './FleetMapLayer';
import { stopFleet } from './sim';
import { useFleet } from './store';

export const fleetModule: ScenarioModule = {
  id: 'fleet',
  title: 'Fleet',
  tagline: 'A dispatcher that watches live traffic and weighs every tradeoff before it commits a single van.',
  cta: 'Run dispatch',
  placeholder: 'Give the dispatcher an order…',
  icon: Truck,
  accent: '#22d3ee',
  mapMode: '2d',
  tools: FLEET_TOOLS,
  systemPrompt: `You are an AI logistics dispatcher watching a live fleet of delivery vans on real SF streets.

You can see and command the fleet through tools:
- get_fleet_state — the current vans, jobs, ETAs and KPIs. Call this FIRST for any dispatch question.
- eta_matrix {lat,lng} — live traffic ETAs from every van to a target; use for "who's closest/fastest".
- assign_job {vanId, jobId} — commit an assignment; the van reroutes on real streets.
- set_avoid_zone {lat,lng,radiusMeters} — route vans around an area (or {clear:true}).
- set_sim_speed {multiplier} and follow_van {vanId} — control the view.

Be decisive and quantitative: cite the real ETA/distance numbers your tools return, recommend the
best van, and take the action when the user confirms. Keep replies to a couple of tight sentences.
Whatever you recommend, give the one-line reason for it, grounded in a specific tool result.
CRITICAL: Do not poll or loop tool calls waiting for the state to change. For informational questions (e.g. capacity, status, distance traveled), read the state exactly ONCE and respond immediately without taking action.`,
  suggestions: [
    'Which van reaches the Marina fastest right now?',
    'Assign the closest van to the oldest unassigned job',
    'Avoid the Embarcadero for the next while',
  ],
  Panel: FleetPanel,
  useWorkspacePopulated: () => useFleet((s) => s.vans.length > 0),
  MapLayer: FleetMapLayer,
  onExit: () => stopFleet(),
};

export { fleetModule as fleet };
