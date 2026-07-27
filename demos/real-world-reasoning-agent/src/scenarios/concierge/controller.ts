import { atlas } from '@/state/store';
import { uid } from '@/lib/id';
import { haversine } from '@/lib/geo';
import { placeDetails } from '@/services/places';
import { computeRoute } from '@/services/routes';
import { generateImage, postcardPrompt } from '@/ai/image';
import type { LatLng, MarkerSpec, RouteSpec, TravelMode } from '@/lib/types';
import { concierge, type ItineraryStop } from './store';

const ACCENT = '#f59e0b';

/** Enrich stops with place details, then paint pins + legs on the shared map. */
export async function proposeItinerary(rawStops: ItineraryStop[]): Promise<{
  count: number;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  stops: { index: number; name: string; window?: string; location?: LatLng }[];
}> {
  const c = concierge();
  c.setBuilding(true);
  c.setStops(rawStops);
  c.setActiveStop(-1);

  // Enrich each stop (photos, rating, hours, exact location) in parallel.
  const enriched = await Promise.all(
    rawStops.map(async (st) => {
      if (!st.placeId) return st;
      try {
        const detail = await placeDetails(st.placeId);
        return { ...st, detail, name: detail.name || st.name };
      } catch {
        return st;
      }
    }),
  );
  concierge().setStops(enriched);
  await redrawItinerary();
  concierge().setBuilding(false);

  const s = concierge();
  return {
    count: enriched.length,
    totalDistanceMeters: s.totalMeters,
    totalDurationSeconds: s.totalSeconds,
    stops: enriched.map((st, i) => ({
      index: i + 1,
      name: st.name,
      window: st.window,
      location: st.detail?.location,
      rating: st.detail?.rating,
      userRatingCount: st.detail?.userRatingCount,
      priceLevel: st.detail?.priceLevel,
      openNow: st.detail?.openNow,
      phone: st.detail?.phone,
      website: st.detail?.websiteUri,
      hours: st.detail?.regularOpeningHours,
      summary: st.detail?.editorialSummary,
      address: st.detail?.formattedAddress,
    })),
  };
}

/** Repaint numbered pins + connecting legs from the current itinerary. */
export async function redrawItinerary(): Promise<void> {
  const s = concierge();
  const a = atlas();
  a.clearMap();

  const located = s.stops
    .map((st, i) => ({ st, i, loc: st.detail?.location }))
    .filter((x): x is { st: ItineraryStop; i: number; loc: LatLng } => !!x.loc);

  const markers: MarkerSpec[] = located.map(({ st, i, loc }) => ({
    id: `concierge-stop-${i}`,
    position: loc,
    glyph: String(i + 1),
    title: st.name,
    color: ACCENT,
    kind: 'pin',
    placeId: st.placeId,
    scenario: 'concierge',
    meta: { detail: st.detail },
  }));
  a.setMarkers(markers);

  // Draw a leg between each consecutive located pair.
  const legPromises = [];
  for (let k = 0; k < located.length - 1; k++) {
    const from = located[k].loc;
    const to = located[k + 1].loc;
    const mode: TravelMode =
      s.travelMode ?? (haversine(from, to) <= 2000 ? 'WALK' : 'DRIVE');
    legPromises.push(
      computeRoute(from, to, { travelMode: mode, trafficAware: true })
        .then((route) => ({ route, mode }))
        .catch(() => null)
    );
  }

  const legResults = await Promise.all(legPromises);
  
  let totalMeters = 0;
  let totalSeconds = 0;
  const routes: RouteSpec[] = [];

  for (const res of legResults) {
    if (res && res.route) {
      totalMeters += res.route.distanceMeters;
      totalSeconds += res.route.durationSeconds;
      routes.push({
        id: uid('r'),
        path: res.route.path,
        color: ACCENT,
        width: 5,
        dashed: res.mode === 'WALK',
        scenario: 'concierge',
        z: 2,
      });
    }
  }
  atlas().setRoutes(routes);
  concierge().setTotals(totalMeters, totalSeconds);

  const pts = located.map((x) => x.loc);
  if (pts.length > 1) atlas().setCamera({ kind: 'fit', bounds: pts });
  else if (pts[0]) atlas().setCamera({ kind: 'fly', center: pts[0], zoom: 15 });
}

/** Play-tour: step the camera stop→stop with a dwell, syncing the active card. */
export async function playTour(): Promise<void> {
  const s = concierge();
  const located = s.stops
    .map((st, i) => ({ i, loc: st.detail?.location }))
    .filter((x): x is { i: number; loc: LatLng } => !!x.loc);
  if (!located.length || s.playing) return;

  concierge().setPlaying(true);
  for (const { i, loc } of located) {
    if (!concierge().playing) break;
    concierge().setActiveStop(i);
    atlas().selectMarker(`concierge-stop-${i}`);
    atlas().setCamera({ kind: 'fly', center: loc, zoom: 16.5 });
    await new Promise((r) => setTimeout(r, 1900));
  }
  concierge().setActiveStop(-1);
  atlas().selectMarker(null);
  concierge().setPlaying(false);
}

export function stopTour(): void {
  concierge().setPlaying(false);
}

/** Nano Banana postcard from the real stop names. */
export async function makePostcard(styleHint?: string): Promise<{ ok: boolean }> {
  const s = concierge();
  const names = s.stops.map((st) => st.name).filter(Boolean);
  if (!names.length) return { ok: false };
  concierge().setPostcard({ status: 'loading' });
  concierge().openPostcard(true);
  const prompt = postcardPrompt('San Francisco', names, styleHint);
  const dataUrl = await generateImage(prompt, (kind) => {
    // A 429 is a rate limit, not a broken model — tell the user to wait/retry.
    if (kind === 'rate-limited') {
      atlas().pushToast(
        'bad',
        'Postcard generation is rate-limited right now — wait a minute and retry.',
      );
    }
  });
  concierge().setPostcard(
    dataUrl ? { status: 'done', dataUrl } : { status: 'error' },
  );
  return { ok: !!dataUrl };
}
