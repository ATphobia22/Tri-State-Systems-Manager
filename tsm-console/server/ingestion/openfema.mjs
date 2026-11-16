import { createHash } from 'node:crypto';
import { requestJson } from './http-client.mjs';

export const OPENFEMA_BASE_URL = 'https://www.fema.gov/api/open';

const ENTITY_VERSIONS = Object.freeze({
  DataSets: 1,
  OpenFemaDataSets: 1,
  FemaRegions: 2,
  NfipCommunityStatusBook: 1,
  NfipCommunityLayerComprehensive: 1,
  NfipCommunityLayerNoOverlapsSplit: 1,
  NfipCommunityLayerNoOverlapsWhole: 1,
  // Current versions from the pinned FEMA OpenFEMA catalog; the Fima* v2
  // endpoints remain below for reading existing historical snapshots only.
  DisasterDeclarationsSummaries: 2,
  HmaSubapplications: 2,
  HazardMitigationGrantProgramDisasterSummaries: 3,
  HazardMitigationPlanStatuses: 1,
  NfipPolicies: 3,
  NfipClaims: 3,
  FimaNfipPolicies: 2,
  FimaNfipClaims: 2,
  FimaNfipMultipleLossProperties: 1,
  FimaNfipResidentialPenetrationRates: 1,
});

const DEPRECATED_ENTITIES = new Set(['FimaNfipPolicies', 'FimaNfipClaims']);

function assertEntity(entity) {
  if (!Object.hasOwn(ENTITY_VERSIONS, entity)) throw new TypeError('OpenFEMA entity is not allowlisted: ' + entity);
  return ENTITY_VERSIONS[entity];
}

export function buildOpenFemaUrl(entity, params = {}, id = null) {
  const version = assertEntity(entity);
  const path = id == null
    ? OPENFEMA_BASE_URL + '/v' + version + '/' + entity
    : OPENFEMA_BASE_URL + '/v' + version + '/' + entity + '/' + encodeURIComponent(id);
  const url = new URL(path);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (!key.startsWith('$')) throw new TypeError('OpenFEMA query parameter must start with $: ' + key);
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export function normalizeOpenFemaResponse(payload, entity) {
  assertEntity(entity);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new TypeError('OpenFEMA response must be an object');
  const metadata = payload.metadata ?? payload.responseMetadata ?? null;
  const records = payload[entity];
  if (!Array.isArray(records)) throw new TypeError('OpenFEMA ' + entity + ' response collection missing or invalid');
  if (records.some((record) => !record || typeof record !== 'object' || Array.isArray(record))) {
    throw new TypeError('OpenFEMA ' + entity + ' response contains an invalid record');
  }
  return Object.freeze({ entity, metadata, records });
}

export async function queryOpenFema(entity, options = {}) {
  const {
    filter, select, orderby, top = 1000, skip = 0, format = 'json',
    count = false, metadata = true, signal, request = requestJson,
  } = options;
  assertEntity(entity);
  if (!Number.isInteger(top) || top < 1 || top > 10000) throw new RangeError('$top must be 1..10000');
  if (!Number.isInteger(skip) || skip < 0) throw new RangeError('$skip must be >= 0');
  if (format !== 'json') throw new TypeError('TSM runtime OpenFEMA adapter currently requires $format=json; bulk non-JSON formats must use a dedicated download worker');
  const url = buildOpenFemaUrl(entity, {
    '$filter': filter, '$select': select, '$orderby': orderby, '$top': top, '$skip': skip,
    '$format': format, '$count': count ? 'true' : 'false', '$metadata': metadata ? 'true' : 'false',
  });
  const payload = await request(url, {
    signal, sourceId: 'FEMA-OpenFEMA-' + entity, timeoutMs: 20000, maxBytes: 8000000,
  });
  return Object.freeze({
    ...normalizeOpenFemaResponse(payload, entity),
    deprecatedDataset: DEPRECATED_ENTITIES.has(entity),
    sourceUri: url,
    retrievedAt: new Date().toISOString(),
  });
}

export async function pageOpenFema(entity, options = {}) {
  const pageSize = options.pageSize ?? 1000;
  const maxPages = options.maxPages ?? 100;
  const maxRecords = options.maxRecords ?? 100000;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 10000) throw new RangeError('pageSize must be 1..10000');
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 100) throw new RangeError('maxPages must be 1..100');
  if (!Number.isInteger(maxRecords) || maxRecords < 1 || maxRecords > 100000) throw new RangeError('maxRecords must be 1..100000');
  const records = [];
  const sourceUris = [];
  let skip = options.skip ?? 0;
  if (!Number.isInteger(skip) || skip < 0) throw new RangeError('$skip must be a nonnegative integer');
  let metadata = null;
  let complete = false;
  let reason = 'MAX_PAGES_REACHED';
  for (let page = 0; page < maxPages; page += 1) {
    const remaining = maxRecords - records.length;
    if (remaining <= 0) {
      reason = 'MAX_RECORDS_REACHED';
      break;
    }
    const top = Math.min(pageSize, remaining);
    const result = await queryOpenFema(entity, { ...options, top, skip });
    metadata = result.metadata;
    sourceUris.push(result.sourceUri);
    if (result.records.length > top) throw new TypeError('OpenFEMA response exceeded requested $top');
    records.push(...result.records);
    if (result.records.length < top) {
      complete = true;
      reason = null;
      break;
    }
    skip += result.records.length;
    if (records.length >= maxRecords) {
      reason = 'MAX_RECORDS_REACHED';
      break;
    }
  }
  // Never infer completeness from FEMA metadata.count, which may be absent or
  // inconsistent. A full last page requires a further empty/short page.
  return Object.freeze({
    entity,
    records: Object.freeze(records),
    metadata,
    sourceUri: sourceUris.at(-1) ?? null,
    sourceUris: Object.freeze(sourceUris),
    retrievedAt: new Date().toISOString(),
    pageCount: sourceUris.length,
    deprecatedDataset: DEPRECATED_ENTITIES.has(entity),
    complete,
    status: complete ? 'COMPLETE' : 'PARTIAL',
    reason,
    authority: 'FEMA OpenFEMA administrative data; not effective NFHL flood geometry',
  });
}

export async function getOpenFemaRecord(entity, id, options = {}) {
  const { signal, request = requestJson, '$format': format = 'json', '$metadata': metadata = true } = options;
  if (format !== 'json') throw new TypeError('TSM runtime OpenFEMA record adapter requires $format=json');
  const url = buildOpenFemaUrl(entity, { '$format': format, '$metadata': metadata }, id);
  const payload = await request(url, {
    signal, sourceId: 'FEMA-OpenFEMA-' + entity, timeoutMs: 20000, maxBytes: 2000000,
  });
  return Object.freeze({ entity, id: String(id), payload, sourceUri: url, retrievedAt: new Date().toISOString() });
}

export function sha256Json(value) {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

export const OPENFEMA_ENTITY_VERSIONS = ENTITY_VERSIONS;
