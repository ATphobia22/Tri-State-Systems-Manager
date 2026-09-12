import { requestJson } from './http-client.mjs';
import { normalizeSourceRecord } from './normalization.mjs';
import { recordSourceHealth } from './source-health.mjs';

// WaterServices /nwis/iv is scheduled for decommissioning in Q1 2027.
// TSM therefore uses the modernized USGS Water Data OGC API for runtime reads.
const BASE_URL = 'https://api.waterdata.usgs.gov/ogcapi/v0/collections/latest-continuous';
const MONITORING_LOCATIONS_URL = 'https://api.waterdata.usgs.gov/ogcapi/v0/collections/monitoring-locations';

function normalizeModernFeature(feature, retrievedAt) {
  const properties = feature?.properties || {};
  const stationId = properties.monitoring_location_number || String(properties.monitoring_location_id || '').replace(/^USGS-/, '');
  const parameterCode = properties.parameter_code;
  const unit = properties.unit_of_measure;
  const observedAt = properties.time;
  const rawValue = properties.value;
  if (!stationId || !parameterCode || !unit || !observedAt || rawValue == null) throw new TypeError('USGS latest-continuous feature missing station, parameter, unit, time, or value');
  const numeric = Number(rawValue);
  if (!Number.isFinite(numeric)) throw new TypeError('USGS latest-continuous value is not numeric');
  const approvalStatus = String(properties.approval_status || properties.approvals_status || '').trim();
  const qualifier = String(properties.qualifier || '').trim() || (approvalStatus.toLowerCase().includes('provisional') ? 'P' : null);
  return normalizeSourceRecord({
    sourceId: `USGS-NWIS-${stationId}-${parameterCode}`,
    sourceUri: `${BASE_URL}/items`,
    observedAt,
    retrievedAt,
    status: qualifier === 'P' || approvalStatus.toLowerCase().includes('provisional') ? 'provisional' : 'current',
    dataClass: 'observation',
    unit,
    crs: 'EPSG:4326',
    verticalDatum: parameterCode === '00065' ? 'GAGE_DATUM' : 'not-applicable',
    value: numeric,
    provenance: { provider: 'USGS Water Data API', stationId, parameterCode, approvalStatus: approvalStatus || null, qualifier, lastModified: properties.last_modified || null, monitoringLocationId: properties.monitoring_location_id || null },
  });
}

export function parseUsgsLatestContinuous(payload, retrievedAt) {
  const features = Array.isArray(payload?.features) ? payload.features : [];
  if (!features.length) throw new TypeError('USGS latest-continuous payload missing features');
  return features.map((feature) => normalizeModernFeature(feature, retrievedAt));
}

/** Legacy WaterServices parser retained only for historical fixtures/replay compatibility. */
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
      const qualifier = value.qualifiers?.includes('P') ? 'P' : null;
      records.push(normalizeSourceRecord({ sourceId: `USGS-NWIS-${stationId}-${parameterCode}`, sourceUri: 'https://waterservices.usgs.gov/nwis/iv/', observedAt: value.dateTime, retrievedAt, status: qualifier === 'P' ? 'provisional' : 'current', dataClass: 'observation', unit, crs: 'EPSG:4326', verticalDatum: parameterCode === '00065' ? 'GAGE_DATUM' : 'not-applicable', value: numeric, provenance: { provider: 'USGS NWIS legacy fixture', stationId, parameterCode, qualifiers: value.qualifiers || [], qualifier } }));
    }
  }
  return records;
}

export async function fetchUsgsInstantaneousValues({ stationIds, parameterCodes = ['00065', '00060'], startTime, endTime, signal, request = requestJson }) {
  if (!Array.isArray(stationIds) || stationIds.length === 0) throw new TypeError('at least one USGS stationId is required');
  if (startTime || endTime) {
    const error = new RangeError('USGS latest-continuous does not support arbitrary historical intervals; use the /continuous collection for replay');
    error.code = 'USGS_HISTORICAL_QUERY_REQUIRES_CONTINUOUS_API';
    throw error;
  }
  const url = new URL(`${BASE_URL}/items`);
  url.searchParams.set('f', 'json');
  url.searchParams.set('monitoring_location_id', stationIds.map((id) => `USGS-${id}`).join(','));
  url.searchParams.set('parameter_code', parameterCodes.join(','));
  url.searchParams.set('limit', '100');
  if (process.env.USGS_API_KEY) url.searchParams.set('api_key', process.env.USGS_API_KEY);
  const retrievedAt = new Date().toISOString();
  try {
    const payload = await request(url, { signal, timeoutMs: 10000, maxBytes: 2_000_000 });
    const records = parseUsgsLatestContinuous(payload, retrievedAt).filter((record) => stationIds.includes(record.provenance.stationId) && parameterCodes.includes(record.provenance.parameterCode));
    if (!records.length) throw new TypeError('USGS latest-continuous returned no requested observations');
    for (const stationId of stationIds) recordSourceHealth(`USGS-NWIS-${stationId}`, { ok: records.some((r) => r.provenance.stationId === stationId), recordCount: records.filter((r) => r.provenance.stationId === stationId).length });
    return records;
  } catch (error) {
    for (const stationId of stationIds) recordSourceHealth(`USGS-NWIS-${stationId}`, { ok: false, error: error.message });
    throw error;
  }
}

export async function fetchUsgsStationMetadata({ stationId, signal, request = requestJson }) {
  const url = new URL(`${MONITORING_LOCATIONS_URL}/items`);
  url.searchParams.set('f', 'json');
  url.searchParams.set('id', `USGS-${stationId}`);
  url.searchParams.set('limit', '1');
  const payload = await request(url, { signal, timeoutMs: 10000, maxBytes: 1_000_000 });
  return { sourceId: `USGS-NWIS-STATION-${stationId}`, stationId, sourceUri: url.toString(), retrievedAt: new Date().toISOString(), dataClass: 'evidence', payload, provenance: { provider: 'USGS Water Data API' } };
}
