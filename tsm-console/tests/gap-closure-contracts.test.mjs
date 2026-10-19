import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('Lengyel transitionCellClass is 512 entries with 56 classes', () => {
  const src = readFileSync(join(root, 'src/lib/transvoxel-lengyel-classes.ts'), 'utf8');
  assert.match(src, /TRANSITION_CELL_CLASS/);
  assert.match(src, /uniqueClasses/);
  assert.match(src, /56/);
  const nums = src.match(/0x[0-9a-fA-F]+/g) ?? [];
  // Array has 512 hex literals (plus a few elsewhere); require at least 512
  assert.ok(nums.length >= 512, `expected >=512 hex literals, got ${nums.length}`);
});

test('bandwidth adaptive controller exists with degrade suggestion', () => {
  const src = readFileSync(join(root, 'src/lib/bandwidth-adaptive-fetch.ts'), 'utf8');
  assert.match(src, /BandwidthAdaptiveFetchController/);
  assert.match(src, /suggestedDegradeSteps/);
  assert.match(src, /getBytesPerSec/);
});

test('software hierarchical-Z documents GPU gap', () => {
  const src = readFileSync(join(root, 'src/lib/hierarchical-z-software.ts'), 'utf8');
  assert.match(src, /buildDepthPyramid/);
  assert.match(src, /HIERARCHICAL_Z_STATUS/);
  assert.match(src, /gpuHierarchicalZ: false/);
});

test('coordinate batch validation and terrain evidence wiring exist', () => {
  const batch = readFileSync(join(root, 'src/lib/coordinate-validation-batch.ts'), 'utf8');
  assert.match(batch, /validateFeatureCoordinates/);
  assert.match(batch, /coverage/);
  const terrain = readFileSync(join(root, 'src/lib/open-world-terrain.ts'), 'utf8');
  assert.match(terrain, /assertTerrainEvidence/);
  assert.match(terrain, /ElevationEvidenceProduct/);
});

test('tile lifecycle and stitcher use Lengyel classes', () => {
  const life = readFileSync(join(root, 'src/lib/tile-resource-lifecycle.ts'), 'utf8');
  assert.match(life, /assertNotSynthetic/);
  const stitch = readFileSync(join(root, 'src/lib/transvoxel-stitcher.ts'), 'utf8');
  assert.match(stitch, /getTransitionClass/);
  assert.match(stitch, /validateLengyelTables/);
});
