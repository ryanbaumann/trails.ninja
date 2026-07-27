import { genai } from './client';
import { MODELS, getThinkingConfig } from '@/lib/config';
import { atlas, useAtlas } from '@/state/store';
import { DEFAULT_CITY_PRESET } from '@/lib/cities';
import type { LatLng } from '@/lib/types';

export interface GroundedAnswer {
  text: string;
  widgetContextToken?: string;
}

/**
 * Nested Gemini call using the `googleMaps` grounding tool. Kept SEPARATE from
 * the main function-calling chat (Gemini rejects mixing grounding + function
 * declarations in one call). Returns the answer plus the widget context token
 * that renders <gmp-place-contextual>.
 */
export async function askMaps(question: string, at?: LatLng): Promise<GroundedAnswer> {
  const cityId = atlas().cityId;
  const preset = useAtlas.getState().cities.find(c => c.id === cityId) ?? DEFAULT_CITY_PRESET;
  const loc = at ?? preset.center;
  const thinkingConfig = getThinkingConfig(MODELS.utility, 'simpleUi');
  const resp = await genai().models.generateContent({
    model: MODELS.utility,
    contents: question,
    config: {
      tools: [{ googleMaps: {} }],
      toolConfig: {
        retrievalConfig: { latLng: { latitude: loc.lat, longitude: loc.lng } },
      },
      ...(thinkingConfig ? { thinkingConfig } : {}),
    },
  });
  const token = resp.candidates?.[0]?.groundingMetadata?.googleMapsWidgetContextToken;
  return { text: resp.text ?? '', widgetContextToken: token };
}
