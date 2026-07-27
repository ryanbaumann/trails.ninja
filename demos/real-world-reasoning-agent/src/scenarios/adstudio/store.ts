import { create } from 'zustand';
import type { EnvironmentSnapshot, LatLng, PlaceLite, TravelMode } from '@/lib/types';

export interface CampaignFacts {
  grounding?: string; // raw Maps-grounded answer text
  widgetToken?: string; // renders the <gmp-place-contextual> widget in chat
  env?: EnvironmentSnapshot;
  streetViewUrl?: string;
  photoUri?: string; // Places photo fallback when no Street View coverage
  vibe?: string;
}

export type AdFormat = 'square' | 'story' | 'banner';
export type CreativeStatus = 'generating' | 'ready' | 'error';
export type CreativeConditioning = 'image' | 'text-only';
/** Fine-grained progress for a creative while status === 'generating'. */
export type CreativeStage = 'prompting' | 'rendering' | 'finalizing' | 'fallback';

export interface Creative {
  id: string;
  imageRef: string; // 'img:<id>' reserved at creation (reserveImage), filled by the job (setImage)
  headline: string;
  body: string;
  cta: string;
  style: string;
  format: AdFormat;
  status: CreativeStatus;
  conditioning: CreativeConditioning;
  stage?: CreativeStage; // current step while generating (drives per-tile status copy)
  startedAt?: number; // epoch ms the (re)generation started — drives the live elapsed timer
}

export interface Targeting {
  minutes: number;
  travelMode: TravelMode;
  ringPath: LatLng[];
  reachSummary: string;
}

export interface AdStudioState {
  business?: PlaceLite;
  brief?: string;
  facts: CampaignFacts;
  creatives: Creative[];
  targeting?: Targeting;
  exporting: boolean;
  gatheringFacts: boolean;
  lightbox: string | null; // selected creative id for the Overlay

  setBusiness: (b: PlaceLite | undefined, brief?: string) => void;
  setFacts: (patch: Partial<CampaignFacts>) => void;
  setGatheringFacts: (b: boolean) => void;
  addCreative: (c: Creative) => void;
  updateCreative: (id: string, patch: Partial<Creative>) => void;
  setTargeting: (t: Targeting | undefined) => void;
  setExporting: (b: boolean) => void;
  setLightbox: (id: string | null) => void;
  reset: () => void;
}

const EMPTY: Pick<
  AdStudioState,
  'business' | 'brief' | 'facts' | 'creatives' | 'targeting' | 'exporting' | 'gatheringFacts' | 'lightbox'
> = {
  business: undefined,
  brief: undefined,
  facts: {},
  creatives: [],
  targeting: undefined,
  exporting: false,
  gatheringFacts: false,
  lightbox: null,
};

export const useAdStudio = create<AdStudioState>((set) => ({
  ...EMPTY,

  setBusiness: (b, brief) => set({ business: b, brief }),
  setFacts: (patch) => set((s) => ({ facts: { ...s.facts, ...patch } })),
  setGatheringFacts: (b) => set({ gatheringFacts: b }),
  addCreative: (c) => set((s) => ({ creatives: [...s.creatives, c] })),
  updateCreative: (id, patch) =>
    set((s) => ({ creatives: s.creatives.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
  setTargeting: (t) => set({ targeting: t }),
  setExporting: (b) => set({ exporting: b }),
  setLightbox: (id) => set({ lightbox: id }),
  reset: () => set({ ...EMPTY }),
}));

export const adstudio = useAdStudio.getState;
