import { describe, expect, it } from 'vitest';
import { firstJsonBlock } from './vision';

describe('firstJsonBlock', () => {
  it('extracts a clean JSON object with no surrounding noise', () => {
    const raw = '{"scores":{"visibility":8},"notes":"clear frontage","confidence":0.9}';
    expect(firstJsonBlock(raw)).toBe(raw);
  });

  it('extracts JSON from a markdown-fenced response', () => {
    const raw = '```json\n{"scores":{"visibility":7},"notes":"ok","confidence":0.8}\n```';
    const block = firstJsonBlock(raw);
    expect(block).toBe('{"scores":{"visibility":7},"notes":"ok","confidence":0.8}');
    expect(JSON.parse(block!)).toEqual({ scores: { visibility: 7 }, notes: 'ok', confidence: 0.8 });
  });

  it('extracts JSON preceded and followed by prose commentary', () => {
    const raw =
      'Sure thing! Here is my analysis:\n{"scores":{"condition":6},"notes":"weathered sign","confidence":0.6}\nLet me know if you need more.';
    const block = firstJsonBlock(raw);
    expect(JSON.parse(block!)).toEqual({ scores: { condition: 6 }, notes: 'weathered sign', confidence: 0.6 });
  });

  it('handles nested braces and braces inside string values', () => {
    const raw = 'noise {"a":{"b":1},"note":"looks like a {storefront}"} trailing';
    const block = firstJsonBlock(raw);
    expect(JSON.parse(block!)).toEqual({ a: { b: 1 }, note: 'looks like a {storefront}' });
  });

  it('returns undefined for malformed/no-JSON text', () => {
    expect(firstJsonBlock('no braces here at all')).toBeUndefined();
    expect(firstJsonBlock('')).toBeUndefined();
  });

  it('returns undefined when braces never close', () => {
    expect(firstJsonBlock('some text { "scores": { "visibility": 5 ')).toBeUndefined();
  });
});
