import { describe, expect, it } from 'vitest';
import { inspectOsmBuilding, osmBuildingStyleRules } from '../src/lib/cesium-osm-building-style';

describe('OSM 3D Tiles metadata interpretation', () => {
  it('leaves the native mesh unchanged by default', () => {
    expect(osmBuildingStyleRules('native')).toBeUndefined();
  });
  it('styles from observed material and roof tags with a neutral fallback', () => {
    const wall = osmBuildingStyleRules('wall-material')!;
    expect(wall.color.conditions.some(([rule]) => rule.includes('building:material'))).toBe(true);
    expect(wall.color.conditions.at(-1)).toEqual(['true', "color('#dfe8ef')"]);
    const roof = osmBuildingStyleRules('roof-shape')!;
    expect(roof.color.conditions.some(([rule]) => rule.includes('roof:shape'))).toBe(true);
    expect(roof.color.conditions.at(-1)?.[0]).toBe('true');
  });
  it('distinguishes OSM height tags from Cesium estimates', () => {
    const rules = osmBuildingStyleRules('height-evidence')!;
    expect(rules.color.conditions[0]?.[0]).toContain("feature['height']");
    expect(rules.color.conditions[1]?.[0]).toContain("feature['cesium#estimatedHeight']");
    const getProperty = (name: string) => ({
      elementType: 'way', elementId: '42', building: 'house',
      'cesium#estimatedHeight': 9, 'roof:shape': 'gabled',
    } as Record<string, unknown>)[name];
    const picked = inspectOsmBuilding({ getProperty });
    expect(picked.title).toContain('OSM building');
    expect(picked.detail).toContain('way:42');
    expect(picked.detail).toContain('estimated height: 9 m (not measured)');
    expect(picked.detail).toContain('roof shape tag: gabled');
    expect(picked.detail).not.toContain('OSM height tag:');
  });
  it('does not promote a recorded OSM height to surveyed or fabricate missing attributes', () => {
    const direct = inspectOsmBuilding({ getProperty: (key) => key === 'height' ? '12 ft' : undefined });
    expect(direct.detail).toContain('height tag: 12 ft (units/source not verified)');
    expect(direct.detail).not.toContain('estimated height');
    const empty = inspectOsmBuilding({ getProperty: () => undefined });
    expect(empty.detail).toContain('building height not recorded');
    expect(empty.detail).not.toContain('roof shape tag');
  });
  it('bounds untrusted attributes and excludes object-valued tags', () => {
    const value = inspectOsmBuilding({ getProperty: (key) => key === 'name' ? 'x'.repeat(2000) : { private: 'data' } });
    expect(value.title.length).toBeLessThan(115);
    expect(value.detail).not.toContain('data');
  });
});
