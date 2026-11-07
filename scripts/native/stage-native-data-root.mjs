#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listSnapshotFiles, verifyNativeDataManifest } from './native-data-manifest.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');
function contains(parent, child) { const relative = path.relative(parent, child); return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)); }
export function stageNativeData({ sourceRoot, destinationRoot }) {
  if (!sourceRoot) throw new Error('TSM_NATIVE_DATA_ROOT is required.');
  // Resolve existing ancestors so aliases through symlinked parents cannot make
  // the replacement/delete step remove its own source snapshot.
  const source = fs.realpathSync(sourceRoot);
  const destination = path.resolve(destinationRoot);
  const realDestination = fs.existsSync(destination) ? fs.realpathSync(destination) : destination;
  if (contains(source, destination) || contains(destination, source) || contains(source, realDestination) || contains(realDestination, source)) throw new Error('Source and destination data roots must not overlap.');
  const verifiedSource = verifyNativeDataManifest({ dataRoot: sourceRoot });
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const realParent = fs.realpathSync(path.dirname(destination));
  if (contains(source, realParent) || contains(path.join(realParent, path.basename(destination)), source)) throw new Error('Source and destination data roots must not overlap.');
  if (fs.existsSync(destination) && fs.lstatSync(destination).isSymbolicLink()) throw new Error('Staging destination must not be a symlink.');
  const temporary = fs.mkdtempSync(path.join(realParent, '.tsm-data-stage-'));
  let backup;
  let installed = false;
  try {
    for (const { name, file } of listSnapshotFiles(source)) {
      const target = path.join(temporary, ...name.split('/'));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(file, target);
    }
    const staged = verifyNativeDataManifest({ dataRoot: temporary });
    if (staged.manifestSha256 !== verifiedSource.manifestSha256) throw new Error('Source manifest changed during staging.');
    if (fs.existsSync(destination)) {
      backup = fs.mkdtempSync(path.join(realParent, '.tsm-data-backup-'));
      fs.rmdirSync(backup);
      fs.renameSync(destination, backup);
    }
    try { fs.renameSync(temporary, destination); installed = true; }
    catch (error) { if (backup) { fs.renameSync(backup, destination); backup = undefined; } throw error; }
    if (backup) fs.rmSync(backup, { recursive: true });
    return { ...staged, status: 'STAGED_SNAPSHOT_BYTES_VERIFIED' };
  } finally {
    if (!installed) fs.rmSync(temporary, { recursive: true, force: true });
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = stageNativeData({ sourceRoot: process.env.TSM_NATIVE_DATA_ROOT, destinationRoot: path.join(repoRoot, 'tsm-native', 'Content', 'TSMData') });
    console.log(JSON.stringify(result));
  } catch (error) { console.error(`Native data staging: ${error.message}`); process.exitCode = 1; }
}
