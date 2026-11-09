import test from 'node:test';
import assert from 'node:assert/strict';
import {screenBuildingHeight,screenParcelBoundaryProximity,mapBuildingVerticalAttributes} from '../../packages/geo/src/zoning/evidence-screening.mjs';
const hash='a'.repeat(64);
test('estimated Overture height never becomes compliant',()=>{
 assert.equal(screenBuildingHeight({heightFt:20,heightEvidence:'OVERTURE_ESTIMATE',maxHeightFt:35,ordinanceVersion:'2026',verticalReceiptSha256:hash}).status,'PENDING_EVIDENCE');
});
test('screening conflict is not a regulatory violation',()=>{
 const x=screenBuildingHeight({heightFt:40,heightEvidence:'LIDAR_QA_REVIEWED',maxHeightFt:35,ordinanceVersion:'reviewed-2026',verticalReceiptSha256:hash});
 assert.equal(x.status,'SCREENING_CONFLICT');assert.equal(x.regulatoryStatus,'NOT_A_REGULATORY_DETERMINATION');
});
test('valid reviewed input produces screening pass only',()=>{
 assert.equal(screenBuildingHeight({heightFt:30,heightEvidence:'FIELD_SURVEY_REVIEWED',maxHeightFt:35,ordinanceVersion:'reviewed-2026',verticalReceiptSha256:hash}).status,'SCREENING_PASS');
});
test('no fabricated LiDAR evidence from raw fields',()=>{
 const p={Roof_Elev:410,Ground_Elev:380};
 assert.equal(mapBuildingVerticalAttributes(p,{}).heightEvidence,'PENDING');
 assert.equal(mapBuildingVerticalAttributes(p,{qaReviewed:true,verticalDatum:'NGVD29',verticalUnits:'US_SURVEY_FOOT',horizontalCrs:'EPSG:2966',sha256:hash}).heightEvidence,'PENDING');
 const mapped=mapBuildingVerticalAttributes(p,{qaReviewed:true,verticalDatum:'NAVD88',verticalUnits:'US_SURVEY_FOOT',horizontalCrs:'EPSG:2966',sha256:hash});
 assert.equal(mapped.heightFt,30);
});
test('EPSG:2966 distances are survey feet not metres',()=>{
 const x=screenParcelBoundaryProximity({distanceUsft:10,crs:'EPSG:2966'});
 assert.equal(x.nearestBoundaryUsft,10); assert.equal(x.setbackStatus,'FRONT_SIDE_REAR_SETBACK_NOT_EVALUATED');
 assert.equal(screenParcelBoundaryProximity({distanceUsft:10,crs:'EPSG:4326'}).status,'PENDING_EVIDENCE');
});
