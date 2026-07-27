/**
 * List — either a flat array of child component ids, or a template
 * {componentId, path} expanded once per item in the data-model array at
 * `path`. Template items get a `scope` of `${absolutePath}/${index}` so
 * relative bindings inside the template (e.g. {"path":"name"}) resolve
 * within that item. `direction: 'horizontal'` renders a snap-scroll carousel.
 */
import type { FC } from 'react';
import type { ComponentNode } from '../protocol';
import { getAtPath } from '../protocol';
import type { SurfaceState } from '../store';
import { CatalogNode } from '../render/CatalogNode';

function toAbsolutePath(path: string, scope?: string): string {
  if (path.startsWith('/')) return path;
  const base = scope ? scope.replace(/\/$/, '') : '';
  return `${base}/${path}`;
}

export const List: FC<{ node: ComponentNode; surface: SurfaceState; scope?: string }> = ({ node, surface, scope }) => {
  const direction = node.direction === 'horizontal' ? 'horizontal' : 'vertical';
  const className = `genui-list ${direction === 'horizontal' ? 'genui-list--h' : 'genui-list--v'}`;
  const children = node.children;

  if (Array.isArray(children)) {
    const ids = children.filter((c): c is string => typeof c === 'string');
    return (
      <div className={className}>
        {ids.map((id) => (
          <div className="genui-list__item" key={id}>
            <CatalogNode id={id} surface={surface} scope={scope} />
          </div>
        ))}
      </div>
    );
  }

  if (children && typeof children === 'object' && !Array.isArray(children)) {
    const tpl = children as { componentId?: unknown; path?: unknown };
    const componentId = typeof tpl.componentId === 'string' ? tpl.componentId : undefined;
    const path = typeof tpl.path === 'string' ? tpl.path : undefined;
    if (!componentId || !path) return null;

    const absPath = toAbsolutePath(path, scope);
    const items = getAtPath(surface.dataModel, absPath);
    const arr = Array.isArray(items) ? items : [];

    return (
      <div className={className}>
        {arr.map((_, i) => (
          <div className="genui-list__item" key={`${absPath}/${i}`}>
            <CatalogNode id={componentId} surface={surface} scope={`${absPath}/${i}`} />
          </div>
        ))}
      </div>
    );
  }

  return null;
};
