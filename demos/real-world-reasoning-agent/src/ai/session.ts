import { CopilotEngine } from './engine';
import { SCENARIOS } from '@/scenarios/registry';
import { atlas, useAtlas } from '@/state/store';
import type { ScenarioId } from '@/lib/types';
import { subscribeGeminiCredential } from './client';

// ONE engine for the session. The active recipe selects the system prompt and
// the capability profile (tool set); changing recipes re-arms the same agent
// rather than swapping to a parallel one with its own history.
let engine: CopilotEngine | null = null;
let engineRecipe: ScenarioId | null = null;

function discardEngine(): void {
  engine?.abort();
  engine = null;
  engineRecipe = null;
}

function currentEngine(): CopilotEngine {
  const s = atlas();
  const recipe = s.activeScenario;
  if (!engine || engineRecipe !== recipe) {
    // Re-arming for a different recipe: the SDK chat is rebuilt with that
    // recipe's prompt and tools.
    engine?.abort();
    const mod = SCENARIOS[recipe];
    engine = new CopilotEngine(recipe, mod.systemPrompt, mod.tools, s.cityId, s.chatModel, s.chatThinking);
    engineRecipe = recipe;
  }
  return engine;
}

// A city change invalidates grounded context: drop the engine, the session, and
// the map decorations together.
useAtlas.subscribe((state, prev) => {
  if (state.cityId !== prev.cityId) {
    discardEngine();
    state.clearChat();
    state.clearMap();
  }
});

// A personal-key connect/disconnect recreates the SDK client. Discard the cached
// chat at the same boundary so no request continues with stale auth.
subscribeGeminiCredential(discardEngine);

// Rebuild the engine when the admin panel changes the chat model / thinking level,
// so the next turn uses the new config. Transcript + map are kept (it's a live
// A/B), but the rebuilt engine starts a fresh SDK chat.
useAtlas.subscribe((state, prev) => {
  if (state.chatModel !== prev.chatModel || state.chatThinking !== prev.chatThinking) {
    discardEngine();
  }
});

/** Send text to the session's copilot. */
export function sendToCopilot(text: string): void {
  void currentEngine().send(text);
}

/** Send application-owned orchestration without presenting it as a human chat message. */
export function sendInternalToCopilot(text: string): void {
  void currentEngine().send(text, { showUserMessage: false });
}

// Replay links carry a prompt in the URL (?prompt=). Run it exactly once after
// the app mounts so a shared run reasons live for the recipient. The module-level
// latch survives React strict-mode's double-invoke of mount effects.
let replayFired = false;
export function runPendingReplayPrompt(): void {
  if (replayFired) return;
  const s = atlas();
  const prompt = s.pendingPrompt;
  if (!prompt || !s.landingDismissed) return;
  replayFired = true;
  s.clearPendingPrompt();
  sendToCopilot(prompt);
}

/**
 * Stop the session's in-flight query: records the prompt as resumable and
 * silences speech. No-op when nothing is armed or running.
 */
export function abortCopilot(): void {
  engine?.abort();
}

/** Re-arm the agent with a clean SDK context, keeping the visible session. */
export function resetCopilot(): void {
  discardEngine();
}

/**
 * Switch the agent to a different recipe as a deliberate user act.
 *
 * A recipe change re-briefs the agent with a new prompt and a new capability
 * profile, so prior turns are NOT in the rebuilt SDK context. Leaving the old
 * transcript on screen therefore showed a conversation the agent could no longer
 * remember, and — because the canvas only offers starters when it has nothing to
 * show — it also hid the new recipe's suggestions behind the previous journey's
 * answer. Clearing here keeps what is on screen equal to what the agent knows.
 *
 * Deliberately NOT wired into `setScenario`: the mission handoffs
 * (`continueMissionInAdStudio`, `revealMissionIn3D`) cross recipes mid-narrative
 * and must keep their history — the reveal is the payoff of the transcript above
 * it. Only an explicit recipe pick resets.
 */
export function switchRecipe(id: ScenarioId): void {
  const s = atlas();
  if (s.activeScenario === id) return;
  // Abort before clearing: abort() records the interrupted prompt as resumable,
  // and that resumable belongs to the recipe being left behind.
  discardEngine();
  s.clearChat();
  s.setScenario(id);
}

/** Re-run the session's interrupted prompt from scratch. */
export function resumeCopilot(): void {
  engine?.resume();
}
