/**
 * ConfirmationResult — an end-of-journey confirmation banner (Atlas A2UI v0.9
 * subset). Shows a ✓/✕ glyph by `status` (success|error), a title, an optional
 * detail line, and an optional follow-up button that dispatches `action` (like
 * Button). Rendered as role="status" so the outcome is announced.
 */
import type { FC } from 'react';
import type { ComponentNode, Dynamic } from '../protocol';
import { resolveDisplayText } from '../protocol';
import type { SurfaceState } from '../store';
import { dispatchSurfaceAction } from '../actions';
import { buildAction, resolveActionContext } from './actionHelpers';

interface ActionSpec {
  event?: { name?: string; context?: unknown };
}

export const ConfirmationResult: FC<{ node: ComponentNode; surface: SurfaceState; scope?: string }> = ({
  node,
  surface,
  scope,
}) => {
  const title = resolveDisplayText(node.title as Dynamic<unknown> | undefined, surface.dataModel, scope);
  const detail = resolveDisplayText(node.detail as Dynamic<unknown> | undefined, surface.dataModel, scope);
  const statusRaw = resolveDisplayText(node.status as Dynamic<unknown> | undefined, surface.dataModel, scope);
  const status: 'success' | 'error' = statusRaw === 'error' ? 'error' : 'success';
  const actionLabel =
    resolveDisplayText(node.actionLabel as Dynamic<unknown> | undefined, surface.dataModel, scope) || 'Continue';
  const action = node.action as ActionSpec | undefined;
  const eventName = action?.event?.name;
  if (!title) return null;

  const onAction = () => {
    if (!eventName) return;
    const ctx = resolveActionContext(action?.event?.context, surface.dataModel, scope);
    dispatchSurfaceAction(buildAction(eventName, surface, node.id, ctx));
  };

  return (
    <div className={`genui-confirm genui-confirm--${status}`} role="status">
      <span className="genui-confirm__glyph" aria-hidden="true">{status === 'error' ? '✕' : '✓'}</span>
      <div className="genui-confirm__body">
        <div className="genui-confirm__title">{title}</div>
        {detail ? <div className="genui-confirm__detail">{detail}</div> : null}
      </div>
      {eventName ? (
        <button type="button" className="genui-btn genui-btn--primary genui-confirm__action" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
};
