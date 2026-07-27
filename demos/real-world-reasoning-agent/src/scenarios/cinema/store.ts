import { create } from 'zustand';

export interface CaptionEntry {
  stopName: string;
  text: string;
}

export interface CinemaState {
  tourId: string | null;
  stopIndex: number;
  playing: boolean;
  muted: boolean;
  transcript: CaptionEntry[]; // now-playing narration log
  video: { status: 'idle' | 'loading' | 'ready' | 'error'; url?: string; stopName?: string; error?: string };

  setTour: (id: string | null) => void;
  setStopIndex: (i: number) => void;
  setPlaying: (b: boolean) => void;
  setMuted: (b: boolean) => void;
  appendTranscript: (entry: CaptionEntry) => void;
  setVideo: (v: CinemaState['video']) => void;
  reset: () => void;
}

export const useCinema = create<CinemaState>((set) => ({
  tourId: null,
  stopIndex: -1,
  playing: false,
  muted: false,
  transcript: [],
  video: { status: 'idle' },

  setTour: (id) => set({ tourId: id }),
  setStopIndex: (i) => set({ stopIndex: i }),
  setPlaying: (b) => set({ playing: b }),
  setMuted: (b) => set({ muted: b }),
  appendTranscript: (entry) => set((s) => ({ transcript: [...s.transcript, entry].slice(-12) })),
  setVideo: (v) => set({ video: v }),
  reset: () => set({ tourId: null, stopIndex: -1, playing: false, transcript: [], video: { status: 'idle' } }),
}));

export const cinema = useCinema.getState;
