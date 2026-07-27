import { atlas } from '@/state/store';
import { missionStore } from './store';

const MISSION_ACCENT = '#60a5fa';

/** Approach then orbit, mirroring the cinema tour's fly3d → dwell → orbit3d cadence. */
const REVEAL_FLY_MS = 3500;
const REVEAL_DWELL_MS = 1200;

/** Rehydrate mission pins after App clears map decorations during scenario navigation. */
export function renderMissionCandidatesOnMap(): void {
  const state = missionStore();
  if (state.mission.status === 'draft' || !state.mission.candidates.length) return;
  const markers = state.mission.candidates.flatMap((candidate) =>
    candidate.location
      ? [{
          id: `mission-${candidate.id}`,
          position: candidate.location,
          glyph: String(candidate.rank ?? '•'),
          title: `${candidate.label}${candidate.source === 'demo' ? ' · deterministic demo fixture' : ''}`,
          color: MISSION_ACCENT,
          kind: 'pin' as const,
          placeId: candidate.place?.id,
          meta: { demo: candidate.source === 'demo', candidateId: candidate.id },
          scenario: 'scout' as const,
        }]
      : [],
  );
  atlas().setMarkers(markers);
  const bounds = state.mission.candidates.flatMap((candidate) => (candidate.location ? [candidate.location] : []));
  if (bounds.length > 1) atlas().setCamera({ kind: 'fit', bounds });
}

/** Restore the selected site after the scenario transition clears the 2D map. */
export function renderMissionReveal(): void {
  const state = missionStore();
  const winner = state.mission.candidates.find((candidate) => candidate.id === state.mission.decision?.candidateId);
  if (!winner?.location) return;
  atlas().setMarkers([
    {
      id: `mission-winner-${winner.id}`,
      position: winner.location,
      glyph: '★',
      title: winner.label,
      color: '#fbbf24',
      kind: 'pin',
      scenario: 'cinema',
      meta: { missionId: state.mission.id, source: winner.source },
    },
  ]);
  const center = { ...winner.location, altitude: 100 };
  // Beat 1: approach the site from a wide, high vantage.
  atlas().setCamera({
    kind: 'fly3d',
    center,
    range: 1200,
    tilt: 55,
    durationMs: REVEAL_FLY_MS,
  });
  // Beat 2 (after the approach settles): orbit the winner.
  setTimeout(() => {
    // Bail if the user navigated away or the decision changed mid-flight.
    if (atlas().activeScenario !== 'cinema') return;
    if (missionStore().mission.decision?.candidateId !== winner.id) return;
    atlas().setCamera({
      kind: 'orbit3d',
      center,
      range: 850,
      tilt: 58,
      repeatCount: 1,
      durationMs: 14000,
    });
  }, REVEAL_FLY_MS + REVEAL_DWELL_MS);
}

