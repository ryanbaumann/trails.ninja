// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SurfaceState } from '../store';
import { ChoicePicker } from './ChoicePicker';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const surface = {
  id: 'picker',
  catalogId: 'atlas',
  scenario: 'scout',
  components: {},
  dataModel: { choices: [{ label: 'Open now' }] },
  rootId: 'root',
  rev: 1,
} satisfies SurfaceState;

describe('ChoicePicker', () => {
  it('resolves scoped label tokens and drops unresolved labels', async () => {
    await act(async () => root.render(
      <ChoicePicker
        node={{
          id: 'choice',
          component: 'ChoicePicker',
          options: [
            { label: '{label}', value: 'open' },
            { label: '{missing}', value: 'missing' },
          ],
        }}
        surface={surface}
        scope="/choices/0"
      />,
    ));

    const buttons = container.querySelectorAll('button');
    expect(buttons[0].textContent).toBe('Open now');
    expect(buttons[1].textContent).toBe('');
    expect(container.textContent).not.toContain('{');
  });
});
