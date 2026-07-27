/**
 * RouteItinerary — an ordered list of turn-by-turn steps (Atlas A2UI v0.9
 * subset). `steps` is a literal array or a {path} binding into the data model of
 * {instruction, distance?, duration?} items; each step's strings are interpolated
 * against the item scope so a template-style "{instruction}" resolves per item.
 */
import type { FC } from 'react';
import type { ComponentNode, Dynamic } from '../protocol';
import { dropUnresolvedTokens, interpolate, resolveDynamic } from '../protocol';
import type { SurfaceState } from '../store';

interface Step {
  instruction?: string;
  distance?: string;
  duration?: string;
}

export const RouteItinerary: FC<{ node: ComponentNode; surface: SurfaceState; scope?: string }> = ({
  node,
  surface,
  scope,
}) => {
  const steps = resolveDynamic(node.steps as Dynamic<Step[]> | undefined, surface.dataModel, scope);
  const arr = Array.isArray(steps) ? steps : [];
  if (!arr.length) return null;

  // Step strings may carry {path} tokens; tokens the data model never satisfies
  // are dropped so raw braces never leak (mirrors StatGrid's item handling).
  const text = (v: unknown): string =>
    typeof v === 'string'
      ? dropUnresolvedTokens(interpolate(v, surface.dataModel, scope))
      : v != null
        ? String(v)
        : '';

  return (
    <ol className="genui-itinerary">
      {arr.map((s, i) => {
        const meta = [text(s?.distance), text(s?.duration)].filter(Boolean).join(' · ');
        return (
          <li className="genui-itinerary__step" key={i}>
            <span className="genui-itinerary__instruction">{text(s?.instruction)}</span>
            {meta ? <span className="genui-itinerary__meta">{meta}</span> : null}
          </li>
        );
      })}
    </ol>
  );
};
