import { type Chat, type GenerateContentConfig, type Part } from '@google/genai';
import { genai } from './client';
import { MODELS, getChatThinkingConfig } from '@/lib/config';
import { useAtlas } from '@/state/store';
import { DEFAULT_CITY_PRESET } from '@/lib/cities';
import { composeSystemPrompt } from './prompts';
import { stopSpeech } from './tts';
import { suggestFollowups } from './followups';
import type { ScenarioId, ToolDefinition, ToolEventDetail } from '@/lib/types';
import { atlas } from '@/state/store';
import { uid } from '@/lib/id';
import { missionPromptContext, missionStore } from '@/mission/store';

export const MAX_HOPS = 8;
export const MAX_STREAM_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 650;
/**
 * Max time to wait for the NEXT chunk from a model stream before treating it as
 * stalled. Guards against a silent-but-open connection (e.g. an upstream/proxy
 * that neither sends bytes nor closes) wedging the run in a "Thinking…" state
 * forever. Comfortably above realistic time-to-first-token (incl. thinking) yet
 * below the server proxy's hard request timeout, so the client recovers first.
 */
const STREAM_IDLE_TIMEOUT_MS = 35_000;

/** Thrown by `withIdleTimeout` when a stream goes silent past the idle window. */
class StreamIdleError extends Error {
  constructor() {
    super('AI stream stalled — no response received');
    this.name = 'StreamIdleError';
  }
}

/** Sentinel resolved by the idle timer — kept distinct from any real chunk. */
const IDLE_SENTINEL = Symbol('stream-idle');

/**
 * Wrap an async iterable so that if the gap between two chunks exceeds `ms`, it
 * throws `StreamIdleError` (and fires `onTimeout`, used to abort the underlying
 * fetch). The idle timer *resolves* a sentinel rather than rejecting, so no
 * stray rejected promise is ever left unhandled; a genuine read error still
 * propagates. The abandoned pending read is swallowed on timeout.
 */
export async function* withIdleTimeout<T>(
  stream: AsyncIterable<T>,
  ms: number,
  onTimeout: () => void,
): AsyncGenerator<T> {
  const it = stream[Symbol.asyncIterator]();
  for (;;) {
    const nextP = it.next();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let res: IteratorResult<T> | typeof IDLE_SENTINEL;
    try {
      res = await Promise.race([
        nextP,
        new Promise<typeof IDLE_SENTINEL>((resolve) => {
          timer = setTimeout(() => resolve(IDLE_SENTINEL), ms);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
    if (res === IDLE_SENTINEL) {
      onTimeout();
      void nextP.catch(() => {}); // abandon the in-flight read quietly
      throw new StreamIdleError();
    }
    if (res.done) return;
    yield res.value;
  }
}

/** True for the stall sentinel — kept as a helper so tests/consumers don't import the class. */
export function isStreamIdleError(err: unknown): boolean {
  return err instanceof StreamIdleError;
}

export class CopilotEngine {
  private chat: Chat;
  private tools: Map<string, ToolDefinition>;
  /** Chat-level config, re-spread into each request so we can add an abortSignal
   *  without dropping systemInstruction/tools/thinkingConfig (sendMessageStream
   *  *replaces* the chat config with any per-request config). */
  private config: GenerateContentConfig;
  /** Bumps on every send/abort; an in-flight run whose token is stale bails out. */
  private generation = 0;
  private controller: AbortController | null = null;
  /** True when an aborted turn may have left chat history mid-stream or with an unanswered functionCall. */
  private chatNeedsReset = false;
  private lastUserText = '';
  private lastRequestShowedUserMessage = true;
  /** Id of the model message currently streaming, so abort() can un-stick it. */
  private activeMsgId: string | null = null;

  constructor(
    private scenario: ScenarioId,
    systemAddendum: string,
    tools: ToolDefinition[],
    cityId: string,
    /** Chat model id — defaults to the configured chat model; the admin panel can
     *  override it live (session.ts rebuilds the engine when it changes). */
    private model: string = MODELS.orchestrator,
    /** Thinking-level override ('minimal'|'low'|'medium'|'high'); undefined/'default'
     *  falls back to env then the per-scenario default. */
    thinkingOverride?: string,
  ) {
    this.tools = new Map(tools.map((t) => [t.declaration.name ?? '', t]));

    const city = useAtlas.getState().cities.find(c => c.id === cityId) ?? DEFAULT_CITY_PRESET;
    // The orchestration agent defaults to Gemini 3.6 Flash at MEDIUM thinking.
    // Bounded task agents use the worker profiles in config.ts.
    const thinkingConfig = getChatThinkingConfig(
      model,
      'orchestration',
      thinkingOverride === 'default' ? undefined : thinkingOverride,
    );

    this.config = {
      systemInstruction: composeSystemPrompt(systemAddendum, city),
      tools: [{ functionDeclarations: tools.map((t) => t.declaration) }],
      ...(thinkingConfig ? { thinkingConfig } : {}),
    };
    this.chat = genai().chats.create({ model: this.model, config: this.config });
  }

  /** True when there is an interrupted prompt to re-run. */
  hasResumable(): boolean {
    return !!atlas().resumable;
  }

  /** Re-run the last interrupted prompt from scratch (clears the resume marker). */
  resume(): void {
    const prompt = atlas().resumable;
    if (!prompt) return;
    void this.send(prompt, { showUserMessage: this.lastRequestShowedUserMessage });
  }

  /**
   * Stop the in-flight run for this journey: abort the network stream, silence
   * speech, un-stick the streaming caret, and record the prompt as resumable so
   * the user can re-run it. Safe to call when nothing is running.
   */
  abort(): void {
    const s = atlas();
    if (!s.running) return;
    this.generation++; // invalidate the in-flight run
    this.controller?.abort();
    this.controller = null;
    this.chatNeedsReset = true;
    stopSpeech();
    if (this.activeMsgId) {
      s.updateMsg(this.activeMsgId, { streaming: false });
      this.activeMsgId = null;
    }
    s.setRunning(false);
    if (this.lastUserText) s.setResumable(this.lastUserText);
  }

  /** Send one user turn; drives the tool loop until the model stops calling. */
  async send(userText: string, options: { showUserMessage?: boolean } = {}): Promise<void> {
    const s = atlas();
    // A new turn supersedes any in-flight turn. Abort its shared signal so a
    // generated capability adapter cannot project stale effects after await.
    const supersedesActiveTurn = this.controller !== null;
    this.controller?.abort();
    // The prior chat may now end with a functionCall that never received a
    // functionResponse. Start a fresh protocol history for the superseding turn
    // instead of sending into that invalid/incomplete history.
    if (supersedesActiveTurn || this.chatNeedsReset) {
      this.chat = genai().chats.create({ model: this.model, config: this.config });
      this.chatNeedsReset = false;
    }
    const mine = ++this.generation;
    const controller = new AbortController();
    this.controller = controller;
    const signal = controller.signal;
    this.lastUserText = userText;
    this.lastRequestShowedUserMessage = options.showUserMessage ?? true;

    s.setRunning(true);
    s.setResumable(null);
    s.setFollowups([]);
    if (this.lastRequestShowedUserMessage) {
      s.addMsg({ id: uid('u'), role: 'user', text: userText, ts: Date.now() });
    }

    const stale = () => mine !== this.generation || signal.aborted;
    let completed = false;

    try {
      const initialMissionContext = missionPromptContext();
      let message: string | Part[] = initialMissionContext
        ? `${initialMissionContext}\n\n<user_request>\n${userText}\n</user_request>\nAnswer the request directly. Never repeat this context envelope or its tags.`
        : userText;
      for (let hop = 0; hop < MAX_HOPS; hop++) {
        if (stale()) return;
        const modelMsgId = uid('a');
        let modelMsgAdded = false;
        const ensureModelMsg = () => {
          if (modelMsgAdded) return;
          this.activeMsgId = modelMsgId;
          s.addMsg({
            id: modelMsgId,
            role: 'model',
            text: '',
            streaming: true,
            ts: Date.now(),
          });
          modelMsgAdded = true;
        };

        const calls: { name: string; args: Record<string, unknown> }[] = [];
        await this.consumeModelStream(message, modelMsgId, ensureModelMsg, calls, signal);
        if (modelMsgAdded) {
          const emitted = atlas().transcript.find((msg) => msg.id === modelMsgId)?.text ?? '';
          s.updateMsg(modelMsgId, {
            text: stripInternalPromptEcho(emitted, userText),
            streaming: false,
          });
        }
        if (this.activeMsgId === modelMsgId) this.activeMsgId = null;

        if (stale()) return;
        if (!calls.length) {
          completed = true;
          return;
        }

        // Execute every requested tool call SEQUENTIALLY, in the order the model
        // emitted it. Tool names do not imply independence: consecutive calls to
        // the same handler can still read and mutate shared scenario state.
        const responses: Part[] = [];
        for (const call of calls) {
          if (stale()) return;
          const evId = uid('t');
          s.pushTool({
            id: evId,
            name: call.name,
            status: 'running',
            ts: Date.now(),
          });
          const tool = this.tools.get(call.name);
          try {
            const result = tool ? await tool.handler(call.args, signal) : { error: 'unknown tool' };
            s.updateTool(evId, {
              status: tool && !isFailedResult(result) ? 'ok' : 'error',
              summary: summarize(call.name, result),
              details: detailsForTool(call.name, result, call.args),
            });
            responses.push({ functionResponse: { name: call.name, response: safe(result) } });
          } catch (err) {
            s.updateTool(evId, { status: 'error', summary: String(err) });
            responses.push({ functionResponse: { name: call.name, response: { error: String(err) } } });
          }
        }
        if (stale()) return;
        const latestMissionContext = missionPromptContext();
        message = latestMissionContext ? [...responses, { text: latestMissionContext }] : responses;
      }
      if (!stale()) markHopLimitPartial(userText);
    } catch (err) {
      if (stale()) return; // aborted mid-flight — not a real error
      if (isRateLimitError(err)) {
        s.pushToast('warn', "The shared demo allowance is used up. Add your Gemini API key from AI Studio to continue, or try again later.");
        s.setApiHealth('degraded');
        s.setKeyDialogOpen(true);
      } else if (isStreamIdleError(err)) {
        s.pushToast('warn', 'Atlas stalled waiting on a response — please try that again.');
        s.setApiHealth('degraded');
        if (this.lastUserText) s.setResumable(this.lastUserText);
      } else {
        s.pushToast('bad', `Copilot error: ${err instanceof Error ? err.message : String(err)}`);
      }
    } finally {
      // Only the current run may clear the flag; a superseded run must not stomp
      // a newer one (or an abort that already cleaned up).
      if (mine === this.generation) {
        // Un-stick a model message left mid-stream by an error/stall so its
        // blinking caret doesn't persist after the run ends.
        if (this.activeMsgId) {
          s.updateMsg(this.activeMsgId, { streaming: false });
          this.activeMsgId = null;
        }
        s.setRunning(false);
        this.controller = null;
        // Best-effort "next actions" chips off the main chat — never blocks the
        // answer and silently no-ops if it fails or a newer turn supersedes it.
        if (completed) void this.refreshFollowups(mine);
      }
    }
  }

  /** Populate the follow-up chips for this journey, unless a newer turn started. */
  private async refreshFollowups(mine: number): Promise<void> {
    const suggestions = await suggestFollowups(this.scenario);
    if (mine !== this.generation) return; // a newer turn (or abort) took over
    if (suggestions.length) atlas().setFollowups(suggestions);
  }

  private async consumeModelStream(
    message: string | Part[],
    modelMsgId: string,
    ensureModelMsg: () => void,
    calls: { name: string; args: Record<string, unknown> }[],
    signal: AbortSignal,
  ): Promise<void> {
    const s = atlas();
    for (let attempt = 0; attempt <= MAX_STREAM_RETRIES; attempt++) {
      let retryEventId: string | undefined;
      let receivedAnyPart = false;
      // Fresh per-attempt controller so an idle-timeout abort on one attempt
      // doesn't poison the retry. Forwards the run-level abort (Stop / navigate).
      const attemptCtrl = new AbortController();
      const forwardAbort = () => attemptCtrl.abort();
      if (signal.aborted) return;
      signal.addEventListener('abort', forwardAbort, { once: true });
      try {
        if (attempt > 0) {
          retryEventId = uid('t');
          s.pushTool({
            id: retryEventId,
            name: 'retry_ai_response',
            status: 'running',
            summary: `attempt ${attempt + 1}/${MAX_STREAM_RETRIES + 1}`,
            ts: Date.now(),
          });
        }

        const stream = await this.chat.sendMessageStream({
          message,
          config: { ...this.config, abortSignal: attemptCtrl.signal },
        });
        const guarded = withIdleTimeout(stream, STREAM_IDLE_TIMEOUT_MS, () => attemptCtrl.abort());
        for await (const chunk of guarded) {
          if (signal.aborted) return;
          const text = textFromChunkParts(chunk);
          const functionCalls = functionCallsFromChunkParts(chunk);
          if (text || functionCalls.length) receivedAnyPart = true;
          if (text) {
            ensureModelMsg();
            s.appendToMsg(modelMsgId, text);
          }
          for (const fc of functionCalls) {
            calls.push({ name: fc.name ?? '', args: (fc.args ?? {}) as Record<string, unknown> });
          }
        }
        if (retryEventId) {
          s.updateTool(retryEventId, { status: 'ok', summary: 'recovered' });
        }
        if (atlas().apiHealth === 'degraded') s.setApiHealth('ok');
        return;
      } catch (err) {
        if (signal.aborted) return; // stopped/navigated away — swallow quietly
        // A stalled (silent) stream is retryable, just like a transient 5xx/429.
        const retryable = isStreamIdleError(err) || isRetryableStreamError(err);
        if (retryEventId) {
          s.updateTool(retryEventId, {
            status: attempt < MAX_STREAM_RETRIES && retryable ? 'ok' : 'error',
            summary: isStreamIdleError(err) ? 'stalled' : summarizeStreamError(err),
          });
        }
        if (receivedAnyPart || attempt >= MAX_STREAM_RETRIES || !retryable) {
          throw err;
        }
        await sleep(isRateLimitError(err) ? 4000 * (attempt + 1) : RETRY_BASE_DELAY_MS * 2 ** attempt);
      } finally {
        signal.removeEventListener('abort', forwardAbort);
      }
    }
  }
}

/**
 * Removes a model echo of Atlas's private mission-context envelope. The stream is
 * hidden while active, so sanitizing once at completion avoids chunk-boundary
 * bugs and guarantees internal prompt labels never become answer copy.
 */
export function stripInternalPromptEcho(text: string, userText: string): string {
  let visible = text.trim();

  // Remove the private no-echo trailer wherever it lands in the echo.
  visible = visible.replace(
    /\s*Answer the request directly\. Never repeat this context envelope or its tags\.\s*/gi,
    '\n',
  ).trim();

  // The <user_request>/</user_request> tags wrap Atlas's private context envelope
  // and NEVER appear in a genuine answer. The model frequently paraphrases and
  // recombines the echoed directive, so an exact match against `userText` is
  // unreliable. Instead key on the closing tag: everything up to and INCLUDING
  // the first </user_request> is echoed envelope (mission context + directive) —
  // drop it. This is robust to any paraphrase of the directive.
  const closeMatch = /<\/user_request>/i.exec(visible);
  if (closeMatch) {
    visible = visible.slice(closeMatch.index + closeMatch[0].length).trimStart();
  }

  // Legacy "--- User request ---" wrapper (older envelope form): drop it and the
  // echoed request only when it leads or follows the app-owned mission envelope,
  // so ordinary answer prose that mentions "user request" is left untouched.
  const legacyMarker = /(?:^|\n)\s*-{2,}\s*User request\s*-{2,}\s*\n?/i;
  const legacy = legacyMarker.exec(visible);
  if (legacy) {
    const prefix = visible.slice(0, legacy.index).trim();
    if (!prefix || /^--- Active mission \(application-owned state\) ---/i.test(prefix)) {
      visible = visible.slice(legacy.index + legacy[0].length).trimStart();
    }
  }

  // Belt-and-suspenders: a verbatim echo of the request, plus any stray standalone
  // envelope tags left anywhere. Those tags are envelope-only, so removing them is
  // safe and can never touch real answer content.
  if (userText && visible.startsWith(userText)) {
    visible = visible.slice(userText.length).trimStart();
  }
  visible = visible.replace(/\s*<\/?user_request>\s*/gi, '\n').trim();

  return visible.trim();
}

/** Make loop exhaustion visible and resumable instead of silently ending the turn. */
export function markHopLimitPartial(userText: string): void {
  const state = atlas();
  state.setResumable(userText);
  state.addMsg({
    id: uid('notice'),
    role: 'notice',
    notice: {
      title: 'Mission paused at the tool-step limit',
      body: 'The completed evidence is preserved. Resume to continue from the next action.',
    },
    ts: Date.now(),
  });
  if (missionStore().mission.status !== 'draft') missionStore().transition({ type: 'partial' });
}

interface StreamChunkShape {
  candidates?: {
    content?: {
      parts?: Part[];
    };
  }[];
}

function chunkParts(chunk: StreamChunkShape): Part[] {
  return chunk.candidates?.flatMap((candidate) => candidate.content?.parts ?? []) ?? [];
}

function textFromChunkParts(chunk: StreamChunkShape): string {
  return chunkParts(chunk)
    .map((part) => ('text' in part && typeof part.text === 'string' ? part.text : ''))
    .join('');
}

function functionCallsFromChunkParts(chunk: StreamChunkShape): NonNullable<Part['functionCall']>[] {
  return chunkParts(chunk)
    .map((part) => ('functionCall' in part ? part.functionCall : undefined))
    .filter((fc): fc is NonNullable<Part['functionCall']> => !!fc);
}

function safe(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return { result: v };
}

/** A tool that returned normally but signalled failure via `{ok: false}` — the
 *  chip should read as an error (✕), not a success (✓) with a "failed" summary. */
function isFailedResult(result: unknown): boolean {
  return !!result && typeof result === 'object' && !Array.isArray(result) && (result as { ok?: unknown }).ok === false;
}

function summarize(name: string, result: unknown): string {
  const r = result as Record<string, unknown>;
  if (r && typeof r === 'object') {
    if ('count' in r) return `${r.count} results`;
    if ('added' in r) return `+${r.added} markers`;
    if ('distanceMeters' in r && 'durationSeconds' in r)
      return `${Math.round(Number(r.distanceMeters) / 100) / 10} km`;
    if ('ok' in r) return r.ok ? 'done' : 'failed';
  }
  return name;
}

/**
 * Builds rich, clickable detail rows for a tool call so the demo can "show its
 * work". Prepends a compact summary of the INPUT ARGS, then tool-specific
 * result rows. Lists are kept short (roughly <=6 rows besides list-style tools
 * like search_places). Returns undefined when there is nothing showable, which
 * renders a non-clickable chip.
 */
function detailsForTool(
  name: string,
  result: unknown,
  args?: Record<string, unknown>,
): ToolEventDetail[] | undefined {
  const r = (result && typeof result === 'object' && !Array.isArray(result) ? result : {}) as Record<string, unknown>;
  const rows: ToolEventDetail[] = [];
  const input = argsSummary(name, args ?? {});
  if (input) rows.push({ label: 'Input', value: input });

  // Any tool that failed with a message surfaces the reason.
  if (r.ok === false && typeof r.error === 'string' && r.error.trim()) {
    rows.push({ label: 'Error', value: r.error });
    return rows;
  }

  switch (name) {
    case 'search_places': {
      if (Array.isArray(r.places)) {
        for (const place of r.places.slice(0, 8)) {
          const p = place as Record<string, unknown>;
          const rating = typeof p.rating === 'number' ? `${p.rating.toFixed(1)} stars` : undefined;
          const address = typeof p.address === 'string' ? p.address : undefined;
          rows.push({
            label: typeof p.name === 'string' ? p.name : 'Unnamed place',
            value: [rating, address].filter(Boolean).join(' - ') || undefined,
            placeId: typeof p.placeId === 'string' ? p.placeId : undefined,
          });
        }
      }
      break;
    }
    case 'get_place_details': {
      pushDetail(rows, stringDetail('Address', r.address));
      pushDetail(rows, stringDetail('Phone', r.phone));
      pushDetail(rows, stringDetail('Website', r.website));
      if (typeof r.rating === 'number') rows.push({ label: 'Rating', value: `${r.rating.toFixed(1)} stars` });
      if (typeof r.openNow === 'boolean') rows.push({ label: 'Open now', value: r.openNow ? 'Yes' : 'No' });
      break;
    }
    case 'draw_route': {
      pushDetail(rows, labelIf('Distance', kmLabel(r.distanceMeters)));
      pushDetail(rows, labelIf('ETA', minLabel(r.durationSeconds)));
      break;
    }
    case 'get_environment': {
      pushDetail(rows, snapshotDetail('Air quality', r.airQuality, ['aqi', 'category']));
      pushDetail(rows, snapshotDetail('Weather', r.weather, ['tempC', 'condition']));
      const solar = r.solar as Record<string, unknown> | undefined;
      if (solar && typeof solar.yearlyEnergyKwh === 'number') {
        rows.push({ label: 'Solar potential', value: `${Math.round(solar.yearlyEnergyKwh)} kWh/yr` });
      }
      break;
    }
    case 'ask_maps':
    case 'ask_maps_grounding': {
      pushDetail(rows, stringDetail('Answer', r.answer));
      if (typeof r.grounded === 'boolean') rows.push({ label: 'Grounded', value: r.grounded ? 'Yes' : 'No' });
      break;
    }
    case 'render_surface': {
      if (Array.isArray(r.created) && r.created.length) rows.push({ label: 'Created', value: `${r.created.length} surface(s)` });
      if (Array.isArray(r.updated) && r.updated.length) rows.push({ label: 'Updated', value: `${r.updated.length} surface(s)` });
      break;
    }
    case 'analyze_location': {
      pushDetail(rows, stringDetail('Address', r.address));
      if (typeof r.livingScore === 'number') rows.push({ label: 'Living score', value: `${Math.round(r.livingScore)}/100` });
      pushDetail(rows, snapshotDetail('Air quality', r.airQuality, ['aqi', 'category']));
      pushDetail(rows, snapshotDetail('Weather', r.weather, ['tempC', 'condition']));
      if (Array.isArray(r.essentials)) rows.push({ label: 'Essentials nearby', value: `${r.essentials.length} found` });
      break;
    }
    case 'compare_with': {
      pushDetail(rows, stringDetail('Address', r.address));
      if (typeof r.livingScore === 'number') rows.push({ label: 'Living score', value: `${Math.round(r.livingScore)}/100` });
      if (typeof r.scoreDeltaVsA === 'number') {
        const d = Math.round(r.scoreDeltaVsA);
        rows.push({ label: 'Vs. location A', value: `${d >= 0 ? '+' : ''}${d} points` });
      }
      break;
    }
    case 'propose_itinerary': {
      if (typeof r.count === 'number') rows.push({ label: 'Stops', value: `${r.count}` });
      pushDetail(rows, labelIf('Total distance', kmLabel(r.totalDistanceMeters)));
      pushDetail(rows, labelIf('Total time', minLabel(r.totalDurationSeconds)));
      if (Array.isArray(r.stops)) {
        for (const stop of r.stops.slice(0, 3)) {
          const st = stop as Record<string, unknown>;
          if (typeof st.name === 'string') rows.push({ label: st.name, value: typeof st.window === 'string' ? st.window : undefined });
        }
      }
      break;
    }
    case 'get_fleet_state': {
      const k = r.kpis as Record<string, unknown> | undefined;
      if (k) {
        if (typeof k.active === 'number' && typeof k.total === 'number') rows.push({ label: 'Active vans', value: `${k.active}/${k.total}` });
        if (typeof k.onTimePct === 'number') rows.push({ label: 'On-time', value: `${Math.round(k.onTimePct)}%` });
        pushDetail(rows, labelIf('Avg ETA', minLabel(k.avgEtaSeconds)));
        if (typeof k.unassigned === 'number') rows.push({ label: 'Unassigned jobs', value: `${k.unassigned}` });
      }
      break;
    }
    case 'eta_matrix': {
      if (Array.isArray(r.ranking)) {
        for (const row of r.ranking.slice(0, 5)) {
          const v = row as Record<string, unknown>;
          if (typeof v.vanId === 'string') {
            rows.push({
              label: v.vanId,
              value: [minLabel(v.etaSeconds), kmLabel(v.distanceMeters)].filter(Boolean).join(' · ') || undefined,
            });
          }
        }
      }
      break;
    }
    case 'set_avoid_zone': {
      if (r.cleared) rows.push({ label: 'Avoid zone', value: 'Cleared' });
      else if (typeof r.rerouted === 'number') rows.push({ label: 'Rerouted', value: `${r.rerouted} van(s)` });
      break;
    }
    case 'set_campaign_business': {
      pushDetail(rows, stringDetail('Business', r.name));
      pushDetail(rows, stringDetail('Address', r.address));
      if (typeof r.rating === 'number') rows.push({ label: 'Rating', value: `${r.rating.toFixed(1)} stars` });
      break;
    }
    case 'gather_campaign_facts': {
      const biz = r.business as Record<string, unknown> | undefined;
      if (biz && typeof biz.name === 'string') rows.push({ label: 'Business', value: biz.name });
      pushDetail(rows, stringDetail('Vibe', r.vibe));
      pushDetail(rows, snapshotDetail('Weather', r.weather, ['tempC', 'condition']));
      pushDetail(rows, snapshotDetail('Air quality', r.airQuality, ['aqi', 'category']));
      if (r.hasStreetViewPhoto || r.hasPlacesPhoto) {
        rows.push({
          label: 'Reference photos',
          value: [r.hasStreetViewPhoto ? 'Street View' : undefined, r.hasPlacesPhoto ? 'Places' : undefined].filter(Boolean).join(' · '),
        });
      }
      break;
    }
    case 'generate_ad_creatives': {
      if (Array.isArray(r.creatives)) {
        for (const creative of r.creatives.slice(0, 5)) {
          const c = creative as Record<string, unknown>;
          rows.push({
            label: typeof c.headline === 'string' && c.headline.trim() ? c.headline : typeof c.style === 'string' ? c.style : 'Creative',
            value: typeof c.style === 'string' ? c.style : undefined,
          });
        }
      }
      break;
    }
    case 'set_geo_targeting': {
      pushDetail(rows, stringDetail('Reach', r.reachSummary));
      if (typeof r.ringPoints === 'number') rows.push({ label: 'Ring points', value: `${r.ringPoints}` });
      break;
    }
    case 'export_campaign': {
      const summary = r.summary as Record<string, unknown> | undefined;
      const biz = summary?.business as Record<string, unknown> | undefined;
      if (biz && typeof biz.name === 'string') rows.push({ label: 'Business', value: biz.name });
      if (Array.isArray(summary?.creatives)) rows.push({ label: 'Creatives', value: `${summary.creatives.length}` });
      const targeting = summary?.targeting as Record<string, unknown> | undefined;
      if (targeting && typeof targeting.reachSummary === 'string') rows.push({ label: 'Targeting', value: targeting.reachSummary });
      break;
    }
    case 'scout_area': {
      if (Array.isArray(r.candidates)) {
        for (const candidate of r.candidates.slice(0, 6)) {
          const c = candidate as Record<string, unknown>;
          rows.push({
            label: typeof c.label === 'string' ? c.label : 'Candidate',
            value: typeof c.address === 'string' ? c.address : undefined,
            placeId: typeof c.placeId === 'string' ? c.placeId : undefined,
          });
        }
      }
      break;
    }
    case 'inspect_candidate': {
      if (Array.isArray(r.headingLabels) && r.headingLabels.length) rows.push({ label: 'Headings', value: r.headingLabels.join(', ') });
      const scores = r.scores as Record<string, unknown> | undefined;
      if (scores) {
        const parts = Object.entries(scores)
          .filter(([, v]) => typeof v === 'number')
          .slice(0, 4)
          .map(([k, v]) => `${k} ${v}`);
        if (parts.length) rows.push({ label: 'Scores', value: parts.join(' · ') });
      }
      pushDetail(rows, stringDetail('Notes', r.notes));
      break;
    }
    case 'score_candidates': {
      if (Array.isArray(r.ranked)) {
        for (const row of r.ranked.slice(0, 5)) {
          const c = row as Record<string, unknown>;
          const scores = c.scores as Record<string, unknown> | undefined;
          const total = scores && typeof scores.total === 'number' ? `${scores.total}` : undefined;
          rows.push({
            label: `#${typeof c.rank === 'number' ? c.rank : '?'} ${typeof c.label === 'string' ? c.label : ''}`.trim(),
            value: total ? `score ${total}` : undefined,
          });
        }
      }
      break;
    }
    case 'show_evidence': {
      pushDetail(rows, stringDetail('Candidate', r.label));
      const scores = r.scores as Record<string, unknown> | undefined;
      if (scores && typeof scores.total === 'number') rows.push({ label: 'Total score', value: `${scores.total}` });
      if (Array.isArray(r.frames)) rows.push({ label: 'Evidence frames', value: `${r.frames.length}` });
      break;
    }
    case 'narrate_stop': {
      pushDetail(rows, stringDetail('Narration', r.narration));
      break;
    }
    case 'start_tour': {
      pushDetail(rows, stringDetail('Tour', r.title));
      break;
    }
    case 'ask_atlas_brief': {
      pushDetail(rows, stringDetail('Brief', r.brief));
      break;
    }
    default:
      break;
  }

  return rows.length ? rows : undefined;
}

function pushDetail(rows: ToolEventDetail[], detail: ToolEventDetail | undefined): void {
  if (detail) rows.push(detail);
}

function labelIf(label: string, value: string | undefined): ToolEventDetail | undefined {
  return value ? { label, value } : undefined;
}

function stringDetail(label: string, value: unknown): ToolEventDetail | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  return { label, value: value.length > 160 ? value.slice(0, 159).trimEnd() + '…' : value };
}

/** Renders a `{key: value}` snapshot (e.g. air quality, weather) into one row. */
function snapshotDetail(label: string, snapshot: unknown, keys: string[]): ToolEventDetail | undefined {
  if (!snapshot || typeof snapshot !== 'object') return undefined;
  const s = snapshot as Record<string, unknown>;
  const parts = keys
    .map((k) => {
      const v = s[k];
      if (v == null) return undefined;
      if (k === 'tempC' && typeof v === 'number') return `${Math.round(v)}°C`;
      if (k === 'aqi') return `AQI ${v}`;
      return String(v);
    })
    .filter(Boolean) as string[];
  return parts.length ? { label, value: parts.join(' · ') } : undefined;
}

function kmLabel(meters: unknown): string | undefined {
  return typeof meters === 'number' ? `${Math.round(meters / 100) / 10} km` : undefined;
}

function minLabel(seconds: unknown): string | undefined {
  return typeof seconds === 'number' ? `${Math.max(1, Math.round(seconds / 60))} min` : undefined;
}

/** Compact, human-readable summary of a tool call's input args for the chip. */
function argsSummary(name: string, a: Record<string, unknown>): string | undefined {
  const str = (k: string) => (typeof a[k] === 'string' && (a[k] as string).trim() ? (a[k] as string) : undefined);
  const numv = (k: string) => (typeof a[k] === 'number' ? (a[k] as number) : undefined);
  const len = (k: string) => (Array.isArray(a[k]) ? (a[k] as unknown[]).length : undefined);
  const coord = () =>
    typeof a.lat === 'number' && typeof a.lng === 'number'
      ? `${(a.lat as number).toFixed(3)}, ${(a.lng as number).toFixed(3)}`
      : undefined;
  const clamp = (v: string | undefined, n = 64) => (v && v.length > n ? v.slice(0, n - 1).trimEnd() + '…' : v);
  const join = (parts: (string | undefined)[]) => parts.filter(Boolean).join(' · ') || undefined;

  switch (name) {
    case 'search_places':
      return join([str('query'), numv('maxResults') != null ? `max ${numv('maxResults')}` : undefined, a.openNow ? 'open now' : undefined]);
    case 'get_place_details':
      return str('placeId');
    case 'fly_to':
      return str('label') ?? coord();
    case 'draw_route':
      return str('travelMode') ? `mode ${str('travelMode')}` : undefined;
    case 'get_environment':
    case 'analyze_location':
    case 'compare_with':
    case 'eta_matrix':
      return coord();
    case 'ask_maps':
    case 'ask_maps_grounding':
      return clamp(str('question'));
    case 'render_surface':
      return len('messages') != null ? `${len('messages')} A2UI message(s)` : undefined;
    case 'assign_job':
      return str('vanId') && str('jobId') ? `${str('vanId')} → ${str('jobId')}` : undefined;
    case 'set_sim_speed':
      return numv('multiplier') != null ? `${numv('multiplier')}×` : undefined;
    case 'set_geo_targeting':
      return join([numv('minutes') != null ? `${numv('minutes')} min` : undefined, str('travelMode')]);
    case 'generate_ad_creatives':
      return join([len('styles') != null ? `${len('styles')} style(s)` : undefined, str('format')]);
    case 'set_campaign_business':
      return clamp(str('brief')) ?? str('placeId');
    case 'scout_area':
      return join([str('query'), coord()]);
    case 'inspect_candidate':
    case 'show_evidence':
      return str('candidateId');
    case 'propose_itinerary':
      return len('stops') != null ? `${len('stops')} stops` : undefined;
    case 'set_travel_mode':
      return str('mode');
    case 'start_tour':
      return str('tourId');
    case 'narrate_stop':
      return str('name');
    default:
      return undefined;
  }
}

function isRetryableStreamError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /\b(429|500|502|503|504)\b|service unavailable|temporar/i.test(msg);
}

function summarizeStreamError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/\b503\b|service unavailable/i.test(msg)) return 'service unavailable';
  if (/\b429\b|quota|rate/i.test(msg)) return 'rate limited';
  return 'transient failure';
}

function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /\b429\b|rate limit|quota|demo is busy/i.test(msg);
}

function sleep(ms: number): Promise<void> {
  // Global setTimeout (not window.setTimeout) so the stream-retry backoff also
  // works outside a browser window (SSR / tests); identical in the browser.
  return new Promise((resolve) => setTimeout(resolve, ms));
}
