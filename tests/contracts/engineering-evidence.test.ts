import assert from 'node:assert/strict';
import test from 'node:test';
import { validateSystemEvidence } from '../../packages/evidence/src/index.ts';
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
