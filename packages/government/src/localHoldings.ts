import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { wrapPinnedSnapshot, type EvidenceEnvelope } from './index.ts';

export interface LocalHoldingsManifestEntry {
 readonly id:string;readonly county:string;readonly authority:string;readonly vintage:string;
 readonly url:string;readonly retrievedAt:string;readonly path:string;readonly sha256:string;
 readonly bytes:number;readonly features:number;readonly status:string;readonly note?:string;
}
export interface LocalHoldingsOptions {
 /** Root directory the manifest's relative paths resolve against. Defaults to TSM_OFFLINE_DATA_ROOT. */
 dataRoot?:string;manifestPath?:string;
}
function resolveDataRoot(options:LocalHoldingsOptions):string {
 const root=options.dataRoot??process.env.TSM_OFFLINE_DATA_ROOT;
 if(!root||!root.trim())throw new Error('LOCAL_HOLDINGS_ROOT_NOT_CONFIGURED: set dataRoot or TSM_OFFLINE_DATA_ROOT');
 return resolve(root);
}
function readManifest(manifestPath:string):LocalHoldingsManifestEntry[] {
 const parsed=JSON.parse(readFileSync(manifestPath,'utf8')) as LocalHoldingsManifestEntry[];
 if(!Array.isArray(parsed))throw new Error('LOCAL_HOLDINGS_MANIFEST_INVALID:'+manifestPath);
 return parsed;
}
/**
 * Serve locally-held government data files described by a manifest.
 *
 * The files themselves are NOT in git (large-data policy); the manifest
 * records their expected SHA-256. Every served file is hash-verified before
 * wrapping — a mismatch throws HOLDINGS_HASH_MISMATCH, never silent.
 * Missing files throw LOCAL_HOLDINGS_NOT_PRESENT with the exact expected
 * path, so the caller can report the precise gap.
 */
export function getLocalHolding(manifestPath:string,match:(entry:LocalHoldingsManifestEntry)=>boolean,options:LocalHoldingsOptions={}):EvidenceEnvelope<unknown> {
 const root=resolveDataRoot(options);
 const entries=readManifest(manifestPath);
 const entry=entries.find(match);
 if(!entry)throw new Error('LOCAL_HOLDINGS_ENTRY_NOT_FOUND');
 const filePath=join(root,entry.path);
 if(!existsSync(filePath))throw new Error('LOCAL_HOLDINGS_NOT_PRESENT:'+filePath);
 const raw=readFileSync(filePath);
 const actual=createHash('sha256').update(raw).digest('hex');
 if(actual!==entry.sha256.toLowerCase())throw new Error('LOCAL_HOLDINGS_HASH_MISMATCH:'+filePath);
 return wrapPinnedSnapshot({sourceId:'fema-nfhl',url:entry.url,retrievedAt:entry.retrievedAt,sha256:entry.sha256,mediaType:'application/geo+json'},raw.toString('utf8'));
}
export function listLocalHoldings(manifestPath:string):LocalHoldingsManifestEntry[] {
 return readManifest(manifestPath);
}
