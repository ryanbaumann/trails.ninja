import { describe, expect, it } from 'vitest';
import { buildCompareSurface } from './compareSurface';
import type { ComparePayload } from './controller';
import { validateMessages, type UpdateComponentsMsg, type UpdateDataModelMsg } from '@/genui/protocol';

const payload: ComparePayload = {
  ok: true,
  area: 'Embarcadero corridor',
  winner: { candidateId: 'a', label: 'Branch', total: 66.1, location: { lat: 37.8, lng: -122.4 } },
  rows: [
    {
      candidateId: 'a',
      label: 'Branch',
      rank: 1,
      address: '524 Washington St, San Francisco, CA 94111, USA',
      scores: { visibility: 90, condition: 70, activity: 60, access: 55, environment: 80, total: 66.1 },
    },
    {
      candidateId: 'b',
      label: 'Retailpeer Inc',
      rank: 2,
      address: '447 Sutter St Ste 506-1406, San Francisco, CA 94108, USA',
      scores: { visibility: 80, condition: 85, activity: 55, access: 45, environment: 75, total: 63.6 },
    },
  ],
};

describe('buildCompareSurface', () => {
  it('produces a valid A2UI batch with a rooted comparison surface', () => {
    const { surfaceId, messages } = buildCompareSurface(payload);
    expect(surfaceId).toMatch(/^scout-compare-/);
    const result = validateMessages(messages);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('binds every score via the data model — no raw {token} placeholders anywhere', () => {
    const { messages } = buildCompareSurface(payload);
    // No component prop should carry a literal mustache placeholder like "{total}".
    const serialized = JSON.stringify(messages);
    expect(serialized).not.toMatch(/\{[a-zA-Z]/);

    const dataMsg = messages.find((m): m is UpdateDataModelMsg => 'updateDataModel' in m)!;
    const rows = dataMsg.updateDataModel.value as { stats: { label: string; value: number }[]; heading: string }[];
    expect(rows).toHaveLength(2);
    expect(rows[0].heading).toBe('#1  Branch');
    // Real numeric sub-scores land in the data model, not tokens.
    expect(rows[0].stats.map((s) => s.value)).toEqual([90, 70, 60, 55, 80]);
    expect(rows[0].stats.map((s) => s.label)).toEqual(['Visibility', 'Condition', 'Activity', 'Access', 'Environment']);
  });

  it('wires a fly_to button to the winner location', () => {
    const { messages } = buildCompareSurface(payload);
    const compMsg = messages.find((m): m is UpdateComponentsMsg => 'updateComponents' in m)!;
    const fly = compMsg.updateComponents.components.find((c) => c.id === 'cmp-fly');
    expect(fly?.component).toBe('Button');
    expect((fly?.action as { event: { name: string; context: Record<string, number> } }).event).toMatchObject({
      name: 'fly_to',
      context: { lat: 37.8, lng: -122.4, zoom: 17 },
    });
  });
});
