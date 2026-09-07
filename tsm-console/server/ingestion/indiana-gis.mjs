import { requestJson } from './http-client.mjs';
import { recordSourceHealth } from './source-health.mjs';

export const INDIANA_GIS_REST = 'https://gisdata.in.gov/server/rest/';

export function normalizeIndianaFeatureCollection(collection, { sourceId, crs, retrievedAt, sourceUri = INDIANA_GIS_REST }) {
  if (collection?.type !== 'FeatureCollection' || !Array.isArray(collection.features)) throw new TypeError('Indiana GIS GeoJSON FeatureCollection required');
  if (!crs || typeof crs !== 'string') throw new TypeError('native CRS is required; silent conversion is prohibited');
  if (!retrievedAt) throw new TypeError('retrievedAt is required');
  return Object.freeze({ sourceId, sourceUri, retrievedAt, crs, features: collection.features, dataClass: 'regulatory-reference', provenance: { provider: 'Indiana GIS/DNR' } });
}

export async function discoverIndianaService({ serviceUrl, signal, request = requestJson }) {
  if (!/^https:\/\/gisdata\.in\.gov\/server\/rest\//i.test(serviceUrl)) throw new TypeError('serviceUrl must be an Indiana GIS REST endpoint');
  return request(`${serviceUrl}?f=pjson`, { signal, timeoutMs: 15000, maxBytes: 2_000_000 });
}

export async function queryIndianaService({ serviceUrl, layerId, where = '1=1', geometry, outFields = '*', signal, request = requestJson }) {
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
  const result = normalizeIndianaFeatureCollection(payload, { sourceId: `INDIANA-GIS-LAYER-${layerId}`, crs: `EPSG:${wkid}`, retrievedAt, sourceUri: url.toString() });
  recordSourceHealth('INDIANA-GIS', { ok: true, recordCount: result.features.length });
  return result;
}
