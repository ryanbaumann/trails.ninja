import { ThinkingLevel } from '@google/genai';
import { describe, expect, it } from 'vitest';
import {
  AGENT_PROFILES,
  DEFAULT_MAP_ID,
  getChatThinkingConfig,
  getThinkingConfig,
  MODELS,
  resolveMapId,
} from './config';

describe('default Gemini routing', () => {
  it('routes orchestration to 3.6 Flash and task agents to 3.5 Flash-Lite', () => {
    expect(MODELS.orchestrator).toBe('gemini-3.6-flash');
    expect(MODELS.chat).toBe(MODELS.orchestrator);
    expect(MODELS.worker).toBe('gemini-3.5-flash-lite');
    expect(MODELS.utility).toBe(MODELS.worker);
    expect(MODELS.vision).toBe(MODELS.worker);
    expect(AGENT_PROFILES).toEqual({
      orchestrator: { model: 'gemini-3.6-flash', thinking: 'medium' },
      fastWorker: { model: 'gemini-3.5-flash-lite', thinking: 'minimal' },
      analysisWorker: { model: 'gemini-3.5-flash-lite', thinking: 'medium' },
    });
  });

  it('uses medium thinking for orchestration and evidence analysis', () => {
    expect(getThinkingConfig(MODELS.vision, 'other')).toEqual({
      thinkingLevel: ThinkingLevel.MEDIUM,
    });
    expect(getChatThinkingConfig(MODELS.orchestrator, 'orchestration')).toEqual({
      thinkingLevel: ThinkingLevel.MEDIUM,
    });
  });

  it('keeps explicitly latency-sensitive task agents minimal', () => {
    expect(getThinkingConfig(MODELS.utility, 'simpleUi')).toEqual({
      thinkingLevel: ThinkingLevel.MINIMAL,
    });
  });

  it('allows the orchestrator to be tuned down to low', () => {
    expect(getChatThinkingConfig(MODELS.orchestrator, 'orchestration', 'low')).toEqual({
      thinkingLevel: ThinkingLevel.LOW,
    });
  });
});

describe('Fieldwork Maps configuration', () => {
  it('uses the Google demo map ID when Fieldwork does not provide an override', () => {
    expect(resolveMapId(undefined)).toBe(DEFAULT_MAP_ID);
    expect(resolveMapId('')).toBe(DEFAULT_MAP_ID);
    expect(resolveMapId('custom-map-id')).toBe('custom-map-id');
  });
});
