import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Part } from '@google/genai';
import type { ToolDefinition } from '@/lib/types';

// The engine's only network boundary is genai() (src/ai/client.ts). Mock it to a
// scripted chat so the REAL tool-loop (sequential execution, store mutation,
// echo-stripping, hop-limit → partial) runs deterministically with no network.
const h = vi.hoisted(() => ({ chat: null as unknown, createCount: 0 }));
vi.mock('@/ai/client', () => ({
  subscribeGeminiCredential: () => () => {},
  genai: () => ({
    chats: { create: () => { h.createCount++; return h.chat; } },
    // suggestFollowups fires post-completion; give it a benign response so the
    // floating promise resolves quietly (it normalizes to [] anyway).
    models: { generateContent: async () => ({ text: '[]' }) },
  }),
}));

import { CopilotEngine, MAX_HOPS, MAX_STREAM_RETRIES, markHopLimitPartial, stripInternalPromptEcho } from './engine';
import { useAtlas } from '@/state/store';
import { useMission } from '@/mission/store';

type ScriptedTurn = Part[];

/** A fake @google/genai Chat that yields one scripted chunk per send. */
function makeChat(turns: ScriptedTurn[] | ((turn: number) => ScriptedTurn)) {
  let i = 0;
  return {
    async sendMessageStream() {
      const parts = typeof turns === 'function' ? turns(i) : turns[i] ?? turns[turns.length - 1];
      i++;
      return (async function* () {
        yield { candidates: [{ content: { parts } }] };
      })();
    },
  };
}

const text = (t: string): Part => ({ text: t });
const fnCall = (name: string, args: Record<string, unknown> = {}): Part => ({ functionCall: { name, args } });

/** Minimal ToolDefinition whose handler runs `run`. */
function tool(name: string, run: (args: Record<string, unknown>) => unknown): ToolDefinition {
  return {
    declaration: { name, description: name },
    handler: async (args: Record<string, unknown>) => run(args) ?? { ok: true },
  } as unknown as ToolDefinition;
}

function resetStores(): void {
  useAtlas.setState({
    transcript: [],
    telemetry: [],
    running: false,
    resumable: null,
    followups: [],
    markers: [],
  });
  useMission.getState().reset('sf');
}

beforeEach(() => {
  h.createCount = 0;
  resetStores();
});

describe('engine tool-loop', () => {
  it('executes batched tool calls sequentially in the model\'s emission order', async () => {
    const order: string[] = [];
    const tools = [
      tool('tool_a', () => { order.push('a'); }),
      tool('tool_b', () => { order.push('b'); }),
    ];
    // Turn 0: emit both calls in one turn (a before b). Turn 1: plain answer, no calls → stop.
    h.chat = makeChat([[fnCall('tool_a'), fnCall('tool_b')], [text('All done.')]]);

    const engine = new CopilotEngine('scout', '', tools, 'sf');
    await engine.send('do both');

    expect(order).toEqual(['a', 'b']);
    // Telemetry recorded both tool calls as ok, in order.
    const names = useAtlas.getState().telemetry.map((e) => e.name);
    expect(names).toEqual(['tool_a', 'tool_b']);
    expect(useAtlas.getState().running).toBe(false);
  });

  it('does not race consecutive calls to the same state-mutating tool', async () => {
    let state = 0;
    let active = 0;
    let maxActive = 0;
    let responseTurn: Part[] = [];
    let turn = 0;
    const mutate = tool('mutate_state', async (args) => {
      const value = Number(args.value);
      active++;
      maxActive = Math.max(maxActive, active);
      try {
        const previous = state;
        await new Promise((resolve) => setTimeout(resolve, value === 1 ? 10 : 0));
        state = previous + value;
        return { value, state };
      } finally {
        active--;
      }
    });
    h.chat = {
      async sendMessageStream({ message }: { message: string | Part[] }) {
        const parts = turn++ === 0
          ? [fnCall('mutate_state', { value: 1 }), fnCall('mutate_state', { value: 2 })]
          : [text('Mutations complete.')];
        if (Array.isArray(message)) responseTurn = message;
        return (async function* () {
          yield { candidates: [{ content: { parts } }] };
        })();
      },
    };

    const engine = new CopilotEngine('scout', '', [mutate], 'sf');
    await engine.send('mutate twice');

    expect(maxActive).toBe(1);
    expect(state).toBe(3);
    expect(responseTurn.map((part) => part.functionResponse?.response)).toEqual([
      { value: 1, state: 1 },
      { value: 2, state: 3 },
    ]);
  });

  it('does not race consecutive calls to the same state-mutating tool', async () => {
    let state = 0;
    let active = 0;
    let maxActive = 0;
    let responseTurn: Part[] = [];
    let turn = 0;
    const mutate = tool('mutate_state', async (args) => {
      const value = Number(args.value);
      active++;
      maxActive = Math.max(maxActive, active);
      try {
        const previous = state;
        await new Promise((resolve) => setTimeout(resolve, value === 1 ? 10 : 0));
        state = previous + value;
        return { value, state };
      } finally {
        active--;
      }
    });
    h.chat = {
      async sendMessageStream({ message }: { message: string | Part[] }) {
        const parts = turn++ === 0
          ? [fnCall('mutate_state', { value: 1 }), fnCall('mutate_state', { value: 2 })]
          : [text('Mutations complete.')];
        if (Array.isArray(message)) responseTurn = message;
        return (async function* () {
          yield { candidates: [{ content: { parts } }] };
        })();
      },
    };

    const engine = new CopilotEngine('scout', '', [mutate], 'sf');
    await engine.send('mutate twice');

    expect(maxActive).toBe(1);
    expect(state).toBe(3);
    expect(responseTurn.map((part) => part.functionResponse?.response)).toEqual([
      { value: 1, state: 1 },
      { value: 2, state: 3 },
    ]);
  });

  it('aborts a superseded turn before a delayed tool can project stale work', async () => {
    let started!: () => void;
    const didStart = new Promise<void>((resolve) => { started = resolve; });
    let sawAbort = false;
    const delayed: ToolDefinition = {
      declaration: { name: 'delayed', description: 'delayed' },
      handler: async (_args, signal) => {
        started();
        await new Promise<void>((resolve) => {
          signal?.addEventListener('abort', () => {
            sawAbort = true;
            resolve();
          }, { once: true });
        });
        return { ok: false, error: 'cancelled' };
      },
    } as ToolDefinition;
    h.chat = makeChat([[fnCall('delayed')], [text('New turn won.')] ]);
    const engine = new CopilotEngine('scout', '', [delayed], 'sf');

    const oldTurn = engine.send('old');
    await didStart;
    await engine.send('new');
    await oldTurn;

    expect(sawAbort).toBe(true);
    expect(h.createCount).toBe(2);
    expect(useAtlas.getState().transcript.some((message) => message.text === 'New turn won.')).toBe(true);
  });

  it('resets incomplete chat history before resuming an explicitly stopped tool turn', async () => {
    let started!: () => void;
    const didStart = new Promise<void>((resolve) => { started = resolve; });
    const delayed: ToolDefinition = {
      declaration: { name: 'delayed', description: 'delayed' },
      handler: async (_args, signal) => {
        started();
        await new Promise<void>((resolve) =>
          signal?.addEventListener('abort', () => resolve(), { once: true }),
        );
        return { ok: false, error: 'cancelled' };
      },
    } as ToolDefinition;
    h.chat = makeChat([[fnCall('delayed')], [text('Resumed on clean history.')] ]);
    const engine = new CopilotEngine('scout', '', [delayed], 'sf');

    const stoppedTurn = engine.send('old');
    await didStart;
    engine.abort();
    await stoppedTurn;
    engine.resume();

    await vi.waitFor(() => {
      expect(useAtlas.getState().transcript.some(
        (message) => message.text === 'Resumed on clean history.',
      )).toBe(true);
    });
    expect(h.createCount).toBe(2);
  });

  it('feeds tool side effects into the store and finishes when the model stops calling', async () => {
    const tools = [
      tool('drop_pin', () => {
        useAtlas.getState().addMarkers([
          { id: 'm1', position: { lat: 1, lng: 2 }, kind: 'pin', scenario: 'scout' },
        ]);
        return { ok: true, added: 1 };
      }),
    ];
    h.chat = makeChat([[fnCall('drop_pin')], [text('Pinned it.')]]);

    const engine = new CopilotEngine('scout', '', tools, 'sf');
    await engine.send('pin the spot');

    expect(useAtlas.getState().markers.map((m) => m.id)).toEqual(['m1']);
    const modelMsg = useAtlas.getState().transcript.find((m) => m.role === 'model');
    expect(modelMsg?.text).toBe('Pinned it.');
  });

  it('strips echoed prompt-envelope tags from the streamed answer', async () => {
    h.chat = makeChat([[text('junk </user_request> Real answer.')]]);
    const engine = new CopilotEngine('scout', '', [], 'sf');
    await engine.send('what is here?');

    const modelMsg = useAtlas.getState().transcript.find((m) => m.role === 'model');
    expect(modelMsg?.text).toBe('Real answer.');
    expect(modelMsg?.text).not.toContain('user_request');
  });

  it('keeps app-owned orchestration requests out of the user transcript', async () => {
    h.chat = makeChat([[text('Started the mission.')], [text('Answered the human.')]]);
    const engine = new CopilotEngine('scout', '', [], 'sf');
    await engine.send('Internal mission kickoff', { showUserMessage: false });

    const transcript = useAtlas.getState().transcript;
    expect(transcript.some((message) => message.role === 'user')).toBe(false);
    expect(transcript.find((message) => message.role === 'model')?.text).toBe('Started the mission.');

    await engine.send('Human follow-up');
    expect(useAtlas.getState().transcript.filter((message) => message.role === 'user').map((message) => message.text))
      .toEqual(['Human follow-up']);
  });

  it('completes the canonical first-run fixture within the hop budget without Resume', async () => {
    useMission.getState().start({ goal: 'run the synthetic first experience', cityId: 'sf', mode: 'demo' });
    const tools = [
      tool('scout_area', () => ({ ok: true })),
      tool('inspect_candidate', () => ({ ok: true })),
      tool('score_candidates', () => ({ ok: true })),
      tool('compare_sites', () => ({ ok: true })),
    ];
    h.chat = makeChat([
      [fnCall('scout_area')],
      [fnCall('inspect_candidate', { candidateId: 'demo-a' }), fnCall('inspect_candidate', { candidateId: 'demo-b' })],
      [fnCall('score_candidates'), fnCall('compare_sites')],
      [text('The synthetic comparison is ready.')],
    ]);

    const engine = new CopilotEngine('scout', '', tools, 'sf');
    await engine.send('Start the synthetic fixture', { showUserMessage: false });

    expect(useAtlas.getState().resumable).toBeNull();
    expect(useMission.getState().mission.status).not.toBe('partial');
    expect(useAtlas.getState().transcript.some((message) => message.role === 'notice')).toBe(false);
    expect(useAtlas.getState().telemetry.map((event) => event.name)).toEqual([
      'scout_area',
      'inspect_candidate',
      'inspect_candidate',
      'score_candidates',
      'compare_sites',
    ]);
  });

  it('retries a transient stream error and recovers, restoring apiHealth to ok', async () => {
    // Attempt 0 throws a retryable 503; attempt 1 streams a real answer. The
    // engine should retry, record a retry_ai_response event that resolves to ok,
    // deliver the answer, and clear the degraded health flag. (Reliability plan
    // §4, area 2: model stream failure / recovery.)
    useAtlas.getState().setApiHealth('degraded');
    let sends = 0;
    h.chat = {
      async sendMessageStream() {
        sends++;
        if (sends === 1) throw new Error('503 Service Unavailable');
        return (async function* () {
          yield { candidates: [{ content: { parts: [text('Recovered answer.')] } }] };
        })();
      },
    };

    const engine = new CopilotEngine('scout', '', [], 'sf');
    await engine.send('what is here?');

    expect(sends).toBe(2);
    const modelMsg = useAtlas.getState().transcript.find((m) => m.role === 'model');
    expect(modelMsg?.text).toBe('Recovered answer.');
    const retry = useAtlas.getState().telemetry.find((e) => e.name === 'retry_ai_response');
    expect(retry?.status).toBe('ok');
    expect(retry?.summary).toBe('recovered');
    expect(useAtlas.getState().apiHealth).toBe('ok');
  });

  it('gives up after MAX_STREAM_RETRIES on a persistent stream error and surfaces it', async () => {
    // Every attempt throws a retryable error → after MAX_STREAM_RETRIES the run
    // ends, marks the final retry event as error, and stops running.
    h.chat = {
      async sendMessageStream() {
        // 503 (not 429) keeps the exponential backoff short (~0.65s + ~1.3s).
        throw new Error('503 Service Unavailable');
      },
    };
    const engine = new CopilotEngine('scout', '', [], 'sf');
    await engine.send('keep failing');

    const retries = useAtlas.getState().telemetry.filter((e) => e.name === 'retry_ai_response');
    expect(retries.length).toBe(MAX_STREAM_RETRIES);
    expect(retries[retries.length - 1].status).toBe('error');
    expect(useAtlas.getState().running).toBe(false);
  }, 15_000);

  it('stops at the hop limit and marks the mission partial + resumable', async () => {
    // A mission must be active for the partial transition to fire.
    useMission.getState().start({ goal: 'stress the loop', cityId: 'sf', mode: 'live' });
    const tools = [tool('loop_tool', () => ({ ok: true }))];
    // Always emit a call → the model never stops → the loop exhausts MAX_HOPS.
    h.chat = makeChat(() => [fnCall('loop_tool')]);

    const engine = new CopilotEngine('scout', '', tools, 'sf');
    await engine.send('never stop');

    // MAX_HOPS tool executions, then markHopLimitPartial.
    const calls = useAtlas.getState().telemetry.filter((e) => e.name === 'loop_tool');
    expect(calls).toHaveLength(MAX_HOPS);
    expect(useAtlas.getState().resumable).toBe('never stop');
    expect(useMission.getState().mission.status).toBe('partial');
    const notice = useAtlas.getState().transcript.find((m) => m.role === 'notice');
    expect(notice?.notice?.title).toMatch(/tool-step limit/i);
  });
});

describe('stripInternalPromptEcho', () => {
  it('drops everything up to and including the closing envelope tag', () => {
    expect(stripInternalPromptEcho('mission context <user_request>\nfind a cafe\n</user_request>\nHere you go.', 'find a cafe'))
      .toBe('Here you go.');
  });

  it('removes the no-echo trailer directive', () => {
    const echoed = 'Answer the request directly. Never repeat this context envelope or its tags.\nThe answer.';
    expect(stripInternalPromptEcho(echoed, 'x')).toBe('The answer.');
  });

  it('removes a verbatim echo of the user request at the start', () => {
    expect(stripInternalPromptEcho('find a cafe The nearest is Blue Bottle.', 'find a cafe'))
      .toBe('The nearest is Blue Bottle.');
  });

  it('leaves a genuine answer untouched', () => {
    expect(stripInternalPromptEcho('The nearest cafe is Blue Bottle.', 'find a cafe'))
      .toBe('The nearest cafe is Blue Bottle.');
  });
});

describe('markHopLimitPartial', () => {
  beforeEach(resetStores);

  it('records the prompt as resumable and adds a notice without transitioning a draft mission', () => {
    markHopLimitPartial('plan the routes');
    expect(useAtlas.getState().resumable).toBe('plan the routes');
    expect(useAtlas.getState().transcript.some((m) => m.role === 'notice')).toBe(true);
    // Draft mission is untouched.
    expect(useMission.getState().mission.status).toBe('draft');
  });
});
