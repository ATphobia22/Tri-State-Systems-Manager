import { describe, expect, it } from 'vitest';
import {
  convertWithAoiN,
  nearestAoiPoint,
  type Geoid18AoiCatalog,
} from '../src/lib/geodetic/posey-geoid18-aoi';

const catalog: Geoid18AoiCatalog = {
  schema: 'tsm.geoid18.aoi-samples.v1',
  authorityClass: 'DERIVED',
  model: 'GEOID18',
  horizontalFrame: 'NAD83(2011)',
  verticalDatum: 'NAVD88',
  equation: 'H = h - N',
  fit_uncertainty_conus_1sigma_cm: 1.27,
  disclaimer: 'Synthetic, educational only',
  aoi: { name: 'Synthetic generalized region', bbox: [-88, 37, -87, 38] },
  points: [{ id: 'sample', lat: 37.93, lon: -87.9, N_m: -30, note: 'Synthetic value, never publish as site accuracy' }],
};

describe('GEOID18 educational sample boundary', () => {
  it('converts only at a recorded sample, not the nearest arbitrary coordinate', () => {
    expect(nearestAoiPoint(catalog, 37.93, -87.9)?.id).toBe('sample');
    const result = convertWithAoiN(catalog, {
      mode: 'h_to_H', value_m: 100, lat: 37.93, lon: -87.9,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output_m).toBe(130);
      expect(result.authorityClass).toBe('DERIVED');
    }
  });

  it('rejects a location even ~11 meters away rather than extrapolating a geoid sample', () => {
    expect(nearestAoiPoint(catalog, 37.9301, -87.9)).toBeNull();
    const result = convertWithAoiN(catalog, {
      mode: 'H_to_h', value_m: 100, lat: 37.9301, lon: -87.9,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/extrapolation disabled/);
  });

  it('rejects nonfinite coordinates or a missing catalog rather than manufacturing N', () => {
    expect(nearestAoiPoint(catalog, Number.NaN, -87.9)).toBeNull();
    expect(nearestAoiPoint({ ...catalog, points: [] }, 37.93, -87.9)).toBeNull();
    expect(convertWithAoiN(catalog, {
      mode: 'h_to_H', value_m: Number.NaN, lat: 37.93, lon: -87.9,
    }).ok).toBe(false);
  });
});
