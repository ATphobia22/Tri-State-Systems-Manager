import { describe, expect, it } from 'vitest';
import { bridgeSwiftGaugeStation } from './swift-data-fabric-bridge';

const good = {
  id: 'USGS-03378500',
  name: 'Wabash River at Mount Carmel, IN',
  latitude: 38.4103,
  longitude: -87.7589,
  stageFt: 10.0,
  gageZeroNavd88Ft: 371.1,
  navd88WseFt: 381.1,
  status: 'STALE',
  provenanceSignature: 'sig',
};

describe('swift-data-fabric-bridge', () => {
  it('accepts a consistent payload and maps status', () => {
    const r = bridgeSwiftGaugeStation(good);
    expect(r.rejected).toBeNull();
    expect(r.station?.id).toBe('USGS-03378500');
    expect(r.mappedStatus).toBe('stale');
  });

  it('rejects internally inconsistent WSE', () => {
    const r = bridgeSwiftGaugeStation({ ...good, navd88WseFt: 999.99 });
    expect(r.station).toBeNull();
    expect(r.rejected).toMatch(/wse inconsistent/);
  });

  it('rejects non-finite and out-of-range values', () => {
    expect(bridgeSwiftGaugeStation({ ...good, stageFt: NaN }).rejected).toMatch(/non-finite/);
    expect(bridgeSwiftGaugeStation({ ...good, latitude: 91 }).rejected).toMatch(/out of range/);
    expect(bridgeSwiftGaugeStation({ ...good, id: '' }).rejected).toMatch(/missing station id/);
  });

  it('maps unknown status strings to unavailable (fail closed)', () => {
    const r = bridgeSwiftGaugeStation({ ...good, status: 'LIVE OBSERVATION' });
    expect(r.mappedStatus).toBe('current');
    const r2 = bridgeSwiftGaugeStation({ ...good, status: 'SOMETHING ELSE' });
    expect(r2.mappedStatus).toBe('unavailable');
  });
});
