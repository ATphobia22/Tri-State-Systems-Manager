import { describe, expect, it } from 'vitest';
import { computeSCSRunoff } from '../src/lib/hydrology-runoff';
import { runDiffusionWave } from '../src/lib/hydraulics-diffusion2d';
import {
  FloodSimEngine,
  ENGINE_STEP_HZ,
  STEP_DT_SEC,
  SIMULATION_PROVENANCE,
  type FloodSimEngineConfig,
} from '../src/lib/flood-sim/engine';
import { generateElevationGrid } from '../src/lib/flood-sim/world/terrain';

function flatGrid(nx: number, ny: number, elevFt: number): number[][] {
  return Array.from({ length: ny }, () => Array.from({ length: nx }, () => elevFt));
}

function gentleGrid(nx: number, ny: number): number[][] {
  return generateElevationGrid({
    nx,
    ny,
    dxFt: 200,
    seed: 42,
    baseElevFt: 375,
    valleyReliefFt: 6,
    noiseAmplitudeFt: 1.5,
    octaves: 2,
  });
}

function engineConfig(overrides: Partial<FloodSimEngineConfig> = {}): FloodSimEngineConfig {
  const nx = 12;
  const ny = 12;
  return {
    scenarioId: 'test-determinism',
    seed: 42,
    nx,
    ny,
    dxFt: 200,
    elevationFt: gentleGrid(nx, ny),
    manningN: 0.05,
    rainfallTimeHrs: [0, 1, 2],
    rainfallIntensityInPerHr: [0.5, 0.3, 0],
    curveNumber: 80,
    watershedAreaSqMi: 5,
    durationHrs: 2,
    structures: [
      {
        id: 's1',
        name: 'Test structure',
        occupancyType: 'RES-1SNB',
        cellRow: 6,
        cellCol: 6,
        firstFloorElevFt: 376,
        structureValueUsd: 200000,
        contentsValueUsd: 50000,
      },
    ],
    snapshotEverySteps: 120,
    ...overrides,
  };
}

describe('SCS runoff known-value check (wired module)', () => {
  it('matches the closed-form SCS solution for CN=75, P=4 in', () => {
    // S = 1000/75 - 10 = 3.3333; Ia = 0.6667
    // Q = (4 - 0.6667)^2 / (4 - 0.6667 + 3.3333) = 11.1111 / 6.6667 = 1.6667 in
    const out = computeSCSRunoff({
      curveNumber: 75,
      watershedAreaSqMi: 10,
      rainfallTimeHrs: [0, 1],
      rainfallIntensityInPerHr: [4, 0],
    });
    expect(out.totalRunoffInches).toBeCloseTo(1.6666667, 5);
    expect(out.provenance.labels).toContain('MODELED');
  });

  it('is fail-closed on non-finite inputs', () => {
    expect(() =>
      computeSCSRunoff({
        curveNumber: Number.NaN,
        watershedAreaSqMi: 10,
        rainfallTimeHrs: [0, 1],
        rainfallIntensityInPerHr: [1, 0],
      }),
    ).toThrow();
  });
});

describe('diffusion-wave stability (wired module)', () => {
  it('throws fail-closed when dt violates the diffusive limit', () => {
    // Steep, deep, smooth, tiny cells => huge D_max => dt=60 s violates.
    const nx = 8;
    const ny = 8;
    const elevationFt = flatGrid(nx, ny, 100).map((row, j) => row.map((_, i) => 100 - i * 20 - j * 20));
    expect(() =>
      runDiffusionWave(
        {
          nx,
          ny,
          dxFt: 10,
          elevationFt,
          manningN: 0.01,
          initialDepthFt: flatGrid(nx, ny, 10),
        },
        1,
        60,
      ),
    ).toThrow(/diffusion-wave-2d/);
  });

  it('stays stable on a gentle grid', () => {
    const nx = 10;
    const ny = 10;
    const out = runDiffusionWave(
      {
        nx,
        ny,
        dxFt: 200,
        elevationFt: gentleGrid(nx, ny),
        manningN: 0.05,
        rainfallInPerHr: 0.5,
      },
      1,
      60,
    );
    expect(out.maxDepthFt).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(out.totalVolumeFt3)).toBe(true);
    expect(out.floodedCellCount).toBeGreaterThan(0);
  });
});

describe('FloodSimEngine determinism', () => {
  it('two runs with the same seed + inputs are bit-identical', () => {
    const a = new FloodSimEngine(engineConfig());
    const b = new FloodSimEngine(engineConfig());
    a.step(10); // 10 sim-seconds = 600 quanta
    b.step(10);
    expect(a.stateHash()).toBe(b.stateHash());
    expect(a.getDepthGrid()).toEqual(b.getDepthGrid());
    expect(a.simTimeSec).toBe(b.simTimeSec);
  });

  it('stateHash is lowercase hex and changes as the sim advances', () => {
    const eng = new FloodSimEngine(engineConfig());
    const h0 = eng.stateHash();
    expect(h0).toMatch(/^[0-9a-f]{16}$/);
    eng.step(1);
    const h1 = eng.stateHash();
    expect(h1).toMatch(/^[0-9a-f]{16}$/);
    expect(h1).not.toBe(h0);
  });

  it('stateHash commits to the seed: different seeds => different hashes', () => {
    const a = new FloodSimEngine(engineConfig({ seed: 1 }));
    const b = new FloodSimEngine(engineConfig({ seed: 2 }));
    // Identical grids and inputs, but the hash commits to the seed so runs
    // are distinguishable and reproducible per seed.
    expect(a.stateHash()).not.toBe(b.stateHash());
    const a2 = new FloodSimEngine(engineConfig({ seed: 1 }));
    expect(a2.stateHash()).toBe(a.stateHash());
  });

  it('setTime() reproduces direct stepping (snapshot scrub is deterministic)', () => {
    const direct = new FloodSimEngine(engineConfig());
    direct.step(5); // 300 quanta
    const directHash = direct.stateHash();

    const scrubbed = new FloodSimEngine(engineConfig());
    scrubbed.step(10); // 600 quanta, snapshots every 120
    scrubbed.setTime(5);
    expect(scrubbed.stateHash()).toBe(directHash);
    expect(scrubbed.simTimeSec).toBeCloseTo(5, 9);
  });

  it('setTime clamps to [0, duration]', () => {
    const eng = new FloodSimEngine(engineConfig());
    eng.setTime(-100);
    expect(eng.simTimeSec).toBe(0);
    eng.setTime(1e9);
    expect(eng.simTimeSec).toBeCloseTo(2 * 3600, 6);
  }, 60000);

  it('pause()/resume() gate stepping', () => {
    const eng = new FloodSimEngine(engineConfig());
    eng.pause();
    expect(eng.isPaused).toBe(true);
    expect(eng.step(1)).toBe(0);
    expect(eng.simTimeSec).toBe(0);
    eng.resume();
    expect(eng.isPaused).toBe(false);
    expect(eng.step(1)).toBe(60);
    expect(eng.simTimeSec).toBeCloseTo(1, 9);
  });

  it('step() consumes whole quanta and banks remainders deterministically', () => {
    const a = new FloodSimEngine(engineConfig());
    const b = new FloodSimEngine(engineConfig());
    // 0.05 s = 3 whole quanta; chunking must not matter.
    a.step(0.025);
    a.step(0.025);
    b.step(0.05);
    expect(a.stateHash()).toBe(b.stateHash());
    expect(a.simTimeSec).toBe(b.simTimeSec);
  });

  it('ENGINE_STEP_HZ is 60 and STEP_DT_SEC is 1/60', () => {
    expect(ENGINE_STEP_HZ).toBe(60);
    expect(STEP_DT_SEC).toBeCloseTo(1 / 60, 15);
  });

  it('labels outputs with provenance "simulation"', () => {
    const eng = new FloodSimEngine(engineConfig());
    expect(eng.provenance).toBe(SIMULATION_PROVENANCE);
    expect(SIMULATION_PROVENANCE).toBe('simulation');
    eng.step(2);
    for (const rec of eng.getDamageReport()) {
      expect(rec.provenance).toBe('simulation');
    }
  });

  it('produces non-negative depths and finite damage', () => {
    const eng = new FloodSimEngine(engineConfig());
    eng.step(30);
    for (const row of eng.getDepthGrid()) {
      for (const v of row) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(v)).toBe(true);
      }
    }
    const report = eng.getDamageReport();
    expect(report).toHaveLength(1);
    expect(Number.isFinite(report[0].damage.totalUsd)).toBe(true);
  });

  it('is fail-closed on bad config', () => {
    const bad = engineConfig();
    bad.elevationFt[0][0] = Number.NaN;
    expect(() => new FloodSimEngine(bad)).toThrow();
    expect(() => new FloodSimEngine(engineConfig({ durationHrs: -1 }))).toThrow();
    expect(() => new FloodSimEngine(engineConfig({ curveNumber: 101 }))).toThrow();
  });

  it('accumulates SCS runoff monotonically', () => {
    const eng = new FloodSimEngine(engineConfig());
    const q0 = eng.getCumulativeRunoffIn();
    eng.step(60);
    const q1 = eng.getCumulativeRunoffIn();
    expect(q1).toBeGreaterThanOrEqual(q0);
  });
});
