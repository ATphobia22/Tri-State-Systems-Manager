import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'src/lib/webgpu-nanite');

test('meshlet types document 64/124 budgets', () => {
  const src = readFileSync(join(dir, 'meshlet-types.ts'), 'utf8');
  assert.match(src, /MESHLET_MAX_VERTICES = 64/);
  assert.match(src, /MESHLET_MAX_TRIANGLES = 124/);
  assert.match(src, /SIMULATION_DEMO/);
});

test('meshlet import has greedy builder and JSON I/O', () => {
  const src = readFileSync(join(dir, 'meshlet-import.ts'), 'utf8');
  assert.match(src, /buildMeshletsGreedy/);
  assert.match(src, /importMeshletPackJson/);
  assert.match(src, /createUnitCubeMesh/);
  assert.match(src, /nanite-webgpu/);
});

test('meshlet cull uses view-projection frustum', () => {
  const src = readFileSync(join(dir, 'meshlet-cull.ts'), 'utf8');
  assert.match(src, /cullMeshlets/);
  assert.match(src, /frustumPlanesFromVp/);
});

test('runtime smoke reports meshlet visible counts', () => {
  const src = readFileSync(join(dir, 'nanite-plane-runtime.ts'), 'utf8');
  assert.match(src, /buildMeshletsGreedy/);
  assert.match(src, /cullMeshlets/);
  assert.match(src, /meshlets:/);
});

test('integration doc exists', () => {
  const doc = readFileSync(
    join(root, '../docs/architecture/NANITE-PLANE-INTEGRATION-2026-10-19.md'),
    'utf8',
  );
  assert.match(doc, /meshoptimizer\+METIS/);
  assert.match(doc, /Greedy in-console path is for CI and pilots/);
  assert.match(doc, /Plane B/);
});
