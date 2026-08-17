/**
 * Voice input: capture microphone audio in the browser and transcribe it with a
 * low-latency Gemini model. No UI coupling — the CopilotDock drives it through
 * `useVoiceInput`. Transcription runs with LOW thinking (see config) because
 * the model is transcribing, not reasoning, so unnecessary thinking is pure added latency.
 *
 * Compliance/privacy: audio is captured only after the user taps the mic, sent
 * once (inline, base64) through the same-origin /ai proxy, and the microphone
 * track is stopped the moment recording ends — nothing is retained client-side.
 */
import { genai } from './client';
import { getThinkingConfig, MODELS } from '@/lib/config';

/** MediaRecorder container/codecs to try, best first. Opus in WebM/OGG is the
 *  most broadly supported low-bitrate option; mp4/aac covers Safari. We fall back
 *  to the browser default when none report as supported. */
const PREFERRED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
];

const TRANSCRIBE_INSTRUCTION =
  "Transcribe the spoken words in this audio to plain text. Return only the transcript, " +
  'with no preamble, quotation marks, or commentary. If there is no discernible speech, return nothing.';

/** True when the browser can record the mic and we can construct a recorder. */
export function isVoiceInputSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window.MediaRecorder !== 'undefined'
  );
}

/** First preferred MediaRecorder mime type the browser reports it can produce. */
export function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return undefined;
  }
  return PREFERRED_MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
}

/** Gemini wants the bare audio mime type without codec params (e.g. "audio/webm"). */
export function normalizeAudioMime(blobType: string): string {
  const base = (blobType || '').split(';')[0].trim();
  return base || 'audio/webm';
}

/** An in-flight microphone recording. `stop` resolves the captured audio; `cancel`
 *  tears down the mic and discards it. Either one releases the media track. */
export interface VoiceRecording {
  stop(): Promise<Blob>;
  cancel(): void;
}

export interface StartRecordingOptions {
  /** Fires once when the speaker goes quiet after having spoken (end-of-utterance),
   *  so the caller can auto-stop dictation. No-op if Web Audio is unavailable. */
  onSilence?: () => void;
}

/** Prompt for mic access and begin recording. Rejects if permission is denied. */
export async function startRecording(opts: StartRecordingOptions = {}): Promise<VoiceRecording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  recorder.start();

  const stopSilenceWatch = opts.onSilence ? watchForSilence(stream, opts.onSilence) : undefined;
  const release = () => {
    stopSilenceWatch?.();
    stream.getTracks().forEach((t) => t.stop());
  };

  return {
    stop: () =>
      new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          release();
          resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' }));
        };
        recorder.stop();
      }),
    cancel: () => {
      try {
        recorder.stop();
      } catch {
        /* already stopped */
      }
      release();
    },
  };
}

/** RMS above this counts as speech; sustained below it (after speech) is silence. */
const SPEECH_RMS = 0.02;
const SILENCE_RMS = 0.012;
/** How long the mic must stay quiet after speech before we call it end-of-utterance. */
const SILENCE_HANG_MS = 1200;

/**
 * Watch a live mic stream and fire `onSilence` once the speaker finishes talking
 * (a short quiet gap after any detected speech). Uses a Web Audio analyser on the
 * time-domain signal; returns a teardown fn. Degrades to a no-op when AudioContext
 * is unavailable, so tap-to-stop still works.
 */
function watchForSilence(stream: MediaStream, onSilence: () => void): () => void {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return () => {};
  let ctx: AudioContext;
  try {
    ctx = new Ctx();
  } catch {
    return () => {};
  }
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);
  const buf = new Float32Array(analyser.fftSize);

  let speechStarted = false;
  let silentSince = 0;
  let fired = false;
  let raf = 0;

  const tick = () => {
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);
    const now = performance.now();

    if (rms >= SPEECH_RMS) {
      speechStarted = true;
      silentSince = 0;
    } else if (speechStarted && rms < SILENCE_RMS) {
      if (!silentSince) {
        silentSince = now;
      } else if (now - silentSince >= SILENCE_HANG_MS && !fired) {
        fired = true;
        onSilence();
        return; // stop polling; caller tears down via release()
      }
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    try {
      source.disconnect();
    } catch {
      /* already disconnected */
    }
    void ctx.close();
  };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string; // "data:<mime>;base64,<data>"
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Transcribe a captured audio blob to text via the low-latency STT model. Returns
 * the trimmed transcript (possibly empty when no speech was detected). Throws only
 * on network/model failure so the caller can surface a toast.
 */
export async function transcribe(blob: Blob): Promise<string> {
  if (!blob.size) return '';
  const data = await blobToBase64(blob);
  const thinkingConfig = getThinkingConfig(MODELS.stt, 'simpleUi');
  const resp = await genai().models.generateContent({
    model: MODELS.stt,
    contents: [
      { inlineData: { mimeType: normalizeAudioMime(blob.type), data } },
      { text: TRANSCRIBE_INSTRUCTION },
    ],
    config: {
      ...(thinkingConfig ? { thinkingConfig } : {}),
    },
  });
  return (resp.text ?? '').trim();
}
