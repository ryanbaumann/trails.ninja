import { describe, expect, it } from 'vitest';
import { isVoiceInputSupported, normalizeAudioMime } from './stt';

describe('normalizeAudioMime', () => {
  it('strips codec parameters to the bare Gemini mime type', () => {
    expect(normalizeAudioMime('audio/webm;codecs=opus')).toBe('audio/webm');
    expect(normalizeAudioMime('audio/ogg; codecs=opus')).toBe('audio/ogg');
  });

  it('passes through a bare mime type unchanged', () => {
    expect(normalizeAudioMime('audio/mp4')).toBe('audio/mp4');
  });

  it('falls back to audio/webm for an empty or missing type', () => {
    expect(normalizeAudioMime('')).toBe('audio/webm');
    expect(normalizeAudioMime(undefined as unknown as string)).toBe('audio/webm');
  });
});

describe('isVoiceInputSupported', () => {
  it('returns a boolean without throwing in a DOM-less/limited environment', () => {
    expect(typeof isVoiceInputSupported()).toBe('boolean');
  });
});
