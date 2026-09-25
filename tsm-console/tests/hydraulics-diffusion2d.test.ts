import { describe, expect, it } from 'vitest';
import { runDiffusionWave, type DiffusionWaveInput } from '../src/lib/hydraulics-diffusion2d';

function flatInput(nx: number, ny: number, dxFt: number, z: number): DiffusionWaveInput {
  return {
    nx,
    ny,
    dxFt,
    elevationFt: Array.from({ length: ny }, () => Array.from({ length: nx }, () => z)),
    manningN: 0.03,
  };
}

describe('2D diffusion-wave inundation', () => {
  it('flat-plane ponding conserves mass and stays uniform under uniform rain', () => {
    const nx = 4;
    const ny = 3;
    const dx = 10; // ft
    const rainInPerHr = 1;
    const durationHrs = 1;
    const input = { ...flatInput(nx, ny, dx, 100), rainfallInPerHr: rainInPerHr };

    // Flat, impermeable, closed domain: zero surface slope => zero flux, so the
    // step is unconditionally stable here (no diffusive constraint to trip).
    const out = runDiffusionWave(input, durationHrs, 60);

    const expectedDepthFt = (rainInPerHr / 12) * durationHrs; // 1 inch over 1 hr
    const expectedVolume = nx * ny * dx * dx * expectedDepthFt;

    expect(out.totalVolumeFt3).toBeCloseTo(expectedVolume, 9);
    expect(out.maxDepthFt).toBeCloseTo(expectedDepthFt, 9);
    expect(out.floodedCellCount).toBe(nx * ny);
    for (const row of out.depthFt) {
      for (const d of row) {
        expect(d).toBeCloseTo(expectedDepthFt, 9);
      }
    }
  });

  it('symmetric terrain + symmetric initial condition => symmetric depths', () => {
    const nx = 6;
    const ny = 6;
    const dx = 10;
    const midX = ((nx - 1) / 2) * dx;
    // Gentle valley, mirror-symmetric about the domain centerline.
    const elevationFt = Array.from({ length: ny }, () =>
      Array.from({ length: nx }, (_, i) => 100 + 0.001 * Math.pow(i * dx - midX, 2)),
    );
    // Symmetric initial pond: mirror about x centerline.
    const initialDepthFt = Array.from({ length: ny }, (_, j) =>
      Array.from({ length: nx }, (_, i) => {
        const di = Math.abs(i - (nx - 1) / 2);
        const dj = Math.abs(j - (ny - 1) / 2);
        return di <= 1 && dj <= 1 ? 1.0 : 0;
      }),
    );

    const out = runDiffusionWave(
      { nx, ny, dxFt: dx, elevationFt, manningN: 0.03, initialDepthFt },
      0.01, // hrs (36 s)
      0.05, // s — well under the diffusive stability limit for this setup
    );

    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        expect(out.depthFt[j][i]).toBeCloseTo(out.depthFt[j][nx - 1 - i], 12);
      }
    }
    // Water spread but stayed in the closed domain.
    expect(out.maxDepthFt).toBeLessThan(1.0);
    expect(out.maxDepthFt).toBeGreaterThan(0);
  });

  it('throws on invalid inputs', () => {
    const good = flatInput(3, 3, 10, 100);

    // Mismatched grid dimensions.
    expect(() =>
      runDiffusionWave({ ...good, elevationFt: [[1, 2], [3, 4]] }, 1, 60),
    ).toThrow();

    // Non-positive dx.
    expect(() => runDiffusionWave({ ...good, dxFt: -10 }, 1, 60)).toThrow();
    expect(() => runDiffusionWave({ ...good, dxFt: 0 }, 1, 60)).toThrow();

    // Non-positive Manning's n.
    expect(() => runDiffusionWave({ ...good, manningN: 0 }, 1, 60)).toThrow();

    // Non-finite elevation.
    const badElev = good.elevationFt.map((r) => [...r]);
    badElev[1][1] = NaN;
    expect(() => runDiffusionWave({ ...good, elevationFt: badElev }, 1, 60)).toThrow();

    // Non-positive duration / dt.
    expect(() => runDiffusionWave(good, 0, 60)).toThrow();
    expect(() => runDiffusionWave(good, 1, 0)).toThrow();
    expect(() => runDiffusionWave(good, 1, -5)).toThrow();

    // dt violating the diffusive stability criterion: water on sloped terrain
    // with an absurdly large step must fail closed.
    const nx = 6;
    const ny = 6;
    const dx = 10;
    const midX = ((nx - 1) / 2) * dx;
    const elevationFt = Array.from({ length: ny }, () =>
      Array.from({ length: nx }, (_, i) => 100 + 0.001 * Math.pow(i * dx - midX, 2)),
    );
    const initialDepthFt = Array.from({ length: ny }, () =>
      Array.from({ length: nx }, () => 1.0),
    );
    expect(() =>
      runDiffusionWave({ nx, ny, dxFt: dx, elevationFt, manningN: 0.03, initialDepthFt }, 1, 3600),
    ).toThrow(/stability/i);
  });

  it('depths never go negative and provenance is attached', () => {
    // Water ponded on a steep tilted plane draining toward the closed edge.
    const nx = 5;
    const ny = 5;
    const dx = 10;
    const elevationFt = Array.from({ length: ny }, () =>
      Array.from({ length: nx }, (_, i) => 100 + 0.5 * i * dx),
    );
    const initialDepthFt = Array.from({ length: ny }, () =>
      Array.from({ length: nx }, () => 0.5),
    );

    const out = runDiffusionWave(
      { nx, ny, dxFt: dx, elevationFt, manningN: 0.05, initialDepthFt },
      0.05,
      0.05,
    );

    let min = Infinity;
    for (const row of out.depthFt) {
      for (const d of row) {
        expect(d).toBeGreaterThanOrEqual(0);
        if (d < min) min = d;
      }
    }
    expect(min).toBeGreaterThanOrEqual(0);

    expect(out.provenance.labels).toEqual(['MODELED', 'DERIVED']);
    expect(out.provenance.modelVersion).toBe('diffusion-wave-2d-v1');
  });

  it('closed boundaries retain volume with no rain (mass conservation)', () => {
    const nx = 5;
    const ny = 5;
    const dx = 10;
    const elevationFt = Array.from({ length: ny }, (_, j) =>
      Array.from({ length: nx }, (_, i) => 100 + 0.02 * (i * dx) + 0.01 * (j * dx)),
    );
    const initialDepthFt = Array.from({ length: ny }, () =>
      Array.from({ length: nx }, () => 0.25),
    );
    const before = nx * ny * dx * dx * 0.25;

    const out = runDiffusionWave(
      { nx, ny, dxFt: dx, elevationFt, manningN: 0.035, initialDepthFt },
      0.02,
      0.05,
    );

    expect(out.totalVolumeFt3).toBeCloseTo(before, 6);
  });
});
