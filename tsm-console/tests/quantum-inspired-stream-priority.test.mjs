import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
  planQuantumInspiredStream, createQuantumInspiredLoadPlanner,
} from '../src/lib/quantum-inspired-stream-priority.ts';

const sha = 'a'.repeat(64);
const tile = (id,estimatedBytes,qualityGain,overrides={}) => ({
  id,estimatedBytes,qualityGain,freshness:0,motionPriority:0,
  classification:'DERIVED',sourceSha256:sha,sourceVerified:true,licenseReviewed:true,
  ...overrides,
});
const budget = {maxBytes:10,maxTiles:3};

test('real byte and concurrency caps are hard; result is classical non-authoritative planning', () => {
  const p = planQuantumInspiredStream([tile('a',7,0.8),tile('b',6,0.7),tile('c',3,0.5)],budget);
  assert.ok(p.estimatedBytes<=10);
  assert.ok(p.selectedIds.length<=3);
  assert.equal(p.executionClass,'CLASSICAL_PLANNING_ONLY');
  assert.equal(p.evidenceMutation,false);
  assert.equal(p.remoteQuantumJobs,0);
});
test('reproducible seeded annealing never underperforms deterministic baseline', () => {
  const xs = [
    tile('a',9,0.95),tile('b',5,0.72,{coherenceGroup:'street'}),
    tile('c',5,0.72,{coherenceGroup:'street'}),tile('d',1,0.20),
  ];
  const opts = {...budget,strategy:'annealed',seed:713,annealSteps:1024};
  const a=planQuantumInspiredStream(xs,opts);
  const b=planQuantumInspiredStream(xs,opts);
  assert.deepEqual(a,b);
  assert.ok(a.objectiveScore+1e-10>=a.baselineScore);
  assert.ok(a.estimatedBytes<=10);
});
test('unverified, hashless, unreviewed and invalid class assets are denied', () => {
  const p = planQuantumInspiredStream([
    tile('unverified',1,1,{sourceVerified:false}),
    tile('unlicensed',1,1,{licenseReviewed:false}),
    tile('hashless',1,1,{sourceSha256:'wrong'}),
    tile('unclassified',1,1,{classification:'REGULATORY'}),
    tile('trusted',2,0.2),
  ],budget);
  assert.deepEqual(p.selectedIds,['trusted']);
  assert.equal(p.rejected.filter(x=>x.reason==='INVALID_EVIDENCE_OR_METRICS').length,4);
});
test('unknown tiles cannot be silently admitted via load planner', () => {
  const plan=createQuantumInspiredLoadPlanner([tile('trusted',2,0.5)],{maxBytes:5,strategy:'greedy'});
  assert.deepEqual(plan(['unknown','trusted'],2),['trusted']);
  assert.deepEqual(plan(['unknown'],1),[]);
});
test('source classes are only labels, not hydraulic acceptance or legal clearance', () => {
  const p=planQuantumInspiredStream([tile('movie',2,0.8,{classification:'PRESENTATION'})],budget);
  assert.deepEqual(p.selectedIds,['movie']);
  assert.equal(p.evidenceMutation,false);
});
test('invalid budgets, duplicate identities and huge batches fail closed', () => {
  assert.throws(()=>planQuantumInspiredStream([tile('a',1,0.1)],{maxBytes:-1,maxTiles:1}),RangeError);
  assert.throws(()=>planQuantumInspiredStream([tile('a',1,0.1),tile('a',1,0.2)],budget),/Duplicate/);
  assert.throws(()=>planQuantumInspiredStream(Array.from({length:65},(_,i)=>tile('x'+i,1,0.1)),budget),RangeError);
  assert.throws(()=>planQuantumInspiredStream([tile('../bad',1,0.1)],budget),/Invalid tile identity/);
  assert.throws(()=>planQuantumInspiredStream([tile('a',1,0.1)],{...budget,annealSteps:1e9}),RangeError);
});
test('budget zero selects no tiles without pretending to render', () => {
  const p=planQuantumInspiredStream([tile('a',1,1)],{maxBytes:0,maxTiles:0,strategy:'annealed'});
  assert.deepEqual(p.selectedIds,[]);
  assert.equal(p.estimatedBytes,0);
});
test('greedy selection is stable across input order for unique scores', () => {
  const xs=[tile('a',3,0.9),tile('b',4,0.4),tile('c',2,0.6)];
  const a=planQuantumInspiredStream(xs,{maxBytes:5,maxTiles:2});
  const b=planQuantumInspiredStream([...xs].reverse(),{maxBytes:5,maxTiles:2});
  assert.deepEqual(a.selectedIds,b.selectedIds);
});
