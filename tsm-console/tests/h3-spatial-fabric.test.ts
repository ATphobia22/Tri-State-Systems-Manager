import { describe, expect, it } from 'vitest';

import { h3Neighborhood, summarizeH3Cell, toH3Cell } from '../src/lib/h3-spatial-fabric';

describe('H3 spatial fabric', () => {
  it('creates and summarizes a valid H3 cell', () => {
    const cell = toH3Cell(38.130891, -87.941415, 9);
    const summary = summarizeH3Cell(cell);

    expect(summary.cell).toBe(cell);
    expect(summary.resolution).toBe(9);
    expect(summary.boundary.length).toBeGreaterThanOrEqual(5);
  });

  it('bounds neighborhood requests', () => {
    const cell = toH3Cell(38.130891, -87.941415, 9);

    expect(h3Neighborhood(cell, 1)).toContain(cell);
    expect(() => h3Neighborhood(cell, 21)).toThrow();
  });
});
