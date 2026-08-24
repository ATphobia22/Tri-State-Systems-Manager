import { describe, expect, it } from 'vitest';
import { POSEY_2020_ASSETS, POSEY_SITE_BOUNDS, isWithinPoseyBounds } from '../src/geospatial/site-asset-manifest';

describe('Posey 2020 geospatial asset manifest', () => {
  it('pins the supplied 5,000-foot EPSG:2966 site footprint', () => {
    expect(POSEY_2020_ASSETS.bounds).toEqual(POSEY_SITE_BOUNDS);
    expect(POSEY_2020_ASSETS.horizontalCrs).toBe('EPSG:2966');
    expect(POSEY_2020_ASSETS.verticalDatum).toBe('NAVD88');
  });

  it('records the real terrain and orthophoto source chain', () => {
    expect(POSEY_2020_ASSETS.terrain.sourceUri).toContain('Indiana_2016_2020_DEM/ImageServer');
    expect(POSEY_2020_ASSETS.terrain.referenceLidarUri).toContain('IN2020_26800940_12.las');
    expect(POSEY_2020_ASSETS.orthophoto.sourceUri).toContain('NAIP2020_CONUS/ImageServer');
    expect(POSEY_2020_ASSETS.terrain.authorityClass).toBe('OBSERVATION');
    expect(POSEY_2020_ASSETS.terrain.derivationClass).toBe('RAW');
    expect(POSEY_2020_ASSETS.orthophoto.authorityClass).toBe('OBSERVATION');
  });

  it('rejects AOIs outside the registered site footprint', () => {
    expect(isWithinPoseyBounds(POSEY_SITE_BOUNDS)).toBe(true);
    expect(isWithinPoseyBounds({ minX: 2679999, minY: 940000, maxX: 2685000, maxY: 945000 })).toBe(false);
  });
});
