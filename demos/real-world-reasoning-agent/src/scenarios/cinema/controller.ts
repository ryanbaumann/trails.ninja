import { atlas } from '@/state/store';
import { genai } from '@/ai/client';
import { MODELS, getThinkingConfig, VIDEO_GEN_ENABLED } from '@/lib/config';
import { enqueueSpeech, stopSpeech, whenQueueDrained } from '@/ai/tts';
import { searchText } from '@/services/places';
import { streetViewHeadingUrl } from '@/services/streetview';
import { fetchImageBase64 } from '@/ai/vision';
import { generateVideo } from '@/ai/video';
import { buildTourVideoPrompt } from '@/ai/videoPrompt';
import type { MarkerSpec } from '@/lib/types';
import { cinema } from './store';
import { TOUR_BY_ID, type TourStop } from './tours';

const ACCENT = '#f472b6';
const FLY_MS = 3500; // fly-in duration; speech is gated until the camera arrives
let token = 0; // bumps on any control change to interrupt the async player

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function currentTour() {
  const id = cinema().tourId;
  return id ? TOUR_BY_ID[id] : undefined;
}

function dropStopPin(stop: TourStop) {
  const marker: MarkerSpec = {
    id: 'cinema-stop',
    position: stop.center,
    title: stop.name,
    glyph: '★',
    color: ACCENT,
    kind: 'pin',
    scenario: 'cinema',
  };
  atlas().setMarkers([marker]);
}

/**
 * Fetch real facts, have Gemini write a tight 2-sentence story, and speak it.
 *
 * *Speech* is gated behind `arrived` (resolved once the camera settles on the
 * stop) so narration describes what is already on screen instead of a place
 * still flying into view. When `arrived` is omitted, speech starts as soon as
 * text is ready (legacy path).
 */
export async function narrateStop(name: string, near?: TourStop, arrived?: Promise<void>): Promise<string> {
  const mine = token;

  let text = '';
  let spoken = '';

  // Speech gating: hand `arrived` to the speech queue as a *playback* gate rather
  // than buffering the text here. Synthesis then runs while the camera is still
  // flying, so the voice starts the moment the camera settles instead of a full
  // TTS round-trip after it — the audio is already decoded and waiting.
  const speak = (chunk: string) => {
    if (!chunk || mine !== token || cinema().muted) return;
    enqueueSpeech(chunk, 'Kore', { scenario: 'cinema', ...(arrived ? { after: arrived } : {}) });
  };

  let facts = '';
  try {
    const places = await searchText(near?.query ?? name, {
      near: near?.center,
      maxResults: 1,
    });
    const p = places[0];
    if (p) {
      facts = JSON.stringify({
        name: p.name,
        rating: p.rating,
        summary: p.editorialSummary,
        types: p.primaryType,
        address: p.formattedAddress,
      });
    }
  } catch {
    /* narrate from the name alone */
  }

  try {
    const thinkingConfig = getThinkingConfig(MODELS.utility, 'simpleUi');
    const stream = await genai().models.generateContentStream({
      model: MODELS.utility,
      contents:
        `You are a cinematic aerial-tour narrator. In exactly one or two concise, direct sentences, tell the ` +
        `story of "${name}" as the camera soars over it. Keep it engaging yet factual, avoiding overly flowery or wordy language. No lists, no preamble.` +
        (facts ? `\nGrounded facts you may use: ${facts}` : ''),
      config: {
        ...(thinkingConfig ? { thinkingConfig } : {}),
      },
    });
    for await (const chunk of stream) {
      if (mine !== token) return text;
      const delta = chunk.text ?? '';
      if (!delta) continue;
      text += delta;
      const ready = text.match(/^(.*?[.!?])(?:\s|$)/s)?.[1];
      if (ready && ready.length > spoken.length + 24) {
        const next = ready.slice(spoken.length).trim();
        spoken = ready;
        speak(next);
      }
    }
  } catch {
    text = '';
  }
  text = text.trim();
  if (mine !== token) return text;

  if (text) {
    cinema().appendTranscript({ stopName: name, text });
    const remainder = text.slice(spoken.length).trim();
    speak(remainder);
  }
  return text;
}

/** Fly to a stop, orbit it, and narrate — then auto-advance if still playing. */
async function goToStop(i: number): Promise<void> {
  const tour = currentTour();
  if (!tour) return;
  const stop = tour.stops[i];
  if (!stop) return;
  const mine = ++token;
  stopSpeech(); // silence the prior stop's audio immediately on any transition

  cinema().setStopIndex(i);
  dropStopPin(stop);
  atlas().setCamera({
    kind: 'fly3d',
    center: { ...stop.center, altitude: stop.altitude },
    range: stop.range,
    heading: stop.heading,
    tilt: stop.tilt,
    durationMs: FLY_MS,
  });

  // Narration text streams right away, but the spoken audio is held until the
  // camera has actually reached the stop (end of the fly-in) so audio matches the view.
  const arrived = wait(FLY_MS);
  const narration = narrateStop(stop.name, stop, arrived);

  await wait(1200);
  if (mine !== token) return;

  atlas().setCamera({
    kind: 'orbit3d',
    center: { ...stop.center, altitude: stop.altitude },
    range: Math.round(stop.range * 0.85),
    tilt: stop.tilt,
    repeatCount: 1,
    durationMs: 18000,
  });

  await narration;
  if (mine !== token) return;

  // Text streaming is done, but the audio may still be synthesizing/playing.
  // Wait for the camera to have arrived (so buffered speech is enqueued), then
  // for the queue to actually drain, so we never fly to the next stop while this
  // stop is still talking. Both awaits unblock immediately on interrupt.
  await arrived;
  if (mine !== token) return;
  await whenQueueDrained();
  if (mine !== token) return;

  await wait(1800);
  if (mine !== token) return;

  if (cinema().playing) {
    const next = i + 1;
    if (next < tour.stops.length) void goToStop(next);
    else cinema().setPlaying(false);
  }
}

export function startTour(id: string): { ok: boolean; title?: string } {
  const tour = TOUR_BY_ID[id];
  if (!tour) return { ok: false };
  cinema().setTour(id);
  cinema().setPlaying(true);
  void goToStop(0);
  return { ok: true, title: tour.title };
}

export function tourControl(op: 'play' | 'pause' | 'next' | 'prev' | 'exit'): { ok: boolean } {
  const tour = currentTour();
  const i = cinema().stopIndex;
  switch (op) {
    case 'pause':
      token++; // stop the auto-advance chain
      cinema().setPlaying(false);
      stopSpeech();
      atlas().setCamera({ kind: 'stop3d' });
      break;
    case 'play':
      cinema().setPlaying(true);
      void goToStop(Math.max(0, i));
      break;
    case 'next':
      if (tour && i < tour.stops.length - 1) {
        stopSpeech(); // silence the current stop before jumping
        void goToStop(i + 1);
      }
      break;
    case 'prev':
      if (tour && i > 0) {
        stopSpeech(); // silence the current stop before jumping
        void goToStop(i - 1);
      }
      break;
    case 'exit':
      exitCinema();
      break;
  }
  return { ok: true };
}

export function setMuted(muted: boolean): void {
  cinema().setMuted(muted);
  if (muted) stopSpeech();
}

export function exitCinema(): void {
  token++;
  stopSpeech();
  atlas().setCamera({ kind: 'stop3d' });
  cinema().reset();
}

/**
 * Seed omni with the current stop's Street View still and generate a short
 * cinematic flythrough, driving the `video` slice through loading → ready/error.
 * Gated by `VIDEO_GEN_ENABLED`; inert otherwise.
 */
export async function generateTourVideo(): Promise<{ ok: boolean; error?: string }> {
  if (!VIDEO_GEN_ENABLED) {
    const error = 'Video generation is disabled.';
    cinema().setVideo({ status: 'error', error });
    return { ok: false, error };
  }

  const tour = currentTour();
  const stop = tour?.stops[cinema().stopIndex] ?? tour?.stops[0];
  if (!tour || !stop) {
    const error = 'Start a tour first to generate a video.';
    cinema().setVideo({ status: 'error', error });
    return { ok: false, error };
  }

  const stopName = stop.name;
  cinema().setVideo({ status: 'loading', stopName });

  try {
    const url = streetViewHeadingUrl(stop.center, stop.heading);
    const seed = await fetchImageBase64(url);
    if (!seed) {
      const error = 'Could not load a Street View frame for this stop.';
      cinema().setVideo({ status: 'error', stopName, error });
      return { ok: false, error };
    }

    const { dataUrl } = await generateVideo({
      imageBase64: seed.data,
      imageMimeType: seed.mimeType,
      prompt: buildTourVideoPrompt(stopName),
      task: 'image_to_video',
    });
    cinema().setVideo({ status: 'ready', url: dataUrl, stopName });
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    cinema().setVideo({ status: 'error', stopName, error });
    return { ok: false, error };
  }
}
