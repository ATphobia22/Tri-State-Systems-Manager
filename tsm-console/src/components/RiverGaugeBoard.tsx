import { useEffect, useMemo, useState } from 'react';
import { COMMUNITY_RIVER_GAUGES, fetchCommunityGauges, type RiverGaugeObservation } from '../lib/river-gauges';

const largeType = {
  fontSize: '1.15rem',
  lineHeight: 1.5,
};

function statusLabel(status: RiverGaugeObservation['status']): string {
  if (status === 'current') return 'LIVE OBSERVATION';
  if (status === 'stale') return 'STALE — REFRESH NEEDED';
  if (status === 'candidate') return 'CANDIDATE — NOT LIVE';
  return 'SOURCE UNAVAILABLE';
}

export default function RiverGaugeBoard(): JSX.Element {
  const [observations, setObservations] = useState<RiverGaugeObservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);

  const refresh = async (): Promise<void> => {
    setLoading(true);
    const next = await fetchCommunityGauges();
    setObservations(next);
    setLastRefresh(new Date().toISOString());
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const byId = useMemo(() => new Map(observations.map((item) => [item.gaugeId, item])), [observations]);

  return (
    <section aria-labelledby="river-gauge-board-title" style={{ background: '#06101a', color: '#f8fafc', border: '1px solid #334155', borderRadius: 18, padding: 20 }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div>
          <h2 id="river-gauge-board-title" style={{ ...largeType, margin: 0, fontWeight: 900 }}>River Watch — Lower Wabash & Ohio</h2>
          <p style={{ margin: '6px 0 0', color: '#cbd5e1', fontSize: '1rem' }}>Real-time government observations. These are measurements, not predictions.</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading} style={{ ...largeType, padding: '10px 16px', borderRadius: 12, border: '2px solid #64748b', background: '#0f172a', color: '#fff', fontWeight: 800 }}>
          {loading ? 'Refreshing…' : 'Refresh river gauges'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 14, marginTop: 18 }}>
        {COMMUNITY_RIVER_GAUGES.map((definition) => {
          const observation = byId.get(definition.usgsId ?? definition.nwsId ?? definition.id);
          return (
            <article key={definition.id} aria-label={`${definition.name} river gauge`} style={{ border: '1px solid #475569', borderRadius: 14, padding: 16, background: '#0b1724' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.4 }}>{definition.name}</h3>
              <div style={{ marginTop: 10, fontSize: '2rem', fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
                {observation?.value === null || observation?.value === undefined ? '—' : `${observation.value.toFixed(2)} ft`}
              </div>
              <div style={{ marginTop: 4, color: '#cbd5e1', ...largeType }}>{statusLabel(observation?.status ?? 'unavailable')}</div>
              <dl style={{ margin: '12px 0 0', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 10px', color: '#cbd5e1' }}>
                <dt>Observed</dt><dd style={{ margin: 0 }}>{observation?.observedAt ? new Date(observation.observedAt).toLocaleString() : 'Not available'}</dd>
                <dt>Source</dt><dd style={{ margin: 0 }}>{observation?.provider ?? definition.provider}</dd>
                <dt>Quality</dt><dd style={{ margin: 0 }}>{observation?.provisional ? 'Provisional' : observation?.qualifier ?? 'Not reported'}</dd>
                {observation?.dischargeCfs !== null && observation?.dischargeCfs !== undefined && <><dt>Flow</dt><dd style={{ margin: 0 }}>{observation.dischargeCfs.toLocaleString()} cfs</dd></>}
              </dl>
            </article>
          );
        })}
      </div>

      <p style={{ margin: '16px 0 0', color: '#94a3b8', fontSize: '.95rem' }}>
        Last dashboard refresh: {lastRefresh ? new Date(lastRefresh).toLocaleString() : 'not yet completed'}. A missing or stale source is shown as such rather than replaced with a guessed value.
      </p>
    </section>
  );
}
