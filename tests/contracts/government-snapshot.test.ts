import test from 'node:test';
import assert from 'node:assert/strict';
import { createSnapshotManifest, assertPromotableSnapshot } from '../../packages/government/src/ingestion.ts';
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
