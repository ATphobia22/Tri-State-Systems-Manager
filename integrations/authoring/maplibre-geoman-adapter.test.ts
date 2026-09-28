import { describe, expect, it } from 'vitest';
import { toDraftGeometry } from './maplibre-geoman-adapter';

describe('MapLibre-Geoman adapter', () => {
  it('marks operator geometry as draft', () => {
    const feature = { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [-87, 37] } } as const;
    expect(toDraftGeometry(feature, 'operator-1').authorityClass).toBe('DRAFT');
  });
});
