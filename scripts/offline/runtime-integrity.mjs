import { createHash } from 'node:crypto';
import { createReadStream, existsSync, lstatSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

const SHA256 = /^[a-f0-9]{64}$/i;

export function safeArtifactPath(root, entry) {
  if (typeof entry !== 'string' || !entry || entry.includes('\0')
      || isAbsolute(entry) || /^[A-Za-z]:/.test(entry) || entry.includes('\\')) {
    throw new Error('Invalid artifact path');
  }
  const parts = entry.split('/');
  if (parts.some(part => part === '..' || part === '.' || part === '')) {
    throw new Error('Invalid artifact path traversal');
  }
  const base = realpathSync(root);
  const candidate = resolve(base, entry);
  const rel = relative(base, candidate);
  if (rel.startsWith('..' + sep) || rel === '..' || isAbsolute(rel)) {
    throw new Error('Artifact path escapes repository root');
  }
  if (!existsSync(candidate)) throw new Error('Manifest artifact missing: ' + entry);
  // Never follow symlinks in a public/offline artifact manifest.
  let walk = base;
  for (const segment of parts) {
    walk = resolve(walk, segment);
    if (lstatSync(walk).isSymbolicLink()) throw new Error('Symlink artifact disallowed: ' + entry);
  }
  if (!statSync(candidate).isFile()) throw new Error('Manifest artifact is not a regular file: ' + entry);
  return candidate;
}

export function parseSha256Sums(contents) {
  const rows = contents.split(/\r?\n/).filter(Boolean);
  if (!rows.length) throw new Error('Empty checksum inventory');
  return rows.map((row, index) => {
    const match = /^([a-f0-9]{64})  (\S.*)$/i.exec(row);
    if (!match) throw new Error('Malformed SHA256SUMS line ' + (index + 1));
    return { path: match[2], sha256: match[1].toLowerCase() };
  });
}

export function extractRuntimeChecksums(root, manifest) {
  const sumsPath = safeArtifactPath(root, 'offline-runtime/manifests/SHA256SUMS');
  const listed = parseSha256Sums(readFileSync(sumsPath, 'utf8'));
  const byPath = new Map();
  for (const entry of [...listed, ...(manifest.files ?? [])]) {
    if (!entry || typeof entry.path !== 'string'
        || typeof entry.sha256 !== 'string' || !SHA256.test(entry.sha256)) {
      throw new Error('Manifest includes an invalid SHA-256 record');
    }
    if (byPath.has(entry.path) && byPath.get(entry.path).sha256 !== entry.sha256.toLowerCase()) {
      throw new Error('Conflicting checksum entries for ' + entry.path);
    }
    byPath.set(entry.path, {
      path: entry.path, sha256: entry.sha256.toLowerCase(),
      ...(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0 ? { bytes: entry.bytes } : {}),
    });
  }
  if (!byPath.size) throw new Error('No artifact checksums provided');
  return [...byPath.values()];
}

function hash(path) {
  return new Promise((resolveHash, reject) => {
    const stream = createReadStream(path);
    const digest = createHash('sha256');
    stream.on('data', chunk => digest.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolveHash(digest.digest('hex')));
  });
}

export async function verifyOfflineRuntime(root) {
  const runtime = resolve(root, 'offline-runtime');
  for (const entry of ['npm-cache', 'python-wheels', 'native/cargo-vendor']) {
    const path = resolve(runtime, entry);
    if (!existsSync(path) || !statSync(path).isDirectory()) {
      throw new Error('Missing installed runtime directory: ' + entry);
    }
  }
  const manifestPath = safeArtifactPath(root, 'offline-runtime/manifests/runtime-manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (!['tsm-offline-runtime-v1', 'tsm-offline-runtime-windows-x64-v1'].includes(manifest.schemaVersion)) {
    throw new Error('Unsupported runtime manifest schema');
  }
  if (manifest.schemaVersion === 'tsm-offline-runtime-windows-x64-v1' && manifest.platform !== 'windows-x64') {
    throw new Error('Windows runtime manifest platform mismatch');
  }
  if (!Array.isArray(manifest.planes) && !Array.isArray(manifest.runtimePlanes)) {
    throw new Error('Runtime planes are missing');
  }

  const records = extractRuntimeChecksums(root, manifest);
  let totalBytes = 0;
  for (const entry of records) {
    const path = safeArtifactPath(root, entry.path);
    const size = statSync(path).size;
    if (entry.bytes !== undefined && entry.bytes !== size) {
      throw new Error('Byte count mismatch for ' + entry.path);
    }
    const actual = await hash(path);
    if (actual !== entry.sha256) throw new Error('SHA-256 mismatch for ' + entry.path);
    totalBytes += size;
  }
  return { schemaVersion: manifest.schemaVersion, filesVerified: records.length, bytesVerified: totalBytes };
}
