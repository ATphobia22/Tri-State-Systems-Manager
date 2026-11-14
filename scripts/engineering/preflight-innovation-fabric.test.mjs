import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { inspectFabric, inspectPatents, orderStages, relativeFile } from './preflight-innovation-fabric.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const schema = JSON.parse(fs.readFileSync(path.join(root, 'integrations/innovation-fabric-stages-v1.json'), 'utf8'));
const patents = JSON.parse(fs.readFileSync(path.join(root, 'integrations/patent-prior-art-screen-2026-11-14.json'), 'utf8'));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const clone = (value) => JSON.parse(JSON.stringify(value));
const fixture = () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'tsm-innovation-gate-'));
  const cleanup = () => fs.rmSync(folder,{recursive:true,force:true});
  fs.mkdirSync(path.join(folder,'data'));
  fs.mkdirSync(path.join(folder,'bin'));
  fs.writeFileSync(path.join(folder,'data/actual.bin'),'source data fixture');
  fs.writeFileSync(path.join(folder,'bin/native-tool'),'fake runner fixture');
  const source = { id:'actual',path:'data/actual.bin',sha256:sha('source data fixture'),
    role:'terrain',classification:'OBSERVED',verified:true,authority:'USGS',
    source_uri:'https://www.usgs.gov/',license_review:'REVIEWED',
    horizontal_crs:'EPSG:2966',vertical_datum:'NAVD88',vertical_units:'ftUS' };
  const runtime = { path:'bin/native-tool',sha256:sha('fake runner fixture'),version:'fixture-0' };
  const plan = {schema:'tsm.innovation.fabric.v1',stage_kinds:{probe:{mode:'headless',runner:'test/verified-adapter.mjs'}},
    proposal:{sources:[source],stages:[{id:'probe',kind:'probe',needs:[],inputs:['actual'],runtime}]}};
  return {folder,cleanup,source,runtime,plan};
};
test('patents are prior art only, never a legal clearance', () => {
  assert.equal(inspectPatents(patents).freedom_to_operate,'NOT_ASSESSED');
  assert.equal(inspectPatents(patents).count,4);
  const fabricated = clone(patents);
  fabricated.patents[0].freedom_to_operate='CLEARED';
  assert.throws(()=>inspectPatents(fabricated),/PATENT_NOT_CLEARED/);
});
test('full eight-stage catalog is ordered and never marks outputs verified', async () => {
  const report = await inspectFabric(schema,root,patents);
  assert.equal(report.stages.length,8);
  assert.equal(report.summary.verified_execution,0);
  assert.equal(report.summary.public_model_outputs,0);
  assert.ok(report.stages.every(row=>row.status==='NOT_EVIDENCED'));
  assert.equal(report.stages.find(x=>x.id==='movie').mode,'headed');
  assert.ok(report.stages.filter(x=>x.id!=='movie').every(row=>row.mode==='headless'));
});
test('verified hash, datum, authority and pinned worker mean ready, not executed', async t => {
  const f=fixture();t.after(f.cleanup);
  const report=await inspectFabric(f.plan,f.folder,patents);
  assert.equal(report.source_evidence[0].status,'HASH_VERIFIED');
  assert.equal(report.stages[0].status,'READY_FOR_EXECUTION');
  assert.equal(report.stages[0].executed,false);
  assert.equal(report.summary.verified_execution,0);
});
test('source hash mismatch is visible, not silently overwritten', async t => {
  const f=fixture();t.after(f.cleanup);
  f.plan.proposal.sources[0].sha256=sha('fabricated data');
  const report=await inspectFabric(f.plan,f.folder,patents);
  assert.equal(report.source_evidence[0].status,'HASH_MISMATCH');
  assert.equal(report.stages[0].status,'NOT_EVIDENCED');
});
test('water/terrain cannot be made authoritative without vertical datum', async t => {
  const f=fixture();t.after(f.cleanup);
  delete f.plan.proposal.sources[0].vertical_datum;
  const report=await inspectFabric(f.plan,f.folder,patents);
  assert.equal(report.source_evidence[0].status,'DATUM_NOT_EVIDENCED');
});
test('unconfigured or modified runner cannot be treated as executed or available', async t => {
  const f=fixture();t.after(f.cleanup);
  f.plan.proposal.stages[0].runtime.sha256=sha('wrong');
  const report=await inspectFabric(f.plan,f.folder,patents);
  assert.ok(report.stages[0].reasons.includes('RUNTIME_HASH_MISMATCH'));
});
test('cross-root symlinks and traversal are rejected', t => {
  const f=fixture();t.after(f.cleanup);
  assert.throws(()=>relativeFile(f.folder,'../elsewhere'),/UNSAFE_RELATIVE_PATH/);
  const outside=path.join(os.tmpdir(),'tsm-escape-'+process.pid);
  fs.writeFileSync(outside,'secret');
  t.after(()=>fs.rmSync(outside,{force:true}));
  try{fs.symlinkSync(outside,path.join(f.folder,'data/link.bin'));}
  catch{return;}
  assert.throws(()=>relativeFile(f.folder,'data/link.bin'),/SYMLINK_OUTSIDE_ROOT/);
});
test('cyclic dependencies and unknown kinds are never runnable',() => {
  assert.throws(()=>orderStages([{id:'alpha',kind:'a',needs:['beta'],inputs:[]},{id:'beta',kind:'a',needs:['alpha'],inputs:[]}],{a:{mode:'headless'}}),/CYCLIC_WORKER_GRAPH/);
  assert.throws(()=>orderStages([{id:'alpha',kind:'missing',needs:[],inputs:[]}],{}),/UNKNOWN_STAGE_KIND/);
});
test('movie rendering is the only headed stage and never a hydraulic solver',async t=>{
  const f=fixture();t.after(f.cleanup);
  f.plan.stage_kinds.probe.mode='headed';
  await assert.rejects(inspectFabric(f.plan,f.folder,patents),/WORKER_RENDER_BOUNDARY_VIOLATION/);
});
