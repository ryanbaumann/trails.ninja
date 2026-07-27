import { Check, RotateCcw, Sparkles, Undo2 } from 'lucide-react';
import { resumeCopilot } from '@/ai/session';
import { useMission } from './store';
import {
  approveMissionCandidate,
  handoffMissionToAdStudio,
  revealMissionIn3D,
} from './controller';
import type { Mission } from './types';
import { useAtlas } from '@/state/store';
import './MissionHeader.css';

/** Shared stage model — MissionHeader and MissionSpine render the same spine. */
export const MISSION_STAGES = ['Observe', 'Ground', 'Compare', 'Approve', 'Create', 'Reveal'] as const;

/**
 * Compact mission controller folded into the top of the Scout context drawer.
 * Shows the data mode, a slim stage indicator, and the single primary action
 * for the current step. This replaces the old floating MissionRibbon — the
 * state machine and action handlers are unchanged; only the surface moved.
 */
export function MissionHeader() {
  const mission = useMission((state) => state.mission);
  const mode = useMission((state) => state.mode);
  const undo = useMission((state) => state.undoApproval);
  const drawerOpen = useAtlas((s) => s.drawerOpen);
  if (mission.status === 'draft') return null;

  const ranked = [...mission.candidates].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  const winner = ranked.find((candidate) => candidate.id === mission.decision?.candidateId) ?? ranked[0];
  const approved = !!mission.decision?.approvedAt;
  const hasCampaign = mission.artifacts.some((artifact) => artifact.kind === 'campaign');
  const current = missionStageIndex(mission);

  return (
    <section className="mission-header" aria-label="Flagship mission controller" tabIndex={-1}>
      <div className="mission-header__topline">
        <span className={`mission-mode mission-mode--${mode}`}>{mode === 'live' ? '● Live' : '◆ Demo'}</span>
        <strong title={mission.goal}>{mission.goal}</strong>
      </div>
      <ol className="mission-header__stages" aria-label="Mission progress">
        {MISSION_STAGES.map((stage, index) => (
          <li key={stage} className={index < current ? 'is-done' : index === current ? 'is-active' : ''}>
            {index < current ? <Check size={11} aria-hidden="true" /> : <i className="mission-header__dot" aria-hidden="true" />}
            <span>{stage}</span>
          </li>
        ))}
      </ol>
      {approved && mission.decision?.rationale ? (
        <p className="mission-header__rationale">{mission.decision.rationale}</p>
      ) : null}
      {drawerOpen ? (
        <div className="mission-header__actions">
          {mission.status === 'partial' ? (
            <button className="mission-action" onClick={() => resumeCopilot()}>
              <RotateCcw size={13} /> Resume mission
            </button>
          ) : null}
          {winner && !approved ? (
            <button className="mission-action mission-action--primary" data-testid="mission-action" onClick={() => approveMissionCandidate(winner.id)}>
              <Check size={13} /> Approve #{winner.rank ?? 1} {winner.label}
            </button>
          ) : null}
          {approved ? (
            <button className="mission-action" onClick={undo}>
              <Undo2 size={13} /> Undo approval
            </button>
          ) : null}
          {approved && mission.status === 'approved' ? (
            <button className="mission-action mission-action--primary" data-testid="mission-action" onClick={() => handoffMissionToAdStudio()}>
              <Sparkles size={13} /> Create campaign
            </button>
          ) : null}
          {mission.campaignReadiness.status === 'ready' && hasCampaign && approved ? (
            <button className="mission-action mission-action--primary" data-testid="mission-action" onClick={() => revealMissionIn3D()}>
              Reveal in 3D
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/**
 * Active stage index into MISSION_STAGES. Shared by MissionHeader and
 * MissionSpine so both narrators agree. Stages before it read as done,
 * the one at it reads as active.
 */
export function missionStageIndex(mission: Mission): number {
  const approved = !!mission.decision?.approvedAt;
  const revealed = mission.artifacts.some((artifact) => artifact.kind === 'reveal');
  const hasCampaign = mission.artifacts.some((artifact) => artifact.kind === 'campaign');
  if (revealed) return 6; // all stages done
  if (mission.campaignReadiness.status === 'ready' || hasCampaign) return 5; // Reveal
  if (mission.status === 'complete' || mission.status === 'creating') return 4; // Create
  if (approved || mission.status === 'approved') return 3; // Approve
  if (mission.status === 'comparing') return 2; // Compare
  if (mission.evidence.length > 0) return 1; // Ground
  return 0; // Observe
}
