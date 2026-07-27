/**
 * Schema-parity tests: prove that every fixture Atlas's own `validateMessages`
 * accepts is ALSO wire-compatible with the official `@a2ui/web_core` v0.9 zod
 * schemas — i.e. Atlas really speaks A2UI v0.9, not just a look-alike dialect.
 *
 * Empirical note (verified by running these schemas against every fixture
 * below before writing the assertions): `@a2ui/web_core`'s per-message
 * envelopes (`CreateSurfaceMessageSchema`, `UpdateDataModelMessageSchema`,
 * `DeleteSurfaceMessageSchema`) are zod `.strict()` objects, but
 * `UpdateComponentsMessageSchema`'s `components[*]` entries are `.passthrough()`
 * — they only require `component: string` (+ optional `id`/`weight`) and let
 * any additional Atlas-specific props (e.g. `text`, `placeId`, `action`,
 * `children`) ride along unvalidated. That means full-message parity holds for
 * every fixture here, not just envelope-level parity. Per plan §6/§13, envelope
 * parity (version + surfaceId + components array presence) is the HARD
 * requirement; component-prop-level parity is best-effort and only holds
 * because upstream happens to use passthrough mode today. `assertParity`
 * below is written so it does not depend on that: it always checks the
 * envelope-only shape, and additionally checks full-message parity, reporting
 * both so a future stricter web_core release can't silently break CI without
 * an assertion actually exercising it.
 */
import { describe, expect, it } from 'vitest';
import {
  CreateSurfaceMessageSchema,
  DeleteSurfaceMessageSchema,
  UpdateComponentsMessageSchema,
  UpdateDataModelMessageSchema,
} from '@a2ui/web_core/v0_9';
import type { ZodTypeAny } from 'zod';
import { validateMessages } from './protocol';
import placeCarousel from './__fixtures__/place-carousel.json';
import adCampaign from './__fixtures__/ad-campaign.json';
import scoutEvidence from './__fixtures__/scout-evidence.json';
import scoutHero from './__fixtures__/scout-hero.json';
import adstudioHero from './__fixtures__/adstudio-hero.json';
import fleetHero from './__fixtures__/fleet-hero.json';
import conciergeHero from './__fixtures__/concierge-hero.json';
import insightHero from './__fixtures__/insight-hero.json';
import cinemaHero from './__fixtures__/cinema-hero.json';
import stateLoading from './__fixtures__/state-loading.json';
import stateEmpty from './__fixtures__/state-empty.json';
import stateError from './__fixtures__/state-error.json';
import stateUpdate from './__fixtures__/state-update.json';

const FIXTURES: Array<{ name: string; messages: unknown[] }> = [
  { name: 'place-carousel', messages: placeCarousel as unknown[] },
  { name: 'ad-campaign', messages: adCampaign as unknown[] },
  { name: 'scout-evidence', messages: scoutEvidence as unknown[] },
  // Atlas A2UI v0.9 subset — journey-proven golden + state fixtures.
  { name: 'scout-hero', messages: scoutHero as unknown[] },
  { name: 'adstudio-hero', messages: adstudioHero as unknown[] },
  { name: 'fleet-hero', messages: fleetHero as unknown[] },
  { name: 'concierge-hero', messages: conciergeHero as unknown[] },
  { name: 'insight-hero', messages: insightHero as unknown[] },
  { name: 'cinema-hero', messages: cinemaHero as unknown[] },
  { name: 'state-loading', messages: stateLoading as unknown[] },
  { name: 'state-empty', messages: stateEmpty as unknown[] },
  { name: 'state-error', messages: stateError as unknown[] },
  { name: 'state-update', messages: stateUpdate as unknown[] },
];

/** Pick the matching web_core envelope schema for a message by its top-level key. */
function schemaFor(msg: Record<string, unknown>): ZodTypeAny {
  if ('createSurface' in msg) return CreateSurfaceMessageSchema;
  if ('updateComponents' in msg) return UpdateComponentsMessageSchema;
  if ('updateDataModel' in msg) return UpdateDataModelMessageSchema;
  if ('deleteSurface' in msg) return DeleteSurfaceMessageSchema;
  throw new Error(`fixture message has no known A2UI key: ${JSON.stringify(msg)}`);
}

/** Strip a component down to the fields web_core's strict envelope actually requires. */
function envelopeOnly(msg: Record<string, unknown>): unknown {
  if (!('updateComponents' in msg)) return msg;
  const body = msg.updateComponents as { surfaceId: string; components: Array<Record<string, unknown>> };
  return {
    version: msg.version,
    updateComponents: {
      surfaceId: body.surfaceId,
      components: body.components.map((c) => ({ component: c.component, id: c.id })),
    },
  };
}

describe('A2UI schema parity (@a2ui/web_core v0.9)', () => {
  for (const { name, messages } of FIXTURES) {
    describe(name, () => {
      it("passes Atlas's own validateMessages", () => {
        const result = validateMessages(messages);
        expect(result.errors).toEqual([]);
        expect(result.ok).toBe(true);
        expect(result.messages.length).toBe(messages.length);
      });

      it('every message satisfies the web_core envelope (hard requirement)', () => {
        for (const raw of messages) {
          const msg = raw as Record<string, unknown>;
          const schema = schemaFor(msg);
          const envelope = envelopeOnly(msg);
          const parsed = schema.safeParse(envelope);
          expect(parsed.success, parsed.success ? '' : JSON.stringify((parsed as { error: { issues: unknown } }).error.issues)).toBe(
            true,
          );
        }
      });

      it('every message also satisfies full component-prop parity (best-effort, currently holds)', () => {
        for (const raw of messages) {
          const msg = raw as Record<string, unknown>;
          const schema = schemaFor(msg);
          const parsed = schema.safeParse(msg);
          expect(parsed.success, parsed.success ? '' : JSON.stringify((parsed as { error: { issues: unknown } }).error.issues)).toBe(
            true,
          );
        }
      });
    });
  }
});
