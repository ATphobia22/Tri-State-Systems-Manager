import { describe, expect, it } from 'vitest';
import { convertGageHeightToNavd88 } from '../src/lib/gage-datums';

describe('New Harmony vertical datum contract', () => {
  it('uses the published 352.67 ft NAVD88 streamgage datum', () => {
    const result = convertGageHeightToNavd88('03378500', 4.31);
    expect(result.conversionPublished).toBe(true);
    expect(result.gageZeroNavd88Ft).toBe(352.67);
    expect(result.wseNavd88Ft).toBeCloseTo(356.98, 2);
  });

  it('does not treat the 352.71 ft monitoring-location altitude as gage zero', () => {
    const result = convertGageHeightToNavd88('03378500', 4.31);
    expect(result.gageZeroNavd88Ft).not.toBe(352.71);
    expect(result.wseNavd88Ft).not.toBeCloseTo(357.02, 2);
  });

  it('keeps unknown station conversions blocked', () => {
    const result = convertGageHeightToNavd88('unknown', 4.31);
    expect(result.conversionApplied).toBe(false);
    expect(result.wseNavd88Ft).toBeNull();
  });
});
