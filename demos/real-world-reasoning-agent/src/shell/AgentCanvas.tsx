/**
 * AgentCanvas — the agent's one surface.
 *
 * Everything the agent produces (progress, evidence surfaces, the answer, next
 * actions) lives here, in one column that is a real part of the layout grid
 * rather than a stack of cards floating over the map. That has two consequences
 * the old dock could not deliver:
 *
 *  1. One canonical surface per stage. The context drawer used to render a
 *     second, competing view of the same decision; the dock stacked up to six
 *     independent strips above the composer. Both collapse into this column.
 *  2. The map's usable rectangle becomes a declared grid cell instead of
 *     something the camera has to measure off the DOM.
 *
 * On narrow viewports the same column becomes a bottom sheet with peek / half /
 * full snap points, so the result is one bounded sheet with an obvious
 * collapse/expand control instead of competing floating chrome.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, MapPin, RotateCcw, Share2 } from 'lucide-react';
import { useAtlas } from '@/state/store';
import { SCENARIOS } from '@/scenarios/registry';
import { resumeCopilot, sendToCopilot } from '@/ai/session';
import type { ChatMsg, ScenarioId, ToolEvent } from '@/lib/types';
import { SurfaceView } from '@/genui/SurfaceView';
import { Markdown } from '@/genui/components/Markdown';
import { useAdStudio } from '@/scenarios/adstudio/store';
import { MAX_CREATIVES_PER_SESSION } from '@/scenarios/adstudio/limits';
import { labelForTool } from '@/shell/toolLabels';
import { rationaleForTool } from '@/ai/toolLabels';
import { shareActiveRun } from '@/shell/shareRun';
import { revealMissionIn3D } from '@/mission/controller';
import { RECIPES_BY_ID } from '@/recipes/registry';

/** The follow-up chip that triggers the 3D reveal directly (not via the model),
 *  so the mission payoff stays a deliberate one-click action. Carries the shared
 *  mission-action test id. */
const REVEAL_FOLLOWUP = 'Reveal in 3D';

/** Snap points for the mobile sheet, as a share of the shell height. */
export const SHEET_SNAPS = ['peek', 'half', 'full'] as const;
export type SheetSnap = (typeof SHEET_SNAPS)[number];

export function AgentCanvas() {
  const scenario = useAtlas((s) => s.activeScenario);
  const msgs = useAtlas((s) => s.transcript);
  const telemetry = useAtlas((s) => s.telemetry);
  const streaming = useAtlas((s) => s.running);
  const resumable = useAtlas((s) => s.resumable);
  const followups = useAtlas((s) => s.followups);
  const adCreatives = useAdStudio((s) => s.creatives);
  const gatheringAdFacts = useAdStudio((s) => s.gatheringFacts);
  const [snap, setSnap] = useState<SheetSnap>('half');
  const scrollRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const prevMsgCount = useRef(0);
  const autoScroll = useRef<{ active: boolean; timer: number | null; wasAtBottom: boolean }>({
    active: false,
    timer: null,
    wasAtBottom: true,
  });
  const setViewport = useAtlas((s) => s.setViewport);

  // Publish how much of the map this panel actually covers. On desktop the
  // canvas is its own grid column and covers nothing, so it reports zero; on
  // mobile it floats over the map and reports its own height. This is the only
  // place that knows the number, which is why the camera no longer guesses it.
  useEffect(() => {
    const el = sheetRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const publish = () => {
      const overlapsMap = window.getComputedStyle(el).position === 'absolute';
      setViewport({ top: 0, right: 0, bottom: overlapsMap ? el.getBoundingClientRect().height : 0, left: 0 });
    };
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    window.addEventListener('resize', publish);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', publish);
      setViewport({ top: 0, right: 0, bottom: 0, left: 0 });
    };
  }, [setViewport]);

  const mod = SCENARIOS[scenario];
  const runningTools = telemetry.filter((t) => t.status === 'running');
  const latestStreamingMsg = [...msgs].reverse().find((m) => m.streaming);
  const activeSince = runningTools[0]?.ts ?? latestStreamingMsg?.ts;
  const active =
    streaming ||
    runningTools.length > 0 ||
    (scenario === 'adstudio' && (gatheringAdFacts || adCreatives.some((c) => c.status === 'generating')));
  const elapsed = useElapsedLabel(active, activeSince);
  // Starters come from the recipe manifest, the same record the picker reads and
  // that `recipes/registry.test.ts` holds to the recipe's real capabilities — so
  // a suggestion can never advertise an action the runtime lacks.
  const suggestions = RECIPES_BY_ID.get(scenario)?.starters ?? mod.suggestions;

  // Keep the newest agent output in view WITHOUT stealing the scroll position
  // from someone who deliberately scrolled up to re-read earlier evidence. We
  // only auto-scroll when they were already at the bottom, or when they just
  // sent a message (then they want to watch the answer).
  useEffect(() => {
    const region = scrollRef.current;
    if (!region) return;

    const isNewMessage = msgs.length > prevMsgCount.current;
    prevMsgCount.current = msgs.length;
    const sentByUser = isNewMessage && msgs[msgs.length - 1]?.role === 'user';
    if (!sentByUser && !autoScroll.current.wasAtBottom) return;

    // A live evidence surface is the payload, so anchor to it rather than to the
    // very bottom of the transcript.
    autoScroll.current.active = true;
    const surface = region.querySelector<HTMLElement>('.genui-surface:last-of-type');
    const top = surface
      ? surface.getBoundingClientRect().top - region.getBoundingClientRect().top + region.scrollTop
      : region.scrollHeight;
    region.scrollTo({ top, behavior: 'smooth' });
    if (autoScroll.current.timer !== null) window.clearTimeout(autoScroll.current.timer);
    autoScroll.current.timer = window.setTimeout(() => {
      autoScroll.current.active = false;
    }, 500);
  }, [msgs, snap]);

  // A programmatic scroll fires onScroll too; `active` keeps it from being
  // mistaken for the user scrolling away.
  const onScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    if (autoScroll.current.active) return;
    const el = event.currentTarget;
    autoScroll.current.wasAtBottom = Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) < 60;
  }, []);

  const onUserScrollIntent = useCallback(() => {
    autoScroll.current.active = false;
    if (autoScroll.current.timer !== null) {
      window.clearTimeout(autoScroll.current.timer);
      autoScroll.current.timer = null;
    }
  }, []);

  // Work arriving while the sheet is collapsed should reveal itself.
  useEffect(() => {
    if (active) setSnap((s) => (s === 'peek' ? 'half' : s));
  }, [active]);

  const cycleSnap = useCallback(() => {
    setSnap((s) => (s === 'peek' ? 'half' : s === 'half' ? 'full' : 'peek'));
  }, []);

  const hasResult = msgs.length > 0;

  return (
    <aside
      ref={sheetRef}
      className={`agent-canvas agent-canvas--${snap}`}
      data-snap={snap}
      aria-label="Atlas agent"
    >
      <button
        type="button"
        className="agent-canvas__grip"
        onClick={cycleSnap}
        aria-label={`Resize the agent panel (currently ${snap})`}
        aria-expanded={snap !== 'peek'}
      >
        <span className="agent-canvas__grip-bar" aria-hidden="true" />
        <ChevronDown size={16} aria-hidden="true" className="agent-canvas__grip-chevron" />
      </button>

      <div
        className="agent-canvas__scroll"
        ref={scrollRef}
        onScroll={onScroll}
        onWheel={onUserScrollIntent}
        onTouchStart={onUserScrollIntent}
      >
        {active && (
          <ActiveWorkPanel
            telemetry={telemetry}
            runningTools={runningTools}
            elapsed={elapsed}
            adStudio={
              scenario === 'adstudio'
                ? {
                    generating: adCreatives.filter((c) => c.status === 'generating').length,
                    ready: adCreatives.filter((c) => c.status === 'ready').length,
                    errors: adCreatives.filter((c) => c.status === 'error').length,
                    total: adCreatives.length,
                    remaining: Math.max(0, MAX_CREATIVES_PER_SESSION - adCreatives.length),
                    gatheringFacts: gatheringAdFacts,
                  }
                : undefined
            }
          />
        )}

        {msgs.map((m, i) => (
          <Message key={m.id} msg={m} nextMsg={msgs[i + 1]} scenario={scenario} active={active} />
        ))}

        {!hasResult && !active && (
          <div className="agent-canvas__starters">
            <p className="agent-canvas__starters-label">Try</p>
            {suggestions.map((s) => (
              <button key={s} onClick={() => sendToCopilot(s)} className="agent-canvas__starter" title={s}>
                {s}
              </button>
            ))}
          </div>
        )}

        {!streaming && !active && hasResult && (
          <div className="agent-canvas__actions" aria-label="Suggested next steps">
            {followups.map((s) => (
              <button
                key={s}
                onClick={() => (s === REVEAL_FOLLOWUP ? revealMissionIn3D() : sendToCopilot(s))}
                data-testid={s === REVEAL_FOLLOWUP ? 'mission-action' : undefined}
                className="agent-canvas__action"
                title={s}
              >
                <ArrowRight size={13} aria-hidden="true" />
                {s}
              </button>
            ))}
            {resumable && (
              <button
                onClick={() => resumeCopilot()}
                className="agent-canvas__action"
                aria-label="Resume the interrupted request"
                title={resumable}
              >
                <RotateCcw size={13} aria-hidden="true" />
                Resume
              </button>
            )}
            <button
              onClick={() => void shareActiveRun()}
              className="agent-canvas__action agent-canvas__action--share"
              title="Share a link that replays this run live"
            >
              <Share2 size={13} aria-hidden="true" />
              Share this run
            </button>
          </div>
        )}

        {telemetry.length > 0 && (
          <details className="agent-canvas__disclosure">
            <summary>How it worked</summary>
            <div className="agent-canvas__chips">
              {telemetry.slice(-8).map((t) => (
                <ToolChip key={t.id} event={t} scenario={scenario} />
              ))}
            </div>
          </details>
        )}

        {/* The recipe's own panel is subordinate to the agent's surface — one
            decision is never presented twice at the same level. It moves into
            the canvas here rather than competing from a second drawer.
            Keyed by recipe: each recipe's populated-hook reads a different
            store, so a switch must remount rather than reorder hooks. */}
        <WorkspaceDisclosure key={scenario} scenario={scenario} />
      </div>
    </aside>
  );
}

/**
 * The recipe's workspace panel, open by default once the recipe has built
 * something worth reading.
 *
 * Collapsed-when-empty is right (an empty panel should not compete with the
 * answer) but collapsed-when-full hid the actual result — the itinerary, the
 * dossier, the creatives — behind a click. So the recipe's own store decides the
 * default, and an explicit click always wins over it afterwards: `override`
 * starts null, and once set it is never recomputed, so the panel will not spring
 * back open on the next store update.
 */
function WorkspaceDisclosure({ scenario }: { scenario: ScenarioId }) {
  const mod = SCENARIOS[scenario];
  const populated = mod.useWorkspacePopulated?.() ?? false;
  const [override, setOverride] = useState<boolean | null>(null);
  const open = override ?? populated;
  return (
    <details className="agent-canvas__disclosure agent-canvas__disclosure--panel" open={open}>
      {/* `open` is fully controlled, so suppress the native toggle and own it
          here — otherwise React's prop and the DOM's own state disagree. A
          summary also fires click for Enter/Space, so keyboard works unchanged. */}
      <summary
        onClick={(event) => {
          event.preventDefault();
          setOverride(!open);
        }}
      >
        {mod.title} workspace
      </summary>
      <div className="agent-canvas__panel panel-scroll">
        <mod.Panel />
      </div>
    </details>
  );
}

function useElapsedLabel(active: boolean, startTs?: number): string {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active, startTs]);

  if (!active || !startTs) return '';
  const seconds = Math.max(0, Math.round((now - startTs) / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
}

function ActiveWorkPanel({
  telemetry,
  runningTools,
  elapsed,
  adStudio,
}: {
  telemetry: ToolEvent[];
  runningTools: ToolEvent[];
  elapsed: string;
  adStudio?: {
    generating: number;
    ready: number;
    errors: number;
    total: number;
    remaining: number;
    gatheringFacts: boolean;
  };
}) {
  const current = runningTools.at(-1);
  const label = current
    ? labelForTool(current.name)
    : adStudio?.generating
      ? 'Generating ad creatives'
      : 'Atlas is working';
  // The WHY behind the running tool, shown in place of the static subtitle so the
  // user sees the agent's reasoning live. Falls back gracefully when absent.
  const rationale = current ? rationaleForTool(current.name) : undefined;
  const recentDone = telemetry.filter((t) => t.status !== 'running').slice(-3);
  const adStatus = adStudio
    ? adStudio.generating > 0
      ? `${adStudio.generating} generating · ${adStudio.ready}/${MAX_CREATIVES_PER_SESSION} ready · ${adStudio.remaining} left`
      : adStudio.gatheringFacts
        ? 'Collecting grounded facts before image generation'
        : `${adStudio.ready}/${MAX_CREATIVES_PER_SESSION} creatives ready`
    : undefined;

  return (
    <div className="copilot-progress" role="status" aria-live="polite" aria-label="Atlas work in progress">
      <div className="copilot-progress__top">
        <span className="copilot-progress__spinner" aria-hidden="true" />
        <div className="copilot-progress__copy">
          <div className="copilot-progress__title">{label}</div>
          <div className="copilot-progress__detail">
            {adStatus ?? rationale ?? 'Atlas is checking the configured tools and sources.'}
            {elapsed ? ` · ${elapsed}` : ''}
          </div>
        </div>
      </div>
      <div className="copilot-progress__meter" aria-hidden="true">
        <span />
      </div>
      {(runningTools.length > 1 || recentDone.length > 0) && (
        <div className="copilot-progress__steps">
          {runningTools.slice(-2).map((tool) => (
            <span key={tool.id} className="copilot-progress__step is-running">
              {labelForTool(tool.name)}
            </span>
          ))}
          {recentDone.map((tool) => (
            <span key={tool.id} className={`copilot-progress__step is-${tool.status}`}>
              {labelForTool(tool.name)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A completed tool call. Inside the canvas column there is a real block to
 * expand into, so the details render inline instead of as a manually positioned
 * viewport-clamped popover.
 */
function ToolChip({ event, scenario }: { event: ToolEvent; scenario: string }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  // Close when the recipe changes (the chips belong to that run).
  useEffect(() => {
    if (detailsRef.current) detailsRef.current.open = false;
  }, [scenario]);

  const body = (
    <>
      <span aria-hidden="true">{event.status === 'running' ? '◍' : event.status === 'ok' ? '✓' : '✕'}</span>
      <span>{labelForTool(event.name)}</span>
      {event.summary ? <span className="copilot-toolchip__summary">{event.summary}</span> : null}
    </>
  );
  if (!event.details?.length) {
    return <span className={`copilot-toolchip copilot-toolchip--${event.status}`}>{body}</span>;
  }
  return (
    <details ref={detailsRef} className={`copilot-toolchip-details copilot-toolchip-details--${event.status}`}>
      <summary className="copilot-toolchip">{body}</summary>
      <div className="copilot-toolchip-details__body">
        {event.details.map((detail, index) => (
          <div key={`${detail.placeId ?? detail.label}-${index}`} className="copilot-toolchip-details__row">
            <MapPin size={13} aria-hidden="true" />
            <div>
              <div className="copilot-toolchip-details__label">{detail.label}</div>
              {detail.value ? <div className="copilot-toolchip-details__value">{detail.value}</div> : null}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

function Message({
  msg,
  nextMsg,
  scenario,
  active = false,
}: {
  msg: ChatMsg;
  nextMsg?: ChatMsg;
  scenario: string;
  active?: boolean;
}) {
  if (msg.role === 'user') {
    return (
      <div className="agent-canvas__user">
        <div className="agent-canvas__user-bubble">{msg.text}</div>
      </div>
    );
  }
  if (msg.role === 'widget') {
    return <GmpWidget token={msg.widgetContextToken} />;
  }
  if (msg.role === 'notice') {
    return (
      <div className="agent-canvas__notice">
        <div className="agent-canvas__notice-title">{msg.notice?.title}</div>
        <div className="agent-canvas__notice-body">{msg.notice?.body}</div>
      </div>
    );
  }
  if (msg.role === 'surface') {
    if (!msg.surfaceId) return null;
    return (
      <div className="genui-surface">
        <SurfaceView surfaceId={msg.surfaceId} />
      </div>
    );
  }
  if (msg.role === 'tool') {
    // Tool calls surface under "How it worked"; nothing to render inline.
    return null;
  }
  // model
  // Provisional prose belongs to the compact work indicator. Reveal it only
  // when it becomes the final answer so "thinking" never looks authoritative.
  if (msg.streaming && active) {
    return null;
  }
  return (
    <div className="copilot-message">
      <Markdown text={msg.text ?? ''} />
      {msg.streaming && <span className="copilot-message__cursor" aria-hidden="true"> ▋</span>}
      {!msg.streaming && scenario === 'adstudio' && shouldShowAdStyleFallback(msg, nextMsg) ? (
        <AdStyleFallback />
      ) : null}
    </div>
  );
}

function shouldShowAdStyleFallback(msg: ChatMsg, nextMsg?: ChatMsg): boolean {
  if (nextMsg?.role === 'surface') return false;
  const text = msg.text ?? '';
  return /select .*visual styles? below|choose .*visual styles? below|styles? below/i.test(text);
}

const FALLBACK_AD_STYLES = [
  'warm golden-hour photo',
  'bold flat-color poster',
  'clean premium product ad',
  'rainy-day cozy storefront',
];

function AdStyleFallback() {
  return (
    <div className="copilot-style-fallback" aria-label="Visual style choices">
      {FALLBACK_AD_STYLES.map((style) => (
        <button
          key={style}
          type="button"
          className="copilot-style-fallback__chip"
          onClick={() => sendToCopilot(`Use this visual style: ${style}`)}
        >
          {style}
        </button>
      ))}
    </div>
  );
}

/** Imperative mount of the grounded Google Maps widget (CF8). */
function GmpWidget({ token }: { token?: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (ref.current && token) (ref.current as unknown as { contextToken: string }).contextToken = token;
  }, [token]);
  return (
    <div className="agent-canvas__widget">
      <div className="agent-canvas__widget-label">Grounded with Google Maps</div>
      <gmp-place-contextual ref={ref as never} />
    </div>
  );
}
