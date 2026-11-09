import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isVerifiedHistoricalSnapshot,
  parseTrustedMerkleRoots,
  snapshotIsStale,
  parseGovDate
} from '../src/lib/government-snapshot-policy.ts';

const H='a'.repeat(64);
const S='b'.repeat(64);
const R='c'.repeat(64);
const now=Date.parse('2026-11-09T08:00:00Z');
const descriptor={
  agency:'USGS',
  capturedAt:'2024-04-01T00:00:00Z',
  sourceRecordUrl:'https://www.usgs.gov/',
  manifestUrl:'https://data.example.gov/manifest.json',
  archiveUrl:'https://data.example.gov/verified.pmtiles'
};
const receipt={
  validation:'VERIFIED',sourceVersion:'2024-04',capturedAt:descriptor.capturedAt,
  tilesSha256:H,sourceSha256:S,merkleRootSha256:R,
  releaseVerification:{
    status:'PASS',archiveSha256:H,sourceSha256:S,merkleRootSha256:R,
    verifiedAt:'2026-11-08T12:00:00Z'
  }
};
test('older official source is allowed for visualization when Merkle root is build-pinned',()=>{
  assert.equal(isVerifiedHistoricalSnapshot(descriptor,receipt,now,new Set([R])),true);
  assert.equal(snapshotIsStale(descriptor.capturedAt,now),true);
});
test('historical archive cannot self-assert a trusted Merkle root',()=>{
  assert.equal(isVerifiedHistoricalSnapshot(descriptor,receipt,now),false);
  assert.equal(isVerifiedHistoricalSnapshot(descriptor,receipt,now,new Set([H])),false);
  assert.equal(isVerifiedHistoricalSnapshot(descriptor,{...receipt,validation:'BUILT_NOT_FIELD_VERIFIED'},now,new Set([R])),false);
});
test('missing or altered release verification is rejected without disabling map',()=>{
  assert.equal(isVerifiedHistoricalSnapshot(descriptor,{...receipt,releaseVerification:undefined},now,new Set([R])),false);
  assert.equal(isVerifiedHistoricalSnapshot(descriptor,{...receipt,releaseVerification:{...receipt.releaseVerification,archiveSha256:S}},now,new Set([R])),false);
  assert.equal(isVerifiedHistoricalSnapshot({...descriptor,agency:'UNTRUSTED_CORPORATION'},receipt,now,new Set([R])),false);
});
test('source capture date, source URI and release date are independently checked',()=>{
  assert.equal(isVerifiedHistoricalSnapshot({...descriptor,capturedAt:'2023-01-01T00:00:00Z'},receipt,now,new Set([R])),false);
  assert.equal(isVerifiedHistoricalSnapshot({...descriptor,sourceRecordUrl:'http://example.com'},receipt,now,new Set([R])),false);
  assert.equal(isVerifiedHistoricalSnapshot(descriptor,{...receipt,releaseVerification:{...receipt.releaseVerification,verifiedAt:'2027-01-01T00:00:00Z'}},now,new Set([R])),false);
});
test('clock and stale classification never promote old data to current',()=>{
  assert.equal(snapshotIsStale('2026-11-08T08:00:00Z',now),false);
  assert.equal(snapshotIsStale('2026-08-01T00:00:00Z',now),true);
  assert.equal(snapshotIsStale('not a date',now),true);
  assert.equal(Number.isNaN(parseGovDate('2026-11-08')),true);
});
test('only valid trusted roots are kept',()=>{
  assert.deepEqual([...parseTrustedMerkleRoots(' '+R+',no,'+H+' ')],[R,H]);
  assert.equal(parseTrustedMerkleRoots(undefined).size,0);
});
