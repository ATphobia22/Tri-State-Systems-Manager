import { describe, expect, it } from 'vitest';
import { calculateStructuralClearance, interpolateSiteWseIdw } from '../src/lib/hydrologic-clearance';

describe('hydrologic site transfer guards', () => {
  it('rejects IDW from a single station observation', () => {
    expect(() => interpolateSiteWseIdw(38.13, -87.94, [{
      id: '03378500',
      lat: 38.13,
      lon: -87.94,
      wseNavd88Ft: 356.98,
      verification: 'HYDRAULIC_PROFILE_VERIFIED',
    }])).toThrow(/at least two/i);
  });

  it('calculates freeboard only from explicitly verified elevations', () => {
    const result = calculateStructuralClearance({
      assetId: 'TEST',
      name: 'Test structure',
      lat: 38,
      lon: -88,
      lagNavd88Ft: 377.2,
      ffeNavd88Ft: 378.5,
      bfeNavd88Ft: 375,
      lagVerification: 'SURVEY_VERIFIED',
      ffeVerification: 'UNVERIFIED',
      bfeVerification: 'FEMA_FIS_VERIFIED',
    }, 356.98);

    expect(result.lagClearanceFt).toBe(20.22);
    expect(result.ffeClearanceFt).toBeNull();
    expect(result.bfeClearanceFt).toBe(18.02);
    expect(result.status).toBe('VERIFIED');
  });
});
