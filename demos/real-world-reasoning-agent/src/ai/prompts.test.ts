import { describe, expect, it } from 'vitest';
import { BASE_PERSONA } from './prompts';

describe('BASE_PERSONA tool ordering', () => {
  it('matches the engine sequential emission-order invariant', () => {
    expect(BASE_PERSONA).toContain('sequentially in emission order');
    expect(BASE_PERSONA).not.toContain('run them in parallel');
  });
});

describe('BASE_PERSONA WHY rule', () => {
  it('requires a one-line grounded reason citing a specific tool result', () => {
    expect(BASE_PERSONA).toMatch(/one-line grounded reason citing a specific tool result/i);
    expect(BASE_PERSONA).toMatch(/because/i);
    expect(BASE_PERSONA).toMatch(/state the why, not just the what/i);
  });

  it('keeps causality over decoration and drops the "avoid flowery" phrasing', () => {
    expect(BASE_PERSONA).toMatch(/short and causal, not decorative/i);
    expect(BASE_PERSONA).not.toMatch(/avoid flowery/i);
  });
});

