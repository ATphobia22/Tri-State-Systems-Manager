import { createHash } from 'node:crypto';
export interface GovernmentSnapshotManifest {
 readonly datasetId:string;readonly authority:string;readonly sourceUrl:string;readonly retrievedAt:string;
 readonly sourceVersion:string;readonly mediaType:string;readonly byteLength:number;readonly sha256:string;
 readonly attribution:string;readonly license:string;readonly horizontalCrs?:string;readonly verticalDatum?:string;
 readonly acquisitionDate?:string;readonly schemaVersion:string;readonly validationStatus:'PASS'|'FAIL'|'UNVERIFIED';
}
export function createSnapshotManifest(input:Omit<GovernmentSnapshotManifest,'sha256'|'byteLength'> & {readonly bytes:Uint8Array}):GovernmentSnapshotManifest {
 const url=new URL(input.sourceUrl);
 if(url.protocol!=='https:')throw new Error('SNAPSHOT_SOURCE_MUST_USE_HTTPS');
 if(!input.datasetId.trim()||!input.authority.trim()||!input.sourceVersion.trim()||!input.schemaVersion.trim())throw new Error('SNAPSHOT_IDENTITY_FIELDS_REQUIRED');
 if(!Number.isFinite(Date.parse(input.retrievedAt)))throw new Error('SNAPSHOT_RETRIEVAL_TIME_INVALID');
 if(!input.attribution.trim()||!input.license.trim())throw new Error('SNAPSHOT_ATTRIBUTION_AND_LICENSE_REQUIRED');
 if(input.bytes.byteLength===0)throw new Error('EMPTY_SNAPSHOT_REJECTED');
 const sha256=createHash('sha256').update(input.bytes).digest('hex');
 return {datasetId:input.datasetId,authority:input.authority,sourceUrl:url.toString(),retrievedAt:input.retrievedAt,sourceVersion:input.sourceVersion,mediaType:input.mediaType,byteLength:input.bytes.byteLength,sha256,attribution:input.attribution,license:input.license,horizontalCrs:input.horizontalCrs,verticalDatum:input.verticalDatum,acquisitionDate:input.acquisitionDate,schemaVersion:input.schemaVersion,validationStatus:input.validationStatus};
}
export function assertPromotableSnapshot(manifest:GovernmentSnapshotManifest):void {
 if(manifest.validationStatus!=='PASS')throw new Error('SNAPSHOT_PROMOTION_REQUIRES_VALIDATION_PASS');
 if(!/^[a-f0-9]{64}$/.test(manifest.sha256))throw new Error('SNAPSHOT_SHA256_INVALID');
 if(!manifest.horizontalCrs)throw new Error('SNAPSHOT_HORIZONTAL_CRS_REQUIRED');
 if(!manifest.acquisitionDate)throw new Error('SNAPSHOT_ACQUISITION_DATE_REQUIRED');
}

function canonicalJson(value:unknown):string {
 if(value===null||typeof value!=='object')return JSON.stringify(value)??'null';
 if(Array.isArray(value))return '['+value.map(canonicalJson).join(',')+']';
 const record=value as Record<string,unknown>;
 return '{'+Object.keys(record).sort().map(key=>JSON.stringify(key)+':'+canonicalJson(record[key])).join(',')+'}';
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
