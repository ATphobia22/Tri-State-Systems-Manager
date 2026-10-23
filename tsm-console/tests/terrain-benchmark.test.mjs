import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runTerrainFrameBenchmark } from '../src/lib/terrain-benchmark.ts';

test('terrain benchmark separates warmup from measured frames and emits percentile summary', async () => {
  let calls = 0;
  const report = await runTerrainFrameBenchmark({
    label: 'unit-test',
    warmupFrames: 2,
    measuredFrames: 5,
    frame: () => { calls++; },
    viewport: { width: 800, height: 600, devicePixelRatio: 1 },
    getRendererBytes: () => 1024,
  });
  assert.equal(calls, 7);
  assert.equal(report.frameCount, 5);
  assert.equal(report.warmupFrames, 2);
  assert.equal(report.rendererResourceBytes, 1024);
  assert.equal(report.gpu.timing, 'not-measured');
  assert.equal(report.gpu.memory, 'not-measured');
  assert.ok(report.frameTimeMs.p50 >= 0);
  assert.ok(report.frameTimeMs.p95 >= report.frameTimeMs.p50);
  assert.ok(report.frameTimeMs.p99 >= report.frameTimeMs.p95);
});

test('terrain benchmark rejects invalid frame counts and missing labels', async () => {
  await assert.rejects(() => runTerrainFrameBenchmark({ label: 'x', measuredFrames: 0, frame: () => {} }), RangeError);
  await assert.rejects(() => runTerrainFrameBenchmark({ label: ' ', frame: () => {} }), RangeError);
});
