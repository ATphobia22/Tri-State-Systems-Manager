/**
 * flood-deck-overlay.test.ts — unit tests for the deck.gl overlay adapter.
 *
 * These test the PURE mapping/render helpers only. They do not test deck.gl
 * rendering, WebGL, or the map control — those need a browser.
 */
import { describe, expect, it } from 'vitest';
import {
  DEPTH_CLASS_BREAKS_FT,
  FLOOD_OVERLAY_DISCLAIMER,
  buildIllustrativeScreeningScenario,
  depthToColorFt,
  gridCellCenters,
} from './flood-deck-overlay';

describe('depthToColorFt', () => {
  it('maps dry/non-positive/non-finite depths to fully transparent', () => {
    expect(depthToColorFt(0)).toEqual([0, 0, 0, 0]);
    expect(depthToColorFt(-1.5)).toEqual([0, 0, 0, 0]);
    expect(depthToColorFt(NaN)).toEqual([0, 0, 0, 0]);
    expect(depthToColorFt(Infinity)).toEqual([0, 0, 0, 0]);
  });

  it('uses stepped class breaks — same break thresholds as the contour layer', () => {
    const shallow = depthToColorFt(0.25);
    const mid = depthToColorFt(1.0);
    const deep = depthToColorFt(3.5);
    const veryDeep = depthToColorFt(8.0);
    // Each class is a distinct color AND a distinct opacity step.
    const classes = [shallow, mid, deep, veryDeep];
    const distinct = new Set(classes.map((c) => c.join(',')));
    expect(distinct.size).toBe(4);
    // Opacity increases monotonically with depth (redundant encoding).
    const alphas = classes.map((c) => c[3]);
    expect([...alphas].sort((a, b) => a - b)).toEqual(alphas);
    // Breaks line up with the documented thresholds.
    expect(DEPTH_CLASS_BREAKS_FT).toEqual([0.5, 2, 5]);
    expect(depthToColorFt(0.5)).toEqual(shallow);
    expect(depthToColorFt(0.5001)).toEqual(mid);
  });

  it('returns valid 0-255 RGBA tuples', () => {
    for (const d of [0.1, 0.5, 1, 2, 4.99, 5, 12]) {
      const c = depthToColorFt(d);
      expect(c).toHaveLength(4);
      for (const v of c) {
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(255);
      }
    }
  });
});

describe('gridCellCenters', () => {
  it('emits centers only for wet cells with valid positions', () => {
    const centers = gridCellCenters({
      nx: 2,
      ny: 2,
      depthFt: [
        [0, 1.2],
        [3.4, 0],
      ],
      bounds: { westLng: -88.01, southLat: 37.84, eastLng: -88.0, northLat: 37.85 },
    });
    expect(centers).toHaveLength(2);
    for (const c of centers) {
      expect(c.position[0]).toBeGreaterThan(-88.01);
      expect(c.position[0]).toBeLessThan(-88.0);
      expect(c.position[1]).toBeGreaterThan(37.84);
      expect(c.position[1]).toBeLessThan(37.85);
      expect(c.depthFt).toBeGreaterThan(0);
    }
  });

  it('fails closed on malformed grids', () => {
    expect(() =>
      gridCellCenters({
        nx: 2,
        ny: 2,
        depthFt: [[1]],
        bounds: { westLng: -88.01, southLat: 37.84, eastLng: -88.0, northLat: 37.85 },
      }),
    ).toThrow();
  });
});

describe('illustrative scenario honesty', () => {
  it('labels itself illustrative and carries the screening disclaimer', () => {
    const { definition, bounds } = buildIllustrativeScreeningScenario();
    expect(definition.name).toMatch(/ILLUSTRATIVE/i);
    expect(definition.name).toMatch(/NOT site conditions/i);
    expect(FLOOD_OVERLAY_DISCLAIMER).toMatch(/NOT a regulatory determination/);
    expect(bounds.westLng).toBeLessThan(bounds.eastLng);
    expect(bounds.southLat).toBeLessThan(bounds.northLat);
  });
});
