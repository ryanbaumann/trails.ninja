import { useMission, DEFAULT_SCRUB } from './store';
import { disruptionDelta } from './scrub';
import './EnvironmentScrubber.css';

export function EnvironmentScrubber() {
  const scrub = useMission((s) => s.mission.scrub);
  const candidates = useMission((s) => s.mission.candidates);
  const updateScrub = useMission((s) => s.updateScrub);
  const priorities = useMission((s) => s.mission.preferences.priorities);
  const supports = {
    hours: candidates.some((candidate) => candidate.observedSignals?.hours?.valid),
    weather: candidates.some((candidate) => candidate.observedSignals?.weather),
    traffic: candidates.some((candidate) => candidate.observedSignals?.traffic),
    sun: candidates.some((candidate) => candidate.observedSignals?.sun),
  };

  // Only render if we have candidates with factors
  if (candidates.length === 0) return null;

  const baselineRows = disruptionDelta(candidates, DEFAULT_SCRUB, priorities);
  const scrubbedRows = disruptionDelta(candidates, scrub, priorities);

  const baselineWinner = baselineRows[0]?.id;
  const scrubbedWinner = scrubbedRows[0]?.id;
  const rankingChanged = baselineWinner !== scrubbedWinner;

  const formatHour = (hour: number): string => {
    return `${String(hour).padStart(2, '0')}:00`;
  };

  return (
    <section className="glass env-scrubber" aria-label="Condition scrubber">
      <header className="env-scrubber__header">
        <h3>Condition Preview</h3>
        <p className="env-scrubber__subtitle">
          Current provider evidence plus candidate-specific modeled what-if adjustments. Missing signals stay disabled.
        </p>
      </header>

      <div className="env-scrubber__controls">
        <label className="env-scrubber__control">
          <span className="env-scrubber__label">Time</span>
          <div className="env-scrubber__input-group">
            <input
              type="range"
              min="0"
              max="23"
              value={scrub.hour}
              onChange={(e) => updateScrub({ hour: Number(e.target.value) })}
              aria-label="Hour of day"
            />
            <output className="env-scrubber__value">{formatHour(scrub.hour)}</output>
          </div>
        </label>

        <label className="env-scrubber__control">
          <span className="env-scrubber__label">Weather</span>
          <select
            disabled={!supports.weather}
            value={scrub.weather}
            onChange={(e) => updateScrub({ weather: e.target.value as 'clear' | 'rain' | 'heat' | 'wind' })}
            aria-label="Weather condition"
          >
            <option value="clear">Clear</option>
            <option value="rain">Rain</option>
            <option value="heat">Heat</option>
            <option value="wind">Wind</option>
          </select>
        </label>

        <label className="env-scrubber__control">
          <span className="env-scrubber__label">Traffic</span>
          <select
            disabled={!supports.traffic}
            value={scrub.traffic}
            onChange={(e) => updateScrub({ traffic: e.target.value as 'light' | 'moderate' | 'heavy' })}
            aria-label="Traffic level"
          >
            <option value="light">Light</option>
            <option value="moderate">Moderate</option>
            <option value="heavy">Heavy</option>
          </select>
        </label>

        <label className="env-scrubber__control">
          <span className="env-scrubber__label">Sun</span>
          <select
            disabled={!supports.sun}
            value={scrub.sun}
            onChange={(e) => updateScrub({ sun: e.target.value as 'low' | 'mid' | 'high' })}
            aria-label="Sun elevation"
          >
            <option value="low">Low (glare)</option>
            <option value="mid">Mid</option>
            <option value="high">High (clear)</option>
          </select>
        </label>

        <label className="env-scrubber__control env-scrubber__control--checkbox">
          <input
            type="checkbox"
            disabled={!supports.hours}
            checked={scrub.openOnly}
            onChange={(e) => updateScrub({ openOnly: e.target.checked })}
            aria-label="Filter to open candidates only"
          />
          <span className="env-scrubber__label">Open at selected time only{supports.hours ? '' : ' · hours unavailable'}</span>
        </label>
      </div>

      <div className="env-scrubber__results">
        <h4 className="env-scrubber__results-header">Impact</h4>

        {rankingChanged && (
          <div className="env-scrubber__ranking-alert" role="status" aria-live="polite">
            <strong>Ranking would flip:</strong> {scrubbedRows[0]?.label} would become top choice
          </div>
        )}

        {!rankingChanged && scrubbedRows.length > 0 && (
          <div className="env-scrubber__ranking-stable" role="status" aria-live="polite">
            Ranking unchanged ({scrubbedRows[0]?.label} remains top)
          </div>
        )}

        <ul className="env-scrubber__list" aria-label="Candidate score deltas">
          {scrubbedRows.map((row) => {
            const isPositive = row.delta > 0;
            const isNegative = row.delta < 0;
            const deltaClass = isPositive ? 'is-positive' : isNegative ? 'is-negative' : '';
            const sign = isPositive ? '+' : '';

            return (
              <li key={row.id} className="env-scrubber__item">
                <span className="env-scrubber__candidate-label">{row.label}</span>
                <span className="env-scrubber__scores">
                  <span className="env-scrubber__base">{row.base.toFixed(1)}</span>
                  <span className="env-scrubber__arrow">→</span>
                  <span className="env-scrubber__scrubbed">{row.scrubbed.toFixed(1)}</span>
                </span>
                <span className={`env-scrubber__delta ${deltaClass}`}>
                  {sign}{row.delta.toFixed(1)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
