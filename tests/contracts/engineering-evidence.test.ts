import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSystemManagerPayload, validateSystemEvidence } from '../../packages/evidence/src/index.ts';
import { evaluateEngineeringGate } from '../../packages/gates/src/index.ts';
import { StaticPolicyEngine } from '../../packages/policy/src/PolicyEngine.ts';

const evidence = [
  'controlled_survey',
  'geotechnical_investigation',
  'groundwater_evidence',
  'qualified_fill',
  'laboratory_results',
  'hydraulic_boundary_conditions',
  'approved_project_geometry',
].map((module) => ({
  evidenceId: `ev-${module}`,
  module: module as never,
  authority: 'CONTROLLED_FIELD' as const,
  status: 'VERIFIED' as const,
}));

const complete = {
  controlledSurvey: { datum:'NAVD88', horizontalCrs:'EPSG:2966', easting:100, northing:200, elevationFt:500, accuracyClass:'A', controlReference:'CP-001', surveyDate:'2026-09-30' },
  geotechnicalInvestigation: [{ boringId:'BH-01', totalDepthFt:40, stratigraphy:[{depthStartFt:0,depthEndFt:12,uscsClassification:'CL',description:'clay'},{depthStartFt:12,depthEndFt:40,uscsClassification:'SP',description:'sand'}] }],
  groundwaterEvidence: { measuredWaterTableDepthFt:14, porePressureRatioRu:0.15, isArtesian:false, observationDate:'2026-09-30', referenceDatum:'NAVD88' },
  qualifiedFill: { materialSource:'Source A', materialClassification:'CL', maxAggregateSizeIn:3, plasticityIndexMax:15, liquidLimitMax:40, minCompactionProctorPct:95, compactionTestMethod:'ASTM D698', qualificationReportId:'LAB-FILL-01' },
  laboratoryResults: [{ sampleId:'BH01-S3',moistureContentPct:18.4,cohesionPsf:250,frictionAngleDeg:28,unitWeightPcf:118.5,testMethod:'direct shear',drainageCondition:'drained',reportId:'LAB-01' }],
  hydraulicBoundaryConditions: { upstreamHeadFt:12,downstreamHeadFt:2.5,permeabilityKcmSec:0.00015,boundaryType:'Constant',referenceDatum:'NAVD88' },
  approvedProjectGeometry: { crossSectionId:'SEC-04',slopeRatioHorizontal:2,slopeRatioVertical:1,benchWidthFt:6,foundationEmbedmentDepthFt:3.5,approvalReference:'ENG-APP-01' },
  evidence,
};

test('incomplete payload fails closed', () => {
  const result = validateSystemEvidence({});
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === 'INPUT_INCOMPLETE'));
});

test('complete structure still requires engineering review', () => {
  const result = validateSystemEvidence(complete);
  assert.equal(result.valid, true);
  const gate = evaluateEngineeringGate(complete);
  assert.equal(gate.state, 'ENGINEERING_REVIEW_REQUIRED');
  assert.equal(gate.canCompute, false);
  assert.equal(gate.canApprove, false);
});

test('synthetic evidence cannot satisfy readiness', () => {
  const synthetic = {...complete, evidence: evidence.map((item) => ({...item, status:'SYNTHETIC_TEST_ONLY' as const}))};
  const result = validateSystemEvidence(synthetic);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === 'SYNTHETIC_DATA_REJECTED'));
});

test('specific deny policy cannot be overridden by wildcard allow', async () => {
  const policy = new StaticPolicyEngine([
    {capability:'*',allow:true},
    {capability:'tsm.engineering.*',allow:false},
  ]);
  const decision = await policy.authorize({capability:'tsm.engineering.ras-results',input:{},context:{requestId:'test',permissions:{allow:[]}}});
  assert.equal(decision.allowed, false);
});

test('legacy snake_case ingestion normalizes to canonical evidence fields', () => {
  const legacy = {
    controlled_survey: { datum:'NAVD88', easting:100, northing:200, elevation_ft:500, accuracy_class:'A', control_reference:'CP-001', survey_date:'2026-09-30' },
    geotechnical_investigation: { boring_id:'BH-01', total_depth_ft:40, stratigraphy:[{depth_start_ft:0,depth_end_ft:40,uscs_classification:'CL',description:'clay'}] },
    groundwater_evidence: { measured_water_table_depth_ft:14, pore_pressure_ratio_ru:0.15, is_artesian:false, observation_date:'2026-09-30' },
    qualified_fill: { material_source:'Source A', material_classification:'CL', max_aggregate_size_in:3, plasticity_index_max:15, liquid_limit_max:40, min_compaction_proctor_pct:95, compaction_test_method:'ASTM D698', qualification_report_id:'LAB-FILL-01' },
    laboratory_results: { sample_id:'BH01-S3', moisture_content_pct:18.4, cohesion_psf:250, friction_angle_deg:28, unit_weight_pcf:118.5, test_method:'direct shear', drainage_condition:'drained', report_id:'LAB-01' },
    hydraulic_boundary_conditions: { upstream_head_ft:12, downstream_head_ft:2.5, permeability_k_cm_sec:0.00015, boundary_type:'Constant', reference_datum:'NAVD88' },
    approved_project_geometry: { cross_section_id:'SEC-04', slope_ratio_horizontal:2, slope_ratio_vertical:1, bench_width_ft:6, foundation_embedment_depth_ft:3.5, approval_reference:'ENG-APP-01' },
    evidence,
  };
  const normalized = normalizeSystemManagerPayload(legacy);
  assert.equal(normalized.controlledSurvey?.elevationFt, 500);
  assert.equal(normalized.geotechnicalInvestigation?.[0]?.boringId, 'BH-01');
  assert.equal(normalized.qualifiedFill?.minCompactionProctorPct, 95);
  assert.equal(normalized.approvedProjectGeometry?.slopeRatioHorizontal, 2);
});
