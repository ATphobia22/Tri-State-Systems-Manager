import { createHash } from 'node:crypto';
export interface GovernmentSnapshotManifest {
 readonly datasetId:string;readonly authority:string;readonly sourceUrl:string;readonly retrievedAt:string;
 readonly sourceVersion:string;readonly mediaType:string;readonly byteLength:number;readonly sha256:string;
 readonly attribution:string;readonly license:string;readonly horizontalCrs?:string;readonly verticalDatum?:string;
 readonly acquisitionDate?:string;readonly schemaVersion:string;readonly validationStatus:'PASS'|'FAIL'|'UNVERIFIED';
}
export function createSnapshotManifest(input:Omit<GovernmentSnapshotManifest,'sha256'|'byteLength'> & {readonly bytes:Uint8Array}):GovernmentSnapshotManifest {
 let url:URL;
 try {url=new URL(input.sourceUrl);} catch {throw new Error('SNAPSHOT_SOURCE_URL_INVALID');}
 if(url.protocol!=='https:'||url.username||url.password)throw new Error('SNAPSHOT_SOURCE_MUST_USE_CREDENTIAL_FREE_HTTPS');
 if(!input.datasetId.trim()||!input.authority.trim()||!input.sourceVersion.trim()||!input.schemaVersion.trim())throw new Error('SNAPSHOT_IDENTITY_FIELDS_REQUIRED');
 if(!Number.isFinite(Date.parse(input.retrievedAt)))throw new Error('SNAPSHOT_RETRIEVAL_TIME_INVALID');
 if(!input.mediaType.trim())throw new Error('SNAPSHOT_MEDIA_TYPE_REQUIRED');
 if(!input.attribution.trim()||!input.license.trim())throw new Error('SNAPSHOT_ATTRIBUTION_AND_LICENSE_REQUIRED');
 if(!(input.bytes instanceof Uint8Array)||input.bytes.byteLength===0)throw new Error('EMPTY_OR_INVALID_SNAPSHOT_REJECTED');
 if(!['PASS','FAIL','UNVERIFIED'].includes(input.validationStatus))throw new Error('SNAPSHOT_VALIDATION_STATUS_INVALID');
 if(input.horizontalCrs!==undefined&&!input.horizontalCrs.trim())throw new Error('SNAPSHOT_HORIZONTAL_CRS_INVALID');
 if(input.verticalDatum!==undefined&&!input.verticalDatum.trim())throw new Error('SNAPSHOT_VERTICAL_DATUM_INVALID');
 if(input.acquisitionDate!==undefined&&!Number.isFinite(Date.parse(input.acquisitionDate)))throw new Error('SNAPSHOT_ACQUISITION_DATE_INVALID');
 const sha256=createHash('sha256').update(input.bytes).digest('hex');
 return {datasetId:input.datasetId,authority:input.authority,sourceUrl:url.toString(),retrievedAt:input.retrievedAt,sourceVersion:input.sourceVersion,mediaType:input.mediaType,byteLength:input.bytes.byteLength,sha256,attribution:input.attribution,license:input.license,horizontalCrs:input.horizontalCrs,verticalDatum:input.verticalDatum,acquisitionDate:input.acquisitionDate,schemaVersion:input.schemaVersion,validationStatus:input.validationStatus};
}
export function assertPromotableSnapshot(manifest:GovernmentSnapshotManifest):void {
 if(!manifest||typeof manifest!=='object')throw new Error('SNAPSHOT_MANIFEST_REQUIRED');
 if(manifest.validationStatus!=='PASS')throw new Error('SNAPSHOT_PROMOTION_REQUIRES_VALIDATION_PASS');
 if(!/^[a-f0-9]{64}$/.test(manifest.sha256))throw new Error('SNAPSHOT_SHA256_INVALID');
 if(!Number.isSafeInteger(manifest.byteLength)||manifest.byteLength<=0)throw new Error('SNAPSHOT_BYTE_LENGTH_INVALID');
 if(!manifest.datasetId?.trim()||!manifest.authority?.trim()||!manifest.sourceVersion?.trim()||!manifest.schemaVersion?.trim())throw new Error('SNAPSHOT_IDENTITY_FIELDS_REQUIRED');
 if(!Number.isFinite(Date.parse(manifest.retrievedAt)))throw new Error('SNAPSHOT_RETRIEVAL_TIME_INVALID');
 if(!manifest.mediaType?.trim())throw new Error('SNAPSHOT_MEDIA_TYPE_REQUIRED');
 if(!manifest.attribution?.trim()||!manifest.license?.trim())throw new Error('SNAPSHOT_ATTRIBUTION_AND_LICENSE_REQUIRED');
 let sourceUrl:URL;
 try {sourceUrl=new URL(manifest.sourceUrl);} catch {throw new Error('SNAPSHOT_SOURCE_URL_INVALID');}
 if(sourceUrl.protocol!=='https:'||sourceUrl.username||sourceUrl.password)throw new Error('SNAPSHOT_SOURCE_MUST_USE_CREDENTIAL_FREE_HTTPS');
 if(!manifest.horizontalCrs?.trim())throw new Error('SNAPSHOT_HORIZONTAL_CRS_REQUIRED');
 if(!manifest.acquisitionDate||!Number.isFinite(Date.parse(manifest.acquisitionDate)))throw new Error('SNAPSHOT_ACQUISITION_DATE_REQUIRED');
 if(manifest.verticalDatum!==undefined&&!manifest.verticalDatum.trim())throw new Error('SNAPSHOT_VERTICAL_DATUM_INVALID');
}

function canonicalJson(value:unknown,ancestors:WeakSet<object>=new WeakSet()):string {
 if(value===null)return 'null';
 if(typeof value==='string')return JSON.stringify(value);
 if(typeof value==='boolean')return value?'true':'false';
 if(typeof value==='number'){if(!Number.isFinite(value))throw new TypeError('CANONICAL_VALUE_MUST_BE_FINITE');return JSON.stringify(value);}
 if(typeof value!=='object')throw new TypeError('CANONICAL_VALUE_MUST_BE_JSON_COMPATIBLE');
 if(ancestors.has(value))throw new TypeError('CANONICAL_VALUE_MUST_NOT_BE_CIRCULAR');
 ancestors.add(value);
 try {
  if(Array.isArray(value))return '['+value.map(item=>canonicalJson(item,ancestors)).join(',')+']';
  const record=value as Record<string,unknown>;
  return '{'+Object.keys(record).sort().map(key=>JSON.stringify(key)+':'+canonicalJson(record[key],ancestors)).join(',')+'}';
 } finally {ancestors.delete(value);}
}
function hashCanonical(value:unknown):string{return createHash('sha256').update(canonicalJson(value)).digest('hex');}
export interface DatasetAttestationInput {
 readonly sourceId:string;readonly datasetVersion:string;readonly retrievedAt:string;
 readonly metadata:Readonly<Record<string,unknown>>;readonly features:readonly unknown[];
 readonly validatorVersion:string;readonly parentHash?:string;
}
export interface DatasetAttestation {
 readonly metadataHash:string;readonly featureHashes:readonly string[];readonly datasetHash:string;
 readonly evidenceHash:string;readonly attestationHash:string;readonly featureCount:number;
}
export function createDatasetAttestation(input:DatasetAttestationInput):DatasetAttestation {
 if(!input.sourceId.trim()||!input.datasetVersion.trim()||!input.validatorVersion.trim())throw new Error('ATTESTATION_IDENTITY_REQUIRED');
 if(!Number.isFinite(Date.parse(input.retrievedAt)))throw new Error('ATTESTATION_RETRIEVAL_TIME_INVALID');
 if(input.parentHash!==undefined&&!/^[a-f0-9]{64}$/.test(input.parentHash))throw new Error('ATTESTATION_PARENT_HASH_INVALID');
 const metadataHash=hashCanonical(input.metadata);
 const featureHashes=input.features.map(hashCanonical).sort();
 const datasetHash=hashCanonical({sourceId:input.sourceId,datasetVersion:input.datasetVersion,retrievedAt:input.retrievedAt,metadataHash,featureHashes});
 const evidenceHash=hashCanonical({sourceId:input.sourceId,retrievedAt:input.retrievedAt,datasetHash,metadataHash,validatorVersion:input.validatorVersion});
 const attestationHash=hashCanonical({sourceId:input.sourceId,datasetVersion:input.datasetVersion,retrievedAt:input.retrievedAt,metadataHash,featureHashes,datasetHash,evidenceHash,validatorVersion:input.validatorVersion,parentHash:input.parentHash??null});
 return {metadataHash,featureHashes,datasetHash,evidenceHash,attestationHash,featureCount:input.features.length};
}
