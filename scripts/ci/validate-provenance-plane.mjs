import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..');
const file = path.join(root, 'tsm-native', 'config', 'provenance-plane-contract.json');
const contract = JSON.parse(fs.readFileSync(file, 'utf8'));
const errors = [];

const planes = new Map((contract.planes || []).map((p) => [p.name, p]));
for (const name of ['evidence','analysis','presentation','runtime']) {
  if (!planes.has(name)) errors.push('missing architecture plane: ' + name);
}
for (const name of ['evidence','analysis','presentation','runtime']) {
  if (planes.get(name)?.mutable !== false) errors.push(name + ' plane must be immutable');
  if (planes.get(name)?.mayCreateAuthoritativeFacts !== false) errors.push(name + ' plane cannot create authoritative facts');
}
if (planes.get('analysis')?.inputsMustBeVersioned !== true) errors.push('analysis inputs must be versioned');
if (planes.get('presentation')?.sourceLineageRequired !== true) errors.push('presentation source lineage required');
if (planes.get('runtime')?.sha256ManifestRequired !== true) errors.push('runtime SHA-256 manifest required');

const software = contract.provenanceChains?.software || [];
const data = contract.provenanceChains?.data || [];
for (const field of ['sourceCommit','dependencyLock','toolchain','build','artifact','sbom','attestation']) {
  if (!software.includes(field)) errors.push('software provenance missing: ' + field);
}
for (const field of ['sourceDataset','sourceVersion','acquisition','validation','transformation','derivedArtifact','runtimeSnapshot']) {
  if (!data.includes(field)) errors.push('data provenance missing: ' + field);
}
for (const field of ['gitCommit','buildIdentity','runtimeArtifactSha256']) {
  if (!(contract.provenanceChains?.joinIdentity || []).includes(field)) errors.push('provenance join identity missing: ' + field);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('Provenance plane contract: PASS');
