import { readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wrapPinnedSnapshot, type EvidenceEnvelope, type PinnedSnapshotReference } from './index.ts';

export interface SnapshotManifestEntry extends PinnedSnapshotReference {
 readonly name:string;readonly description:string;readonly bytes:number;
}
function defaultSnapshotsDir():string {
 return resolve(join(fileURLToPath(import.meta.url),'..','..','snapshots'));
}
function assertSafeSnapshotName(name:unknown):asserts name is string {
 if(typeof name!=='string'||!name.endsWith('.json')||name!==basename(name)||name==='.'||name==='..'||/[\\/\x00-\x1f]/.test(name)||name.includes('..')) {
  throw new Error('PINNED_SNAPSHOT_UNSAFE_NAME');
 }
}
function readManifest(snapshotsDir:string):SnapshotManifestEntry[] {
 const raw=readFileSync(join(snapshotsDir,'manifest.json'),'utf8');
 const parsed:unknown=JSON.parse(raw);
 if(!Array.isArray(parsed))throw new Error('SNAPSHOT_MANIFEST_INVALID');
 const keys=new Set<string>();
 for(const entry of parsed) {
  if(!entry||typeof entry!=='object')throw new Error('SNAPSHOT_MANIFEST_ENTRY_INVALID');
  const item=entry as SnapshotManifestEntry;
  assertSafeSnapshotName(item.name);
  if(typeof item.sourceId!=='string'||!item.sourceId.trim())throw new Error('SNAPSHOT_MANIFEST_SOURCE_ID_REQUIRED');
  const key=item.sourceId+'/'+item.name;
  if(keys.has(key))throw new Error('SNAPSHOT_MANIFEST_DUPLICATE_ENTRY:'+key);
  keys.add(key);
 }
 return parsed as SnapshotManifestEntry[];
}
export function listPinnedSnapshots(snapshotsDir:string=defaultSnapshotsDir()):SnapshotManifestEntry[] {
 return readManifest(snapshotsDir);
}
export function loadPinnedSnapshot<T=unknown>(sourceId:string,name:string,snapshotsDir:string=defaultSnapshotsDir()):EvidenceEnvelope<T> {
 assertSafeSnapshotName(name);
 const entry=readManifest(snapshotsDir).find(item=>item.sourceId===sourceId&&item.name===name);
 if(!entry)throw new Error('PINNED_SNAPSHOT_NOT_REGISTERED:'+sourceId+'/'+name);
 const raw=readFileSync(join(snapshotsDir,entry.name),'utf8');
 return wrapPinnedSnapshot<T>(entry,raw);
}
