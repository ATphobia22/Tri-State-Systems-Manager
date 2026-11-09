import {describe,expect,it} from 'vitest';
import {
  isVerifiedHistoricalSnapshot,snapshotIsStale,parseGovDate,
  type GovernmentSnapshotDescriptor, type GovernmentReleaseReceipt,
} from '../src/lib/government-snapshot-policy';

const hash = (c:string) => c.repeat(64);
const descriptor:GovernmentSnapshotDescriptor = {
  agency:'USGS',
  capturedAt:'2026-09-01T12:00:00Z',
  sourceRecordUrl:'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer',
  manifestUrl:'/data/archive.manifest.json',
  archiveUrl:'/data/archive.pmtiles',
};
const receipt:GovernmentReleaseReceipt = {
  validation:'VERIFIED',tilesSha256:hash('a'),sourceSha256:hash('b'),
  sourceVersion:'USGS-3DEP-historical-2026-09',
  capturedAt:descriptor.capturedAt, merkleRootSha256:hash('c'),
  releaseVerification:{
    status:'PASS',archiveSha256:hash('a'),sourceSha256:hash('b'),
    merkleRootSha256:hash('c'),verifiedAt:'2026-09-04T12:00:00Z',
  },
};
const now=Date.parse('2026-11-09T06:00:00Z');

describe('missing/stale government source leaves the twin usable',()=>{
  it('classifies old, dated data as stale without changing its declared agency',()=>{
    expect(snapshotIsStale(descriptor.capturedAt,now,30)).toBe(true);
    expect(snapshotIsStale('2026-11-08T12:00:00Z',now,30)).toBe(false);
  });
  it('admits a dated receipt only when provenance and SHA bindings agree',()=>{
    // A historical archive may only be admitted by a reviewed build-pinned trust root.
    expect(isVerifiedHistoricalSnapshot(descriptor,receipt,now)).toBe(false);
    const trustedRoots = new Set([hash('c')]);
    expect(isVerifiedHistoricalSnapshot(descriptor,receipt,now,trustedRoots)).toBe(true);
    expect(isVerifiedHistoricalSnapshot(descriptor,{
      ...receipt,releaseVerification:{...receipt.releaseVerification!,archiveSha256:hash('d')},
    },now,trustedRoots)).toBe(false);
    expect(isVerifiedHistoricalSnapshot(descriptor,{
      ...receipt,capturedAt:'2026-10-01T12:00:00Z',
    },now,trustedRoots)).toBe(false);
  });
  it('rejects unknown issuer, future acquisition and absent release evidence',()=>{
    expect(isVerifiedHistoricalSnapshot({...descriptor,agency:'PRIVATE_COMPANY'},receipt,now)).toBe(false);
    expect(isVerifiedHistoricalSnapshot({...descriptor,capturedAt:'2027-01-01T00:00:00Z'},receipt,now)).toBe(false);
    expect(isVerifiedHistoricalSnapshot(descriptor,{...receipt,releaseVerification:undefined},now)).toBe(false);
  });
  it('requires timezone-bearing recorded capture dates',()=>{
    expect(Number.isNaN(parseGovDate('2026-09-01T12:00:00'))).toBe(true);
    expect(Number.isNaN(parseGovDate('unknown'))).toBe(true);
  });
});
