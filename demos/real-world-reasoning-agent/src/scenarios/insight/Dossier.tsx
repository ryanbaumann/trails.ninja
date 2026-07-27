import { useEffect } from 'react';
import { Wind, Thermometer, Sun, Flower2, Volume2, Layers, Sparkles, Loader2, X, Scale, Zap, Trees } from 'lucide-react';
import { useInsight, type Dossier as DossierT } from './store';
import { atlas, useAtlas } from '@/state/store';
import { askBrief, clearLocation, askCompareBrief } from './controller';
import { fmtDistance, fmtDuration } from '@/lib/format';
import { speak } from '@/ai/tts';
import type { SolarInsight } from '@/lib/types';

const ACCENT = '#34d399';

export function DossierPanel() {
  const subject = useInsight((s) => s.subject);
  const compare = useInsight((s) => s.compare);
  const loadingA = useInsight((s) => s.loadingA);
  const loadingB = useInsight((s) => s.loadingB);
  const activeLayer = useAtlas((s) => s.tileOverlay);
  const activeSlot = useInsight((s) => s.activeSlot);
  const setActiveSlot = useInsight((s) => s.setActiveSlot);
  const compareBrief = useInsight((s) => s.compareBrief);
  const compareBriefLoading = useInsight((s) => s.compareBriefLoading);

  const comparing = !!(subject && compare);

  // Dynamically resize the sidebar ContextDrawer based on comparison mode
  useEffect(() => {
    const updateWidth = () => {
      const isMobile = window.innerWidth <= 900;
      const targetW = comparing ? (isMobile ? '100vw' : '760px') : '400px';
      document.documentElement.style.setProperty('--drawer-w', targetW);
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);

    return () => {
      window.removeEventListener('resize', updateWidth);
      document.documentElement.style.setProperty('--drawer-w', '400px');
    };
  }, [comparing]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%', minHeight: 0 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <h2 style={{ fontSize: 20 }}>The truth about this address</h2>
          <div style={{ display: 'flex', gap: 4, background: 'var(--glass-2)', padding: 4, borderRadius: 999, border: '1px solid var(--glass-line)' }}>
            {(['aqi', 'pollen'] as const).map((layer) => {
              const active = activeLayer === layer;
              return (
                <button
                  key={layer}
                  onClick={() => {
                    atlas().setTileOverlay(active ? null : layer);
                  }}
                  title={`Toggle ${layer} heatmap`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 11,
                    padding: '4px 10px',
                    borderRadius: 999,
                    color: active ? '#0b0e14' : 'var(--text-dim)',
                    background: active ? ACCENT : 'transparent',
                    transition: 'all 200ms var(--ease)',
                    textTransform: 'uppercase',
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  <Layers size={12} /> {layer}
                </button>
              );
            })}
          </div>
        </div>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.5, marginTop: 4 }}>
          Click anywhere on the map — Atlas fans out across Places + the Environment APIs to build a
          living-quality dossier from real data.
        </p>

        {/* Active Slot Target Selection tabs */}
        <div style={{ display: 'flex', border: '1px solid var(--glass-line)', borderRadius: 12, overflow: 'hidden', background: 'rgba(255,255,255,0.02)', marginTop: 10 }}>
          <button
            onClick={() => setActiveSlot('A')}
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: 12,
              fontWeight: activeSlot === 'A' ? 600 : 400,
              color: activeSlot === 'A' ? '#fff' : 'var(--text-dim)',
              background: activeSlot === 'A' ? 'rgba(52, 211, 153, 0.12)' : 'transparent',
              borderBottom: activeSlot === 'A' ? `2px solid ${ACCENT}` : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 200ms var(--ease)'
            }}
          >
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: ACCENT,
              display: 'inline-block',
              boxShadow: activeSlot === 'A' ? `0 0 8px ${ACCENT}` : 'none',
              animation: activeSlot === 'A' ? 'atlas-pulse 1.5s infinite ease-in-out' : 'none'
            }} />
            Slot A {subject ? '· Filled' : '· Empty'}
          </button>
          <button
            onClick={() => setActiveSlot('B')}
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: 12,
              fontWeight: activeSlot === 'B' ? 600 : 400,
              color: activeSlot === 'B' ? '#fff' : 'var(--text-dim)',
              background: activeSlot === 'B' ? 'rgba(96, 165, 250, 0.12)' : 'transparent',
              borderBottom: activeSlot === 'B' ? '2px solid #60a5fa' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 200ms var(--ease)'
            }}
          >
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#60a5fa',
              display: 'inline-block',
              boxShadow: activeSlot === 'B' ? '0 0 8px #60a5fa' : 'none',
              animation: activeSlot === 'B' ? 'atlas-pulse 1.5s infinite ease-in-out' : 'none'
            }} />
            Slot B {compare ? '· Filled' : '· Empty'}
          </button>
        </div>
      </div>

      <div className="panel-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, paddingRight: 2 }}>
        {!subject && !loadingA && (
          <p style={{ color: 'var(--text-faint)', fontSize: 12, lineHeight: 1.6 }}>
            Click a spot on the map (or ask Atlas to analyze a place). Click a second spot to
            compare two neighborhoods side by side.
          </p>
        )}

        {loadingA && !subject && <DossierSkeleton />}

        {/* If we are loading slot B but B was empty, show skeleton for B */}
        {loadingB && !compare && (
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 300px', minWidth: 0 }}>
              {subject && <DossierView d={subject} slot="A" onBrief={() => void askBrief('A', true)} onClear={() => clearLocation('A')} />}
            </div>
            <div style={{ flex: '1 1 300px', minWidth: 0 }}>
              <DossierSkeleton />
            </div>
          </div>
        )}

        {/* Both locations are active: show unified side-by-side view */}
        {subject && compare && (
          <>
            <ComparisonSummaryCard
              a={subject}
              b={compare}
              brief={compareBrief}
              loading={compareBriefLoading}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, width: '100%', alignItems: 'flex-start' }}>
              <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                <DossierView d={subject} slot="A" onBrief={() => void askBrief('A', true)} onClear={() => clearLocation('A')} />
              </div>
              <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                <DossierView d={compare} slot="B" onBrief={() => void askBrief('B', true)} onClear={() => clearLocation('B')} />
              </div>
            </div>
          </>
        )}

        {/* Single location view */}
        {subject && !compare && !loadingB && (
          <DossierView d={subject} slot="A" onBrief={() => void askBrief('A', true)} onClear={() => clearLocation('A')} />
        )}
      </div>
    </div>
  );
}

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const off = c * (1 - score / 100);
  return (
    <div style={{ position: 'relative', width: 76, height: 76, flexShrink: 0 }}>
      <svg width={76} height={76} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={38} cy={38} r={r} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth={7} />
        <circle
          cx={38}
          cy={38}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          style={{ transition: 'stroke-dashoffset 700ms var(--ease)' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', lineHeight: 1 }}>
        <span style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-display)', display: 'block' }}>{score}</span>
        <span style={{ fontSize: 8.5, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 1, display: 'block' }}>score</span>
      </div>
    </div>
  );
}

function DossierView({ d, slot, onBrief, onClear }: { d: DossierT; slot: 'A' | 'B'; onBrief: () => void; onClear: () => void }) {
  const color = slot === 'A' ? ACCENT : '#60a5fa';
  const activeSlot = useInsight((s) => s.activeSlot);
  const isActive = activeSlot === slot;
  const borderColor = isActive ? color : 'var(--glass-line)';
  const shadow = isActive ? `0 0 16px ${color}35` : 'none';

  return (
    <div
      className="glass"
      onClick={() => useInsight.getState().setActiveSlot(slot)}
      style={{
        borderRadius: 16,
        overflow: 'hidden',
        border: `1.5px solid ${borderColor}`,
        boxShadow: shadow,
        transition: 'all 200ms var(--ease)',
        position: 'relative',
        cursor: 'pointer',
      }}
    >
      {/* Close button to deselect */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClear();
        }}
        title="Deselect this location"
        className="glass"
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          width: 28,
          height: 28,
          borderRadius: 999,
          display: 'grid',
          placeItems: 'center',
          zIndex: 10,
          color: 'rgba(255, 255, 255, 0.8)',
          border: '1px solid var(--glass-line)',
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(6px)',
          transition: 'all 200ms var(--ease)',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#f43f5e';
          e.currentTarget.style.background = 'rgba(244, 63, 94, 0.2)';
          e.currentTarget.style.borderColor = 'rgba(244, 63, 94, 0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)';
          e.currentTarget.style.background = 'rgba(15, 23, 42, 0.65)';
          e.currentTarget.style.borderColor = 'var(--glass-line)';
        }}
      >
        <X size={14} />
      </button>

      {d.streetViewUrl ? (
        <img src={d.streetViewUrl} alt="Street View" style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />
      ) : (
        <div style={{ height: 60, background: 'var(--bg-2)', display: 'grid', placeItems: 'center', fontSize: 12, color: 'var(--text-faint)' }}>
          No Street View here
        </div>
      )}

      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <ScoreRing score={d.score} color={color} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 9.5, color, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
              Location {slot} {isActive && <span style={{ padding: '1px 5px', background: `${color}25`, borderRadius: 4, fontSize: 8 }}>TARGET</span>}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.35, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {d.address ?? `${d.location.lat.toFixed(4)}, ${d.location.lng.toFixed(4)}`}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 2 }}>demo heuristic</div>
          </div>
        </div>

        {/* Environment tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {d.env.air && (
            <EnvTile
              icon={<Wind size={13} />}
              label="Air quality"
              value={`${d.env.air.aqi} · ${d.env.air.category.replace(/ air quality/i, '')}`}
              dot={d.env.air.color}
            />
          )}
          {d.env.weather && (
            <EnvTile
              icon={<Thermometer size={13} />}
              label="Weather"
              value={
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {Math.round(d.env.weather.tempC)}° · {d.env.weather.condition}
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 9,
                    color: 'var(--text-dim)',
                    fontWeight: 500,
                    borderTop: '1px solid var(--glass-line)',
                    paddingTop: 4,
                    marginTop: 2,
                  }}>
                    {d.env.weather.feelsLikeC !== undefined && (
                      <span title={`Feels like ${Math.round(d.env.weather.feelsLikeC)}°C`}>
                        {Math.round(d.env.weather.feelsLikeC)}°
                      </span>
                    )}
                    {d.env.weather.humidity !== undefined && (
                      <span title={`Humidity ${d.env.weather.humidity}%`}>
                        💧{d.env.weather.humidity}%
                      </span>
                    )}
                    {d.env.weather.windKph !== undefined && (
                      <span title={`Wind speed ${Math.round(d.env.weather.windKph)} kph`}>
                        💨{Math.round(d.env.weather.windKph)}k
                      </span>
                    )}
                  </div>
                </div>
              }
            />
          )}
          {d.env.pollen && (
            <EnvTile
              icon={<Flower2 size={13} />}
              label="Pollen"
              value={pollenSummary(d.env.pollen)}
            />
          )}
          {d.env.solar && (
            <EnvTile
              icon={<Sun size={13} />}
              label="Solar / yr"
              value={`${Math.round(d.env.solar.yearlyEnergyKwh).toLocaleString()} kWh`}
            />
          )}
        </div>

        {/* Solar Potential Dashboard */}
        {d.env.solar && (
          <SolarDashboard solar={d.env.solar} />
        )}

        {/* Essentials */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
            Essentials proximity
          </div>
          {d.essentials.map((e) => {
            // Color code distance badges: green < 400m, yellow < 1000m, red >= 1000m
            let distColor = 'var(--text-dim)';
            if (e.distanceMeters != null) {
              if (e.distanceMeters < 400) distColor = '#34d399';
              else if (e.distanceMeters < 1000) distColor = '#fbbf24';
              else distColor = '#f87171';
            }

            return (
              <div
                key={e.category}
                onClick={(evt) => {
                  if (e.place) {
                    evt.stopPropagation();
                    atlas().setCamera({ kind: 'fly', center: e.place.location, zoom: 16 });
                  }
                }}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                  padding: '5px 8px',
                  borderRadius: 8,
                  cursor: e.place ? 'pointer' : 'default',
                  fontSize: 12,
                  background: 'rgba(255,255,255,0.01)',
                  border: '1px solid transparent',
                  transition: 'all 150ms var(--ease)'
                }}
                onMouseEnter={(evt) => {
                  if (e.place) {
                    evt.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                    evt.currentTarget.style.borderColor = 'var(--glass-line)';
                  }
                }}
                onMouseLeave={(evt) => {
                  if (e.place) {
                    evt.currentTarget.style.background = 'rgba(255,255,255,0.01)';
                    evt.currentTarget.style.borderColor = 'transparent';
                  }
                }}
              >
                <span style={{ color: 'var(--text-dim)', width: 66, flexShrink: 0 }}>{e.label}</span>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.place?.name ?? '—'}
                </span>
                <span style={{ color: distColor, fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500 }}>
                  {e.distanceMeters != null ? fmtDistance(e.distanceMeters) : '—'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Commute grid */}
        {d.commute.some((c) => c.ok) && (
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>
              Drive time (live traffic)
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {d.commute.map((c) => (
                <div key={c.anchorName} className="glass" style={{ flex: 1, padding: '6px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.01)', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color }}>
                    {c.ok ? fmtDuration(c.durationSeconds) : '—'}
                  </div>
                  <div style={{ fontSize: 9.5, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.anchorName}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Brief */}
        <div style={{ borderTop: '1px solid var(--glass-line)', paddingTop: 10 }}>
          {d.brief ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <p style={{ flex: 1, fontSize: 12.5, lineHeight: 1.55, color: 'var(--text)', margin: 0 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, color, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, width: '100%' }}>
                  <Sparkles size={11} /> AI Location Brief
                </span>
                {d.brief}
              </p>
              <button
                onClick={(evt) => {
                  evt.stopPropagation();
                  void speak(d.brief!, 'Kore', { scenario: 'insight' });
                }}
                aria-label="Read aloud"
                className="glass"
                style={{ width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 16 }}
              >
                <Volume2 size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={(evt) => {
                evt.stopPropagation();
                onBrief();
              }}
              disabled={d.briefLoading}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 10,
                background: 'var(--accent-soft)',
                border: '1px solid var(--glass-line)',
                color: 'var(--text)',
                fontWeight: 600,
                fontSize: 12.5,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                cursor: 'pointer'
              }}
            >
              {d.briefLoading ? <Loader2 size={14} style={{ animation: 'atlas-spin 1s linear infinite' }} /> : <Sparkles size={14} />}
              What's it like to live here?
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ComparisonSummaryCard({
  a,
  b,
  brief,
  loading,
}: {
  a: DossierT;
  b: DossierT;
  brief?: string;
  loading?: boolean;
}) {
  const scoreDiff = b.score - a.score;

  const aqiA = a.env.air?.aqi;
  const aqiB = b.env.air?.aqi;

  const parkA = a.essentials.find((e) => e.category === 'park')?.distanceMeters;
  const parkB = b.essentials.find((e) => e.category === 'park')?.distanceMeters;

  const grocA = a.essentials.find((e) => e.category === 'supermarket')?.distanceMeters;
  const grocB = b.essentials.find((e) => e.category === 'supermarket')?.distanceMeters;

  const commA = a.commute.filter(c => c.ok);
  const avgCommA = commA.length ? commA.reduce((sum, c) => sum + c.durationSeconds, 0) / commA.length : 0;
  const commB = b.commute.filter(c => c.ok);
  const avgCommB = commB.length ? commB.reduce((sum, c) => sum + c.durationSeconds, 0) / commB.length : 0;

  return (
    <div className="glass" style={{ borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 14, background: 'rgba(255,255,255,0.015)', border: '1px solid var(--glass-line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ background: 'var(--accent-soft)', padding: 6, borderRadius: 8, display: 'grid', placeItems: 'center' }}>
          <Scale size={16} style={{ color: 'var(--accent)' }} />
        </div>
        <h3 style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Neighborhood Matchup</h3>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}>
        {/* Score Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.01)' }}>
          <span style={{ color: 'var(--text-dim)', flex: 1, fontWeight: 500 }}>Living Score</span>
          <span style={{ fontWeight: 700, color: ACCENT, width: 60, textAlign: 'center' }}>{a.score}</span>
          <span style={{ color: 'var(--text-faint)', width: 30, textAlign: 'center' }}>vs</span>
          <span style={{ fontWeight: 700, color: '#60a5fa', width: 60, textAlign: 'center' }}>{b.score}</span>
          <span style={{ width: 80, textAlign: 'right', fontWeight: 650, color: scoreDiff === 0 ? 'var(--text-dim)' : scoreDiff > 0 ? '#60a5fa' : ACCENT }}>
            {scoreDiff === 0 ? 'Tie' : scoreDiff > 0 ? `+${scoreDiff} (B)` : `+${Math.abs(scoreDiff)} (A)`}
          </span>
        </div>

        {/* AQI Row */}
        {aqiA !== undefined && aqiB !== undefined && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.01)' }}>
            <span style={{ color: 'var(--text-dim)', flex: 1, fontWeight: 500 }}>Air Quality</span>
            <span style={{ fontWeight: 600, color: aqiA <= aqiB ? ACCENT : 'var(--text-dim)', width: 60, textAlign: 'center' }}>{aqiA}</span>
            <span style={{ color: 'var(--text-faint)', width: 30, textAlign: 'center' }}>vs</span>
            <span style={{ fontWeight: 600, color: aqiB <= aqiA ? '#60a5fa' : 'var(--text-dim)', width: 60, textAlign: 'center' }}>{aqiB}</span>
            <span style={{ width: 80, textAlign: 'right', fontWeight: 650, color: aqiA === aqiB ? 'var(--text-dim)' : aqiA < aqiB ? ACCENT : '#60a5fa' }}>
              {aqiA === aqiB ? 'Tie' : aqiA < aqiB ? 'A Better' : 'B Better'}
            </span>
          </div>
        )}

        {/* Nearest Park Row */}
        {parkA !== undefined && parkB !== undefined && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.01)' }}>
            <span style={{ color: 'var(--text-dim)', flex: 1, fontWeight: 500 }}>Nearest Park</span>
            <span style={{ fontWeight: 600, color: parkA <= parkB ? ACCENT : 'var(--text-dim)', width: 60, textAlign: 'center' }}>{fmtDistance(parkA)}</span>
            <span style={{ color: 'var(--text-faint)', width: 30, textAlign: 'center' }}>vs</span>
            <span style={{ fontWeight: 600, color: parkB <= parkA ? '#60a5fa' : 'var(--text-dim)', width: 60, textAlign: 'center' }}>{fmtDistance(parkB)}</span>
            <span style={{ width: 80, textAlign: 'right', fontWeight: 650, color: parkA === parkB ? 'var(--text-dim)' : parkA < parkB ? ACCENT : '#60a5fa' }}>
              {parkA === parkB ? 'Tie' : parkA < parkB ? 'A Closer' : 'B Closer'}
            </span>
          </div>
        )}

        {/* Nearest Groceries Row */}
        {grocA !== undefined && grocB !== undefined && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.01)' }}>
            <span style={{ color: 'var(--text-dim)', flex: 1, fontWeight: 500 }}>Supermarket</span>
            <span style={{ fontWeight: 600, color: grocA <= grocB ? ACCENT : 'var(--text-dim)', width: 60, textAlign: 'center' }}>{fmtDistance(grocA)}</span>
            <span style={{ color: 'var(--text-faint)', width: 30, textAlign: 'center' }}>vs</span>
            <span style={{ fontWeight: 600, color: grocB <= grocA ? '#60a5fa' : 'var(--text-dim)', width: 60, textAlign: 'center' }}>{fmtDistance(grocB)}</span>
            <span style={{ width: 80, textAlign: 'right', fontWeight: 650, color: grocA === grocB ? 'var(--text-dim)' : grocA < grocB ? ACCENT : '#60a5fa' }}>
              {grocA === grocB ? 'Tie' : grocA < grocB ? 'A Closer' : 'B Closer'}
            </span>
          </div>
        )}

        {/* Commute Row */}
        {avgCommA > 0 && avgCommB > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.01)' }}>
            <span style={{ color: 'var(--text-dim)', flex: 1, fontWeight: 500 }}>Avg Commute</span>
            <span style={{ fontWeight: 600, color: avgCommA <= avgCommB ? ACCENT : 'var(--text-dim)', width: 60, textAlign: 'center' }}>{Math.round(avgCommA / 60)}m</span>
            <span style={{ color: 'var(--text-faint)', width: 30, textAlign: 'center' }}>vs</span>
            <span style={{ fontWeight: 600, color: avgCommB <= avgCommA ? '#60a5fa' : 'var(--text-dim)', width: 60, textAlign: 'center' }}>{Math.round(avgCommB / 60)}m</span>
            <span style={{ width: 80, textAlign: 'right', fontWeight: 650, color: avgCommA === avgCommB ? 'var(--text-dim)' : avgCommA < avgCommB ? ACCENT : '#60a5fa' }}>
              {avgCommA === avgCommB ? 'Tie' : avgCommA < avgCommB ? 'A Faster' : 'B Faster'}
            </span>
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--glass-line)', paddingTop: 12, marginTop: 4 }}>
        {brief ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <p style={{ flex: 1, fontSize: 12.5, lineHeight: 1.55, color: 'var(--text)', margin: 0 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, color: ACCENT, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, width: '100%' }}>
                <Sparkles size={11} /> AI Matchup Summary
              </span>
              {brief}
            </p>
            <button
              onClick={() => void speak(brief, 'Kore', { scenario: 'insight' })}
              aria-label="Read comparison brief aloud"
              className="glass"
              style={{ width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 12 }}
            >
              <Volume2 size={13} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => void askCompareBrief(true)}
            disabled={loading}
            style={{
              width: '100%',
              padding: '9px 12px',
              borderRadius: 10,
              background: 'linear-gradient(90deg, rgba(52, 211, 153, 0.12), rgba(96, 165, 250, 0.12))',
              border: '1px solid var(--glass-line)',
              color: 'var(--text)',
              fontWeight: 600,
              fontSize: 12.5,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              cursor: 'pointer',
              transition: 'transform 150ms var(--ease)'
            }}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.98)'; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            {loading ? (
              <Loader2 size={14} style={{ animation: 'atlas-spin 1s linear infinite' }} />
            ) : (
              <Sparkles size={14} style={{ color: ACCENT }} />
            )}
            Generate Comparative AI insights
          </button>
        )}
      </div>
    </div>
  );
}

function EnvTile({ icon, label, value, dot }: { icon: React.ReactNode; label: string; value: React.ReactNode; dot?: string }) {
  return (
    <div className="glass" style={{ padding: '8px 10px', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 3, position: 'relative', background: 'rgba(255,255,255,0.005)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 9.5, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.4, width: '100%' }}>
        {icon} <span>{label}</span>
        {dot && <span style={{ position: 'absolute', right: 8, top: 8, width: 7, height: 7, borderRadius: 999, background: dot }} />}
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.25, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
    </div>
  );
}

function pollenSummary(p: NonNullable<DossierT['env']['pollen']>): string {
  const parts = [p.tree, p.grass, p.weed].filter(Boolean) as { category: string; index: number }[];
  if (!parts.length) return 'No data';
  const worst = parts.reduce((m, x) => (x.index > m.index ? x : m));
  return worst.category || 'Low';
}

function DossierSkeleton() {
  return (
    <div className="glass" style={{ borderRadius: 16, overflow: 'hidden' }}>
      <div className="atlas-shimmer" style={{ height: 140 }} />
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="atlas-shimmer" style={{ height: 76, borderRadius: 10 }} />
        <div className="atlas-shimmer" style={{ height: 60, borderRadius: 10 }} />
        <div className="atlas-shimmer" style={{ height: 90, borderRadius: 10 }} />
      </div>
    </div>
  );
}

function SolarDashboard({ solar }: { solar: SolarInsight }) {
  const AVG_HOUSEHOLD_CONSUMPTION = 10500;
  const yearlyEnergyKwh = solar.yearlyEnergyKwh;
  const percentage = Math.round((yearlyEnergyKwh / AVG_HOUSEHOLD_CONSUMPTION) * 100);
  
  // Calculate CO2 Offset (kg of CO2 saved per year)
  // carbonOffsetKgPerMwh: equivalent kg CO2 per MWh. E.g. 600 kg/MWh is a typical average.
  const co2OffsetKg = (yearlyEnergyKwh / 1000) * (solar.carbonOffsetKgPerMwh ?? 600);
  
  // 1 tree absorbs ~22kg of CO2 per year
  const treesCount = Math.round(co2OffsetKg / 22);

  return (
    <div
      style={{
        background: 'rgba(251, 191, 36, 0.03)',
        border: '1.5px solid rgba(251, 191, 36, 0.2)',
        borderRadius: 12,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        marginTop: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ background: 'rgba(251, 191, 36, 0.1)', padding: 5, borderRadius: 6 }}>
          <Sun size={14} style={{ color: '#fbbf24' }} />
        </div>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: '#fbbf24' }}>
          Solar Potential Dashboard
        </div>
      </div>

      {/* Grid of Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div className="glass" style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.01)', border: '1px solid var(--glass-line)' }}>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Max Panels</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginTop: 1 }}>{solar.maxPanels} panels</div>
        </div>

        <div className="glass" style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.01)', border: '1px solid var(--glass-line)' }}>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Roof Area</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginTop: 1 }}>{Math.round(solar.maxAreaMeters2)} m²</div>
        </div>

        <div className="glass" style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.01)', border: '1px solid var(--glass-line)' }}>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Sunshine Hours</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginTop: 1 }}>{Math.round(solar.sunshineHoursPerYear).toLocaleString()} hrs/yr</div>
        </div>

        <div className="glass" style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.01)', border: '1px solid var(--glass-line)' }}>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Carbon Offset</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#34d399', marginTop: 1 }}>{Math.round(co2OffsetKg).toLocaleString()} kg CO₂/yr</div>
        </div>
      </div>

      {/* Environmental Equivalent */}
      {treesCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: '#34d399', background: 'rgba(52, 211, 153, 0.05)', padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(52, 211, 153, 0.1)' }}>
          <Trees size={12} />
          <span>Equivalent to planting <strong>{treesCount.toLocaleString()}</strong> trees per year.</span>
        </div>
      )}

      {/* Progress Bar vs Avg Household Consumption */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-dim)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Zap size={10} /> Offset vs. Average Home</span>
          <span style={{ fontWeight: 600 }}>{percentage}%</span>
        </div>
        <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${Math.min(100, percentage)}%`,
              background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
              borderRadius: 999,
              transition: 'width 800ms var(--ease)',
            }}
          />
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-faint)', display: 'flex', justifyContent: 'space-between' }}>
          <span>{Math.round(yearlyEnergyKwh).toLocaleString()} kWh output</span>
          <span>10,500 kWh avg home consumption</span>
        </div>
      </div>
    </div>
  );
}
