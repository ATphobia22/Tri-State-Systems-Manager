import { describe, expect, it } from 'vitest';
import { assertFabricRegistryComplete, TSM_DATA_FABRICS } from '../src/lib/data-fabric-registry';

describe('TSM data-fabric registry', () => {
  it('has no unimplemented registered fabrics', () => expect(() => assertFabricRegistryComplete()).not.toThrow());
  it('keeps Apple and Mapillary non-persistent', () => {
    expect(TSM_DATA_FABRICS.find((f) => f.id === 'apple-maps')?.persistenceAllowed).toBe(false);
    expect(TSM_DATA_FABRICS.find((f) => f.id === 'mapillary')?.persistenceAllowed).toBe(false);
  });
  it('keeps buildings derived rather than authoritative', () => expect(TSM_DATA_FABRICS.find((f) => f.id === 'buildings')?.authority).toBe('DERIVED'));
  it('keeps H3 derived/index-only', () => expect(TSM_DATA_FABRICS.find((f) => f.id === 'spatial-index')?.authority).toBe('DERIVED'));
  it('requires authoritative bathymetry as a distinct evidence fabric', () => {
    const fabric = TSM_DATA_FABRICS.find((f) => f.id === 'bathymetry-topobathy');
    expect(fabric?.authority).toBe('AUTHORITATIVE');
    expect(fabric?.implemented).toBe(true);
    expect(fabric?.notes).toMatch(/LiDAR\/DEM water surfaces are not treated as channel-bed truth/);
  });
  it('binds terrain to the state elevation catalog and open-data registry', () => {\n    const fabric = TSM_DATA_FABRICS.find((f) => f.id === 'terrain-elevation');\n    expect(fabric?.sources).toContain('INDIANA_STATEWIDE_ELEVATION_CATALOG');\n    expect(fabric?.sources).toContain('AWS_OPEN_DATA_REGISTRY');\n    expect(fabric?.notes).toMatch(/never becomes survey\/FEMA certification/);\n  });\n  it('registers the fail-closed engineering evidence pipeline', () => {
    expect(TSM_DATA_FABRICS.find((f) => f.id === 'engineering-evidence-pipeline')?.plane).toBe('GOVERNANCE_DECISION');
  });
});
