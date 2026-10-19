import type { MapTwinLoaderData } from '../types/loaders';

type Props = {
  stage: MapTwinLoaderData['stage'];
  site: MapTwinLoaderData['site'];
  terrainMessage: string;
  onFetchLive: () => void;
  fetchBusy: boolean;
  fetchError: string | null;
};

function fmt(v: number | null | undefined, unit = 'ft'): string {
  return v == null || !Number.isFinite(v) ? 'unavailable' : `${v.toFixed(2)} ${unit}`;
}

/**
 * Vertical truth HUD — makes datum class visible.
 * Missing conversion inputs remain explicitly unavailable; no gage-zero or WSE is inferred.
 */
export default function VerticalContextHud({
  stage,
  site,
  terrainMessage,
  onFetchLive,
  fetchBusy,
  fetchError,
}: Props) {
  const verticalRef = stage.wse_navd88_ft != null && stage.conversion_applied
    ? 'NAVD88 (station WSE when conversion published)'
    : stage.value_ft != null
      ? 'GAGE_DATUM (raw stage)'
      : 'UNKNOWN (no live snapshot)';

  const freeboard =
    site.elevations.lag_ft != null && site.elevations.bfe_ft != null
      ? site.elevations.lag_ft - site.elevations.bfe_ft
      : null;

  return (
    <div
      role="region"
      aria-label="Vertical context"
      style={{
        marginTop: 8,
        padding: 10,
        borderRadius: 8,
        border: '1px solid #334155',
        background: 'rgba(15,23,42,0.95)',
      }}
    >
      <div style={{ fontWeight: 700, color: '#f8fafc', marginBottom: 6 }}>Vertical context</div>
      <div>Active reference: <strong style={{ color: '#38bdf8' }}>{verticalRef}</strong></div>
      <div style={{ color: '#94a3b8' }}>{terrainMessage}</div>
      <div style={{ marginTop: 6 }}>
        Stage (gage datum): {fmt(stage.value_ft)}
        {stage.qualifier ? ` · qualifier ${stage.qualifier}` : ''}
        {stage.status ? ` · ${stage.status}` : ''}
      </div>
      <div>
        Station WSE NAVD88:{' '}
        {stage.conversion_applied && stage.wse_navd88_ft != null
          ? fmt(stage.wse_navd88_ft)
          : 'unavailable — published gage-zero required'}
      </div>
      <div>
        Site (orthometric labels): BFE {fmt(site.elevations.bfe_ft)} · LAG {fmt(site.elevations.lag_ft)} ·
        FFE {fmt(site.elevations.ffe_ft)} · Berm {fmt(site.elevations.bermCrest_ft)}
      </div>
      <div>
        Freeboard (LAG − BFE):{' '}
        {freeboard == null ? 'unavailable' : `${freeboard.toFixed(2)} ft`}
        <span style={{ color: '#94a3b8' }}> · derived from labeled site constants, not a survey</span>
      </div>
      <div style={{ color: '#94a3b8', marginTop: 4 }}>
        Transfer / extrusion remain gated until a validated hydraulic profile exists. Human authority remains final.
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          onClick={onFetchLive}
          disabled={fetchBusy}
          aria-busy={fetchBusy}
          style={{
            minHeight: 44,
            padding: '0.55rem 1rem',
            borderRadius: 8,
            border: '1px solid #0ea5e9',
            background: fetchBusy ? '#0c4a6e' : '#0369a1',
            color: '#f0f9ff',
            fontWeight: 700,
            fontSize: 13,
            cursor: fetchBusy ? 'wait' : 'pointer',
          }}
        >
          {fetchBusy ? 'Fetching USGS snapshot…' : 'Fetch live water level'}
        </button>
        <span style={{ color: '#86efac', fontSize: 11 }}>
          Button-only · no auto-fetch · no polling · USGS OGC latest-continuous
        </span>
      </div>
      {fetchError && (
        <div role="alert" style={{ color: '#fca5a5', marginTop: 6 }}>
          {fetchError}
        </div>
      )}
      {stage.timestamp && (
        <div style={{ color: '#cbd5e1', marginTop: 4, fontSize: 11 }}>
          Observed: {stage.timestamp} · Retrieved: {stage.retrievedAt}
        </div>
      )}
    </div>
  );
}
