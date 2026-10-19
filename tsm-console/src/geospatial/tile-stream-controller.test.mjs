import test from 'node:test';
import assert from 'node:assert/strict';

// Mirror decideTileStream policy without TS compile (CI-friendly pure JS).

function perspectiveSseDenominator(fovYRadians) {
  if (!(fovYRadians > 0 && fovYRadians < Math.PI)) throw new RangeError('fov');
  return 2 * Math.tan(fovYRadians / 2);
}

function computeGeometricSse({ geometricErrorM, distanceM, viewportHeightPx, sseDenominator }) {
  const d = Math.max(distanceM, 1e-7);
  return (geometricErrorM * viewportHeightPx) / (d * sseDenominator);
}

function evaluateSpatialPhase({ phase, distanceM, ssePx, inFrustum }) {
  const t = { dormantRadiusM: 2500, evictRadiusM: 8000, activeSsePx: 16, dormantSsePx: 4 };
  if (phase === 'UNLOADED') return distanceM < t.dormantRadiusM ? 'DORMANT' : 'UNLOADED';
  if (phase === 'DORMANT') {
    if (distanceM >= t.evictRadiusM) return 'UNLOADED';
    if (inFrustum && ssePx >= t.activeSsePx) return 'ACTIVE';
    return 'DORMANT';
  }
  if (!inFrustum || ssePx < t.dormantSsePx) return 'DORMANT';
  if (distanceM >= t.evictRadiusM) return 'UNLOADED';
  return 'ACTIVE';
}

function encode({ B, D, C, T, S }) {
  return ((B & 0xf) | ((D & 7) << 4) | ((C & 7) << 7) | ((T & 7) << 10) | ((S & 7) << 13)) & 0xffff;
}

function decode(w) {
  w &= 0xffff;
  return { B: w & 0xf, D: (w & 0x70) >> 4, C: (w & 0x380) >> 7, T: (w & 0x1c00) >> 10, S: (w & 0xe000) >> 13 };
}

function evaluateDegradation(word, vram, bw) {
  const s = decode(word);
  if (vram > 0.85) {
    s.T = Math.min(s.T, 1);
    s.C = 0;
  } else if (bw < 10) {
    s.S = Math.min(s.S, 1);
  }
  return encode(s);
}

function decide(sample, budget) {
  const denom = perspectiveSseDenominator(budget.fovYRadians);
  const ssePx = computeGeometricSse({
    geometricErrorM: sample.geometricErrorM,
    distanceM: sample.distanceM,
    viewportHeightPx: budget.viewportHeightPx,
    sseDenominator: denom,
  });
  const phase = evaluateSpatialPhase({
    phase: sample.phase,
    distanceM: sample.distanceM,
    ssePx,
    inFrustum: sample.inFrustum,
  });
  let stateWord = sample.stateWord;
  if (phase === 'ACTIVE') {
    stateWord = evaluateDegradation(stateWord, budget.vramUsageRatio, budget.bandwidthMbps);
  } else if (phase === 'DORMANT') {
    const lod = decode(stateWord);
    lod.T = Math.min(lod.T, 1);
    lod.C = Math.min(lod.C, 1);
    stateWord = encode(lod);
  }
  return { phase, ssePx, stateWord, loadContent: phase === 'ACTIVE', unload: phase === 'UNLOADED' };
}

test('stream: far UNLOADED stays unloaded', () => {
  const d = decide(
    { geometricErrorM: 50, distanceM: 20000, inFrustum: true, phase: 'UNLOADED', stateWord: encode({ B: 3, D: 5, C: 2, T: 3, S: 2 }) },
    { viewportHeightPx: 900, fovYRadians: Math.PI / 3, maximumScreenSpaceErrorPx: 16, vramUsageRatio: 0.5, bandwidthMbps: 50 },
  );
  assert.equal(d.phase, 'UNLOADED');
  assert.equal(d.unload, true);
});

test('stream: near + high SSE promotes DORMANT to ACTIVE', () => {
  const d = decide(
    { geometricErrorM: 40, distanceM: 100, inFrustum: true, phase: 'DORMANT', stateWord: encode({ B: 3, D: 5, C: 2, T: 3, S: 2 }) },
    { viewportHeightPx: 900, fovYRadians: Math.PI / 3, maximumScreenSpaceErrorPx: 16, vramUsageRatio: 0.5, bandwidthMbps: 50 },
  );
  assert.equal(d.phase, 'ACTIVE');
  assert.equal(d.loadContent, true);
});

test('stream: high VRAM strips T/C on ACTIVE', () => {
  const word = encode({ B: 3, D: 5, C: 2, T: 3, S: 2 });
  const d = decide(
    { geometricErrorM: 40, distanceM: 100, inFrustum: true, phase: 'DORMANT', stateWord: word },
    { viewportHeightPx: 900, fovYRadians: Math.PI / 3, maximumScreenSpaceErrorPx: 16, vramUsageRatio: 0.9, bandwidthMbps: 50 },
  );
  assert.equal(d.phase, 'ACTIVE');
  const lod = decode(d.stateWord);
  assert.ok(lod.T <= 1);
  assert.equal(lod.C, 0);
  assert.equal(lod.D, 5); // geometric shell preserved
});
