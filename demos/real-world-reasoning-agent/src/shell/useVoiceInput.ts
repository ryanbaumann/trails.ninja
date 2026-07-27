import { useCallback, useEffect, useRef, useState } from 'react';
import { isVoiceInputSupported, startRecording, transcribe, type VoiceRecording } from '@/ai/stt';
import { atlas } from '@/state/store';

/** idle → recording (mic live) → transcribing (model working) → idle. */
export type VoiceState = 'idle' | 'recording' | 'transcribing';

/** Extra context handed back with a transcript so the caller can decide whether
 *  to auto-send. `autoSubmit` is true when recording stopped on its own because
 *  the speaker went quiet (hands-free dictation), false for a manual tap-to-stop. */
export interface TranscriptMeta {
  autoSubmit: boolean;
}

/**
 * Composer voice input as a small state machine. Tap to record; recording ends
 * either on a second tap or automatically when you stop speaking. The transcript
 * is handed to `onTranscript` — the dock fills the input box, and on the auto
 * (end-of-speech) path also submits it shortly after. Errors degrade to a toast —
 * voice is an accelerator, typing always works.
 */
export function useVoiceInput(onTranscript: (text: string, meta: TranscriptMeta) => void) {
  const supported = isVoiceInputSupported();
  const [state, setState] = useState<VoiceState>('idle');
  const recRef = useRef<VoiceRecording | null>(null);
  // Set when the current stop was triggered by end-of-speech silence rather than
  // a manual tap, so the transcript callback knows to auto-submit.
  const autoStopRef = useRef(false);
  // Latest stop(), so the silence callback captured at start() time can invoke it.
  const stopRef = useRef<() => Promise<void>>(async () => {});
  // Synchronous re-entry guard: `getUserMedia` may sit on a permission prompt, and
  // React batches state, so two rapid taps would both read state==='idle' and each
  // start a MediaRecorder — orphaning the earlier mic stream (mic stays live with
  // no reference to stop it). A ref flips synchronously, so the second tap bails.
  const startingRef = useRef(false);
  const mountedRef = useRef(true);
  const cbRef = useRef(onTranscript);
  cbRef.current = onTranscript;

  // Release the mic if the component unmounts (mid-recording or mid-start).
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      recRef.current?.cancel();
    };
  }, []);

  const start = useCallback(async () => {
    if (startingRef.current || recRef.current) return; // already starting/recording
    startingRef.current = true;
    autoStopRef.current = false;
    try {
      const recording = await startRecording({
        onSilence: () => {
          if (!recRef.current) return; // already stopped/cancelled
          autoStopRef.current = true;
          void stopRef.current();
        },
      });
      // Unmounted or superseded while the permission prompt was open — don't leave
      // the mic live with no way to stop it.
      if (!mountedRef.current) {
        recording.cancel();
        return;
      }
      recRef.current = recording;
      setState('recording');
    } catch {
      recRef.current = null;
      if (mountedRef.current) setState('idle');
      atlas().pushToast('warn', 'Microphone unavailable — check your browser permissions.');
    } finally {
      startingRef.current = false;
    }
  }, []);

  const stop = useCallback(async () => {
    const rec = recRef.current;
    recRef.current = null;
    const autoSubmit = autoStopRef.current;
    autoStopRef.current = false;
    if (!rec) {
      setState('idle');
      return;
    }
    setState('transcribing');
    try {
      const text = await transcribe(await rec.stop());
      if (text) cbRef.current(text, { autoSubmit });
      else atlas().pushToast('info', "Didn't catch that — try speaking again.");
    } catch {
      atlas().pushToast('bad', 'Voice transcription failed — please try again.');
    } finally {
      setState('idle');
    }
  }, []);
  stopRef.current = stop;

  const toggle = useCallback(() => {
    if (state === 'recording') void stop();
    else if (state === 'idle') void start();
    // ignore taps while transcribing
  }, [state, start, stop]);

  return { supported, state, toggle };
}
