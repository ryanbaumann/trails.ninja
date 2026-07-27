import { atlas } from '@/state/store';
import { buildMissionReplayUrl, buildReplayUrl, shareOrCopy } from '@/lib/share';
import { missionStore } from '@/mission/store';

/**
 * Share the active journey's run as a replay link. The link re-opens Atlas in the
 * same journey + city and re-runs the first prompt of the transcript live, which
 * is far more viral than a static screenshot. Native share sheet when available,
 * clipboard otherwise. Safe to call from any journey UI.
 */
export async function shareActiveRun(): Promise<void> {
  const s = atlas();
  const scenario = s.activeScenario;
  const { mission, mode } = missionStore();
  if (mission.status !== 'draft') {
    const decision = mission.candidates.find((candidate) => candidate.id === mission.decision?.candidateId);
    const url = buildMissionReplayUrl({
      version: 1,
      goal: mission.goal,
      cityId: mission.cityId,
      mode,
      preferences: {
        travelModes: mission.preferences.travelModes,
        maxTravelMinutes: mission.preferences.maxTravelMinutes,
        budget: mission.preferences.budget,
        priorities: mission.preferences.priorities,
        accessibility: mission.preferences.accessibility,
        environmentSensitivities: mission.preferences.environmentSensitivities,
        interests: mission.preferences.interests,
      },
      area: mission.area,
      decisionRank: decision?.rank,
    });
    try {
      const result = await shareOrCopy({ url, title: 'Atlas mission replay', text: mission.goal });
      if (result === 'copied') s.pushToast('info', 'Mission replay link copied. It contains only your inputs and decision rank.');
    } catch { /* user dismissed or sharing unavailable */ }
    return;
  }
  const firstPrompt = s.transcript.find((m) => m.role === 'user')?.text?.trim();
  if (!firstPrompt) {
    s.pushToast('info', 'Ask Atlas something first, then share the replay link.');
    return;
  }
  const url = buildReplayUrl({ scenario, cityId: s.cityId, prompt: firstPrompt });
  try {
    const result = await shareOrCopy({ url, title: 'Atlas — watch this run live', text: firstPrompt });
    if (result === 'copied') {
      s.pushToast('info', 'Replay link copied — anyone who opens it watches Atlas run this live.');
    }
  } catch {
    // User dismissed the share sheet, or sharing is unavailable — no-op.
  }
}
