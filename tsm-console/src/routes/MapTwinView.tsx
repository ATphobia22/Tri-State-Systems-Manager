import { useLoaderData } from 'react-router';
import type { MapTwinLoaderData } from '../types/loaders';
import { useLiveGauges } from '../hooks/useLiveGauges';
import { toH3Cell } from '../lib/h3-spatial-fabric';

function MapTwinView() {
  const data = useLoaderData() as MapTwinLoaderData;
  const { gauges, loading, lastUpdated } = useLiveGauges(60_000);
  const centerLat = (data.boundingEnvelope.minLat + data.boundingEnvelope.maxLat) / 2;
  const centerLon = (data.boundingEnvelope.minLon + data.boundingEnvelope.maxLon) / 2;
  let h3Cell = '—';
  try {
    h3Cell = toH3Cell(centerLat, centerLon, 9);
  } catch {
    /* invalid envelope */
  }

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: 960, margin: '0 auto' }}>
      <h1 style={{ color: '#f8fafc' }}>Digital Twin — {data.site.address}</h1>
      <p style={{ color: '#64748b', fontSize: '0.8rem' }}>
        {data.site.township}, {data.site.county} · APN {data.site.apn} · EPSG:{data.site.crs.horizontalEpsg} /{' '}
        {data.site.crs.verticalDatum} · H3 r9 {h3Cell}
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))',
          gap: 12,
          margin: '1.25rem 0',
        }}
      >
        <Card label="BFE" value={`${data.fema.bfe_ft} ft`} />
        <Card label="LAG" value={`${data.fema.lag_ft} ft`} />
        <Card label="Clearance" value={`+${data.fema.clearance_ft} ft`} />
        <Card label="FFE" value={`${data.site.elevations.ffe_ft} ft`} />
        <Card label="Berm Crest" value={`${data.site.elevations.bermCrest_ft} ft`} />
      </div>
      <div style={{ background: '#1e293b', borderRadius: 12, padding: '1rem', marginBottom: 12 }}>
        <h3 style={{ color: '#38bdf8', margin: '0 0 0.5rem', fontSize: '0.9rem' }}>
          Live Stage (loader)
        </h3>
        <p style={{ color: '#e2e8f0', margin: 0 }}>
          {data.stage.source} {data.stage.gaugeId}:{' '}
          <strong>
            {data.stage.value_ft != null ? `${data.stage.value_ft} ft` : 'unavailable'}
          </strong>
          {' · '}
          <span style={{ color: '#94a3b8' }}>{data.stage.floodCategory}</span>
          {' · '}
          <span style={{ color: '#64748b' }}>{data.stage.vertical_reference}</span>
        </p>
        {data.stage.timestamp && (
          <p style={{ color: '#64748b', fontSize: '0.7rem', margin: '0.35rem 0 0' }}>
            {data.stage.timestamp}
          </p>
        )}
      </div>
      <div style={{ background: '#0f172a', borderRadius: 12, padding: '1rem', border: '1px solid #1e293b' }}>
        <h3 style={{ color: '#7dd3fc', margin: '0 0 0.5rem', fontSize: '0.9rem' }}>
          Community gauges · 60s poll {loading ? '(loading…)' : ''}
        </h3>
        <p style={{ color: '#64748b', fontSize: '0.7rem', margin: '0 0 0.75rem' }}>
          Path: TSM /api/hydrologic/community → USGS OGC direct → last-known-good
          {lastUpdated ? ` · updated ${lastUpdated}` : ''}
        </p>
        <div style={{ display: 'grid', gap: 8 }}>
          {gauges.slice(0, 8).map((g) => (
            <div
              key={g.gaugeId}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                fontSize: '0.8rem',
                color: '#cbd5e1',
                borderBottom: '1px solid #1e293b',
                paddingBottom: 6,
              }}
            >
              <span>
                {g.name}{' '}
                <span style={{ color: '#64748b' }}>
                  ({g.provider} · {g.provenancePath || '—'})
                </span>
              </span>
              <strong style={{ color: g.status === 'current' ? '#4ade80' : '#fbbf24' }}>
                {g.value != null ? `${g.value} ${g.unit || 'ft'}` : g.status}
              </strong>
            </div>
          ))}
        </div>
      </div>
      <p style={{ marginTop: '1rem', fontSize: '0.7rem', color: '#475569' }}>
        FEMA community {data.fema.communityNumber} · No-Rise tolerance {data.fema.noRiseTolerance_ft} ft ·
        Human authority required for all LOMA/LOMR actions · MapLibre twin: /map
      </p>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#1e293b', borderRadius: 10, padding: '0.85rem' }}>
      <div style={{ fontSize: '0.65rem', color: '#64748b' }}>{label}</div>
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38bdf8' }}>{value}</div>
    </div>
  );
}

export default MapTwinView;
