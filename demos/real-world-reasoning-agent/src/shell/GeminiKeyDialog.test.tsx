// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { disconnectGeminiApiKey, getGeminiCredentialSnapshot } from '@/ai/client';
import { GeminiKeyDialog } from './GeminiKeyDialog';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  disconnectGeminiApiKey();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

function render() {
  act(() => root.render(<GeminiKeyDialog open onClose={() => {}} />));
}

describe('Gemini key setup', () => {
  it('connects a valid key through the guarded endpoint and never renders it afterward', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    render();
    const input = container.querySelector<HTMLInputElement>('#gemini-api-key')!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(input, 'test-personal-key');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => container.querySelector<HTMLFormElement>('form')!.requestSubmit());

    expect(getGeminiCredentialSnapshot().source).toBe('byok');
    expect(container.textContent).toContain('Personal key connected');
    expect(container.textContent).not.toContain('test-personal-key');
    expect(container.textContent).toContain('never saved to browser storage');
  });

  it('shows a classified inline error without echoing a rejected key', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: false, reason: 'invalid' }), { status: 401 }));
    render();
    const input = container.querySelector<HTMLInputElement>('#gemini-api-key')!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(input, 'rejected-test-key');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      container.querySelector<HTMLFormElement>('form')!.requestSubmit();
    });
    expect(container.textContent).toContain('That key was rejected');
    expect(container.textContent).not.toContain('rejected-test-key');
  });
});
