import { create } from 'zustand';
import type { EnvironmentSnapshot, LatLng, PlaceLite } from '@/lib/types';

export interface Essential {
  category: string;
  label: string;
  place?: PlaceLite;
  distanceMeters?: number;
}

export interface CommuteCell {
  anchorName: string;
  anchorLoc: LatLng;
  distanceMeters: number;
  durationSeconds: number;
  ok: boolean;
}

export interface Dossier {
  id: string;
  location: LatLng;
  address?: string;
  streetViewUrl?: string;
  hasPano: boolean;
  score: number; // 0-100 demo heuristic
  essentials: Essential[];
  env: EnvironmentSnapshot;
  commute: CommuteCell[];
  brief?: string;
  briefLoading?: boolean;
}

export type Slot = 'A' | 'B';

export interface InsightState {
  subject: Dossier | null; // slot A
  compare: Dossier | null; // slot B
  loadingA: boolean;
  loadingB: boolean;
  aqiLayer: boolean;
  activeSlot: Slot;
  compareBrief?: string;
  compareBriefLoading?: boolean;

  setLoading: (slot: Slot, b: boolean) => void;
  setDossier: (slot: Slot, d: Dossier | null) => void;
  patchDossier: (slot: Slot, patch: Partial<Dossier>) => void;
  setAqiLayer: (on: boolean) => void;
  setActiveSlot: (slot: Slot) => void;
  setCompareBrief: (text: string) => void;
  setCompareBriefLoading: (b: boolean) => void;
  reset: () => void;
}

export const useInsight = create<InsightState>((set) => ({
  subject: null,
  compare: null,
  loadingA: false,
  loadingB: false,
  aqiLayer: false,
  activeSlot: 'A',
  compareBrief: undefined,
  compareBriefLoading: false,

  setLoading: (slot, b) => set(slot === 'A' ? { loadingA: b } : { loadingB: b }),
  setDossier: (slot, d) => set(slot === 'A' ? { subject: d } : { compare: d }),
  patchDossier: (slot, patch) =>
    set((s) => {
      const cur = slot === 'A' ? s.subject : s.compare;
      if (!cur) return {};
      const next = { ...cur, ...patch };
      return slot === 'A' ? { subject: next } : { compare: next };
    }),
  setAqiLayer: (on) => set({ aqiLayer: on }),
  setActiveSlot: (slot) => set({ activeSlot: slot }),
  setCompareBrief: (text) => set({ compareBrief: text }),
  setCompareBriefLoading: (b) => set({ compareBriefLoading: b }),
  reset: () => set({ subject: null, compare: null, loadingA: false, loadingB: false, activeSlot: 'A', compareBrief: undefined, compareBriefLoading: false }),
}));

export const insight = useInsight.getState;
