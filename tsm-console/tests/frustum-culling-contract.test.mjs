import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  extractFrustumPlanes,
  isAabbVisible,
  planFrustumCull,
} from '../src/gpu/frustum-culling.ts';

test('extractFrustumPlanes requires 16 floats', () => {
  assert.throws(() => extractFrustumPlanes(new Float32Array(15)));
});

test('identity-ish VP culls nothing for centered AABB', () => {
  const vp = new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
  const planes = extractFrustumPlanes(vp);
  assert.equal(planes.length, 6);
  const visible = isAabbVisible(
    { min: [-0.1, -0.1, -0.1], max: [0.1, 0.1, 0.1] },
    planes,
  );
  assert.equal(visible, true);
});

test('planFrustumCull respects maxNodes safety limit', () => {
  const nodes = Array.from({ length: 3 }, (_, i) => ({
    id: `n${i}`,
    aabb: { min: [0, 0, 0], max: [1, 1, 1] },
  }));
  const vp = new Float32Array(16);
  vp[0] = vp[5] = vp[10] = vp[15] = 1;
  const plan = planFrustumCull(nodes, vp, 5000);
  assert.equal(plan.authority, 'PRESENTATION_ONLY');
  assert.ok(plan.visibleIds.length + plan.culledIds.length === 3);
  assert.throws(() => planFrustumCull(nodes, vp, 2));
});
