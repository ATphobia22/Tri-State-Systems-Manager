import { describe, expect, it } from 'vitest';

import { validateParcelBbox } from '../src/lib/supabase-parcel-bbox';

describe('Supabase PostGIS parcel bbox contract', () => {
  it('accepts a valid local WGS84 viewport', () => {
    expect(validateParcelBbox({ xmin: -88.1, ymin: 37.7, xmax: -87.8, ymax: 38.2 })).toBe(true);
  });

  it('rejects reversed, non-finite, out-of-range, and overly broad bounds', () => {
    expect(validateParcelBbox({ xmin: -88, ymin: 38, xmax: -88.1, ymax: 38.2 })).toBe(false);
    expect(validateParcelBbox({ xmin: -88, ymin: 37, xmax: Number.NaN, ymax: 38 })).toBe(false);
    expect(validateParcelBbox({ xmin: -181, ymin: 37, xmax: -88, ymax: 38 })).toBe(false);
    expect(validateParcelBbox({ xmin: -90, ymin: 37, xmax: -87, ymax: 38 })).toBe(false);
  });
});
