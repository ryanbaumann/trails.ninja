import assert from 'node:assert/strict';
import test from 'node:test';
import { createPlaceDetailsContent } from '../src/place-details.js';

function fakeDocument() {
  return {
    createElement(tagName) {
      return {
        tagName,
        attributes: {},
        children: [],
        style: { cssText: '' },
        setAttribute(name, value) { this.attributes[name] = value; },
        append(...children) { this.children.push(...children); },
      };
    },
  };
}

test('builds a large Places UI Kit detail element for a selected result', () => {
  const place = { displayName: 'Selected result' };
  const details = createPlaceDetailsContent(place, fakeDocument());

  assert.equal(details.tagName, 'gmp-place-details');
  assert.equal(details.attributes['internal-usage-attribution-ids'], 'gmp_git_agentskills_v1');
  assert.equal(details.attributes['aria-label'], 'Details for Selected result');
  assert.match(details.style.cssText, /width: min\(360px/);
  assert.match(details.style.cssText, /color-scheme: dark/);
  assert.deepEqual(details.children.map(({ tagName }) => tagName), [
    'gmp-place-details-place-request',
    'gmp-place-all-content',
  ]);
  assert.equal(details.children[0].place, place);
});
