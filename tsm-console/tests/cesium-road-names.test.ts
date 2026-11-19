import { describe, expect, it } from 'vitest';

import { parseRoadNames } from '../src/lib/cesium-road-names';

function archive(features: unknown[]) {
  return { metadata: { labelCount: features.length }, features };
}

function point(name: string, tier: string, lon = -88.0, lat = 37.85) {
  return {
    type: 'Feature',
    id: `TIGER2024:roadname:18129:00000`,
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: { name, tier, county_geoid: '18129', source_segments: 1, seed_length_deg: 0.01 },
  };
}

describe('parseRoadNames', () => {
  it('accepts a major and a local label', () => {
    const labels = parseRoadNames(archive([point('State Rd 62', 'major'), point('Bonebank Rd', 'local')]));
    expect(labels).toHaveLength(2);
    expect(labels[0]).toEqual({ name: 'State Rd 62', lon: -88.0, lat: 37.85, tier: 'major' });
  });

  it('rejects a label-count mismatch', () => {
    expect(() => parseRoadNames({ metadata: { labelCount: 99 }, features: [point('Main St', 'local')] })).toThrow('count mismatch');
  });

  it('rejects an empty name', () => {
    expect(() => parseRoadNames(archive([point('  ', 'local')]))).toThrow('incomplete');
  });

  it('rejects non-point geometry', () => {
    const bad = { ...point('Main St', 'local'), geometry: { type: 'LineString', coordinates: [[-88, 37.85]] } };
    expect(() => parseRoadNames(archive([bad]))).toThrow('not a point');
  });

  it('rejects an unknown tier', () => {
    expect(() => parseRoadNames(archive([point('Main St', 'arterial')]))).toThrow('incomplete');
  });

  it('rejects non-finite coordinates', () => {
    expect(() => parseRoadNames(archive([point('Main St', 'local', Number.NaN, 37.85)]))).toThrow('incomplete');
  });
});
