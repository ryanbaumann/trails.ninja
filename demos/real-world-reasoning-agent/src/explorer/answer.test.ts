import { describe, expect, it } from 'vitest';
import { buildExplorerFallbackAnswer, generateExplorerAnswer, safeExplorerAnswer } from './answer';
import { createExplorerFixture } from './fixtures';
import { runExplorer } from './runtime';

describe('explorer answer', () => {
  it('gives Sample mode a clear, concise Atlas answer without links', async () => {
    const run = await runExplorer({
      query: 'quiet-work cafe',
      origin: { lat: 1, lng: 2 },
      dataMode: 'sample',
    }, { grounding: createExplorerFixture() }, () => {});

    const answer = buildExplorerFallbackAnswer(run.view);
    expect(answer).toMatch(/Sample preview/i);
    expect(answer).toContain('Sample café A');
    expect(answer).toMatch(/fictional demo data/i);
    expect(answer).not.toMatch(/https?:\/\/|github/i);
  });

  it('rejects model copy containing a URL or unsupported place claim', () => {
    expect(safeExplorerAnswer('Use [the repo](https://github.com/example).', 'Fallback')).toBe('Fallback');
    expect(safeExplorerAnswer('Try Mystery Café instead.', 'Fallback', ['Known Café'])).toBe('Fallback');
    expect(safeExplorerAnswer('Known Café is the best fit.', 'Fallback', ['Known Café'])).toBe('Known Café is the best fit.');
  });

  it('keeps the deterministic answer when there is no verified winner', async () => {
    const run = await runExplorer({
      query: 'quiet-work cafe',
      origin: { lat: 1, lng: 2 },
      dataMode: 'live',
    }, { grounding: createExplorerFixture({ places: { status: 'empty' } }) }, () => {});
    await expect(generateExplorerAnswer(run.view)).resolves.toBe(buildExplorerFallbackAnswer(run.view));
  });
});
