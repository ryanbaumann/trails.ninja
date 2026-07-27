/**
 * Surface action dispatch. When the user interacts with a rendered A2UI surface
 * (taps a Button, picks a chip), the catalog builds an `A2uiAction` and routes it
 * here.
 *
 * Every action is resolved through the typed registry in `actionRegistry.ts`
 * first. An action the host never registered is refused and reported — it is NOT
 * forwarded to the agent. Surfaces can be model-authored, so treating an unknown
 * action name and its context as prompt text handed a model-controlled string
 * straight into the next user turn.
 */
import type { A2uiAction } from './protocol';
import { resolveSurfaceAction, type ResolvedAction } from './actionRegistry';
import { atlas } from '@/state/store';
import { sendToCopilot } from '@/ai/session';
import { lib } from '@/services/maps';
import { SCENARIOS } from '@/scenarios/registry';
import type { MarkerSpec } from '@/lib/types';
import { changeExplorerTravelMode } from '@/explorer/controller';

export type { ActionName as BuiltinActionName } from './actionRegistry';

export function dispatchSurfaceAction(a: A2uiAction): void {
  const resolution = resolveSurfaceAction(a.name, a.context ?? {});
  if (!resolution.ok) {
    atlas().pushToast('warn', 'That control is not available.');
    // Structural only — the refused name/context never leaves the browser.
    atlas().pushTool({
      id: `action-refused-${a.sourceComponentId}-${a.timestamp}`,
      name: 'surface_action_refused',
      status: 'error',
      ts: Date.now(),
    });
    return;
  }
  execute(resolution.action);
}

function execute(action: ResolvedAction): void {
  const s = atlas();
  switch (action.name) {
    case 'fly_to': {
      if (s.mapMode === '3d') {
        s.setCamera({ kind: 'fly3d', center: { ...action.center, altitude: 60 }, range: 1400, tilt: 60 });
      } else {
        s.setCamera({ kind: 'fly', center: action.center, zoom: action.zoom ?? 15, animate: true });
      }
      return;
    }
    case 'select_place':
      void selectPlace(action.placeId, true);
      return;
    case 'send_prompt':
      sendToCopilot(action.prompt);
      return;
    case 'open_url':
      window.open(action.url, '_blank', 'noopener,noreferrer');
      return;
    case 'download_image':
      try {
        downloadImage(action.dataUrl, action.filename);
      } catch {
        s.pushToast('bad', "Couldn't download the image.");
      }
      return;
    case 'explorer_change_travel_mode':
      changeExplorerTravelMode(action.travelMode);
      return;
  }
}

async function selectPlace(placeId: string, animate = false): Promise<void> {
  try {
    const { Place } = await lib('places');
    const place = new Place({ id: placeId });
    await place.fetchFields({ fields: ['id', 'displayName', 'location', 'formattedAddress', 'rating', 'photos'] });
    if (!place.location) {
      atlas().pushToast('bad', "Couldn't load that place.");
      return;
    }

    const s = atlas();
    const marker: MarkerSpec = {
      id: `search-${place.id}`,
      position: { lat: place.location.lat(), lng: place.location.lng() },
      title: place.displayName ?? 'Selected place',
      kind: 'pin',
      color: '#6d5ef3',
      placeId: place.id,
      scenario: s.activeScenario,
    };
    s.addMarkers([marker]);
    s.selectMarker(marker.id);
    s.setCamera({ kind: 'fly', center: marker.position, zoom: 16.5, animate });

    // Notify active scenario
    const scenarioMod = SCENARIOS[s.activeScenario];
    if (scenarioMod?.onPlaceSelect) {
      void scenarioMod.onPlaceSelect(place);
    }
  } catch {
    atlas().pushToast('bad', "Couldn't load that place.");
  }
}

function downloadImage(src: string, filename: string): void {
  const a = document.createElement('a');
  a.href = src;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
