import { Binoculars, MapPin, Camera, Clapperboard, Sparkles, Share2 } from 'lucide-react';
import { INSPECTION_CAP, useScout, type Candidate, type RubricWeights } from './store';
import { getImage } from '@/genui/images';
import { sendToCopilot } from '@/ai/session';
import { shareActiveRun } from '@/shell/shareRun';
import { VIDEO_GEN_ENABLED } from '@/lib/config';
import { applyCounterfactualWeights } from './controller';
import { MissionHeader } from '@/mission/MissionHeader';
import { EnvironmentScrubber } from '@/mission/EnvironmentScrubber';
import { EvidenceStrip } from '@/mission/EvidenceStrip';
import { ClaimLens } from '@/mission/ClaimLens';
import { FACTOR_LABELS } from '@/mission/factorLabels';
import './ScoutBoard.css';

const WEIGHT_LABELS: Record<keyof RubricWeights, string> = {
  visibility: FACTOR_LABELS.visibility,
  condition: FACTOR_LABELS.condition,
  activity: FACTOR_LABELS.activity,
  access: FACTOR_LABELS.access,
  environment: FACTOR_LABELS.environment,
};

const STATUS_TONE: Record<Candidate['status'], string> = {
  pending: 'var(--text-faint)',
  inspected: 'var(--accent-scout-inspected, #fbbf24)',
  scored: 'var(--accent-scout-scored, #34d399)',
};

/** Small "New" pill used to nudge attention to a fresh capability. */
function NewBadge({ children }: { children: string }) {
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: 0.7,
        padding: '2px 6px',
        borderRadius: 999,
        background: 'rgba(6,18,31,0.2)',
        color: 'inherit',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </span>
  );
}

export function ScoutBoard() {
  const candidates = useScout((s) => s.candidates);
  const weights = useScout((s) => s.rubricWeights);
  const inspectionsUsed = useScout((s) => s.inspectionsUsed);
  const inspectionsRemaining = Math.max(0, INSPECTION_CAP - inspectionsUsed);

  const ranked = [...candidates].sort((a, b) => {
    if (a.rank != null && b.rank != null) return a.rank - b.rank;
    if (a.rank != null) return -1;
    if (b.rank != null) return 1;
    return 0;
  });

  return (
    <div className="scout-drawer">
      <MissionHeader />
      <div className="scout-drawer__scroll">
      <div>
        <h2 style={{ fontSize: 20, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Binoculars size={18} color="var(--accent-scout, #60a5fa)" /> Scout
          <button
            onClick={() => void shareActiveRun()}
            className="glass"
            aria-label="Share this run"
            title="Share a link that replays this run live"
            style={{
              marginLeft: 'auto',
              width: 30,
              height: 30,
              borderRadius: 9,
              display: 'grid',
              placeItems: 'center',
              color: 'var(--text-dim)',
            }}
          >
            <Share2 size={15} />
          </button>
        </h2>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.5 }}>
          A site-selection analyst that grounds each candidate in real imagery — Street View plus an overhead
          satellite view, read by Gemini — then fuses visibility, condition and observed street activity with Places density,
          environment and walk-time access into a ranked score and a side-by-side decision.
        </p>
      </div>

      {candidates.length === 0 && (
        <p style={{ color: 'var(--text-faint)', fontSize: 12, lineHeight: 1.6 }}>
          Try: <em>"Scout the best corner for an espresso bar in North Beach and compare the top sites."</em> Atlas
          scouts real candidates, inspects street + aerial imagery, scores each on the evidence it actually looked
          at, and recommends a winner. You can also click the map to drop a candidate.
        </p>
      )}

      {candidates.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Stat label="Inspect budget" value={`${inspectionsRemaining} left`} />
          <Stat label="Inspected" value={`${inspectionsUsed}/${INSPECTION_CAP}`} />
        </div>
      )}
      {ranked.map((c) => (
        <CandidateCard key={c.id} candidate={c} />
      ))}

      {candidates.some((c) => c.status !== 'pending') && (
        <div className="glass" style={{ borderRadius: 14, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 10.5, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 }}>
            Rubric weights
          </div>
          {(Object.keys(WEIGHT_LABELS) as (keyof RubricWeights)[]).map((k) => (
            <label key={k} style={{ display: 'grid', gridTemplateColumns: '78px 1fr 30px', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ color: 'var(--text-dim)' }}>{WEIGHT_LABELS[k]}</span>
              <input
                type="range"
                min={0}
                max={0.5}
                step={0.05}
                value={weights[k]}
                onChange={(e) => applyCounterfactualWeights({ ...weights, [k]: Number(e.target.value) })}
                style={{ accentColor: 'var(--accent-scout, #60a5fa)' }}
              />
              <span style={{ textAlign: 'right', color: 'var(--text-dim)' }}>{weights[k].toFixed(2)}</span>
            </label>
          ))}
          <div style={{ color: 'var(--text-faint)', fontSize: 10.5 }}>
            Reranks locally from computed sub-scores. No model call.
          </div>
          {candidates.filter((c) => c.rank != null).length >= 2 && (
            <button
              onClick={() => sendToCopilot('Compare the top sites and recommend a winner.')}
              className="glass"
              style={{
                padding: '9px 12px',
                borderRadius: 10,
                background: 'var(--glass-2)',
                color: 'var(--text)',
                fontWeight: 700,
                fontSize: 12.5,
                border: '1px solid var(--glass-line)',
              }}
            >
              Compare top sites
            </button>
          )}
          {VIDEO_GEN_ENABLED && candidates.filter((c) => c.rank != null).length >= 1 && (
            <>
              <button
                onClick={() => sendToCopilot('Generate a walkthrough video of the winning site.')}
                style={{
                  position: 'relative',
                  padding: '11px 12px',
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #60a5fa 0%, #818cf8 100%)',
                  color: '#06121f',
                  fontWeight: 800,
                  fontSize: 12.5,
                  border: '1px solid var(--glass-line)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  boxShadow: '0 4px 18px rgba(96,165,250,0.32)',
                }}
              >
                <Clapperboard size={15} />
                Walkthrough video
                <NewBadge>New</NewBadge>
              </button>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                <Sparkles size={11} style={{ color: 'var(--accent-scout, #60a5fa)' }} /> AI-generated establishing clip of the winning site.
              </div>
            </>
          )}
        </div>
      )}

      <EnvironmentScrubber />
      <EvidenceStrip />
      <ClaimLens />

      <div style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>
        Inspections used this session: {inspectionsUsed} / {INSPECTION_CAP}
      </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass" style={{ padding: '9px 11px', borderRadius: 12 }}>
      <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </div>
    </div>
  );
}

function CandidateCard({ candidate }: { candidate: Candidate }) {
  const firstFrame = candidate.evidence.find((e) => e.ref);
  const thumb = firstFrame?.ref ? getImage(firstFrame.ref) : undefined;
  const total = candidate.scores?.total;

  return (
    <button
      onClick={() => sendToCopilot(`Show me the evidence for candidate "${candidate.label}".`)}
      className="glass"
      style={{
        display: 'grid',
        gridTemplateColumns: '54px 1fr auto',
        gap: 10,
        alignItems: 'center',
        textAlign: 'left',
        padding: 8,
        borderRadius: 12,
        border: '1px solid var(--glass-line)',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          width: 54,
          height: 54,
          borderRadius: 9,
          overflow: 'hidden',
          background: 'var(--bg-2)',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        {thumb ? (
          <img src={thumb} alt={candidate.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Camera size={16} color="var(--text-faint)" />
        )}
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          {candidate.rank != null && (
            <span style={{ color: 'var(--accent-scout, #60a5fa)', fontFamily: 'var(--font-display)' }}>#{candidate.rank}</span>
          )}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{candidate.label}</span>
        </div>
        <div style={{ fontSize: 11, color: STATUS_TONE[candidate.status], textTransform: 'capitalize', marginTop: 2 }}>
          {candidate.status}
          {candidate.evidence.length > 0 && (
            <span style={{ color: 'var(--text-faint)' }}> · {candidate.evidence.length} frames</span>
          )}
        </div>
        {total != null && (
          <div style={{ height: 4, borderRadius: 999, background: 'var(--glass-2)', marginTop: 6, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, total * 10)}%`, height: '100%', background: 'var(--accent-scout, #60a5fa)' }} />
          </div>
        )}
      </div>

      {total != null ? (
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>{total.toFixed(1)}</div>
      ) : (
        <MapPin size={15} color="var(--text-faint)" />
      )}
    </button>
  );
}
