import { requestJson } from './http-client.mjs';
import { normalizeSourceRecord } from './normalization.mjs';
import { recordSourceHealth } from './source-health.mjs';

const BASE_URL = 'https://waterservices.usgs.gov/nwis/iv/';

export function parseUsgsInstantaneousValues(payload, retrievedAt) {
  const series = payload?.value?.timeSeries;
  if (!Array.isArray(series)) throw new TypeError('USGS payload missing timeSeries');
  const records = [];
  for (const item of series) {
    const stationId = item?.sourceInfo?.siteCode?.[0]?.value;
    const parameterCode = item?.variable?.variableCode?.[0]?.value;
    const unit = item?.variable?.unit?.unitCode;
    const values = item?.values?.[0]?.value;
    if (!stationId || !parameterCode || !unit) throw new TypeError('USGS series missing station, parameter, or unit');
    if (!Array.isArray(values)) continue;
    for (const value of values) {
      if (value?.value == null || !value?.dateTime) throw new TypeError('USGS value missing numeric value or timestamp');
      const numeric = Number(value.value);
      if (!Number.isFinite(numeric)) throw new TypeError('USGS value is not numeric');
      records.push(normalizeSourceRecord({
        sourceId: `USGS-NWIS-${stationId}-${parameterCode}`,
        sourceUri: BASE_URL,
        observedAt: value.dateTime,
        retrievedAt,
        status: value.qualifiers?.includes('P') ? 'provisional' : 'current',
        dataClass: 'observation',
        unit,
        crs: 'EPSG:4326',
        verticalDatum: parameterCode === '00065' ? 'GAGE_DATUM' : 'not-applicable',
        value: numeric,
        provenance: { provider: 'USGS NWIS', stationId, parameterCode, qualifiers: value.qualifiers || [] },
      }));
    }
  }
  return records;
}

export async function fetchUsgsInstantaneousValues({ stationIds, parameterCodes = ['00065', '00060'], startTime, endTime, signal, request = requestJson }) {
  const url = new URL(BASE_URL);
  url.searchParams.set('format', 'json');
  url.searchParams.set('sites', stationIds.join(','));
  url.searchParams.set('parameterCd', parameterCodes.join(','));
  url.searchParams.set('siteStatus', 'all');
  if (startTime) url.searchParams.set('startDT', startTime);
  if (endTime) url.searchParams.set('endDT', endTime);
  const retrievedAt = new Date().toISOString();
  try {
    const payload = await request(url, { signal, timeoutMs: 10000, maxBytes: 2_000_000 });
    const records = parseUsgsInstantaneousValues(payload, retrievedAt);
    for (const stationId of stationIds) recordSourceHealth(`USGS-NWIS-${stationId}`, { ok: true, recordCount: records.filter((r) => r.provenance.stationId === stationId).length });
    return records;
  } catch (error) {
    for (const stationId of stationIds) recordSourceHealth(`USGS-NWIS-${stationId}`, { ok: false, error: error.message });
    throw error;
  }
}

export async function fetchUsgsStationMetadata({ stationId, signal, request = requestJson }) {
  const url = new URL('https://waterservices.usgs.gov/nwis/site/');
  url.searchParams.set('format', 'rdb');
  url.searchParams.set('sites', stationId);
  url.searchParams.set('siteOutput', 'expanded');
  const payload = await request(url, { signal, timeoutMs: 10000, maxBytes: 500_000 });
  return { sourceId: `USGS-NWIS-STATION-${stationId}`, stationId, sourceUri: url.toString(), retrievedAt: new Date().toISOString(), dataClass: 'evidence', payload, provenance: { provider: 'USGS NWIS' } };
}
