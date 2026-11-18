import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGeoTruthMapData, GEOTRUTH_QA_STATUS } from '../src/lib/geotruth-map-layer.ts';

const square = {type:'Polygon',coordinates:[[[ -88,38 ],[-88.001,38],[-88.001,38.001],[-88,38]]]};
const feature = (id, props={}) => ({type:'Feature',geometry:square,properties:{sourceObjectId:id,...props,owner:'MUST_NOT_PUBLISH'}});
test('GeoTruth maps published footprints only and strips owner fields', () => {
  const result=buildGeoTruthMapData({type:'FeatureCollection',features:[
    feature(1,{height_m:7}),feature(2),feature(3,{height_m:-1}),
  ]});
  assert.equal(result.data.features.length,3);
  assert.equal(result.counts.HEIGHT_ESTIMATE_UNVERIFIED,1);
  assert.equal(result.counts.HEIGHT_NOT_EVIDENCED,1);
  assert.equal(result.counts.HEIGHT_INVALID,1);
  assert.equal(result.data.features[0].properties.sourceObjectId,1);
  assert.equal(result.data.features[0].geometry,square);
  assert.equal(JSON.stringify(result.data).includes('MUST_NOT_PUBLISH'),false);
  assert.equal(result.scientificValidation,false);
});
test('GeoTruth never calls missing height zero or surveyed',()=>{
  const result=buildGeoTruthMapData({type:'FeatureCollection',features:[feature(9,{height_m:null})]});
  assert.equal(result.data.features[0].properties.qaStatus,GEOTRUTH_QA_STATUS.notEvidenced);
  assert.equal(result.data.features[0].properties.estimatedHeightM,null);
});
test('GeoTruth rejects invalid/too many features',()=>{
  assert.throws(()=>buildGeoTruthMapData({type:'FeatureCollection',features:[]}),/features|empty/i);
  assert.throws(()=>buildGeoTruthMapData({type:'FeatureCollection',features:new Array(30001).fill(feature(1))}),/limit|exceeds/i);
});
test('GeoTruth treats mismatched aliases or duplicate source identities as unverified',()=>{
  const result=buildGeoTruthMapData({type:'FeatureCollection',features:[
    feature(10,{OBJECTID:11,height_m:6}),feature(12,{height_m:8}),feature(12,{height_m:7})
  ]});
  assert.equal(result.data.features[0].properties.qaStatus,'SOURCE_ID_CONFLICT');
  assert.equal(result.data.features[1].properties.qaStatus,'DUPLICATE_SOURCE_ID');
  assert.equal(result.data.features[2].properties.qaStatus,'DUPLICATE_SOURCE_ID');
});
