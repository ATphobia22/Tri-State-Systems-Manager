import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildDepthPyramid, isOccludedByPyramid } from '../src/lib/hierarchical-z-software.ts';
import { TransvoxelStitcher } from '../src/lib/transvoxel-stitcher.ts';
import {
  WebGPUWorkloadUnavailableError,
  WebGPUVolumetricTerrain,
} from '../src/lib/webgpu-volumetric-terrain.ts';

test('depth pyramid preserves the source level and reduces odd dimensions without edge duplication', () => {
  const pyramid = buildDepthPyramid(new Float32Array([
    0.1, 0.2, 0.3,
    0.4, 0.5, 0.6,
    0.7, 0.8, 0.9,
  ]), 3, 3);

  assert.equal(pyramid.levels.length, 3);
  assert.equal(pyramid.levels[0]?.length, 9);
  assert.equal(pyramid.levels[1]?.length, 4);
  assert.equal(pyramid.levels[2]?.length, 1);
  assert.equal(pyramid.levels[2]?.[0], 0.9);
});

test('depth pyramid rejects invalid dimensions, short buffers, and invalid depth samples', () => {
  assert.throws(() => buildDepthPyramid(new Float32Array([0.5]), 0, 1), RangeError);
  assert.throws(() => buildDepthPyramid(new Float32Array([0.5]), 2, 1), /too small/i);
  assert.throws(() => buildDepthPyramid(new Float32Array([Number.NaN]), 1, 1), /finite/i);
  assert.throws(() => buildDepthPyramid(new Float32Array([1.1]), 1, 1), /\[0, 1\]/);
});

test('depth occlusion returns visible for invalid or fully off-screen rectangles', () => {
  const pyramid = buildDepthPyramid(new Float32Array([0.2, 0.2, 0.2, 0.2]), 2, 2);
  assert.equal(isOccludedByPyramid(pyramid, 3, 0, 4, 1, 0.9), false);
  assert.equal(isOccludedByPyramid(pyramid, 1, 1, 0, 0, 0.9), false);
  assert.equal(isOccludedByPyramid(pyramid, 0, 0, 1, 1, Number.NaN), false);
});

test('depth occlusion is conservative for standard depth values', () => {
  const pyramid = buildDepthPyramid(new Float32Array([0.2, 0.2, 0.2, 0.2]), 2, 2);
  assert.equal(isOccludedByPyramid(pyramid, 0, 0, 1, 1, 0.8), true);
  assert.equal(isOccludedByPyramid(pyramid, 0, 0, 1, 1, 0.2), false);
  // A far-depth hole prevents the entire region from being declared occluded.
  const withHole = buildDepthPyramid(new Float32Array([0.2, 1, 0.2, 0.2]), 2, 2);
  assert.equal(isOccludedByPyramid(withHole, 0, 0, 1, 1, 0.8), false);
});

test('WebGPU terrain does not return a placeholder mesh as if it were valid', async () => {
  const terrain = new WebGPUVolumetricTerrain();
  await assert.rejects(
    terrain.extractMesh(new Float32Array([0, 1]), {
      volumeDimensions: [2, 1, 1],
      voxelSize: [1, 1, 1],
      volumeOrigin: [0, 0, 0],
    }),
    WebGPUWorkloadUnavailableError,
  );
});

test('Transvoxel classifier rejects non-finite SDF samples and invalid geometry indices', () => {
  const invalid = new Float32Array(9);
  invalid[4] = Number.NaN;
  assert.throws(() => TransvoxelStitcher.evaluateTransitionCase(invalid), /must be finite/i);
  assert.equal(TransvoxelStitcher.generateTransitionGeometry(-1), null);
  assert.equal(TransvoxelStitcher.generateTransitionGeometry(512), null);
  assert.equal(TransvoxelStitcher.generateTransitionGeometry(1.5), null);
  assert.deepEqual(TransvoxelStitcher.generateTransitionGeometry(1), [0, 1, 2, 0, 2, 3]);
});
