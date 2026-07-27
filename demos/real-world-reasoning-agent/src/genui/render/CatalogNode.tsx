/**
 * The recursive A2UI node renderer. Looks up a component id in the surface's
 * flat component map, resolves it against the CATALOG registry, and renders
 * it — guarding against missing children, unknown component names, and
 * cyclic/over-deep trees so a malformed surface never crashes the dock.
 */
import type { FC, ReactNode } from 'react';
import type { SurfaceState } from '../store';
import { CATALOG } from '../catalog';
import { MAX_DEPTH, RenderContext, useRenderCtx } from './context';

export const MutedChip: FC<{ children: ReactNode }> = ({ children }) => (
  <span className="genui-chip genui-chip--muted">{children}</span>
);

export const CatalogNode: FC<{ id: string; surface: SurfaceState; scope?: string }> = ({ id, surface, scope }) => {
  const { depth, ancestors } = useRenderCtx();

  if (depth > MAX_DEPTH) return <MutedChip>surface too deep</MutedChip>;

  const node = surface.components[id];
  if (!node) return <MutedChip>missing: {id}</MutedChip>;

  if (ancestors.has(id)) return <MutedChip>cycle detected: {id}</MutedChip>;

  const Comp = CATALOG[node.component];
  if (!Comp) return <MutedChip>unsupported: {node.component}</MutedChip>;

  const nextAncestors = new Set(ancestors);
  nextAncestors.add(id);

  return (
    <RenderContext.Provider value={{ depth: depth + 1, ancestors: nextAncestors }}>
      <Comp node={node} surface={surface} scope={scope} />
    </RenderContext.Provider>
  );
};
