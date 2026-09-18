import { describe, expect, it } from 'vitest';
import {
  NAVD88_FT_TO_METERS,
  createHydraulicExtrusionLayer,
  createHydraulicSource,
  feetToMeters,
} from '../src/lib/hydraulic-rendering';

describe('hydraulic rendering', () => {
  it('converts NAVD88 feet to renderer meters', () => {
    expect(feetToMeters(375)).toBeCloseTo(114.3, 8);
    expect(NAVD88_FT_TO_METERS).toBe(0.3048);
  });

  it('fails closed on non-finite elevations', () => {
    expect(() => feetToMeters(Number.NaN)).toThrow(/finite/);
    expect(() => createHydraulicExtrusionLayer('hydraulic', 'parcels', 'parcels', Number.POSITIVE_INFINITY)).toThrow(/finite/);
  });

  it('uses explicit feet NAVD88 source properties and meter extrusion expressions', () => {
    const layer = createHydraulicExtrusionLayer('hydraulic', 'parcels', 'parcels', 379.2);
    expect(layer.type).toBe('fill-extrusion');
    expect(layer.filter).toEqual(['has', 'ground_elevation_navd88_ft']);
    expect(layer.paint?.['fill-extrusion-base']).toEqual(['*', ['get', 'ground_elevation_navd88_ft'], 0.3048]);
  });

  it('requires an absolute HTTP(S) Martin endpoint', () => {
    expect(createHydraulicSource('get_parcel_tiles', 'http://localhost:3000')).toEqual({
      id: 'get_parcel_tiles',
      type: 'vector',
      tiles: ['http://localhost:3000/get_parcel_tiles/{z}/{x}/{y}'],
      minzoom: 12,
      maxzoom: 20,
    });
    expect(() => createHydraulicSource('get_parcel_tiles', 'file:///tmp/martin')).toThrow(/HTTP or HTTPS/);
    expect(createHydraulicSource('get_parcel_tiles', 'https://tiles.example', '/api/v1')).toEqual({
      id: 'get_parcel_tiles',
      type: 'vector',
      tiles: ['https://tiles.example/api/v1/get_parcel_tiles/{z}/{x}/{y}'],
      minzoom: 12,
      maxzoom: 20,
    });
    expect(() => createHydraulicSource('get_parcel_tiles', 'https://tiles.example', '/api/../bad')).toThrow(/route prefix/);
  });
});
