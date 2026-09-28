import { describe, expect, it } from 'vitest';
import {
  computeEarthwork,
  estimateDredgeSourcing,
  screenPlacement,
  section204CostShare,
  type AlignmentStation,
  type TypicalSection,
} from './berm-road-placement';
import { summarizeFieldExposure, summarizePlantingHistory } from '../agriculture/ag-screening';

const section: TypicalSection = {
  kind: 'flood-berm',
  crestWidthFt: 12,
  crestElevFt: 380,
  sideSlopeHV: 3,
  dredgeFillFraction: 0.8,
};

const stations: AlignmentStation[] = [
  { stationFt: 0, groundElevFt: 376 },
  { stationFt: 500, groundElevFt: 375 },
  { stationFt: 1000, groundElevFt: 377 },
];

describe('berm-road-placement', () => {
  it('computes positive fill volumes for a berm above grade', () => {
    const result = computeEarthwork(stations, section);
    expect(result.fillCubicYards).toBeGreaterThan(0);
    expect(result.cutCubicYards).toBe(0);
    expect(result.alignmentLengthFt).toBe(1000);
    expect(result.derivation).toBe('inform-only-screening-estimate');
  });

  it('rejects non-increasing stations', () => {
    expect(() =>
      computeEarthwork(
        [
          { stationFt: 0, groundElevFt: 376 },
          { stationFt: 0, groundElevFt: 376 },
        ],
        section,
      ),
    ).toThrow();
  });

  it('estimates dredge demand from the fill fraction', () => {
    const earthwork = computeEarthwork(stations, section);
    const dredge = estimateDredgeSourcing(earthwork, section, 12);
    expect(dredge.dredgeCubicYards).toBe(Math.round(earthwork.netImportCubicYards * 0.8));
    expect(dredge.haulCostUsd).toBeGreaterThan(0);
  });

  it('applies the 65/35 Section 204 split and flags the ceiling', () => {
    const small = section204CostShare(1_000_000);
    expect(small.federalShareUsd).toBe(650_000);
    expect(small.sponsorShareUsd).toBe(350_000);
    expect(small.ceilingBinding).toBe(false);

    const big = section204CostShare(100_000_000);
    expect(big.federalShareUsd).toBe(15_000_000);
    expect(big.ceilingBinding).toBe(true);
  });

  it('produces a full screening with a sim delta', () => {
    const screening = screenPlacement(stations, section, { haulMiles: 12 });
    expect(screening.scenarioDelta.kind).toBe('terrain-modification');
    expect(screening.scenarioDelta.backwaterScreenRequired).toBe(true);
  });
});

describe('ag-screening', () => {
  it('rolls up field exposure and flags the CRP conversation threshold', () => {
    const summary = summarizeFieldExposure({
      fieldId: 'field-1',
      parcelId: 'parcel-1',
      totalAcres: 100,
      sfhaAcresByZone: { AE: 60, X: 5 },
      worstZone: 'AE',
    });
    expect(summary.sfhaAcres).toBe(65);
    expect(summary.sfhaPct).toBe(65);
    expect(summary.chronicallyFloodedScreen).toBe(true);
  });

  it('summarizes a 5-year flood-event log', () => {
    const summary = summarizePlantingHistory('field-1', [
      { fieldId: 'field-1', eventDate: '2024-05-01', source: 'owner-observation', estimatedAcresAffected: 40, notes: 'spring flood' },
      { fieldId: 'field-1', eventDate: '2023-06-15', source: 'fsa-record', estimatedAcresAffected: 55, notes: '' },
      { fieldId: 'field-1', eventDate: '2019-04-01', source: 'owner-observation', estimatedAcresAffected: 30, notes: 'too old' },
    ], '2026-09-27');
    expect(summary.eventsInLast5Years).toBe(2);
    expect(summary.meetsDiscussionThreshold).toBe(true);
  });
});
