/**
 * Recursion guard state for the A2UI tree renderer: current depth and the set
 * of component ids on the current path (to catch cycles). Threaded through
 * React context so container components (Column/Row/Card/List) don't need to
 * manually pass depth/ancestors down to every recursive `CatalogNode`.
 */
import { createContext, useContext } from 'react';

/** Hard cap on recursion depth — protects against runaway/cyclic surfaces. */
export const MAX_DEPTH = 32;

export interface RenderCtxValue {
  depth: number;
  ancestors: ReadonlySet<string>;
}

const DEFAULT_CTX: RenderCtxValue = { depth: 0, ancestors: new Set() };

export const RenderContext = createContext<RenderCtxValue>(DEFAULT_CTX);

export function useRenderCtx(): RenderCtxValue {
  return useContext(RenderContext);
}
