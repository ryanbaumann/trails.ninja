import { create } from 'zustand';
import type { PlaceLite, TravelMode } from '@/lib/types';

export interface ItineraryStop {
  placeId?: string;
  name: string;
  window?: string; // e.g. "9:00–10:00"
  why?: string;
  category?: string;
  detail?: PlaceLite; // enriched via get_place_details
}

export interface ConciergeState {
  stops: ItineraryStop[];
  travelMode: TravelMode;
  building: boolean;
  totalMeters: number;
  totalSeconds: number;
  activeStop: number; // highlighted card / play-tour cursor (-1 = none)
  playing: boolean;
  postcard: { status: 'idle' | 'loading' | 'done' | 'error'; dataUrl?: string };
  postcardOpen: boolean;

  setStops: (s: ItineraryStop[]) => void;
  patchStop: (i: number, patch: Partial<ItineraryStop>) => void;
  setTravelMode: (m: TravelMode) => void;
  setBuilding: (b: boolean) => void;
  setTotals: (meters: number, seconds: number) => void;
  setActiveStop: (i: number) => void;
  setPlaying: (b: boolean) => void;
  setPostcard: (p: ConciergeState['postcard']) => void;
  openPostcard: (open: boolean) => void;
  reset: () => void;
}

export const useConcierge = create<ConciergeState>((set) => ({
  stops: [],
  travelMode: 'WALK',
  building: false,
  totalMeters: 0,
  totalSeconds: 0,
  activeStop: -1,
  playing: false,
  postcard: { status: 'idle' },
  postcardOpen: false,

  setStops: (stops) => set({ stops }),
  patchStop: (i, patch) =>
    set((s) => ({ stops: s.stops.map((st, idx) => (idx === i ? { ...st, ...patch } : st)) })),
  setTravelMode: (m) => set({ travelMode: m }),
  setBuilding: (b) => set({ building: b }),
  setTotals: (meters, seconds) => set({ totalMeters: meters, totalSeconds: seconds }),
  setActiveStop: (i) => set({ activeStop: i }),
  setPlaying: (b) => set({ playing: b }),
  setPostcard: (p) => set({ postcard: p }),
  openPostcard: (open) => set({ postcardOpen: open }),
  reset: () =>
    set({
      stops: [],
      building: false,
      totalMeters: 0,
      totalSeconds: 0,
      activeStop: -1,
      playing: false,
      postcard: { status: 'idle' },
      postcardOpen: false,
    }),
}));

export const concierge = useConcierge.getState;
