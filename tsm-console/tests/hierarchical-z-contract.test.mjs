import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildHiZPyramidCpu,
  sampleHiZ,
  isOccludedByHiZ,
  measureHiZBuildCpu,
  integrateHiZWithRenderer,
  HIZ_DOWNSAMPLE_WGSL,
} from '../src/gpu/hierarchical-z.ts';

test('Hi-Z WGSL export is non-empty compute shader', () => {
  assert.match(HIZ_DOWNSAMPLE_WGSL, /hiz_downsample/);
  assert.match(HIZ_DOWNSAMPLE_WGSL, /@compute/);
});

test('CPU pyramid max-filters 2x2', () => {
  const w = 4;
  const h = 4;
  const d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = i;
  const pyr = buildHiZPyramidCpu(d, w, h);
  assert.ok(pyr.levels.length >= 2);
  assert.equal(pyr.method, 'cpu-reference');
  assert.equal(pyr.authority, 'PRESENTATION_ONLY');
  assert.equal(pyr.levels[1].width, 2);
  assert.equal(pyr.levels[1].depths[0], 5);
  assert.equal(sampleHiZ(pyr, 1, 0, 0), 5);
});

test('refuses non-finite depth', () => {
  const d = new Float32Array([1, 2, NaN, 4]);
  assert.throws(() => buildHiZPyramidCpu(d, 2, 2));
});

test('refuses size mismatch', () => {
  assert.throws(() => buildHiZPyramidCpu(new Float32Array(3), 2, 2));
});

test('occlusion assist uses coarser max depth', () => {
  const d = new Float32Array(16);
  d.fill(10);
  d[0] = 100;
  const pyr = buildHiZPyramidCpu(d, 4, 4);
  const occluded = isOccludedByHiZ(pyr, 1, { u0: 0, v0: 0, u1: 0.5, v1: 0.5 }, 101);
  assert.equal(occluded, true);
  const visible = isOccludedByHiZ(pyr, 1, { u0: 0, v0: 0, u1: 0.5, v1: 0.5 }, 1);
  assert.equal(visible, false);
});

test('performance measurement returns finite elapsedMs', () => {
  const w = 128;
  const h = 128;
  const d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = (i % 17) * 0.1;
  const { perf, pyramid } = measureHiZBuildCpu(d, w, h);
  assert.ok(perf.elapsedMs >= 0);
  assert.ok(perf.levelCount >= 2);
  assert.ok(perf.samplesPerMs > 0);
  assert.equal(pyramid.levels[0].width, w);
});

test('renderer integration falls back to CPU without device (context-loss safe)', async () => {
  const w = 32;
  const h = 32;
  const d = new Float32Array(w * h).fill(1);
  const result = await integrateHiZWithRenderer({ depth: d, width: w, height: h, device: null });
  assert.equal(result.contextLossSafe, true);
  assert.equal(result.pyramid.method, 'cpu-reference');
  assert.ok(result.perf.elapsedMs >= 0);
});
