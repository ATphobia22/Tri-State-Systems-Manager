/**
 * Server ingestion workers — authoritative data-fabric boundary.
 * Raw gage height remains GAGE_DATUM. NAVD88 conversion is only applied
 * when a product-matched published zero is explicitly configured.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendArtifact, sha256Hex, recordVerification } from '../store/evidence-store.mjs';
import { fetchUsgsInstantaneousValues } from './usgs-nwis.mjs';
import { fetchNoaaStageFlow } from './noaa-nwps.mjs';
import { classifySourceFreshness } from '../reliability/source-policies.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = process.env.TSM_AUTHORITY_REGISTRY || path.join(__dirname, '../../../tsm-authority-registry-v35.json');
const GAGE_ZERO_NAVD88 = Object.freeze({ '03378500': 352.71, '03322000': 328.38, MTVI3: 318.59, UNWK2: 311.31, '03322420': 311.31 });

function loadRegistry() {
  if (fs.existsSync(REGISTRY_PATH)) return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const alt = path.join(__dirname, '../../../../tsm-authority-registry-v35.json');
  if (fs.existsSync(alt)) return JSON.parse(fs.readFileSync(alt, 'utf8'));
  throw new Error('fail-closed: Authority Registry v35 not found');
}
function leafCanonical(obj) { return `TSM_LEAF:${JSON.stringify(obj)}`; }
function navd88FromGage(gageId, gageHeightFt) {
  const zero = GAGE_ZERO_NAVD88[gageId];
  if (zero == null || !Number.isFinite(gageHeightFt)) return { conversion_applied: false, wse_navd88_ft: null, gage_zero_navd88_ft: null };
  return { conversion_applied: true, wse_navd88_ft: gageHeightFt + zero, gage_zero_navd88_ft: zero };
}
function appendObservation(record, extra = {}) {
  const payload = { ...record, ...extra };
  const canonical = leafCanonical(payload);
  const hash = sha256Hex(canonical);
  return appendArtifact({
    artifact_type: 'authoritative_source_record', source_authority: record.provenance.provider, source_uri: record.sourceUri,
    source_identifier: record.sourceId, retrieved_at: record.retrievedAt, observation_time: record.observedAt,
    horizontal_crs: record.crs, vertical_datum: record.verticalDatum, vertical_datum_converted: extra.wse_navd88_ft != null ? 'NAVD88' : null,
    content_hash_sha256: hash, authority_class: record.dataClass === 'forecast' ? 'FORECAST' : 'OBSERVATION', derivation_class: 'RAW',
    validation_status: record.status === 'current' ? 'provisional' : record.status, governance_status: 'human_review_required',
    is_simulation_demo: false, software_version: 'tsm-ingestion@0.4.0', operator_or_service_identity: 'authoritative-data-fabric',
    payload, _canonical_for_verify: canonical, notes: 'Authoritative source observation. Not a regulatory determination.',
  });
}

export async function ingestUsgsNode(usgsId, { timeoutMs = 10000 } = {}) {
  const node = (loadRegistry().hydrologic_nodes || []).find((candidate) => candidate.usgs_id === usgsId);
  if (!node) return { ok: false, code: 'FAIL_CLOSED', error: `usgs_id ${usgsId} not in Authority Registry` };
  try {
    const records = await fetchUsgsInstantaneousValues({ stationIds: [usgsId], parameterCodes: ['00065'], endTime: undefined });
    const latest = records.at(-1);
    if (!latest) return { ok: false, code: 'FAIL_CLOSED', error: 'USGS returned no 00065 observation' };
    const freshnessState = classifySourceFreshness('USGS_NWIS_OBSERVATION', { observedAt: latest.observedAt, retrievedAt: latest.retrievedAt });
    const conversion = navd88FromGage(usgsId, latest.value);
    const artifact = appendObservation(latest, { ...conversion, freshness_state: freshnessState, stationName: node.name, role: node.role, timeoutMs });
    recordVerification(artifact.artifact_id, artifact.content_hash_sha256, artifact.content_hash_sha256, 'authoritative-data-fabric');
    return { ok: true, artifact, sourceRecord: latest, freshness_state: freshnessState };
  } catch (error) { return { ok: false, code: error.code || 'FAIL_CLOSED', error: error.message }; }
}

export async function ingestNwpsGauge(nwsId, { product = 'observed', timeoutMs = 10000 } = {}) {
  if (!['observed', 'forecast'].includes(product)) return { ok: false, code: 'INVALID_PRODUCT', error: 'product must be observed or forecast' };
  try {
    const records = await fetchNoaaStageFlow({ identifier: nwsId, product });
    const latest = records.at(-1);
    if (!latest) return { ok: false, code: 'FAIL_CLOSED', error: `NOAA ${product} returned no records` };
    const freshnessState = classifySourceFreshness(product === 'observed' ? 'NOAA_NWPS_OBSERVATION' : 'NOAA_NWPS_FORECAST', { observedAt: latest.observedAt, retrievedAt: latest.retrievedAt });
    const conversion = product === 'observed' ? navd88FromGage(nwsId, latest.value) : { conversion_applied: false, wse_navd88_ft: null, gage_zero_navd88_ft: null };
    const artifact = appendObservation(latest, { ...conversion, freshness_state: freshnessState, timeoutMs });
    return { ok: true, artifact, sourceRecord: latest, freshness_state: freshnessState };
  } catch (error) { return { ok: false, code: error.code || 'FAIL_CLOSED', error: error.message }; }
}

export async function runHydrologicBatch() {
  return [
    { node: '03378500', ...(await ingestUsgsNode('03378500')) },
    { node: '03322000', ...(await ingestUsgsNode('03322000')) },
    { node: 'MTVI3', ...(await ingestNwpsGauge('MTVI3')) },
    { node: 'UNWK2', ...(await ingestNwpsGauge('UNWK2')) },
  ];
}
