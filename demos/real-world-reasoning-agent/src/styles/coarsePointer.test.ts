import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Coarse-pointer hit-target invariant (reliability plan §4, area 8: keyboard /
 * coarse-pointer navigation). The A2UI hardening pass raised catalog buttons and
 * chips to >=44x44 on touch devices; this locks that so a later refactor can't
 * silently drop below the WCAG 2.5.5 target size on the exact controls the hero
 * journey taps. Deterministic: it reads the stylesheet, so it needs no DOM.
 */

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, 'global.css'), 'utf8');

/** Extract the body of the first `@media (pointer: coarse)` block (brace-balanced). */
function coarsePointerBlock(source: string): string {
  const start = source.indexOf('@media (pointer: coarse)');
  expect(start).toBeGreaterThan(-1);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  throw new Error('unbalanced @media (pointer: coarse) block');
}

describe('coarse-pointer hit targets', () => {
  const block = coarsePointerBlock(css);

  it('sizes catalog buttons and pickable chips to at least 44x44 on touch', () => {
    expect(block).toMatch(/\.genui-btn/);
    expect(block).toMatch(/\.genui-chip--pickable/);
    expect(block).toMatch(/min-height:\s*44px/);
    expect(block).toMatch(/min-width:\s*44px/);
  });

  it('grows the tap area of the compact copilot/fleet/map controls', () => {
    for (const selector of ['.copilot-chip-btn', '.fleet-speed-btn', '.genui-mappreview']) {
      expect(block).toContain(selector);
    }
    // AdCreative action buttons — the hero journey's final tap surface.
    expect(block).toMatch(/\.genui-adcreative__actions \.genui-btn/);
  });

  it('confirms at least four min-height:44px declarations inside the coarse block', () => {
    const count = (block.match(/min-height:\s*44px/g) ?? []).length;
    expect(count).toBeGreaterThanOrEqual(4);
  });
});
