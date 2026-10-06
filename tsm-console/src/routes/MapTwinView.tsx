import { useState } from 'react';
import { useLoaderData } from 'react-router';
import type { MapTwinLoaderData } from '../types/loaders';
import { t } from '../lib/design-tokens';
import { toH3Cell } from '../lib/h3-spatial-fabric';
import { fetchLiveStage } from '../lib/stage';

function MapTwinView() {
  const data = useLoaderData() as MapTwinLoaderData;
  // Standing owner rule (2026-10-01, superseding): live values ONLY via a
  // user-initiated "Fetch live snapshot" button. The loader returns the
  // unavailable sentinel; this button is the explicit live path (no polling,
  // no background refresh).
  const [stage, setStage] = useState(data.stage);
  const [fetching, setFetching] = useState(false);
  const fetchSnapshot = async () => {
    setFetching(true);
    try {
      setStage(await fetchLiveStage());
    } finally {
      setFetching(false);
    }
  };
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
        <Card label="Station WSE" value={stage.wse_navd88_ft == null ? 'unavailable' : `${stage.wse_navd88_ft.toFixed(2)} ft NAVD88`} />
        <Card label="BFE" value={data.fema.bfe_ft == null ? 'source required' : `${data.fema.bfe_ft} ft`} />
        <Card label="LAG" value={`${data.fema.lag_ft} ft`} />
        <Card label="Clearance" value={`+${data.fema.clearance_ft} ft`} />
        <Card label="FFE" value={`${data.site.elevations.ffe_ft} ft`} />
        <Card label="Berm Crest" value={`${data.site.elevations.bermCrest_ft} ft`} />
      </div>
      <div style={{ background: t.color.surface.card, borderRadius: t.radius.lg, padding: '1rem', marginBottom: 12 }}>
        <h3 style={{ color: t.color.accent.brand, margin: '0 0 0.5rem', fontSize: t.font.size.xl }}>
          Live Stage (USGS 03378500)
        </h3>
        <p style={{ color: t.color.text.body, margin: '0 0 0.75rem' }}>
          {stage.source} {stage.gaugeId}:{' '}
          <strong>
            {stage.value_ft != null ? `${stage.value_ft} ft` : 'unavailable'}
          </strong>
          {' · '}
          <span style={{ color: t.color.text.secondary }}>{stage.floodCategory}</span>
          {' · '}
          <span style={{ color: t.color.text.secondary }}>{stage.vertical_reference}</span>
        </p>
        {stage.timestamp && (
          <p style={{ color: t.color.text.secondary, fontSize: t.font.size.sm, margin: '0.35rem 0 0' }}>
            {stage.timestamp}
          </p>
        )}
        <button
          type="button"
          onClick={fetchSnapshot}
          disabled={fetching}
          aria-label="Fetch live snapshot"
          style={{
            marginTop: '0.75rem',
            padding: '0.5rem 1rem',
            borderRadius: t.radius.md,
            border: 'none',
            background: t.color.accent.brand,
            color: '#fff',
            fontWeight: 700,
            cursor: fetching ? 'wait' : 'pointer',
          }}
        >
          {fetching ? 'Fetching…' : 'Fetch live snapshot'}
        </button>
        <p style={{ color: t.color.text.secondary, fontSize: t.font.size.sm, margin: '0.5rem 0 0' }}>
          One-time USGS snapshot on press. No automatic polling. Provisional values; site transfer stays fail-closed.
        </p>
      </div>
      <div style={{ background: t.color.surface.base, borderRadius: t.radius.lg, padding: '1rem', border: `1px solid ${t.color.surface.card}` }}>
        <h3 style={{ color: t.color.status.info, margin: '0 0 0.5rem', fontSize: t.font.size.xl }}>
          Community gauges — on-demand snapshots
        </h3>
        <p style={{ color: t.color.text.secondary, fontSize: t.font.size.sm, margin: '0 0 0.75rem' }}>
          Per owner direction 2026-10-01 (superseding): live values only via an
          explicit "Fetch live snapshot" press. No gauges are polled and nothing
          is fabricated to fill the gap; see River Watch for the multi-gauge board.
        </p>
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
