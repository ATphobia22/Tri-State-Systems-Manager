import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  computeFloodDamage,
  DEPTH_DAMAGE_TABLES,
  MAX_TABLE_DEPTH_FT,
  type OccupancyType,
} from '../src/lib/hazus-depth-damage';

const OCCUPANCIES: OccupancyType[] = ['RES-1SNB', 'RES-2SNB', 'COM', 'IND'];

describe('hazus-depth-damage tables', () => {
  it('returns exact table points at integer depths', () => {
    const out = computeFloodDamage({
      occupancyType: 'RES-1SNB',
      depthFt: 0,
      structureValueUsd: 100_000,
    });
    // Note: depth 0 falls in the depth ≤ 0 → zero damage rule.
    expect(out.structuralPct).toBeCloseTo(0, 10);
    expect(out.totalUsd).toBeCloseTo(0, 10);
  });

  it('matches RES-1SNB structural table points exactly', () => {
    const table = DEPTH_DAMAGE_TABLES['RES-1SNB'];
    for (const point of table.slice(1)) {
      const out = computeFloodDamage({
        occupancyType: 'RES-1SNB',
        depthFt: point.depthFt,
        structureValueUsd: 200_000,
        contentsValueUsd: 50_000,
      });
      expect(out.structuralPct).toBeCloseTo(point.structuralPct, 12);
      expect(out.contentsPct).toBeCloseTo(point.contentsPct, 12);
    }
  });

  it('matches RES-1SNB contents at the published 1-ft structural/contents points', () => {
    const out = computeFloodDamage({
      occupancyType: 'RES-1SNB',
      depthFt: 1,
      structureValueUsd: 200_000,
      contentsValueUsd: 50_000,
    });
    expect(out.structuralPct).toBeCloseTo(0.23, 12);
    expect(out.contentsPct).toBeCloseTo(0.18, 12);
    expect(out.structuralUsd).toBeCloseTo(46_000, 8);
    expect(out.contentsUsd).toBeCloseTo(9_000, 8);
  });

  it('checks RES-1SNB structural at 10 ft against the published USACE curve endpoint', () => {
    const out = computeFloodDamage({
      occupancyType: 'RES-1SNB',
      depthFt: 10,
      structureValueUsd: 100_000,
    });
    expect(out.structuralPct).toBeCloseTo(0.71, 12);
  });

  it('spot-checks all occupancy tables at 5 ft', () => {
    const expected: Record<OccupancyType, { s: number; c: number }> = {
      'RES-1SNB': { s: 0.53, c: 0.46 },
      'RES-2SNB': { s: 0.36, c: 0.36 },
      COM: { s: 0.34, c: 0.3 },
      IND: { s: 0.28, c: 0.39 },
    };
    for (const occ of OCCUPANCIES) {
      const out = computeFloodDamage({ occupancyType: occ, depthFt: 5, structureValueUsd: 100_000 });
      expect(out.structuralPct).toBeCloseTo(expected[occ].s, 12);
      expect(out.contentsPct).toBeCloseTo(expected[occ].c, 12);
    }
  });
});

describe('interpolation', () => {
  it('linearly interpolates between table depths', () => {
    const out = computeFloodDamage({
      occupancyType: 'RES-1SNB',
      depthFt: 0.5,
      structureValueUsd: 100_000,
      contentsValueUsd: 100_000,
    });
    expect(out.structuralPct).toBeCloseTo((0.13 + 0.23) / 2, 12);
    expect(out.contentsPct).toBeCloseTo((0.1 + 0.18) / 2, 12);
  });

  it('interpolates at non-midpoint fractions', () => {
    const out = computeFloodDamage({
      occupancyType: 'COM',
      depthFt: 2.25,
      structureValueUsd: 100_000,
    });
    expect(out.structuralPct).toBeCloseTo(0.18 + 0.25 * (0.24 - 0.18), 12);
  });

  it('clamps depths beyond the table range to the 10-ft row', () => {
    const atMax = computeFloodDamage({
      occupancyType: 'IND',
      depthFt: MAX_TABLE_DEPTH_FT,
      structureValueUsd: 100_000,
      contentsValueUsd: 100_000,
    });
    const beyond = computeFloodDamage({
      occupancyType: 'IND',
      depthFt: 25,
      structureValueUsd: 100_000,
      contentsValueUsd: 100_000,
    });
    expect(beyond.structuralPct).toBeCloseTo(atMax.structuralPct, 12);
    expect(beyond.contentsPct).toBeCloseTo(atMax.contentsPct, 12);
    expect(beyond.totalUsd).toBeCloseTo(atMax.totalUsd, 8);
  });
});

describe('fail-closed depth handling', () => {
  it('returns zero damage for depth 0', () => {
    const out = computeFloodDamage({
      occupancyType: 'RES-2SNB',
      depthFt: 0,
      structureValueUsd: 300_000,
      contentsValueUsd: 100_000,
    });
    expect(out.structuralPct).toBe(0);
    expect(out.contentsPct).toBe(0);
    expect(out.structuralUsd).toBe(0);
    expect(out.contentsUsd).toBe(0);
    expect(out.totalUsd).toBe(0);
  });

  it('returns zero damage (never negative) for negative depth', () => {
    const out = computeFloodDamage({
      occupancyType: 'COM',
      depthFt: -2,
      structureValueUsd: 300_000,
      contentsValueUsd: 100_000,
    });
    expect(out.structuralPct).toBe(0);
    expect(out.contentsPct).toBe(0);
    expect(out.totalUsd).toBe(0);
  });
});

describe('invalid inputs throw', () => {
  it('throws for unknown occupancy', () => {
    expect(() =>
      computeFloodDamage({
        // @ts-expect-error testing runtime rejection of unknown occupancy
        occupancyType: 'RES-9XYZ',
        depthFt: 2,
        structureValueUsd: 100_000,
      }),
    ).toThrow(/unknown occupancy/);
  });

  it('throws for negative structure value', () => {
    expect(() =>
      computeFloodDamage({ occupancyType: 'RES-1SNB', depthFt: 2, structureValueUsd: -1 }),
    ).toThrow(/must not be negative/);
  });

  it('throws for negative contents value', () => {
    expect(() =>
      computeFloodDamage({
        occupancyType: 'RES-1SNB',
        depthFt: 2,
        structureValueUsd: 100_000,
        contentsValueUsd: -50,
      }),
    ).toThrow(/must not be negative/);
  });

  it('throws for non-finite inputs', () => {
    expect(() =>
      computeFloodDamage({ occupancyType: 'RES-1SNB', depthFt: NaN, structureValueUsd: 100_000 }),
    ).toThrow(/finite/);
    expect(() =>
      computeFloodDamage({
        occupancyType: 'RES-1SNB',
        depthFt: 2,
        structureValueUsd: Number.POSITIVE_INFINITY,
      }),
    ).toThrow(/finite/);
    expect(() =>
      computeFloodDamage({
        occupancyType: 'RES-1SNB',
        depthFt: 2,
        structureValueUsd: 100_000,
        contentsValueUsd: Number.NaN,
      }),
    ).toThrow(/finite/);
  });
});

describe('arithmetic and provenance', () => {
  it('totals equal structural plus contents', () => {
    const out = computeFloodDamage({
      occupancyType: 'RES-1SNB',
      depthFt: 3.5,
      structureValueUsd: 200_000,
      contentsValueUsd: 80_000,
    });
    // 3.5 ft interpolates the 3-ft and 4-ft rows of RES-1SNB.
    const sPct = (0.4 + 0.47) / 2;
    const cPct = (0.33 + 0.4) / 2;
    expect(out.structuralUsd).toBeCloseTo(200_000 * sPct, 8);
    expect(out.contentsUsd).toBeCloseTo(80_000 * cPct, 8);
    expect(out.totalUsd).toBeCloseTo(out.structuralUsd + out.contentsUsd, 8);
  });

  it('treats missing contents value as zero', () => {
    const out = computeFloodDamage({
      occupancyType: 'IND',
      depthFt: 4,
      structureValueUsd: 500_000,
    });
    expect(out.contentsUsd).toBe(0);
    expect(out.totalUsd).toBeCloseTo(out.structuralUsd, 12);
  });

  it('attaches modeled/derived provenance with the hazus-dd-v1 model version', () => {
    const out = computeFloodDamage({
      occupancyType: 'COM',
      depthFt: 2,
      structureValueUsd: 100_000,
    });
    expect(out.methodology).toBe('Hazus-compatible');
    expect(out.provenance.labels).toContain('MODELED');
    expect(out.provenance.labels).toContain('DERIVED');
    expect(out.provenance.modelVersion).toBe('hazus-dd-v1');
    expect(typeof out.provenance.retrievedAt).toBe('string');
  });

  it('documents that the methodology is not FEMA-certified', async () => {
    const source = await readFile(new URL('../src/lib/hazus-depth-damage.ts', import.meta.url), 'utf8');
    expect(source).toContain('not FEMA-certified');
    expect(source).toContain('NOT FEMA HAZUS software');
  });

  it('echoes occupancy and depth on the output', () => {
    const out = computeFloodDamage({
      occupancyType: 'RES-2SNB',
      depthFt: 4.5,
      structureValueUsd: 100_000,
    });
    expect(out.occupancyType).toBe('RES-2SNB');
    expect(out.depthFt).toBe(4.5);
  });
});
