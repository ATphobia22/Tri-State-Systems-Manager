import { requestJson } from './http-client.mjs';
import { normalizeSourceRecord } from './normalization.mjs';
import { recordSourceHealth } from './source-health.mjs';

const BASE_URL = 'https://api.water.noaa.gov/nwps/v1/';

/** NOAA NWPS uses -999 / empty units / obs_not_current when observation is absent. */
function isNoaaSentinelValue(value) {
  if (value == null) return true;
  const n = Number(value);
  if (!Number.isFinite(n)) return true;
  if (n === -999 || n === -999.0) return true;
  return false;
}

function isNoaaObservationCurrent(meta) {
  if (!meta || typeof meta !== 'object') return true;
  const category = String(meta.floodCategory || meta.flood_category || '').toLowerCase();
  if (category === 'obs_not_current' || category === 'not_current') return false;
  const validTime = meta.validTime || meta.valid_time;
  if (typeof validTime === 'string' && validTime.startsWith('0001-01-01')) return false;
  return true;
}


export function normalizeNoaaStageFlow({ identifier, product, payload, retrievedAt }) {
  if (!['observed', 'forecast'].includes(product)) throw new TypeError('NOAA product must be observed or forecast');
  const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
  if (!rows.length) throw new TypeError('NOAA payload missing data');
  return rows.map((row) => {
    if (!row?.time || row?.primary == null || !row?.unit) throw new TypeError('NOAA row requires timestamp, primary value, and unit');
    if (isNoaaSentinelValue(row.primary)) {
      const err = new Error(`NOAA NWPS ${identifier} ${product} sentinel/missing primary value`);
      err.code = 'NOAA_OBSERVATION_UNAVAILABLE';
      throw err;
    }
    const value = Number(row.primary);
    if (!Number.isFinite(value)) throw new TypeError('NOAA primary value is not numeric');
    return normalizeSourceRecord({
      sourceId: `NOAA-NWPS-${identifier}-${product}`,
      sourceUri: `${BASE_URL}gauges/${encodeURIComponent(identifier)}`,
      observedAt: row.time,
      retrievedAt,
      status: product === 'observed' ? 'current' : 'current',
      dataClass: product === 'observed' ? 'observation' : 'forecast',
      unit: row.unit,
      crs: 'EPSG:4326',
      verticalDatum: 'GAGE_DATUM',
      value,
      provenance: { provider: 'NOAA NWPS', gaugeId: identifier, product },
    });
  });
}

export async function fetchNoaaGauge({ identifier, signal, request = requestJson }) {
  const url = `${BASE_URL}gauges/${encodeURIComponent(identifier)}`;
  const payload = await request(url, { signal, timeoutMs: 10000, maxBytes: 1_000_000 });
  const observed = payload?.status?.observed;
  if (observed && (isNoaaSentinelValue(observed.primary) || !isNoaaObservationCurrent(observed))) {
    const err = new Error(`NOAA NWPS gauge ${identifier} observed status is not current`);
    err.code = 'NOAA_OBSERVATION_UNAVAILABLE';
    recordSourceHealth(`NOAA-NWPS-${identifier}`, { ok: false, error: err.message });
    throw err;
  }
  return { sourceId: `NOAA-NWPS-GAUGE-${identifier}`, sourceUri: url, retrievedAt: new Date().toISOString(), dataClass: 'evidence', payload, provenance: { provider: 'NOAA NWPS', gaugeId: identifier } };
}

export async function fetchNoaaStageFlow({ identifier, product = 'observed', signal, request = requestJson }) {
  const endpoint = product === 'forecast' ? `gauges/${encodeURIComponent(identifier)}/stageflow` : `gauges/${encodeURIComponent(identifier)}/stageflow`;
  const url = `${BASE_URL}${endpoint}`;
  try {
    const retrievedAt = new Date().toISOString();
    const payload = await request(url, { signal, timeoutMs: 10000, maxBytes: 2_000_000, telemetryDomain: 'hydrology', sourceId: `NOAA-NWPS-${identifier}` });
    const records = normalizeNoaaStageFlow({ identifier, product, payload, retrievedAt });
    recordSourceHealth(`NOAA-NWPS-${identifier}`, { ok: true, recordCount: records.length });
    return records;
  } catch (error) {
    recordSourceHealth(`NOAA-NWPS-${identifier}`, { ok: false, error: error.message });
    throw error;
  }
}
