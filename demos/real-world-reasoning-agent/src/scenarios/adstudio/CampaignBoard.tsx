import { useEffect, useState } from 'react';
import { CheckCircle2, CloudSun, Wind, Camera, Send, Sparkles, Loader2, RefreshCw, Share2 } from 'lucide-react';
import { useAdStudio, type Creative, type CreativeStage } from './store';
import { retryCreative } from './controller';
import { getImage } from '@/genui/images';
import { sendToCopilot } from '@/ai/session';
import { shareActiveRun } from '@/shell/shareRun';
import { fmtRating } from '@/lib/format';
import { MAX_CREATIVES_PER_SESSION } from './limits';

const ACCENT = '#a78bfa';

const FORMAT_ASPECT: Record<Creative['format'], string> = {
  square: '1 / 1',
  story: '9 / 16',
  banner: '1.91 / 1',
};

const STAGE_LABEL: Record<CreativeStage, string> = {
  prompting: 'Preparing prompt',
  rendering: 'Rendering image',
  finalizing: 'Finalizing',
  fallback: 'Retrying text-only',
};

/** Live seconds-elapsed counter; re-renders once a second while a startedAt is set. */
function useElapsedSeconds(startedAt?: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startedAt == null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt]);
  if (startedAt == null) return 0;
  return Math.max(0, Math.round((now - startedAt) / 1000));
}

export function CampaignBoard() {
  const business = useAdStudio((s) => s.business);
  const brief = useAdStudio((s) => s.brief);
  const facts = useAdStudio((s) => s.facts);
  const creatives = useAdStudio((s) => s.creatives);
  const targeting = useAdStudio((s) => s.targeting);
  const exporting = useAdStudio((s) => s.exporting);
  const gatheringFacts = useAdStudio((s) => s.gatheringFacts);
  const setLightbox = useAdStudio((s) => s.setLightbox);
  const creativeRemaining = Math.max(0, MAX_CREATIVES_PER_SESSION - creatives.length);
  const generatingCount = creatives.filter((c) => c.status === 'generating').length;
  const readyCount = creatives.filter((c) => c.status === 'ready').length;
  const errorCount = creatives.filter((c) => c.status === 'error').length;
  const fallbackCount = creatives.filter((c) => c.status === 'generating' && c.stage === 'fallback').length;
  const campaignWorking = gatheringFacts || generatingCount > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <h2 style={{ fontSize: 20, marginBottom: 4 }}>Ad Studio</h2>
          <button
            onClick={() => void shareActiveRun()}
            className="glass"
            aria-label="Share this run"
            title="Share a link that replays this run live"
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              display: 'grid',
              placeItems: 'center',
              color: 'var(--text-dim)',
              flexShrink: 0,
            }}
          >
            <Share2 size={15} />
          </button>
        </div>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.5 }}>
          A grounded campaign for one real business: real facts, real reference photos, an AI-generated
          creative and a live drive-time reach ring.
        </p>
      </div>

      {!business && (
        <p style={{ color: 'var(--text-faint)', fontSize: 12, lineHeight: 1.6 }}>
          Try: <em>"Build a rainy-day ad for Blue Bottle Coffee at the Ferry Building."</em> Atlas finds the
          real place, gathers grounded facts, and generates on-brand creative from a real photo of the spot.
        </p>
      )}

      {business && (
        <div className="glass" style={{ borderRadius: 14, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{business.name}</div>
          {business.formattedAddress && (
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{business.formattedAddress}</div>
          )}
          {brief && (
            <div style={{ fontSize: 12.5, color: 'var(--text-dim)', fontStyle: 'italic', marginTop: 2 }}>
              "{brief}"
            </div>
          )}
        </div>
      )}

      {business && campaignWorking && (
        <div className="glass adstudio-job">
          <div className="adstudio-job__icon">
            <Loader2 size={16} />
          </div>
          <div className="adstudio-job__copy">
            <div className="adstudio-job__title">
              {generatingCount > 0 ? 'Generating ad creative' : 'Building the grounded campaign brief'}
            </div>
            <div className="adstudio-job__detail">
              {generatingCount > 0
                ? `${generatingCount} image ${generatingCount === 1 ? 'job' : 'jobs'} running · ${readyCount}/${MAX_CREATIVES_PER_SESSION} ready · ${creativeRemaining} left${
                    fallbackCount > 0 ? ` · ${fallbackCount} retrying text-only` : ''
                  }`
                : 'Gathering Maps context, environment signals and a real visual reference before writing copy.'}
            </div>
          </div>
        </div>
      )}

      {business && (gatheringFacts || facts.grounding || facts.env) && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {gatheringFacts && <Chip icon={<Sparkles size={11} />} label="Gathering grounded facts…" />}
          {facts.widgetToken && <Chip icon={<CheckCircle2 size={11} />} label="Maps-grounded" tone="good" />}
          {facts.env?.weather?.tempC != null && (
            <Chip
              icon={<CloudSun size={11} />}
              label={`${Math.round(facts.env.weather.tempC)}°C ${facts.env.weather.condition ?? ''}`.trim()}
            />
          )}
          {facts.env?.air?.aqi != null && (
            <Chip icon={<Wind size={11} />} label={`AQI ${facts.env.air.aqi} ${facts.env.air.category}`} />
          )}
          {(facts.streetViewUrl || facts.photoUri) && (
            <Chip
              icon={<Camera size={11} />}
              label={facts.streetViewUrl ? 'Street View reference' : 'Places photo reference'}
            />
          )}
          {business.rating != null && business.rating >= 4.2 && (
            <Chip label={fmtRating(business.rating, business.userRatingCount)} />
          )}
        </div>
      )}

      <div className="panel-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, paddingRight: 2 }}>
        {business && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Stat label="Creative budget" value={`${creativeRemaining} left`} />
            <Stat label="Ready" value={`${readyCount}/${MAX_CREATIVES_PER_SESSION}`} />
            {generatingCount > 0 && <Stat label="Running" value={String(generatingCount)} />}
            {errorCount > 0 && <Stat label="Needs retry" value={String(errorCount)} />}
          </div>
        )}

        {creatives.length > 0 && (
          <div>
            <SectionLabel>Creatives</SectionLabel>
            <div className="adstudio-creative-grid">
              {creatives.map((c) => (
                <CreativeTile key={c.id} creative={c} onOpen={() => setLightbox(c.id)} />
              ))}
            </div>
          </div>
        )}

        {targeting && (
          <div>
            <SectionLabel>Geo-targeting</SectionLabel>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <Stat label="Budget" value={`${targeting.minutes} min`} />
              <Stat label="Mode" value={targeting.travelMode} />
              <Stat label="Ring pts" value={String(targeting.ringPath.length)} />
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 6 }}>{targeting.reachSummary}</p>
          </div>
        )}
      </div>

      {business && (
        <button
          onClick={() => sendToCopilot('export the campaign')}
          className="glass"
          disabled={exporting}
          style={{
            padding: '11px 14px',
            borderRadius: 12,
            background: exporting ? 'var(--glass-2)' : ACCENT,
            border: '1px solid var(--glass-line)',
            color: exporting ? 'var(--text-dim)' : '#12081f',
            fontWeight: 700,
            fontSize: 13.5,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Send size={15} /> {exporting ? 'Exported' : 'Export campaign'}
        </button>
      )}
    </div>
  );
}

function CreativeTile({ creative, onOpen }: { creative: Creative; onOpen: () => void }) {
  const src = creative.imageRef ? getImage(creative.imageRef) : undefined;
  const isReady = creative.status === 'ready';
  const elapsed = useElapsedSeconds(creative.status === 'generating' ? creative.startedAt : undefined);
  const stageLabel = creative.stage ? STAGE_LABEL[creative.stage] : 'Image generation in progress';
  const usingImage = creative.stage !== 'fallback' && creative.conditioning === 'image';
  return (
    <div
      onClick={isReady ? onOpen : undefined}
      onKeyDown={
        isReady
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpen();
              }
            }
          : undefined
      }
      role={isReady ? 'button' : undefined}
      tabIndex={isReady ? 0 : undefined}
      className="glass"
      style={{
        textAlign: 'left',
        borderRadius: 12,
        overflow: 'hidden',
        padding: 0,
        border: '1px solid var(--glass-line)',
        cursor: isReady ? 'pointer' : 'default',
      }}
    >
      <div
        style={{
          position: 'relative',
          aspectRatio: FORMAT_ASPECT[creative.format],
          background: 'var(--bg-2)',
          display: 'grid',
          placeItems: 'center',
        }}
        className={creative.status === 'generating' ? 'atlas-shimmer' : undefined}
      >
        {creative.status === 'generating' && (
          <div className="adstudio-creative-pending">
            <Loader2 size={18} />
            <span>
              {stageLabel}
              {elapsed > 0 ? ` · ${elapsed}s` : ''}
            </span>
            <small>{usingImage ? 'Using real place imagery' : 'Using grounded text prompt'}</small>
          </div>
        )}
        {creative.status === 'ready' && src && (
          <img src={src} alt={creative.headline} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        )}
        {creative.status === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center' }}>
              Couldn't generate this one
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                void retryCreative(creative.id);
              }}
              className="glass"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 11,
                fontWeight: 600,
                padding: '5px 10px',
                borderRadius: 999,
                border: '1px solid var(--glass-line)',
                color: 'var(--text)',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        )}
        {creative.status === 'ready' && (
          <span
            style={{
              position: 'absolute',
              bottom: 6,
              left: 6,
              fontSize: 9.5,
              fontWeight: 700,
              padding: '3px 7px',
              borderRadius: 999,
              background: 'var(--scrim)',
              letterSpacing: 0.3,
            }}
          >
            AI-generated
          </span>
        )}
      </div>
      <div style={{ padding: '7px 9px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>{creative.headline}</div>
        <div style={{ fontSize: 10.5, color: 'var(--text-dim)', textTransform: 'capitalize' }}>
          {creative.style}
          {creative.status === 'ready' && creative.conditioning === 'text-only' ? ' · text-only fallback' : ''}
        </div>
      </div>
    </div>
  );
}

function Chip({ icon, label, tone }: { icon?: React.ReactNode; label: string; tone?: 'good' }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11,
        padding: '4px 9px',
        borderRadius: 999,
        background: tone === 'good' ? 'rgba(52,211,153,.16)' : 'var(--glass-2)',
        color: tone === 'good' ? '#34d399' : 'var(--text-dim)',
        border: '1px solid var(--glass-line)',
      }}
    >
      {icon}
      {label}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10.5, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 }}>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass" style={{ flex: 1, padding: '9px 11px', borderRadius: 12 }}>
      <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </div>
    </div>
  );
}
