#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const files = [
  'architecture/contracts/spatial-runtime-fabric-v1.json',
  'architecture/contracts/aws-spatial-capability-adapter-v1.json',
  'architecture/contracts/spatial-layer-manifest-v1.json',
];

for (const relative of files) {
  const file = path.join(root, relative);
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!parsed.schemaVersion || !parsed.name) throw new Error(`${relative}: missing schemaVersion/name`);
}

console.log(`Validated ${files.length} spatial runtime contracts.`);
