import test from 'node:test';
import assert from 'node:assert/strict';
import {empiricalSemivariogram as variogram,sphericalModel,exponentialModel} from '../../packages/geo/src/geodesy/semivariogram.ts';
test('Indiana ftUS is converted, never relabeled metres',()=>{
 const feet=3937/1200;
 const a=variogram([0,feet,2*feet],[0,0,0],[0,2,4],{crs:{epsg:2966,units:'ftUS'},nLags:2,maxDistM:2,minPairs:1});
 const b=variogram([0,1,2],[0,0,0],[0,2,4],{crs:{epsg:26916,units:'metre'},nLags:2,maxDistM:2,minPairs:1});
 assert.deepEqual(a.bins,b.bins);assert.equal(a.bins[1].pairCount,3);assert.equal(a.bins[0].gamma,null);
 assert.equal(a.distanceBasis,'PROJECTED_GRID_METRES');
 assert.throws(()=>variogram([0,1],[0,0],[0,1],{crs:{epsg:2966,units:'metre'}}));
 assert.throws(()=>variogram([0,1],[0,0],[0,1],{crs:{epsg:4326,units:'metre'}}));
});
test('known semivariance and constant field',()=>{
 assert.equal(variogram([0,1],[0,0],[0,2],{crs:{epsg:26916,units:'metre'},nLags:1,maxDistM:1,minPairs:1}).bins[0].gamma,2);
 assert.equal(variogram([0,1],[0,0],[5,5],{crs:{epsg:26916,units:'metre'},nLags:1,maxDistM:1,minPairs:1}).bins[0].gamma,0);
});
test('reject nonfinite inputs and invalid bins; sparse bins stay insufficient',()=>{
 assert.throws(()=>variogram([0,NaN],[0,0],[0,1],{crs:{epsg:26916,units:'metre'}}));
 assert.throws(()=>variogram([0,1],[0,0],[0,1],{crs:{epsg:26916,units:'metre'},nLags:0}));
 assert.equal(variogram([0,1],[0,0],[0,1],{crs:{epsg:26916,units:'metre'},maxDistM:2}).bins.every(b=>!b.sufficient),true);
});
test('model origin, sill and practical exponential range',()=>{
 assert.equal(sphericalModel(0,.1,.2,10),0);assert.equal(sphericalModel(10,.1,.2,10),.1+.2);
 assert.ok(Math.abs(exponentialModel(10,0,1,10)-(1-Math.exp(-3)))<1e-12);
 assert.throws(()=>sphericalModel(1,0,1,0));
});
