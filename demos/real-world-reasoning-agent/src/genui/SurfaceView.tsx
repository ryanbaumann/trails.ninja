/**
 * SurfaceView — mounts a live A2UI surface by id. Subscribes to the genui
 * store's `rev` counter (via zustand selector) so it re-renders whenever
 * `applyMessages` updates this surface's components or data model. Renders
 * the "root" node recursively through the CATALOG registry; if the surface
 * doesn't exist (yet, or was deleted), renders nothing.
 */
import { useGenui } from './store';
import { CatalogNode } from './render/CatalogNode';

export function SurfaceView({ surfaceId }: { surfaceId: string }) {
  const surface = useGenui((s) => s.surfaces[surfaceId]);
  if (!surface) return null;
  return <CatalogNode id={surface.rootId} surface={surface} />;
}
