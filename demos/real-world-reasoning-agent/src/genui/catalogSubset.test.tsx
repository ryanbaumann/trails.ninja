// @vitest-environment jsdom
/**
 * Golden render tests for the "Atlas A2UI v0.9 subset" — the journey-proven
 * catalog additions (ProgressStatus, RecoverableError, EvidenceSource,
 * RouteItinerary, EtaSummary, ComparisonTable, ConfirmationResult) plus the
 * generic loading/empty/error/update state fixtures.
 *
 * For every fixture we (1) prove it passes Atlas's own validateMessages, then
 * (2) apply it through the REAL genui store and render the resulting surface via
 * CatalogNode. A correct render is non-empty AND contains no "unsupported:" /
 * "missing:" fallback chips (every referenced component + child resolved), and
 * shows a representative slice of each new component's content.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import type { A2uiMessage } from './protocol';
import { validateMessages } from './protocol';
import { useGenui } from './store';
import { CatalogNode } from './render/CatalogNode';
import type { ScenarioId } from '@/lib/types';

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

interface Case {
  name: string;
  scenario: ScenarioId;
  surfaceId: string;
  messages: unknown[];
  /** Representative slices proving each new component rendered its content. */
  contains: string[];
}

const CASES: Case[] = [
  {
    name: 'scout-hero (ComparisonTable + EvidenceSource + takeaway)',
    scenario: 'scout',
    surfaceId: 'scout-hero-1',
    messages: scoutHero as unknown[],
    contains: ['Site comparison', 'Visibility', 'observed', 'computed', '90%', 'widest sightline'],
  },
  {
    name: 'adstudio-hero (AdCreative campaign + ConfirmationResult)',
    scenario: 'adstudio',
    surfaceId: 'adstudio-hero-1',
    messages: adstudioHero as unknown[],
    contains: ['Campaign ready to publish', 'Publish', '2 creatives generated'],
  },
  {
    name: 'fleet-hero (RouteItinerary + EtaSummary)',
    scenario: 'fleet',
    surfaceId: 'fleet-hero-1',
    messages: fleetHero as unknown[],
    contains: ['14 min', '3.2 mi', 'Head north on Columbus Ave', 'Turn right onto Bay St'],
  },
  {
    name: 'concierge-hero (place list + ProgressStatus)',
    scenario: 'concierge',
    surfaceId: 'concierge-hero-1',
    messages: conciergeHero as unknown[],
    contains: ['Building your day', 'Enriching stops with photos', '2/3'],
  },
  {
    name: 'insight-hero (StatGrid + EvidenceSource)',
    scenario: 'insight',
    surfaceId: 'insight-hero-1',
    messages: insightHero as unknown[],
    contains: ['AQI', 'Air Quality API', 'observed', '95%'],
  },
  {
    name: 'cinema-hero (reveal/confirmation)',
    scenario: 'cinema',
    surfaceId: 'cinema-hero-1',
    messages: cinemaHero as unknown[],
    contains: ['Your tour is ready', 'Play tour', '3 stops'],
  },
  {
    name: 'state-loading (ProgressStatus running)',
    scenario: 'scout',
    surfaceId: 'state-loading-1',
    messages: stateLoading as unknown[],
    contains: ['Analyzing 6 candidate corners', 'Fetching Street View frames', '3/6'],
  },
  {
    name: 'state-empty (empty List + empty-state Text)',
    scenario: 'concierge',
    surfaceId: 'state-empty-1',
    messages: stateEmpty as unknown[],
    contains: ['No matching places found'],
  },
  {
    name: 'state-error (RecoverableError)',
    scenario: 'scout',
    surfaceId: 'state-error-1',
    messages: stateError as unknown[],
    contains: ['reach the Places service', 'Try again'],
  },
  {
    name: 'state-update (createSurface then mutating updateDataModel)',
    scenario: 'adstudio',
    surfaceId: 'state-update-1',
    messages: stateUpdate as unknown[],
    // The follow-up updateDataModel replaced the running status with the final one.
    contains: ['Creatives ready', '2/2'],
  },
  {
    name: 'maui-official (GoogleMap + PlaceDetailsCompact with a2ui catalogId)',
    scenario: 'concierge',
    surfaceId: 'maui-official-1',
    messages: [
      {
        version: 'v0.9',
        createSurface: {
          surfaceId: 'maui-official-1',
          catalogId: 'a2ui://maps-agentic-ui-catalog.json',
        },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'maui-official-1',
          components: [
            { id: 'root', component: 'Column', children: ['map', 'place'] },
            {
              id: 'map',
              component: 'GoogleMap',
              center: { lat: 37.7955, lng: -122.3937 },
              zoom: 15,
              label: 'Ferry Building Map',
            },
            {
              id: 'place',
              component: 'PlaceDetailsCompact',
              placeId: 'ChIJp2PqN4GAhYARJ_q2VvMvh14',
              orientation: 'horizontal',
            },
          ],
        },
      },
    ],
    contains: ['Ferry Building Map', 'genui-placecard--horizontal'],
  },
];

describe('Atlas A2UI v0.9 subset — golden render fixtures', () => {
  beforeEach(() => {
    useGenui.getState().reset();
  });

  for (const c of CASES) {
    describe(c.name, () => {
      it('passes Atlas validateMessages with no errors', () => {
        const result = validateMessages(c.messages);
        expect(result.errors).toEqual([]);
        expect(result.ok).toBe(true);
      });

      it('renders through the real store with no unresolved fallback chips', () => {
        const { ok, messages } = validateMessages(c.messages);
        expect(ok).toBe(true);

        const apply = useGenui.getState().applyMessages(c.scenario, messages as A2uiMessage[]);
        expect(apply.errors).toEqual([]);

        const surface = useGenui.getState().getSurface(c.surfaceId);
        expect(surface, `surface "${c.surfaceId}" was not created`).toBeDefined();

        const html = renderToStaticMarkup(<CatalogNode id={surface!.rootId} surface={surface!} />);
        expect(html.length).toBeGreaterThan(0);
        // No component name or child id fell back to a MutedChip.
        expect(html).not.toContain('unsupported:');
        expect(html).not.toContain('missing:');
        expect(html).not.toContain('cycle detected:');

        for (const slice of c.contains) {
          expect(html, `expected rendered HTML to contain "${slice}"`).toContain(slice);
        }
      });
    });
  }
});
