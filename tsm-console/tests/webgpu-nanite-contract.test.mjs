import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'src/lib/webgpu-nanite');

test('webgpu-device documents portable limits and workgroup 64', () => {
  const src = readFileSync(join(dir, 'webgpu-device.ts'), 'utf8');
  assert.match(src, /WEBGPU_PORTABLE_LIMITS/);
  assert.match(src, /134217728/);
  assert.match(src, /RECOMMENDED_WORKGROUP_SIZE = 64/);
  assert.match(src, /requestTsmWebGpuDevice/);
  assert.match(src, /VITE_TSM_WEBGPU_NANITE/);
});

test('depth-pyramid has GPU builder and CPU parity helper', () => {
  const src = readFileSync(join(dir, 'depth-pyramid.ts'), 'utf8');
  assert.match(src, /DepthPyramidBuilder/);
  assert.match(src, /buildDepthPyramidCpu/);
  assert.match(src, /@workgroup_size/);
  assert.match(src, /dispatchWorkgroups/);
});

test('research plan exists for limits and dual-plane approach', () => {
  const doc = readFileSync(
    join(root, '../docs/research/WEBGPU-COMPUTE-LIMITS-AND-NANITE-PLAN-2026-10-19.md'),
    'utf8',
  );
  assert.match(doc, /maxStorageBufferBindingSize/);
  assert.match(doc, /atomic/);
  assert.match(doc, /MapLibre/);
  assert.match(doc, /nanite-webgpu/);
});
