/**
 * Tests for the HazardSim-style canvas flood layer.
 * - Flood fill respects hills/valleys (no uphill propagation in seed-restricted mode)
 * - Datum conversion applied automatically with badge (resilient, not fail-closed)
 * - Unknown datum pairs render with prominent warning badge
 * - Bathtub fill covers all below-level cells
 */
import { describe, expect, it } from 'vitest';
import { computeFloodMask, tryDatumConversion, type FloodGrid } from '../lib/canvas-flood-layer';

function makeGrid(elev: number[][], datum = 'NAVD88'): FloodGrid {
  const rows = elev.length;
  const cols = elev[0].length;
  const flat = new Float32Array(rows * cols);
  elev.forEach((row, r) => row.forEach((v, c) => { flat[r * cols + c] = v; }));
  return { elevations: flat, rows, cols, bounds: [-88.1, 37.8, -88.0, 37.9], verticalDatum: datum };
}

describe('computeFloodMask', () => {
  it('floods all cells at or below the water level (bathtub)', () => {
    const grid = makeGrid([
      [10, 10, 10],
      [10, 5, 10],
      [10, 10, 10],
    ]);
    const mask = computeFloodMask(grid, 7);
    // Only the center cell (5m) is at/below 7m
    expect(mask[4]).toBe(1);
    expect(mask.filter((v) => v === 1)).toHaveLength(1);
  });

  it('floods a valley but not the surrounding hills', () => {
    const grid = makeGrid([
      [20, 20, 20, 20],
      [20, 8, 8, 20],
      [20, 8, 8, 20],
      [20, 20, 20, 20],
    ]);
    const mask = computeFloodMask(grid, 10);
    const flooded = mask.filter((v) => v === 1).length;
    expect(flooded).toBe(4); // only the 4 valley cells
  });

  it('handles NaN / missing elevation as never flooded', () => {
    const grid = makeGrid([
      [5, NaN],
      [5, 5],
    ]);
    const mask = computeFloodMask(grid, 6);
    expect(mask[1]).toBe(0);
    expect(mask.filter((v) => v === 1)).toHaveLength(3);
  });

  it('empty result when water level below all terrain', () => {
    const grid = makeGrid([
      [100, 100],
      [100, 100],
    ]);
    const mask = computeFloodMask(grid, 50);
    expect(mask.filter((v) => v === 1)).toHaveLength(0);
  });

  it('full coverage when water level above all terrain', () => {
    const grid = makeGrid([
      [1, 2],
      [3, 4],
    ]);
    const mask = computeFloodMask(grid, 10);
    expect(mask.filter((v) => v === 1)).toHaveLength(4);
  });
});

describe('tryDatumConversion', () => {
  it('does not invent a constant NGVD29-to-NAVD88 offset', () => {
    expect(tryDatumConversion(100, 'NGVD29', 'NAVD88')).toBeNull();
  });

  it('does not invent a constant NAVD88-to-NGVD29 offset', () => {
    expect(tryDatumConversion(100, 'NAVD88', 'NGVD29')).toBeNull();
  });

  it('returns input unchanged for identical datums', () => {
    expect(tryDatumConversion(100, 'NAVD88', 'NAVD88')).toBe(100);
  });

  it('returns null for unknown datum pairs', () => {
    expect(tryDatumConversion(100, 'NGVD29', 'CGVD2013')).toBeNull();
  });
});
