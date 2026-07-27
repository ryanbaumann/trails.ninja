import { create } from 'zustand';
import type { LatLng } from '@/lib/types';

export type VanStatus = 'enroute' | 'idle' | 'returning';
export type JobStatus = 'unassigned' | 'assigned' | 'done';

export interface VanSnapshot {
  id: string;
  label: string;
  position: LatLng;
  heading: number;
  status: VanStatus;
  jobId?: string;
  distanceTodayMeters: number;
  etaSeconds: number;
  routePath: LatLng[];
}

export interface JobSnapshot {
  id: string;
  label: string;
  pickup: LatLng;
  dropoff: LatLng;
  status: JobStatus;
  vanId?: string;
}

export interface Kpis {
  active: number;
  total: number;
  onTimePct: number;
  avgEtaSeconds: number;
  distanceTodayMeters: number;
  unassigned: number;
}

export interface FleetState {
  vans: VanSnapshot[];
  jobs: JobSnapshot[];
  kpis: Kpis;
  simSpeed: number; // 1 | 4 | 16
  followVanId: string | null;
  selectedVanId: string | null;
  running: boolean;

  setSnapshot: (vans: VanSnapshot[], jobs: JobSnapshot[], kpis: Kpis) => void;
  setSimSpeed: (n: number) => void;
  setFollow: (id: string | null) => void;
  selectVan: (id: string | null) => void;
  setRunning: (b: boolean) => void;
}

const emptyKpis: Kpis = {
  active: 0,
  total: 0,
  onTimePct: 100,
  avgEtaSeconds: 0,
  distanceTodayMeters: 0,
  unassigned: 0,
};

export const useFleet = create<FleetState>((set) => ({
  vans: [],
  jobs: [],
  kpis: emptyKpis,
  simSpeed: 4,
  followVanId: null,
  selectedVanId: null,
  running: false,

  setSnapshot: (vans, jobs, kpis) => set({ vans, jobs, kpis }),
  setSimSpeed: (n) => set({ simSpeed: n }),
  setFollow: (id) => set({ followVanId: id }),
  selectVan: (id) => set({ selectedVanId: id }),
  setRunning: (b) => set({ running: b }),
}));

export const fleet = useFleet.getState;
