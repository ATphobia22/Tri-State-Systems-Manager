import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'src/lib/webgpu-nanite');
const repoRoot = join(root, '..');

test('mesh catalog lists lidar building pilots', () => {
  const src = readFileSync(join(dir, 'mesh-catalog.ts'), 'utf8');
  assert.match(src, /buildings-lidar-12450/);
  assert.match(src, /DEFAULT_MESHLET_PILOT_ID/);
  assert.match(src, /4628|4,628|~4/);
});

test('GLB extractor handles non-indexed TRIANGLES', () => {
  const src = readFileSync(join(dir, 'glb-mesh-extract.ts'), 'utf8');
  assert.match(src, /extractMeshFromGlb/);
  assert.match(src, /MODE_TRIANGLES/);
  assert.match(src, /Non-indexed/);
});

test('meshlet-from-glb and runtime prefer pilot GLB', () => {
  assert.match(readFileSync(join(dir, 'meshlet-from-glb.ts'), 'utf8'), /meshletsFromDefaultPilot/);
  assert.match(readFileSync(join(dir, 'nanite-plane-runtime.ts'), 'utf8'), /meshletsFromDefaultPilot/);
});

test('baked pilot MeshletPack exists under data/buildings/meshlets', () => {
  const pack = join(repoRoot, 'data/buildings/meshlets/pilot-buildings-lidar-12450-3-3-0.json');
  assert.ok(existsSync(pack), pack);
  const j = JSON.parse(readFileSync(pack, 'utf8'));
  assert.equal(j.version, 1);
  assert.equal(j.sourceId, 'buildings-lidar-12450-3-3-0');
  assert.ok(j.meshlets.length >= 1);
  assert.ok(j.geometry.positions.length >= 9);
});
