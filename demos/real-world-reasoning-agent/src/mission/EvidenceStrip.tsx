import { useMission } from '@/mission/store';
import type { EvidenceRef } from './types';
import './EvidenceStrip.css';

export function formatConfidence(confidence: number | undefined): string | null {
  if (confidence == null) return null;
  return `${Math.round(confidence * 100)}%`;
}

export function formatTimestamp(isoString: string | undefined): string | null {
  if (!isoString) return null;
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return null;
  }
}

export function formatHeading(heading: number | undefined): string | null {
  if (heading == null) return null;
  return `heading ${Math.round(heading)}°`;
}

function provenanceClassName(provenance: EvidenceRef['provenance']): string {
  return `is-${provenance}`;
}

function EvidenceCard({ evidence }: { evidence: EvidenceRef }) {
  const confidence = formatConfidence(evidence.confidence);
  const timestamp = formatTimestamp(evidence.observedAt);
  const heading = formatHeading(evidence.heading);

  return (
    <article className="evidence-card">
      <div className="evidence-card__header">
        <span className={`evidence-badge ${provenanceClassName(evidence.provenance)}`}>
          {evidence.provenance}
        </span>
        <span className="evidence-kind">{evidence.kind}</span>
      </div>
      <div className="evidence-card__body">
        <div className="evidence-source">{evidence.sourceLabel}</div>
        <div className="evidence-meta">
          {confidence ? <span className="evidence-confidence">{confidence} confidence</span> : null}
          {timestamp ? <span className="evidence-timestamp">{timestamp}</span> : null}
          {heading ? <span className="evidence-heading">{heading}</span> : null}
        </div>
        {evidence.attribution ? (
          <div className="evidence-attribution">{evidence.attribution}</div>
        ) : null}
        {evidence.limitations && evidence.limitations.length > 0 ? (
          <ul className="evidence-limitations">
            {evidence.limitations.map((limitation, index) => (
              <li key={index}>{limitation}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}

export function EvidenceStrip() {
  const evidence = useMission((s) => s.mission.evidence);
  const selectedId = useMission((s) => s.mission.selectedCandidateId);
  const candidates = useMission((s) => s.mission.candidates);

  if (evidence.length === 0) return null;

  const selectedCandidate = selectedId ? candidates.find((c) => c.id === selectedId) : null;
  const visibleEvidence = selectedCandidate
    ? evidence.filter((e) => selectedCandidate.evidenceIds.includes(e.id))
    : evidence;

  if (visibleEvidence.length === 0) return null;

  return (
    <section className="glass evidence-strip" aria-label="Mission evidence">
      <h2 className="evidence-strip__heading">
        Evidence {selectedCandidate ? `for ${selectedCandidate.label}` : ''}
      </h2>
      <div className="evidence-strip__grid">
        {visibleEvidence.map((item) => (
          <EvidenceCard key={item.id} evidence={item} />
        ))}
      </div>
    </section>
  );
}
