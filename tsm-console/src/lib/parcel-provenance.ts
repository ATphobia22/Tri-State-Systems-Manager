import { Popup, type Map, type MapMouseEvent } from 'maplibre-gl';

export interface ParcelProvenance {
  siteAddress: string;
  apn: string;
  elevationNavd88Ft: number | null;
  evidenceSha256: string | null;
}

export function readParcelProvenance(
  map: Map,
  event: MapMouseEvent,
  layerId = 'tsm-hydraulic-extrusion',
): ParcelProvenance | null {
  const features = map.queryRenderedFeatures(event.point, { layers: [layerId] });
  const feature = features[0];
  if (!feature) return null;

  const props = feature.properties ?? {};
  // Number(undefined) is NaN, but Number(null) and Number('') are zero.
  // A missing ground elevation must never silently become a real 0 ft value.
  const rawElevation = props.ground_elevation_navd88_ft;
  const elevation = typeof rawElevation === 'number' ? rawElevation
    : typeof rawElevation === 'string' && rawElevation.trim() !== '' ? Number(rawElevation)
    : Number.NaN;
  const sourceHash = props.evidence_sha256;
  const evidenceSha256 = typeof sourceHash === 'string' && /^[a-f0-9]{64}$/i.test(sourceHash)
    ? sourceHash.toLowerCase()
    : null;

  return {
    siteAddress: typeof props.site_address === 'string' ? props.site_address : 'Unassigned Tract',
    apn: typeof props.apn === 'string' ? props.apn : 'UNKNOWN_APN',
    elevationNavd88Ft: Number.isFinite(elevation) ? elevation : null,
    evidenceSha256,
  };
}

const provenanceInspectorMaps = new WeakSet<Map>();

export function setupParcelProvenanceInspector(map: Map): void {
  if (provenanceInspectorMaps.has(map)) return;
  provenanceInspectorMaps.add(map);

  map.on('click', 'tsm-hydraulic-extrusion', (event) => {
    const provenance = readParcelProvenance(map, event);
    if (!provenance) return;
    const elevationText = provenance.elevationNavd88Ft === null
      ? 'Ground elevation: unavailable'
      : `Ground elevation: ${provenance.elevationNavd88Ft.toFixed(2)} ft NAVD88 (map attribute; independently unverified)`;
    const evidenceText = provenance.evidenceSha256
      ? 'Evidence SHA-256 present; source and datum still require independent review.'
      : 'Source evidence SHA-256 unavailable.';
    // setText escapes untrusted parcel properties (no injected HTML).
    new Popup({ closeButton: true, maxWidth: '340px' })
      .setLngLat(event.lngLat)
      .setText(`Parcel ${provenance.apn}. ${elevationText}. ${evidenceText} Screening only, not a flood determination or survey.`)
      .addTo(map);
  });
}
