import { describe, expect, it } from 'vitest';
import { ACTIVE_RIVER_GAUGES, createUnavailableGauge, transitionGauge } from '../frontend/river-gauges';
import { reconcileVerticalDatum } from '../../backend/datum-middleware';

describe('V35.1 fail-closed contracts', () => {
  it('never creates an observation-bearing gauge from missing source data', () => {
    const gauge = createUnavailableGauge(ACTIVE_RIVER_GAUGES[0]);
    expect(gauge.state).toBe('SOURCE_UNAVAILABLE');
    expect(gauge.stageFt).toBeNull();
    expect(gauge.dischargeCfs).toBeNull();
  });

  it('requires an authoritative datum transformation', () => {
    const observation = {
      value: 10, unit: 'ft' as const, datum: 'GAGE_DATUM' as const,
      observedAt: '2026-09-18T00:00:00Z', stationId: '03378500',
      provenance: { tokenId: 'x', authority: 'USGS', sourceUri: 'https://example.gov', transformationId: 'x', issuedAt: '2026-09-18T00:00:00Z', sha256: 'abc' },
    };
    expect(() => reconcileVerticalDatum(observation, null)).toThrow();
  });
});
