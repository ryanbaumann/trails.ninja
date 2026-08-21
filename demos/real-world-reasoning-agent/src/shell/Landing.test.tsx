// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAtlas } from '@/state/store';
import { useMission } from '@/mission/store';
import { CITIES } from '@/lib/cities';
import { Landing } from './Landing';

const { startExplorerJourney } = vi.hoisted(() => ({
  startExplorerJourney: vi.fn(),
}));
vi.mock('@/explorer/controller', () => {
  return { startExplorerJourney };
});
vi.mock('@/lib/config', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/config')>(),
  GMP_BROWSER_KEY: 'test-browser-key',
}));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let getCurrentPosition: ReturnType<typeof vi.fn>;

async function flushEffects() {
  await act(async () => { await Promise.resolve(); });
}

beforeEach(async () => {
  startExplorerJourney.mockClear();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ maps: true, gemini: true, mapsGrounding: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })));
  getCurrentPosition = vi.fn();
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition },
  });
  useAtlas.setState({ landingDismissed: false, cityId: 'sf', activeScenario: 'concierge', apiHealth: 'ok', cities: CITIES });
  useMission.getState().reset('sf');
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<Landing />));
  await flushEffects();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('Landing cold open', () => {
  it('shows one prompt, one primary action, three examples, and truthful Live labeling', () => {
    expect(container.textContent).toContain('Find the right place.');
    expect(container.textContent).toContain('What should Atlas find?');
    expect(container.querySelectorAll('textarea')).toHaveLength(1);
    expect(container.querySelectorAll('.mission-launch')).toHaveLength(1);
    expect(container.querySelectorAll('.mission-example')).toHaveLength(3);
    expect(container.textContent).toContain('● Ready');
    expect(container.textContent).toContain('Find with live evidence');
    expect(container.textContent).toContain('Maps, grounding, and Gemini are ready. Device location is used only after you ask.');
    expect(container.textContent).toContain('Gemini connected · Hosted');
    expect(container.textContent).toContain('Use my key');
    expect(container.textContent).toContain('Selected area: San Francisco');
    expect(container.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe(
      'Find a nearby café with the shortest verified walk; tell me whether I need a jacket.',
    );
  });

  it('keeps recipes, developer concepts, mode controls, and preference controls out of the cold open', () => {
    expect(container.textContent).not.toContain('Explore recipes');
    expect(container.textContent).not.toContain('Preference Passport');
    expect(container.textContent).not.toContain('Tune my passport');
    expect(container.textContent).not.toContain('◆ Demo');
    expect(container.querySelector('[aria-label="Data mode"]')).toBeNull();
  });

  it('does not request geolocation until Use my location is activated, then allows revocation', async () => {
    expect(getCurrentPosition).not.toHaveBeenCalled();
    const locationButton = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Use my location'))!;

    await act(async () => locationButton.click());
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);

    const success = getCurrentPosition.mock.calls[0][0] as PositionCallback;
    await act(async () => success({ coords: { latitude: 37.79, longitude: -122.4 } } as GeolocationPosition));
    expect(container.textContent).toContain('Using my location');
    expect(useAtlas.getState().cityId).toBe('sf');

    const remove = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Remove'))!;
    await act(async () => remove.click());
    expect(container.textContent).toContain('Selected area: San Francisco');
    expect(container.textContent).toContain('Use my location');
    expect(useAtlas.getState().cityId).toBe('sf');
  });

  it('starts the automatically selected Live explorer', async () => {
    const launch = container.querySelector<HTMLButtonElement>('.mission-launch')!;
    await act(async () => launch.click());
    expect(startExplorerJourney).toHaveBeenCalledWith(expect.objectContaining({
      cityId: 'sf',
      mode: 'live',
    }));
  });

  it('fails closed when Live capability becomes degraded', async () => {
    await act(async () => useAtlas.setState({ apiHealth: 'degraded' }));
    await flushEffects();

    const launch = container.querySelector<HTMLButtonElement>('.mission-launch')!;
    expect(launch.disabled).toBe(true);
    expect(container.textContent).toContain('Live services unavailable');
    await act(async () => launch.click());
    expect(startExplorerJourney).not.toHaveBeenCalled();
  });

  it('keeps exact coordinates out of global city state and scopes them to the launched mission', async () => {
    const locationButton = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Use my location'))!;
    await act(async () => locationButton.click());
    const success = getCurrentPosition.mock.calls[0][0] as PositionCallback;
    await act(async () => success({ coords: { latitude: 12.34, longitude: 56.78 } } as GeolocationPosition));
    expect(useAtlas.getState().cities.some((candidate) => candidate.id === 'user-city')).toBe(false);

    await act(async () => container.querySelector<HTMLButtonElement>('.mission-launch')!.click());
    expect(useAtlas.getState().cityId).toBe('sf');
    expect(useAtlas.getState().cities.some((candidate) => candidate.id === 'user-city')).toBe(false);
    expect(startExplorerJourney).toHaveBeenCalledWith(expect.objectContaining({
      cityId: 'sf',
      location: { lat: 12.34, lng: 56.78 },
    }));
  });

  it('copies an example into the prompt and returns focus to the textarea', async () => {
    const example = container.querySelector<HTMLButtonElement>('.mission-example')!;
    const textarea = container.querySelector<HTMLTextAreaElement>('textarea')!;
    await act(async () => example.click());
    expect(example.textContent).toBe('Café · walk');
    expect(textarea.value).toBe('Find a nearby café with the shortest verified walk.');
    expect(document.activeElement).toBe(textarea);
  });
});
