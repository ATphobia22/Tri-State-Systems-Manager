import assert from 'node:assert/strict';
import {test} from 'node:test';
import {trainParallelStreamNeurons,predictParallelStreamNeurons} from '../src/lib/research-parallel-stream-neurons.ts';
const samples=Array.from({length:80},(_,i)=>{
  const visibility=i%2?0.9:0.1;
  const congestion=Math.floor(i/2)%2?0.9:0.1;
  return {features:[0.5,visibility,0.5,congestion],visibilityTarget:visibility,congestionTarget:congestion};
});
test('two neural heads train deterministically and beat holdout constant baseline on synthetic labels',()=>{
  const a=trainParallelStreamNeurons(samples,{epochs:120,learningRate:0.2});
  const b=trainParallelStreamNeurons(samples,{epochs:120,learningRate:0.2});
  assert.deepEqual(a,b);
  assert.equal(a.acceptedForResearchInference,true);
  assert.ok(a.validation.visibilityMse<a.validation.visibilityBaselineMse);
  assert.ok(a.validation.congestionMse<a.validation.congestionBaselineMse);
  const hi=predictParallelStreamNeurons(a,[0.5,0.9,0.5,0.9]);
  const lo=predictParallelStreamNeurons(a,[0.5,0.1,0.5,0.1]);
  assert.ok(hi.visibility>lo.visibility);
  assert.ok(hi.congestion>lo.congestion);
  assert.equal(hi.classification,'RESEARCH_ONLY');
});
test('no real user data retained, no authority mutation and no QPU work',()=>{
  const model=trainParallelStreamNeurons(samples);
  assert.equal(model.authoritativeMutation,false);
  assert.equal(model.trainingExamplesRetained,false);
  assert.equal(model.classification,'RESEARCH_ONLY');
  assert.equal('samples' in model,false);
});
test('holdout failure yields deterministic fallback, not an unsafe neural prediction',()=>{
  const constant=samples.map(s=>({...s,visibilityTarget:0.5,congestionTarget:0.5}));
  const model=trainParallelStreamNeurons(constant);
  assert.equal(model.acceptedForResearchInference,false);
  assert.deepEqual(predictParallelStreamNeurons(model,[0.1,0.7,0.2,0.4]),
    {visibility:0.7,congestion:0.4,mode:'deterministic-fallback',classification:'RESEARCH_ONLY'});
});
test('malformed labels, features, model policy and unbounded training are rejected',()=>{
  assert.throws(()=>trainParallelStreamNeurons(samples.slice(0,3)),RangeError);
  assert.throws(()=>trainParallelStreamNeurons([...samples,{features:[2,0,0,0],visibilityTarget:0.2,congestionTarget:0.2}]),RangeError);
  assert.throws(()=>trainParallelStreamNeurons(samples,{epochs:5000}),RangeError);
  const model=trainParallelStreamNeurons(samples);
  assert.throws(()=>predictParallelStreamNeurons({...model,classification:'AUTHORITATIVE'},[0,0,0,0]),/boundary/);
  assert.throws(()=>predictParallelStreamNeurons(model,[0,0,NaN,0]),RangeError);
});
