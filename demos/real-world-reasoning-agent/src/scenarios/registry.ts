import type { ScenarioId } from '@/lib/types';
import type { ScenarioModule } from './types';
import { concierge } from './concierge';
import { insight } from './insight';
import { fleet } from './fleet';
import { cinema } from './cinema';
import { adstudio } from './adstudio';
import { scout } from './scout';

export const SCENARIOS: Record<ScenarioId, ScenarioModule> = {
  concierge,
  insight,
  fleet,
  cinema,
  adstudio,
  scout,
};

export const SCENARIO_ORDER: ScenarioId[] = [
  'concierge',
  'insight',
  'fleet',
  'cinema',
  'adstudio',
  'scout',
];
