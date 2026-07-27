import { atlas } from '@/state/store';
import { uid } from '@/lib/id';
import { searchText, searchNearby } from '@/services/places';
import { computeMatrix } from '@/services/routes';
import { environmentSnapshot } from '@/services/env';
import { hasStreetView, streetViewHeadingUrl } from '@/services/streetview';
import { staticMapUrl } from '@/services/staticmap';
import { analyzeImagesJson, fetchImageBase64 } from '@/ai/vision';
import { generateVideo } from '@/ai/video';
import { buildWalkthroughPrompt } from '@/ai/videoPrompt';
import { putImage } from '@/genui/images';
import { VIDEO_GEN_ENABLED } from '@/lib/config';
import type { A2uiMessage } from '@/genui/protocol';
import type { LatLng, MarkerSpec, PlaceLite } from '@/lib/types';
import { scout, INSPECTION_CAP, type Candidate, type EvidenceFrame, type RubricWeights } from './store';
import { fuseScores, normalizeRubricWeights, type FuseInputs } from './fuseScores';
import { headingsTowards, compassLabel } from './headings';
import { buildWalkthroughVideoSurface } from './walkthroughSurface';
import { missionStore, prioritiesToRubric } from '@/mission/store';

const ACCENT = '#60a5fa';
const RANK_COLORS = ['#fbbf24', '#c0c0c0', '#cd7f32']; // gold, silver, bronze; rest fall back to ACCENT

function syncActiveMission(): void {
  const mission = missionStore();
  if (mission.mission.status !== 'draft') mission.syncScoutCandidates(scout().candidates);
}

/** Tight overhead satellite frame for aerial context (corner position, frontage
 *  width, parking, nearby footfall generators) — grounds the vision read beyond
 *  eye level. Routes through the same `/api/real-world-reasoning-agent/gmp/staticmap` proxy vision is allowed to fetch. */
function aerialUrl(loc: LatLng): string {
  return staticMapUrl(loc, { maptype: 'satellite', zoom: 19, w: 640, h: 640, scale: 2 });
}

function paintCandidatePins(candidates: Candidate[]) {
  const markers: MarkerSpec[] = candidates.map((c, i) => ({
    id: `scout-candidate-${c.id}`,
    position: c.loc,
    glyph: String(i + 1),
    title: c.label,
    color: ACCENT,
    kind: 'pin',
    placeId: c.place?.id,
    meta: { candidateId: c.id },
    scenario: 'scout',
  }));
  const s = atlas();
  const others = s.markers.filter((m) => !m.id.startsWith('scout-candidate-'));
  s.setMarkers([...others, ...markers]);
}

/** Re-glyph pins by rank (1 = gold, 2 = silver, 3 = bronze, rest = accent). */
function repaintRankedPins(candidates: Candidate[]) {
  const ranked = [...candidates].filter((c) => c.rank != null).sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  const markers: MarkerSpec[] = ranked.map((c) => ({
    id: `scout-candidate-${c.id}`,
    position: c.loc,
    glyph: String(c.rank),
    title: `#${c.rank} · ${c.label}`,
    color: c.rank && c.rank <= 3 ? RANK_COLORS[c.rank - 1] : ACCENT,
    kind: 'pin',
    placeId: c.place?.id,
    meta: { candidateId: c.id, rank: c.rank, total: c.scores?.total },
    scenario: 'scout',
  }));
  const s = atlas();
  const others = s.markers.filter((m) => !m.id.startsWith('scout-candidate-'));
  s.setMarkers([...others, ...markers]);
}

/** scout_area: fan out for anchor candidates in a corridor/area, drop numbered pins, fit camera. */
export async function scoutArea(
  query: string,
  center: LatLng,
  radiusM: number,
  maxCandidates: number,
): Promise<Candidate[]> {
  const s = scout();
  const radius = Math.max(50, Math.min(radiusM, 1500));
  const max = Math.max(1, Math.min(maxCandidates, 6));
  s.setArea({ center, radiusM: radius, query });

  let places: PlaceLite[] = [];
  try {
    places = await searchText(query, { near: center, radius, maxResults: max });
  } catch {
    places = [];
  }
  if (!places.length) {
    try {
      places = await searchNearby(center, { radius, maxResults: max });
    } catch {
      places = [];
    }
  }

  const candidates: Candidate[] = places.slice(0, max).map((p, i) => ({
    id: uid('cand'),
    place: p,
    loc: p.location,
    label: p.name || `Candidate ${i + 1}`,
    status: 'pending',
    evidence: [],
  }));

  s.setCandidates(candidates);
  syncActiveMission();
  paintCandidatePins(candidates);

  const pts = candidates.map((c) => c.loc);
  const at = atlas();
  if (pts.length > 1) at.setCamera({ kind: 'fit', bounds: pts });
  else if (pts[0]) at.setCamera({ kind: 'fly', center: pts[0], zoom: 16 });
  else at.setCamera({ kind: 'fly', center, zoom: 15 });

  return candidates;
}

export interface InspectResult {
  ok: boolean;
  error?: string;
  degraded?: boolean;
  headings?: number[];
  headingLabels?: string[];
  scores?: Record<string, number>;
  notes?: string;
}

const VISION_SCHEMA_HINT = `Respond with ONLY a JSON object of this exact shape (no markdown fences, no commentary):
{"scores":{"visibility":<0-10 number>,"condition":<0-10 number>,"activity":<0-10 number>},"notes":"<1-2 sentence factual description citing what you actually see>","confidence":<0-1 number>}
Scoring guide:
- visibility: how visible/legible the storefront or site is from the street (signage, frontage, sightlines, obstructions like trees/poles/scaffolding).
- condition: visible physical upkeep of the storefront/site (paint, cleanliness, disrepair). Do not infer vacancy or availability.
- activity: pedestrian-activity signals visible in this captured frame (people, parked bikes, outdoor seating, crowding). This is not measured foot traffic. Score 0 when no activity is visible.
Only describe what is visible in the attached image(s). Do not guess at facts you cannot see.`;

/** inspect_candidate: fetch 2-3 Street View frames, run Gemini vision, store evidence. */
export async function inspectCandidate(
  candidateId: string,
  headings?: number[],
  signal?: AbortSignal,
): Promise<InspectResult> {
  const s = scout();
  const candidate = s.candidates.find((c) => c.id === candidateId);
  if (!candidate) return { ok: false, error: `Unknown candidate "${candidateId}".` };
  if (candidate.status !== 'pending') {
    return { ok: false, error: `Candidate "${candidate.label}" was already inspected — call show_evidence instead.` };
  }
  if (s.inspectionsUsed >= INSPECTION_CAP) {
    return { ok: false, error: `Inspection cap (${INSPECTION_CAP} per session) reached for this demo.` };
  }

  const targetHeadings = (headings && headings.length ? headings : headingsTowards(candidate.loc, s.area?.center)).slice(
    0,
    3,
  );

  const pano = await hasStreetView(candidate.loc, signal).catch(() => false);

  // Overhead satellite frame gives the model corner/frontage/parking context for
  // the site-selection read; it's always available and sent as the LAST image.
  const aerialFrame: EvidenceFrame = { url: aerialUrl(candidate.loc), heading: NaN, kind: 'aerial' };

  let evidence: EvidenceFrame[];
  let instructions: string;
  let degraded = false;

  if (pano) {
    evidence = targetHeadings.map((h) => ({
      url: streetViewHeadingUrl(candidate.loc, h),
      heading: h,
      kind: 'street' as const,
    }));
    evidence.push(aerialFrame);
    instructions =
      `You are a field analyst inspecting "${candidate.label}" for a site-selection decision. ` +
      `The first images are Street View frames looking toward headings ${targetHeadings
        .map((h) => `${Math.round(h)}° (${compassLabel(h)})`)
        .join(', ')} from the same point; the LAST image is an overhead satellite view of the same spot. ` +
      `Use the street frames for visibility, condition and pedestrian activity, and the aerial for corner ` +
      `position, frontage width, parking and nearby footfall generators. Assess visibility, condition and activity.`;
  } else if (candidate.place?.photoUri) {
    // Degrade to a Places photo (plus the aerial) when no Street View coverage exists.
    evidence = [{ url: candidate.place.photoUri, heading: NaN, kind: 'photo' }, aerialFrame];
    degraded = true;
    instructions =
      `No Street View coverage exists for "${candidate.label}"; the attached images are a Places-listed photo ` +
      `(may not show the current street frontage) and an overhead satellite view. Assess visibility, condition ` +
      `and activity as best you can from these, and reflect this uncertainty with a LOWER confidence value.`;
  } else {
    // Even with no pano and no photo, the aerial alone still supports a cautious read.
    evidence = [aerialFrame];
    degraded = true;
    instructions =
      `No Street View coverage or listed photo exists for "${candidate.label}"; the only attached image is an ` +
      `overhead satellite view. Assess what you can (frontage, corner position, surroundings) and return a LOW ` +
      `confidence value, noting that no street-level imagery was available.`;
  }

  const { parsed } = await analyzeImagesJson(instructions, evidence.map((e) => e.url), VISION_SCHEMA_HINT, signal);
  // A superseded/aborted run must not corrupt the store or burn an inspection
  // slot with an empty verdict — bail before mutating (the engine discards this
  // result anyway once its generation token is stale).
  if (signal?.aborted) return { ok: false, error: 'Inspection was superseded.' };
  const verdict =
    parsed && typeof parsed === 'object'
      ? (parsed as { scores?: Record<string, number>; notes?: string; confidence?: number })
      : undefined;
  const scores = verdict?.scores ?? {};
  const notes = verdict?.notes ?? 'Vision analysis returned no readable notes.';
  const confidence = degraded ? Math.min(0.4, verdict?.confidence ?? 0.4) : (verdict?.confidence ?? 0.5);

  evidence = evidence.map((e) => ({
    ...e,
    ref: putImage(e.url),
    verdict: { scores, notes, confidence },
  }));

  s.patchCandidate(candidateId, { status: 'inspected', evidence });
  s.incrementInspections();
  syncActiveMission();

  return {
    ok: true,
    degraded,
    headings: targetHeadings,
    headingLabels: targetHeadings.map(compassLabel),
    scores,
    notes,
  };
}

function averageVisionScores(evidence: EvidenceFrame[]): { visibility: number; condition: number; activity: number } {
  const acc = { visibility: 0, condition: 0, activity: 0 };
  let n = 0;
  for (const e of evidence) {
    if (!e.verdict) continue;
    n++;
    acc.visibility += Number(e.verdict.scores.visibility ?? 5);
    acc.condition += Number(e.verdict.scores.condition ?? 5);
    acc.activity += Number(e.verdict.scores.activity ?? 5);
  }
  if (n === 0) return { visibility: 5, condition: 5, activity: 5 };
  return { visibility: acc.visibility / n, condition: acc.condition / n, activity: acc.activity / n };
}

export interface ScoredRow {
  id: string;
  label: string;
  rank: number;
  scores: Candidate['scores'];
}

/** score_candidates: fuse vision + Places density + environment + access into ranked totals. */
export async function scoreCandidates(weights?: Partial<RubricWeights>): Promise<ScoredRow[]> {
  const s = scout();
  const mission = missionStore().mission;
  const base = mission.status === 'draft' ? s.rubricWeights : prioritiesToRubric(mission.preferences.priorities);
  const w = normalizeRubricWeights({ ...base, ...(weights ?? {}) });
  s.setWeights(w);

  const area = s.area;
  const inspected = s.candidates.filter((c) => c.status !== 'pending');

  // Two access anchors: the area center, plus the nearest transit stop to it.
  let transitAnchor: LatLng | undefined;
  if (area) {
    try {
      const stops = await searchNearby(area.center, {
        includedTypes: ['transit_station'],
        radius: 1500,
        maxResults: 1,
        rank: 'DISTANCE',
      });
      transitAnchor = stops[0]?.location;
    } catch {
      transitAnchor = undefined;
    }
  }
  const anchors: LatLng[] = [area?.center, transitAnchor].filter((a): a is LatLng => !!a);

  const results: { candidate: Candidate; fuseInputs: FuseInputs }[] = await Promise.all(
    inspected.map(async (candidate) => {
      const vision = averageVisionScores(candidate.evidence);

      const [density, env, accessMinutes] = await Promise.all([
        (async () => {
          const [complementary, competitor] = await Promise.all([
            searchNearby(candidate.loc, {
              includedTypes: ['restaurant', 'cafe', 'store', 'tourist_attraction'],
              radius: 200,
              maxResults: 10,
            }).catch(() => []),
            area
              ? searchText(area.query, { near: candidate.loc, radius: 200, maxResults: 10 }).catch(() => [])
              : Promise.resolve([]),
          ]);
          return { complementary: complementary.length, competitor: competitor.length };
        })(),
        environmentSnapshot(candidate.loc).catch(() => ({}) as Awaited<ReturnType<typeof environmentSnapshot>>),
        (async () => {
          if (!anchors.length) return undefined;
          try {
            const cells = await computeMatrix(anchors, [candidate.loc], 'WALK');
            const ok = cells.filter((c) => c.status === 'OK');
            if (!ok.length) return undefined;
            return ok.reduce((sum, c) => sum + c.durationSeconds, 0) / ok.length / 60;
          } catch {
            return undefined;
          }
        })(),
      ]);

      const pollenIndex = env.pollen
        ? Math.max(env.pollen.grass?.index ?? 0, env.pollen.tree?.index ?? 0, env.pollen.weed?.index ?? 0)
        : undefined;

      return {
        candidate,
        fuseInputs: {
          vision,
          density,
          env: { aqi: env.air?.aqi, pollenIndex },
          accessMinutes,
        },
      };
    }),
  );

  const scored = results.map(({ candidate, fuseInputs }) => ({
    candidate,
    scores: fuseScores(fuseInputs, w),
  }));
  scored.sort((a, b) => b.scores.total - a.scores.total);

  scored.forEach(({ candidate, scores }, i) => {
    s.patchCandidate(candidate.id, { status: 'scored', scores, rank: i + 1 });
  });

  const updated = scout().candidates;
  repaintRankedPins(updated);
  syncActiveMission();

  return scored.map(({ candidate, scores }, i) => ({ id: candidate.id, label: candidate.label, rank: i + 1, scores }));
}

export interface EvidencePayload {
  ok: boolean;
  error?: string;
  candidateId?: string;
  label?: string;
  scores?: Candidate['scores'];
  frames?: { ref?: string; heading: number; headingLabel: string; notes?: string }[];
}

/** show_evidence: return the candidate's inspected frames + scores for the model to render as an A2UI surface. */
export function getEvidence(candidateId: string): EvidencePayload {
  const candidate = scout().candidates.find((c) => c.id === candidateId);
  if (!candidate) return { ok: false, error: `Unknown candidate "${candidateId}".` };
  if (!candidate.evidence.length) {
    return { ok: false, error: `"${candidate.label}" hasn't been inspected yet — call inspect_candidate first.` };
  }
  return {
    ok: true,
    candidateId: candidate.id,
    label: candidate.label,
    scores: candidate.scores,
    frames: candidate.evidence.map((e) => ({
      ref: e.ref,
      heading: e.heading,
      headingLabel:
        e.kind === 'aerial'
          ? 'aerial'
          : e.kind === 'photo' || Number.isNaN(e.heading)
            ? 'photo'
            : compassLabel(e.heading),
      notes: e.verdict?.notes,
    })),
  };
}

export interface CompareRow {
  candidateId: string;
  label: string;
  rank: number;
  address?: string;
  scores: Candidate['scores'];
}

export interface ComparePayload {
  ok: boolean;
  error?: string;
  area?: string;
  winner?: { candidateId: string; label: string; total: number; location: LatLng };
  rows?: CompareRow[];
}

/**
 * compare_sites: return the ranked, scored candidates as a decision matrix for
 * the model to render as an A2UI comparison surface. Pure read over the store —
 * requires score_candidates to have run first.
 */
export function compareSites(): ComparePayload {
  const s = scout();
  const scored = s.candidates
    .filter((c) => c.rank != null && c.scores)
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  if (scored.length < 2) {
    return {
      ok: false,
      error:
        scored.length === 0
          ? 'No candidates have been scored yet — call score_candidates first.'
          : 'Only one candidate is scored — inspect and score at least two sites to compare.',
    };
  }
  const top = scored[0];
  if (missionStore().mission.status !== 'draft') {
    missionStore().setDecision({ candidateId: top.id, rationale: 'Current highest weighted score; awaiting approval.' });
  }
  return {
    ok: true,
    area: s.area?.query,
    winner: { candidateId: top.id, label: top.label, total: top.scores!.total, location: top.loc },
    rows: scored.map((c) => ({
      candidateId: c.id,
      label: c.label,
      rank: c.rank!,
      address: c.place?.formattedAddress,
      scores: c.scores,
    })),
  };
}

/** Apply a counterfactual weight change immediately from existing sub-scores. */
export function applyCounterfactualWeights(weights: RubricWeights): Candidate[] {
  const state = scout();
  const totalWeight = Object.values(weights).reduce((sum, value) => sum + Math.max(0, value), 0) || 1;
  const scored = state.candidates
    .filter((candidate) => candidate.scores)
    .map((candidate, index) => {
      const scores = candidate.scores!;
      const total =
        (scores.visibility * weights.visibility +
          scores.condition * weights.condition +
          scores.activity * weights.activity +
          scores.access * weights.access +
          scores.environment * weights.environment) /
        totalWeight;
      return { candidate, index, total: Math.round(total * 10) / 10 };
    })
    .sort((a, b) => b.total - a.total || a.index - b.index);
  const rankById = new Map(scored.map((row, index) => [row.candidate.id, { rank: index + 1, total: row.total }]));
  const next = state.candidates.map((candidate) => {
    const rank = rankById.get(candidate.id);
    return rank && candidate.scores
      ? { ...candidate, rank: rank.rank, scores: { ...candidate.scores, total: rank.total } }
      : candidate;
  });
  state.setWeights(weights);
  state.setCandidates(next);
  repaintRankedPins(next);
  syncActiveMission();
  return next;
}

/**
 * walkthrough_video: seed the Gemini omni video-gen seam with the winning site's
 * Street View evidence frame → a short establishing walkthrough clip, stashed in
 * the image registry and returned as a deterministic A2UI surface. Gated by
 * `VIDEO_GEN_ENABLED`; requires score_candidates + compare_sites to have run.
 */
export async function generateWalkthroughVideo(): Promise<{
  ok: boolean;
  error?: string;
  surfaceId?: string;
  messages?: A2uiMessage[];
  label?: string;
}> {
  if (!VIDEO_GEN_ENABLED) {
    return { ok: false, error: 'Video generation is disabled (set VITE_VIDEO_GEN_ENABLED=true to enable).' };
  }

  const payload = compareSites();
  if (!payload.ok || !payload.winner) {
    return { ok: false, error: payload.error ?? 'No winning site to walk through yet.' };
  }

  const winner = scout().candidates.find((c) => c.id === payload.winner!.candidateId);
  if (!winner) return { ok: false, error: 'Winning candidate is no longer in the store.' };

  const frame = winner.evidence.find((e) => e.kind === 'street') ?? winner.evidence.find((e) => e.url);
  if (!frame) return { ok: false, error: 'no street frame' };

  try {
    const seed = await fetchImageBase64(frame.url);
    if (!seed) return { ok: false, error: 'Could not fetch the seed Street View frame.' };

    const result = await generateVideo({
      imageBase64: seed.data,
      imageMimeType: seed.mimeType,
      prompt: buildWalkthroughPrompt(winner.label),
      task: 'image_to_video',
    });

    const ref = putImage(result.dataUrl);
    scout().patchCandidate(winner.id, { videoRef: ref });

    const { surfaceId, messages } = buildWalkthroughVideoSurface({ label: winner.label, videoRef: ref });
    return { ok: true, surfaceId, messages, label: winner.label };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
