import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getGovernmentSource, queryGovernmentJson, validateEvidenceEnvelope, wrapPinnedSnapshot, sha256 } from '../../packages/government/src/index.ts';
import { loadPinnedSnapshot, listPinnedSnapshots } from '../../packages/government/src/snapshots.ts';
import { NwpsAdapter } from '../../packages/government/src/adapters/NwpsAdapter.ts';
import { NwisAdapter } from '../../packages/government/src/adapters/NwisAdapter.ts';
import { FemaAdapter } from '../../packages/government/src/adapters/FemaAdapter.ts';
import { getLocalHolding, listLocalHoldings } from '../../packages/government/src/localHoldings.ts';
import { GOVERNMENT_CAPABILITIES } from '../../packages/government/src/capabilities.ts';
import { GovernmentSourceCapabilityProvider } from '../../packages/government/src/GovernmentSourceCapabilityProvider.ts';

const JSON_HEADERS={'content-type':'application/json'};
const mockFetcher=(payload:unknown)=>async()=>new Response(JSON.stringify(payload),{status:200,headers:JSON_HEADERS});

test('registry includes the river-data sources with honest limitations',()=>{
 for(const id of ['noaa-nwps','usgs-nwis']){
  const source=getGovernmentSource(id);
  assert.equal(new URL(source.endpoint).protocol,'https:');
  assert.ok(source.limitations.some(l=>/user-initiated/i.test(l)),id+' must document the user-initiated live-fetch policy');
 }
 assert.ok(getGovernmentSource('usgs-nwis').limitations.some(l=>/HTTP 400/i.test(l)));
});

test('NWPS adapter validates gauge IDs and fetches offline via injected fetcher',async()=>{
 const adapter=new NwpsAdapter();
 assert.throws(()=>{void adapter.getGaugeSnapshot('bad!!')},/NWPS_GAUGE_ID_INVALID/);
 const payload={flood:{actionStage:28}};
 const envelope=await adapter.getGauge('MTVI3',{fetcher:mockFetcher(payload)});
 assert.deepEqual(validateEvidenceEnvelope(envelope),[]);
 assert.deepEqual(envelope.result, payload);
 await assert.rejects(()=>queryGovernmentJson('noaa-nwps','https://evil.example/x',{fetcher:mockFetcher(payload)}),/OUTSIDE_REGISTERED_ENDPOINT/);
 const stage=await adapter.getStageflow('MTVI3',{fetcher:mockFetcher({observed:[]})});
 assert.deepEqual(validateEvidenceEnvelope(stage),[]);
});

test('NWIS adapter fetches IV JSON offline and rejects non-JSON site assumptions',async()=>{
 const adapter=new NwisAdapter();
 const payload={value:{timeSeries:[]}};
 const envelope=await adapter.getIv('03378500,03381700','00065,00060',{fetcher:mockFetcher(payload)});
 assert.deepEqual(validateEvidenceEnvelope(envelope),[]);
 assert.deepEqual(envelope.result,payload);
 await assert.rejects(adapter.getIv('not-a-site'),/NWIS_SITES_INVALID/);
});

test('pinned snapshots are hash-verified and served as valid evidence envelopes',()=>{
 const entries=listPinnedSnapshots();
 assert.ok(entries.length>=6);
 for(const entry of entries){
  const envelope=loadPinnedSnapshot(entry.sourceId,entry.name);
  assert.deepEqual(validateEvidenceEnvelope(envelope),[]);
  assert.equal(envelope.provenance.status,'VALIDATED');
  assert.ok(envelope.citations[0].title.includes('pinned snapshot'));
 }
 const mtvi3=loadPinnedSnapshot<{flood?:{stages?:unknown}}>('noaa-nwps','nws-nwps-mtvi3.json');
 assert.ok(mtvi3.result.flood,'MTVI3 snapshot must carry flood thresholds');
 const sites=loadPinnedSnapshot('usgs-nwis','usgs-5gage-sites.json');
 assert.ok(JSON.stringify(sites.result).includes('352.71'),'site snapshot must carry the verified New Harmony datum');
});

test('snapshot tampering is detected, not served',()=>{
 const dir=mkdtempSync(join(tmpdir(),'tsm-snap-'));
 try{
  const good='{"a":1}';
  const ref={sourceId:'noaa-nwps',url:'https://api.water.noaa.gov/nwps/v1/gauges/MTVI3',retrievedAt:'2026-10-23T14:12:45Z',sha256:sha256(good),mediaType:'application/json'};
  writeFileSync(join(dir,'manifest.json'),JSON.stringify([{...ref,name:'x.json',description:'t',bytes:good.length}]));
  writeFileSync(join(dir,'x.json'),'{"a":2}');
  assert.throws(()=>loadPinnedSnapshot('noaa-nwps','x.json',dir),/SNAPSHOT_HASH_MISMATCH/);
  assert.throws(()=>loadPinnedSnapshot('noaa-nwps','missing.json',dir),/NOT_REGISTERED/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('NWPS/NWIS snapshot methods serve the bundled real data offline',()=>{
 const nwps=new NwpsAdapter();
 for(const gauge of NwpsAdapter.SNAPSHOT_GAUGES){
  const envelope=nwps.getGaugeSnapshot(gauge);
  assert.deepEqual(validateEvidenceEnvelope(envelope),[]);
 }
 const stage=nwps.getStageflowSnapshot('MTVI3');
 assert.deepEqual(validateEvidenceEnvelope(stage),[]);
 assert.throws(()=>nwps.getStageflowSnapshot('EVVI3'),/NOT_HELD/);
 const nwis=new NwisAdapter();
 const sites=nwis.getSitesSnapshot();
 assert.deepEqual(validateEvidenceEnvelope(sites),[]);
});

test('local holdings reader verifies hashes and reports exact missing paths',()=>{
 const dir=mkdtempSync(join(tmpdir(),'tsm-hold-'));
 try{
  const geojson='{"type":"FeatureCollection","features":[]}';
  const fileName='zones.geojson';
  writeFileSync(join(dir,fileName),geojson);
  const manifest=[{id:'z',county:'18129',authority:'FEMA',vintage:'v',url:'https://msc.fema.gov/x',retrievedAt:'2026-09-30T00:00:00Z',path:fileName,sha256:sha256(geojson),bytes:geojson.length,features:0,status:'acquired'}];
  const manifestPath=join(dir,'manifest.json');
  writeFileSync(manifestPath,JSON.stringify(manifest));
  assert.equal(listLocalHoldings(manifestPath).length,1);
  const envelope=getLocalHolding(manifestPath,e=>e.county==='18129',{dataRoot:dir});
  assert.deepEqual(validateEvidenceEnvelope(envelope),[]);
  assert.throws(()=>getLocalHolding(manifestPath,e=>e.county==='99999',{dataRoot:dir}),/ENTRY_NOT_FOUND/);
  assert.throws(()=>getLocalHolding(manifestPath,e=>e.county==='18129',{dataRoot:join(dir,'nope')}),/NOT_PRESENT/);
  writeFileSync(join(dir,fileName),'{"tampered":true}');
  assert.throws(()=>getLocalHolding(manifestPath,e=>e.county==='18129',{dataRoot:dir}),/HASH_MISMATCH/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('local holdings require an explicit data root, never a silent default',()=>{
 const dir=mkdtempSync(join(tmpdir(),'tsm-hold-'));
 try{
  const manifestPath=join(dir,'manifest.json');
  writeFileSync(manifestPath,'[]');
  delete process.env.TSM_OFFLINE_DATA_ROOT;
  assert.throws(()=>getLocalHolding(manifestPath,()=>true,{}),/ROOT_NOT_CONFIGURED/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('FEMA adapter serves held NFHL flood zones or names the exact gap',()=>{
 const adapter=new FemaAdapter();
 const dir=process.env.TSM_OFFLINE_DATA_ROOT;
 if(dir){
  try{
   const envelope=adapter.getLocalFloodZones('18129',{dataRoot:dir});
   assert.deepEqual(validateEvidenceEnvelope(envelope),[]);
  }catch(error){
   assert.match((error as Error).message,/NOT_PRESENT|ENTRY_NOT_FOUND/);
  }
 }else{
  assert.throws(()=>adapter.getLocalFloodZones('18129',{}),/ROOT_NOT_CONFIGURED/);
 }
 assert.throws(()=>adapter.getLocalFloodZones('abc',{}),/FIPS_INVALID/);
});

test('capability registry marks wired river and local-NFHL capabilities as registered',()=>{
 const byId=new Map(GOVERNMENT_CAPABILITIES.map(c=>[c.id,c]));
 for(const id of ['geo.dem.query','weather.forecast','river.gauge.query','river.iv.query','geo.nfhl.local','geo.nfhl.query']){
  assert.equal(byId.get(id)?.status,'registered',id);
 }
 for(const id of ['geo.elevation.profile','geo.watershed.query','stormsurge.analysis','soil.lookup']){
  assert.equal(byId.get(id)?.status,'discovery-only',id);
 }
});

test('source.fetch supports the river sources via configured REST adapters',async()=>{
 const provider=new GovernmentSourceCapabilityProvider();
 for(const [sourceId,url] of [['noaa.nwps','https://api.water.noaa.gov/nwps/v1/gauges/MTVI3'],['usgs.nwis','https://waterservices.usgs.gov/nwis/iv/?format=json&sites=03378500']]){
  const supported=await provider.supports('source.fetch',{sourceId,url});
  assert.equal(supported.supported,true,sourceId);
 }
 const catalogOnly=await provider.supports('source.fetch',{sourceId:'noaa.coastal',url:'https://coast.noaa.gov/x'});
 assert.equal(catalogOnly.supported,false);
 const unknown=await provider.supports('source.fetch',{sourceId:'noaa.nwps',url:'https://evil.example/x'});
 assert.equal(unknown.supported,true,'supports() checks registration and shape; URL allowlisting is enforced at execute time');
 await assert.rejects(()=>queryGovernmentJson('noaa-nwps','https://evil.example/x',{fetcher:mockFetcher({})}),/OUTSIDE_REGISTERED_ENDPOINT/);
});

test('SSURGO holdings manifest describes the 8 held county surveys honestly',()=>{
 const manifestPath=fileURLToPath(new URL('../../packages/government/snapshots/ssurgo-holdings-manifest.json',import.meta.url));
 const entries=listLocalHoldings(manifestPath);
 assert.equal(entries.length,8);
 for(const entry of entries){
  assert.match(entry.sha256,/^[a-f0-9]{64}$/);
  assert.equal(entry.status,'acquired');
  assert.ok(entry.url.startsWith('https://websoilsurvey.sc.egov.usda.gov/'));
 }
 const root=process.env.TSM_OFFLINE_DATA_ROOT;
 if(root){
  const envelope=getLocalHolding(manifestPath,e=>e.county==='IN129',{dataRoot:root});
  assert.deepEqual(validateEvidenceEnvelope(envelope),[]);
 }
});

test('wrapPinnedSnapshot rejects bad manifest hashes and non-JSON bytes',()=>{
 const ref={sourceId:'noaa-nwps',url:'https://api.water.noaa.gov/nwps/v1/gauges/MTVI3',retrievedAt:'2026-10-23T14:12:45Z',sha256:'not-hex',mediaType:'application/json'};
 assert.throws(()=>wrapPinnedSnapshot(ref,'{}'),/MANIFEST_HASH_INVALID/);
 const ref2={...ref,sha256:sha256('not json')};
 assert.throws(()=>wrapPinnedSnapshot(ref2,'not json'),/INVALID_JSON/);
});
