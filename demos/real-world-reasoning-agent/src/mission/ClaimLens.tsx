import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useMission } from '@/mission/store';
import { approveMissionCandidate } from '@/mission/controller';
import { lib } from '@/services/maps';
import { FACTOR_LABELS } from '@/mission/factorLabels';
import './ClaimLens.css';

export function ClaimLens() {
  const selectedId = useMission((s) => s.mission.selectedCandidateId);
  const candidates = useMission((s) => s.mission.candidates);
  const decision = useMission((s) => s.mission.decision);
  const evidence = useMission((s) => s.mission.evidence);
  const selectCandidate = useMission((s) => s.selectCandidate);

  if (!selectedId) return null;

  const candidate = candidates.find((c) => c.id === selectedId);
  if (!candidate) return null;

  const isApproved = decision?.candidateId === candidate.id && decision.approvedAt;
  const sourceLabel = candidate.source === 'live' ? 'Live' : 'Demo fixture';
  const candidateEvidence = evidence.filter((item) => candidate.evidenceIds.includes(item.id));

  return (
    <aside className="glass claim-lens" aria-label="Claim lens">
      <header className="claim-lens__header">
        <div className="claim-lens__title">
          <strong>#{candidate.rank ?? '?'}</strong>
          <span>{candidate.label}</span>
        </div>
        <span className={`claim-lens__source claim-lens__source--${candidate.source}`}>
          {sourceLabel}
        </span>
        <button
          className="claim-lens__close"
          onClick={() => selectCandidate(null)}
          aria-label="Close claim lens"
        >
          <X size={16} />
        </button>
      </header>

      <div className="claim-lens__body">
        <div className="claim-lens__metrics">
          {candidate.score != null && (
            <div className="claim-lens__metric">
              <label>Overall score</label>
              <strong>{Math.round(candidate.score)}</strong>
            </div>
          )}
          {candidate.confidence != null && (
            <div className="claim-lens__metric">
              <label>Confidence</label>
              <strong>{Math.round(candidate.confidence * 100)}%</strong>
            </div>
          )}
        </div>

        {candidate.factors && (
          <div className="claim-lens__factors">
            <h3>Factor breakdown</h3>
            {Object.entries(candidate.factors).map(([key, value]) => (
              <FactorBar key={key} label={FACTOR_LABELS[key] || key} value={value} />
            ))}
          </div>
        )}

        {isApproved && decision?.rationale && (
          <div className="claim-lens__rationale">
            <h3>Why this won</h3>
            <p>{decision.rationale}</p>
          </div>
        )}

        <section className="claim-lens__evidence" aria-label="Candidate evidence">
          <h3>Evidence and limitations</h3>
          {candidateEvidence.length ? candidateEvidence.map((item) => (
            <article key={item.id}>
              <strong>{item.sourceLabel}</strong>
              <span>{item.provenance}{item.confidence != null ? ` · ${Math.round(item.confidence * 100)}% confidence` : ''}</span>
              {item.attribution ? <span>{item.attribution}</span> : null}
              {item.limitations?.map((limitation) => <p key={limitation}>{limitation}</p>)}
            </article>
          )) : <p>No candidate-specific evidence is available yet.</p>}
        </section>

        {candidate.place?.id && candidate.source === 'live' && (
          <PlaceUiKitMount placeId={candidate.place.id} />
        )}
      </div>

      {!isApproved && (
        <footer className="claim-lens__footer">
          <button
            className="claim-lens__approve"
            onClick={() => approveMissionCandidate(candidate.id)}
          >
            Approve this site
          </button>
        </footer>
      )}
    </aside>
  );
}

export function FactorBar({ label, value }: { label: string; value: number }) {
  const percent = factorPercent(value);
  return (
    <div className="claim-lens__factor">
      <label>{label}</label>
      <div className="claim-lens__factor-bar">
        <div className="claim-lens__factor-fill" style={{ width: `${percent}%` }} />
      </div>
      <span className="claim-lens__factor-value">{Math.round(value)}</span>
    </div>
  );
}

export function factorPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function PlaceUiKitMount({ placeId }: { placeId: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  useEffect(() => {
    let disposed = false;
    let element: HTMLElement | null = null;
    const cleanPlaceId = placeId?.trim();
    if (!cleanPlaceId) {
      setStatus('unavailable');
      return;
    }

    void (async () => {
      const places = await lib('places').catch(() => undefined);
      if (disposed || !hostRef.current) return;
      if (!places) {
        setStatus('unavailable');
        return;
      }
      const ctor = customElements.get('gmp-place-details-compact') ?? customElements.get('gmp-place-details');
      if (!ctor) {
        setStatus('unavailable');
        return;
      }
      element = new (ctor as CustomElementConstructor)();
      element.className = 'claim-lens__ui-kit';
      element.setAttribute('orientation', 'horizontal');
      element.setAttribute('place', cleanPlaceId);

      const requestEl = document.createElement('gmp-place-details-place-request');
      requestEl.setAttribute('place', cleanPlaceId);
      element.appendChild(requestEl);

      const contentEl = document.createElement('gmp-place-all-content');
      element.appendChild(contentEl);

      hostRef.current.replaceChildren(element);
      setStatus('ready');
    })();
    return () => {
      disposed = true;
      element?.remove();
      hostRef.current?.replaceChildren();
    };
  }, [placeId]);

  return <div className="claim-lens__ui-kit-wrap">
    {status === 'loading' ? <p role="status">Loading Google Places details…</p> : null}
    {status === 'unavailable' ? <p role="status">Google Places details are unavailable. The evidence above remains available.</p> : null}
    <div ref={hostRef} hidden={status !== 'ready'} className="claim-lens__ui-kit-host" aria-label="Google Places UI Kit details" />
  </div>;
}
