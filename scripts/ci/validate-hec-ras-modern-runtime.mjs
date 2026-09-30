import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const required = [
  'packages/hydraulics/contracts/hydraulic-model.ts',
  'packages/hydraulics/contracts/hydraulic-execution.ts',
  'packages/hydraulics/contracts/solver-result.ts',
  'packages/hydraulics/python/requirements.txt',
  'packages/hydraulics/python/tsm_hec_ras/__init__.py',
  'packages/hydraulics/python/tsm_hec_ras/hdf5_reader.py',
  'packages/hydraulics/python/tsm_hec_ras/runtime.py',
  'tsm-console/src/lib/hec-ras-contracts.ts',
];

for (const relative of required) {
  if (!existsSync(resolve(root, relative))) throw new Error(`Missing HEC-RAS runtime artifact: ${relative}`);
}

const model = readFileSync(resolve(root, 'packages/hydraulics/contracts/hydraulic-model.ts'), 'utf8');
const execution = readFileSync(resolve(root, 'packages/hydraulics/contracts/hydraulic-execution.ts'), 'utf8');
const result = readFileSync(resolve(root, 'packages/hydraulics/contracts/solver-result.ts'), 'utf8');
const reader = readFileSync(resolve(root, 'packages/hydraulics/python/tsm_hec_ras/hdf5_reader.py'), 'utf8');
const runtime = readFileSync(resolve(root, 'packages/hydraulics/python/tsm_hec_ras/runtime.py'), 'utf8');

for (const [source, marker] of [
  [model, 'humanReviewRequired: true'],
  [execution, 'hydraulic-execution-v1'],
  [result, 'solver-result-v1'],
  [reader, 'h5py.File'],
  [runtime, 'ExecutionError'],
]) if (!source.includes(marker)) throw new Error(`HEC-RAS runtime invariant missing: ${marker}`);

console.log('HEC-RAS modern runtime contract: PASS');
