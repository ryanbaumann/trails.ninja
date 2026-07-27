/**
 * ProgressStatus — a streaming step indicator (Atlas A2UI v0.9 subset). Shows a
 * spinner/✓/✕ glyph by `state`, the resolved label, an optional detail line, and
 * an optional "step/total" counter. Rendered as an accessible live region
 * (role="status" aria-live="polite") so screen readers announce each update as a
 * long-running tool call streams progress into the surface.
 */
import type { FC } from 'react';
import type { ComponentNode, Dynamic } from '../protocol';
import { resolveDisplayText, resolveDynamic } from '../protocol';
import type { SurfaceState } from '../store';

type State = 'running' | 'done' | 'error' | 'pending';
const STATES = new Set<State>(['running', 'done', 'error', 'pending']);
const GLYPH: Record<Exclude<State, 'running'>, string> = { done: '✓', error: '✕', pending: '…' };

export const ProgressStatus: FC<{ node: ComponentNode; surface: SurfaceState; scope?: string }> = ({
  node,
  surface,
  scope,
}) => {
  const label = resolveDisplayText(node.label as Dynamic<unknown> | undefined, surface.dataModel, scope);
  const detail = resolveDisplayText(node.detail as Dynamic<unknown> | undefined, surface.dataModel, scope);
  const stateRaw = resolveDisplayText(node.state as Dynamic<unknown> | undefined, surface.dataModel, scope);
  const state: State = STATES.has(stateRaw as State) ? (stateRaw as State) : 'running';
  const step = resolveDynamic(node.step as Dynamic<number> | undefined, surface.dataModel, scope);
  const total = resolveDynamic(node.total as Dynamic<number> | undefined, surface.dataModel, scope);
  if (!label) return null;

  const counter = step != null && total != null ? `${step}/${total}` : undefined;

  return (
    <div className={`genui-progress genui-progress--${state}`} role="status" aria-live="polite">
      {state === 'running' ? (
        <span className="genui-progress__spinner" aria-hidden="true" />
      ) : (
        <span className="genui-progress__glyph" aria-hidden="true">{GLYPH[state]}</span>
      )}
      <span className="genui-progress__body">
        <span className="genui-progress__label">{label}</span>
        {detail ? <span className="genui-progress__detail">{detail}</span> : null}
      </span>
      {counter ? <span className="genui-progress__step">{counter}</span> : null}
    </div>
  );
};
