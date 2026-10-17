/**
 * Scenario Studio panel — cascading impact rehearsal on Twin Canvas.
 * SIMULATION_DEMO only; human-triggered; fail-closed evidence posture preserved.
 */
import { useMemo, useState } from 'react';
import {
  ADAPTATION_OPTIONS,
  SCENARIO_EVENTS,
  SCREENING_CRITICAL_FACILITIES,
  runScenarioStudio,
  type AdaptationId,
  type ScenarioEventId,
  type ScenarioStudioResult,
  type ImpactSeverity,
} from '../lib/scenario-studio';

const SEV_COLOR: Record<ImpactSeverity, string> = {
  none: '#64748b',
  watch: '#38bdf8',
  elevated: '#fbbf24',
  severe: '#f87171',
};

type Props = {
  onResult?: (result: ScenarioStudioResult | null) => void;
};

export default function ScenarioStudioPanel({ onResult }: Props): React.JSX.Element {
  const [eventId, setEventId] = useState<ScenarioEventId>('screening-100yr');
  const [adaptationId, setAdaptationId] = useState<AdaptationId>('none');
  const [result, setResult] = useState<ScenarioStudioResult | null>(null);

  const eventMeta = useMemo(
    () => SCENARIO_EVENTS.find((e) => e.id === eventId) ?? SCENARIO_EVENTS[0],
    [eventId],
  );

  const run = (): void => {
    const next = runScenarioStudio(eventId, adaptationId, SCREENING_CRITICAL_FACILITIES);
    setResult(next);
    onResult?.(next);
  };

  const clear = (): void => {
    setResult(null);
    onResult?.(null);
  };

  return (
    <div
      role="region"
      aria-label="Scenario Studio cascading impacts"
      style={{
        marginTop: 10,
        padding: 10,
        borderRadius: 8,
        border: '1px solid #334155',
        background: 'rgba(15,23,42,0.9)',
      }}
    >
      <strong style={{ color: '#fbbf24' }}>Scenario Studio · cascading impacts</strong>
      <div style={{ marginTop: 4, color: '#94a3b8', fontSize: 11 }}>
        SIMULATION_DEMO / SCENARIO · relative screening only · not SFHA · not a warning system · human authority final
      </div>

      <label style={{ display: 'block', marginTop: 8, fontSize: 11, color: '#cbd5e1' }}>
        Event
        <select
          value={eventId}
          onChange={(e) => setEventId(e.target.value as ScenarioEventId)}
          style={{ display: 'block', width: '100%', marginTop: 4, minHeight: 40, background: '#020617', color: '#e2e8f0', border: '1px solid #1e293b', borderRadius: 6 }}
        >
          {SCENARIO_EVENTS.map((e) => (
            <option key={e.id} value={e.id}>
              {e.label}
            </option>
          ))}
        </select>
      </label>
      <div style={{ marginTop: 4, fontSize: 11, color: '#64748b' }}>{eventMeta.description}</div>

      <label style={{ display: 'block', marginTop: 8, fontSize: 11, color: '#cbd5e1' }}>
        Adaptation
        <select
          value={adaptationId}
          onChange={(e) => setAdaptationId(e.target.value as AdaptationId)}
          style={{ display: 'block', width: '100%', marginTop: 4, minHeight: 40, background: '#020617', color: '#e2e8f0', border: '1px solid #1e293b', borderRadius: 6 }}
        >
          {ADAPTATION_OPTIONS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </label>

      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={run}
          style={{
            minHeight: 44,
            padding: '0.5rem 0.9rem',
            borderRadius: 8,
            border: '1px solid #854d0e',
            background: 'rgba(251,191,36,0.15)',
            color: '#fbbf24',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Run scenario (human-triggered)
        </button>
        <button
          type="button"
          onClick={clear}
          style={{
            minHeight: 44,
            padding: '0.5rem 0.9rem',
            borderRadius: 8,
            border: '1px solid #1e293b',
            background: '#020617',
            color: '#94a3b8',
            cursor: 'pointer',
          }}
        >
          Clear
        </button>
      </div>

      {result && (
        <div style={{ marginTop: 10 }}>
          <div style={{ color: '#fbbf24', fontWeight: 600 }}>
            Residual risk index (screening): {result.residualRiskIndex.toFixed(3)} · {result.label}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            Ran {result.runAt} · {result.event.evidenceNote}
          </div>
          <ul style={{ margin: '8px 0 0', paddingLeft: 16, fontSize: 11 }}>
            {result.impacts.map((row) => (
              <li key={row.assetId} style={{ marginBottom: 4, color: SEV_COLOR[row.severity] }}>
                <strong>{row.assetName}</strong> ({row.category}) — {row.severity} · {row.score.toFixed(2)}
              </li>
            ))}
          </ul>
          <p style={{ marginTop: 8, fontSize: 10, color: '#78716c' }}>{result.disclaimer}</p>
        </div>
      )}
    </div>
  );
}
