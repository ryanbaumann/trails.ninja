/**
 * Button — renders its `child` component id as the label and, on click,
 * builds an A2uiAction from `action.event` (resolving any {path} bindings in
 * the context against the data model/scope) and routes it through
 * dispatchSurfaceAction.
 */
import type { FC } from 'react';
import type { ComponentNode } from '../protocol';
import type { SurfaceState } from '../store';
import { CatalogNode } from '../render/CatalogNode';
import { dispatchSurfaceAction } from '../actions';
import { buildAction, resolveActionContext } from './actionHelpers';

interface ActionSpec {
  event?: { name?: string; context?: unknown };
}

export const Button: FC<{ node: ComponentNode; surface: SurfaceState; scope?: string }> = ({ node, surface, scope }) => {
  const childId = typeof node.child === 'string' ? node.child : undefined;
  const variant = typeof node.variant === 'string' ? node.variant : 'default';
  const action = node.action as ActionSpec | undefined;
  const eventName = action?.event?.name;

  const onClick = () => {
    if (!eventName) return;
    const ctx = resolveActionContext(action?.event?.context, surface.dataModel, scope);
    dispatchSurfaceAction(buildAction(eventName, surface, node.id, ctx));
  };

  return (
    <button type="button" className={`genui-btn genui-btn--${variant}`} onClick={onClick} disabled={!eventName}>
      {childId ? <CatalogNode id={childId} surface={surface} scope={scope} /> : null}
    </button>
  );
};
