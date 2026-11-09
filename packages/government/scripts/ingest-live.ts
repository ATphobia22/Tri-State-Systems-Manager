#!/usr/bin/env node
/** Connected ingestion station only. Usage:
 * npx tsx packages/government/scripts/ingest-live.ts config.json
 * No live HTTP is called by the offline Windows/Unreal application.
 */
import { readFile } from 'node:fs/promises';
import { ingestGovernmentJson,type IngestRequest } from '../src/liveIngestion.ts';

async function main():Promise<void>{
 const file=process.argv[2];
 if(!file||process.argv.length!==3)throw new Error('INGEST_USAGE: tsx ingest-live.ts config.json');
 const raw=await readFile(file);
 if(raw.byteLength>16_384)throw new Error('INGEST_CONFIG_TOO_LARGE');
 const config=JSON.parse(raw.toString('utf8')) as IngestRequest;
 if(!config||typeof config!=='object'||Array.isArray(config))throw new Error('INGEST_CONFIG_REQUIRED');
 const snapshot=await ingestGovernmentJson(config,{timeoutMs:20000});
 process.stdout.write(JSON.stringify({datasetId:snapshot.manifest.datasetId,
   validationStatus:snapshot.manifest.validationStatus,sha256:snapshot.manifest.sha256,
   files:[snapshot.bytesPath,snapshot.manifestPath,snapshot.envelopePath]},null,2)+'\n');
}
main().catch(error=>{
 process.stderr.write('GOVERNMENT_INGEST_FAILED: '+String(error instanceof Error?error.message:error)+'\n');
 process.exitCode=1;
});
