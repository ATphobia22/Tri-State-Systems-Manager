import { useLoaderData } from 'react-router';
import type { MapTwinLoaderData } from '../types/loaders';

function MapTwinView() {
  const data = useLoaderData() as MapTwinLoaderData;
  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ color: '#f8fafc' }}>Digital Twin — {data.site.address}</h1>
      <p style={{ color: '#64748b', fontSize: '0.8rem' }}>
        {data.site.township}, {data.site.county} · APN {data.site.apn} · EPSG:{data.site.crs.horizontalEpsg} / {data.site.crs.verticalDatum}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, margin: '1.25rem 0' }}>
        <Card label="BFE" value={`${data.fema.bfe_ft} ft`} />
        <Card label="LAG" value={`${data.fema.lag_ft} ft`} />
        <Card label="Clearance" value={`+${data.fema.clearance_ft} ft`} />
        <Card label="FFE" value={`${data.site.elevations.ffe_ft} ft`} />
        <Card label="Berm Crest" value={`${data.site.elevations.bermCrest_ft} ft`} />
      </div>
      <div style={{ background: '#1e293b', borderRadius: 12, padding: '1rem' }}>
        <h3 style={{ color: '#38bdf8', margin: '0 0 0.5rem', fontSize: '0.9rem' }}>Live Stage</h3>
        <p style={{ color: '#e2e8f0', margin: 0 }}>
          {data.stage.source} {data.stage.gaugeId}:{' '}
          <strong>{data.stage.value_ft != null ? `${data.stage.value_ft} ft` : 'unavailable'}</strong>
          {' · '}
          <span style={{ color: '#94a3b8' }}>{data.stage.floodCategory}</span>
        </p>
        {data.stage.timestamp && (
          <p style={{ color: '#64748b', fontSize: '0.7rem', margin: '0.35rem 0 0' }}>{data.stage.timestamp}</p>
        )}
      </div>
      <p style={{ marginTop: '1rem', fontSize: '0.7rem', color: '#475569' }}>
        FEMA community {data.fema.communityNumber} · No-Rise tolerance {data.fema.noRiseTolerance_ft} ft · Human authority required for all LOMA/LOMR actions
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
