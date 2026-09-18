import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFLUENCE_TOUR } from '../src/lib/cinematic/camera-tour';

describe('cinematic camera tour contract', () => {
  it('uses finite, bounded camera keyframes', () => {
    expect(DEFAULT_CONFLUENCE_TOUR.length).toBeGreaterThanOrEqual(3);
    for (const frame of DEFAULT_CONFLUENCE_TOUR) {
      expect(frame.center).toHaveLength(2);
      expect(frame.center.every(Number.isFinite)).toBe(true);
      expect(frame.zoom).toBeGreaterThan(0);
      expect(frame.pitch).toBeGreaterThanOrEqual(0);
      expect(frame.pitch).toBeLessThanOrEqual(85);
      expect(frame.bearing).toBeGreaterThanOrEqual(-360);
      expect(frame.bearing).toBeLessThanOrEqual(360);
      expect(frame.durationMs).toBeGreaterThan(0);
    }
  });
});
