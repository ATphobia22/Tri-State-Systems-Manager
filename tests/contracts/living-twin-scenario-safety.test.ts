import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceMoisture,applyHarvestExtraction} from '../../domains/living-twin/land-management/moisture-engine';
import {applyOperatingEvent,applyMaintenance,failureProbabilityPerHour} from '../../domains/living-twin/infra-health/condition-stress';
import {createEmptySphState} from '../../domains/living-twin/hydro-viz/sph-adapter';

const weather = {dtHours:24,temperatureC:20,rainfallMm:10,relativeHumidity:0.5};
const state = {condition:0.7,stress:0.2};
test('scenario moisture remains bounded and rejects invalid input',()=>{
  const result=advanceMoisture(0.5,'loam',weather,'corn');
  assert.ok(result.moisture>0.5 && result.moisture<=1);
  for(const w of [{dtHours:NaN},{temperatureC:Infinity},{rainfallMm:-1},{relativeHumidity:1.2}])
    assert.throws(()=>advanceMoisture(0.5,'loam',{...weather,...w},'corn'));
  assert.throws(()=>applyHarvestExtraction({n:NaN,p:0.5,k:0.5,om:0.5,ph:7},'corn'));
});
test('wear scenario cannot repair via negative hours or accept nonfinite state',()=>{
  const next=applyOperatingEvent(state,{type:'normal_use',severity:0.2,hours:10});
  assert.ok(next.condition<state.condition);
  assert.throws(()=>applyOperatingEvent(state,{type:'normal_use',severity:0.2,hours:-10}));
  assert.throws(()=>applyOperatingEvent(state,{type:'overload',severity:NaN,hours:1}));
  assert.throws(()=>applyMaintenance({condition:0.5,stress:2},'repair'));
  assert.throws(()=>failureProbabilityPerHour({condition:NaN,stress:0.1}));
});
test('SPH placeholder never presents an inferred fluid simulation',()=>{
  const config={particleCount:10,bounds:{min:[0,0,0] as [number,number,number],max:[1,1,1] as [number,number,number]},fluid:{viscosity:0.1,density:1000,flowRate:1,timeStep:0.1},presentationOnly:true as const};
  assert.equal(createEmptySphState(config).particles.length,0);
  assert.throws(()=>createEmptySphState({...config,particleCount:NaN}));
  assert.throws(()=>createEmptySphState({...config,fluid:{...config.fluid,timeStep:0}}));
});
