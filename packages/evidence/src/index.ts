import { createHash } from 'node:crypto';

export type EvidenceAuthority =
  | 'CONTROLLED_FIELD'
  | 'OFFICIAL_GOVERNMENT'
  | 'AUTHORITATIVE_SCIENTIFIC'
  | 'PROJECT_ENGINEERING'
  | 'SECONDARY'
  | 'DISCOVERY_ONLY';

export type EvidenceStatus =
  | 'MISSING'
  | 'PRESENT'
  | 'VERIFIED'
  | 'CONTRADICTED'
  | 'REJECTED'
  | 'SYNTHETIC_TEST_ONLY';

export type EvidenceModule =
  | 'controlled_survey'
  | 'geotechnical_investigation'
  | 'groundwater_evidence'
  | 'qualified_fill'
  | 'laboratory_results'
  | 'hydraulic_boundary_conditions'
  | 'approved_project_geometry';

export interface EvidenceRef {
  readonly evidenceId: string;
  readonly module: EvidenceModule;
  readonly authority: EvidenceAuthority;
  readonly status: EvidenceStatus;
  readonly sourceUri?: string;
  readonly sourceHash?: string;
  readonly retrievedAt?: string;
  readonly documentHash?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ControlledSurveyEvidence {
  readonly datum: string;
  readonly verticalDatum?: string;
  readonly horizontalCrs: string;
  readonly easting: number;
  readonly northing: number;
  readonly elevationFt: number;
  readonly accuracyClass: string;
  readonly controlReference: string;
  readonly surveyDate: string;
}

export interface GeotechnicalInvestigationEvidence {
  readonly boringId: string;
  readonly totalDepthFt: number;
  readonly stratigraphy: readonly {
    readonly depthStartFt: number;
    readonly depthEndFt: number;
    readonly uscsClassification: string;
    readonly description: string;
  }[];
}

export interface GroundwaterEvidence {
  readonly measuredWaterTableDepthFt: number;
  readonly historicalMaxElevationFt?: number;
  readonly porePressureRatioRu?: number;
  readonly isArtesian: boolean;
  readonly observationDate: string;
  readonly referenceDatum?: string;
}

export interface QualifiedFillEvidence {
  readonly materialSource: string;
  readonly materialClassification: string;
  readonly maxAggregateSizeIn: number;
  readonly plasticityIndexMax: number;
  readonly liquidLimitMax: number;
  readonly minCompactionProctorPct: number;
  readonly compactionTestMethod: string;
  readonly qualificationReportId: string;
}

export interface LaboratoryResultsEvidence {
  readonly sampleId: string;
  readonly moistureContentPct: number;
  readonly cohesionPsf: number;
  readonly frictionAngleDeg: number;
  readonly unitWeightPcf: number;
  readonly testMethod: string;
  readonly drainageCondition: string;
  readonly reportId: string;
}

export interface HydraulicBoundaryConditionsEvidence {
  readonly upstreamHeadFt: number;
  readonly downstreamHeadFt: number;
  readonly permeabilityKcmSec: number;
  readonly boundaryType: 'Constant' | 'Transient' | 'Impermeable';
  readonly referenceDatum: string;
}

export interface ApprovedProjectGeometryEvidence {
  readonly crossSectionId: string;
  readonly slopeRatioHorizontal: number;
  readonly slopeRatioVertical: number;
  readonly benchWidthFt: number;
  readonly foundationEmbedmentDepthFt: number;
  readonly approvalReference: string;
}

export interface SystemEvidencePayload {
  readonly controlledSurvey: ControlledSurveyEvidence;
  readonly geotechnicalInvestigation: readonly GeotechnicalInvestigationEvidence[];
  readonly groundwaterEvidence: GroundwaterEvidence;
  readonly qualifiedFill: QualifiedFillEvidence;
  readonly laboratoryResults: LaboratoryResultsEvidence[];
  readonly hydraulicBoundaryConditions: HydraulicBoundaryConditionsEvidence;
  readonly approvedProjectGeometry: ApprovedProjectGeometryEvidence;
  readonly evidence: readonly EvidenceRef[];
}

export interface ValidationIssue {
  readonly code:
    | 'INPUT_INCOMPLETE'
    | 'INVALID_VALUE'
    | 'EVIDENCE_REQUIRED'
    | 'PROVENANCE_REQUIRED'
    | 'SYNTHETIC_DATA_REJECTED'
    | 'CONTRADICTORY_DATA';
  readonly module: EvidenceModule | 'root';
  readonly path: string;
  readonly message: string;
  readonly severity: 'error' | 'warning';
}

export interface EvidenceValidationResult {
  readonly valid: boolean;
  readonly issues: readonly ValidationIssue[];
  readonly verifiedModules: readonly EvidenceModule[];
  readonly synthetic: boolean;
  readonly payloadHash: string;
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const nonNegative = (v: unknown): v is number => finite(v) && v >= 0;
const positive = (v: unknown): v is number => finite(v) && v > 0;
const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

export function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
}

export function hashEvidencePayload(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

export function validateSystemEvidence(payload: Partial<SystemEvidencePayload>): EvidenceValidationResult {
  const issues: ValidationIssue[] = [];
  const modules: EvidenceModule[] = [
    'controlled_survey',
    'geotechnical_investigation',
    'groundwater_evidence',
    'qualified_fill',
    'laboratory_results',
    'hydraulic_boundary_conditions',
    'approved_project_geometry',
  ];
  const present = new Set<EvidenceModule>();

  if (!payload.controlledSurvey) issues.push({ code: 'INPUT_INCOMPLETE', module: 'controlled_survey', path: 'controlledSurvey', message: 'Controlled survey evidence is required.', severity: 'error' });
  else {
    present.add('controlled_survey');
    const s = payload.controlledSurvey;
    if (!nonEmpty(s.datum) || !nonEmpty(s.horizontalCrs) || !nonEmpty(s.controlReference) || !nonEmpty(s.surveyDate)) issues.push({ code: 'PROVENANCE_REQUIRED', module: 'controlled_survey', path: 'controlledSurvey', message: 'Datum, CRS, control reference, and survey date are required.', severity: 'error' });
    if (!finite(s.easting) || !finite(s.northing) || !finite(s.elevationFt)) issues.push({ code: 'INVALID_VALUE', module: 'controlled_survey', path: 'controlledSurvey', message: 'Survey coordinates and elevation must be finite numbers.', severity: 'error' });
  }

  if (!payload.geotechnicalInvestigation?.length) issues.push({ code: 'INPUT_INCOMPLETE', module: 'geotechnical_investigation', path: 'geotechnicalInvestigation', message: 'At least one real geotechnical investigation record is required.', severity: 'error' });
  else {
    present.add('geotechnical_investigation');
    payload.geotechnicalInvestigation.forEach((b, i) => {
      if (!nonEmpty(b.boringId) || !positive(b.totalDepthFt) || !b.stratigraphy.length) issues.push({ code: 'INPUT_INCOMPLETE', module: 'geotechnical_investigation', path: `geotechnicalInvestigation[${i}]`, message: 'Boring ID, positive depth, and stratigraphy are required.', severity: 'error' });
      b.stratigraphy.forEach((layer, j) => {
        if (!finite(layer.depthStartFt) || !finite(layer.depthEndFt) || layer.depthStartFt >= layer.depthEndFt || layer.depthEndFt > b.totalDepthFt) issues.push({ code: 'INVALID_VALUE', module: 'geotechnical_investigation', path: `geotechnicalInvestigation[${i}].stratigraphy[${j}]`, message: 'Stratigraphy depth interval is invalid.', severity: 'error' });
      });
    });
  }

  if (!payload.groundwaterEvidence) issues.push({ code: 'INPUT_INCOMPLETE', module: 'groundwater_evidence', path: 'groundwaterEvidence', message: 'Groundwater evidence is required.', severity: 'error' });
  else {
    present.add('groundwater_evidence');
    const g = payload.groundwaterEvidence;
    if (!finite(g.measuredWaterTableDepthFt) || g.measuredWaterTableDepthFt < 0 || !nonEmpty(g.observationDate)) issues.push({ code: 'INVALID_VALUE', module: 'groundwater_evidence', path: 'groundwaterEvidence', message: 'Measured groundwater depth and observation date are required.', severity: 'error' });
    if (g.porePressureRatioRu !== undefined && !finite(g.porePressureRatioRu)) issues.push({ code: 'INVALID_VALUE', module: 'groundwater_evidence', path: 'groundwaterEvidence.porePressureRatioRu', message: 'Pore-pressure ratio must be finite when supplied.', severity: 'error' });
  }

  if (!payload.qualifiedFill) issues.push({ code: 'INPUT_INCOMPLETE', module: 'qualified_fill', path: 'qualifiedFill', message: 'Qualified fill evidence is required.', severity: 'error' });
  else {
    present.add('qualified_fill');
    const f = payload.qualifiedFill;
    if (!nonEmpty(f.materialSource) || !nonEmpty(f.materialClassification) || !nonEmpty(f.compactionTestMethod) || !nonEmpty(f.qualificationReportId)) issues.push({ code: 'PROVENANCE_REQUIRED', module: 'qualified_fill', path: 'qualifiedFill', message: 'Material classification, test method, and qualification report are required.', severity: 'error' });
    if (!nonNegative(f.maxAggregateSizeIn) || !nonNegative(f.plasticityIndexMax) || !nonNegative(f.liquidLimitMax) || !positive(f.minCompactionProctorPct) || f.minCompactionProctorPct > 100) issues.push({ code: 'INVALID_VALUE', module: 'qualified_fill', path: 'qualifiedFill', message: 'Fill qualification limits are invalid.', severity: 'error' });
  }

  if (!payload.laboratoryResults?.length) issues.push({ code: 'INPUT_INCOMPLETE', module: 'laboratory_results', path: 'laboratoryResults', message: 'At least one laboratory result is required.', severity: 'error' });
  else {
    present.add('laboratory_results');
    payload.laboratoryResults.forEach((r, i) => {
      if (!nonEmpty(r.sampleId) || !nonEmpty(r.testMethod) || !nonEmpty(r.drainageCondition) || !nonEmpty(r.reportId)) issues.push({ code: 'PROVENANCE_REQUIRED', module: 'laboratory_results', path: `laboratoryResults[${i}]`, message: 'Sample, test method, drainage condition, and report ID are required.', severity: 'error' });
      if (!finite(r.moistureContentPct) || !finite(r.cohesionPsf) || !finite(r.frictionAngleDeg) || !finite(r.unitWeightPcf)) issues.push({ code: 'INVALID_VALUE', module: 'laboratory_results', path: `laboratoryResults[${i}]`, message: 'Laboratory parameters must be finite numbers.', severity: 'error' });
      if (r.frictionAngleDeg < 0 || r.frictionAngleDeg >= 90 || r.unitWeightPcf <= 0) issues.push({ code: 'INVALID_VALUE', module: 'laboratory_results', path: `laboratoryResults[${i}]`, message: 'Friction angle or unit weight is outside the permitted range.', severity: 'error' });
    });
  }

  if (!payload.hydraulicBoundaryConditions) issues.push({ code: 'INPUT_INCOMPLETE', module: 'hydraulic_boundary_conditions', path: 'hydraulicBoundaryConditions', message: 'Hydraulic boundary conditions are required.', severity: 'error' });
  else {
    present.add('hydraulic_boundary_conditions');
    const h = payload.hydraulicBoundaryConditions;
    if (!nonEmpty(h.referenceDatum) || !['Constant', 'Transient', 'Impermeable'].includes(h.boundaryType)) issues.push({ code: 'PROVENANCE_REQUIRED', module: 'hydraulic_boundary_conditions', path: 'hydraulicBoundaryConditions', message: 'Boundary type and reference datum are required.', severity: 'error' });
    if (!finite(h.upstreamHeadFt) || !finite(h.downstreamHeadFt) || !finite(h.permeabilityKcmSec) || h.permeabilityKcmSec < 0) issues.push({ code: 'INVALID_VALUE', module: 'hydraulic_boundary_conditions', path: 'hydraulicBoundaryConditions', message: 'Hydraulic heads and permeability must be valid finite values.', severity: 'error' });
  }

  if (!payload.approvedProjectGeometry) issues.push({ code: 'INPUT_INCOMPLETE', module: 'approved_project_geometry', path: 'approvedProjectGeometry', message: 'Approved project geometry is required.', severity: 'error' });
  else {
    present.add('approved_project_geometry');
    const g = payload.approvedProjectGeometry;
    if (!nonEmpty(g.crossSectionId) || !nonEmpty(g.approvalReference)) issues.push({ code: 'PROVENANCE_REQUIRED', module: 'approved_project_geometry', path: 'approvedProjectGeometry', message: 'Cross-section and approval reference are required.', severity: 'error' });
    if (!positive(g.slopeRatioHorizontal) || !positive(g.slopeRatioVertical) || !nonNegative(g.benchWidthFt) || !nonNegative(g.foundationEmbedmentDepthFt)) issues.push({ code: 'INVALID_VALUE', module: 'approved_project_geometry', path: 'approvedProjectGeometry', message: 'Geometry ratios must be positive and dimensions non-negative.', severity: 'error' });
  }

  const evidence = payload.evidence ?? [];
  const synthetic = evidence.some((e) => e.status === 'SYNTHETIC_TEST_ONLY' || e.authority === 'DISCOVERY_ONLY');
  if (synthetic) issues.push({ code: 'SYNTHETIC_DATA_REJECTED', module: 'root', path: 'evidence', message: 'Synthetic/discovery-only evidence cannot satisfy engineering readiness.', severity: 'error' });
  for (const module of modules) {
    const refs = evidence.filter((e) => e.module === module);
    if (!refs.length) issues.push({ code: 'EVIDENCE_REQUIRED', module, path: `evidence[${module}]`, message: `No provenance evidence reference is attached for ${module}.`, severity: 'error' });
    else if (!refs.some((e) => e.status === 'VERIFIED' && e.authority !== 'DISCOVERY_ONLY')) issues.push({ code: 'PROVENANCE_REQUIRED', module, path: `evidence[${module}]`, message: `A verified non-discovery evidence reference is required for ${module}.`, severity: 'error' });
  }

  return { valid: issues.every((i) => i.severity !== 'error'), issues, verifiedModules: [...present].filter((m) => !issues.some((i) => i.module === m && i.severity === 'error')), synthetic, payloadHash: hashEvidencePayload(payload) };
}