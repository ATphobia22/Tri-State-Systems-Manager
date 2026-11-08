import { describe, expect, it } from 'vitest';
import {
  closedTraverseDisplayCheck,
  forwardDisplay,
  inverseDisplay,
} from './cogo-display';

describe('cogo-display (display-only COGO checks)', () => {
  it('inverse: 3-4-5 triangle gives distance 5 and the right azimuth', () => {
    const result = inverseDisplay({ x: 0, y: 0 }, { x: 3, y: 4 });
    expect(result.distanceUsFt).toBeCloseTo(5, 12);
    expect(result.azimuthDeg).toBeCloseTo(Math.atan2(3, 4) * (180 / Math.PI), 12);
    expect(result.provisional).toBe(true);
  });

  it('inverse: cardinal azimuths are 0/90/180/270', () => {
    expect(inverseDisplay({ x: 0, y: 0 }, { x: 0, y: 100 }).azimuthDeg).toBeCloseTo(0, 12);
    expect(inverseDisplay({ x: 0, y: 0 }, { x: 100, y: 0 }).azimuthDeg).toBeCloseTo(90, 12);
    expect(inverseDisplay({ x: 0, y: 0 }, { x: 0, y: -100 }).azimuthDeg).toBeCloseTo(180, 12);
    expect(inverseDisplay({ x: 0, y: 0 }, { x: -100, y: 0 }).azimuthDeg).toBeCloseTo(270, 12);
  });

  it('forward inverts the inverse', () => {
    const inv = inverseDisplay({ x: 2000, y: 1000 }, { x: 2100, y: 1100 });
    const back = forwardDisplay({ x: 2000, y: 1000 }, inv.azimuthDeg, inv.distanceUsFt);
    expect(back.x).toBeCloseTo(2100, 9);
    expect(back.y).toBeCloseTo(1100, 9);
    expect(back.provisional).toBe(true);
  });

  it('closed square traverse closes with zero misclosure', () => {
    const result = closedTraverseDisplayCheck(
      { x: 0, y: 0 },
      [90, 0, 270, 180],
      [100, 100, 100, 100],
    );
    expect(result.linearMisclosureUsFt).toBeCloseTo(0, 10);
    expect(result.coordinates.at(-1)?.x).toBeCloseTo(0, 10);
    expect(result.coordinates.at(-1)?.y).toBeCloseTo(0, 10);
    // Floating-point closure is ~1e-14 ft, not exact zero, so the
    // relative precision is finite but enormous (not 1:inf).
    expect(result.relativePrecision).not.toBeNull();
    expect(result.relativePrecision as number).toBeGreaterThan(1e12);
    expect(result.provisional).toBe(true);
    expect(result.note).toContain('map UX only');
  });

  it('traverse misclosure is reported, not hidden', () => {
    // Last leg 1 ft short: the traverse does not close.
    const result = closedTraverseDisplayCheck(
      { x: 0, y: 0 },
      [90, 0, 270, 180],
      [100, 100, 100, 99],
    );
    expect(result.linearMisclosureUsFt).toBeCloseTo(1, 10);
    expect(result.relativePrecision).toBeCloseTo(399, 10);
  });

  it('rejects mismatched legs and non-finite points', () => {
    expect(() =>
      closedTraverseDisplayCheck({ x: 0, y: 0 }, [90], [100, 100]),
    ).toThrow('same length');
    expect(() => inverseDisplay({ x: Number.NaN, y: 0 }, { x: 1, y: 1 })).toThrow(
      'finite',
    );
    expect(() => forwardDisplay({ x: 0, y: 0 }, 90, -5)).toThrow('non-negative');
  });
});
