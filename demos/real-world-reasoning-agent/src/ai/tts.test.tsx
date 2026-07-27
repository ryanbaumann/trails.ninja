/**
 * The speech queue's job is to pipeline: synthesis for the next chunk must run
 * while the current one is still audible, and playback must still be strictly
 * ordered and gate-able.
 *
 * These tests exist because the queue originally chained synthesis AND playback
 * together, so sentence 2's TTS request was not sent until sentence 1 had
 * finished playing. Every sentence cost a full round-trip of silence and
 * narration drifted far behind its own captions. A "does it eventually speak?"
 * test passes right through that, so the pipelining is asserted directly here as
 * an ordering property.
 *
 * `.tsx` deliberately: that is how this repo routes a test to the jsdom project
 * (see vitest.config.ts). The queue needs a `window` to detect audio support, and
 * the node project runs with `isolate: false`, where stubbing a global would leak
 * into every other node test file.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Resolvable promise handle, so a test can control synthesis timing. */
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const events: string[] = [];
/** Gates keyed by the text being synthesized, so tests can release out of order. */
const synthGates = new Map<string, ReturnType<typeof deferred>>();
/** PCM sample value -> source text, so playback can be labelled with its chunk. */
const codeToText = new Map<number, string>();
let nextCode = 0;

/**
 * How many streamed frames the fake model emits per utterance, and how much audio
 * each carries. 0.25s per frame matches the module's segment target, so one frame
 * becomes one schedulable segment — keeping the arithmetic in these tests obvious.
 */
const FRAMES_PER_UTTERANCE = 3;
const FRAME_SECONDS = 0.25;

/** Per-utterance gates that hold the stream open *after* the Nth frame. */
const frameGates = new Map<string, ReturnType<typeof deferred>>();

/** One 16-bit PCM frame whose every sample encodes `code`, so playback is labellable. */
function frame(code: number): string {
  const samples = Math.ceil(24000 * FRAME_SECONDS);
  const bytes = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) bytes.writeInt16LE(code, i * 2);
  return bytes.toString('base64');
}

const generateContentStream = vi.fn(async ({ contents }: { contents: string }) => {
  events.push(`synth:start:${contents}`);
  const code = ++nextCode;
  codeToText.set(code, contents);
  const gate = synthGates.get(contents);
  const midGate = frameGates.get(contents);
  return (async function* () {
    if (gate) await gate.promise;
    for (let i = 0; i < FRAMES_PER_UTTERANCE; i++) {
      if (i === 1 && midGate) await midGate.promise;
      events.push(`synth:frame:${contents}:${i}`);
      yield {
        candidates: [
          { content: { parts: [{ inlineData: { data: frame(code), mimeType: 'audio/L16;rate=24000' } }] } },
        ],
      };
    }
    events.push(`synth:done:${contents}`);
  })();
});

vi.mock('./client', () => ({ genai: () => ({ models: { generateContentStream } }) }));
vi.mock('@/lib/config', () => ({ MODELS: { tts: 'test-tts' } }));
vi.mock('@/state/store', () => ({ atlas: () => ({ activeScenario: 'cinema' }) }));

/**
 * Minimal WebAudio stub. `start()` decodes the chunk's marker sample back into a
 * label and ends on the next microtask, so ordering is observable without timers.
 */
class FakeAudioContext {
  state = 'running';
  destination = {};
  /** Real AudioContexts advance this; the scheduler does arithmetic on it. */
  currentTime = 0;
  createBuffer(_channels: number, frames: number, sampleRate: number) {
    const data = new Float32Array(frames);
    return { duration: frames / sampleRate, getChannelData: () => data };
  }
  createBufferSource() {
    const node: Record<string, unknown> = {
      buffer: null,
      connect: () => undefined,
      stop: () => undefined,
      onended: null,
      start: () => {
        const buffer = node.buffer as { getChannelData: () => Float32Array };
        const code = Math.round(buffer.getChannelData()[0] * 32768);
        events.push(`play:${codeToText.get(code) ?? `unknown(${code})`}`);
        void Promise.resolve().then(() => (node.onended as (() => void) | null)?.());
      },
    };
    return node;
  }
  resume() {
    return Promise.resolve();
  }
  suspend() {
    return Promise.resolve();
  }
}

/** Distinct utterances in the order their audio was first heard. */
function playbackOrder(): string[] {
  const seen: string[] = [];
  for (const event of events) {
    if (!event.startsWith('play:')) continue;
    const label = event.slice('play:'.length);
    if (seen[seen.length - 1] !== label) seen.push(label);
  }
  return seen;
}

describe('speech queue', () => {
  let tts: typeof import('./tts');

  beforeEach(async () => {
    events.length = 0;
    synthGates.clear();
    codeToText.clear();
    nextCode = 0;
    frameGates.clear();
    generateContentStream.mockClear();
    vi.stubGlobal('AudioContext', FakeAudioContext);
    window.AudioContext = FakeAudioContext as unknown as typeof AudioContext;
    vi.resetModules();
    tts = await import('./tts');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('synthesizes the next chunk while the current one is still playing', async () => {
    // Hold BOTH syntheses open and enqueue both. If synthesis were chained behind
    // playback, chunk two's request could not have been sent yet.
    synthGates.set('one', deferred());
    synthGates.set('two', deferred());

    const first = tts.enqueueSpeech('one');
    const second = tts.enqueueSpeech('two');
    await Promise.resolve();

    expect(generateContentStream).toHaveBeenCalledTimes(2);
    expect(events.filter((e) => e.startsWith('synth:start'))).toEqual(['synth:start:one', 'synth:start:two']);

    synthGates.get('one')!.resolve();
    synthGates.get('two')!.resolve();
    await first;
    await second;
  });

  it('plays in enqueue order even when later synthesis finishes first', async () => {
    synthGates.set('first', deferred());
    const a = tts.enqueueSpeech('first');
    const b = tts.enqueueSpeech('second');

    // 'second' resolves synthesis immediately while 'first' is still pending, so
    // an unordered queue would let it jump the line.
    await Promise.resolve();
    expect(events.some((e) => e.startsWith('play:'))).toBe(false);

    synthGates.get('first')!.resolve();
    await a;
    await b;

    expect(playbackOrder()).toEqual(['first', 'second']);
  });

  it('starts playing before synthesis has finished — the whole point of streaming', async () => {
    // Hold the stream open after its first frame. Non-streaming synthesis could
    // not have produced a single sample of audio at this point; streaming has.
    frameGates.set('long narration', deferred());
    const done = tts.enqueueSpeech('long narration');

    await vi.waitFor(() => expect(events).toContain('play:long narration'));
    expect(events).not.toContain('synth:done:long narration');

    frameGates.get('long narration')!.resolve();
    await done;
    expect(events).toContain('synth:done:long narration');
  });

  it('schedules streamed segments back-to-back on one gapless cursor', async () => {
    await tts.enqueueSpeech('one');
    // Each 0.25s frame becomes its own segment, so a single utterance is played as
    // several scheduled buffers rather than one — they must not overlap or gap.
    const plays = events.filter((e) => e === 'play:one');
    expect(plays.length).toBe(FRAMES_PER_UTTERANCE);
  });

  it('holds playback for an `after` gate without delaying synthesis', async () => {
    const gate = deferred();
    const done = tts.enqueueSpeech('narration', 'Kore', { after: gate.promise });

    // Synthesis must already be finished while the gate is still shut — that is
    // what lets Cinema speak the instant the camera settles.
    await vi.waitFor(() => expect(events).toContain('synth:done:narration'));
    expect(events.some((e) => e.startsWith('play:'))).toBe(false);

    gate.resolve();
    await done;
    expect(events).toContain('play:narration');
  });

  it('drops a chunk whose journey is no longer active', async () => {
    await tts.enqueueSpeech('offscreen', 'Kore', { scenario: 'insight' });
    expect(generateContentStream).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });

  it('reports playing while work is queued and idle once it drains', async () => {
    const done = tts.enqueueSpeech('one');
    expect(tts.speechStatus()).toBe('playing');
    await done;
    await tts.whenQueueDrained();
    expect(tts.speechStatus()).toBe('idle');
  });

  it('stopSpeech abandons queued chunks instead of playing them late', async () => {
    synthGates.set('one', deferred());
    const first = tts.enqueueSpeech('one');
    tts.stopSpeech();
    synthGates.get('one')!.resolve();
    await first;
    expect(events.some((e) => e.startsWith('play:'))).toBe(false);
    expect(tts.speechStatus()).toBe('idle');
  });
});
