import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { ingestGovernmentJson } from '../../packages/government/src/liveIngestion.ts';
import { assertPromotableSnapshot } from '../../packages/government/src/ingestion.ts';

test('agency JSON can be ingested as hash-bound immutable UNVERIFIED snapshot',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'tsm-gov-ingest-'));
 const url='https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer?f=json';
 const payload={layers:[{id:1,name:'source metadata'}]};
 const fetcher=async()=>new Response(JSON.stringify(payload),{status:200,headers:{'content-type':'application/json'}});
 try {
  const result=await ingestGovernmentJson({sourceId:'fema-nfhl',url,datasetId:'fema-catalog-test',
   sourceVersion:'mock-1',attribution:'FEMA',license:'Public domain, metadata review pending',
   horizontalCrs:'EPSG:4326',outputDirectory:dir},{fetcher:fetcher as typeof fetch});
  const bytes=await readFile(result.bytesPath);
  const envelope=JSON.parse(await readFile(result.envelopePath,'utf8'));
  const manifest=JSON.parse(await readFile(result.manifestPath,'utf8'));
  assert.equal(JSON.parse(bytes.toString()).layers[0].id,1);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.sha256);
  assert.equal(envelope.provenance.status,'UNVERIFIED');
  assert.equal(manifest.validationStatus,'UNVERIFIED');
  assert.throws(()=>assertPromotableSnapshot(manifest),/SNAPSHOT_PROMOTION_REQUIRES_VALIDATION_PASS/);
  await assert.rejects(ingestGovernmentJson({sourceId:'fema-nfhl',url,datasetId:'fema-catalog-test',
   sourceVersion:'mock-1',attribution:'FEMA',license:'Public domain, metadata review pending',
   horizontalCrs:'EPSG:4326',outputDirectory:dir},{fetcher:fetcher as typeof fetch}),/EEXIST/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('agency snapshots refuse foreign endpoints',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'tsm-gov-ingest-'));
 try{await assert.rejects(ingestGovernmentJson({sourceId:'fema-nfhl',url:'https://example.com/steal',
  datasetId:'reject',sourceVersion:'test',attribution:'FEMA',license:'test',outputDirectory:dir},
  {fetcher:(async()=>{throw new Error('fetch must not occur')}) as typeof fetch}),/GOVERNMENT_URL_OUTSIDE_REGISTERED_ENDPOINT/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
