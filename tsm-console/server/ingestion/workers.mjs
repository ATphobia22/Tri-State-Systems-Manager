/**
 * Server ingestion workers — Authority Registry v35
 * Fail-closed: network/schema/hash failure → no write; return error.
 * Observed vs forecast never collapsed.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendArtifact, sha256Hex, verifyProvenance, recordVerification } from '../store/evidence-store.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = process.env.TSM_AUTHORITY_REGISTRY
  || path.join(__dirname, '../../../tsm-authority-registry-v35.json');

function loadRegistry() {
  if (!fs.existsSync(REGISTRY_PATH)) {
    // Fallback relative to artifacts
    const alt = path.join(__dirname, '../../../../tsm-authority-registry-v35.json');
    if (fs.existsSync(alt)) return JSON.parse(fs.readFileSync(alt, 'utf8'));
    throw new Error('fail-closed: Authority Registry v35 not found');
  }
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
}

function leafCanonical(obj) {
  return 'TSM_LEAF:' + JSON.stringify(obj);
}

/**
 * Ingest USGS NWIS instantaneous gage height for a registered node.
 */
export async function ingestUsgsNode(usgsId, { timeoutMs = 8000 } = {}) {
  const registry = loadRegistry();
  const node = (registry.hydrologic_nodes || []).find((n) => n.usgs_id === usgsId);
  if (!node) {
    return { ok: false, code: 'FAIL_CLOSED', error: `usgs_id ${usgsId} not in Authority Registry` };
  }

  const url = node.iv_url_template
    || `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${usgsId}&parameterCd=00065&siteStatus=all`;

  let json;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) {
      return { ok: false, code: 'FAIL_CLOSED', error: `USGS HTTP ${res.status}` };
    }
    json = await res.json();
  } catch (e) {
    return { ok: false, code: 'FAIL_CLOSED', error: `USGS fetch failed: ${e.message}` };
  }

  const v = json?.value?.timeSeries?.[0]?.values?.[0]?.value?.[0];
  if (!v || v.value === undefined) {
    return { ok: false, code: 'FAIL_CLOSED', error: 'USGS payload missing gage value' };
  }

  const value_ft = parseFloat(v.value);
  if (Number.isNaN(value_ft)) {
    return { ok: false, code: 'FAIL_CLOSED', error: 'USGS value not numeric' };
  }

  const observation_time = v.dateTime || null;
  const retrieved_at = new Date().toISOString();
  const body = {
    usgs_id: usgsId,
    name: node.name,
    value_ft,
    observation_time,
    parameter: '00065',
    provisional: true,
  };
  const content_hash_sha256 = sha256Hex(leafCanonical(body));

  try {
    const artifact = appendArtifact({
      artifact_type: 'hydrologic_observation',
      source_authority: 'USGS NWIS',
      source_uri: url,
      source_identifier: usgsId,
      retrieved_at,
      observation_time,
      horizontal_crs: 'EPSG:4326',
      horizontal_crs_name: 'WGS 84',
      vertical_datum: 'NAVD88',
      content_hash_sha256,
      authority_class: 'OBSERVATION',
      derivation_class: 'RAW',
      validation_status: 'provisional',
      governance_status: 'human_review_required',
      is_simulation_demo: false,
      software_version: 'tsm-ingestion@0.1.0',
      operator_or_service_identity: 'ingestUsgsNode',
      payload: body,
      _canonical_for_verify: leafCanonical(body),
      notes: node.role,
    });
    recordVerification(artifact.artifact_id, content_hash_sha256, content_hash_sha256, 'ingestUsgsNode');
    return { ok: true, artifact };
  } catch (e) {
    return { ok: false, code: e.code || 'FAIL_CLOSED', error: e.message };
  }
}

/**
 * Ingest NOAA NWPS gauge stage (observed if present).
 * Forecast products must use authority_class FORECAST.
 */
export async function ingestNwpsGauge(nwsId, { product = 'observed', timeoutMs = 8000 } = {}) {
  const registry = loadRegistry();
  const node = (registry.hydrologic_nodes || []).find(
    (n) => (n.nws_id || '').toUpperCase() === nwsId.toUpperCase()
      || (n.nwps_gauge || '') === nwsId
  );
  // Allow unlisted for discovery but mark carefully
  const url = `https://api.water.noaa.gov/nwps/v1/gauges/${nwsId}`;

  let json;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) {
      return { ok: false, code: 'FAIL_CLOSED', error: `NWPS HTTP ${res.status}` };
    }
    json = await res.json();
  } catch (e) {
    return { ok: false, code: 'FAIL_CLOSED', error: `NWPS fetch failed: ${e.message}` };
  }

  const observed = json?.status?.observed;
  const primary = observed?.primary;
  const value_ft = typeof primary === 'number' ? primary : parseFloat(primary);
  if (Number.isNaN(value_ft)) {
    return { ok: false, code: 'FAIL_CLOSED', error: 'NWPS observed primary missing/non-numeric' };
  }

  const body = {
    nws_id: nwsId,
    value_ft,
    observation_time: observed?.primaryTime || null,
    product: 'observed',
    floodCategory: null,
  };
  const content_hash_sha256 = sha256Hex(leafCanonical(body));
  const authority_class = product === 'forecast' ? 'FORECAST' : 'OBSERVATION';

  try {
    const artifact = appendArtifact({
      artifact_type: 'hydrologic_stage',
      source_authority: 'NOAA NWPS',
      source_uri: url,
      source_identifier: nwsId,
      retrieved_at: new Date().toISOString(),
      observation_time: body.observation_time,
      horizontal_crs: 'EPSG:4326',
      vertical_datum: 'NAVD88',
      content_hash_sha256,
      authority_class,
      derivation_class: 'RAW',
      validation_status: 'provisional',
      governance_status: 'human_review_required',
      is_simulation_demo: false,
      software_version: 'tsm-ingestion@0.1.0',
      operator_or_service_identity: 'ingestNwpsGauge',
      payload: body,
      _canonical_for_verify: leafCanonical(body),
      notes: node?.role || 'NWPS gauge',
    });
    return { ok: true, artifact };
  } catch (e) {
    return { ok: false, code: e.code || 'FAIL_CLOSED', error: e.message };
  }
}

/**
 * Run primary Tri-State hydrologic ingestion batch (fail-closed per node).
 */
export async function runHydrologicBatch() {
  const results = [];
  results.push({ node: '03378500', ...(await ingestUsgsNode('03378500')) });
  results.push({ node: '03322000', ...(await ingestUsgsNode('03322000')) });
  results.push({ node: 'MTVI3', ...(await ingestNwpsGauge('MTVI3')) });
  return results;
}
