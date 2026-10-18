import { describe, expect, it } from 'vitest';
import { getTilesCameraBasis, getTilesCameraClipPlanes } from '../src/lib/tiles-3d-camera';

describe('getTilesCameraClipPlanes', () => {
  it('keeps the target inside the far plane at regional zoom distances', () => {
    for (const distance of [6_000, 12_000, 100_000, 400_000]) {
      const { near, far } = getTilesCameraClipPlanes(distance);
      expect(near).toBeGreaterThan(0);
      expect(far).toBeGreaterThan(distance);
      expect(far / near).toBeLessThanOrEqual(100_000);
    }
  });

  it('rejects invalid camera distances', () => {
    for (const distance of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => getTilesCameraClipPlanes(distance)).toThrow(RangeError);
    }
  });
});

describe('getTilesCameraBasis', () => {
  it('keeps top-down camera up aligned with bearing-relative north', () => {
    const basis = getTilesCameraBasis(0, 0);
    expect(basis.horizontalEast).toBe(0);
    expect(basis.horizontalNorth).toBe(1);
    expect(basis.positionUpScale).toBe(1);
    expect(basis.positionHorizontalScale).toBeCloseTo(0, 12);
    expect(basis.cameraUpVerticalScale).toBe(0);
    expect(basis.cameraUpHorizontalScale).toBe(1);
  });

  it('keeps camera up orthogonal to the view direction at oblique pitch', () => {
    for (const pitch of [0, Math.PI / 6, Math.PI / 4, 85 * Math.PI / 180]) {
      const basis = getTilesCameraBasis(pitch, 0.7);
      const viewUp = -basis.positionUpScale * basis.cameraUpVerticalScale
        - basis.positionHorizontalScale * basis.cameraUpHorizontalScale;
      expect(Math.abs(viewUp)).toBeLessThan(1e-12);
    }
  });

  it('rejects invalid camera angles', () => {
    expect(() => getTilesCameraBasis(-0.1, 0)).toThrow(RangeError);
    expect(() => getTilesCameraBasis(Math.PI / 2, 0)).toThrow(RangeError);
    expect(() => getTilesCameraBasis(0, Number.NaN)).toThrow(RangeError);
  });
});
