import { requestJson } from './http-client.mjs';
import { recordSourceHealth } from './source-health.mjs';

export const USACE_NLD_SERVICES = 'https://nld.sec.usace.army.mil/data-services/services/';

export function normalizeLeveeFeature(feature, { service, crs, retrievedAt, sourceUri = USACE_NLD_SERVICES }) {
  const properties = feature?.properties;
  const sourceIdentifier = properties?.LEVEE_ID ?? properties?.LeveeID ?? properties?.levee_id;
  if (!sourceIdentifier) throw new TypeError('National Levee Database feature requires source identity');
  if (!crs) throw new TypeError('National Levee Database feature requires CRS');
  if (!retrievedAt) throw new TypeError('National Levee Database feature requires retrieval time');
  return Object.freeze({ sourceId: 'USACE-NLD', sourceIdentifier: String(sourceIdentifier), service, sourceUri, retrievedAt, crs, properties, geometry: feature.geometry ?? null, dataClass: 'evidence', provenance: { provider: 'USACE National Levee Database' } });
}

export async function fetchNationalLeveeFeatures({ service = USACE_NLD_SERVICES, layerId, bbox, signal, request = requestJson }) {
  if (!service.startsWith('https://nld.sec.usace.army.mil/')) throw new TypeError('service must be an official USACE NLD endpoint');
  const url = new URL(service);
  url.searchParams.set('f', 'geojson');
  if (layerId != null) url.searchParams.set('layer', String(layerId));
  if (bbox) url.searchParams.set('bbox', bbox.join(','));
  const retrievedAt = new Date().toISOString();
  const payload = await request(url, { signal, timeoutMs: 15000, maxBytes: 5_000_000 });
  const features = Array.isArray(payload?.features) ? payload.features : [];
  const records = features.map((feature) => normalizeLeveeFeature(feature, { service: url.toString(), crs: payload?.crs?.properties?.name || 'EPSG:4326', retrievedAt, sourceUri: url.toString() }));
  recordSourceHealth('USACE-NLD', { ok: true, recordCount: records.length });
  return records;
}
