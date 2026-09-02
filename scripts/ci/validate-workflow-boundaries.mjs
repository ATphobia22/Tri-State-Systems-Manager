#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const WORKFLOW_DIR = resolve(ROOT, '.github/workflows');
const governed = new Set(['ci.yml', 'infrastructure-ci.yml', 'geospatial-ci.yml', 'container-ci.yml', 'quantum-ci.yml']);
const forbidden = [
  /curl[^\n|]*\|\s*(ba)?sh/i,
  /wget[^\n|]*\|\s*(ba)?sh/i,
  /source\s+<\(\s*(curl|wget)/i,
];
const requiredPermission = /permissions:\s*\n\s+contents:\s+read/m;
const errors = [];

for (const name of await readdir(WORKFLOW_DIR)) {
  if (!name.endsWith('.yml') && !name.endsWith('.yaml')) continue;
  const path = resolve(WORKFLOW_DIR, name);
  const text = await readFile(path, 'utf8');
  for (const pattern of forbidden) if (pattern.test(text)) errors.push(`${name}: forbidden remote execution pattern`);
  if (governed.has(name) && !requiredPermission.test(text)) errors.push(`${name}: missing explicit contents: read permission`);
  if (name === 'quantum-ci.yml' && /runs-on:\s*(?!ubuntu)/.test(text)) errors.push('quantum-ci.yml: quantum research must use a controlled hosted runner unless explicitly isolated');
  if (name === 'geospatial-ci.yml' && /cityengine|unreal/i.test(text) && !/workflow_dispatch/.test(text)) errors.push('geospatial-ci.yml: specialized tooling must be independently dispatchable');
}

if (errors.length) {
  errors.forEach((error) => console.error(`WORKFLOW BOUNDARY ERROR: ${error}`));
  process.exit(1);
}
console.log('Workflow boundary checks passed.');
