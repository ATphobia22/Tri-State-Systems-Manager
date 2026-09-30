import assert from 'node:assert/strict';
import test from 'node:test';
import { validateAndJoin, toTwinStateParts, toUsdRuntimeManifest } from '../../packages/twin-pipeline/src/index.ts';

const evidence = {
  controlledSurvey:{datum:'NAVD88',verticalDatum:'NAVD88',horizontalCrs:'EPSG:2966',easting:1450320.25,northing:421050.8,elevationFt:376.5,accuracyClass:'CONTROLLED',controlReference:'TEST-CONTROL',surveyDate:'2026-09-30'},
  geotechnicalInvestigation:[{boringId:'BH-PTDT-01',totalDepthFt:45,stratigraphy:[{depthStartFt:0,depthEndFt:10,uscsClassification:'CL',description:'test'},{depthStartFt:10,depthEndFt:45,uscsClassification:'SP',description:'test'}]}],
  groundwaterEvidence:{measuredWaterTableDepthFt:12.4,porePressureRatioRu:0.18,isArtesian:false,observationDate:'2026-09-30'},
  qualifiedFill:{materialSource:'TEST',materialClassification:'CL',maxAggregateSizeIn:1,plasticityIndexMax:20,liquidLimitMax:40,minCompactionProctorPct:95,compactionTestMethod:'ASTM-D698',qualificationReportId:'TEST-QF-001'},
  laboratoryResults:[{sampleId:'TEST-S-001',moistureContentPct:12,cohesionPsf:300,frictionAngleDeg:26,unitWeightPcf:115,testMethod:'TEST',drainageCondition:'CD',reportId:'TEST-LAB-001'}],
  hydraulicBoundaryConditions:{upstreamHeadFt:368.2,downstreamHeadFt:355.1,permeabilityKcmSec:0.000001,boundaryType:'Constant',referenceDatum:'NAVD88'},
  approvedProjectGeometry:{crossSectionId:'TEST-CS-001',slopeRatioHorizontal:3,slopeRatioVertical:1,benchWidthFt:10,foundationEmbedmentDepthFt:3,approvalReference:'TEST-APPROVAL'},
  evidence:['controlled_survey','geotechnical_investigation','groundwater_evidence','qualified_fill','laboratory_results','hydraulic_boundary_conditions','approved_project_geometry'].map((module)=>({evidenceId:'TEST-'+module,module,authority:'CONTROLLED_FIELD',status:'VERIFIED',documentHash:'a'.repeat(64),metadata:{datasetId:'dataset-'+module}})),
};
const common={parcelId:'TEST-PARCEL',survey:{datum:'NAVD88',horizontalCrs:'EPSG:2966',easting:1450320.25,northing:421050.8,elevationFt:376.5,isVerified:true},geotech:{boringId:'BH-PTDT-01',groundwaterDepthFt:12.4,porePressureRatioRu:0.18,stratigraphy:[{depthStartFt:0,depthEndFt:10,uscsCode:'CL',cohesionPsf:300,frictionAngleDeg:26},{depthStartFt:10,depthEndFt:45,uscsCode:'SP',cohesionPsf:0,frictionAngleDeg:33}]},hydrology:{upstreamWseFt:368.2,downstreamWseFt:355.1,targetBfeFt:375,evidenceGateCleared:true},timestamp:'2026-09-30T04:45:00Z'};

test('joined runtime requires all verified evidence modules',()=> {
  const result=validateAndJoin(common.parcelId,common.survey,common.geotech,common.hydrology,common.timestamp,evidence);
  assert.equal(result.accepted,true);
  assert.ok(result.entity); assert.ok(result.binding);
});
test('blueprint sample without evidence refs remains fail-closed',()=> {
  const result=validateAndJoin(common.parcelId,common.survey,common.geotech,common.hydrology,common.timestamp,{});
  assert.equal(result.accepted,false);
  assert.ok(result.issues.some((issue)=>issue.includes('verified evidence refs missing')));
});
test('wrong survey CRS is rejected',()=> {
  const result=validateAndJoin(common.parcelId,{...common.survey,horizontalCrs:'EPSG:3857'},common.geotech,common.hydrology,common.timestamp,evidence);
  assert.equal(result.accepted,false);
  assert.ok(result.issues.some((issue)=>issue.includes('EPSG:2966')));
});
test('USD binding separates engineering and presentation layers',()=> {
  const result=validateAndJoin(common.parcelId,common.survey,common.geotech,common.hydrology,common.timestamp,evidence);
  assert.ok(result.entity);
  assert.ok(result.binding);
  assert.equal(result.binding?.readOnlyEngineeringState,true);
  assert.ok(result.binding?.usdPrimPath.includes(result.entity?.twinEntityId ?? ''));
  assert.ok(result.binding?.worldPartitionKey.startsWith('wp:'));
  assert.ok((result.binding?.sequencerTimeSeconds ?? 0)>0);
  const manifest=toUsdRuntimeManifest(result.entity!);
  assert.equal(manifest.horizontalCrs,'EPSG:2966');
  assert.equal(manifest.verticalDatum,'NAVD88');
  assert.ok(Array.isArray(manifest.layers));
});
test('twin conversion does not mislabel evidence IDs as dataset IDs',()=> {
  const result=validateAndJoin(common.parcelId,common.survey,common.geotech,common.hydrology,common.timestamp,evidence);
  assert.ok(result.entity);
  const parts=toTwinStateParts(result.entity!);
  assert.deepEqual(parts.entity.sourceDatasetIds,['dataset-controlled_survey','dataset-geotechnical_investigation','dataset-groundwater_evidence','dataset-qualified_fill','dataset-laboratory_results','dataset-hydraulic_boundary_conditions','dataset-approved_project_geometry']);
  assert.deepEqual(parts.observations,[]);
});
