import type { CSSProperties } from 'react';

export interface BuildingInspectionPanelProps {
  properties: Record<string, unknown>;
  onClose: () => void;
}

const IGIO_FOOTPRINT = 'https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0';
const IGIO_ADDRESS = 'https://gisdata.in.gov/server/rest/services/Hosted/Address_Points_of_Indiana_2025/FeatureServer/0';

const card: CSSProperties = {
  position: 'absolute', right: 12, top: 12, zIndex: 21,
  width: 355, maxWidth: 'calc(100% - 24px)',
  maxHeight: 'calc(100% - 24px)', overflowY: 'auto',
  border: '1px solid rgba(34,211,238,.45)', borderRadius: 14,
  padding: 16, background: 'rgba(5, 13, 26, .96)',
  color: '#e2e8f0', boxShadow: '0 8px 36px rgba(0,0,0,.55)',
  backdropFilter: 'blur(16px)', fontSize: 12,
};

function printable(value: unknown): string {
  if (value == null || value === '') return 'Not available';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string') return value.slice(0, 300);
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'Not available';
  return 'Unsupported value';
}

function getObjectId(props: Record<string, unknown>): number | null {
  const raw = props.igio_objectid ?? props.objectid ?? props.OBJECTID;
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : NaN;
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

export function BuildingInspectionPanel({ properties, onClose }: BuildingInspectionPanelProps): JSX.Element {
  const id = getObjectId(properties);
  const address = properties.tsm_address || properties.geofulladdress;
  const height = properties.tsm_visual_height_m;
  const hasHeight = typeof height === 'number' && Number.isFinite(height) && height > 0;
  const joinedAddress = properties.tsm_address_status === 'MATCHED_OFFICIAL_POINT' && typeof address === 'string' && address.length > 0;
  const sourceUrl = id == null ? IGIO_FOOTPRINT : IGIO_FOOTPRINT + '/query?where=' + encodeURIComponent('objectid=' + id) + '&outFields=*&f=geojson';

  return (
    <aside role="dialog" aria-label="Selected building details and sources" style={card}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        <strong style={{ fontSize: 15, letterSpacing: '.03em' }}>BUILDING // {id ?? 'UNIDENTIFIED'}</strong>
        <button type="button" onClick={onClose} aria-label="Close building details" style={{ background: '#1e293b', color: '#e2e8f0', border: '1px solid #64748b', borderRadius: 6, padding: '4px 9px', cursor: 'pointer' }}>Close</button>
      </div>
      <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(14,116,144,.12)', border: '1px solid rgba(14,116,144,.35)', borderRadius: 8 }}>
        <div style={{ fontWeight: 700 }}>{joinedAddress ? printable(address) : 'Address not verified'}</div>
        <div style={{ color: '#fbbf24', marginTop: 4 }}>{joinedAddress ? 'Official address-point match — not a survey or parcel determination' : 'No authenticated point-to-building address match has been supplied'}</div>
      </div>
      <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ borderRadius: 8, padding: 10, background: '#172033' }}>
          <div style={{ color: '#94a3b8' }}>3D representation</div>
          <strong>{hasHeight ? Number(height).toFixed(1) + ' m AGL' : 'Footprint only'}</strong>
        </div>
        <div style={{ borderRadius: 8, padding: 10, background: '#172033' }}>
          <div style={{ color: '#94a3b8' }}>Geometry class</div>
          <strong>{printable(properties.tsm_geometry_lod ?? 'LoD0')}</strong>
        </div>
      </div>
      <p style={{ color: '#fbbf24', lineHeight: 1.5, marginTop: 12 }}>
        This model is illustrative. Estimated heights are not verified LiDAR roof measurements; no NAVD88 building elevation or FEMA approval is inferred.
      </p>
      <h4 style={{ fontSize: 12, marginTop: 14, marginBottom: 7 }}>Source documents</h4>
      <div style={{ display: 'grid', gap: 6 }}>
        <a href={sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#67e8f9' }}>Indiana GIO footprint record</a>
        <a href={IGIO_ADDRESS} target="_blank" rel="noopener noreferrer" style={{ color: '#67e8f9' }}>Indiana GIO address-points dataset (2025)</a>
      </div>
      <h4 style={{ fontSize: 12, marginTop: 14, marginBottom: 8 }}>Available feature attributes and provenance</h4>
      <div style={{ display: 'grid', gap: 4 }}>
        {Object.entries(properties)
          .filter(([key]) => /^tsm_[a-z0-9_]+$/i.test(key) || ['objectid', 'OBJECTID', 'igio_objectid'].includes(key))
          .sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => (
          <div key={key} style={{ display: 'grid', gridTemplateColumns: 'minmax(105px, 45%) 1fr', gap: 7, borderBottom: '1px solid rgba(148,163,184,.14)', padding: '4px 0', wordBreak: 'break-word' }}>
            <span style={{ color: '#94a3b8' }}>{key}</span>
            <span>{printable(value)}</span>
          </div>
        ))}
      </div>
      <p style={{ color: '#94a3b8', fontSize: 10, lineHeight: 1.5, marginTop: 12 }}>
        Fields describe the selected feature and its named source records only. Source metadata and inferred attributes must be independently checked before engineering use.
      </p>
    </aside>
  );
}
