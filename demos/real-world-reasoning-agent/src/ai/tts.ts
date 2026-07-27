import { genai } from './client';
import { MODELS } from '@/lib/config';
import { atlas } from '@/state/store';
import type { ScenarioId } from '@/lib/types';

/** Options for a speak call. `scenario` scopes audio to that journey: a call
 *  tagged with a journey is dropped the moment another journey is active, so a
 *  late-resolving narration never bleeds onto the screen the user switched to. */
export interface SpeakOptions {
  scenario?: ScenarioId;
  /**
   * Gate that must resolve before this chunk is *played*. Synthesis still starts
   * immediately, so the audio is already decoded and waiting when the gate opens.
   *
   * Cinema uses it to hold narration until the camera has settled on the stop, so
   * the voice describes what is on screen. Buffering the raw text until then
   * instead meant paying the whole synthesis round-trip after arrival.
   */
  after?: Promise<unknown>;
}

/** True when this speech no longer belongs on screen (its journey isn't active). */
function outOfScope(opts?: SpeakOptions): boolean {
  return !!opts?.scenario && atlas().activeScenario !== opts.scenario;
}

/**
 * Text-to-speech via the Gemini TTS preview model. Returns 24 kHz mono 16-bit
 * PCM (base64) which we decode into a WebAudio buffer and play through a single
 * shared queue. Used by Cinema narration and "read it aloud" affordances.
 */

let ctx: AudioContext | null = null;
let queue: Promise<void> = Promise.resolve();
let generation = 0; // bumps on stop() to invalidate in-flight synthesis

/**
 * Coalesce arriving PCM into segments of at least this much audio before
 * scheduling. The model emits ~40ms frames; batching them keeps the node count in
 * the tens rather than the hundreds and buys a small jitter buffer for free.
 */
const SEGMENT_SECONDS = 0.25;
/** Schedule a hair ahead of the clock so a segment is never queued in the past. */
const SCHEDULE_LEAD_SECONDS = 0.08;

/** AudioContext time at which the next segment should start — the gapless cursor. */
let playCursor = 0;
/** Every source currently scheduled or sounding, so stopSpeech can silence all of them. */
const scheduled = new Set<AudioBufferSourceNode>();
/** Woken by stopSpeech so waiters never strand when playback is abandoned. */
const stopWaiters = new Set<() => void>();

export type SpeechStatus = 'idle' | 'playing' | 'paused';

let status: SpeechStatus = 'idle';
let activeCount = 0; // number of speakQueued calls currently doing work
const listeners = new Set<() => void>();

function setStatus(next: SpeechStatus): void {
  if (status === next) return;
  status = next;
  for (const fn of listeners) fn();
}

/** Current global speech status, for UI that wants to show pause/resume affordances. */
export function speechStatus(): SpeechStatus {
  return status;
}

/** Subscribe to speech status changes. Returns an unsubscribe function. */
export function subscribeSpeech(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function audioCtx(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  return ctx;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** 16-bit signed PCM little-endian → AudioBuffer at the given sample rate. */
function pcmToBuffer(bytes: Uint8Array, sampleRate = 24000): AudioBuffer {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const frames = Math.floor(bytes.byteLength / 2);
  const buf = audioCtx().createBuffer(1, frames, sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) ch[i] = view.getInt16(i * 2, true) / 32768;
  return buf;
}

/** Some responses carry the rate in the mime type (e.g. audio/L16;rate=24000). */
function rateFromMime(mime?: string): number {
  const m = mime?.match(/rate=(\d+)/);
  return m ? Number(m[1]) : 24000;
}

export function stopSpeech(): void {
  generation++;
  queue = Promise.resolve();
  // A streamed utterance is many scheduled segments, most of which have not begun
  // sounding yet. Stopping only the audible one would let the rest play on.
  for (const src of scheduled) {
    try {
      src.stop();
    } catch {
      /* already stopped */
    }
  }
  scheduled.clear();
  playCursor = 0;
  for (const wake of [...stopWaiters]) wake();
  stopWaiters.clear();
  if (ctx && ctx.state === 'suspended') void ctx.resume();
  setStatus('idle');
}

/** Suspend audio playback in place (does not clear the queue). No-op unless currently playing. */
export async function pauseSpeech(): Promise<void> {
  if (status === 'playing' && ctx) {
    await ctx.suspend();
    setStatus('paused');
  }
}

/** Resume audio playback after pauseSpeech(). No-op unless currently paused. */
export async function resumeSpeech(): Promise<void> {
  if (status === 'paused' && ctx) {
    await ctx.resume();
    setStatus('playing');
  }
}

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && !!(window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);
}

/**
 * Synthesize and play `text`. Resolves when playback ends (or immediately if a
 * newer request superseded this one). Never throws — TTS is a nice-to-have.
 */
export async function speak(text: string, voice = 'Kore', opts?: SpeakOptions): Promise<void> {
  stopSpeech();
  return speakQueued(text, voice, opts);
}

/**
 * One synthesis in flight. Segments are appended as PCM streams in; the player
 * consumes them from `next` and blocks on `wake` when it has caught up.
 */
interface PendingSpeech {
  segments: AudioBuffer[];
  next: number;
  done: boolean;
  wake: (() => void) | null;
}

function newPending(): PendingSpeech {
  return { segments: [], next: 0, done: false, wake: null };
}

function announce(p: PendingSpeech): void {
  const wake = p.wake;
  p.wake = null;
  wake?.();
}

/**
 * Stream synthesis of `text`, appending decoded segments to `p` as they arrive.
 *
 * This is the whole point of streaming: `generateContent` returns nothing until
 * the entire clip is synthesized (measured ~9.8s for ~10s of narration), whereas
 * the first streamed frame lands in ~1.2s. Playback can therefore start while the
 * rest of the sentence is still being generated.
 *
 * Never throws — narration is optional and the captions always carry the text.
 */
async function synthesizeInto(
  p: PendingSpeech,
  text: string,
  voice: string,
  mine: number,
  opts?: SpeakOptions,
): Promise<void> {
  try {
    const stream = await genai().models.generateContentStream({
      model: MODELS.tts,
      contents: text,
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        // NOTE: no thinkingConfig here — the TTS model rejects a thinking config
        // with a 400, and synthesis has no reasoning phase to tune anyway.
      },
    });

    let carry = new Uint8Array(0);
    let rate = 24000;
    for await (const chunk of stream) {
      if (mine !== generation || outOfScope(opts)) return; // stopped/superseded/left the page
      const part = chunk.candidates?.[0]?.content?.parts?.find((item) => item.inlineData?.data);
      const data = part?.inlineData?.data;
      if (!data) continue;
      rate = rateFromMime(part?.inlineData?.mimeType);

      const incoming = b64ToBytes(data);
      const merged = new Uint8Array(carry.byteLength + incoming.byteLength);
      merged.set(carry);
      merged.set(incoming, carry.byteLength);
      carry = merged;

      // Emit whole segments only, and never split a 16-bit sample across one.
      const target = Math.ceil(rate * SEGMENT_SECONDS) * 2;
      if (carry.byteLength >= target) {
        const cut = carry.byteLength - (carry.byteLength % 2);
        p.segments.push(pcmToBuffer(carry.subarray(0, cut), rate));
        carry = carry.slice(cut);
        announce(p);
      }
    }
    if (carry.byteLength >= 2 && mine === generation && !outOfScope(opts)) {
      p.segments.push(pcmToBuffer(carry.subarray(0, carry.byteLength - (carry.byteLength % 2)), rate));
    }
  } catch {
    /* swallow — narration is optional, captions always carry the text */
  } finally {
    p.done = true;
    announce(p);
  }
}

/** Schedule one segment on the gapless cursor. Returns the node so callers can await its end. */
function scheduleSegment(buffer: AudioBuffer): AudioBufferSourceNode {
  const context = audioCtx();
  const startAt = Math.max(playCursor, context.currentTime + SCHEDULE_LEAD_SECONDS);
  const src = context.createBufferSource();
  src.buffer = buffer;
  src.connect(context.destination);
  src.onended = () => {
    scheduled.delete(src);
  };
  scheduled.add(src);
  src.start(startAt);
  playCursor = startAt + buffer.duration;
  return src;
}

/**
 * Play everything `p` produces, scheduling segments the moment they exist and
 * waiting for more until synthesis reports done. Resolves once the final segment
 * has actually finished sounding, so queued callers pace to audio, not to text.
 */
async function playPending(p: PendingSpeech, mine: number, opts?: SpeakOptions): Promise<void> {
  await audioCtx().resume();
  if (mine !== generation || outOfScope(opts)) return;
  // Never inherit a cursor left in the past by audio that already finished.
  playCursor = Math.max(playCursor, audioCtx().currentTime);

  let last: AudioBufferSourceNode | null = null;
  for (;;) {
    if (mine !== generation || outOfScope(opts)) return;
    if (p.next < p.segments.length) {
      last = scheduleSegment(p.segments[p.next++]);
      continue;
    }
    if (p.done) break;
    // Wait for the next segment, but also register with stopWaiters so an abandoned
    // utterance cannot strand this loop (and the queue behind it) forever.
    let release: () => void = () => undefined;
    await new Promise<void>((resolve) => {
      release = resolve;
      p.wake = resolve;
      stopWaiters.add(resolve);
    });
    stopWaiters.delete(release);
  }

  if (!last || mine !== generation) return;
  const tail = last;
  await new Promise<void>((resolve) => {
    if (!scheduled.has(tail)) return resolve(); // already finished
    const previous = tail.onended;
    tail.onended = function (this: AudioScheduledSourceNode, event: Event) {
      (previous as ((this: AudioScheduledSourceNode, ev: Event) => void) | null)?.call(this, event);
      resolve();
    };
    stopWaiters.add(resolve);
  });
}

export async function speakQueued(text: string, voice = 'Kore', opts?: SpeakOptions): Promise<void> {
  if (!isSpeechSupported() || !text.trim() || outOfScope(opts)) return;
  const mine = generation;
  activeCount++;
  setStatus('playing');
  try {
    const pending = newPending();
    const synthesis = synthesizeInto(pending, text, voice, mine, opts);
    await playPending(pending, mine, opts);
    await synthesis;
  } finally {
    activeCount--;
    if (activeCount === 0 && status !== 'paused') setStatus('idle');
  }
}

/**
 * Queue `text` behind any already-queued speech. Returns a promise that resolves
 * once this chunk has finished *playing* (or immediately if a newer request
 * superseded it), so callers can pace themselves to actual audio, not just to
 * text streaming.
 *
 * Synthesis starts IMMEDIATELY; only playback is serialized. This used to chain
 * `speakQueued` — which synthesizes *and* plays — onto the queue, so the request
 * for sentence 2 was not even sent until sentence 1 had finished playing. Every
 * sentence therefore cost a full TTS round-trip of silence, and the gap between
 * the caption on screen and the voice grew with each one. Cinema streams
 * narration a sentence at a time and buffers chunks until the camera arrives,
 * then flushes them together, which is exactly the pattern that turned one
 * round-trip of latency into ~20s of it.
 *
 * Fan-out is bounded by how many chunks a caller enqueues before the first
 * finishes — one or two sentences per tour stop in practice, so this pipelines
 * without needing a semaphore.
 */
export function enqueueSpeech(text: string, voice = 'Kore', opts?: SpeakOptions): Promise<void> {
  const mine = generation;
  if (!isSpeechSupported() || !text.trim() || outOfScope(opts)) return queue;
  activeCount++;
  setStatus('playing');
  // Kick synthesis off now, in parallel with whatever is still playing. Attach a
  // catch so an early rejection can never surface as an unhandled rejection while
  // the segments wait their turn — synthesizeInto already swallows, belt-and-braces.
  const pending = newPending();
  const synthesis = synthesizeInto(pending, text, voice, mine, opts).catch(() => undefined);
  queue = queue.then(async () => {
    try {
      if (mine !== generation || outOfScope(opts)) return;
      // Hold playback (not synthesis) until the caller's gate opens.
      if (opts?.after) await opts.after.catch(() => undefined);
      if (mine !== generation || outOfScope(opts)) return;
      await playPending(pending, mine, opts);
      await synthesis;
    } finally {
      activeCount--;
      if (activeCount === 0 && status !== 'paused') setStatus('idle');
    }
  });
  return queue;
}

/**
 * Resolves once everything currently queued has finished playing. Because
 * `stopSpeech()` resets the queue to a resolved promise, an awaited drain also
 * unblocks immediately when playback is interrupted — keeping callers responsive
 * to pause/next/prev.
 */
export function whenQueueDrained(): Promise<void> {
  return queue;
}
