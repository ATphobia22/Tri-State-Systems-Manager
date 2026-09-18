/**
 * Server ingestion workers — authoritative data-fabric boundary.
 * Raw gage height remains in the source product datum. NAVD88 conversion is
 * applied only when the canonical authority registry carries a validated,
 * product-matched station relationship.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendArtifact, sha256Hex, recordVerification } from '../store/evidence-store.mjs';
import { fetchUsgsInstantaneousValues } from './usgs-nwis.mjs';
import { fetchNoaaStageFlow } from './noaa-nwps.mjs';
import { classifySourceFreshness } from '../reliability/source-policies.mjs';
import { incrementTelemetryCounter, observeTelemetryMetric } from '../telemetry/prometheus-exporter.mjs';
import { publishTelemetryEvent } from '../telemetry/event-bus.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = process.env.TSM_AUTHORITY_REGISTRY || path.join(__dirname, '../../../tsm-authority-registry-v35.json');

function loadRegistry() {
  if (fs.existsSync(REGISTRY_PATH)) return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const alt = path.join(__dirname, '../../../../tsm-authority-registry-v35.json');
  if (fs.existsSync(alt)) return JSON.parse(fs.readFileSync(alt, 'utf8'));
  throw new Error('fail-closed: Authority Registry v35 not found');
}

function leafCanonical(obj) { return `TSM_LEAF:${JSON.stringify(obj)}`; }

function navd88FromGage(node, gageHeightFt) {
  const zero = node?.gage_zero_navd88_ft;
  if (zero == null || !Number.isFinite(gageHeightFt) || !Number.isFinite(Number(zero)) || !node.vertical_conversion_source) {
    return { conversion_applied: false, wse_navd88_ft: null, gage_zero_navd88_ft: null, vertical_conversion_source: null };
  }
  return { conversion_applied: true, wse_navd88_ft: gageHeightFt + Number(zero), gage_zero_navd88_ft: Number(zero), vertical_conversion_source: node.vertical_conversion_source };
}

function appendObservation(record, extra = {}) {
  const payload = { ...record, ...extra };
  const canonical = leafCanonical(payload);
  const hash = sha256Hex(canonical);
  const artifact = appendArtifact({
    artifact_type: 'authoritative_source_record', source_authority: record.provenance.provider, source_uri: record.sourceUri,
    source_identifier: record.sourceId, retrieved_at: record.retrievedAt, observation_time: record.observedAt,
    horizontal_crs: record.crs, vertical_datum: record.verticalDatum, vertical_datum_converted: extra.wse_navd88_ft != null ? 'NAVD88' : null,
    content_hash_sha256: hash, authority_class: record.dataClass === 'forecast' ? 'FORECAST' : 'OBSERVATION', derivation_class: 'RAW',
    validation_status: record.status, governance_status: 'human_review_required', is_simulation_demo: false,
    software_version: 'tsm-ingestion@0.6.0', operator_or_service_identity: 'authoritative-data-fabric',
    payload, _canonical_for_verify: canonical, notes: 'Authoritative source observation. Not a regulatory determination.',
  });
  incrementTelemetryCounter('tsm_telemetry_ingest_total', { provider: record.provenance.provider, data_class: record.dataClass });
  return artifact;
}

export async function ingestUsgsNode(usgsId, { timeoutMs = 10000 } = {}) {
  const node = (loadRegistry().hydrologic_nodes || []).find((candidate) => candidate.usgs_id === usgsId);
  if (!node) return { ok: false, code: 'FAIL_CLOSED', error: `usgs_id ${usgsId} not in Authority Registry` };
  try {
    const records = await fetchUsgsInstantaneousValues({ stationIds: [usgsId], parameterCodes: ['00065', '00060'], signal: AbortSignal.timeout(timeoutMs) });
    const stage = records.filter((record) => record.provenance.parameterCode === '00065').at(-1);
    if (!stage) return { ok: false, code: 'FAIL_CLOSED', error: 'USGS returned no 00065 observation' };
    const freshnessState = classifySourceFreshness('USGS_NWIS_OBSERVATION', { observedAt: stage.observedAt, retrievedAt: stage.retrievedAt });
    const conversion = navd88FromGage(node, stage.value);
    const discharge = records.filter((record) => record.provenance.parameterCode === '00060').at(-1) || null;
    observeTelemetryMetric('ptdt_usgs_gauge_stage_feet', stage.value, { site_id: usgsId, datum: 'GAGE_DATUM' });
    if (discharge) observeTelemetryMetric('ptdt_usgs_discharge_cfs', discharge.value, { site_id: usgsId });
    const artifact = appendObservation(stage, { ...conversion, freshness_state: freshnessState, stationName: node.name, role: node.role, relatedInfrastructure: node.related_infrastructure || null, discharge_cfs: discharge?.value ?? null, discharge_observedAt: discharge?.observedAt ?? null, timeoutMs });
    const eventBus = await publishTelemetryEvent({ event_type: 'hydrologic_observation', provider: 'USGS', station_id: usgsId, observed_at: stage.observedAt, stage_ft: stage.value, discharge_cfs: discharge?.value ?? null, vertical_datum: stage.verticalDatum, wse_navd88_ft: conversion.wse_navd88_ft, artifact_id: artifact.artifact_id, content_hash_sha256: artifact.content_hash_sha256 });
    recordVerification(artifact.artifact_id, artifact.content_hash_sha256, artifact.content_hash_sha256, 'authoritative-data-fabric');
    return { ok: true, artifact, sourceRecord: stage, dischargeRecord: discharge, freshness_state: freshnessState, event_bus: eventBus };
  } catch (error) {
    return { ok: false, code: error.code || 'FAIL_CLOSED', error: error.message };
  }
}

export async function ingestNwpsGauge(nwsId, { product = 'observed', timeoutMs = 10000 } = {}) {
  if (!['observed', 'forecast'].includes(product)) return { ok: false, code: 'INVALID_PRODUCT', error: 'product must be observed or forecast' };
  const node = (loadRegistry().hydrologic_nodes || []).find((candidate) => candidate.nws_id === nwsId);
  if (!node) return { ok: false, code: 'FAIL_CLOSED', error: `nws_id ${nwsId} not in Authority Registry` };
  try {
    const records = await fetchNoaaStageFlow({ identifier: nwsId, product, signal: AbortSignal.timeout(timeoutMs) });
    const latest = records.at(-1);
    if (!latest) return { ok: false, code: 'FAIL_CLOSED', error: `NOAA ${product} returned no records` };
    const freshnessState = classifySourceFreshness(product === 'observed' ? 'NOAA_NWPS_OBSERVATION' : 'NOAA_NWPS_FORECAST', { observedAt: latest.observedAt, retrievedAt: latest.retrievedAt });
    const conversion = product === 'observed' ? navd88FromGage(node, latest.value) : { conversion_applied: false, wse_navd88_ft: null, gage_zero_navd88_ft: null, vertical_conversion_source: null };
    const artifact = appendObservation(latest, { ...conversion, freshness_state: freshnessState, stationName: node.name, role: node.role, timeoutMs });
    const eventBus = await publishTelemetryEvent({ event_type: 'hydrologic_observation', provider: 'NOAA_NWPS', station_id: nwsId, product, observed_at: latest.observedAt, stage_ft: latest.value, vertical_datum: latest.verticalDatum, wse_navd88_ft: conversion.wse_navd88_ft, artifact_id: artifact.artifact_id, content_hash_sha256: artifact.content_hash_sha256 });
    return { ok: true, artifact, sourceRecord: latest, freshness_state: freshnessState, event_bus: eventBus };
  } catch (error) {
    return { ok: false, code: error.code || 'FAIL_CLOSED', error: error.message };
  }
}

export async function runHydrologicBatch() {
  const jobs = [
    ['03378500', () => ingestUsgsNode('03378500')],
    ['03322000', () => ingestUsgsNode('03322000')],
    ['03322420', () => ingestUsgsNode('03322420')],
    ['MTVI3', () => ingestNwpsGauge('MTVI3')],
    ['UNWK2', () => ingestNwpsGauge('UNWK2')],
  ];
  return Promise.all(jobs.map(async ([node, job]) => ({ node, ...(await job()) })));
}
