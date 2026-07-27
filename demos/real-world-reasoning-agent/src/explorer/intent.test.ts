import { describe, expect, it } from 'vitest';
import { classifyExplorerIntent } from './intent';

describe('explorer intent classifier', () => {
  it.each([
    ['Find a nearby errand stop with the shortest drive.', { travelMode: 'DRIVE', currentWeatherRequested: false }],
    ['Find a quiet-work café I can walk to.', { travelMode: 'WALK', currentWeatherRequested: false }],
    ['Find lunch and tell me if I need a jacket.', { travelMode: 'WALK', currentWeatherRequested: true }],
    ['Find lunch and check the current weather.', { travelMode: 'WALK', currentWeatherRequested: true }],
  ] as const)('classifies %s', (query, expected) => {
    expect(classifyExplorerIntent(query)).toEqual(expected);
  });

  it('defaults conservatively when mode or current conditions are ambiguous', () => {
    expect(classifyExplorerIntent('Find somewhere I could walk or drive to with a future forecast.')).toEqual({
      travelMode: 'WALK',
      currentWeatherRequested: false,
    });
  });
});
