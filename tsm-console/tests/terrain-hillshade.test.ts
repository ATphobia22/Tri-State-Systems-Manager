/**
 * terrain-hillshade.test.ts — unit tests for the analytic hillshade
 * (world/hillshade.ts). Pure functions; no GL context needed.
 */
import { describe, expect, it } from 'vitest';
import { computeHillshade, applyHillshadeToColors } from '../src/lib/flood-sim/world/hillshade';

const flatGrid = (n: number, v: number): number[][] =>
  Array.from({ length: n }, () => Array.from({ length: n }, () => v));

const interiorMean = (a: Float64Array, n: number): number => {
  let sum = 0;
  let count = 0;
  for (let r = 1; r < n - 1; r += 1) {
    for (let c = 1; c < n - 1; c += 1) {
      sum += a[r * n + c];
      count += 1;
    }
  }
  return sum / count;
};

describe('computeHillshade', () => {
  it('returns uniform sin(altitude) for a flat grid', () => {
    const shade = computeHillshade(flatGrid(8, 375), 200);
    const expected = Math.sin((45 * Math.PI) / 180);
    for (const v of shade) expect(v).toBeCloseTo(expected, 10);
  });

  it('brightens slopes tilted toward the sun and darkens opposing slopes', () => {
    const n = 16;
    // z rises eastward: the surface tilts down toward the west, facing the
    // default NW sun (azimuth 315°) → brighter than flat.
    const eastRise = Array.from({ length: n }, () =>
      Array.from({ length: n }, (_, i) => 300 + i * 10),
    );
    // z rises westward: tilts away from the sun → darker than flat.
    const westRise = Array.from({ length: n }, () =>
      Array.from({ length: n }, (_, i) => 300 + (n - 1 - i) * 10),
    );
    const flatVal = Math.sin((45 * Math.PI) / 180);
    expect(interiorMean(computeHillshade(eastRise, 200), n)).toBeGreaterThan(flatVal);
    expect(interiorMean(computeHillshade(westRise, 200), n)).toBeLessThan(flatVal);
  });

  it('is deterministic and stays in [0, 1] on noisy terrain', () => {
    let s = 12345;
    const rnd = (): number => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    const grid = Array.from({ length: 24 }, () =>
      Array.from({ length: 24 }, () => 360 + rnd() * 20),
    );
    const a = computeHillshade(grid, 200);
    const b = computeHillshade(grid, 200);
    expect(Array.from(a)).toEqual(Array.from(b));
    for (const v of a) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('honours custom sun position', () => {
    // Sun in the east (azimuth 90): an east-rising plane (tilting west,
    // away from an eastern sun) must be darker than with the sun overhead.
    const n = 12;
    const eastRise = Array.from({ length: n }, () =>
      Array.from({ length: n }, (_, i) => 300 + i * 10),
    );
    const eastSun = interiorMean(computeHillshade(eastRise, 200, { azimuthDeg: 90 }), n);
    const overhead = interiorMean(
      computeHillshade(eastRise, 200, { azimuthDeg: 90, altitudeDeg: 89 }),
      n,
    );
    expect(eastSun).toBeLessThan(overhead);
  });

  it('throws on empty grid or non-positive dx', () => {
    expect(() => computeHillshade([], 200)).toThrow();
    expect(() => computeHillshade(flatGrid(4, 1), 0)).toThrow();
    expect(() => computeHillshade(flatGrid(4, 1), -5)).toThrow();
    expect(() => computeHillshade(flatGrid(4, 1), Number.NaN)).toThrow();
  });
});

describe('applyHillshadeToColors', () => {
  it('scales rgb by floor + (1 - floor) * shade', () => {
    const rgb = new Float32Array([1, 0.5, 0.25, 0.2, 0.4, 0.6]);
    const shade = new Float64Array([1, 0]);
    const out = applyHillshadeToColors(rgb, shade, 0.45);
    expect(out[0]).toBeCloseTo(1, 6);
    expect(out[1]).toBeCloseTo(0.5, 6);
    expect(out[3]).toBeCloseTo(0.2 * 0.45, 6);
    expect(out[5]).toBeCloseTo(0.6 * 0.45, 6);
  });

  it('throws on rgb/shade length mismatch', () => {
    expect(() => applyHillshadeToColors(new Float32Array(6), new Float64Array(3))).toThrow();
  });
});
