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
  it('routes orchestration and task agents to gemini-3.8-flash with tuned thinking levels', () => {
    expect(MODELS.orchestrator).toBe('gemini-3.8-flash');
    expect(MODELS.chat).toBe(MODELS.orchestrator);
    expect(MODELS.worker).toBe('gemini-3.8-flash');
    expect(MODELS.utility).toBe(MODELS.worker);
    expect(MODELS.vision).toBe(MODELS.worker);
    expect(MODELS.omni).toBe('gemini-omni-1.1-flash-preview');
    expect(AGENT_PROFILES).toEqual({
      orchestrator: { model: 'gemini-3.8-flash', thinking: 'high' },
      fastWorker: { model: 'gemini-3.8-flash', thinking: 'low' },
      analysisWorker: { model: 'gemini-3.8-flash', thinking: 'low' },
    });
  });

  it('uses high thinking for orchestration and low thinking for evidence analysis', () => {
    expect(getThinkingConfig(MODELS.vision, 'other')).toEqual({
      thinkingLevel: ThinkingLevel.LOW,
    });
    expect(getChatThinkingConfig(MODELS.orchestrator, 'orchestration')).toEqual({
      thinkingLevel: ThinkingLevel.HIGH,
    });
  });

  it('uses low thinking for gemini-3.8-flash simpleUi tasks to prevent 400 errors', () => {
    expect(getThinkingConfig(MODELS.utility, 'simpleUi')).toEqual({
      thinkingLevel: ThinkingLevel.LOW,
    });
  });

  it('allows the orchestrator to be tuned down to low or medium, guarding against minimal on 3.8', () => {
    expect(getChatThinkingConfig(MODELS.orchestrator, 'orchestration', 'low')).toEqual({
      thinkingLevel: ThinkingLevel.LOW,
    });
    expect(getChatThinkingConfig(MODELS.orchestrator, 'orchestration', 'medium')).toEqual({
      thinkingLevel: ThinkingLevel.MEDIUM,
    });
    expect(getChatThinkingConfig(MODELS.orchestrator, 'orchestration', 'minimal')).toEqual({
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
