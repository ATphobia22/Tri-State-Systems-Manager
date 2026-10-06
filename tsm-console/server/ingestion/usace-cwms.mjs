import { requestJson } from './http-client.mjs';
import { recordSourceHealth } from './source-health.mjs';

// USACE CWMS Data API — verified live 2026-10-06.
// https://cwms-data.usace.army.mil/cwms-data/
// Public, read-only, no key required. Water-data plane only: it is an
// observation source, NOT a replacement for USGS observations or
// hydraulic-model results.
//
// Project policy: live fetch ONLY via explicit caller (button-initiated).
// This module performs no auto-polling, no timers, no background refresh.
export const USACE_CWMS_API = 'https://cwms-data.usace.army.mil/cwms-data/';

function assertCwmsBase(base) {
  if (typeof base !== 'string' || !base.startsWith('https://cwms-data.usace.army.mil/')) {
    throw new TypeError('service must be the official USACE CWMS Data API (https://cwms-data.usace.army.mil/cwms-data/)');
  }
}

function buildUrl(base, path, params) {
  assertCwmsBase(base);
  const root = base.endsWith('/') ? base.slice(0, -1) : base;
  const url = new URL(root + path);
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function normalizeValue(record, { retrievedAt, service }) {
  const value = record?.value;
  if (value === undefined || value === null) throw new TypeError('CWMS time-series value record missing value');
  return Object.freeze({
    sourceId: 'USACE-CWMS',
    sourceIdentifier: record?.['cwms-ts-id'] ?? record?.name ?? 'unknown',
    value,
    unit: record?.['unit-id'] ?? record?.unit ?? null,
    dateTime: record?.['date-time'] != null ? new Date(Number(record['date-time'])).toISOString() : null,
    qualityCode: record?.['quality-code'] ?? null,
    office: record?.['office-id'] ?? null,
    service,
    retrievedAt,
    dataClass: 'observed',
    provenance: {
      provider: 'USACE CWMS',
      authority: 'USACE',
      dataClass: 'observed',
      note: 'Observed water data; not a hydraulic-model result and not a USGS record.',
    },
  });
}

// GET /catalog/TIMESERIES — search the time-series catalog by office + name pattern.
// Note: `like` requires wildcards (e.g. "*Mt*Carmel*Stage*"), verified 2026-10-06.
export async function fetchCatalogTimeseries(office, like, { base = USACE_CWMS_API, signal, request = requestJson } = {}) {
  if (!office) throw new TypeError('fetchCatalogTimeseries requires an office (e.g. LRL)');
  const url = buildUrl(base, '/catalog/TIMESERIES', { office, like });
  const payload = await request(url, { signal, timeoutMs: 15000, maxBytes: 5_000_000, sourceId: 'USACE-CWMS' });
  const entries = Array.isArray(payload?.entries) ? payload.entries : [];
  recordSourceHealth('USACE-CWMS', { ok: true, recordCount: entries.length });
  return Object.freeze({ entries, service: url, retrievedAt: new Date().toISOString() });
}

// GET /timeseries — values for a named series in a time window.
export async function fetchTimeseries(name, office, begin, end, unit, { base = USACE_CWMS_API, signal, request = requestJson } = {}) {
  if (!name) throw new TypeError('fetchTimeseries requires a time-series name');
  if (!office) throw new TypeError('fetchTimeseries requires an office');
  if (!begin || !end) throw new TypeError('fetchTimeseries requires begin and end');
  const url = buildUrl(base, '/timeseries', { name, office, begin, end, unit });
  const retrievedAt = new Date().toISOString();
  const payload = await request(url, { signal, timeoutMs: 30000, maxBytes: 10_000_000, sourceId: 'USACE-CWMS' });
  const values = Array.isArray(payload?.values) ? payload.values : [];
  const records = values.map((record) => normalizeValue(record, { retrievedAt, service: url }));
  recordSourceHealth('USACE-CWMS', { ok: true, recordCount: records.length });
  return Object.freeze({ values: records, service: url, retrievedAt });
}

// GET /timeseries/recent — latest value(s) for one or more series.
// Dashboard-friendly single call; still explicit-only, never polled.
export async function fetchRecentTimeseries(tsIds, office, { base = USACE_CWMS_API, signal, request = requestJson } = {}) {
  const ids = Array.isArray(tsIds) ? tsIds : [tsIds];
  if (ids.length === 0) throw new TypeError('fetchRecentTimeseries requires at least one time-series id');
  if (!office) throw new TypeError('fetchRecentTimeseries requires an office');
  const url = buildUrl(base, '/timeseries/recent', { office, 'ts-ids': ids.join(','), 'unit-system': 'EN' });
  const retrievedAt = new Date().toISOString();
  const payload = await request(url, { signal, timeoutMs: 15000, maxBytes: 5_000_000, sourceId: 'USACE-CWMS' });
  const records = Array.isArray(payload) ? payload : [];
  const normalized = records.map((record) => normalizeValue(record?.dqu ?? record, { retrievedAt, service: url }));
  recordSourceHealth('USACE-CWMS', { ok: true, recordCount: normalized.length });
  return Object.freeze({ values: normalized, service: url, retrievedAt });
}
