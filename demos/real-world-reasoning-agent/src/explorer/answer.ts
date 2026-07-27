import { genai } from '@/ai/client';
import { MODELS, getThinkingConfig } from '@/lib/config';
import type { ExplorerView } from './contracts';

function routeMinutes(view: ExplorerView): number | undefined {
  const winner = view.candidates.find((candidate) => candidate.id === view.winnerId);
  return winner?.route ? Math.max(1, Math.round(winner.route.durationSeconds / 60)) : undefined;
}

function jacketAdvice(view: ExplorerView): string | undefined {
  if (!view.weather) return undefined;
  const celsius = view.weather.temperature.unit === 'FAHRENHEIT'
    ? (view.weather.temperature.degrees - 32) * 5 / 9
    : view.weather.temperature.degrees;
  if ((view.weather.precipitationProbability ?? 0) >= 40) return 'Bring a rain layer.';
  if (celsius <= 15) return 'A light jacket may be useful.';
  return 'A jacket is probably unnecessary based on temperature alone.';
}

/** Deterministic answer used when Gemini is unavailable or returns unsafe copy. */
export function buildExplorerFallbackAnswer(view: ExplorerView): string {
  const winner = view.candidates.find((candidate) => candidate.id === view.winnerId);
  const prefix = view.dataMode === 'sample' ? '**Sample preview:** ' : '';
  const suffix = view.dataMode === 'sample' ? ' This uses fictional demo data, not real places or current conditions.' : '';
  if (!winner) return `${prefix}${view.narrative}${suffix}`.trim();

  const minutes = routeMinutes(view);
  const mode = view.travelMode.toLowerCase();
  const route = minutes ? `${minutes}-minute ${mode}` : `verified ${mode}`;
  const jacket = jacketAdvice(view);
  return `${prefix}**${winner.label}** is the best verified fit with a ${route} trip inside the ${view.maxTravelMinutes}-minute limit.${jacket ? ` ${jacket}` : ''}${suffix}`;
}

/** Accept only compact, link-free copy that names a place from the grounded shortlist. */
export function safeExplorerAnswer(raw: string, fallback: string, allowedLabels: string[] = []): string {
  const text = raw.trim();
  if (!text || text.length > 420 || /https?:\/\/|www\.|\[[^\]]+\]\s*\(/i.test(text)) return fallback;
  if (allowedLabels.length && !allowedLabels.some((label) => text.toLocaleLowerCase().includes(label.toLocaleLowerCase()))) return fallback;
  return text;
}

/** Ask Gemini to turn verified runtime state into the concise Atlas answer paired with the evidence. */
export async function generateExplorerAnswer(view: ExplorerView, signal?: AbortSignal): Promise<string> {
  const fallback = buildExplorerFallbackAnswer(view);
  if (signal?.aborted) return fallback;
  const winner = view.candidates.find((candidate) => candidate.id === view.winnerId);
  if (!winner) return fallback;
  const facts = {
    mode: view.dataMode,
    outcome: view.stage,
    recommendation: winner?.label,
    travelMode: view.travelMode,
    travelMinutes: routeMinutes(view),
    limitMinutes: view.maxTravelMinutes,
    weather: view.weather ? {
      condition: view.weather.condition,
      temperature: view.weather.temperature,
      precipitationProbability: view.weather.precipitationProbability,
    } : undefined,
    limitations: view.limitations,
  };

  try {
    const thinkingConfig = getThinkingConfig(MODELS.worker, 'simpleUi');
    const response = await genai().models.generateContent({
      model: MODELS.worker,
      contents: [
        'Write the final Atlas answer from the verified facts below.',
        'Use at most 55 words and two sentences. Lead with the recommendation and travel time.',
        'Do not add facts, place names, links, citations, source names, headings, or a list.',
        'If mode is sample, begin "Sample preview:" and clearly say the data is fictional.',
        JSON.stringify(facts),
      ].join('\n'),
      config: {
        ...(thinkingConfig ? { thinkingConfig } : {}),
        ...(signal ? { abortSignal: signal } : {}),
      },
    });
    if (signal?.aborted) return fallback;
    return safeExplorerAnswer(response.text ?? '', fallback, [winner.label]);
  } catch {
    return fallback;
  }
}
