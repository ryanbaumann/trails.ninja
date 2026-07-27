/**
 * Layout primitives: Column, Row, Card, Divider. Mirror the A2UI basic-catalog
 * prop shapes ({children: string[]} / {child: string}) so schema-parity holds.
 */
import type { FC } from 'react';
import type { ComponentNode } from '../protocol';
import type { SurfaceState } from '../store';
import { CatalogNode } from '../render/CatalogNode';

interface ContainerProps {
  node: ComponentNode;
  surface: SurfaceState;
  scope?: string;
}

function childIds(node: ComponentNode): string[] {
  const c = node.children;
  return Array.isArray(c) ? c.filter((x): x is string => typeof x === 'string') : [];
}

function alignToCss(align: unknown): string {
  switch (align) {
    case 'center':
      return 'center';
    case 'end':
      return 'flex-end';
    case 'stretch':
      return 'stretch';
    default:
      return 'flex-start';
  }
}

export const Column: FC<ContainerProps> = ({ node, surface, scope }) => {
  const gap = typeof node.gap === 'number' ? node.gap : 10;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap, alignItems: alignToCss(node.align) }}>
      {childIds(node).map((id) => (
        <CatalogNode key={id} id={id} surface={surface} scope={scope} />
      ))}
    </div>
  );
};

export const Row: FC<ContainerProps> = ({ node, surface, scope }) => {
  const gap = typeof node.gap === 'number' ? node.gap : 10;
  return (
    <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap, alignItems: alignToCss(node.align) }}>
      {childIds(node).map((id) => (
        <CatalogNode key={id} id={id} surface={surface} scope={scope} />
      ))}
    </div>
  );
};

export const Card: FC<ContainerProps> = ({ node, surface, scope }) => {
  const childId = typeof node.child === 'string' ? node.child : undefined;
  return <div className="genui-card">{childId ? <CatalogNode id={childId} surface={surface} scope={scope} /> : null}</div>;
};

export const Divider: FC<ContainerProps> = () => <hr className="genui-divider" />;
