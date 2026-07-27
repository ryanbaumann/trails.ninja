/**
 * Minimal hand-rolled markdown renderer (bold/italic/inline-code/links, lists,
 * paragraphs). Extracted from CopilotDock so the GenUI `Text` component
 * (variant "body") can render the same lightweight formatting model instead
 * of pulling in a markdown dependency.
 */
import type { ReactNode } from 'react';
import { Fragment } from 'react';

export function Markdown({ text }: { text: string }) {
  const lines = text.split('\n');
  const elements: ReactNode[] = [];
  let currentList: { type: 'ul' | 'ol'; items: ReactNode[] } | null = null;
  let currentParagraph: ReactNode[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      elements.push(<p key={elements.length}>{currentParagraph}</p>);
      currentParagraph = [];
    }
  };

  const flushList = () => {
    if (currentList) {
      const List = currentList.type;
      elements.push(
        <List key={elements.length}>
          {currentList.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </List>,
      );
      currentList = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s*(.+)/);
    const unorderedMatch = line.match(/^\s*[-*]\s+(.*)/);
    const orderedMatch = line.match(/^\s*\d+[.)]\s+(.*)/);
    const tableHeader = parseTableRow(line);
    const tableSeparator = i + 1 < lines.length ? isTableSeparator(lines[i + 1].trim()) : false;

    if (tableHeader && tableSeparator) {
      flushParagraph();
      flushList();
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length) {
        const row = parseTableRow(lines[i].trim());
        if (!row) {
          i -= 1;
          break;
        }
        rows.push(row);
        i += 1;
      }
      elements.push(
        <div key={elements.length} className="markdown-table-wrap">
          <table className="markdown-table">
            <thead>
              <tr>
                {tableHeader.map((cell, cellIndex) => (
                  <th key={cellIndex}>{renderInline(cell)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {tableHeader.map((_, cellIndex) => (
                    <td key={cellIndex}>{renderInline(row[cellIndex] ?? '')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    } else if (headingMatch) {
      flushParagraph();
      flushList();
      const level = headingMatch[1].length;
      const Heading = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      elements.push(
        <Heading key={elements.length} className="markdown-heading">
          {renderInline(headingMatch[2])}
        </Heading>,
      );
    } else if (unorderedMatch) {
      flushParagraph();
      if (currentList?.type !== 'ul') {
        flushList();
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(renderInline(unorderedMatch[1]));
    } else if (orderedMatch) {
      flushParagraph();
      if (currentList?.type !== 'ol') {
        flushList();
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(renderInline(orderedMatch[1]));
    } else {
      flushList();
      if (currentParagraph.length > 0) {
        currentParagraph.push(<br key={`br-${i}`} />);
      }
      currentParagraph.push(<Fragment key={i}>{renderInline(line)}</Fragment>);
    }
  }
  flushParagraph();
  flushList();

  return <>{elements}</>;
}

function parseTableRow(line: string): string[] | null {
  if (!line.includes('|')) return null;
  const trimmed = line.replace(/^\|/, '').replace(/\|$/, '');
  const cells = trimmed.split('|').map((cell) => cell.trim());
  return cells.length >= 2 ? cells : null;
}

function isTableSeparator(line: string): boolean {
  const cells = parseTableRow(line);
  return !!cells?.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));

    const token = match[0];
    const key = `${match.index}-${token}`;
    if (token.startsWith('`')) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith('**')) {
      nodes.push(<strong key={key}>{renderInline(token.slice(2, -2))}</strong>);
    } else if (token.startsWith('*')) {
      nodes.push(<em key={key}>{renderInline(token.slice(1, -1))}</em>);
    } else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      const href = link?.[2].trim() ?? '';
      nodes.push(
        isSafeHref(href) ? (
          <a key={key} href={href} target="_blank" rel="noreferrer">
            {renderInline(link?.[1] ?? '')}
          </a>
        ) : (
          (link?.[1] ?? token)
        ),
      );
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

export function isSafeHref(href: string): boolean {
  return /^(https?:|mailto:)/i.test(href);
}

/**
 * Strips lightweight markdown tokens to plain text so raw syntax (`###`, `**`,
 * backticks, links) never leaks into contexts that render a bare string —
 * headings/captions in `Text`, ad-creative copy, image alt text, etc. Tolerates
 * headings without a trailing space (`###Text`).
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/^[ \t]{0,3}#{1,6}[ \t]*/gm, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}
