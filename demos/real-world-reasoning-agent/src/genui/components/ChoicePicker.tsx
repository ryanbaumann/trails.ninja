/**
 * ChoicePicker — a chip row. Tapping a chip toggles local selection state and,
 * if `action` is present, fires it with the chosen value(s) merged into the
 * context as `selection`, and any literal "{selection}" token inside a
 * context string replaced with it (see actionHelpers.interpolateSelection).
 */
import { useState, type FC } from 'react';
import { resolveDisplayText, type ComponentNode, type Dynamic } from '../protocol';
import type { SurfaceState } from '../store';
import { dispatchSurfaceAction } from '../actions';
import { buildAction, interpolateSelection, resolveActionContext } from './actionHelpers';

interface Option {
  label: string;
  value: unknown;
}

interface ActionSpec {
  event?: { name?: string; context?: unknown };
}

function isOption(o: unknown): o is Option {
  return !!o && typeof o === 'object' && typeof (o as Option).label === 'string';
}

export const ChoicePicker: FC<{ node: ComponentNode; surface: SurfaceState; scope?: string }> = ({
  node,
  surface,
  scope,
}) => {
  const options: Option[] = Array.isArray(node.options) ? (node.options as unknown[]).filter(isOption) : [];
  const multi = node.multi === true;
  const action = node.action as ActionSpec | undefined;
  const [selected, setSelected] = useState<Set<unknown>>(new Set());

  const toggle = (opt: Option) => {
    let nextSelection: unknown;
    if (multi) {
      const next = new Set(selected);
      if (next.has(opt.value)) next.delete(opt.value);
      else next.add(opt.value);
      setSelected(next);
      nextSelection = [...next];
    } else {
      setSelected(new Set([opt.value]));
      nextSelection = opt.value;
    }

    const eventName = action?.event?.name;
    if (!eventName) return;
    const ctx = resolveActionContext(action?.event?.context, surface.dataModel, scope);
    const merged = { ...ctx, selection: nextSelection };
    const interpolated: Record<string, unknown> = interpolateSelection(merged, nextSelection);
    // Models occasionally emit send_prompt without a prompt context. A visible
    // style chip must still be actionable instead of silently doing nothing.
    if (eventName === 'send_prompt' && typeof interpolated.prompt !== 'string') {
      interpolated.prompt = `Use this option: ${String(opt.value ?? opt.label)}`;
    }
    dispatchSurfaceAction(buildAction(eventName, surface, node.id, interpolated));
  };

  if (!options.length) return null;

  return (
    <div className="genui-chips">
      {options.map((opt, i) => (
        <button
          key={i}
          type="button"
          className={`genui-chip genui-chip--pickable${selected.has(opt.value) ? ' is-selected' : ''}`}
          onClick={() => toggle(opt)}
        >
          {resolveDisplayText(opt.label as Dynamic<string>, surface.dataModel, scope)}
        </button>
      ))}
    </div>
  );
};
