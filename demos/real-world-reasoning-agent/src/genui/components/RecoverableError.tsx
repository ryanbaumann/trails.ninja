/**
 * RecoverableError — an inline error with a Retry affordance (Atlas A2UI v0.9
 * subset). Rendered as role="alert" so it is announced immediately. The Retry
 * button dispatches the caller-supplied `action` (like Button); when no action is
 * given it falls back to a `send_prompt` retry so the failure is always
 * recoverable without re-emitting the surface.
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

export const RecoverableError: FC<{ node: ComponentNode; surface: SurfaceState; scope?: string }> = ({
  node,
  surface,
  scope,
}) => {
  const message = resolveDisplayText(node.message as Dynamic<unknown> | undefined, surface.dataModel, scope);
  const retryLabel =
    resolveDisplayText(node.retryLabel as Dynamic<unknown> | undefined, surface.dataModel, scope) || 'Retry';
  const action = node.action as ActionSpec | undefined;
  if (!message) return null;

  const onRetry = () => {
    const eventName = action?.event?.name;
    if (eventName) {
      const ctx = resolveActionContext(action?.event?.context, surface.dataModel, scope);
      dispatchSurfaceAction(buildAction(eventName, surface, node.id, ctx));
    } else {
      // No action supplied — ask the copilot to retry the failed step by name.
      dispatchSurfaceAction(buildAction('send_prompt', surface, node.id, { prompt: `Retry: ${message}` }));
    }
  };

  return (
    <div className="genui-error" role="alert">
      <span className="genui-error__icon" aria-hidden="true">⚠</span>
      <span className="genui-error__message">{message}</span>
      <button type="button" className="genui-btn genui-error__retry" onClick={onRetry}>
        {retryLabel}
      </button>
    </div>
  );
};
