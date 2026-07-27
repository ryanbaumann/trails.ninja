/**
 * Text — literal or bound string with a heading/body/caption variant. Body
 * text reuses the shared Markdown renderer (also used by the dock's model
 * messages) for light formatting (bold/italic/links/lists).
 */
import type { FC } from 'react';
import type { ComponentNode, Dynamic } from '../protocol';
import { resolveDisplayText } from '../protocol';
import type { SurfaceState } from '../store';
import { Markdown, stripMarkdown } from './Markdown';

export const Text: FC<{ node: ComponentNode; surface: SurfaceState; scope?: string }> = ({ node, surface, scope }) => {
  const dyn = node.text as Dynamic<string> | undefined;
  // Literal strings may carry {path} tokens (common inside List templates) — these
  // are interpolated against the data model, and any token the data model never
  // satisfies is dropped so raw "{token}" braces never leak onto the surface.
  // Bound values are already final data and are returned verbatim.
  const value = resolveDisplayText(dyn, surface.dataModel, scope);
  const variant = typeof node.variant === 'string' ? node.variant : 'body';
  if (!value) return null;

  // Headings/captions render a bare string, so strip any markdown tokens the
  // model may emit (e.g. "### Visual") to keep raw syntax from leaking.
  const plain = stripMarkdown(value);

  switch (variant) {
    case 'h1':
      return <h1 style={{ fontFamily: 'var(--font-display)', margin: 0, fontSize: 28, lineHeight: 1.15 }}>{plain}</h1>;
    case 'h2':
      return <h2 style={{ fontFamily: 'var(--font-display)', margin: 0, fontSize: 23, lineHeight: 1.2 }}>{plain}</h2>;
    case 'h3':
      return <h3 style={{ fontFamily: 'var(--font-display)', margin: 0, fontSize: 19, lineHeight: 1.25 }}>{plain}</h3>;
    case 'h4':
      return <h4 style={{ fontFamily: 'var(--font-display)', margin: 0, fontSize: 16, lineHeight: 1.3 }}>{plain}</h4>;
    case 'h5':
      return (
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>{plain}</div>
      );
    case 'caption':
      return <div style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.02em' }}>{plain}</div>;
    default:
      return (
        <div className="copilot-message genui-text-body">
          <Markdown text={value} />
        </div>
      );
  }
};
