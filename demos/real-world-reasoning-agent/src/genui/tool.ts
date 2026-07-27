/**
 * The `render_surface` common tool. Lets the copilot render or update an
 * interactive A2UI surface in the chat dock by emitting A2UI v0.9 messages.
 * On validation failure it returns the errors so Gemini can self-correct on the
 * next hop; on success it applies them to the genui store and pushes a
 * `role:'surface'` chat message for each newly created surface.
 */
import type { ToolDefinition } from '@/lib/types';
import { atlas } from '@/state/store';
import { uid } from '@/lib/id';
import { genui, useGenui } from './store';
import { validateMessages, normalizeA2uiInput, ATLAS_CATALOG_ID } from './protocol';

export const RENDER_SURFACE_TOOL: ToolDefinition = {
  declaration: {
    name: 'render_surface',
    description:
      'Render or update an interactive UI surface in the chat (place carousels, ' +
      'comparison grids, choice chips, image/ad cards, stat grids). Pass an array of ' +
      `A2UI v0.9 messages. Use catalogId "${ATLAS_CATALOG_ID}". Each surface needs a ` +
      'component with id "root" as its root. Reuse the same surfaceId to UPDATE an ' +
      'existing surface instead of creating a new one. Put arrays (e.g. lists of ' +
      'places) into the data model with updateDataModel and reference them from a List ' +
      'template. Prefer this over long text when showing structured or interactive content.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        messages: {
          type: 'array',
          description: 'Array of A2UI v0.9 protocol messages (createSurface, updateComponents, updateDataModel, deleteSurface).',
          items: { type: 'object' },
        },
      },
      required: ['messages'],
    },
  },
  handler: async (args) => {
    const raw = (args as { messages?: unknown }).messages;
    const existing = new Set(Object.keys(useGenui.getState().surfaces));
    // Repair the common model near-misses (missing createSurface / root, nested
    // components, wrong catalogId/version, stringified JSON) before validating so
    // a slightly-off surface renders instead of failing with an error chip.
    const normalized = normalizeA2uiInput(raw, existing);
    const { ok, errors, messages } = validateMessages(normalized, existing);
    if (!ok) {
      // Surface the concrete validation failures in dev so we can see WHY a
      // "Rendering the response failed" chip appeared and tighten the prompt /
      // lenient normalizer against the recurring near-misses.
      if (import.meta.env?.DEV) {
        console.warn('[render_surface] rejected A2UI:', errors, '\nnormalized input:', normalized);
      }
      return { ok: false, errors, hint: 'Fix these A2UI messages and call render_surface again.' };
    }
    const s = atlas();
    const scenario = s.activeScenario;
    const { created, updated, errors: applyErrors } = genui().applyMessages(scenario, messages);
    if (applyErrors.length) {
      if (import.meta.env?.DEV) {
        console.warn('[render_surface] merged A2UI graph invalid:', applyErrors);
      }
      return { ok: false, errors: applyErrors, hint: 'The merged A2UI graph is invalid. Fix the referenced components and retry.' };
    }
    for (const surfaceId of created) {
      s.addMsg({ id: uid('s'), role: 'surface', surfaceId, ts: Date.now() });
    }
    return { ok: true, created, updated };
  },
};
