import { atlas } from '@/state/store';
import { uid } from '@/lib/id';
import { placeDetails } from '@/services/places';
import { environmentSnapshot } from '@/services/env';
import { streetViewUrl, hasStreetView } from '@/services/streetview';
import { askMaps } from '@/ai/grounding';
import {
  generateAdImage,
  prepareAdConditioningImage,
  prefetchAdConditioningImage,
  shrinkImage,
  adPrompt,
  type AdFormat,
  type AdCopyHints,
  type InlineImageData,
  type AiFailureKind,
} from '@/ai/image';
import { reserveImage, setImage } from '@/genui/images';
import { proxiedPlacePhotoUrl } from '@/services/placePhoto';
import { computeReachRing } from './targeting';
import type { LatLng, MarkerSpec, PolygonSpec, TravelMode } from '@/lib/types';
import { adstudio, type Creative } from './store';
import { MAX_CREATIVES_PER_SESSION } from './limits';
import { missionStore } from '@/mission/store';

const ACCENT = '#a78bfa';
const HERO_MARKER_ID = 'adstudio-hero';
const REACH_RING_ID = 'adstudio-reach-ring';
const MAX_STYLES_PER_CALL = 3;

function heroMarker(loc: LatLng, title: string, placeId: string): MarkerSpec {
  return {
    id: HERO_MARKER_ID,
    position: loc,
    title,
    glyph: '★',
    color: ACCENT,
    kind: 'pin',
    placeId,
    scenario: 'adstudio',
  };
}

function reachPolygon(path: LatLng[]): PolygonSpec {
  return { id: REACH_RING_ID, path, fill: ACCENT, stroke: ACCENT, opacity: 0.12, scenario: 'adstudio' };
}

/** Re-paint the hero marker + reach ring after a scenario re-entry (map was cleared on exit). */
export function redrawCampaign(): void {
  const s = adstudio();
  const map = atlas();
  const markers: MarkerSpec[] = [];
  if (s.business) markers.push(heroMarker(s.business.location, s.business.name, s.business.id));
  if (markers.length) map.setMarkers(markers);
  if (s.targeting) map.setPolygons([reachPolygon(s.targeting.ringPath)]);
}

export interface SetBusinessResult {
  ok: boolean;
  error?: string;
  name?: string;
  address?: string;
  location?: LatLng;
  rating?: number;
  userRatingCount?: number;
}

/** Pick the real business this campaign is for. Resets any prior campaign state. */
export async function setCampaignBusiness(placeId: string, brief?: string): Promise<SetBusinessResult> {
  let detail;
  try {
    detail = await placeDetails(placeId);
  } catch {
    return { ok: false, error: 'Could not fetch place details for that placeId.' };
  }

  adstudio().reset();
  adstudio().setBusiness(detail, brief);

  const map = atlas();
  map.setMarkers([heroMarker(detail.location, detail.name, detail.id)]);
  map.setCamera({ kind: 'fly', center: detail.location, zoom: 16.5 });

  return {
    ok: true,
    name: detail.name,
    address: detail.formattedAddress,
    location: detail.location,
    rating: detail.rating,
    userRatingCount: detail.userRatingCount,
  };
}

export interface GatherFactsResult {
  ok: boolean;
  error?: string;
  business?: { name: string; address?: string; rating?: number; userRatingCount?: number };
  vibe?: string;
  grounded?: boolean;
  weather?: { tempC?: number; condition?: string };
  airQuality?: { aqi?: number; category?: string };
  hasStreetViewPhoto?: boolean;
  hasPlacesPhoto?: boolean;
  note?: string;
}

/** Gather grounded truth about the chosen business (Maps grounding, environment, real photo). */
export async function gatherCampaignFacts(): Promise<GatherFactsResult> {
  const business = adstudio().business;
  if (!business) return { ok: false, error: 'Call set_campaign_business first.' };

  adstudio().setGatheringFacts(true);
  const loc = business.location;
  const question = `What grounded atmosphere and nearby draws are available around ${business.name}, ${business.formattedAddress ?? ''}? Do not claim measured foot traffic.`;

  const [groundedRes, env, hasPano] = await Promise.all([
    askMaps(question, loc).catch(() => ({ text: '', widgetContextToken: undefined })),
    environmentSnapshot(loc).catch(() => undefined),
    hasStreetView(loc).catch(() => false),
  ]);

  if (groundedRes.widgetContextToken) {
    atlas().addMsg({
      id: uid('w'),
      role: 'widget',
      widgetContextToken: groundedRes.widgetContextToken,
      ts: Date.now(),
    });
  }

  const svUrl = hasPano ? streetViewUrl(loc, { w: 640, h: 400 }) : undefined;

  // Warm the conditioning-image fetch now (the URL is known here) so
  // generateAdCreatives doesn't serially block on the up-to-8s fetch later.
  const conditioningUrl = svUrl ?? proxiedPlacePhotoUrl(business.photoUri);
  if (conditioningUrl) void prefetchAdConditioningImage(conditioningUrl);

  adstudio().setFacts({
    grounding: groundedRes.text,
    widgetToken: groundedRes.widgetContextToken,
    env,
    streetViewUrl: svUrl,
    photoUri: business.photoUri,
    vibe: groundedRes.text,
  });
  adstudio().setGatheringFacts(false);

  return {
    ok: true,
    business: {
      name: business.name,
      address: business.formattedAddress,
      rating: business.rating,
      userRatingCount: business.userRatingCount,
    },
    vibe: groundedRes.text,
    grounded: !!groundedRes.widgetContextToken,
    weather: env?.weather && { tempC: env.weather.tempC, condition: env.weather.condition },
    airQuality: env?.air && { aqi: env.air.aqi, category: env.air.category },
    hasStreetViewPhoto: !!svUrl,
    hasPlacesPhoto: !!business.photoUri,
    note: 'Use ONLY these facts (and the business facts above) when writing ad copy — never invent ratings, distances, foot-traffic numbers or awards.',
  };
}

export interface GenerateCreativesResult {
  ok: boolean;
  error?: string;
  creatives?: Pick<Creative, 'id' | 'imageRef' | 'headline' | 'body' | 'cta' | 'style' | 'format' | 'status' | 'conditioning'>[];
}

/** Generate up to MAX_STYLES_PER_CALL creatives, conditioned on the real Street View/Places photo. */
export async function generateAdCreatives(
  styles: string[],
  format: AdFormat = 'square',
  copy?: AdCopyHints,
): Promise<GenerateCreativesResult> {
  const s = adstudio();
  const business = s.business;
  if (!business) return { ok: false, error: 'Call set_campaign_business first.' };

  const requested = styles.filter((x) => x && x.trim()).slice(0, MAX_STYLES_PER_CALL);
  if (!requested.length) return { ok: false, error: 'Provide at least one creative style.' };

  const already = s.creatives.length;
  if (already >= MAX_CREATIVES_PER_SESSION) {
    return {
      ok: false,
      error: `Session creative cap reached (${MAX_CREATIVES_PER_SESSION}). Remix an existing creative instead of generating new ones.`,
    };
  }
  const allowedStyles = requested.slice(0, MAX_CREATIVES_PER_SESSION - already);
  const conditioningUrl = s.facts.streetViewUrl ?? proxiedPlacePhotoUrl(s.facts.photoUri);
  const jobs = allowedStyles.map((style) => {
    const id = uid('creative');
    // Reserve the image ref up front so this call returns a real ref the model
    // can drop straight into an AdCreative surface; the background job fills it
    // via setImage and the card renders the image live once it lands.
    const placeholder: Creative = {
      id,
      imageRef: reserveImage(),
      headline: copy?.headline ?? business.name,
      body: copy?.body ?? '',
      cta: copy?.cta ?? 'Learn more',
      style,
      format,
      status: 'generating',
      conditioning: 'image',
      stage: 'prompting',
      startedAt: Date.now(),
    };
    adstudio().addCreative(placeholder);
    return { id, prompt: adPrompt(business, s.facts, style, format, copy) };
  });
  const jobIds = jobs.map((j) => j.id);

  // Do not hand image refs to A2UI until generation has settled. The copilot's
  // progress panel remains visible during this wait, then composes a complete
  // card instead of an orphaned empty poster.
  const conditioningImage = conditioningUrl
    ? await prepareAdConditioningImage(conditioningUrl).catch(() => null)
    : null;
  let sawRateLimit = false;
  const onError = (kind: AiFailureKind) => {
    if (kind === 'rate-limited') sawRateLimit = true;
  };
  await Promise.all(jobs.map(({ id, prompt }) => runCreativeJob(id, prompt, conditioningImage, onError)));

  const created = adstudio().creatives.filter((c) => jobIds.includes(c.id) && c.status === 'ready');
  if (!created.length) {
    // Make a whole-batch image failure visible to the user (not just the model).
    // A 429 is a rate limit (wait/retry, or raise AI_RATE_LIMIT), NOT a key/quota
    // fault — surface the accurate cause so it isn't misdiagnosed.
    atlas().pushToast(
      'bad',
      sawRateLimit
        ? 'Ad image generation is rate-limited right now — wait a minute and retry (raise AI_RATE_LIMIT for heavier demos).'
        : 'Ad image generation failed — check the image model quota/key, then retry.',
    );
    return { ok: false, error: 'Creative image generation failed. Retry the creative.' };
  }
  return {
    ok: true,
    creatives: created.map((c) => ({
      id: c.id,
      imageRef: c.imageRef,
      headline: c.headline,
      body: c.body,
      cta: c.cta,
      style: c.style,
      format: c.format,
      status: c.status,
      conditioning: c.conditioning,
    })),
  };
}

/** Run a single creative image job, driving staged status updates on the store. */
async function runCreativeJob(
  id: string,
  prompt: string,
  conditioningImage: InlineImageData | null,
  onError?: (kind: AiFailureKind) => void,
): Promise<void> {
  try {
    adstudio().updateCreative(id, { stage: 'rendering' });
    const raw = await generateAdImage(
      prompt,
      conditioningImage,
      () => {
        adstudio().updateCreative(id, { stage: 'fallback' });
      },
      onError,
    );
    if (!raw) {
      adstudio().updateCreative(id, { status: 'error', stage: undefined });
      return;
    }
    adstudio().updateCreative(id, { stage: 'finalizing' });
    const shrunk = await shrinkImage(raw.dataUrl, 1024);
    // Fill the pre-reserved ref (set image before flipping status → ready so any
    // consumer re-rendering on the status change already resolves the data URL).
    const ref = adstudio().creatives.find((c) => c.id === id)?.imageRef;
    if (ref) setImage(ref, shrunk);
    adstudio().updateCreative(id, {
      status: 'ready',
      conditioning: raw.usedConditioning ? 'image' : 'text-only',
      stage: undefined,
    });
    if (missionStore().mission.status === 'creating') {
      const artifactId = `campaign-${id}`;
      missionStore().addArtifact({ id: artifactId, kind: 'campaign', label: 'Grounded campaign creative', ref });
      missionStore().transition({ type: 'complete', campaignArtifactId: artifactId });
    }
  } catch {
    adstudio().updateCreative(id, { status: 'error', stage: undefined });
  }
}

/** Re-run generation for a single existing creative (wired to the board's Retry button). */
export async function retryCreative(id: string): Promise<void> {
  const s = adstudio();
  const business = s.business;
  const creative = s.creatives.find((c) => c.id === id);
  if (!business || !creative) return;

  // Keep the existing (reserved) imageRef so a card already rendered in an A2UI
  // surface fills in when this retry succeeds; runCreativeJob refills the ref.
  adstudio().updateCreative(id, {
    status: 'generating',
    stage: 'prompting',
    startedAt: Date.now(),
  });

  const conditioningUrl = s.facts.streetViewUrl ?? proxiedPlacePhotoUrl(s.facts.photoUri);
  const conditioningImage = conditioningUrl
    ? await prepareAdConditioningImage(conditioningUrl).catch(() => null)
    : null;
  const prompt = adPrompt(business, s.facts, creative.style, creative.format, {
    headline: creative.headline,
    body: creative.body,
    cta: creative.cta,
  });
  await runCreativeJob(id, prompt, conditioningImage, (kind) => {
    if (kind === 'rate-limited') {
      atlas().pushToast(
        'bad',
        'Ad image generation is rate-limited right now — wait a minute and retry (raise AI_RATE_LIMIT for heavier demos).',
      );
    }
  });
}

export interface SetTargetingResult {
  ok: boolean;
  error?: string;
  ringPoints?: number;
  reachSummary?: string;
  minutes?: number;
  travelMode?: TravelMode;
}

/** Draw a drive/walk/bike-time geo-targeting ring around the business. */
export async function setGeoTargeting(minutes: number, travelMode: TravelMode): Promise<SetTargetingResult> {
  const business = adstudio().business;
  if (!business) return { ok: false, error: 'Call set_campaign_business first.' };

  const clamped = Math.max(5, Math.min(30, Math.round(minutes) || 15));
  const { ringPath, reachSummary } = await computeReachRing(business.location, clamped, travelMode);

  const map = atlas();
  map.setPolygons([reachPolygon(ringPath)]);
  map.setCamera({ kind: 'fit', bounds: ringPath });

  adstudio().setTargeting({ minutes: clamped, travelMode, ringPath, reachSummary });
  if (missionStore().mission.status === 'creating') {
    missionStore().addArtifact({ id: 'mission-route-reach', kind: 'route-reach', label: reachSummary });
  }

  return { ok: true, ringPoints: ringPath.length, reachSummary, minutes: clamped, travelMode };
}

export interface ExportCampaignResult {
  ok: boolean;
  error?: string;
  summary?: {
    business: { name: string; address?: string; rating?: number };
    creatives: { id: string; imageRef: string; headline: string }[];
    targeting?: { minutes: number; travelMode: TravelMode; reachSummary: string; center: LatLng };
    disclaimer: string;
  };
  instructions?: string;
}

/** Finalize the campaign: returns everything the model needs to compose the export surface. */
export function exportCampaign(): ExportCampaignResult {
  const s = adstudio();
  if (!s.business) return { ok: false, error: 'No campaign to export yet — pick a business first.' };

  adstudio().setExporting(true);
  const readyCreatives = s.creatives.filter((c) => c.status === 'ready');

  return {
    ok: true,
    summary: {
      business: { name: s.business.name, address: s.business.formattedAddress, rating: s.business.rating },
      creatives: readyCreatives.map((c) => ({ id: c.id, imageRef: c.imageRef, headline: c.headline })),
      targeting: s.targeting
        ? {
            minutes: s.targeting.minutes,
            travelMode: s.targeting.travelMode,
            reachSummary: s.targeting.reachSummary,
            center: s.business.location,
          }
        : undefined,
      disclaimer: 'Concept — verify claims before publishing.',
    },
    instructions:
      'Call render_surface to compose the export surface: a StatGrid of the business facts, an AdCreative ' +
      'carousel using these creatives (imageRef/headline), a MapPreview centered on the targeting ring (if any), ' +
      'and a short Text list of the grounded claims actually used. Then call show_notice with title "Campaign ' +
      'export ready" and body starting with "Concept — verify claims before publishing."',
  };
}
