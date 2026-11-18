import { describe, expect, it } from 'vitest';
import {
  normalizeCommunityGaugeObservation,
  sanitizeGaugeValue,
  type RiverGaugeDefinition,
} from '../src/lib/river-gauges';

const station: RiverGaugeDefinition = {
  id: 'usgs-03322420',
  provider: 'USGS',
  name: 'Ohio River at Uniontown Dam',
  river: 'Ohio River',
  usgsId: '03322420',
  variables: ['00065', '00060'],
  status: 'active',
};
const now = Date.parse('2026-11-18T02:00:00Z');
const observedAt = '2026-11-18T01:59:00Z';

describe('USGS/NWPS community gauge numeric integrity', () => {
  it('rejects all configured no-data sentinels, missing and non-finite numeric values', () => {
    for (const input of [-999, -9999, -8888, NaN, Infinity, -Infinity, null, undefined, false, '12', '']) {
      expect(sanitizeGaugeValue(input)).toBeNull();
    }
    expect(sanitizeGaugeValue(0)).toBe(0);
    expect(sanitizeGaugeValue(-2.1)).toBe(-2.1);
    expect(sanitizeGaugeValue(15.31)).toBe(15.31);
  });

  it('makes an invalid stage unavailable without inventing zero', () => {
    const result = normalizeCommunityGaugeObservation(station, {
      value: -9999, dischargeCfs: -8888, observedAt, provider: 'USGS', status: 'current',
    }, now, 30 * 60_000, 'tsm-community');
    expect(result.value).toBeNull();
    expect(result.dischargeCfs).toBeNull();
    expect(result.status).toBe('unavailable');
  });

  it('preserves valid discharge if only stage is an invalid sentinel', () => {
    const result = normalizeCommunityGaugeObservation(station, {
      value: -999, dischargeCfs: 20500, observedAt, provider: 'USGS',
    }, now, 30 * 60_000, 'tsm-community');
    expect(result.value).toBeNull();
    expect(result.dischargeCfs).toBe(20500);
    expect(result.status).toBe('current');
  });

  it('never labels last-known-good cached data current, even when observation time is fresh', () => {
    const result = normalizeCommunityGaugeObservation(station, {
      value: 15.2, observedAt, provider: 'USGS',
    }, now, 30 * 60_000, 'lkg');
    expect(result.value).toBe(15.2);
    expect(result.status).toBe('stale');
    expect(result.provenancePath).toBe('lkg');
  });

  it('does not override a source-level unavailable decision with numerically valid data', () => {
    const result = normalizeCommunityGaugeObservation(station, {
      value: 15.2, observedAt, provider: 'USGS', status: 'unavailable',
    }, now, 30 * 60_000, 'tsm-community');
    expect(result.status).toBe('unavailable');
  });
});
