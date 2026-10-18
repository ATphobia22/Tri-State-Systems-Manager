import { describe, expect, it } from 'vitest';
import { getTilesCameraClipPlanes } from '../src/lib/tiles-3d-camera';

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
