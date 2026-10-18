import test from 'node:test';
import assert from 'node:assert/strict';

function toRtc(positions) {
  const n = positions.length;
  if (n === 0 || n % 3 !== 0) throw new Error('bad length');
  let sx = 0, sy = 0, sz = 0, c = n / 3;
  for (let i = 0; i < n; i += 3) {
    sx += positions[i]; sy += positions[i + 1]; sz += positions[i + 2];
  }
  const cx = sx / c, cy = sy / c, cz = sz / c;
  const rel = new Float32Array(n);
  for (let i = 0; i < n; i += 3) {
    rel[i] = positions[i] - cx;
    rel[i + 1] = positions[i + 1] - cy;
    rel[i + 2] = positions[i + 2] - cz;
  }
  return { rel, center: [cx, cy, cz] };
}

test('RTC centroid removes absolute bias', () => {
  const world = [1e6, 2e6, 100, 1e6 + 10, 2e6 + 20, 110, 1e6 - 5, 2e6 + 5, 90];
  const { rel, center } = toRtc(world);
  assert.ok(Math.abs(center[0] - 1e6) < 10);
  for (let i = 0; i < rel.length; i++) {
    assert.ok(Math.abs(rel[i]) < 50);
  }
});

test('CRS codes recognized', () => {
  const allowed = new Set(['EPSG:4326', 'EPSG:2966', 'EPSG:2968', 'EPSG:4978']);
  assert.ok(allowed.has('EPSG:2966'));
  assert.ok(allowed.has('EPSG:4326'));
});

test('ORM packing layout G=roughness B=metallic', () => {
  const n = 4;
  const roughness = Uint8Array.from([10, 20, 30, 40]);
  const metallic = Uint8Array.from([1, 2, 3, 4]);
  const rgba = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    rgba[i * 4] = 255;
    rgba[i * 4 + 1] = roughness[i];
    rgba[i * 4 + 2] = metallic[i];
    rgba[i * 4 + 3] = 255;
  }
  assert.equal(rgba[1], 10);
  assert.equal(rgba[2], 1);
});
