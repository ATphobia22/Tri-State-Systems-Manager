import type { Map, MapMouseEvent } from 'maplibre-gl';

export interface ParcelProvenance {
  siteAddress: string;
  apn: string;
  elevationNavd88Ft: number | null;
  evidenceSha256: string;
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
  const elevation = Number(props.ground_elevation_navd88_ft);

  return {
    siteAddress: typeof props.site_address === 'string' ? props.site_address : 'Unassigned Tract',
    apn: typeof props.apn === 'string' ? props.apn : 'UNKNOWN_APN',
    elevationNavd88Ft: Number.isFinite(elevation) ? elevation : null,
    evidenceSha256: typeof props.evidence_sha256 === 'string'
      ? props.evidence_sha256
      : 'UNKNOWN_PROVENANCE',
  };
}

const provenanceInspectorMaps = new WeakSet<Map>();

export function setupParcelProvenanceInspector(map: Map): void {
  if (provenanceInspectorMaps.has(map)) return;
  provenanceInspectorMaps.add(map);

  map.on('click', 'tsm-hydraulic-extrusion', (event) => {
    const provenance = readParcelProvenance(map, event);
    if (!provenance) return;

    console.info('[TSM Provenance Inspection]', provenance);
  });
}
