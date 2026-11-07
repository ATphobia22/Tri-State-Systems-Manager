#!/usr/bin/env node
/** Verify snapshot bytes and paths. This supplies integrity evidence, not datum or runtime acceptance. */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function requireThat(condition, message) { if (!condition) throw new Error(message); }
export function sha256(file) {
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(file, 'r');
  const chunk = Buffer.allocUnsafe(1024 * 1024);
  try { let n; while ((n = fs.readSync(fd, chunk, 0, chunk.length, null)) > 0) hash.update(chunk.subarray(0, n)); }
  finally { fs.closeSync(fd); }
  return hash.digest('hex');
}
function checkRoot(root) {
  const absolute = path.resolve(root);
  requireThat(fs.existsSync(absolute) && !fs.lstatSync(absolute).isSymbolicLink() && fs.statSync(absolute).isDirectory(), 'Data root must be a real directory');
  return fs.realpathSync(absolute);
}
function relativeName(value) {
  // A snapshot is portable to Windows: reject drive/ADS paths, alternate separators,
  // device names, trailing dots/spaces, and case aliases on every host.
  requireThat(typeof value === 'string' && value.length > 0, 'Invalid manifest path');
  const parts = value.split('/');
  requireThat(!/[\\\x00-\x1f<>:"|?*]/.test(value) && parts.every(p => p && p !== '.' && p !== '..' && !/[. ]$/.test(p) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)), `Unsafe manifest path: ${value}`);
  return value;
}
export function listSnapshotFiles(root) {
  const result = [];
  const names = new Set();
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      const name = relativeName(path.relative(root, file).split(path.sep).join('/'));
      const key = name.toLowerCase();
      requireThat(!names.has(key), `Case-colliding snapshot path: ${name}`);
      names.add(key);
      requireThat(!entry.isSymbolicLink(), `Snapshot symlink is not allowed: ${name}`);
      if (entry.isDirectory()) visit(file);
      else { requireThat(entry.isFile(), `Unsupported snapshot entry: ${name}`); result.push({ name, file }); }
    }
  }
  visit(root);
  return result.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
}
export function generateNativeDataManifest({ dataRoot, manifestPath }) {
  const root = checkRoot(dataRoot);
  const output = path.resolve(manifestPath);
  const files = listSnapshotFiles(root).filter(({ file }) => path.resolve(file) !== output)
    .map(({ name, file }) => ({ path: name, sizeBytes: fs.statSync(file).size, sha256: sha256(file) }));
  requireThat(files.length > 0, 'Native data snapshot must contain at least one payload file');
  const manifest = { schemaVersion: 1, integrity: 'sha256', generatedBy: 'scripts/native/native-data-manifest.mjs', files };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  // Never follow a manifest symlink during generation.
  requireThat(!fs.existsSync(output) || !fs.lstatSync(output).isSymbolicLink(), 'Manifest must not be a symlink');
  fs.writeFileSync(output, JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}
export function verifyNativeDataManifest({ dataRoot, manifestPath = path.join(dataRoot, 'data-manifest.json'), rejectExtraFiles = true }) {
  const root = checkRoot(dataRoot);
  const manifestFile = path.resolve(manifestPath);
  requireThat(!fs.lstatSync(manifestFile).isSymbolicLink() && fs.statSync(manifestFile).isFile(), 'Manifest must be a real file');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8').replace(/^\uFEFF/, ''));
  requireThat(manifest.schemaVersion === 1 && manifest.integrity === 'sha256', 'Unsupported native data manifest format');
  requireThat(Array.isArray(manifest.files) && manifest.files.length > 0, 'Native data manifest must contain payload files');
  const actual = listSnapshotFiles(root);
  const filesByName = new Map(actual.map(entry => [entry.name, entry.file]));
  const expected = new Set();
  for (const entry of manifest.files) {
    const name = relativeName(entry.path);
    const key = name.toLowerCase();
    requireThat(!expected.has(key), `Duplicate manifest path: ${name}`);
    expected.add(key);
    requireThat(/^[a-f0-9]{64}$/i.test(entry.sha256 ?? ''), `Invalid SHA-256: ${name}`);
    requireThat(Number.isSafeInteger(entry.sizeBytes) && entry.sizeBytes >= 0, `Invalid size: ${name}`);
    const file = filesByName.get(name);
    requireThat(file, `Manifest file missing or case differs: ${name}`);
    requireThat(path.resolve(file) !== manifestFile, 'Manifest cannot hash itself');
    requireThat(fs.statSync(file).size === entry.sizeBytes, `Size mismatch: ${name}`);
    requireThat(sha256(file) === entry.sha256.toLowerCase(), `SHA-256 mismatch: ${name}`);
  }
  if (rejectExtraFiles) {
    // Only this exact manifest file is exempt. Every other file needs an entry.
    const extras = actual.filter(({ name, file }) => path.resolve(file) !== manifestFile && !expected.has(name.toLowerCase()));
    requireThat(extras.length === 0, `Unmanifested data files: ${extras.map(f => f.name).join(', ')}`);
  }
  return { schemaVersion: 'tsm.native.data-integrity.v1', status: 'SNAPSHOT_BYTES_VERIFIED', fileCount: manifest.files.length, manifestSha256: sha256(manifestFile), geodeticAcceptanceVerified: false, offlineLaunchVerified: false };
}
function cli() {
  const [action, dataRoot, manifestPath, rejectExtra = 'true'] = process.argv.slice(2);
  requireThat(['verify', 'generate'].includes(action) && dataRoot && manifestPath, 'Usage: native-data-manifest.mjs verify|generate <root> <manifest> [true|false]');
  requireThat(['true', 'false'].includes(rejectExtra), 'reject-extra must be true or false');
  if (action === 'generate') {
    const result = generateNativeDataManifest({ dataRoot, manifestPath });
    console.log(`Generated native data manifest: ${result.files.length} payload files`);
  } else console.log(JSON.stringify(verifyNativeDataManifest({ dataRoot, manifestPath, rejectExtraFiles: rejectExtra === 'true' })));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { cli(); } catch (error) { console.error(`Native data manifest: ${error.message}`); process.exitCode = 1; }
}
