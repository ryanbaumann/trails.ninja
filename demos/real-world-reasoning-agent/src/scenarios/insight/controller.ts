import { atlas } from '@/state/store';
import { uid } from '@/lib/id';
import { haversine } from '@/lib/geo';
import { reverseGeocode } from '@/services/geocode';
import { searchNearby } from '@/services/places';
import { computeMatrix } from '@/services/routes';
import { environmentSnapshot } from '@/services/env';
import { streetViewUrl, hasStreetView } from '@/services/streetview';
import { genai } from '@/ai/client';
import { MODELS, getThinkingConfig } from '@/lib/config';
import { speak } from '@/ai/tts';
import type { LatLng, MarkerSpec, PolygonSpec } from '@/lib/types';
import { insight, type CommuteCell, type Dossier, type Essential, type Slot } from './store';

const ACCENT = '#34d399';

const CATEGORIES: { type: string; label: string; glyph: string; color: string }[] = [
  { type: 'supermarket', label: 'Groceries', glyph: '🛒', color: '#f59e0b' },
  { type: 'transit_station', label: 'Transit', glyph: '🚉', color: '#38bdf8' },
  { type: 'park', label: 'Park', glyph: '🌳', color: '#34d399' },
  { type: 'primary_school', label: 'School', glyph: '🏫', color: '#a78bfa' },
  { type: 'restaurant', label: 'Dining', glyph: '🍽', color: '#fb7185' },
  { type: 'gym', label: 'Fitness', glyph: '💪', color: '#f97316' },
];

export const COMMUTE_ANCHORS: { name: string; loc: LatLng }[] = [
  { name: 'Salesforce Tower', loc: { lat: 37.7897, lng: -122.3972 } },
  { name: 'SFO Airport', loc: { lat: 37.6213, lng: -122.379 } },
  { name: 'UCSF Mission Bay', loc: { lat: 37.7679, lng: -122.3915 } },
];

/** Living-quality heuristic (0-100). Labeled a demo heuristic in the UI. */
function livingScore(essentials: Essential[], env: Dossier['env']): number {
  let score = 0;
  // Proximity of essentials: closer = more points (max ~10 each).
  for (const e of essentials) {
    if (e.distanceMeters == null) continue;
    score += Math.max(0, 11 - e.distanceMeters / 150); // 0m→11, 1650m→0
  }
  // Air quality: US AQI, lower is better (max 20).
  if (env.air?.aqi != null) score += Math.max(0, 20 - env.air.aqi / 5);
  // A park within 600 m is a strong signal (bonus 8).
  const park = essentials.find((e) => e.category === 'park');
  if (park?.distanceMeters != null && park.distanceMeters < 600) score += 8;
  return Math.round(Math.max(0, Math.min(100, score)));
}

/** Full neighborhood fan-out for one location. Degrades tile-by-tile. */
export async function analyzeLocation(loc: LatLng, slot: Slot = 'A'): Promise<Dossier> {
  const s = insight();
  s.setLoading(slot, true);

  // Drop the subject pin immediately (radar ping handled in MapLayer).
  paintSubjectPins(loc, slot, []);
  atlas().setCamera({ kind: 'fly', center: loc, zoom: 15.5 });

  const [geo, essentials, env, pano, commute] = await Promise.all([
    reverseGeocode(loc).catch(() => null),
    fetchEssentials(loc),
    environmentSnapshot(loc),
    hasStreetView(loc).catch(() => false),
    fetchCommute(loc),
  ]);

  const dossier: Dossier = {
    id: uid('dossier'),
    location: loc,
    address: geo?.formattedAddress,
    streetViewUrl: pano ? streetViewUrl(loc, { w: 720, h: 360 }) : undefined,
    hasPano: pano,
    score: livingScore(essentials, env),
    essentials,
    env,
    commute,
  };

  insight().setDossier(slot, dossier);
  insight().setLoading(slot, false);
  paintSubjectPins(loc, slot, essentials);

  // If both locations are analyzed, draw a connecting comparison route and fit them both in camera view.
  const updatedState = insight();
  const sub = slot === 'A' ? dossier : updatedState.subject;
  const comp = slot === 'B' ? dossier : updatedState.compare;

  if (sub && comp) {
    atlas().setRoutes([
      {
        id: 'insight-comparison-line',
        path: [sub.location, comp.location],
        color: '#f43f5e',
        width: 3.5,
        dashed: true,
        scenario: 'insight',
      },
    ]);
    atlas().setCamera({
      kind: 'fit',
      bounds: [sub.location, comp.location],
    });
  } else {
    atlas().setRoutes([]);
  }

  repaintPolygons();

  return dossier;
}

async function fetchEssentials(loc: LatLng): Promise<Essential[]> {
  const results = await Promise.all(
    CATEGORIES.map(async (c) => {
      try {
        const places = await searchNearby(loc, {
          includedTypes: [c.type],
          radius: 1400,
          maxResults: 1,
          rank: 'DISTANCE',
        });
        const place = places[0];
        return {
          category: c.type === 'primary_school' ? 'school' : c.type,
          label: c.label,
          place,
          distanceMeters: place ? haversine(loc, place.location) : undefined,
        } as Essential;
      } catch {
        return { category: c.type, label: c.label } as Essential;
      }
    }),
  );
  return results;
}

async function fetchCommute(loc: LatLng): Promise<CommuteCell[]> {
  try {
    const cells = await computeMatrix(
      [loc],
      COMMUTE_ANCHORS.map((a) => a.loc),
      'DRIVE',
    );
    return COMMUTE_ANCHORS.map((anchor, i) => {
      const cell = cells.find((c) => c.destinationIndex === i);
      return {
        anchorName: anchor.name,
        anchorLoc: anchor.loc,
        distanceMeters: cell?.distanceMeters ?? NaN,
        durationSeconds: cell?.durationSeconds ?? NaN,
        ok: cell?.status === 'OK',
      };
    });
  } catch {
    return COMMUTE_ANCHORS.map((a) => ({
      anchorName: a.name,
      anchorLoc: a.loc,
      distanceMeters: NaN,
      durationSeconds: NaN,
      ok: false,
    }));
  }
}

/** Repaint subject + essentials mini-pins for both slots. */
function paintSubjectPins(loc: LatLng, slot: Slot, essentials: Essential[]) {
  const a = atlas();
  const color = slot === 'A' ? ACCENT : '#60a5fa';
  const subject: MarkerSpec = {
    id: `insight-subject-${slot}`,
    position: loc,
    glyph: slot,
    title: slot === 'A' ? 'Subject location' : 'Compare location',
    color,
    kind: 'pin',
    scenario: 'insight',
  };
  const minis: MarkerSpec[] = essentials
    .filter((e) => e.place)
    .map((e, i) => {
      const theme = CATEGORIES.find((c) => c.label === e.label);
      return {
        id: `insight-${slot}-ess-${i}`,
        position: e.place!.location,
        glyph: theme?.glyph ?? '•',
        title: `${e.label}: ${e.place!.name}`,
        color: theme?.color ?? color,
        kind: 'category',
        category: e.label,
        placeId: e.place!.id,
        meta: { detail: e.place, category: e.label, distanceMeters: e.distanceMeters, slot },
        scenario: 'insight',
      };
    });

  // Keep the other slot's pins; replace only this slot's.
  const others = a.markers.filter((m) => !m.id.startsWith(`insight-${slot}`) && m.id !== `insight-subject-${slot}`);
  a.setMarkers([...others, subject, ...minis]);
}

/** Gemini narrative brief from the REAL dossier numbers, then read it aloud. */
export async function askBrief(slot: Slot = 'A', readAloud = true, signal?: AbortSignal): Promise<string> {
  const d = slot === 'A' ? insight().subject : insight().compare;
  if (!d) return '';
  insight().patchDossier(slot, { briefLoading: true });

  const facts = {
    address: d.address,
    livingScore: d.score,
    airQuality: d.env.air && { aqi: d.env.air.aqi, category: d.env.air.category },
    weather: d.env.weather && {
      tempC: d.env.weather.tempC,
      condition: d.env.weather.condition,
      feelsLikeC: d.env.weather.feelsLikeC,
      humidity: d.env.weather.humidity,
      windKph: d.env.weather.windKph,
    },
    essentials: d.essentials
      .filter((e) => e.place)
      .map((e) => ({ what: e.label, name: e.place!.name, meters: Math.round(e.distanceMeters ?? 0) })),
    commute: d.commute
      .filter((c) => c.ok)
      .map((c) => ({ to: c.anchorName, minutes: Math.round(c.durationSeconds / 60) })),
  };

  let text = '';
  try {
    const thinkingConfig = getThinkingConfig(MODELS.utility, 'simpleUi');
    const resp = await genai().models.generateContent({
      model: MODELS.utility,
      contents:
        `You are a neighborhood analyst. Using ONLY these facts, write a concise, direct 2-to-3 sentence brief on ` +
        `what it's like to live at this exact spot. Be concrete and factual, cite the numbers, avoiding flowery or wordy language, no hedging, no lists.\n\n` +
        JSON.stringify(facts),
      config: {
        ...(thinkingConfig ? { thinkingConfig } : {}),
      },
    });
    text = resp.text ?? '';
  } catch {
    text = '';
  }

  insight().patchDossier(slot, { brief: text, briefLoading: false });
  if (readAloud && text && !signal?.aborted) void speak(text, 'Kore', { scenario: 'insight' });
  return text;
}

/** Clear a specific location slot, promoting B to A if A is cleared. */
export function clearLocation(slot: Slot) {
  const s = insight();
  const a = atlas();

  if (slot === 'A') {
    if (s.compare) {
      // Promote B to A!
      const comp = s.compare;
      s.setDossier('A', comp);
      s.setDossier('B', null);
      s.setActiveSlot('B');
      // Repaint markers as slot A
      paintSubjectPins(comp.location, 'A', comp.essentials);
      // Remove any B markers
      const others = a.markers.filter((m) => !m.id.startsWith('insight-B') && m.id !== 'insight-subject-B');
      a.setMarkers(others);
      // Clear routes
      a.setRoutes([]);
      a.setCamera({ kind: 'fly', center: comp.location, zoom: 15.5 });
    } else {
      // Just clear A
      s.setDossier('A', null);
      s.setActiveSlot('A');
      a.setMarkers(a.markers.filter((m) => !m.id.startsWith('insight-A') && m.id !== 'insight-subject-A'));
      a.setRoutes([]);
    }
  } else {
    // Clear B
    s.setDossier('B', null);
    s.setActiveSlot('B');
    a.setMarkers(a.markers.filter((m) => !m.id.startsWith('insight-B') && m.id !== 'insight-subject-B'));
    a.setRoutes([]);
    if (s.subject) {
      a.setCamera({ kind: 'fly', center: s.subject.location, zoom: 15.5 });
    }
  }

  // Clear briefs
  s.setCompareBrief('');

  repaintPolygons();
}

/** Ask Gemini for a comparative neighborhood narrative brief, then read it aloud. */
export async function askCompareBrief(readAloud = true, signal?: AbortSignal): Promise<string> {
  const s = insight();
  const a = s.subject;
  const b = s.compare;
  if (!a || !b) return '';

  s.setCompareBriefLoading(true);

  const facts = {
    locationA: {
      address: a.address,
      score: a.score,
      airQuality: a.env.air && { aqi: a.env.air.aqi, category: a.env.air.category },
      weather: a.env.weather && { tempC: a.env.weather.tempC, condition: a.env.weather.condition },
      essentials: a.essentials
        .filter((e) => e.place)
        .map((e) => ({ what: e.label, meters: Math.round(e.distanceMeters ?? 0) })),
      commute: a.commute
        .filter((c) => c.ok)
        .map((c) => ({ to: c.anchorName, minutes: Math.round(c.durationSeconds / 60) })),
    },
    locationB: {
      address: b.address,
      score: b.score,
      airQuality: b.env.air && { aqi: b.env.air.aqi, category: b.env.air.category },
      weather: b.env.weather && { tempC: b.env.weather.tempC, condition: b.env.weather.condition },
      essentials: b.essentials
        .filter((e) => e.place)
        .map((e) => ({ what: e.label, meters: Math.round(e.distanceMeters ?? 0) })),
      commute: b.commute
        .filter((c) => c.ok)
        .map((c) => ({ to: c.anchorName, minutes: Math.round(c.durationSeconds / 60) })),
    },
  };

  let text = '';
  try {
    const thinkingConfig = getThinkingConfig(MODELS.utility, 'simpleUi');
    const resp = await genai().models.generateContent({
      model: MODELS.utility,
      contents:
        `You are a neighborhood analyst. Compare Location A vs Location B using ONLY these facts. ` +
        `Write a concise, direct 2-to-3 sentence comparative summary highlighting their trade-offs in living quality. ` +
        `Citing exact score differences and key stats (like AQI or drive times). Be concrete and objective, do not list or use flowery intros.\n\n` +
        JSON.stringify(facts),
      config: {
        ...(thinkingConfig ? { thinkingConfig } : {}),
      },
    });
    text = resp.text ?? '';
  } catch (err) {
    console.error('Failed to get compare brief:', err);
    text = '';
  }

  s.setCompareBrief(text);
  s.setCompareBriefLoading(false);
  if (readAloud && text && !signal?.aborted) void speak(text, 'Kore', { scenario: 'insight' });
  return text;
}

function repaintPolygons() {
  const s = insight();
  const sub = s.subject;
  const comp = s.compare;
  const polygons: PolygonSpec[] = [];

  if (sub?.env.solar?.boundingBox) {
    const { sw, ne } = sub.env.solar.boundingBox;
    polygons.push({
      id: 'insight-polygon-A',
      path: [
        { lat: sw.lat, lng: sw.lng },
        { lat: ne.lat, lng: sw.lng },
        { lat: ne.lat, lng: ne.lng },
        { lat: sw.lat, lng: ne.lng },
      ],
      fill: '#fbbf24',
      stroke: '#fbbf24',
      opacity: 0.35,
      scenario: 'insight',
    });
  }

  if (comp?.env.solar?.boundingBox) {
    const { sw, ne } = comp.env.solar.boundingBox;
    polygons.push({
      id: 'insight-polygon-B',
      path: [
        { lat: sw.lat, lng: sw.lng },
        { lat: ne.lat, lng: sw.lng },
        { lat: ne.lat, lng: ne.lng },
        { lat: sw.lat, lng: ne.lng },
      ],
      fill: '#fbbf24',
      stroke: '#fbbf24',
      opacity: 0.35,
      scenario: 'insight',
    });
  }

  atlas().setPolygons(polygons);
}
