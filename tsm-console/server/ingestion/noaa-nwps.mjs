import { requestJson } from './http-client.mjs';
import { normalizeSourceRecord } from './normalization.mjs';
import { recordSourceHealth } from './source-health.mjs';

const BASE_URL = 'https://api.water.noaa.gov/nwps/v1/';

export function normalizeNoaaStageFlow({ identifier, product, payload, retrievedAt }) {
  if (!['observed', 'forecast'].includes(product)) throw new TypeError('NOAA product must be observed or forecast');
  const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
  if (!rows.length) throw new TypeError('NOAA payload missing data');
  return rows.map((row) => {
    if (!row?.time || row?.primary == null || !row?.unit) throw new TypeError('NOAA row requires timestamp, primary value, and unit');
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
  return { sourceId: `NOAA-NWPS-GAUGE-${identifier}`, sourceUri: url, retrievedAt: new Date().toISOString(), dataClass: 'evidence', payload, provenance: { provider: 'NOAA NWPS', gaugeId: identifier } };
}

export async function fetchNoaaStageFlow({ identifier, product = 'observed', signal, request = requestJson }) {
  const endpoint = product === 'forecast' ? `gauges/${encodeURIComponent(identifier)}/stageflow` : `gauges/${encodeURIComponent(identifier)}/stageflow`;
  const url = `${BASE_URL}${endpoint}`;
  try {
    const retrievedAt = new Date().toISOString();
    const payload = await request(url, { signal, timeoutMs: 10000, maxBytes: 2_000_000 });
    const records = normalizeNoaaStageFlow({ identifier, product, payload, retrievedAt });
    recordSourceHealth(`NOAA-NWPS-${identifier}`, { ok: true, recordCount: records.length });
    return records;
  } catch (error) {
    recordSourceHealth(`NOAA-NWPS-${identifier}`, { ok: false, error: error.message });
    throw error;
  }
}
