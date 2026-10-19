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
      }}
    >
      <div style={{ fontWeight: 700, color: '#f8fafc' }}>Live water levels (multi-station)</div>
      <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>
        Button-only · parallel USGS OGC · each station resilient independently · GAGE_DATUM until conversion published
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
        <table style={{ width: '100%', marginTop: 8, borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ color: '#94a3b8', textAlign: 'left' }}>
              <th style={{ padding: '4px 2px' }}>Station</th>
              <th style={{ padding: '4px 2px' }}>Stage</th>
              <th style={{ padding: '4px 2px' }}>WSE NAVD88</th>
              <th style={{ padding: '4px 2px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {stations.map((s) => (
              <tr key={s.stationId} style={{ borderTop: '1px solid #1e293b' }}>
                <td style={{ padding: '4px 2px', color: '#e2e8f0' }}>
                  <div>{s.name}</div>
                  <div style={{ color: '#64748b' }}>{s.stationId}</div>
                </td>
                <td style={{ padding: '4px 2px' }}>{fmt(s.stage_ft)}</td>
                <td style={{ padding: '4px 2px' }}>
                  {s.conversion_applied ? fmt(s.wse_navd88_ft) : 'blocked'}
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
