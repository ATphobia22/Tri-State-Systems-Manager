import { describe, expect, it } from 'vitest';
import {
  computeNavd88Wse,
  indianaWestToWgs84,
  wgs84ToIndianaWest,
} from './tsm-coordinate-transformer';

/**
 * Test vectors from pyproj (EPSG:4326 -> EPSG:2966), generated 2026-09-30.
 * These are the ground truth the corrected TM implementation must match.
 */
describe('tsm-coordinate-transformer (ported from Swift, TM math corrected)', () => {
  it('forward: anchor -> EPSG:2966 matches pyproj within 0.05 ft', () => {
    const p = wgs84ToIndianaWest({ latitude: 37.845887, longitude: -88.005075 });
    expect(p.eastingUsFt).toBeCloseTo(2686588.658, 1);
    expect(p.northingUsFt).toBeCloseTo(947469.265, 1);
  });

  it('forward: Mt Carmel -> EPSG:2966 matches pyproj within 0.05 ft', () => {
    const p = wgs84ToIndianaWest({ latitude: 38.4103, longitude: -87.7589 });
    expect(p.eastingUsFt).toBeCloseTo(2759171.283, 1);
    expect(p.northingUsFt).toBeCloseTo(1152399.523, 1);
  });

  it('inverse: EPSG:2966 -> WGS84 round-trips the anchor to <1e-6 deg', () => {
    const fwd = wgs84ToIndianaWest({ latitude: 37.845887, longitude: -88.005075 });
    const back = indianaWestToWgs84(fwd);
    expect(back.latitude).toBeCloseTo(37.845887, 6);
    expect(back.longitude).toBeCloseTo(-88.005075, 6);
  });

  it('inverse: direct pyproj vector inverts correctly', () => {
    const back = indianaWestToWgs84({
      eastingUsFt: 2759171.283,
      northingUsFt: 1152399.523,
    });
    expect(back.latitude).toBeCloseTo(38.4103, 5);
    expect(back.longitude).toBeCloseTo(-87.7589, 5);
  });

  it('computeNavd88Wse is pure addition', () => {
    expect(computeNavd88Wse(18.42, 371.1)).toBeCloseTo(389.52, 9);
    expect(computeNavd88Wse(0, 375.0)).toBe(375.0);
  });
});
