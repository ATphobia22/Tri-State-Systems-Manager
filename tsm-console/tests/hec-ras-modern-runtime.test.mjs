import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../../', import.meta.url);
const required = [
  'packages/hydraulics/contracts/hydraulic-model.ts',
  'packages/hydraulics/contracts/hydraulic-execution.ts',
  'packages/hydraulics/contracts/solver-result.ts',
  'packages/hydraulics/python/requirements.txt',
  'packages/hydraulics/python/tsm_hec_ras/hdf5_reader.py',
  'packages/hydraulics/python/tsm_hec_ras/runtime.py',
];

test('modern HEC-RAS runtime artifacts exist', () => {
  for (const path of required) assert.equal(existsSync(new URL(path, root)), true, path);
});

test('runtime is fail-closed and read-only for HDF5', () => {
  const reader = readFileSync(new URL('packages/hydraulics/python/tsm_hec_ras/hdf5_reader.py', root), 'utf8');
  const runtime = readFileSync(new URL('packages/hydraulics/python/tsm_hec_ras/runtime.py', root), 'utf8');
  assert.match(reader, /Read-only HEC-RAS HDF5 result inspection/);
  assert.match(runtime, /ExecutionError/);
  assert.match(runtime, /returncode != 0/);
  assert.match(runtime, /produced no \.p\*\.hdf/);
});

test('solver contract is versioned and requires provenance plus human review', () => {
  const result = readFileSync(new URL('packages/hydraulics/contracts/solver-result.ts', root), 'utf8');
  assert.match(result, /solver-result-v1/);
  assert.match(result, /sourceUris/);
  assert.match(result, /humanReviewRequired: true/);
});
