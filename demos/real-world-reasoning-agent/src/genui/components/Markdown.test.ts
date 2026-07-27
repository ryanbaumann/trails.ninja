import { describe, expect, it } from 'vitest';
import { isSafeHref, stripMarkdown } from './Markdown';

describe('stripMarkdown', () => {
  it('strips leading heading tokens with or without a trailing space', () => {
    expect(stripMarkdown('### Visual')).toBe('Visual');
    expect(stripMarkdown('###Visual')).toBe('Visual');
    expect(stripMarkdown('###### Deep heading')).toBe('Deep heading');
  });

  it('removes inline emphasis, code, and link syntax', () => {
    expect(stripMarkdown('**bold** and *italic*')).toBe('bold and italic');
    expect(stripMarkdown('use `code` here')).toBe('use code here');
    expect(stripMarkdown('see [the map](https://example.com)')).toBe('see the map');
  });

  it('leaves plain text untouched', () => {
    expect(stripMarkdown('Just a headline')).toBe('Just a headline');
  });
});

describe('isSafeHref', () => {
  it('allows http(s) and mailto only', () => {
    expect(isSafeHref('https://example.com')).toBe(true);
    expect(isSafeHref('mailto:a@b.com')).toBe(true);
    expect(isSafeHref('javascript:alert(1)')).toBe(false);
  });
});
