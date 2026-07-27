import { describe, expect, it } from 'vitest';
import { interpolateSelection, resolveActionContext } from './actionHelpers';

describe('resolveActionContext', () => {
  it('resolves nested binding objects against the data model and scope', () => {
    const data = { places: [{ name: 'Ferry Cafe' }], filters: { open: true } };

    expect(
      resolveActionContext(
        {
          prompt: 'tell me about it',
          placeName: { path: 'name' },
          filter: { path: '/filters/open' },
          nested: [{ path: 'name' }],
        },
        data,
        '/places/0',
      ),
    ).toEqual({
      prompt: 'tell me about it',
      placeName: 'Ferry Cafe',
      filter: true,
      nested: ['Ferry Cafe'],
    });
  });
});

describe('interpolateSelection', () => {
  it('replaces {selection} tokens throughout action context strings', () => {
    expect(
      interpolateSelection(
        {
          prompt: 'filter the espresso list: {selection}',
          nested: ['picked {selection}'],
        },
        'open now',
      ),
    ).toEqual({
      prompt: 'filter the espresso list: open now',
      nested: ['picked open now'],
    });
  });

  it('joins multi-select values before interpolation', () => {
    expect(interpolateSelection({ prompt: 'use {selection}' }, ['open', 'walkable'])).toEqual({
      prompt: 'use open, walkable',
    });
  });
});
