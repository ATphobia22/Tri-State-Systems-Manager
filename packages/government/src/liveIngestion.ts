import { mkdir,open,readFile,rm } from 'node:fs/promises';
import { join,resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { getGovernmentSource,queryGovernmentJson,validateEvidenceEnvelope,type EvidenceEnvelope } from './index.ts';
import { createSnapshotManifest,type GovernmentSnapshotManifest } from './ingestion.ts';

/**
 * Read-only agency ingestion -> immutable, content-hashed local snapshot.
 * A transport response is never automatically promoted to PASS/REGULATORY.
 * Run on connected ingestion host; offline UE runtime reads only staged files.
 */
export interface IngestRequest {
 readonly sourceId:string;readonly url:string;readonly datasetId:string;
 readonly sourceVersion:string;readonly attribution:string;readonly license:string;
 readonly horizontalCrs?:string;readonly verticalDatum?:string;readonly acquisitionDate?:string;
 readonly outputDirectory:string;
}
export interface IngestedSnapshot {
 readonly bytesPath:string; readonly manifestPath:string; readonly envelopePath:string;
 readonly manifest:GovernmentSnapshotManifest;
}
const ID=/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const digest=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');

export async function ingestGovernmentJson(request:IngestRequest,options:{fetcher?:typeof fetch;timeoutMs?:number}={}):Promise<IngestedSnapshot> {
 if(!ID.test(request.datasetId))throw new Error('INGEST_DATASET_ID_INVALID');
 if(!request.attribution?.trim()||!request.license?.trim()||!request.sourceVersion?.trim())
  throw new Error('INGEST_SOURCE_METADATA_REQUIRED');
 const source=getGovernmentSource(request.sourceId);
 if(source.access!=='REST_JSON')throw new Error('INGEST_REQUIRES_SPECIALIZED_ADAPTER');
 const evidence:EvidenceEnvelope<unknown>=await queryGovernmentJson(request.sourceId,request.url,options);
 const issues=validateEvidenceEnvelope(evidence);
 if(issues.length)throw new Error('INGEST_EVIDENCE_INVALID: '+issues.join('; '));
 // Canonical source response is serialized for replay. Its evidence hash covers raw HTTP
 // response bytes; this snapshot hash covers normalized JSON serialization instead.
 const bytes=new TextEncoder().encode(JSON.stringify(evidence.result));
 const manifest=createSnapshotManifest({
  datasetId:request.datasetId,authority:source.authority,sourceUrl:request.url,
  retrievedAt:evidence.evidence[0].retrievedAt,sourceVersion:request.sourceVersion,
  mediaType:'application/json',attribution:request.attribution,license:request.license,
  horizontalCrs:request.horizontalCrs,verticalDatum:request.verticalDatum,
  acquisitionDate:request.acquisitionDate,schemaVersion:'1.0.0',
  validationStatus:'UNVERIFIED',bytes
 });
 // Never label source data valid merely because HTTP succeeded.
 const dir=resolve(request.outputDirectory);await mkdir(dir,{recursive:true});
 const prefix=join(dir,request.datasetId+'-'+digest(bytes));
 const bytesPath=prefix+'.json',manifestPath=prefix+'.manifest.json',envelopePath=prefix+'.evidence.json';
 const written:string[]=[];
 try {
  for(const [file,content] of [[bytesPath,bytes],[manifestPath,new TextEncoder().encode(JSON.stringify(manifest,null,2)+'\n')],[envelopePath,new TextEncoder().encode(JSON.stringify(evidence,null,2)+'\n')]] as const) {
   const fd=await open(file,'wx',0o600);
   try{await fd.writeFile(content);await fd.sync();written.push(file);}finally{await fd.close();}
  }
 }catch(error){await Promise.all(written.map(file=>rm(file,{force:true})));throw error;}
 // Verify persisted bytes before advertising their path.
 if(digest(new Uint8Array(await readFile(bytesPath)))!==manifest.sha256)throw new Error('INGEST_DISK_HASH_MISMATCH');
 return{bytesPath,manifestPath,envelopePath,manifest};
}
