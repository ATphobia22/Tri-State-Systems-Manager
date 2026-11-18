import type { StationLiveSnapshot } from '../lib/multi-stage-fetch';

type Props = {
  stations: StationLiveSnapshot[];
  busy: boolean;
  error: string | null;
  onFetchAll: () => void;
};

function fmt(v: number | null | undefined, unit = 'ft'): string {
  return v == null || !Number.isFinite(v) ? '—' : `${v.toFixed(2)} ${unit}`;
}

/** Scope C — multi-station live water levels (button-only constellation). */
export default function MultiStationWaterPanel({ stations, busy, error, onFetchAll }: Props) {
  return (
    <div
      role="region"
      aria-label="Multi-station water levels"
      style={{
        marginTop: 8,
        padding: 10,
        borderRadius: 8,
        border: '1px solid #1e3a5f',
        background: 'rgba(15,23,42,0.95)',
        color: '#e2e8f0',
      }}
    >
      <div style={{ fontWeight: 700, color: '#f8fafc' }}>Live water levels (multi-station)</div>
      <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>
        Button-only · TSM API preferred; official USGS OGC fallback on unavailable stations · readings are gage height, NOT NAVD88
      </div>
      <button
        type="button"
        onClick={onFetchAll}
        disabled={busy}
        aria-busy={busy}
        style={{
          marginTop: 8,
          minHeight: 44,
          padding: '0.55rem 1rem',
          borderRadius: 8,
          border: '1px solid #0ea5e9',
          background: busy ? '#0c4a6e' : '#0369a1',
          color: '#f0f9ff',
          fontWeight: 700,
          fontSize: 13,
          cursor: busy ? 'wait' : 'pointer',
        }}
      >
        {busy ? 'Fetching constellation…' : 'Fetch all local water levels'}
      </button>
      {error && (
        <div role="alert" style={{ color: '#fca5a5', marginTop: 6, fontSize: 12 }}>
          {error}
        </div>
      )}
      {stations.length > 0 && (
        <table aria-label="Source-attributed river gauge observations" style={{ width: '100%', marginTop: 8, borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ color: '#94a3b8', textAlign: 'left' }}>
              <th style={{ padding: '4px 2px' }}>Station</th>
              <th style={{ padding: '4px 2px' }}>Stage</th>
              <th style={{ padding: '4px 2px' }} title="Requires a verified station-specific vertical-datum conversion">WSE NAVD88</th>
              <th style={{ padding: '4px 2px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {stations.map((s) => (
              <tr key={s.stationId} style={{ borderTop: '1px solid #1e293b' }}>
                <td style={{ padding: '4px 2px', color: '#e2e8f0' }}>
                  <div>{s.name}</div>
                  <div style={{ color: '#cbd5e1' }}>{s.stationId}</div>
                  {s.sourceUri?.startsWith('https://api.waterdata.usgs.gov/') && (
                    <a href={s.sourceUri} target="_blank" rel="noopener noreferrer"
                      style={{ color: '#7dd3fc' }}>USGS source</a>
                  )}
                </td>
                <td style={{ padding: '4px 2px' }}>
                  {fmt(s.stage_ft)}
                  {s.observedAt && <div style={{ color: '#cbd5e1', fontSize: 10 }}>Observed {s.observedAt}</div>}
                </td>
                <td style={{ padding: '4px 2px' }}>
                  {s.conversion_applied ? fmt(s.wse_navd88_ft) : <span title="A published, verified station gage-zero conversion is not available.">unavailable — GAGE_DATUM</span>}
                </td>
                <td style={{ padding: '4px 2px', color: s.error ? '#fca5a5' : '#86efac' }}>
                  {s.error ? s.error.slice(0, 40) : s.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
