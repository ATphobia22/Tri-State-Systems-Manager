/**
 * Deterministic camera-pan acceptance harness for TSM terrain streaming.
 * Synthetic geometry only. A real Transvoxel mesh adapter and headed GPU
 * capture MUST be supplied before marking the release gate verified.
 * Run: node --test tests/contracts/terrain-camera-pan-benchmark.test.mjs
 */
import assert from 'node:assert/strict';
import test from 'node:test';

const THRESHOLD = 16;
const FOV = Math.PI / 3;
const VIEWPORT = 1080;
const ROOT_SIZE = 256;
const MAX_DEPTH = 3;
const EPS = 1e-9;

export function sse(errorMeters, distanceMeters, viewport = VIEWPORT, fov = FOV) {
  if (![errorMeters, distanceMeters, viewport, fov].every(Number.isFinite) ||
      errorMeters < 0 || viewport <= 0 || fov <= 0 || fov >= Math.PI)
    throw new RangeError('invalid SSE inputs');
  if (distanceMeters <= 1e-4) return Number.MAX_VALUE;
  return errorMeters * viewport / (2 * distanceMeters * Math.tan(fov / 2));
}

const key = n => [n.x, n.y, n.z, n.size].join(':');
function children(n) {
  const h = n.size / 2;
  return Array.from({length: 8}, (_, i) => ({
    x: n.x + (i & 1 ? h : 0),
    y: n.y + (i & 2 ? h : 0),
    z: n.z + (i & 4 ? h : 0),
    size: h, depth: n.depth + 1
  }));
}
function touchingFace(a, b) {
  let faces = 0;
  for (const axis of ['x','y','z']) {
    const edge = Math.abs(a[axis] + a.size - b[axis]) < EPS ||
                 Math.abs(b[axis] + b.size - a[axis]) < EPS;
    const overlap = Math.min(a[axis] + a.size, b[axis] + b.size) -
                    Math.max(a[axis], b[axis]);
    if (edge) faces++;
    else if (overlap <= EPS) return false;
  }
  return faces === 1;
}
export function balance2to1(leaves) {
  const nodes = new Map(leaves.map(n => [key(n), n]));
  let refinements = 0;
  while (true) {
    const a = [...nodes.values()];
    let coarse = null;
    for (let i = 0; i < a.length && !coarse; i++) {
      for (let j = i + 1; j < a.length; j++) {
        if (!touchingFace(a[i], a[j])) continue;
        if (Math.max(a[i].size, a[j].size) / Math.min(a[i].size, a[j].size) > 2) {
          coarse = a[i].size > a[j].size ? a[i] : a[j];
          break;
        }
      }
    }
    if (!coarse) break;
    if (coarse.depth >= MAX_DEPTH) throw new Error('cannot balance at max depth');
    nodes.delete(key(coarse));
    for (const c of children(coarse)) nodes.set(key(c), c);
    refinements++;
  }
  return {leaves: [...nodes.values()], refinements};
}
export function validate2to1(leaves) {
  let facePairs = 0, violations = 0, transitionFaces = 0;
  for (let i = 0; i < leaves.length; i++)
    for (let j = i + 1; j < leaves.length; j++) {
      if (!touchingFace(leaves[i], leaves[j])) continue;
      facePairs++;
      const ratio = Math.max(leaves[i].size, leaves[j].size) /
                    Math.min(leaves[i].size, leaves[j].size);
      if (ratio > 2) violations++;
      if (ratio === 2) transitionFaces++;
    }
  return {facePairs, violations, transitionFaces};
}
function distanceToBox(camera, n) {
  return Math.hypot(...['x','y','z'].map((axis, i) =>
    Math.max(n[axis] - camera[i], 0, camera[i] - (n[axis] + n.size))));
}
export function selectLOD(camera, threshold = THRESHOLD) {
  let leaves = [{x: 0,y: 0,z: 0,size: ROOT_SIZE,depth: 0}];
  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    leaves = leaves.flatMap(n => {
      const error = n.size * 0.08; // synthetic test fixture, NOT DEM error
      return n.depth < MAX_DEPTH &&
        sse(error, Math.max(distanceToBox(camera, n), 1), VIEWPORT, FOV) >= threshold
        ? children(n) : [n];
    });
  }
  const before = leaves.length;
  const balanced = balance2to1(leaves);
  return {...balanced, initialLeaves: before, ...validate2to1(balanced.leaves)};
}
export function runCameraPan({frames = 24, seamAdapter = null} = {}) {
  if (!Number.isInteger(frames) || frames < 2 || frames > 500)
    throw new RangeError('frames must be 2..500');
  const records = [];
  for (let f = 0; f < frames; f++) {
    const t = f / (frames - 1);
    const camera = [-64 + t * 384, -45, 110];
    const result = selectLOD(camera);
    const seam = seamAdapter ? seamAdapter({camera, leaves: result.leaves, frame: f}) : null;
    records.push({
      frame: f, camera, initialLeaves: result.initialLeaves,
      leafCount: result.leaves.length, balanceRefinements: result.refinements,
      facePairs: result.facePairs, transitionFaces: result.transitionFaces,
      balanceViolations: result.violations,
      seamStatus: seam ? 'MEASURED_BY_ADAPTER' : 'NOT_EVIDENCED',
      seamMaxGapMeters: seam?.maxGapMeters ?? null,
      seamOverlapCount: seam?.overlapCount ?? null,
      gpuFrameMs: seam?.gpuFrameMs ?? null
    });
  }
  return {
    schemaVersion: '1.0.0', dataset: 'SYNTHETIC_OCTREE_ONLY',
    realDemValidated: false, transvoxelGeometryValidated: Boolean(seamAdapter),
    headedGpuValidated: false, thresholdPixels: THRESHOLD, records
  };
}
test('SSE monotonically increases as camera approaches', () => {
  assert.ok(sse(5, 50) > sse(5, 100));
  assert.throws(() => sse(5, -1, 0));
});
test('camera pan produces balanced octrees with transition faces', () => {
  const run = runCameraPan({frames: 12});
  assert.ok(run.records.every(r => r.balanceViolations === 0));
  assert.ok(run.records.some(r => r.transitionFaces > 0));
  assert.ok(run.records.every(r => r.seamStatus === 'NOT_EVIDENCED'));
});
if (process.argv.includes('--report')) {
  const report = runCameraPan({frames: 24});
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}
