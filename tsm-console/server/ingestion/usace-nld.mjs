import { requestJson } from './http-client.mjs';
import { recordSourceHealth } from './source-health.mjs';

// Verified 2026-10-06: current public USACE National Levee Database API.
// OpenAPI spec (155 paths) inspected at levees.sec.usace.army.mil/developer/.
// Public, read-only, no key required.
export const USACE_NLD2_API = 'https://levees.sec.usace.army.mil/api';

// Superseded legacy binding. Retained for reference only — do not use for new code.
export const USACE_NLD_LEGACY_SERVICES = 'https://nld.sec.usace.army.mil/data-services/services/';

// Per NLD developer docs: horizontal NAD83, vertical NAVD88.
export const NLD2_HORIZONTAL_CRS = 'EPSG:4269';
export const NLD2_VERTICAL_DATUM = 'NAVD88';

function assertNld2Base(base) {
  if (typeof base !== 'string' || !base.startsWith('https://levees.sec.usace.army.mil/')) {
    throw new TypeError('service must be the official USACE NLD2 API (https://levees.sec.usace.army.mil/api)');
  }
}

function normalizeUrl(base, path) {
  const root = base.endsWith('/') ? base.slice(0, -1) : base;
  return root + path;
}

function buildProvenance({ service, retrievedAt, systemId = null }) {
  return {
    provider: 'USACE National Levee Database (NLD2)',
    authority: 'USACE',
    dataClass: 'evidence',
    crs: NLD2_HORIZONTAL_CRS,
    verticalDatum: NLD2_VERTICAL_DATUM,
    service,
    retrievedAt,
    systemId,
  };
}

// Normalize a levee-system record from POST /system/systems.
export function normalizeLeveeSystem(record, { service = USACE_NLD2_API, retrievedAt } = {}) {
  const sourceIdentifier = record?.id ?? record?.systemId;
  if (sourceIdentifier == null) throw new TypeError('NLD2 system record requires an id');
  if (!retrievedAt) throw new TypeError('NLD2 system record requires retrieval time');
  return Object.freeze({
    sourceId: 'USACE-NLD2',
    sourceIdentifier: String(sourceIdentifier),
    name: record?.name ?? null,
    states: record?.states ?? record?.state ?? null,
    leveedAreaSquareMiles: record?.leveedAreaSquareMiles ?? null,
    service,
    retrievedAt,
    crs: NLD2_HORIZONTAL_CRS,
    verticalDatum: NLD2_VERTICAL_DATUM,
    dataClass: 'evidence',
    provenance: buildProvenance({ service, retrievedAt, systemId: String(sourceIdentifier) }),
    attributes: record,
  });
}

// Normalize one leveed-area polygon feature from GET /leveed-areas-{id}.geojson.
export function normalizeLeveedAreaFeature(feature, { service, systemId, retrievedAt } = {}) {
  const properties = feature?.properties;
  const sourceIdentifier = properties?.leveedId ?? properties?.fcSystemId ?? systemId;
  if (sourceIdentifier == null) throw new TypeError('NLD2 leveed-area feature requires source identity');
  if (!retrievedAt) throw new TypeError('NLD2 leveed-area feature requires retrieval time');
  if (feature?.geometry?.type !== 'MultiPolygon' && feature?.geometry?.type !== 'Polygon') {
    throw new TypeError('NLD2 leveed-area feature requires polygon geometry');
  }
  return Object.freeze({
    sourceId: 'USACE-NLD2',
    sourceIdentifier: String(sourceIdentifier),
    service,
    sourceUri: service,
    retrievedAt,
    crs: NLD2_HORIZONTAL_CRS,
    verticalDatum: NLD2_VERTICAL_DATUM,
    dataClass: 'evidence',
    provenance: buildProvenance({ service, retrievedAt, systemId: systemId != null ? String(systemId) : null }),
    properties,
    geometry: feature.geometry,
  });
}

// Backwards-compatible alias retained for the legacy FeatureServer record shape.
export function normalizeLeveeFeature(feature, { service, crs, retrievedAt, sourceUri = USACE_NLD_LEGACY_SERVICES }) {
  const properties = feature?.properties;
  const sourceIdentifier = properties?.LEVEE_ID ?? properties?.LeveeID ?? properties?.levee_id;
  if (!sourceIdentifier) throw new TypeError('National Levee Database feature requires source identity');
  if (!crs) throw new TypeError('National Levee Database feature requires CRS');
  if (!retrievedAt) throw new TypeError('National Levee Database feature requires retrieval time');
  return Object.freeze({ sourceId: 'USACE-NLD', sourceIdentifier: String(sourceIdentifier), service, sourceUri, retrievedAt, crs, properties, geometry: feature.geometry ?? null, dataClass: 'evidence', provenance: { provider: 'USACE National Levee Database', authority: 'USACE' } });
}

async function postJson(request, url, body, { signal, timeoutMs = 15000, maxBytes = 5_000_000 } = {}) {
  return request(url, {
    signal,
    timeoutMs,
    maxBytes,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    sourceId: 'USACE-NLD2',
  });
}

// POST /system/suggestions — typeahead over systems, counties, FEMA communities.
// Verified live 2026-10-06: POST {"text":"Wabash"} returns system suggestions.
export async function suggestLeveeSystems(text, { base = USACE_NLD2_API, signal, request = requestJson } = {}) {
  if (typeof text !== 'string' || text.trim().length === 0) throw new TypeError('suggestLeveeSystems requires non-empty text');
  assertNld2Base(base);
  const url = normalizeUrl(base, '/system/suggestions');
  const retrievedAt = new Date().toISOString();
  const payload = await postJson(request, url, { text: text.trim() }, { signal });
  const suggestions = payload?.suggestions;
  if (!suggestions || typeof suggestions !== 'object') throw new TypeError('NLD2 suggestions response missing suggestions object');
  recordSourceHealth('USACE-NLD2', { ok: true, recordCount: (suggestions.systems || []).length });
  return Object.freeze({ suggestions, service: url, retrievedAt });
}

// POST /system/systems — full records for one or more system ids.
// Verified live 2026-10-06: POST {"ids":["270005000005"]} returns Wabash Levee Unit 1.
export async function fetchLeveeSystems(ids, { base = USACE_NLD2_API, signal, request = requestJson } = {}) {
  const list = Array.isArray(ids) ? ids : [ids];
  if (list.length === 0) throw new TypeError('fetchLeveeSystems requires at least one system id');
  assertNld2Base(base);
  const url = normalizeUrl(base, '/system/systems');
  const retrievedAt = new Date().toISOString();
  const payload = await postJson(request, url, { ids: list.map(String) }, { signal });
  const records = Array.isArray(payload) ? payload : [];
  const normalized = records.map((record) => normalizeLeveeSystem(record, { service: url, retrievedAt }));
  recordSourceHealth('USACE-NLD2', { ok: true, recordCount: normalized.length });
  return normalized;
}

// GET /leveed-areas-{systemId}.geojson — leveed-area polygon(s) for a system.
// Verified live 2026-10-06: returns GeoJSON FeatureCollection (MultiPolygon).
export async function fetchLeveedAreaGeoJSON(systemId, { base = USACE_NLD2_API, signal, request = requestJson } = {}) {
  if (systemId == null || String(systemId).trim().length === 0) throw new TypeError('fetchLeveedAreaGeoJSON requires a system id');
  assertNld2Base(base);
  const id = String(systemId).trim();
  const url = normalizeUrl(base, `/leveed-areas-${encodeURIComponent(id)}.geojson`);
  const retrievedAt = new Date().toISOString();
  const payload = await request(url, { signal, timeoutMs: 15000, maxBytes: 20_000_000, sourceId: 'USACE-NLD2' });
  if (payload?.type !== 'FeatureCollection' || !Array.isArray(payload.features)) {
    throw new TypeError('NLD2 leveed-areas response is not a GeoJSON FeatureCollection');
  }
  const records = payload.features.map((feature) => normalizeLeveedAreaFeature(feature, { service: url, systemId: id, retrievedAt }));
  recordSourceHealth('USACE-NLD2', { ok: true, recordCount: records.length });
  return Object.freeze({ features: records, service: url, retrievedAt, crs: NLD2_HORIZONTAL_CRS, verticalDatum: NLD2_VERTICAL_DATUM });
}

// Deprecated: legacy data-services binding. Kept for backwards compatibility only.
export async function fetchNationalLeveeFeatures({ service = USACE_NLD_LEGACY_SERVICES, layerId, bbox, signal, request = requestJson }) {
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
