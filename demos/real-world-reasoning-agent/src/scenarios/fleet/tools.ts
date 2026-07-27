import type { ToolDefinition } from '@/lib/types';
import { COMMON_TOOLS } from '@/ai/tools/common';
import { fleet } from './store';
import {
  fleetStateForModel,
  etaMatrix,
  dispatchAssign,
  setAvoidZone,
  clearAvoidZone,
  followVan,
} from './sim';

const num = (v: unknown, d = 0) => (typeof v === 'number' ? v : Number(v) || d);
const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);

const getFleetStateTool: ToolDefinition = {
  declaration: {
    name: 'get_fleet_state',
    description:
      'Get the current state of the fleet: every van (id, status, current job, ETA, position) and every open job (id, status, pickup, dropoff) plus KPIs. Call before answering dispatch questions.',
    parametersJsonSchema: { type: 'object', properties: {} },
  },
  handler: async () => fleetStateForModel() as Record<string, unknown>,
};

const etaMatrixTool: ToolDefinition = {
  declaration: {
    name: 'eta_matrix',
    description:
      'Compute live traffic-aware ETAs from EVERY van to a target coordinate, sorted fastest first. Use to answer "who reaches X fastest?". Pass the target lat/lng (resolve a place name with search_places first if needed).',
    parametersJsonSchema: {
      type: 'object',
      properties: { lat: { type: 'number' }, lng: { type: 'number' } },
      required: ['lat', 'lng'],
    },
  },
  handler: async (a) => {
    const rows = await etaMatrix({ lat: num(a.lat), lng: num(a.lng) });
    return { ranking: rows };
  },
};

const assignJobTool: ToolDefinition = {
  declaration: {
    name: 'assign_job',
    description: 'Assign a specific job to a specific van; the van reroutes immediately on real streets.',
    parametersJsonSchema: {
      type: 'object',
      properties: { vanId: { type: 'string' }, jobId: { type: 'string' } },
      required: ['vanId', 'jobId'],
    },
  },
  handler: async (a) => dispatchAssign(str(a.vanId), str(a.jobId)),
};

const setAvoidZoneTool: ToolDefinition = {
  declaration: {
    name: 'set_avoid_zone',
    description:
      'Create a temporary avoid-zone (circle) that affected vans must route around; or clear it. Use for "avoid the Embarcadero / this area".',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        clear: { type: 'boolean', description: 'set true to remove the zone' },
        lat: { type: 'number' },
        lng: { type: 'number' },
        radiusMeters: { type: 'number', description: 'default 500' },
      },
    },
  },
  handler: async (a) => {
    if (a.clear === true) {
      clearAvoidZone();
      return { ok: true, cleared: true };
    }
    return setAvoidZone({ lat: num(a.lat), lng: num(a.lng) }, num(a.radiusMeters, 500));
  },
};

const setSimSpeedTool: ToolDefinition = {
  declaration: {
    name: 'set_sim_speed',
    description: 'Set the simulation clock speed multiplier (1, 4, or 16).',
    parametersJsonSchema: {
      type: 'object',
      properties: { multiplier: { type: 'number', enum: [1, 4, 16] } },
      required: ['multiplier'],
    },
  },
  handler: async (a) => {
    const m = [1, 4, 16].includes(num(a.multiplier)) ? num(a.multiplier) : 4;
    fleet().setSimSpeed(m);
    return { ok: true, simSpeed: m };
  },
};

const followVanTool: ToolDefinition = {
  declaration: {
    name: 'follow_van',
    description: 'Make the camera follow a van (or pass null/none to stop following).',
    parametersJsonSchema: {
      type: 'object',
      properties: { vanId: { type: 'string', description: 'van id, or "none" to stop' } },
      required: ['vanId'],
    },
  },
  handler: async (a) => {
    const id = str(a.vanId);
    return followVan(!id || id.toLowerCase() === 'none' || id.toLowerCase() === 'null' ? null : id);
  },
};

export const FLEET_TOOLS: ToolDefinition[] = [
  ...COMMON_TOOLS,
  getFleetStateTool,
  etaMatrixTool,
  assignJobTool,
  setAvoidZoneTool,
  setSimSpeedTool,
  followVanTool,
];
