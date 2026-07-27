/**
 * ComparisonTable — a decision matrix rendered as a real <table> (Atlas A2UI v0.9
 * subset). `columns` labels the header, `rows` are {label, values[], highlight?}
 * items (each a literal array or a {path} binding). The row flagged `highlight`
 * is styled as the winning option. Row/column strings are interpolated against
 * the surface/item scope so template tokens resolve.
 */
import type { FC } from 'react';
import type { ComponentNode, Dynamic } from '../protocol';
import { dropUnresolvedTokens, interpolate, resolveDisplayText, resolveDynamic } from '../protocol';
import type { SurfaceState } from '../store';

interface Row {
  label?: string;
  values?: unknown[];
  highlight?: boolean;
}

export const ComparisonTable: FC<{ node: ComponentNode; surface: SurfaceState; scope?: string }> = ({
  node,
  surface,
  scope,
}) => {
  const columns = resolveDynamic(node.columns as Dynamic<unknown[]> | undefined, surface.dataModel, scope);
  const rows = resolveDynamic(node.rows as Dynamic<Row[]> | undefined, surface.dataModel, scope);
  const cols = Array.isArray(columns) ? columns : [];
  const rowArr = Array.isArray(rows) ? rows : [];
  const caption = resolveDisplayText(node.caption as Dynamic<unknown> | undefined, surface.dataModel, scope);
  if (!cols.length || !rowArr.length) return null;

  const text = (v: unknown): string =>
    typeof v === 'string'
      ? dropUnresolvedTokens(interpolate(v, surface.dataModel, scope))
      : v != null
        ? String(v)
        : '';

  return (
    <table className="genui-comparison">
      {caption ? <caption className="genui-comparison__caption">{caption}</caption> : null}
      <thead>
        <tr>
          {/* Empty corner cell above the row-label column. */}
          <th scope="col" aria-hidden="true" />
          {cols.map((c, i) => (
            <th scope="col" key={i}>
              {text(c)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rowArr.map((r, i) => (
          <tr key={i} className={r?.highlight ? 'genui-comparison__row--win' : undefined}>
            <th scope="row">{text(r?.label)}</th>
            {(Array.isArray(r?.values) ? r.values : []).map((v, j) => (
              <td key={j}>{text(v)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};
