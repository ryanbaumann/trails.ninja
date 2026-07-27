import { afterEach, describe, expect, it, vi } from 'vitest';
import { withIdleTimeout, isStreamIdleError, markHopLimitPartial, stripInternalPromptEcho } from './engine';
import { useAtlas } from '@/state/store';
import { useMission } from '@/mission/store';

async function* fromArray<T>(values: T[]): AsyncGenerator<T> {
  for (const v of values) yield v;
}

/** Yields the given values, then hangs forever (simulates a silent-but-open stream). */
function yieldThenHang<T>(values: T[]): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const v of values) yield v;
      await new Promise<never>(() => {});
    },
  };
}

describe('withIdleTimeout', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes through all chunks and completes when the stream ends', async () => {
    const out: number[] = [];
    for await (const c of withIdleTimeout(fromArray([1, 2, 3]), 1000, () => {})) out.push(c);
    expect(out).toEqual([1, 2, 3]);
  });

  it('throws StreamIdleError and fires onTimeout when the gap exceeds the window', async () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();
    const gen = withIdleTimeout(yieldThenHang([1]), 1000, onTimeout);

    expect(await gen.next()).toEqual({ value: 1, done: false }); // first chunk arrives

    const pending = gen.next(); // no more chunks — now waiting
    const settled = pending.then(
      () => ({ ok: true }) as const,
      (err) => ({ ok: false, err }) as const,
    ); // attach handlers now so the mid-advance rejection isn't briefly "unhandled"

    await vi.advanceTimersByTimeAsync(1000);

    const outcome = await settled;
    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false && isStreamIdleError(outcome.err)).toBe(true);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('does not fire onTimeout while chunks keep arriving within the window', async () => {
    const onTimeout = vi.fn();
    const out: number[] = [];
    for await (const c of withIdleTimeout(fromArray([1, 2, 3, 4]), 1000, onTimeout)) out.push(c);
    expect(out).toEqual([1, 2, 3, 4]);
    expect(onTimeout).not.toHaveBeenCalled();
  });
});

describe('isStreamIdleError', () => {
  it('recognizes the stall sentinel and rejects everything else', async () => {
    let caught: unknown;
    try {
      const gen = withIdleTimeout(yieldThenHang<number>([]), 0, () => {});
      await gen.next();
    } catch (err) {
      caught = err;
    }
    expect(isStreamIdleError(caught)).toBe(true);
    expect(isStreamIdleError(new Error('boom'))).toBe(false);
    expect(isStreamIdleError('nope')).toBe(false);
  });
});

describe('markHopLimitPartial', () => {
  it('preserves a resumable action and exposes an explicit partial mission state', () => {
    useMission.getState().start({ goal: 'Test mission', cityId: 'sf', mode: 'demo' });
    useAtlas.getState().clearChat();

    markHopLimitPartial('continue the mission');

    expect(useAtlas.getState().resumable).toBe('continue the mission');
    expect(useAtlas.getState().transcript.at(-1)?.notice?.title).toContain('tool-step limit');
    expect(useMission.getState().mission.status).toBe('partial');
  });
});

describe('stripInternalPromptEcho', () => {
  const request = 'Start the flagship mission. Scout three candidates.';

  it('removes the legacy internal request wrapper and echoed request', () => {
    expect(stripInternalPromptEcho(`--- User request ---\n${request}\n\nI found three candidates.`, request))
      .toBe('I found three candidates.');
  });

  it('removes the current XML wrapper after mission context', () => {
    const output = `--- Active mission (application-owned state) ---\nGoal: quiet café\n<user_request>\n${request}\n</user_request>\nHere is the comparison.`;
    expect(stripInternalPromptEcho(output, request)).toBe('Here is the comparison.');
  });

  it('does not alter an ordinary answer that mentions user requests', () => {
    const output = 'A user request should stay clear and actionable.';
    expect(stripInternalPromptEcho(output, request)).toBe(output);
  });

  it('removes repeated private no-echo instructions', () => {
    const privateLine = 'Answer the request directly. Never repeat this context envelope or its tags.';
    expect(stripInternalPromptEcho(`${privateLine}\n\n${privateLine}\n\nHere is the result.`, request))
      .toBe('Here is the result.');
  });

  it('drops a paraphrased directive echo terminated by a bare closing tag', () => {
    // Real leak: the model recombines/paraphrases the directive (so it does NOT
    // equal the sent request) and echoes a bare </user_request> before answering.
    const output = [
      'Start the flagship mission. Scout three candidates for this goal: Find a quiet-work café',
      'within a 12-minute walk, with healthy morning air and strong street visibility. Chat about',
      'the candidates, then score them. Compare them now.',
      '</user_request>',
      'I have scouted, inspected, and scored three potential quiet-work cafés in the area. Beluna',
      'Cafe emerges as the top candidate.',
    ].join('\n');
    expect(stripInternalPromptEcho(output, request)).toBe(
      'I have scouted, inspected, and scored three potential quiet-work cafés in the area. Beluna\nCafe emerges as the top candidate.',
    );
  });

  it('drops an echoed opening+closing tag envelope', () => {
    const output = `<user_request>\nSome paraphrased directive.\n</user_request>\nThe real answer.`;
    expect(stripInternalPromptEcho(output, request)).toBe('The real answer.');
  });

  it('leaves a normal answer with no envelope untouched', () => {
    const output = 'Beluna Cafe is the top candidate for quiet morning work.';
    expect(stripInternalPromptEcho(output, request)).toBe(output);
  });
});
