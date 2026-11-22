import { describe, expect, it } from 'vitest';
import { encodePlusCode } from '../src/lib/plusCodes';
import { resolveAtlasPlusCode } from '../src/lib/atlas-location-code';
import { createAtlasFallbackStyle, isAtlasBasemapError } from '../src/lib/atlas-basemap-recovery';

describe('offline Atlas reference coordinates', () => {
  it('uses the vendored, offline Plus Code algorithm for regional navigation', () => {
    const code = encodePlusCode(37.932132, -87.895591, 10);
    const actual = resolveAtlasPlusCode(`  ${code.toLowerCase()}  `);
    expect(actual.code).toBe(code);
    expect(actual.latitude).toBeCloseTo(37.932132, 3);
    expect(actual.longitude).toBeCloseTo(-87.895591, 3);
  });
  it('rejects ambiguous short codes, low precision, and arbitrary external locations', () => {
    expect(() => resolveAtlasPlusCode('not a code')).toThrow(/full Plus Code/);
    expect(() => resolveAtlasPlusCode('CWC8+R9')).toThrow(/full Plus Code/);
    expect(() => resolveAtlasPlusCode(encodePlusCode(37.932132, -87.895591, 8))).toThrow(/at least a 10/);
    expect(() => resolveAtlasPlusCode(encodePlusCode(40.7128, -74.0060, 10))).toThrow(/outside the Tri-State/);
  });
});

describe('fail-open map style recovery with explicit evidence warning', () => {
  it('has no fabricated map sources or external service dependencies in the fallback style', () => {
    const style = createAtlasFallbackStyle();
    expect(style.version).toBe(8);
    expect(style.sources).toEqual({});
    expect(style.layers).toHaveLength(1);
    expect(style.layers[0].type).toBe('background');
  });
  it('only escalates failed style acquisition, not routine imagery tile errors', () => {
    expect(isAtlasBasemapError('Failed to fetch https://tiles.openfreemap.org/styles/liberty')).toBe(true);
    expect(isAtlasBasemapError('Style load failed')).toBe(true);
    expect(isAtlasBasemapError('HTTP 503 Indiana imagery tile')).toBe(false);
  });
});
