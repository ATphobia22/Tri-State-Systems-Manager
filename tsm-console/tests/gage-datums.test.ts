import { describe, expect, it } from 'vitest';
import { convertGageHeightToNavd88, GAGE_DATUM_TABLE } from '../src/lib/gage-datums';

describe('New Harmony vertical datum contract', () => {
  it('withholds the candidate 352.67 ft conversion until the SIR/NWPS conflict is resolved', () => {
    const result = convertGageHeightToNavd88('03378500', 4.31);
    expect(GAGE_DATUM_TABLE['03378500'].gageZeroNavd88Ft).toBe(352.67);
    expect(GAGE_DATUM_TABLE['03378500'].conversionPublished).toBe(false);
    expect(result.conversionPublished).toBe(false);
    expect(result.conversionApplied).toBe(false);
    expect(result.gageZeroNavd88Ft).toBeNull();
    expect(result.wseNavd88Ft).toBeNull();
  });

  it('does not treat the 352.71 ft monitoring-location altitude as gage zero', () => {
    const result = convertGageHeightToNavd88('03378500', 4.31);
    expect(result.gageZeroNavd88Ft).not.toBe(352.71);
    expect(result.wseNavd88Ft).toBeNull();
  });

  it('keeps unknown station conversions blocked', () => {
    const result = convertGageHeightToNavd88('unknown', 4.31);
    expect(result.conversionApplied).toBe(false);
    expect(result.wseNavd88Ft).toBeNull();
  });

  it('does not publish conversion for station altitude-only metadata', () => {
    const result = convertGageHeightToNavd88('03322000', 4.31);
    expect(result.conversionPublished).toBe(false);
    expect(result.conversionApplied).toBe(false);
    expect(result.wseNavd88Ft).toBeNull();
  });
});
