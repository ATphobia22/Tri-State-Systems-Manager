import test from 'node:test';
import assert from 'node:assert/strict';
import { GOVERNMENT_SOURCES, getGovernmentSource, queryGovernmentJson, validateEvidenceEnvelope, sha256 } from '../../packages/government/src/index.ts';
import { researchSearch, type ResearchProvider } from '../../packages/research/src/government-research-fabric.ts';
import { GovernmentDataProvider } from '../../packages/government/src/GovernmentDataProvider.ts';

test('government source registry covers required authorities and uses HTTPS',()=>{
 const authorities=new Set(GOVERNMENT_SOURCES.map(s=>s.authority));
 for(const id of ['FEMA','USGS','NOAA','CENSUS','EPA','USDA','DOT','USACE'])assert.ok(authorities.has(id as never));
 for(const source of GOVERNMENT_SOURCES)assert.equal(new URL(source.endpoint).protocol,'https:');
 assert.equal(getGovernmentSource('usgs-hydrography').endpoint,'https://hydro.nationalmap.gov/arcgis/rest/services/3DHP_all/FeatureServer');
});
test('government adapter rejects arbitrary hosts, unsafe path prefixes, credentials, and unregistered source IDs',async()=>{
 await assert.rejects(()=>queryGovernmentJson('fema-nfhl','https://evil.example/MapServer'));
 await assert.rejects(()=>queryGovernmentJson('fema-nfhl','https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServerEvil'));
 await assert.rejects(()=>queryGovernmentJson('fema-nfhl','https://user:password@hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer'));
 assert.throws(()=>getGovernmentSource('unknown'),/NOT_REGISTERED/);
});
test('government adapter immediately honors an already-aborted caller signal',async()=>{
 const controller=new AbortController();controller.abort(new Error('cancelled'));
 let called=false;
 await assert.rejects(()=>queryGovernmentJson('fema-nfhl','https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer',{signal:controller.signal,fetcher:async()=>{called=true;return new Response('{}',{headers:{'content-type':'application/json'}});}}));
 assert.equal(called,false);
});
test('government adapter rejects invalid timeout values before making a request',async()=>{
 await assert.rejects(()=>queryGovernmentJson('fema-nfhl','https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer',{timeoutMs:true as unknown as number,fetcher:async()=>new Response('{}',{headers:{'content-type':'application/json'}})}),/INVALID_TIMEOUT_MS/);
});
test('government adapter returns stable hashes and provenance envelope',async()=>{
 const payload={layers:[{id:0,name:'NFHL'}]};
 const fetcher=async()=>new Response(JSON.stringify(payload),{status:200,headers:{'content-type':'application/json'}});
 const envelope=await queryGovernmentJson('fema-nfhl','https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer?f=pjson',{fetcher});
 assert.equal(envelope.hashes.output,sha256(payload));
 assert.deepEqual(validateEvidenceEnvelope(envelope),[]);
});
test('government adapter rejects non-JSON and oversized responses before parsing',async()=>{
 await assert.rejects(()=>queryGovernmentJson('fema-nfhl','https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer',{fetcher:async()=>new Response('html',{headers:{'content-type':'text/html'}})}),/NON_JSON/);
 await assert.rejects(()=>queryGovernmentJson('fema-nfhl','https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer',{fetcher:async()=>new Response('{}',{headers:{'content-type':'application/json','content-length':'25000001'}})}),/TOO_LARGE/);
});
test('research fabric marks retrieved sources unverified and validates source hashes',async()=>{
 const text='official source text';
 const provider:ResearchProvider={id:'government-api',async search(){return [{url:'https://example.gov/data',title:'Dataset',text,retrievedAt:'2026-10-23T00:00:00Z',provider:'government-api',sha256:sha256(text)}]}};
 const result=await researchSearch('test query',[provider]);
 assert.equal(result.evidence[0].confidence,'unverified');
 assert.equal(result.citations[0].url,'https://example.gov/data');
 assert.equal(result.hashes.output,result.provenance.outputHash);
});

test('UACF government provider advertises only the implemented NFHL capability',async()=>{ const provider=new GovernmentDataProvider(); assert.deepEqual(provider.capabilities.map(c=>c.id),['geo.nfhl.query']); assert.equal((await provider.supports('geo.nfhl.query',{layerId:28,where:'1=1'})).supported,true); assert.equal((await provider.supports('geo.nfhl.query',{layerId:999})).supported,false); assert.equal((await provider.supports('geo.dem.query',{layerId:28})).supported,false); });

test('canonical hashing rejects undefined and circular values instead of aliasing them to null',()=>{
 assert.throws(()=>sha256({missing:undefined}),/JSON_COMPATIBLE/);
 const circular:Record<string,unknown>={};circular.self=circular;
 assert.throws(()=>sha256(circular),/CIRCULAR/);
});
test('evidence envelope validation reports malformed citations instead of throwing',async()=>{
 const payload={layers:[{id:0,name:'NFHL'}]};
 const envelope=await queryGovernmentJson('fema-nfhl','https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer?f=pjson',{fetcher:async()=>new Response(JSON.stringify(payload),{status:200,headers:{'content-type':'application/json'}})});
 const malformed={...envelope,citations:[null as never]};
 assert.ok(validateEvidenceEnvelope(malformed).some(error=>error.includes('citations')));
});
test('research result hashing is invariant to provider ordering for duplicate URLs',async()=>{
 const textA='first source text',textB='second source text';
 const search:ResearchProvider={id:'search',async search(){return [{url:'https://example.gov/shared',title:'Shared A',text:textA,retrievedAt:'2026-10-23T00:00:00Z',provider:'search',sha256:sha256(textA)}]}};
 const government:ResearchProvider={id:'government-api',async search(){return [{url:'https://example.gov/shared',title:'Shared B',text:textB,retrievedAt:'2026-10-23T00:00:00Z',provider:'government-api',sha256:sha256(textB)}]}};
 const first=await researchSearch('stable query',[search,government]);
 const second=await researchSearch('stable query',[government,search]);
 assert.equal(first.hash,second.hash);
 assert.equal(first.evidence.length,1);
 assert.equal(first.evidence[0].sourceId,'government-api');
});
