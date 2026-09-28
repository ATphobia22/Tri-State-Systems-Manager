import { requestJson } from './http-client.mjs';
import { recordSourceHealth } from './source-health.mjs';
import { buildFloodInformationResult, FLOOD_FEDERATION_SOFTWARE_VERSION } from './flood-information-federation.mjs';

export const FEMA_NFHL_MAPSERVER = 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer';

export function discoverFemaLayers(metadata) {
  if (!Array.isArray(metadata?.layers)) throw new TypeError('FEMA MapServer metadata requires layers');
  return metadata.layers.map((layer) => ({ id: layer.id, name: layer.name, parentLayerId: layer.parentLayerId ?? null }));
}

export function normalizeGeoJsonFeatureCollection(collection, { sourceId, crs, retrievedAt, sourceUri = FEMA_NFHL_MAPSERVER, verticalDatum = 'NOT_APPLICABLE_FOR_HAZARD_POLYGON', sourceVersion = 'NFHL-runtime-layer' }) {
  if (collection?.type !== 'FeatureCollection' || !Array.isArray(collection.features)) throw new TypeError('GeoJSON FeatureCollection required');
  if (!crs || typeof crs !== 'string') throw new TypeError('native CRS is required; silent conversion is prohibited');
  if (!retrievedAt) throw new TypeError('retrievedAt is required');
  const floodProvenance = buildFloodInformationResult({
    result_id: sourceId,
    dataset_id: sourceId,
    source_authority: 'FEMA',
    source_uri: sourceUri,
    source_version: sourceVersion,
    retrieved_at: retrievedAt,
    regulatory_status: 'FEMA_EFFECTIVE',
    authority_class: 'FEDERAL_REGULATORY_REFERENCE',
    horizontal_crs: crs,
    vertical_datum: verticalDatum,
    model_lineage: [],
    software_version: FLOOD_FEDERATION_SOFTWARE_VERSION,
    uncertainty: {
      status: 'qualitative',
      method: 'FEMA source-product limitations',
      notes: 'TSM preserves FEMA source authority and does not infer additional regulatory certainty.'
    },
    insurance_determination_eligible: true,
    human_review_required: true,
    human_review_status: 'pending',
    transformation_chain: [],
  });
  return Object.freeze({
    sourceId,
    sourceUri,
    retrievedAt,
    crs,
    features: collection.features,
    dataClass: 'regulatory-reference',
    provenance: { provider: sourceId === 'FEMA-NFHL' ? 'FEMA NFHL' : sourceId },
    floodProvenance,
  });
}

export async function queryFemaNfhl({ layerId, where = '1=1', geometry, outFields = '*', signal, request = requestJson }) {
  if (!Number.isInteger(layerId) || layerId < 0) throw new TypeError('valid FEMA layerId required');
  const url = new URL(`${FEMA_NFHL_MAPSERVER}/${layerId}/query`);
  url.searchParams.set('f', 'geojson'); url.searchParams.set('where', where); url.searchParams.set('outFields', outFields); url.searchParams.set('returnGeometry', 'true');
  if (geometry) url.searchParams.set('geometry', JSON.stringify(geometry));
  const retrievedAt = new Date().toISOString();
  const payload = await request(url, { signal, timeoutMs: 15000, maxBytes: 5_000_000 });
  const result = normalizeGeoJsonFeatureCollection(payload, { sourceId: `FEMA-NFHL-LAYER-${layerId}`, crs: 'EPSG:4269', retrievedAt, sourceUri: url.toString(), sourceVersion: `NFHL-layer-${layerId}` });
  recordSourceHealth('FEMA-NFHL', { ok: true, recordCount: result.features.length });
  return result;
}

export async function discoverFemaNfhl({ signal, request = requestJson } = {}) {
  const metadata = await request(`${FEMA_NFHL_MAPSERVER}?f=json`, { signal, timeoutMs: 15000, maxBytes: 2_000_000 });
  return discoverFemaLayers(metadata);
}
