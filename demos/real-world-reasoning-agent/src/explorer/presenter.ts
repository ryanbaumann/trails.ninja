import type { A2uiMessage, ComponentNode } from '@/genui/protocol';
import { ATLAS_CATALOG_ID } from '@/genui/protocol';
import type { ExplorerAttribution, ExplorerCandidate, ExplorerView } from './contracts';

const TERMINAL = new Set<ExplorerView['stage']>([
  'ready', 'partial', 'empty', 'needs-clarification', 'failed', 'cancelled',
]);

function minutes(candidate: ExplorerCandidate): string {
  return candidate.route ? `${Math.max(1, Math.round(candidate.route.durationSeconds / 60))} min` : 'Unverified';
}

function jacketInference(view: ExplorerView): string | undefined {
  if (!view.weather) return undefined;
  const celsius = view.weather.temperature.unit === 'FAHRENHEIT'
    ? (view.weather.temperature.degrees - 32) * 5 / 9
    : view.weather.temperature.degrees;
  const wet = (view.weather.precipitationProbability ?? 0) >= 40;
  if (wet) return 'Atlas inference · Bring a rain layer.';
  if (celsius <= 15) return 'Atlas inference · A light jacket may be useful.';
  return 'Atlas inference · A jacket is probably unnecessary based on temperature alone.';
}

function sameSource(a: ExplorerAttribution, b: ExplorerAttribution): boolean {
  return a.title === b.title && a.url === b.url;
}

function liveSource(
  id: string,
  attribution: ExplorerAttribution,
  placeUrl?: string,
): ComponentNode {
  return {
    id,
    component: 'GroundingAttribution',
    title: attribution.title,
    url: attribution.url,
    ...(placeUrl ? { placeUrl } : {}),
    provider: 'Google Maps',
  };
}

export function buildExplorerSurface(view: ExplorerView, create: boolean): A2uiMessage[] {
  const children: string[] = ['explorer-title'];
  const components: ComponentNode[] = [
    { id: 'explorer-title', component: 'Text', variant: 'h4', text: 'Evidence' },
  ];

  if (view.dataMode === 'sample') {
    children.push('sample-disclosure');
    components.push({
      id: 'sample-disclosure',
      component: 'Text',
      variant: 'caption',
      text: 'Demo fixture · fictional places and conditions',
    });
  }

  if (!TERMINAL.has(view.stage)) {
    children.push('explorer-progress');
    components.push({
      id: 'explorer-progress', component: 'ProgressStatus', state: 'running',
      label: view.narrative,
    });
  } else if (!view.candidates.length) {
    children.push('explorer-empty');
    components.push({ id: 'explorer-empty', component: 'Text', variant: 'body', text: view.narrative });
  }

  if (view.candidates.length) {
    children.push('constraint-label');
    components.push({
      id: 'constraint-label',
      component: 'Text',
      variant: 'caption',
      text: `${view.travelMode} · ${view.maxTravelMinutes} min limit`,
    });
  }

  for (const [index, candidate] of view.candidates.entries()) {
    const cardId = `candidate-${index}-card`;
    const columnId = `candidate-${index}-column`;
    const placeCardId = `candidate-${index}-place`;
    const claimId = `candidate-${index}-claim`;
    const status = candidate.routeStatus === 'pending'
      ? 'checking route'
      : candidate.eligible
        ? 'inside limit'
        : candidate.routeStatus === 'verified' ? 'outside limit' : 'route unavailable';
    // PlaceCard first (photos/ratings via Maps UI Kit), then the route claim text.
    const cardChildren = [placeCardId, claimId];
    children.push(cardId);
    components.push(
      { id: cardId, component: 'Card', child: columnId },
      { id: columnId, component: 'Column', children: cardChildren, gap: 5 },
      { id: placeCardId, component: 'PlaceCard', placeId: candidate.id },
      {
        id: claimId,
        component: 'Text',
        variant: candidate.id === view.winnerId ? 'h5' : 'body',
        text: `${candidate.rank ? `Rank ${candidate.rank} · ` : ''}${candidate.label} · ${minutes(candidate)} · ${status}`,
      },
    );

    if (view.dataMode === 'live') {
      const placeSourceId = `candidate-${index}-source`;
      cardChildren.push(placeSourceId);
      components.push(liveSource(placeSourceId, candidate.attribution, candidate.placeUrl));
      if (candidate.route && !sameSource(candidate.attribution, candidate.route.attribution)) {
        const routeSourceId = `candidate-${index}-route-source`;
        cardChildren.push(routeSourceId);
        components.push(liveSource(routeSourceId, candidate.route.attribution));
      }
    }
  }

  if (view.weather) {
    const weatherChildren = ['weather-claim'];
    children.push('weather-card');
    const symbol = view.weather.temperature.unit === 'FAHRENHEIT' ? '°F' : '°C';
    const precip = view.weather.precipitationProbability == null ? '' : ` · ${view.weather.precipitationProbability}% precipitation`;
    components.push(
      { id: 'weather-card', component: 'Card', child: 'weather-column' },
      { id: 'weather-column', component: 'Column', children: weatherChildren, gap: 5 },
      { id: 'weather-claim', component: 'Text', variant: 'body', text: `${view.weather.condition} · ${Math.round(view.weather.temperature.degrees)}${symbol}${precip}` },
    );
    if (view.dataMode === 'live') {
      weatherChildren.push('weather-source');
      components.push(liveSource('weather-source', view.weather.attribution));
    }
    const inference = jacketInference(view);
    if (inference) {
      weatherChildren.push('weather-inference');
      components.push({ id: 'weather-inference', component: 'Text', variant: 'caption', text: inference });
    }
  }

  if (view.limitations.length) {
    children.push('explorer-limitations');
    components.push({ id: 'explorer-limitations', component: 'Text', variant: 'caption', text: view.limitations.join(' ') });
  }
  // The surface owns what comes next. The shell used to hardcode the
  // counterfactual, so only the shell could decide it existed; now the presenter
  // that knows a winner was found is the thing that offers the comparison.
  if (view.winnerId) {
    const nextMode = view.travelMode === 'WALK' ? 'DRIVE' : 'WALK';
    const winner = view.candidates.find((candidate) => candidate.id === view.winnerId);
    children.push('next-actions');
    components.push({
      id: 'next-actions',
      component: 'NextActions',
      label: 'What next',
      actions: [
        {
          label: nextMode === 'DRIVE' ? 'Compare driving' : 'Compare walking',
          emphasis: 'primary',
          action: { event: { name: 'explorer_change_travel_mode', context: { travelMode: nextMode } } },
        },
        ...(winner?.placeUrl
          ? [{
              label: 'Open in Google Maps',
              action: { event: { name: 'open_url', context: { url: winner.placeUrl } } },
            }]
          : []),
      ],
    });
  }
  components.unshift({ id: 'root', component: 'Column', children, gap: 8 });
  return [
    ...(create ? [{ version: 'v0.9', createSurface: { surfaceId: view.surfaceId, catalogId: ATLAS_CATALOG_ID } } as const] : []),
    { version: 'v0.9', updateComponents: { surfaceId: view.surfaceId, components } },
    { version: 'v0.9', updateDataModel: { surfaceId: view.surfaceId, path: '/revision', value: view.revision } },
  ];
}
