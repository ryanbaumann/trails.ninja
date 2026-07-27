// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useMission } from '@/mission/store';
import { ClaimLens, factorPercent } from './ClaimLens';
import type { MissionCandidate } from './types';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(async () => {
  useMission.getState().reset('sf');
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const DEMO_CANDIDATE: MissionCandidate = {
  id: 'demo-a',
  label: 'Demo Candidate A',
  location: { lat: 37.77, lng: -122.42 },
  score: 82,
  confidence: 0.75,
  rank: 1,
  inspectionState: 'scored',
  factors: {
    visibility: 84,
    condition: 73,
    activity: 58,
    access: 87,
    environment: 76,
  },
  evidenceIds: ['demo-evidence-a'],
  source: 'demo',
};

describe('ClaimLens', () => {
  it('renders nothing when no candidate is selected', async () => {
    await act(async () => root.render(<ClaimLens />));
    expect(container.querySelector('.claim-lens')).toBeNull();
  });

  it('renders the selected candidate with label and factor bars', async () => {
    useMission.getState().setCandidates([DEMO_CANDIDATE]);
    useMission.getState().selectCandidate('demo-a');
    await act(async () => root.render(<ClaimLens />));

    expect(container.textContent).toContain('Demo Candidate A');
    expect(container.textContent).toContain('Demo fixture');
    // Factor rows now render canonical labels (FACTOR_LABELS), not raw keys.
    expect(container.textContent).toContain('Visibility');
    expect(container.textContent).toContain('Budget fit');
    expect(container.textContent).toContain('Vibe');
    expect(container.textContent).toContain('Access');
    expect(container.textContent).toContain('Environment');
    expect(container.textContent).toContain('84');
    expect(container.textContent).toContain('73');
  });

  it('shows the Approve button and triggers approval on click', async () => {
    useMission.getState().setCandidates([DEMO_CANDIDATE]);
    useMission.getState().selectCandidate('demo-a');
    await act(async () => root.render(<ClaimLens />));

    const approveButton = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Approve this site'),
    )!;
    expect(approveButton).toBeTruthy();

    await act(async () => approveButton.click());
    await act(async () => root.render(<ClaimLens />));

    const { mission } = useMission.getState();
    expect(mission.decision?.candidateId).toBe('demo-a');
    expect(mission.decision?.approvedAt).toBeTruthy();
    expect(container.querySelector('.claim-lens__approve')).toBeNull();
  });

  it('hides the Approve button when the candidate is already approved', async () => {
    useMission.getState().setCandidates([DEMO_CANDIDATE]);
    useMission.getState().selectCandidate('demo-a');
    useMission.getState().approveDecision('demo-a', 'Test approval');
    await act(async () => root.render(<ClaimLens />));

    const approveButton = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Approve this site'),
    );
    expect(approveButton).toBeUndefined();
  });

  it('closes the panel when the close button is clicked', async () => {
    useMission.getState().setCandidates([DEMO_CANDIDATE]);
    useMission.getState().selectCandidate('demo-a');
    await act(async () => root.render(<ClaimLens />));

    const closeButton = container.querySelector('.claim-lens__close') as HTMLButtonElement;
    expect(closeButton).toBeTruthy();

    await act(async () => closeButton.click());
    await act(async () => root.render(<ClaimLens />));

    expect(useMission.getState().mission.selectedCandidateId).toBeUndefined();
  });
});

describe('factorPercent', () => {
  it('clamps values to 0-100 range', () => {
    expect(factorPercent(50)).toBe(50);
    expect(factorPercent(0)).toBe(0);
    expect(factorPercent(100)).toBe(100);
    expect(factorPercent(-10)).toBe(0);
    expect(factorPercent(150)).toBe(100);
  });
});
