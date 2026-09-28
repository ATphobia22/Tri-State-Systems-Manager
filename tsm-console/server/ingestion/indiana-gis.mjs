import { requestJson } from './http-client.mjs';
import { recordSourceHealth } from './source-health.mjs';
import { buildFloodInformationResult, FLOOD_FEDERATION_SOFTWARE_VERSION } from './flood-information-federation.mjs';

export const INDIANA_GIS_REST = 'https://gisdata.in.gov/server/rest/';

export function normalizeIndianaFeatureCollection(collection, { sourceId, crs, retrievedAt, sourceUri = INDIANA_GIS_REST, floodProvenance = null }) {
  if (collection?.type !== 'FeatureCollection' || !Array.isArray(collection.features)) throw new TypeError('Indiana GIS GeoJSON FeatureCollection required');
  if (!crs || typeof crs !== 'string') throw new TypeError('native CRS is required; silent conversion is prohibited');
  if (!retrievedAt) throw new TypeError('retrievedAt is required');
  return Object.freeze({ sourceId, sourceUri, retrievedAt, crs, features: collection.features, dataClass: 'regulatory-reference', provenance: { provider: 'Indiana GIS/DNR' }, ...(floodProvenance ? { floodProvenance } : {}) });
}

export async function discoverIndianaService({ serviceUrl, signal, request = requestJson }) {
  if (!/^https:\/\/gisdata\.in\.gov\/server\/rest\//i.test(serviceUrl)) throw new TypeError('serviceUrl must be an Indiana GIS REST endpoint');
  return request(`${serviceUrl}?f=pjson`, { signal, timeoutMs: 15000, maxBytes: 2_000_000 });
}

export async function queryIndianaService({ serviceUrl, layerId, where = '1=1', geometry, outFields = '*', signal, request = requestJson, floodProvenance = null }) {
  if (!Number.isInteger(layerId) || layerId < 0) throw new TypeError('valid Indiana GIS layerId required');
  const base = serviceUrl.endsWith('/') ? serviceUrl.slice(0, -1) : serviceUrl;
  const url = new URL(`${base}/${layerId}/query`);
  url.searchParams.set('f', 'geojson'); url.searchParams.set('where', where); url.searchParams.set('outFields', outFields); url.searchParams.set('returnGeometry', 'true');
  if (geometry) url.searchParams.set('geometry', JSON.stringify(geometry));
  const retrievedAt = new Date().toISOString();
  const metadata = await request(`${base}/${layerId}?f=pjson`, { signal, timeoutMs: 15000, maxBytes: 1_000_000 });
  const wkid = metadata?.extent?.spatialReference?.wkid || metadata?.spatialReference?.wkid;
  if (!wkid) throw new TypeError('Indiana service metadata missing native CRS');
  const payload = await request(url, { signal, timeoutMs: 15000, maxBytes: 5_000_000 });
  const validatedFloodProvenance = floodProvenance
    ? buildFloodInformationResult({
        result_id: floodProvenance.result_id || `INDIANA-GIS-FLOOD-${layerId}`,
        dataset_id: floodProvenance.dataset_id || `INDIANA-GIS-LAYER-${layerId}`,
        source_authority: floodProvenance.source_authority || 'Indiana DNR Division of Water',
        source_uri: url.toString(),
        source_version: floodProvenance.source_version || `Indiana-GIS-layer-${layerId}`,
        retrieved_at: retrievedAt,
        published_at: floodProvenance.published_at ?? null,
        regulatory_status: floodProvenance.regulatory_status || 'IDNR_BEST_AVAILABLE',
        authority_class: floodProvenance.authority_class || 'STATE_BEST_AVAILABLE',
        horizontal_crs: `EPSG:${wkid}`,
        vertical_datum: floodProvenance.vertical_datum || 'NOT_APPLICABLE_FOR_HAZARD_POLYGON',
        model_lineage: floodProvenance.model_lineage || [],
        software_version: FLOOD_FEDERATION_SOFTWARE_VERSION,
        uncertainty: floodProvenance.uncertainty || {
          status: 'qualitative',
          method: 'Indiana DNR source-product limitations',
          notes: 'TSM preserves source limitations and does not promote Best Available data to FEMA insurance authority.',
        },
        insurance_determination_eligible: false,
        human_review_required: true,
        human_review_status: 'pending',
        transformation_chain: floodProvenance.transformation_chain || [],
      })
    : null;
  const result = normalizeIndianaFeatureCollection(payload, { sourceId: `INDIANA-GIS-LAYER-${layerId}`, crs: `EPSG:${wkid}`, retrievedAt, sourceUri: url.toString(), floodProvenance: validatedFloodProvenance });
  recordSourceHealth('INDIANA-GIS', { ok: true, recordCount: result.features.length });
  return result;
}
