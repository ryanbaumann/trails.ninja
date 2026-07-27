
export interface HairstyleOption {
  id: string;
  label: string;
  description: string;
  category: 'length' | 'texture' | 'color' | 'style';
  imageUrl?: string; // Added for visual menu
}

export interface GeneratedImage {
  id: string; // Unique ID for tracking
  url: string;
  prompt: string;
  title?: string; // Short AI-generated title
  timestamp: number;
  generationMode?: GenerationMode;
  outputLayout?: OutputLayout;
  model?: string;
}

export type ViewType = 'front' | 'side' | 'back';
export type GenerationMode = 'fast' | 'studio';
export type OutputLayout = 'single' | 'salon-sheet' | 'before-after';

export interface UploadedImages {
  front: string | null; // base64
  side: string | null; // base64
  back: string | null; // base64
}

export interface AppState {
  step: 'upload' | 'style' | 'generating' | 'result';
  images: UploadedImages;
  selectedStyle: string;
  customPrompt: string;
  styleReferenceImage: string | null; // New: User uploaded style reference
  styleReferenceUrl: string | null;   // New: YouTube/TikTok URL
  generationMode: GenerationMode;
  outputLayout: OutputLayout;
  errorMessage: string | null;
  generatedResult: GeneratedImage | null;
  history: GeneratedImage[]; // Track versions for undo/redo
  theme: 'light' | 'dark';
  isSalonBriefOpen: boolean; // "Take this to the salon" brief
}
