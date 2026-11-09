/** Display-only resilience policy. Engineering authority is never inferred from an old archive.
 * A government snapshot can be used for historical *viewing* when its release
 * validation receipt is present and its version/date/CRS are consistent.
 */
export type GovernmentSnapshotPresentation = 'CURRENT_GOVERNMENT_SNAPSHOT'|'HISTORICAL_GOVERNMENT_FALLBACK'|'NO_GOVERNMENT_SNAPSHOT';
export interface GovernmentSnapshotDescriptor {
  agency:string;
  capturedAt:string;
  sourceRecordUrl:string;
  manifestUrl:string;
  archiveUrl:string;
}
export interface GovernmentReleaseReceipt {
  validation:string;
  tilesSha256:string;
  sourceSha256:string;
  sourceVersion?:string;
  acquiredAt?:string;
  capturedAt?:string;
  merkleRootSha256?:string;
  releaseVerification?:{
    status:string;
    archiveSha256:string;
    sourceSha256:string;
    merkleRootSha256:string;
    verifiedAt:string;
  };
}
const SHA = /^[a-f0-9]{64}$/;
export const ALLOWED_GOVERNMENT_AGENCIES = new Set([
  'FEMA','USGS','NOAA','NWS','USACE','INDIANA GIO','INDIANA DNR',
  'ILLINOIS DNR','KENTUCKY GIS',
]);
export function parseGovDate(value:string):number {
  if(typeof value!=='string'||!/^(\d{4}-\d\d-\d\d)T/.test(value)||!/(Z|[+-]\d\d:\d\d)$/.test(value))return NaN;
  return Date.parse(value);
}
export function isVerifiedHistoricalSnapshot(descriptor:GovernmentSnapshotDescriptor,
                                             receipt:GovernmentReleaseReceipt,
                                             now=Date.now(),
                                             trustedMerkleRoots:ReadonlySet<string>=new Set()):boolean {
  if(!descriptor||!receipt) return false;
  const agency=descriptor.agency?.trim().toUpperCase();
  if(!ALLOWED_GOVERNMENT_AGENCIES.has(agency))return false;
  const captured=parseGovDate(descriptor.capturedAt);
  const verification=receipt.releaseVerification;
  if(!Number.isFinite(captured)||captured>now||
     receipt.validation!=='VERIFIED'||!SHA.test(receipt.tilesSha256)||!SHA.test(receipt.sourceSha256)||
     !SHA.test(receipt.merkleRootSha256??'')||!trustedMerkleRoots.has(receipt.merkleRootSha256??'')||!verification||
     verification.status!=='PASS'||verification.archiveSha256!==receipt.tilesSha256||
     verification.sourceSha256!==receipt.sourceSha256||
     verification.merkleRootSha256!==receipt.merkleRootSha256) return false;
  const verifiedAt=parseGovDate(verification.verifiedAt);
  const manifestCaptured=parseGovDate(receipt.capturedAt??receipt.acquiredAt??'');
  if(!Number.isFinite(verifiedAt)||verifiedAt>now||
     !Number.isFinite(manifestCaptured)||manifestCaptured!==captured)return false;
  if(!receipt.sourceVersion?.trim())return false;
  try {
    const source=new URL(descriptor.sourceRecordUrl);
    if(source.protocol!=='https:'||!!source.username||!!source.password)return false;
  } catch {return false; }
  // This verifies a release receipt's consistency, not the archive bytes in the
  // browser. Release CI MUST verify raw PMTiles before issuing this receipt.
  return true;
}

export function snapshotIsStale(capturedAt:string,now=Date.now(),maxAgeDays=30):boolean{
  const timestamp=parseGovDate(capturedAt);
  return !Number.isFinite(timestamp)||timestamp>now||
    now-timestamp>maxAgeDays*86_400_000;
}

/** Roots must be distributed with a reviewed build, not accepted from an HTTP manifest. */
export function parseTrustedMerkleRoots(value:string|undefined):ReadonlySet<string> {
  if(!value)return new Set();
  return new Set(value.split(',').map(v=>v.trim()).filter(v=>SHA.test(v)));
}
