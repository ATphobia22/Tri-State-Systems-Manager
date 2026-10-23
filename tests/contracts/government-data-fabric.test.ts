import test from 'node:test';
import assert from 'node:assert/strict';
import { GOVERNMENT_SOURCES, getGovernmentSource, queryGovernmentJson, validateEvidenceEnvelope, sha256 } from '../../packages/government/src/index.ts';
import { researchSearch, type ResearchProvider } from '../../packages/research/src/government-research-fabric.ts';

test('government source registry covers required authorities and uses HTTPS',()=>{
 const authorities=new Set(GOVERNMENT_SOURCES.map(s=>s.authority));
 for(const id of ['FEMA','USGS','NOAA','CENSUS','EPA','USDA','DOT','USACE'])assert.ok(authorities.has(id as never));
 for(const source of GOVERNMENT_SOURCES)assert.equal(new URL(source.endpoint).protocol,'https:');
});
test('government adapter rejects arbitrary hosts and unregistered source IDs',async()=>{
 await assert.rejects(()=>queryGovernmentJson('fema-nfhl','https://evil.example/MapServer'));
 assert.throws(()=>getGovernmentSource('unknown'),/NOT_REGISTERED/);
});
test('government adapter returns stable hashes and provenance envelope',async()=>{
 const payload={layers:[{id:0,name:'NFHL'}]};
 const fetcher=async()=>new Response(JSON.stringify(payload),{status:200,headers:{'content-type':'application/json'}});
 const envelope=await queryGovernmentJson('fema-nfhl','https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer?f=pjson',{fetcher});
 assert.equal(envelope.hashes.output,sha256(payload));
 assert.deepEqual(validateEvidenceEnvelope(envelope),[]);
});
test('government adapter rejects non-JSON and oversized responses',async()=>{
 await assert.rejects(()=>queryGovernmentJson('fema-nfhl','https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer',{fetcher:async()=>new Response('html',{headers:{'content-type':'text/html'}})}),/NON_JSON/);
});
test('research fabric marks retrieved sources unverified and validates source hashes',async()=>{
 const text='official source text';
 const provider:ResearchProvider={id:'government-api',async search(){return [{url:'https://example.gov/data',title:'Dataset',text,retrievedAt:'2026-10-23T00:00:00Z',provider:'government-api',sha256:sha256(text)}]}};
 const result=await researchSearch('test query',[provider]);
 assert.equal(result.evidence[0].confidence,'unverified');
 assert.equal(result.citations[0].url,'https://example.gov/data');
 assert.equal(result.hashes.output,result.provenance.outputHash);
});
