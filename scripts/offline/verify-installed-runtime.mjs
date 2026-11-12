import { resolve } from 'node:path';
import { verifyOfflineRuntime } from './runtime-integrity.mjs';

const root = resolve(import.meta.dirname, '..', '..');
try {
  const verified = await verifyOfflineRuntime(root);
  console.log('TSM installed offline runtime: PASS (byte-level integrity)');
  console.log('Schema:', verified.schemaVersion);
  console.log('SHA-256 files verified:', verified.filesVerified);
  console.log('Artifact bytes verified:', verified.bytesVerified);
} catch (error) {
  console.error('TSM installed offline runtime: FAIL');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
