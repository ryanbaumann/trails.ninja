// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useMission } from '@/mission/store';
import { EvidenceStrip, formatConfidence, formatHeading, formatTimestamp } from './EvidenceStrip';
import type { EvidenceRef, MissionCandidate } from './types';

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

describe('EvidenceStrip', () => {
  it('renders provenance badges and confidence percentages', async () => {
    const evidence: EvidenceRef[] = [
      {
        id: 'e1',
        kind: 'streetview',
        provenance: 'observed',
        sourceLabel: 'Google Street View',
        confidence: 0.87,
      },
      {
        id: 'e2',
        kind: 'aerial',
        provenance: 'computed',
        sourceLabel: 'Aerial analysis',
        confidence: 0.92,
      },
    ];

    useMission.setState((s) => ({
      mission: { ...s.mission, evidence, status: 'comparing' },
    }));

    await act(async () => root.render(<EvidenceStrip />));

    expect(container.textContent).toContain('observed');
    expect(container.textContent).toContain('computed');
    expect(container.textContent).toContain('87% confidence');
    expect(container.textContent).toContain('92% confidence');
    expect(container.textContent).toContain('Google Street View');
  });

  it('shows timestamps only when observedAt is present', async () => {
    const evidence: EvidenceRef[] = [
      {
        id: 'e1',
        kind: 'streetview',
        provenance: 'observed',
        sourceLabel: 'Street View',
        observedAt: '2024-06-15T14:30:00Z',
      },
      {
        id: 'e2',
        kind: 'aerial',
        provenance: 'computed',
        sourceLabel: 'Aerial',
        // No observedAt
      },
    ];

    useMission.setState((s) => ({
      mission: { ...s.mission, evidence, status: 'comparing' },
    }));

    await act(async () => root.render(<EvidenceStrip />));

    // First evidence should show timestamp
    expect(container.textContent).toMatch(/Jun.*2024/);
    // Count how many timestamp elements exist
    const timestamps = container.querySelectorAll('.evidence-timestamp');
    expect(timestamps.length).toBe(1);
  });

  it('renders limitations as a bulleted list when present', async () => {
    const evidence: EvidenceRef[] = [
      {
        id: 'e1',
        kind: 'place',
        provenance: 'inferred',
        sourceLabel: 'Place photo',
        limitations: ['Photo may not show current frontage', 'Image from 2023'],
      },
      {
        id: 'e2',
        kind: 'weather',
        provenance: 'generated',
        sourceLabel: 'Weather forecast',
        // No limitations
      },
    ];

    useMission.setState((s) => ({
      mission: { ...s.mission, evidence, status: 'comparing' },
    }));

    await act(async () => root.render(<EvidenceStrip />));

    expect(container.textContent).toContain('Photo may not show current frontage');
    expect(container.textContent).toContain('Image from 2023');

    const limitationLists = container.querySelectorAll('.evidence-limitations');
    expect(limitationLists.length).toBe(1);
  });

  it('filters evidence by selected candidate evidenceIds', async () => {
    const evidence: EvidenceRef[] = [
      { id: 'e1', kind: 'streetview', provenance: 'observed', sourceLabel: 'View 1' },
      { id: 'e2', kind: 'aerial', provenance: 'observed', sourceLabel: 'View 2' },
      { id: 'e3', kind: 'place', provenance: 'computed', sourceLabel: 'View 3' },
    ];

    const candidates: MissionCandidate[] = [
      {
        id: 'c1',
        label: 'Café Alpha',
        evidenceIds: ['e1', 'e2'],
        inspectionState: 'observed',
        source: 'live',
      },
      {
        id: 'c2',
        label: 'Café Beta',
        evidenceIds: ['e3'],
        inspectionState: 'observed',
        source: 'live',
      },
    ];

    useMission.setState((s) => ({
      mission: {
        ...s.mission,
        evidence,
        candidates,
        selectedCandidateId: 'c1',
        status: 'comparing',
      },
    }));

    await act(async () => root.render(<EvidenceStrip />));

    expect(container.textContent).toContain('View 1');
    expect(container.textContent).toContain('View 2');
    expect(container.textContent).not.toContain('View 3');
    expect(container.textContent).toContain('for Café Alpha');
  });

  it('returns null when no evidence exists', async () => {
    useMission.setState((s) => ({
      mission: { ...s.mission, evidence: [], status: 'comparing' },
    }));

    await act(async () => root.render(<EvidenceStrip />));

    expect(container.innerHTML).toBe('');
  });

  it('shows heading when present', async () => {
    const evidence: EvidenceRef[] = [
      {
        id: 'e1',
        kind: 'streetview',
        provenance: 'observed',
        sourceLabel: 'Street View',
        heading: 123.45,
      },
    ];

    useMission.setState((s) => ({
      mission: { ...s.mission, evidence, status: 'comparing' },
    }));

    await act(async () => root.render(<EvidenceStrip />));

    expect(container.textContent).toContain('heading 123°');
  });
});

describe('formatConfidence', () => {
  it('formats confidence as percentage', () => {
    expect(formatConfidence(0.87)).toBe('87%');
    expect(formatConfidence(0.5)).toBe('50%');
    expect(formatConfidence(1.0)).toBe('100%');
  });

  it('returns null for undefined', () => {
    expect(formatConfidence(undefined)).toBe(null);
  });
});

describe('formatTimestamp', () => {
  it('formats ISO timestamp to readable date', () => {
    const result = formatTimestamp('2024-06-15T14:30:00Z');
    expect(result).toMatch(/Jun.*15.*2024/);
  });

  it('returns null for undefined or invalid', () => {
    expect(formatTimestamp(undefined)).toBe(null);
    expect(formatTimestamp('invalid')).toBe(null);
  });
});

describe('formatHeading', () => {
  it('formats heading in degrees', () => {
    expect(formatHeading(123.45)).toBe('heading 123°');
    expect(formatHeading(0)).toBe('heading 0°');
    expect(formatHeading(359.9)).toBe('heading 360°');
  });

  it('returns null for undefined', () => {
    expect(formatHeading(undefined)).toBe(null);
  });
});
