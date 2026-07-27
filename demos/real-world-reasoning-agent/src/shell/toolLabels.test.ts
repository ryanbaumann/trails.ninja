import { describe, expect, it } from 'vitest';
import { TOOL_LABELS, labelForTool } from './toolLabels';
import { COMMON_TOOLS } from '@/ai/tools/common';
import { CONCIERGE_TOOLS } from '@/scenarios/concierge/tools';
import { INSIGHT_TOOLS } from '@/scenarios/insight/tools';
import { FLEET_TOOLS } from '@/scenarios/fleet/tools';
import { CINEMA_TOOLS } from '@/scenarios/cinema/tools';
import { ADSTUDIO_TOOLS } from '@/scenarios/adstudio/tools';
import { SCOUT_TOOLS } from '@/scenarios/scout/tools';
import type { ToolDefinition } from '@/lib/types';

const ALL_TOOLS: ToolDefinition[] = [
  ...COMMON_TOOLS,
  ...CONCIERGE_TOOLS,
  ...INSIGHT_TOOLS,
  ...FLEET_TOOLS,
  ...CINEMA_TOOLS,
  ...ADSTUDIO_TOOLS,
  ...SCOUT_TOOLS,
];

const ALL_NAMES: string[] = [
  ...new Set(ALL_TOOLS.map((t) => t.declaration.name).filter((n): n is string => typeof n === 'string')),
];

describe('labelForTool', () => {
  it('has an explicit agent-voice label for every registered tool (no snake_case fall-through)', () => {
    const missing = ALL_NAMES.filter((name) => !(name in TOOL_LABELS));
    expect(missing).toEqual([]);
  });

  it('never renders a snake_case name for a registered tool', () => {
    for (const name of ALL_NAMES) {
      expect(labelForTool(name)).not.toMatch(/_/);
    }
  });

  it('falls back to a spaced label for unknown tools', () => {
    expect(labelForTool('some_new_tool')).toBe('some new tool');
  });
});
