import test from 'node:test';
import assert from 'node:assert/strict';

const MASK = { B: 0xf, D: 0x70, C: 0x380, T: 0x1c00, S: 0xe000 };
function encode(s) {
  return ((s.B & 0xf) | ((s.D & 7) << 4) | ((s.C & 7) << 7) | ((s.T & 7) << 10) | ((s.S & 7) << 13)) & 0xffff;
}
function decode(w) {
  w &= 0xffff;
  return { B: w & 0xf, D: (w & MASK.D) >> 4, C: (w & MASK.C) >> 7, T: (w & MASK.T) >> 10, S: (w & MASK.S) >> 13 };
}
function sse({ e, h, d, denom }) {
  return (e * h) / (Math.max(d, 1e-7) * denom);
}
function phase({ phase, distanceM, ssePx, inFrustum }) {
  const t = { dormantRadiusM: 2500, evictRadiusM: 8000, activeSsePx: 16, dormantSsePx: 4 };
  if (phase === 'UNLOADED' && distanceM < t.dormantRadiusM) return 'DORMANT';
  if (phase === 'DORMANT') {
    if (distanceM >= t.evictRadiusM) return 'UNLOADED';
    if (inFrustum && ssePx >= t.activeSsePx) return 'ACTIVE';
  }
  if (phase === 'ACTIVE' && (!inFrustum || ssePx < t.dormantSsePx)) return 'DORMANT';
  return phase;
}

test('layout v1 round-trip', () => {
  const s = { B: 3, D: 5, C: 2, T: 3, S: 2 };
  assert.deepEqual(decode(encode(s)), s);
});

test('cesium-form SSE increases when closer', () => {
  const far = sse({ e: 10, h: 900, d: 1000, denom: 1 });
  const near = sse({ e: 10, h: 900, d: 100, denom: 1 });
  assert.ok(near > far);
});

test('spatial phase UNLOADED->DORMANT->ACTIVE', () => {
  assert.equal(phase({ phase: 'UNLOADED', distanceM: 100, ssePx: 0, inFrustum: false }), 'DORMANT');
  assert.equal(phase({ phase: 'DORMANT', distanceM: 100, ssePx: 20, inFrustum: true }), 'ACTIVE');
  assert.equal(phase({ phase: 'ACTIVE', distanceM: 100, ssePx: 1, inFrustum: true }), 'DORMANT');
});
