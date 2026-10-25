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
    const screening = screenPlacement(stations, section, { haulMiles: 12, unitConstructionCostPerCy: 28 });
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
    // FEMA Zone X is *not* the 1%-annual-chance SFHA.
    expect(summary.sfhaAcres).toBe(60);
    expect(summary.sfhaPct).toBe(60);
    expect(summary.chronicallyFloodedScreen).toBe(true);
  });

  it('distinguishes X, X500 and D from FEMA 1%-annual-chance SFHA', () => {
    const summary = summarizeFieldExposure({
      fieldId: 'field-2', parcelId: 'parcel-2', totalAcres: 100,
      sfhaAcresByZone: { AE: 19.75, X: 20, X500: 30, D: 20 }, worstZone: 'AE',
    });
    expect(summary.sfhaAcres).toBe(19.8);
    expect(summary.sfhaPct).toBe(19.75);
    expect(summary.chronicallyFloodedScreen).toBe(false);
  });

  it('rejects impossible or unrecognized zone areas rather than silently repairing them', () => {
    const base = {
      fieldId: 'field', parcelId: 'parcel', totalAcres: 10,
      sfhaAcresByZone: { AE: 3 }, worstZone: 'AE',
    };
    expect(() => summarizeFieldExposure({ ...base, sfhaAcresByZone: { AE: 12 } })).toThrow(/exceed total/);
    expect(() => summarizeFieldExposure({ ...base, sfhaAcresByZone: { AE: 6, X: 6 } })).toThrow(/exceed total/);
    expect(() => summarizeFieldExposure({ ...base, sfhaAcresByZone: { AE: Number.NaN } })).toThrow(/finite/);
    expect(() => summarizeFieldExposure({ ...base, sfhaAcresByZone: { AE: -3 } })).toThrow(/nonnegative/);
    expect(() => summarizeFieldExposure({ ...base, sfhaAcresByZone: { UNSPECIFIED: 3 } })).toThrow(/unknown FEMA/);
    expect(() => summarizeFieldExposure({ ...base, worstZone: 'X' })).toThrow(/provided/);
  });

  it('handles mapped legacy 1%-chance zones without counting X', () => {
    const summary = summarizeFieldExposure({
      fieldId: 'field', parcelId: 'parcel', totalAcres: 20,
      sfhaAcresByZone: { A12: 4, V25: 1, X: 15 }, worstZone: 'A12',
    });
    expect(summary.sfhaAcres).toBe(5);
    expect(summary.sfhaPct).toBe(25);
  });

  it('rejects future, negative or non-finite planting events and invalid calendar dates', () => {
    const fields = { fieldId: 'field-1', source: 'owner-observation' as const, notes: '' };
    const valid = { ...fields, eventDate: '2023-07-10', estimatedAcresAffected: 5 };
    const future = { ...fields, eventDate: '2028-07-10', estimatedAcresAffected: 5 };
    expect(summarizePlantingHistory('field-1', [valid, future], '2026-10-25').eventsInLast5Years).toBe(1);
    expect(() => summarizePlantingHistory('field-1', [{ ...valid, estimatedAcresAffected: -1 }], '2026-10-25')).toThrow(/nonnegative/);
    expect(() => summarizePlantingHistory('field-1', [{ ...valid, estimatedAcresAffected: Infinity }], '2026-10-25')).toThrow(/finite/);
    expect(() => summarizePlantingHistory('field-1', [{ ...valid, eventDate: '2024-02-30' }], '2026-10-25')).toThrow(/calendar date/);
    expect(() => summarizePlantingHistory('field-1', [valid], 'not-a-date')).toThrow(/YYYY-MM-DD/);
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
