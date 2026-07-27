import { describe, expect, it } from 'vitest';
import { CITIES } from './cities';

describe('city suggestions', () => {
  it('keeps every suggestion within the 110-char budget (chips truncate, titles show full)', () => {
    const tooLong: string[] = [];
    for (const city of CITIES) {
      for (const list of Object.values(city.suggestions)) {
        for (const s of list) {
          if (s.length > 110) tooLong.push(`${city.id}: "${s}" (${s.length})`);
        }
      }
    }
    expect(tooLong).toEqual([]);
  });

  it('provides three suggestions per scenario for every city', () => {
    for (const city of CITIES) {
      for (const [scenario, list] of Object.entries(city.suggestions)) {
        expect(list, `${city.id}/${scenario}`).toHaveLength(3);
      }
    }
  });
});
