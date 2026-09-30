import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const required = [
  'tsm-console/package.json',
  'tsm-console/package-lock.json',
  'tsm-console/dist/index.html',
  'packages/hydraulics/contracts/hydraulic-model.ts',
  'packages/hydraulics/contracts/hydraulic-execution.ts',
  'packages/hydraulics/contracts/solver-result.ts',
  'packages/hydraulics/python/requirements.txt',
  'packages/hydraulics/python/tsm_hec_ras/hdf5_reader.py',
  'packages/hydraulics/python/tsm_hec_ras/runtime.py',
  'tsm-console/server/token-proxy.mjs',
];

const failures = [];
for (const relative of required) {
  const path = resolve(root, relative);
  if (!existsSync(path)) failures.push('missing: ' + relative);
  else if (statSync(path).size === 0) failures.push('empty: ' + relative);
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('TSM runtime doctor: PASS');
console.log('Repository root: ' + root);
console.log('Planes: web, API, hydraulics, native, provenance, HEC-RAS boundary');
