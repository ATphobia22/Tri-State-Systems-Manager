import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep, win32 } from 'node:path';
import { getGovernmentSource, sha256, type EvidenceEnvelope, type GovernmentAuthority } from './index.ts';

export interface LocalHoldingsManifestEntry {
 readonly id:string;readonly county:string;readonly authority:string;readonly vintage:string;
 readonly url:string;readonly retrievedAt:string;readonly path:string;readonly sha256:string;
 readonly bytes:number;readonly features:number;readonly status:string;readonly note?:string;
 /** Supersedes the original digest and length only if all reconciliation metadata are supplied. */
 readonly bytes_reconciled?:number;readonly sha256_reconciled?:string;readonly reconciledAt?:string;
}
export interface LocalHoldingsOptions {
 /** Root directory the manifest's relative paths resolve against. Defaults to TSM_OFFLINE_DATA_ROOT. */
 dataRoot?:string;manifestPath?:string;
}
export interface VerifiedLocalArchive {
 readonly kind:'LOCAL_ARCHIVE_REFERENCE';
 readonly sourceId:string;
 readonly relativePath:string;
 readonly mediaType:'application/zip';
 readonly byteLength:number;
 readonly sha256:string;
 /** The archive contents have NOT been extracted or independently validated. */
 readonly contentsValidated:false;
}

const SHA256=/^[a-f0-9]{64}$/;
function resolveDataRoot(options:LocalHoldingsOptions):string {
 const root=options.dataRoot??process.env.TSM_OFFLINE_DATA_ROOT;
 if(!root||!root.trim())throw new Error('LOCAL_HOLDINGS_ROOT_NOT_CONFIGURED: set dataRoot or TSM_OFFLINE_DATA_ROOT');
 return resolve(root);
}
function readManifest(manifestPath:string):LocalHoldingsManifestEntry[] {
 const parsed:unknown=JSON.parse(readFileSync(manifestPath,'utf8'));
 if(!Array.isArray(parsed))throw new Error('LOCAL_HOLDINGS_MANIFEST_INVALID:'+manifestPath);
 const ids=new Set<string>();
 for(const item of parsed) {
  if(!item||typeof item!=='object'||typeof item.id!=='string'||!item.id.trim())throw new Error('LOCAL_HOLDINGS_MANIFEST_ENTRY_INVALID');
  if(ids.has(item.id))throw new Error('LOCAL_HOLDINGS_DUPLICATE_ENTRY:'+item.id);
  ids.add(item.id);
 }
 return parsed as LocalHoldingsManifestEntry[];
}
function insideRoot(root:string,candidate:string):boolean {
 const rel=relative(root,candidate);
 return rel!==''&&rel!=='..'&&!rel.startsWith('..'+sep)&&!isAbsolute(rel);
}
function resolveHoldingPath(root:string,entry:LocalHoldingsManifestEntry):string {
 const p=entry.path;
 if(typeof p!=='string'||!p.trim()||p.includes('\\')||/[\x00-\x1f]/.test(p)||isAbsolute(p)||win32.isAbsolute(p)||p.split('/').some(part=>part==='..'||part==='.'||part==='')) {
  throw new Error('LOCAL_HOLDINGS_UNSAFE_PATH:'+entry.id);
 }
 const candidate=resolve(root,p);
 if(!insideRoot(root,candidate))throw new Error('LOCAL_HOLDINGS_UNSAFE_PATH:'+entry.id);
 if(!existsSync(candidate))throw new Error('LOCAL_HOLDINGS_NOT_PRESENT:'+candidate);
 // Resolve symlinks before reading: lexical path confinement is insufficient.
 const realRoot=realpathSync(root);
 const realFile=realpathSync(candidate);
 if(!insideRoot(realRoot,realFile))throw new Error('LOCAL_HOLDINGS_SYMLINK_OUTSIDE_ROOT:'+entry.id);
 if(!statSync(realFile).isFile())throw new Error('LOCAL_HOLDINGS_NOT_A_FILE:'+entry.id);
 return realFile;
}
function sourceFor(entry:LocalHoldingsManifestEntry):{sourceId:string;authority:GovernmentAuthority} {
 const authority=entry.authority.toUpperCase();
 let sourceId:string;
 if(authority.includes('FEMA')) sourceId='fema-nfhl';
 else if(authority.includes('USDA')&&authority.includes('NRCS')) sourceId='usda-soils';
 else throw new Error('LOCAL_HOLDINGS_SOURCE_NOT_REGISTERED:'+entry.id);
 const source=getGovernmentSource(sourceId);
 return {sourceId,authority:source.authority};
}
function expectedIntegrity(entry:LocalHoldingsManifestEntry):{bytes:number;hash:string} {
 const reconciled=entry.sha256_reconciled!==undefined||entry.bytes_reconciled!==undefined||entry.reconciledAt!==undefined;
 if(reconciled&&(!entry.sha256_reconciled||entry.bytes_reconciled===undefined||!entry.reconciledAt||!Number.isFinite(Date.parse(entry.reconciledAt)))) {
  throw new Error('LOCAL_HOLDINGS_RECONCILIATION_INCOMPLETE:'+entry.id);
 }
 const bytes=reconciled?entry.bytes_reconciled!:entry.bytes;
 const hash=reconciled?entry.sha256_reconciled!:entry.sha256;
 if(!Number.isSafeInteger(bytes)||bytes<=0||typeof hash!=='string'||!SHA256.test(hash))throw new Error('LOCAL_HOLDINGS_DECLARED_INTEGRITY_INVALID:'+entry.id);
 return {bytes,hash};
}

/**
 * Read a local government holding only after manifest provenance and the exact file bytes
 * are verified. Hash verification is NOT equivalent to geospatial, scientific, or
 * regulatory validation. The envelope therefore remains UNVERIFIED.
 *
 * GeoJSON and JSON holdings return parsed JSON; ZIP holdings return an explicit
 * verified-byte *archive reference*, never fabricated parsed geospatial features.
 */
export function getLocalHolding(manifestPath:string,match:(entry:LocalHoldingsManifestEntry)=>boolean,options:LocalHoldingsOptions={}):EvidenceEnvelope<unknown> {
 const root=resolveDataRoot(options);
 const entry=readManifest(manifestPath).find(match);
 if(!entry)throw new Error('LOCAL_HOLDINGS_ENTRY_NOT_FOUND');
 if(entry.status!=='acquired'&&entry.status!=='acquired-from-cache')throw new Error('LOCAL_HOLDINGS_NOT_ACQUIRED:'+entry.id);
 if(typeof entry.vintage!=='string'||!entry.vintage.trim())throw new Error('LOCAL_HOLDINGS_VINTAGE_REQUIRED:'+entry.id);
 if(!Number.isFinite(Date.parse(entry.retrievedAt)))throw new Error('LOCAL_HOLDINGS_RETRIEVAL_TIME_INVALID:'+entry.id);
 let url:URL;
 try { url=new URL(entry.url); } catch { throw new Error('LOCAL_HOLDINGS_SOURCE_URL_INVALID:'+entry.id); }
 if(url.protocol!=='https:'||url.username||url.password||url.hash)throw new Error('LOCAL_HOLDINGS_SOURCE_URL_UNSAFE:'+entry.id);
 const {sourceId,authority}=sourceFor(entry);
 const filePath=resolveHoldingPath(root,entry);
 const bytes=readFileSync(filePath);
 const actual=createHash('sha256').update(bytes).digest('hex');
 const expected=expectedIntegrity(entry);
 if(bytes.byteLength!==expected.bytes)throw new Error('LOCAL_HOLDINGS_BYTE_LENGTH_MISMATCH:'+entry.id);
 if(actual!==expected.hash)throw new Error('LOCAL_HOLDINGS_HASH_MISMATCH:'+entry.id);
 let result:unknown;
 let mediaType:string;
 if(entry.path.toLowerCase().endsWith('.geojson')||entry.path.toLowerCase().endsWith('.json')) {
  mediaType=entry.path.toLowerCase().endsWith('.geojson')?'application/geo+json':'application/json';
  let decoded:string;
  try { decoded=new TextDecoder('utf-8',{fatal:true}).decode(bytes);result=JSON.parse(decoded); }
  catch {throw new Error('LOCAL_HOLDINGS_INVALID_JSON:'+entry.id);}
  if(mediaType==='application/geo+json') {
   if(!result||typeof result!=='object'||(result as {type?:unknown}).type!=='FeatureCollection'||!Array.isArray((result as {features?:unknown}).features))throw new Error('LOCAL_HOLDINGS_INVALID_GEOJSON:'+entry.id);
   const count=(result as {features:unknown[]}).features.length;
   if(!Number.isSafeInteger(entry.features)||entry.features!==count)throw new Error('LOCAL_HOLDINGS_FEATURE_COUNT_MISMATCH:'+entry.id);
  }
 } else if(entry.path.toLowerCase().endsWith('.zip')) {
  mediaType='application/zip';
  result={kind:'LOCAL_ARCHIVE_REFERENCE',sourceId,relativePath:entry.path,mediaType,byteLength:bytes.byteLength,sha256:actual,contentsValidated:false} satisfies VerifiedLocalArchive;
 } else {
  throw new Error('LOCAL_HOLDINGS_UNSUPPORTED_MEDIA_TYPE:'+entry.id);
 }
 const traceId=randomUUID();
 const generatedAt=new Date().toISOString();
 const inputHash=sha256({id:entry.id,sourceId,sourceUrl:url.toString(),retrievedAt:entry.retrievedAt,vintage:entry.vintage,fileHash:actual});
 const outputHash=sha256(result);
 return {
  result,traceId,hash:outputHash,
  citations:[{url:url.toString(),title:entry.authority+' (locally held; SHA-256 verified; independent validation pending)',retrievedAt:entry.retrievedAt}],
  evidence:[{sourceId,authority,retrievedAt:entry.retrievedAt,sha256:actual,mediaType}],
  provenance:{traceId,provider:sourceId,providerVersion:'local-holdings-v2',generatedAt,inputHash,outputHash,status:'UNVERIFIED'},
  hashes:{input:inputHash,output:outputHash}
 };
}
export function listLocalHoldings(manifestPath:string):LocalHoldingsManifestEntry[] {
 return readManifest(manifestPath);
}
