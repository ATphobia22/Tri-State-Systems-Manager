import { describe, expect, it } from 'vitest';
import { runScenario, type ScenarioDefinition } from '../src/lib/scenario-runner';

/**
 * Shared fixture: flat plane (no slopes -> no lateral flux, rain simply
 * accumulates), impermeable, so per-cell depth = totalRunoffInches / 12 ft.
 *
 * Rainfall: CN=100, 1 in/hr for 3 hr -> totalRunoff = 3 in exactly
 * (last intensity entry is unused per hydrology-runoff docs).
 * Grid duration = 3 hr, so the coupled rate is 1 in/hr and the final
 * uniform depth is 3/12 = 0.25 ft. Grid is 5x4 = 20 cells.
 */
function flatElevation(nx: number, ny: number, z: number): number[][] {
  return Array.from({ length: ny }, () => Array.from({ length: nx }, () => z));
}

const RAINFALL = {
  timeHrs: [0, 1, 2, 3],
  intensityInPerHr: [1, 1, 1, 1],
  curveNumber: 100,
  watershedAreaSqMi: 1,
};

function baseDef(overrides?: Partial<ScenarioDefinition>): ScenarioDefinition {
  return {
    name: 'flat-plane-screening',
    rainfall: { ...RAINFALL },
    grid: { nx: 5, ny: 4, dxFt: 100, elevationFt: flatElevation(5, 4, 375), manningN: 0.05 },
    durationHrs: 3,
    dtSec: 60,
    alertThresholds: {},
    ...overrides,
  };
}

describe('scenario runner: rainfall-to-inundation chain', () => {
  it('couples SCS runoff into uniform grid rainfall and alerts on low max-depth threshold', () => {
    const result = runScenario(baseDef({ alertThresholds: { maxDepthFt: 0.1 } }));

    expect(result.name).toBe('flat-plane-screening');
    // SCS stage: CN=100 -> 3 in of runoff over the event.
    expect(result.runoff?.totalRunoffInches).toBeCloseTo(3, 10);
    expect(result.runoff?.peakDischargeCfs).toBeCloseTo(645.33, 2);
    // Uniform rate = 3 in / 3 hr = 1 in/hr -> final depth 0.25 ft on flat plane.
    expect(result.inundation.maxDepthFt).toBeCloseTo(0.25, 10);
    expect(result.inundation.floodedCellCount).toBe(20);
    expect(result.inundation.totalVolumeFt3).toBeCloseTo(0.25 * 100 * 100 * 20, 6);

    expect(result.alerts).toHaveLength(1);
    const alert = result.alerts[0];
    expect(alert.ruleId).toBe('max-depth-ft');
    expect(alert.metric).toBe('maxDepthFt');
    expect(alert.threshold).toBe(0.1);
    expect(alert.observed).toBeCloseTo(0.25, 10);
    expect(alert.triggered).toBe(true);
    expect(alert.provenance.labels).toContain('MODELED');
  });

  it('does not trigger any alerts when thresholds are high', () => {
    const result = runScenario(
      baseDef({
        alertThresholds: { maxDepthFt: 100, floodedCellCount: 10000, peakDischargeCfs: 1e6 },
      }),
    );

    expect(result.alerts).toHaveLength(3);
    for (const alert of result.alerts) {
      expect(alert.triggered).toBe(false);
    }
    const byRule = Object.fromEntries(result.alerts.map((a) => [a.ruleId, a]));
    expect(byRule['max-depth-ft'].observed).toBeCloseTo(0.25, 10);
    expect(byRule['flooded-cells'].observed).toBe(20);
    expect(byRule['peak-discharge-cfs'].observed).toBeCloseTo(645.33, 2);
  });

  it('evaluates discharge rule as unknown (never silently false) when no rainfall was run', () => {
    const result = runScenario(
      baseDef({
        rainfall: undefined,
        alertThresholds: { peakDischargeCfs: 100, maxDepthFt: 0.01 },
      }),
    );

    expect(result.runoff).toBeUndefined();
    expect(result.inundation.maxDepthFt).toBe(0);
    expect(result.alerts).toHaveLength(2);
    const byRule = Object.fromEntries(result.alerts.map((a) => [a.ruleId, a]));

    const discharge = byRule['peak-discharge-cfs'];
    expect(discharge.observed).toBeNull();
    expect(discharge.triggered).toBe('unknown');

    const depth = byRule['max-depth-ft'];
    expect(depth.observed).toBe(0);
    expect(depth.triggered).toBe(false);
  });

  it('omits alert records for thresholds that are not configured', () => {
    const result = runScenario(baseDef());
    expect(result.alerts).toEqual([]);
  });

  it('rejects invalid definitions fail-closed', () => {
    // Empty name.
    expect(() => runScenario(baseDef({ name: '' }))).toThrow();
    expect(() => runScenario(baseDef({ name: '   ' }))).toThrow();

    // Non-positive or non-finite duration / timestep.
    expect(() => runScenario(baseDef({ durationHrs: 0 }))).toThrow();
    expect(() => runScenario(baseDef({ durationHrs: -2 }))).toThrow();
    expect(() => runScenario(baseDef({ dtSec: 0 }))).toThrow();
    expect(() => runScenario(baseDef({ dtSec: NaN }))).toThrow();

    // Grid dims inconsistent with the elevation raster.
    expect(() =>
      runScenario(
        baseDef({ grid: { nx: 5, ny: 4, dxFt: 100, elevationFt: flatElevation(5, 3, 375), manningN: 0.05 } }),
      ),
    ).toThrow();
    expect(() =>
      runScenario(
        baseDef({ grid: { nx: 5, ny: 4, dxFt: 100, elevationFt: flatElevation(4, 4, 375), manningN: 0.05 } }),
      ),
    ).toThrow();
    expect(() => runScenario(baseDef({ grid: { nx: 0, ny: 4, dxFt: 100, elevationFt: [], manningN: 0.05 } }))).toThrow();

    // Thresholds must be non-negative and finite.
    expect(() => runScenario(baseDef({ alertThresholds: { maxDepthFt: -0.5 } }))).toThrow();
    expect(() => runScenario(baseDef({ alertThresholds: { floodedCellCount: NaN } }))).toThrow();
    expect(() => runScenario(baseDef({ alertThresholds: { peakDischargeCfs: Infinity } }))).toThrow();

    // Malformed rainfall propagates the SCS module's own fail-closed validation.
    expect(() =>
      runScenario(
        baseDef({ rainfall: { ...RAINFALL, curveNumber: 101 } }),
      ),
    ).toThrow();
  });

  it('zero runoff yields zero grid rainfall without crashing', () => {
    // CN=80, 0.3 in total < Ia=0.5 -> no runoff; grid stays dry.
    const result = runScenario(
      baseDef({
        rainfall: { timeHrs: [0, 1], intensityInPerHr: [0.3, 0], curveNumber: 80, watershedAreaSqMi: 1 },
        alertThresholds: { maxDepthFt: 0.001 },
      }),
    );
    expect(result.runoff?.totalRunoffInches).toBe(0);
    expect(result.inundation.maxDepthFt).toBe(0);
    expect(result.alerts[0].triggered).toBe(false);
  });
});
