/**
 * NextActions — the "what now" row a surface owns itself.
 *
 * Follow-ups, the counterfactual and share used to be three separate hardcoded
 * chip rows in the shell, which meant the agent could not decide what came next;
 * the shell did. A surface that knows what it just concluded is the right author
 * of the next step, so it emits them here.
 *
 * Each action goes through the typed action registry (see `actionRegistry.ts`),
 * so an action a surface names but the host never registered is refused rather
 * than becoming prompt text.
 */
import type { FC } from 'react';
import type { ComponentNode, Dynamic } from '../protocol';
import { resolveDisplayText, resolveDynamic } from '../protocol';
import type { SurfaceState } from '../store';
import { dispatchSurfaceAction } from '../actions';
import { buildAction, resolveActionContext } from './actionHelpers';

interface ActionSpec {
  label?: unknown;
  action?: { event?: { name?: unknown; context?: unknown } };
  emphasis?: unknown;
}

export const NextActions: FC<{ node: ComponentNode; surface: SurfaceState; scope?: string }> = ({
  node,
  surface,
  scope,
}) => {
  const raw = resolveDynamic(node.actions as Dynamic<unknown> | undefined, surface.dataModel, scope);
  const specs: ActionSpec[] = Array.isArray(raw) ? (raw as ActionSpec[]) : [];
  const label = resolveDisplayText(node.label as Dynamic<unknown> | undefined, surface.dataModel, scope);

  const usable = specs.filter((spec) => typeof spec?.action?.event?.name === 'string');
  if (!usable.length) return null;

  return (
    <div className="genui-next-actions" aria-label={label || 'Suggested next steps'}>
      {usable.map((spec, index) => {
        const text = resolveDisplayText(spec.label as Dynamic<unknown> | undefined, surface.dataModel, scope);
        if (!text) return null;
        const name = String(spec.action!.event!.name);
        const context = (spec.action!.event!.context ?? {}) as Record<string, unknown>;
        const primary = spec.emphasis === 'primary';
        return (
          <button
            key={`${name}-${index}`}
            type="button"
            className={`genui-next-action${primary ? ' genui-next-action--primary' : ''}`}
            title={text}
            onClick={() =>
              dispatchSurfaceAction(
                buildAction(name, surface, node.id, resolveActionContext(context, surface.dataModel, scope)),
              )
            }
          >
            {text}
          </button>
        );
      })}
    </div>
  );
};
