import { describe, expect, it } from 'vitest';
import { computeFloodDamage, type OccupancyType } from '../src/lib/hazus-depth-damage';
import {
  lagBfeProbe,
  getAlternative,
  applyAlternativeToTerrain,
  crossSectionProfile,
  cutFillVolumes,
  wseFromGageHeight,
  ARITHMETIC_NOT_SURVEY,
  MITIGATION_ALTERNATIVES,
} from '../src/lib/flood-sim/workbench';
import { generateElevationGrid } from '../src/lib/flood-sim/world/terrain';
import { BONEBANK_SITE_CONSTANTS } from '../src/lib/scientific-analytics';

const OCCUPANCIES: OccupancyType[] = ['RES-1SNB', 'RES-2SNB', 'COM', 'IND'];

describe('Hazus damage monotonicity (wired module)', () => {
  it('is non-decreasing with depth for every occupancy type', () => {
    for (const occ of OCCUPANCIES) {
      let prev = -1;
      for (let depth = 0; depth <= 12; depth += 0.5) {
        const out = computeFloodDamage({
          occupancyType: occ,
          depthFt: depth,
          structureValueUsd: 200000,
          contentsValueUsd: 50000,
        });
        expect(out.totalUsd).toBeGreaterThanOrEqual(prev - 1e-9);
        expect(out.methodology).toBe('Hazus-compatible');
        prev = out.totalUsd;
      }
    }
  });

  it('yields zero damage at zero depth and throws fail-closed on bad input', () => {
    const out = computeFloodDamage({ occupancyType: 'RES-1SNB', depthFt: 0, structureValueUsd: 100000 });
    expect(out.totalUsd).toBe(0);
    expect(() =>
      computeFloodDamage({ occupancyType: 'RES-1SNB', depthFt: 2, structureValueUsd: -5 }),
    ).toThrow();
  });
});

describe('lagBfeProbe', () => {
  it('does freeboard arithmetic on the owner-supplied constants', () => {
    const r = lagBfeProbe(37.845887, -88.005075, BONEBANK_SITE_CONSTANTS);
    expect(r.lagMinusBfeFt).toBeCloseTo(377.2 - 375.0, 10);
    expect(r.ffeMinusBfeFt).toBeCloseTo(382.5 - 375.0, 10);
    expect(r.bermMinusBfeFt).toBeCloseTo(379.8 - 375.0, 10);
    expect(r.derivation).toBe(ARITHMETIC_NOT_SURVEY);
    expect(r.provenance).toBe('simulation');
    expect(r.note).toMatch(/not a survey/i);
  });

  it('throws on non-finite coordinates', () => {
    expect(() => lagBfeProbe(Number.NaN, 0)).toThrow();
  });
});

describe('mitigation alternatives (sign-off gate)', () => {
  it('all alternatives require human sign-off and map to stages 6-7', () => {
    expect(MITIGATION_ALTERNATIVES.length).toBeGreaterThan(0);
    for (const alt of MITIGATION_ALTERNATIVES) {
      expect(alt.requiresHumanSignoff).toBe(true);
      expect(alt.informsStages).toContain('stage-6-statutory-compliance');
      expect(alt.informsStages).toContain('stage-7-grant-eligibility');
      expect(alt.provenance).toBe('simulation');
    }
  });

  it('refuses to apply without explicit human sign-off', () => {
    const elev = [
      [370, 371],
      [372, 373],
    ];
    expect(() =>
      applyAlternativeToTerrain({
        elevationFt: elev,
        manningN: 0.04,
        alternative: getAlternative('berm-raise-1ft'),
        isBermCell: (_r, c) => c === 1,
        isChannelCell: () => false,
        humanSignedOff: false,
      }),
    ).toThrow(/human sign-off/i);
  });

  it('applies berm raise only to berm cells after sign-off', () => {
    const elev = [
      [370, 371],
      [372, 373],
    ];
    const { elevationFt, manningN } = applyAlternativeToTerrain({
      elevationFt: elev,
      manningN: 0.04,
      alternative: getAlternative('berm-raise-2ft'),
      isBermCell: (_r, c) => c === 1,
      isChannelCell: (_r, c) => c === 0,
      humanSignedOff: true,
    });
    expect(elevationFt[0][1]).toBeCloseTo(373, 10); // 371 + 2
    expect(elevationFt[1][0]).toBeCloseTo(372, 10); // channel, no dredge in this alt
    expect(manningN).toBeCloseTo(0.04, 10);
  });

  it('rejects alternatives that would make manningN non-positive', () => {
    const elev = [[370]];
    expect(() =>
      applyAlternativeToTerrain({
        elevationFt: elev,
        manningN: 0.001,
        alternative: getAlternative('channel-dredge-2ft'), // delta -0.005
        isBermCell: () => false,
        isChannelCell: () => true,
        humanSignedOff: true,
      }),
    ).toThrow(/manningN/);
  });
});

describe('crossSectionProfile', () => {
  it('samples a transect with distance, ground, depth, WSE', () => {
    const nx = 8;
    const ny = 8;
    const elevationFt = generateElevationGrid({
      nx, ny, dxFt: 100, seed: 5, baseElevFt: 375, valleyReliefFt: 4, noiseAmplitudeFt: 1,
    });
    const depthFt = elevationFt.map((row) => row.map(() => 2));
    const pts = crossSectionProfile({
      elevationFt,
      depthFt,
      dxFt: 100,
      from: { col: 0, row: 4 },
      to: { col: 7, row: 4 },
      samples: 16,
    });
    expect(pts).toHaveLength(16);
    expect(pts[0].distanceFt).toBe(0);
    expect(pts[15].distanceFt).toBeCloseTo(700, 6);
    for (const p of pts) {
      expect(p.depthFt).toBeCloseTo(2, 6);
      expect(p.wseFt).toBeCloseTo(p.groundElevFt + 2, 6);
      expect(p.provenance).toBe('simulation');
    }
  });
});

describe('cutFillVolumes', () => {
  it('computes cut/fill from grid differences', () => {
    const before = [
      [100, 100],
      [100, 100],
    ];
    const after = [
      [101, 100],
      [100, 98],
    ];
    const r = cutFillVolumes(before, after, 10);
    // fill: 1 ft * 100 ft² = 100; cut: 2 ft * 100 ft² = 200
    expect(r.fillFt3).toBeCloseTo(100, 9);
    expect(r.cutFt3).toBeCloseTo(200, 9);
    expect(r.netFt3).toBeCloseTo(-100, 9);
    expect(r.provenance).toBe('simulation');
  });

  it('is fail-closed on dimension mismatch', () => {
    expect(() => cutFillVolumes([[1]], [[1, 2]], 10)).toThrow();
  });
});

describe('wseFromGageHeight (datum gate)', () => {
  it('computes NAVD88 WSE only with a validated gage zero', () => {
    const ok = wseFromGageHeight({
      gageHeightFt: 12.5,
      gageZeroNavd88Ft: 360.0,
      gageZeroValidated: true,
      status: 'LIVE',
      asOfIso: '2026-09-26T00:00:00Z',
    });
    expect('wseNavd88Ft' in ok && ok.wseNavd88Ft).toBeCloseTo(372.5, 9);
  });

  it('returns SOURCE DATUM ONLY without a validated zero — never fabricated', () => {
    const r = wseFromGageHeight({
      gageHeightFt: 12.5,
      gageZeroNavd88Ft: null,
      gageZeroValidated: false,
      status: 'LIVE',
      asOfIso: '2026-09-26T00:00:00Z',
    });
    expect('wse' in r && r.wse).toBe('SOURCE DATUM ONLY');
  });

  it('never interpolates missing data: STALE / unavailable => SOURCE DATUM ONLY', () => {
    for (const status of ['STALE', 'SOURCE_UNAVAILABLE'] as const) {
      const r = wseFromGageHeight({
        gageHeightFt: status === 'STALE' ? 12.5 : null,
        gageZeroNavd88Ft: 360,
        gageZeroValidated: true,
        status,
        asOfIso: '',
      });
      expect('wse' in r && r.wse).toBe('SOURCE DATUM ONLY');
    }
  });
});

describe('terrain determinism', () => {
  it('generateElevationGrid is bit-identical for the same options', () => {
    const opts = { nx: 16, ny: 16, dxFt: 200, seed: 42, baseElevFt: 375, valleyReliefFt: 6, noiseAmplitudeFt: 1.5 };
    const a = generateElevationGrid(opts);
    const b = generateElevationGrid(opts);
    expect(a).toEqual(b);
  });

  it('different seeds produce different terrain', () => {
    const base = { nx: 16, ny: 16, dxFt: 200, seed: 42, baseElevFt: 375, valleyReliefFt: 6, noiseAmplitudeFt: 1.5 };
    const a = generateElevationGrid(base);
    const b = generateElevationGrid({ ...base, seed: 43 });
    expect(a).not.toEqual(b);
  });
});
