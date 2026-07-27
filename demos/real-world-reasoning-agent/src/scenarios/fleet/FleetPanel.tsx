import { Gauge, Crosshair, Zap } from 'lucide-react';
import { useFleet, type VanStatus } from './store';
import { followVan } from './sim';
import { sendToCopilot } from '@/ai/session';
import { fmtDistance, fmtDuration } from '@/lib/format';

const STATUS_COLOR: Record<VanStatus, string> = {
  enroute: '#22d3ee',
  idle: '#8a93a6',
  returning: '#f59e0b',
};

export function FleetPanel() {
  const vans = useFleet((s) => s.vans);
  const jobs = useFleet((s) => s.jobs);
  const kpis = useFleet((s) => s.kpis);
  const simSpeed = useFleet((s) => s.simSpeed);
  const followId = useFleet((s) => s.followVanId);
  const running = useFleet((s) => s.running);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div>
        <h2 style={{ fontSize: 20, marginBottom: 4 }}>Dispatch has eyes now</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.5 }}>
          A live fleet on real streets. Ask Atlas below to compare ETAs, assign jobs, or
          route around an area — every decision uses real traffic-aware Routes data.
        </p>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'flex', gap: 8 }}>
        <Kpi label="Active" value={`${kpis.active}/${kpis.total}`} />
        <Kpi label="On-time" value={`${kpis.onTimePct}%`} />
        <Kpi label="Avg ETA" value={kpis.avgEtaSeconds ? fmtDuration(kpis.avgEtaSeconds) : '—'} />
        <Kpi label="Distance" value={fmtDistance(kpis.distanceTodayMeters)} />
      </div>

      {/* Sim speed */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Gauge size={14} style={{ color: 'var(--text-dim)' }} />
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Sim speed</span>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          {[1, 4, 16].map((m) => (
            <button
              key={m}
              className="fleet-speed-btn"
              onClick={() => useFleet.getState().setSimSpeed(m)}
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: 8,
                fontFamily: 'var(--font-mono)',
                color: simSpeed === m ? '#0b0e14' : 'var(--text-dim)',
                background: simSpeed === m ? '#22d3ee' : 'var(--glass-2)',
                border: '1px solid var(--glass-line)',
              }}
            >
              {m}×
            </button>
          ))}
        </div>
      </div>

      <div className="panel-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingRight: 2 }}>
        {/* Job feed */}
        <Section title={`Live jobs (${jobs.length})`}>
          {jobs.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>
              {running ? 'Vans idle — new orders will appear here.' : 'Starting the fleet…'}
            </p>
          )}
          {jobs.map((j) => (
            <div
              key={j.id}
              className="glass"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 10px',
                borderRadius: 10,
                borderLeft: `3px solid ${j.status === 'unassigned' ? '#f59e0b' : '#6d5ef3'}`,
                ...(j.status === 'unassigned' ? { animation: 'atlas-pulse 1.8s ease-in-out infinite' } : {}),
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-dim)' }}>{j.id}</span>
              <span style={{ fontSize: 12.5, flex: 1 }}>{j.label}</span>
              <span style={{ fontSize: 11, color: j.status === 'unassigned' ? 'var(--warn)' : 'var(--text-dim)' }}>
                {j.status === 'unassigned' ? 'unassigned' : j.vanId}
              </span>
            </div>
          ))}
        </Section>

        {/* Van roster */}
        <Section title={`Fleet (${vans.length})`}>
          {vans.map((v) => (
            <div
              key={v.id}
              className="glass"
              style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', borderRadius: 10 }}
            >
              <span style={{ width: 9, height: 9, borderRadius: 999, background: STATUS_COLOR[v.status], flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>{v.label}</span>
              <span style={{ fontSize: 11.5, color: 'var(--text-dim)', flex: 1 }}>
                {v.status === 'enroute' ? `ETA ${fmtDuration(v.etaSeconds)}` : v.status}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                {fmtDistance(v.distanceTodayMeters)}
              </span>
              <button
                onClick={() => followVan(followId === v.id ? null : v.id)}
                aria-label={`Follow ${v.label}`}
                title="Follow"
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 7,
                  display: 'grid',
                  placeItems: 'center',
                  color: followId === v.id ? '#0b0e14' : 'var(--text-dim)',
                  background: followId === v.id ? '#22d3ee' : 'var(--glass-2)',
                  border: '1px solid var(--glass-line)',
                }}
              >
                <Crosshair size={13} />
              </button>
            </div>
          ))}
        </Section>
      </div>

      <button
        onClick={() => sendToCopilot('Which van reaches the Marina fastest right now, and assign it that job.')}
        style={{
          padding: '10px 14px',
          borderRadius: 12,
          background: 'var(--accent-soft)',
          border: '1px solid var(--glass-line)',
          color: 'var(--text)',
          fontWeight: 600,
          fontSize: 13,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 7,
        }}
      >
        <Zap size={14} /> Ask dispatch to optimize
      </button>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass" style={{ flex: 1, padding: '8px 9px', borderRadius: 11 }}>
      <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 9.5, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 10.5, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</div>
      {children}
    </div>
  );
}
