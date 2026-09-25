import { describe, expect, it } from 'vitest';
import { computeSCSRunoff, type SCSRunoffInput } from '../src/lib/hydrology-runoff';

/**
 * Hand-computed SCS reference values (NRCS TR-55):
 *   S = 1000/CN - 10 ; Ia = 0.2S ; Q(P) = (P-Ia)^2 / (P-Ia+S) for P > Ia, else 0.
 */
describe('SCS curve number runoff', () => {
  it('computes CN=80, P=3in -> Q=1.25in', () => {
    // S = 1000/80 - 10 = 2.5 ; Ia = 0.5 ; Q(3) = (2.5)^2 / (2.5+2.5) = 6.25/5 = 1.25
    const input: SCSRunoffInput = {
      curveNumber: 80,
      watershedAreaSqMi: 1,
      rainfallTimeHrs: [0, 1, 2, 3],
      rainfallIntensityInPerHr: [1, 1, 1, 1],
    };
    const out = computeSCSRunoff(input);
    expect(out.totalRunoffInches).toBeCloseTo(1.25, 10);
    expect(out.timeHrs).toEqual([0, 1, 2, 3]);
    expect(out.dischargeCfs).toHaveLength(4);
    expect(out.dischargeCfs[0]).toBe(0);
    // Intermediate cumulative runoff values: Q(1) = 0.25/3, Q(2) = 2.25/4
    expect(out.totalRunoffInches).toBeGreaterThan(0);
  });

  it('computes CN=100 -> Q equals P (zero retention)', () => {
    const input: SCSRunoffInput = {
      curveNumber: 100,
      watershedAreaSqMi: 2,
      rainfallTimeHrs: [0, 1, 2],
      rainfallIntensityInPerHr: [0.5, 1.5, 0],
    };
    const out = computeSCSRunoff(input);
    expect(out.totalRunoffInches).toBeCloseTo(2.0, 10);
  });

  it('yields zero runoff when cumulative precipitation stays below Ia', () => {
    // CN=80 -> Ia = 0.5 in ; P = 0.3 in < Ia
    const input: SCSRunoffInput = {
      curveNumber: 80,
      watershedAreaSqMi: 1,
      rainfallTimeHrs: [0, 1],
      rainfallIntensityInPerHr: [0.3, 0],
    };
    const out = computeSCSRunoff(input);
    expect(out.totalRunoffInches).toBe(0);
    expect(out.dischargeCfs).toEqual([0, 0]);
    expect(out.peakDischargeCfs).toBe(0);
  });

  it('converts incremental runoff to cfs with the 645.33 factor', () => {
    // CN=100, area=1 sq mi, 1 in/hr rain for 1 hr -> 1 in/hr runoff -> 645.33 cfs
    const input: SCSRunoffInput = {
      curveNumber: 100,
      watershedAreaSqMi: 1,
      rainfallTimeHrs: [0, 1],
      rainfallIntensityInPerHr: [1, 0],
    };
    const out = computeSCSRunoff(input);
    expect(out.dischargeCfs[1]).toBeCloseTo(645.33, 8);
    // Area scaling is linear: 2 sq mi -> 1290.66 cfs
    const out2 = computeSCSRunoff({ ...input, watershedAreaSqMi: 2 });
    expect(out2.dischargeCfs[1]).toBeCloseTo(2 * 645.33, 8);
  });

  it('passes a hydrograph mass check: integrated Q(t) matches total runoff volume', () => {
    const input: SCSRunoffInput = {
      curveNumber: 75,
      watershedAreaSqMi: 2.5,
      rainfallTimeHrs: [0, 0.5, 1, 1.5, 2],
      rainfallIntensityInPerHr: [1.2, 2.4, 0.8, 0.4, 0],
    };
    const out = computeSCSRunoff(input);
    // Integrate the hydrograph: sum q_i * dt_i * 3600 s/hr  (cubic feet)
    let integratedVolumeFt3 = 0;
    for (let i = 1; i < out.timeHrs.length; i += 1) {
      integratedVolumeFt3 += out.dischargeCfs[i] * (out.timeHrs[i] - out.timeHrs[i - 1]) * 3600;
    }
    // Direct volume: area (sq mi) * 27,878,400 ft^2/sq mi * (runoff in / 12) ft
    const expectedVolumeFt3 = input.watershedAreaSqMi * 27_878_400 * (out.totalRunoffInches / 12);
    expect(integratedVolumeFt3).toBeGreaterThan(0);
    expect(integratedVolumeFt3 / expectedVolumeFt3).toBeCloseTo(1, 4);
  });

  it('reports peak discharge as the maximum ordinate', () => {
    const input: SCSRunoffInput = {
      curveNumber: 85,
      watershedAreaSqMi: 1,
      rainfallTimeHrs: [0, 1, 2, 3],
      rainfallIntensityInPerHr: [0.5, 3, 0.5, 0],
    };
    const out = computeSCSRunoff(input);
    expect(out.peakDischargeCfs).toBe(Math.max(...out.dischargeCfs));
    expect(out.peakDischargeCfs).toBeGreaterThan(0);
    expect(out.dischargeCfs.every((q) => Number.isFinite(q) && q >= 0)).toBe(true);
  });

  it('is deterministic for identical inputs', () => {
    const input: SCSRunoffInput = {
      curveNumber: 80,
      watershedAreaSqMi: 1,
      rainfallTimeHrs: [0, 1, 2],
      rainfallIntensityInPerHr: [1, 1, 0],
    };
    const a = computeSCSRunoff(input);
    const b = computeSCSRunoff(input);
    expect(a.timeHrs).toEqual(b.timeHrs);
    expect(a.dischargeCfs).toEqual(b.dischargeCfs);
    expect(a.totalRunoffInches).toBe(b.totalRunoffInches);
    expect(a.peakDischargeCfs).toBe(b.peakDischargeCfs);
  });

  it('attaches MODELED + DERIVED provenance with the scs-cn-v1 model version', () => {
    const input: SCSRunoffInput = {
      curveNumber: 80,
      watershedAreaSqMi: 1,
      rainfallTimeHrs: [0, 1],
      rainfallIntensityInPerHr: [1, 0],
    };
    const out = computeSCSRunoff(input);
    expect(out.provenance.labels).toContain('MODELED');
    expect(out.provenance.labels).toContain('DERIVED');
    expect(out.provenance.modelVersion).toBe('scs-cn-v1');
  });

  describe('fail-closed validation', () => {
    const valid: SCSRunoffInput = {
      curveNumber: 80,
      watershedAreaSqMi: 1,
      rainfallTimeHrs: [0, 1],
      rainfallIntensityInPerHr: [1, 0],
    };

    it('rejects CN = 0, CN > 100, and non-finite CN', () => {
      expect(() => computeSCSRunoff({ ...valid, curveNumber: 0 })).toThrow(/curveNumber/);
      expect(() => computeSCSRunoff({ ...valid, curveNumber: 101 })).toThrow(/curveNumber/);
      expect(() => computeSCSRunoff({ ...valid, curveNumber: Number.NaN })).toThrow(/curveNumber/);
      expect(() => computeSCSRunoff({ ...valid, curveNumber: -5 })).toThrow(/curveNumber/);
    });

    it('accepts CN at the boundaries (epsilon and 100)', () => {
      expect(() => computeSCSRunoff({ ...valid, curveNumber: 100 })).not.toThrow();
      expect(() => computeSCSRunoff({ ...valid, curveNumber: 0.01 })).not.toThrow();
    });

    it('rejects non-positive or non-finite watershed area', () => {
      expect(() => computeSCSRunoff({ ...valid, watershedAreaSqMi: 0 })).toThrow(/watershedAreaSqMi/);
      expect(() => computeSCSRunoff({ ...valid, watershedAreaSqMi: -2 })).toThrow(/watershedAreaSqMi/);
      expect(() => computeSCSRunoff({ ...valid, watershedAreaSqMi: Number.POSITIVE_INFINITY })).toThrow(
        /watershedAreaSqMi/,
      );
    });

    it('rejects negative or non-finite rainfall values', () => {
      expect(() =>
        computeSCSRunoff({ ...valid, rainfallIntensityInPerHr: [-0.1, 0] }),
      ).toThrow(/rainfallIntensityInPerHr/);
      expect(() =>
        computeSCSRunoff({ ...valid, rainfallIntensityInPerHr: [Number.NaN, 0] }),
      ).toThrow(/rainfallIntensityInPerHr/);
      expect(() => computeSCSRunoff({ ...valid, rainfallTimeHrs: [-1, 0] })).toThrow(/rainfallTimeHrs/);
    });

    it('rejects empty or mismatched arrays', () => {
      expect(() => computeSCSRunoff({ ...valid, rainfallTimeHrs: [] })).toThrow(/non-empty/);
      expect(() =>
        computeSCSRunoff({ ...valid, rainfallTimeHrs: [0, 1, 2], rainfallIntensityInPerHr: [1, 0] }),
      ).toThrow(/mismatch/);
    });

    it('rejects non-increasing times', () => {
      expect(() =>
        computeSCSRunoff({ ...valid, rainfallTimeHrs: [0, 1, 1], rainfallIntensityInPerHr: [1, 1, 0] }),
      ).toThrow(/strictly increasing/);
      expect(() =>
        computeSCSRunoff({ ...valid, rainfallTimeHrs: [0, 2, 1], rainfallIntensityInPerHr: [1, 1, 0] }),
      ).toThrow(/strictly increasing/);
    });
  });
});
