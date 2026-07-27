/**
 * StatGrid — a responsive grid of stat tiles (label / big value / hint).
 * Mirrors the stat-tile row pattern already used by scenario panels.
 */
import type { FC } from 'react';
import type { ComponentNode, Dynamic } from '../protocol';
import { dropUnresolvedTokens, interpolate, resolveDynamic } from '../protocol';
import type { SurfaceState } from '../store';

interface StatItem {
  label?: string;
  value?: string | number;
  hint?: string;
}

export const StatGrid: FC<{ node: ComponentNode; surface: SurfaceState; scope?: string }> = ({
  node,
  surface,
  scope,
}) => {
  const items = resolveDynamic(node.items as Dynamic<StatItem[]> | undefined, surface.dataModel, scope);
  const arr = Array.isArray(items) ? items : [];
  if (!arr.length) return null;

  // Item strings may carry {path} tokens when the grid lives in a List template;
  // tokens the data model never satisfies are dropped so raw braces never leak.
  const text = (v: unknown): string =>
    typeof v === 'string'
      ? dropUnresolvedTokens(interpolate(v, surface.dataModel, scope))
      : v != null
        ? String(v)
        : '';

  return (
    <div className="genui-statgrid">
      {arr.map((it, i) => (
        <div className="genui-statgrid__tile" key={i}>
          <div className="genui-statgrid__label">{text(it?.label)}</div>
          <div className="genui-statgrid__value">{it?.value != null ? text(it.value) : '—'}</div>
          {it?.hint ? <div className="genui-statgrid__hint">{text(it.hint)}</div> : null}
        </div>
      ))}
    </div>
  );
};
