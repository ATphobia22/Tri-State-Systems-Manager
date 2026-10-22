import { describe, expect, it } from 'vitest';
import {
  buildIllustrativeTerrain,
  resolveAnimationTarget,
} from './FloodScenarioAnimation';
import { getScenario } from '../digital-twin/floodScenario';

describe('buildIllustrativeTerrain', () => {
  it('is deterministic for the same seed', () => {
    const a = buildIllustrativeTerrain(32, 32, 1937);
    const b = buildIllustrativeTerrain(32, 32, 1937);
    expect(a.elevations).toEqual(b.elevations);
  });

  it('pins the anchor pad near the real LAG (377.2 ft)', () => {
    const grid = buildIllustrativeTerrain(96, 96, 1937);
    // Center-ish pad cell should be close to 377.2 ft in meters.
    const lagM = 377.2 * 0.3048;
    const c = Math.floor(96 / 2);
    const r = Math.floor(96 * 0.42);
    expect(Math.abs(grid.elevations[r * 96 + c] - lagM)).toBeLessThan(1.0);
  });

  it('carves a river channel along the south edge', () => {
    const grid = buildIllustrativeTerrain(96, 96, 1937);
    let minSouth = Infinity;
    let minNorth = Infinity;
    for (let c = 0; c < 96; c++) {
      minSouth = Math.min(minSouth, grid.elevations[95 * 96 + c]);
      minNorth = Math.min(minNorth, grid.elevations[0 * 96 + c]);
    }
    expect(minSouth).toBeLessThan(minNorth);
  });

  it('labels the grid datum as NAVD88', () => {
    const grid = buildIllustrativeTerrain();
    expect(grid.verticalDatum).toBe('NAVD88');
  });
});

describe('resolveAnimationTarget', () => {
  it('targets the verified 1937 crest elevation', () => {
    const t = resolveAnimationTarget(getScenario('historical-1937')!);
    expect(t.targetM).toBeCloseTo(377.8 * 0.3048, 4);
    expect(t.reason).toBeNull();
  });

  it('targets the regulatory 100yr BFE', () => {
    const t = resolveAnimationTarget(getScenario('100yr')!);
    expect(t.targetM).toBeCloseTo(369.1 * 0.3048, 4);
  });

  it('refuses to animate 2011 without a site crest', () => {
    const t = resolveAnimationTarget(getScenario('historical-2011')!);
    expect(t.targetM).toBeNull();
    expect(t.reason).toContain('MTVI3');
  });

  it('refuses live and 500yr scenarios', () => {
    expect(resolveAnimationTarget(getScenario('live')!).targetM).toBeNull();
    expect(resolveAnimationTarget(getScenario('500yr')!).targetM).toBeNull();
  });
});
