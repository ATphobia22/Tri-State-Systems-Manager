import { describe, expect, it } from 'vitest';

import { toPmtilesSourceUrl } from '../src/lib/pmtiles-fabric';

describe('PMTiles fabric', () => {
  it('builds an HTTPS PMTiles source URL', () => {
    expect(
      toPmtilesSourceUrl({
        id: 'regional-basemap',
        archiveUrl: 'https://example.gov/maps/regional.pmtiles',
        attribution: 'Example source',
        enabled: true,
      }),
    ).toBe('pmtiles://https://example.gov/maps/regional.pmtiles');
  });

  it('rejects insecure archives', () => {
    expect(() =>
      toPmtilesSourceUrl({
        id: 'regional-basemap',
        archiveUrl: 'http://example.gov/maps/regional.pmtiles',
        attribution: 'Example source',
        enabled: true,
      }),
    ).toThrow();
  });
});
