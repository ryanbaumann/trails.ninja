export type VisualMode =
  | 'data-story'
  | 'executive-summary'
  | 'technical-deep-dive'
  | 'classroom'
  | 'quick-slide'
  | 'brandkit'
  | 'blog-post'
  | 'portfolio-showcase'
  | 'custom';

export type AspectRatio =
  | '16:9'
  | '1:1'
  | '9:16'
  | '3:4'
  | '4:3'
  | '1:4'
  | '16:10'
  | '21:9';

export type ImageModelOption =
  | 'gemini-3.1-flash-lite-image'
  | 'gemini-3.1-flash-image';

export interface InfographicAnalysis {
  title?: string;
  subtitle?: string;
  sectionsCount?: number;
  dataPointsCount?: number;
  brandColors?: string[];
  sourceAttribution?: string;
}

export interface PrepareResponse {
  analysis: InfographicAnalysis;
  prompt: string;
  mode: VisualMode;
  aspect: AspectRatio;
}

export interface RenderResponse {
  image: string;
  mimeType: string;
  model: string;
  aspect: AspectRatio;
  mode: VisualMode;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  topic: string;
  mode: VisualMode;
  aspect: AspectRatio;
  prompt: string;
  analysis: InfographicAnalysis;
  imageUrl: string;
  model: string;
}

export interface QuotaStatus {
  dailyUsed?: number;
  dailyCap?: number;
  remaining?: number;
}
