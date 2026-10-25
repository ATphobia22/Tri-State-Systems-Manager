import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, symlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getGovernmentSource, queryGovernmentJson, validateEvidenceEnvelope, wrapPinnedSnapshot, sha256 } from '../../packages/government/src/index.ts';
import { loadPinnedSnapshot, listPinnedSnapshots } from '../../packages/government/src/snapshots.ts';
import { NwpsAdapter } from '../../packages/government/src/adapters/NwpsAdapter.ts';
import { NwisAdapter } from '../../packages/government/src/adapters/NwisAdapter.ts';
import { FemaAdapter } from '../../packages/government/src/adapters/FemaAdapter.ts';
import { Hydrography3DAdapter } from '../../packages/government/src/adapters/Hydrography3DAdapter.ts';
import { NwsFloodInundationAdapter } from '../../packages/government/src/adapters/NwsFloodInundationAdapter.ts';
import { getLocalHolding, listLocalHoldings } from '../../packages/government/src/localHoldings.ts';
import { getRegisteredGovernmentSource } from '../../packages/government/src/GovernmentSourceRegistry.ts';
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
  assert.throws(()=>getLocalHolding(manifestPath,e=>e.county==='18129',{dataRoot:dir}),/HASH_MISMATCH|BYTE_LENGTH_MISMATCH/);
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

test('Hydrography3D adapter reports honest coverage: tri-state UNAVAILABLE, Holston covered',()=>{
 const adapter=new Hydrography3DAdapter();
 assert.equal(adapter.sourceId,'usgs-3dhp');
 assert.equal(getGovernmentSource('usgs-3dhp').endpoint,'https://3dhp.nationalmap.gov/arcgis/rest/services/usgs_3dhp_all/FeatureServer');
 assert.equal(getRegisteredGovernmentSource('usgs.3dhp-edh').endpoint,adapter.endpoint);
 const coverage=adapter.getCoverage();
 assert.deepEqual(validateEvidenceEnvelope(coverage),[]);
 assert.equal(coverage.result.new3depAlignedCoverage.hydrologicUnit,'0601010403');
 assert.ok(/holston/i.test(coverage.result.new3depAlignedCoverage.area));
 assert.ok(/public domain/i.test(coverage.result.license));
 const tri=adapter.checkAOI();
 assert.deepEqual(validateEvidenceEnvelope(tri),[]);
 assert.equal(tri.result.status,'UNAVAILABLE');
 assert.equal(tri.provenance.status,'UNAVAILABLE');
 assert.ok(/0601010403/.test(tri.result.reason),'reason must name the only covered HUC');
 assert.ok(/outside that coverage/i.test(tri.result.reason),'reason must state the AOI is outside coverage');
 const named=adapter.checkAOI('05140201');
 assert.equal(named.result.status,'UNAVAILABLE');
 const holston=adapter.checkAOI('0601010403');
 assert.deepEqual(validateEvidenceEnvelope(holston),[]);
 assert.equal(holston.result.status,'COVERED');
});

test('Hydrography3D adapter fetches service metadata offline via injected fetcher',async()=>{
 const adapter=new Hydrography3DAdapter();
 const payload={serviceDescription:'3DHP',layers:[]};
 const envelope=await adapter.getServiceMetadata({fetcher:mockFetcher(payload)});
 assert.deepEqual(validateEvidenceEnvelope(envelope),[]);
 assert.deepEqual(envelope.result,payload);
 const layer=await adapter.getLayerMetadata(0,{fetcher:mockFetcher(payload)});
 assert.deepEqual(validateEvidenceEnvelope(layer),[]);
 await assert.rejects(()=>adapter.getLayerMetadata(-1,{fetcher:mockFetcher(payload)}),/3DHP_LAYER_INVALID/);
 await assert.rejects(()=>queryGovernmentJson('usgs-3dhp','https://evil.example/x',{fetcher:mockFetcher(payload)}),/OUTSIDE_REGISTERED_ENDPOINT/);
});

test('NWS flood inundation adapter exposes the watched service and honest forecast discovery',async()=>{
 const adapter=new NwsFloodInundationAdapter();
 assert.equal(adapter.sourceId,'nws-flood-inundation');
 assert.equal(getGovernmentSource('nws-flood-inundation').endpoint,'https://maps.water.noaa.gov/server/rest/services/fim_libs/static_stage_based_catfim/FeatureServer');
 assert.equal(getRegisteredGovernmentSource('noaa.fim').endpoint,adapter.endpoint);
 assert.equal(getRegisteredGovernmentSource('noaa.fim-dynamic').access,'CATALOG');
 const meta=await adapter.getStaticServiceMetadata({fetcher:mockFetcher({serviceDescription:'static catfim'})});
 assert.deepEqual(validateEvidenceEnvelope(meta),[]);
 assert.deepEqual(meta.result,{serviceDescription:'static catfim'});
 await assert.rejects(()=>queryGovernmentJson('nws-flood-inundation','https://evil.example/x',{fetcher:mockFetcher({})}),/OUTSIDE_REGISTERED_ENDPOINT/);
 const discovery=adapter.getForecastLayers();
 assert.deepEqual(validateEvidenceEnvelope(discovery),[]);
 assert.equal(discovery.result.products.length,4);
 assert.ok(discovery.result.products.some(p=>/RFC 5-day/i.test(p.name)));
 assert.equal(discovery.result.directQuery,'UNAVAILABLE');
 assert.ok(/not pinned/i.test(discovery.result.directQueryReason));
 const terms=adapter.getPlatformTerms();
 assert.deepEqual(validateEvidenceEnvelope(terms),[]);
 assert.ok(/public domain/i.test(terms.result.dataLicense));
 assert.ok(/Esri/i.test(terms.result.platformTerms));
 const aoi=adapter.checkAOI();
 assert.deepEqual(validateEvidenceEnvelope(aoi),[]);
 assert.equal(aoi.result.directQuery,'UNAVAILABLE');
 assert.ok(/unverified/i.test(aoi.result.coverageClaim));
});

test('capability registry lists the new adapters with honest statuses',()=>{
 const byId=new Map(GOVERNMENT_CAPABILITIES.map(c=>[c.id,c]));
 assert.equal(byId.get('geo.hydrography.3dhp')?.status,'registered');
 assert.equal(byId.get('flood.inundation.static')?.status,'registered');
 assert.equal(byId.get('flood.inundation.forecast')?.status,'discovery-only');
 assert.ok(/UNAVAILABLE/.test(byId.get('geo.hydrography.3dhp')?.description??''));
});

test('source.fetch supports the new adapters via registry aliases',async()=>{
 const provider=new GovernmentSourceCapabilityProvider();
 for(const [sourceId,url] of [
  ['usgs.3dhp-edh','https://3dhp.nationalmap.gov/arcgis/rest/services/usgs_3dhp_all/FeatureServer?f=pjson'],
  ['noaa.fim','https://maps.water.noaa.gov/server/rest/services/fim_libs/static_stage_based_catfim/FeatureServer?f=pjson'],
 ]){
  const supported=await provider.supports('source.fetch',{sourceId,url});
  assert.equal(supported.supported,true,sourceId);
 }
 const dynamic=await provider.supports('source.fetch',{sourceId:'noaa.fim-dynamic',url:'https://www.weather.gov/owp/operations'});
 assert.equal(dynamic.supported,false,'CATALOG sources must not offer source.fetch');
});

test('locally held JSON retains source provenance but does not claim independent validation',()=>{
 const dir=mkdtempSync(join(tmpdir(),'tsm-hold-provenance-'));
 try{
  const raw='{"type":"FeatureCollection","features":[]}';
  writeFileSync(join(dir,'zones.geojson'),raw);
  const item={id:'nfhl-flood-zones-18129',county:'18129',authority:'FEMA National Flood Hazard Layer via Esri (derived copy)',vintage:'Esri copy',url:'https://services5.arcgis.com/example',retrievedAt:'2026-10-23T00:00:00Z',path:'zones.geojson',sha256:sha256(raw),bytes:Buffer.byteLength(raw),features:0,status:'acquired'};
  const manifest=join(dir,'manifest.json');writeFileSync(manifest,JSON.stringify([item]));
  const envelope=getLocalHolding(manifest,()=>true,{dataRoot:dir});
  assert.deepEqual(validateEvidenceEnvelope(envelope),[]);
  assert.equal(envelope.provenance.provider,'fema-nfhl');
  assert.equal(envelope.provenance.status,'UNVERIFIED');
  assert.equal(envelope.evidence[0].sourceId,'fema-nfhl');
  assert.match(envelope.citations[0].title,/Esri \(derived copy\)/);
  assert.equal(envelope.citations[0].url,item.url);
  writeFileSync(manifest,JSON.stringify([{...item,features:2}]));
  assert.throws(()=>getLocalHolding(manifest,()=>true,{dataRoot:dir}),/FEATURE_COUNT_MISMATCH/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('USDA SSURGO ZIP holding returns verified archive reference instead of fake parsed JSON or FEMA provenance',()=>{
 const dir=mkdtempSync(join(tmpdir(),'tsm-hold-ssurgo-'));
 try{
  const raw=Buffer.from([0x50,0x4b,0x03,0x04,0x00,0x00]);
  writeFileSync(join(dir,'soil.zip'),raw);
  const item={id:'ssurgo-in129',county:'IN129',authority:'USDA NRCS via Web Soil Survey',vintage:'2026-10',url:'https://websoilsurvey.sc.egov.usda.gov/example',retrievedAt:'2026-10-23T00:00:00Z',path:'soil.zip',sha256:'0'.repeat(64),bytes:raw.byteLength,features:0,status:'acquired'};
  // Hash the actual bytes; converting arbitrary binary bytes to UTF-8 is not allowed.
  item.sha256=createHash('sha256').update(raw).digest('hex');
  const manifest=join(dir,'manifest.json');writeFileSync(manifest,JSON.stringify([item]));
  const envelope=getLocalHolding(manifest,()=>true,{dataRoot:dir});
  assert.deepEqual(validateEvidenceEnvelope(envelope),[]);
  assert.equal(envelope.evidence[0].sourceId,'usda-soils');
  assert.equal(envelope.evidence[0].authority,'USDA');
  assert.equal(envelope.provenance.status,'UNVERIFIED');
  assert.deepEqual(envelope.result,{
   kind:'LOCAL_ARCHIVE_REFERENCE',sourceId:'usda-soils',relativePath:'soil.zip',mediaType:'application/zip',byteLength:raw.byteLength,sha256:item.sha256,contentsValidated:false
  });
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('local holding never reads outside configured root via parent traversal or symlink',()=>{
 const dir=mkdtempSync(join(tmpdir(),'tsm-hold-path-'));
 const root=join(dir,'root');mkdirSync(root);
 try{
  const raw='{"type":"FeatureCollection","features":[]}';
  writeFileSync(join(dir,'outside.geojson'),raw);
  const item={id:'nfhl',county:'18129',authority:'FEMA',vintage:'v',url:'https://msc.fema.gov/example',retrievedAt:'2026-10-23T00:00:00Z',path:'../outside.geojson',sha256:sha256(raw),bytes:Buffer.byteLength(raw),features:0,status:'acquired'};
  const manifest=join(root,'manifest.json');writeFileSync(manifest,JSON.stringify([item]));
  assert.throws(()=>getLocalHolding(manifest,()=>true,{dataRoot:root}),/UNSAFE_PATH/);
  if(process.platform!=='win32'){
   symlinkSync(join(dir,'outside.geojson'),join(root,'linked.geojson'));
   writeFileSync(manifest,JSON.stringify([{...item,path:'linked.geojson'}]));
   assert.throws(()=>getLocalHolding(manifest,()=>true,{dataRoot:root}),/SYMLINK_OUTSIDE_ROOT/);
  }
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('holdings reconcile source bytes and hashes as an atomic pair or reject them',()=>{
 const dir=mkdtempSync(join(tmpdir(),'tsm-hold-reconcile-'));
 try{
  const raw='{"type":"FeatureCollection","features":[]}';
  writeFileSync(join(dir,'zones.geojson'),raw);
  const item={id:'nfhl',county:'18129',authority:'FEMA',vintage:'v',url:'https://msc.fema.gov/example',retrievedAt:'2026-10-23T00:00:00Z',path:'zones.geojson',sha256:'0'.repeat(64),bytes:1,features:0,status:'acquired',bytes_reconciled:Buffer.byteLength(raw),sha256_reconciled:sha256(raw),reconciledAt:'2026-10-24T00:00:00Z'};
  const manifest=join(dir,'manifest.json');
  writeFileSync(manifest,JSON.stringify([item]));
  assert.deepEqual(validateEvidenceEnvelope(getLocalHolding(manifest,()=>true,{dataRoot:dir})),[]);
  writeFileSync(manifest,JSON.stringify([{...item,reconciledAt:undefined}]));
  assert.throws(()=>getLocalHolding(manifest,()=>true,{dataRoot:dir}),/RECONCILIATION_INCOMPLETE/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('local holdings reject unavailable sources and duplicate manifest entries',()=>{
 const dir=mkdtempSync(join(tmpdir(),'tsm-hold-dup-'));
 try{
  const entry={id:'nfhl',county:'18129',authority:'FEMA',vintage:'v',url:'https://msc.fema.gov/example',retrievedAt:'2026-10-23T00:00:00Z',path:'zones.geojson',sha256:'0'.repeat(64),bytes:5,features:0,status:'unavailable'};
  const manifest=join(dir,'manifest.json');
  writeFileSync(manifest,JSON.stringify([entry]));
  assert.throws(()=>getLocalHolding(manifest,()=>true,{dataRoot:dir}),/NOT_ACQUIRED/);
  writeFileSync(manifest,JSON.stringify([entry,entry]));
  assert.throws(()=>listLocalHoldings(manifest),/DUPLICATE_ENTRY/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('pinned snapshots reject filename traversal even if a manifest claims it',()=>{
 const dir=mkdtempSync(join(tmpdir(),'tsm-pinned-path-'));
 try {
  writeFileSync(join(dir,'manifest.json'),JSON.stringify([{name:'../outside.json',sourceId:'noaa-nwps',description:'unsafe',url:'https://api.water.noaa.gov/',retrievedAt:'2026-10-23T00:00:00Z',sha256:'0'.repeat(64),mediaType:'application/json',bytes:1}]));
  assert.throws(()=>listPinnedSnapshots(dir),/UNSAFE_NAME/);
  assert.throws(()=>loadPinnedSnapshot('noaa-nwps','../outside.json',dir),/UNSAFE_NAME/);
 }finally {rmSync(dir,{recursive:true,force:true});}
});
