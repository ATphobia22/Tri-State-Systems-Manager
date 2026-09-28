import { useLoaderData } from 'react-router';
import type { MapTwinLoaderData } from '../types/loaders';
import { t } from '../lib/design-tokens';
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
      <h1 style={{ color: t.color.text.primary }}>Digital Twin — {data.site.address}</h1>
      <p style={{ color: t.color.text.secondary, fontSize: t.font.size.base }}>
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
        <Card label="Station WSE" value={data.stage.wse_navd88_ft == null ? 'unavailable' : `${data.stage.wse_navd88_ft.toFixed(2)} ft NAVD88`} />
        <Card label="BFE" value={data.fema.bfe_ft == null ? 'source required' : `${data.fema.bfe_ft} ft`} />
        <Card label="LAG" value={`${data.fema.lag_ft} ft`} />
        <Card label="Clearance" value={`+${data.fema.clearance_ft} ft`} />
        <Card label="FFE" value={`${data.site.elevations.ffe_ft} ft`} />
        <Card label="Berm Crest" value={`${data.site.elevations.bermCrest_ft} ft`} />
      </div>
      <div style={{ background: t.color.surface.card, borderRadius: t.radius.lg, padding: '1rem', marginBottom: 12 }}>
        <h3 style={{ color: t.color.accent.brand, margin: '0 0 0.5rem', fontSize: t.font.size.xl }}>
          Live Stage (loader)
        </h3>
        <p style={{ color: t.color.text.body, margin: 0 }}>
          {data.stage.source} {data.stage.gaugeId}:{' '}
          <strong>
            {data.stage.value_ft != null ? `${data.stage.value_ft} ft` : 'unavailable'}
          </strong>
          {' · '}
          <span style={{ color: t.color.text.secondary }}>{data.stage.floodCategory}</span>
          {' · '}
          <span style={{ color: t.color.text.secondary }}>{data.stage.vertical_reference}</span>
        </p>
        {data.stage.timestamp && (
          <p style={{ color: t.color.text.secondary, fontSize: t.font.size.sm, margin: '0.35rem 0 0' }}>
            {data.stage.timestamp}
          </p>
        )}
      </div>
      <div style={{ background: t.color.surface.base, borderRadius: t.radius.lg, padding: '1rem', border: `1px solid ${t.color.surface.card}` }}>
        <h3 style={{ color: t.color.status.info, margin: '0 0 0.5rem', fontSize: t.font.size.xl }}>
          Community gauges · 60s poll {loading ? '(loading…)' : ''}
        </h3>
        <p style={{ color: t.color.text.secondary, fontSize: t.font.size.sm, margin: '0 0 0.75rem' }}>
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
                fontSize: t.font.size.base,
                color: t.color.text.muted,
                borderBottom: `1px solid ${t.color.surface.card}`,
                paddingBottom: 6,
              }}
            >
              <span>
                {g.name}{' '}
                <span style={{ color: t.color.text.secondary }}>
                  ({g.provider} · {g.provenancePath || '—'})
                </span>
              </span>
              <strong style={{ color: g.status === 'current' ? t.color.status.successBright : t.color.status.warning }}>
                {g.value != null ? `${g.value} ${g.unit || 'ft'}` : g.status}
              </strong>
            </div>
          ))}
        </div>
      </div>
      <p style={{ marginTop: '1rem', fontSize: t.font.size.sm, color: t.color.text.secondary }}>
        FEMA community {data.fema.communityNumber} · No-Rise tolerance {data.fema.noRiseTolerance_ft} ft ·
        Human authority required for all LOMA/LOMR actions · MapLibre twin: /map
      </p>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: t.color.surface.card, borderRadius: t.radius.md, padding: '0.85rem' }}>
      <div style={{ fontSize: t.font.size.xs, color: t.color.text.secondary }}>{label}</div>
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: t.color.accent.brand }}>{value}</div>
    </div>
  );
}

export default MapTwinView;
