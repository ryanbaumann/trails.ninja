/**
 * AdminPanel "Send diagnostics" tests — the opt-in, consent-gated client hop to
 * the /metadata sink (telemetry-triage loop). Prove that:
 *  - the Send button is disabled until consent is given;
 *  - sending POSTs to /metadata with the X-Atlas-Consent header + sanitized body;
 *  - a 204 surfaces success and no request fires without consent.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AdminPanel } from './AdminPanel';
import { useAtlas } from '@/state/store';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  // Open the panel and seed one sanitized-able tool event so there is something
  // to send. clearAllTelemetry first so tests don't bleed into each other.
  useAtlas.getState().clearAllTelemetry();
  useAtlas.setState({ adminOpen: true, activeScenario: 'adstudio' });
  useAtlas.getState().pushTool({
    id: 't1',
    name: 'generate_ad_creatives',
    status: 'error',
    ts: 1_700_000_040_000,
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  useAtlas.setState({ adminOpen: false });
});

function render() {
  act(() => root.render(<AdminPanel />));
}

const sendButton = () =>
  [...container.querySelectorAll('button')].find((b) => /Send diagnostics/i.test(b.textContent || '')) as
    | HTMLButtonElement
    | undefined;

const consentBox = () =>
  container.querySelector('input[type="checkbox"]') as HTMLInputElement | null;

it('disables Send until consent is checked', () => {
  render();
  expect(sendButton()?.disabled).toBe(true);
  const fetchSpy = vi.spyOn(globalThis, 'fetch');
  act(() => {
    consentBox()!.click();
  });
  expect(sendButton()?.disabled).toBe(false);
  // Toggling consent alone must not send anything.
  expect(fetchSpy).not.toHaveBeenCalled();
});

it('POSTs sanitized diagnostics to /metadata with the consent header on Send', async () => {
  const fetchSpy = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(null, { status: 204 }));
  render();
  act(() => {
    consentBox()!.click();
  });
  await act(async () => {
    sendButton()!.click();
  });

  expect(fetchSpy).toHaveBeenCalledTimes(1);
  const [url, init] = fetchSpy.mock.calls[0];
  expect(url).toBe('/api/real-world-reasoning-agent/metadata');
  expect(init?.method).toBe('POST');
  expect((init?.headers as Record<string, string>)['x-atlas-consent']).toBe('1');
  const body = JSON.parse(init?.body as string);
  expect(Array.isArray(body)).toBe(true);
  expect(body[0]).toMatchObject({ scenario: 'adstudio', tool: 'generate_ad_creatives', status: 'error' });
  // Body is structural-only — no raw content keys.
  expect(body[0]).not.toHaveProperty('summary');
  expect(container.textContent).toMatch(/Sent 1 record/i);
});
