/**
 * terrain-source-derived.test.ts — the bundled 3DEP-derived elevation grid:
 * resolution, validation, determinism, and the hillshade-integrated mesh.
 */
import { describe, expect, it } from 'vitest';
import {
  resolveElevationGrid,
  buildTerrainMesh,
  generateElevationGrid,
} from '../src/lib/flood-sim/world/terrain';

const OPTS = {
  nx: 48,
  ny: 48,
  dxFt: 200,
  seed: 42,
  baseElevFt: 375,
  valleyReliefFt: 8,
  noiseAmplitudeFt: 2,
};

describe('resolveElevationGrid', () => {
  it('prefers the bundled source-derived grid in auto mode', () => {
    const r = resolveElevationGrid({ ...OPTS, terrainSource: 'auto' });
    expect(r.source).toBe('source-derived');
    expect(r.dataQuality).toBe('source-derived-screening');
    expect(r.grid.length).toBe(48);
    expect(r.grid[0].length).toBe(48);
    expect(r.sourceDerivedMeta).not.toBeNull();
    expect(r.provenance).toContain('3DEP-derived');
  });

  it('returns finite screening-level elevations inside the valley envelope', () => {
    const r = resolveElevationGrid({ ...OPTS, terrainSource: 'source-derived' });
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let n = 0;
    for (const row of r.grid) {
      for (const v of row) {
        expect(Number.isFinite(v)).toBe(true);
        if (v < min) min = v;
        if (v > max) max = v;
        sum += v;
        n += 1;
      }
    }
    const mean = sum / n;
    // Anchor floodplain: below the 375.0 ft BFE, above the river channel.
    expect(mean).toBeLessThan(375);
    expect(mean).toBeGreaterThan(330);
    expect(max - min).toBeLessThan(120);
  });

  it('is deterministic across calls', () => {
    const a = resolveElevationGrid({ ...OPTS, terrainSource: 'auto' });
    const b = resolveElevationGrid({ ...OPTS, terrainSource: 'auto' });
    expect(a.grid).toEqual(b.grid);
  });

  it('procedural preference always resolves procedurally', () => {
    const r = resolveElevationGrid({ ...OPTS, terrainSource: 'procedural' });
    expect(r.source).toBe('procedural');
    expect(r.dataQuality).toBe('procedural-approximation');
    expect(r.sourceDerivedMeta).toBeNull();
    expect(r.grid).toEqual(generateElevationGrid(OPTS));
  });
});

describe('buildTerrainMesh (source-derived source)', () => {
  it('carries source-derived labels and hillshade-modulated vertex colors', () => {
    const resolved = resolveElevationGrid({ ...OPTS, terrainSource: 'auto' });
    const t = buildTerrainMesh({
      ...OPTS,
      elevationFt: resolved.grid,
      sourceInfo: {
        source: resolved.source,
        dataQuality: resolved.dataQuality,
        provenance: resolved.provenance,
        sourceDerivedMeta: resolved.sourceDerivedMeta,
      },
      segments: 8,
    });
    expect(t.dataQuality).toBe('source-derived-screening');
    expect(t.provenance).toContain('3DEP-derived');
    expect(t.mesh.name).toContain('screening');
    expect(t.sourceDerivedMeta?.id).toContain('source-derived-dem-posey-valley');

    const colors = t.mesh.geometry.getAttribute('color') as {
      count: number;
      getX(i: number): number;
      getY(i: number): number;
      getZ(i: number): number;
    };
    expect(colors.count).toBeGreaterThan(0);
    // Hillshade modulation: vertex brightness must vary across the mesh.
    let minLum = Infinity;
    let maxLum = -Infinity;
    for (let i = 0; i < colors.count; i += 1) {
      const lum = colors.getX(i) + colors.getY(i) + colors.getZ(i);
      if (lum < minLum) minLum = lum;
      if (lum > maxLum) maxLum = lum;
      expect(Number.isFinite(lum)).toBe(true);
    }
    expect(maxLum).toBeGreaterThan(minLum);

    // The mesh heights follow the surveyed grid (sampled centre vertex).
    const pos = t.mesh.geometry.getAttribute('position') as {
      count: number;
      getY(i: number): number;
    };
    let maxY = -Infinity;
    for (let i = 0; i < pos.count; i += 1) {
      const y = pos.getY(i);
      if (y > maxY) maxY = y;
    }
    expect(maxY).toBeLessThan(420);
    expect(maxY).toBeGreaterThan(330);
    t.dispose();
  });
});
