import type { EvidenceRef, SystemEvidencePayload } from '../../evidence/src/index.ts';
import { hashEvidencePayload, normalizeSystemManagerPayload, validateSystemEvidence } from '../../evidence/src/index.ts';
import type { TwinEntity, TwinRelationship, StateObservation } from '../../ontology/src/index.ts';

export const ENGINEERING_HORIZONTAL_CRS = 'EPSG:2966' as const;
export const ENGINEERING_VERTICAL_DATUM = 'NAVD88' as const;
export const RUNTIME_RENDER_CRS = 'EPSG:3857' as const;

export interface SurveyData { readonly datum: 'NAVD88'; readonly horizontalCrs: typeof ENGINEERING_HORIZONTAL_CRS; readonly easting: number; readonly northing: number; readonly elevationFt: number; readonly isVerified: boolean; }
export interface SoilStratum { readonly depthStartFt: number; readonly depthEndFt: number; readonly uscsCode: string; readonly cohesionPsf: number; readonly frictionAngleDeg: number; }
export interface GeotechPayload { readonly boringId: string; readonly groundwaterDepthFt: number; readonly porePressureRatioRu: number; readonly stratigraphy: readonly SoilStratum[]; }
export interface HydraulicBoundary { readonly upstreamWseFt: number; readonly downstreamWseFt: number; readonly targetBfeFt: number; readonly evidenceGateCleared: boolean; }

export interface JoinedDigitalTwinEntity {
  readonly twinEntityId: string; readonly parcelId: string; readonly survey: SurveyData;
  readonly geotech: GeotechPayload; readonly hydrology: HydraulicBoundary; readonly timeTimestamp: string;
  readonly sourceEvidenceIds: readonly string[]; readonly sourceDatasetIds: readonly string[]; readonly evidencePayloadHash: string;
}
export interface TwinRuntimeBinding {
  readonly twinEntityId: string; readonly worldPartitionKey: string; readonly usdRootLayer: string;
  readonly usdPrimPath: string; readonly sequencerTimeSeconds: number; readonly sourceEvidenceIds: readonly string[];
  readonly readOnlyEngineeringState: true;
}
export interface RuntimeJoinResult { readonly accepted: boolean; readonly issues: readonly string[]; readonly entity?: JoinedDigitalTwinEntity; readonly binding?: TwinRuntimeBinding; }

function finite(value: number, field: string, issues: string[]): void { if (!Number.isFinite(value)) issues.push(field + ' must be finite'); }
function required(value: string, field: string, issues: string[]): void { if (!value.trim()) issues.push(field + ' is required'); }
function evidenceForModule(evidence: readonly EvidenceRef[], module: EvidenceRef['module']): EvidenceRef | undefined {
  return evidence.find((item) => item.module === module && (item.status === 'VERIFIED' || item.status === 'PRESENT') && item.authority !== 'DISCOVERY_ONLY' && item.authority !== 'SECONDARY' && Boolean(item.documentHash || item.sourceHash));
}

export function validateRuntimeBinding(binding: TwinRuntimeBinding): string[] {
  const issues: string[] = [];
  required(binding.twinEntityId, 'binding.twinEntityId', issues);
  required(binding.worldPartitionKey, 'binding.worldPartitionKey', issues);
  required(binding.usdRootLayer, 'binding.usdRootLayer', issues);
  required(binding.usdPrimPath, 'binding.usdPrimPath', issues);
  if (!Number.isFinite(binding.sequencerTimeSeconds) || binding.sequencerTimeSeconds < 0) issues.push('binding.sequencerTimeSeconds must be non-negative');
  if (binding.readOnlyEngineeringState !== true) issues.push('engineering state binding must be read-only');
  return issues;
}

export function validateAndJoin(parcelId: string, survey: SurveyData, geotech: GeotechPayload, hydrology: HydraulicBoundary, timestamp: string, evidencePayload: Partial<SystemEvidencePayload>): RuntimeJoinResult {
  const issues: string[] = [];
  required(parcelId, 'parcelId', issues);
  if (!Number.isFinite(Date.parse(timestamp))) issues.push('timestamp must be ISO-8601');
  if (survey.datum !== ENGINEERING_VERTICAL_DATUM || survey.horizontalCrs !== ENGINEERING_HORIZONTAL_CRS || survey.isVerified !== true) issues.push('controlled survey must be verified, NAVD88-referenced, and EPSG:2966 horizontal coordinates');
  finite(survey.easting, 'survey.easting', issues); finite(survey.northing, 'survey.northing', issues); finite(survey.elevationFt, 'survey.elevationFt', issues);
  required(geotech.boringId, 'geotech.boringId', issues);
  if (!geotech.stratigraphy.length) issues.push('geotech.stratigraphy must not be empty');
  if (!Number.isFinite(geotech.groundwaterDepthFt) || geotech.groundwaterDepthFt < 0) issues.push('geotech.groundwaterDepthFt is invalid');
  finite(geotech.porePressureRatioRu, 'geotech.porePressureRatioRu', issues);
  geotech.stratigraphy.forEach((layer, index) => {
    if (!(layer.depthStartFt >= 0 && layer.depthEndFt > layer.depthStartFt)) issues.push('invalid geotechnical interval at layer ' + index);
    required(layer.uscsCode, 'USCS code at layer ' + index, issues);
    finite(layer.cohesionPsf, 'cohesion at layer ' + index, issues); finite(layer.frictionAngleDeg, 'friction angle at layer ' + index, issues);
  });
  finite(hydrology.upstreamWseFt, 'hydrology.upstreamWseFt', issues);
  finite(hydrology.downstreamWseFt, 'hydrology.downstreamWseFt', issues);
  finite(hydrology.targetBfeFt, 'hydrology.targetBfeFt', issues);
  // The boolean is treated as an untrusted input hint. Engineering authority is derived from evidence validation and the separate human gate; it is never promoted by this join operation.

  const normalized = normalizeSystemManagerPayload(evidencePayload);
  const validation = validateSystemEvidence(normalized);
  issues.push(...validation.issues.map((issue) => issue.code + ':' + issue.path));
  const evidenceSurveyCrs = normalized.controlledSurvey?.horizontalCrs;
  if (evidenceSurveyCrs !== ENGINEERING_HORIZONTAL_CRS) issues.push('controlled survey evidence horizontal CRS must be EPSG:2966');
  if (!validation.valid) issues.push('engineering evidence validation is not valid');
  const modules: readonly EvidenceRef['module'][] = ['controlled_survey','geotechnical_investigation','groundwater_evidence','qualified_fill','laboratory_results','hydraulic_boundary_conditions','approved_project_geometry'];
  const evidence = normalized.evidence ?? [];
  const missing = modules.filter((module) => !evidenceForModule(evidence, module));
  if (missing.length) issues.push('verified evidence refs missing: ' + missing.join(','));
  if (issues.length) return { accepted: false, issues };

  const sourceEvidenceIds = evidence.filter((item) => modules.includes(item.module) && item.authority !== 'DISCOVERY_ONLY').map((item) => item.evidenceId);
  const sourceDatasetIds = evidence.flatMap((item) => {
    const datasetId = item.metadata?.datasetId;
    return typeof datasetId === 'string' && datasetId.trim() ? [datasetId] : [];
  }).filter((value, index, values) => values.indexOf(value) === index);
  if (sourceDatasetIds.length === 0) return { accepted: false, issues: ['verified evidence must reference at least one datasetId'] };
  const twinEntityId = 'ENTITY-' + parcelId + '-' + hashEvidencePayload({ parcelId, timestamp }).slice(0, 12).toUpperCase();
  const entity: JoinedDigitalTwinEntity = Object.freeze({ twinEntityId, parcelId, survey, geotech, hydrology, timeTimestamp: timestamp, sourceEvidenceIds, sourceDatasetIds, evidencePayloadHash: hashEvidencePayload(normalized) });
  const binding: TwinRuntimeBinding = Object.freeze({
    twinEntityId,
    worldPartitionKey: 'wp:' + Math.floor(survey.easting / 1000) + ':' + Math.floor(survey.northing / 1000),
    usdRootLayer: 'runtime/twin/' + twinEntityId + '.usda',
    usdPrimPath: '/TSM/Twins/' + twinEntityId,
    sequencerTimeSeconds: Date.parse(timestamp) / 1000,
    sourceEvidenceIds,
    readOnlyEngineeringState: true,
  });
  return { accepted: true, issues: [], entity, binding };
}

export function toTwinStateParts(joined: JoinedDigitalTwinEntity): { entity: TwinEntity; observations: readonly StateObservation[]; relationships: readonly TwinRelationship[] } {
  const entity: TwinEntity = {
    entityId: joined.twinEntityId, kind: 'parcel', name: joined.parcelId,
    spatial: { crs: ENGINEERING_HORIZONTAL_CRS, geometryRef: 'parcel:' + joined.parcelId },
    validTime: { validFrom: joined.timeTimestamp },
    attributes: { elevationFt: joined.survey.elevationFt, upstreamWseFt: joined.hydrology.upstreamWseFt, downstreamWseFt: joined.hydrology.downstreamWseFt, targetBfeFt: joined.hydrology.targetBfeFt },
    sourceDatasetIds: joined.sourceDatasetIds,
  };
  const observations: StateObservation[] = [];
  return { entity, observations, relationships: [] };
}

export function toUsdRuntimeManifest(joined: JoinedDigitalTwinEntity): Readonly<Record<string, unknown>> {
  return Object.freeze({
    schemaVersion: 'tsm.usd-runtime-manifest.v1', twinEntityId: joined.twinEntityId,
    horizontalCrs: ENGINEERING_HORIZONTAL_CRS, verticalDatum: ENGINEERING_VERTICAL_DATUM,
    sourceEvidenceIds: joined.sourceEvidenceIds, evidencePayloadHash: joined.evidencePayloadHash,
    primPath: '/TSM/Twins/' + joined.twinEntityId,
    layers: [
      { role: 'authoritative-engineering', path: 'runtime/twin/' + joined.twinEntityId + '.usda', readOnly: true },
      { role: 'presentation', path: 'runtime/twin/' + joined.twinEntityId + '.presentation.usda', readOnly: false },
      { role: 'timeline', path: 'runtime/twin/' + joined.twinEntityId + '.timeline.usda', readOnly: false },
    ],
  });
}
