import test from 'node:test';
import assert from 'node:assert/strict';
import { createSnapshotManifest, assertPromotableSnapshot, createDatasetAttestation } from '../../packages/government/src/ingestion.ts';
test('snapshot manifest hashes bytes and preserves source attribution',()=>{
 const manifest=createSnapshotManifest({datasetId:'sample',authority:'USGS',sourceUrl:'https://example.gov/data',retrievedAt:'2026-10-23T00:00:00Z',sourceVersion:'2026-10',mediaType:'application/octet-stream',attribution:'USGS',license:'Public domain',horizontalCrs:'EPSG:4326',verticalDatum:'NAVD88',acquisitionDate:'2026-01-01',schemaVersion:'1',validationStatus:'PASS',bytes:new TextEncoder().encode('source bytes')});
 assert.equal(manifest.byteLength,12);
 assert.match(manifest.sha256,/^[a-f0-9]{64}$/);
 assert.doesNotThrow(()=>assertPromotableSnapshot(manifest));
});
test('snapshot promotion fails closed without PASS and geospatial metadata',()=>{
 const manifest=createSnapshotManifest({datasetId:'sample',authority:'USGS',sourceUrl:'https://example.gov/data',retrievedAt:'2026-10-23T00:00:00Z',sourceVersion:'2026-10',mediaType:'application/octet-stream',attribution:'USGS',license:'Public domain',schemaVersion:'1',validationStatus:'UNVERIFIED',bytes:new TextEncoder().encode('data')});
 assert.throws(()=>assertPromotableSnapshot(manifest),/REQUIRES_VALIDATION_PASS/);
});

test('dataset attestation creates deterministic metadata feature dataset evidence and attestation hashes',()=>{
 const input={sourceId:'fema.nfhl',datasetVersion:'2026-10',retrievedAt:'2026-10-23T00:00:00Z',metadata:{crs:'EPSG:4326',geometryType:'Polygon'},features:[{id:2,value:'b'},{id:1,value:'a'}],validatorVersion:'1.0.0'};
 const first=createDatasetAttestation(input);const second=createDatasetAttestation({...input,features:[...input.features].reverse()});
 assert.deepEqual(first,second);
 for(const hash of [first.metadataHash,first.datasetHash,first.evidenceHash,first.attestationHash,...first.featureHashes])assert.match(hash,/^[a-f0-9]{64}$/);
 assert.equal(first.featureCount,2);
 assert.notEqual(first.datasetHash,createDatasetAttestation({...input,features:[...input.features,{id:3,value:'c'}]}).datasetHash);
});
