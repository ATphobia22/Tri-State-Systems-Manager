import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wrapPinnedSnapshot, type EvidenceEnvelope, type PinnedSnapshotReference } from './index.ts';

export interface SnapshotManifestEntry extends PinnedSnapshotReference {
 readonly name:string;readonly description:string;readonly bytes:number;
}
function defaultSnapshotsDir():string {
 return resolve(join(fileURLToPath(import.meta.url),'..','..','snapshots'));
}
function readManifest(snapshotsDir:string):SnapshotManifestEntry[] {
 const raw=readFileSync(join(snapshotsDir,'manifest.json'),'utf8');
 const parsed=JSON.parse(raw) as SnapshotManifestEntry[];
 if(!Array.isArray(parsed))throw new Error('SNAPSHOT_MANIFEST_INVALID');
 return parsed;
}
export function listPinnedSnapshots(snapshotsDir:string=defaultSnapshotsDir()):SnapshotManifestEntry[] {
 return readManifest(snapshotsDir);
}
export function loadPinnedSnapshot<T=unknown>(sourceId:string,name:string,snapshotsDir:string=defaultSnapshotsDir()):EvidenceEnvelope<T> {
 const entry=readManifest(snapshotsDir).find(item=>item.sourceId===sourceId&&item.name===name);
 if(!entry)throw new Error('PINNED_SNAPSHOT_NOT_REGISTERED:'+sourceId+'/'+name);
 const raw=readFileSync(join(snapshotsDir,entry.name),'utf8');
 return wrapPinnedSnapshot<T>(entry,raw);
}
