import { cellToParent, isValidCell } from 'h3-js';
import { describe, expect, it } from 'vitest';
import {
  BONEBANK_GEOCODED_LAT,
  BONEBANK_GEOCODED_LNG,
  BONEBANK_SITE_CONSTANTS,
  scientificSiteSnapshot,
} from '../src/lib/scientific-analytics';

describe('scientificSiteSnapshot', () => {
  it('computes deterministic freeboard margins vs BFE', () => {
    const snap = scientificSiteSnapshot();
    expect(snap.freeboardMargins.lagFreeboard).toBe(2.2);
    expect(snap.freeboardMargins.ffeFreeboard).toBe(7.5);
    expect(snap.freeboardMargins.bermFreeboard).toBe(4.8);
  });

  it('derives a strict H3 parent chain res10 -> res8 -> res5', () => {
    const snap = scientificSiteSnapshot();
    expect(isValidCell(snap.h3Cells.res10)).toBe(true);
    expect(isValidCell(snap.h3Cells.res8)).toBe(true);
    expect(isValidCell(snap.h3Cells.res5)).toBe(true);
    expect(cellToParent(snap.h3Cells.res10, 8)).toBe(snap.h3Cells.res8);
    expect(cellToParent(snap.h3Cells.res10, 5)).toBe(snap.h3Cells.res5);
  });

  it('uses the geocoded Bonebank defaults and site id', () => {
    const snap = scientificSiteSnapshot();
    expect(snap.siteId).toBe('13101-BONEBANK-ROAD-PTDT-V35');
    expect(snap.location.lat).toBe(BONEBANK_GEOCODED_LAT);
    expect(snap.location.lng).toBe(BONEBANK_GEOCODED_LNG);
    expect(snap.elevations).toEqual(BONEBANK_SITE_CONSTANTS);
  });

  it('respects caller-supplied coordinates and constants', () => {
    const snap = scientificSiteSnapshot(38.0, -87.5, {
      BFE: 400,
      LAG: 401.5,
      FFE: 405,
      BERM: 403,
    });
    expect(snap.freeboardMargins.lagFreeboard).toBe(1.5);
    expect(snap.freeboardMargins.ffeFreeboard).toBe(5);
    expect(snap.freeboardMargins.bermFreeboard).toBe(3);
    expect(snap.location).toEqual({ lat: 38.0, lng: -87.5 });
  });

  it('carries uncertainty and honest governance metadata', () => {
    const snap = scientificSiteSnapshot();
    expect(snap.uncertainty.datum).toBe('NAVD88');
    expect(snap.uncertainty.horizontalCrs).toBe('EPSG:2966');
    expect(snap.uncertainty.verticalRmseFt).toBe(0.33);
    expect(snap.governance.evidenceStatus).toBe('OWNER_SUPPLIED');
    expect(snap.governance.humanOversightRequired).toBe(true);
    // The repo forbids self-certifying Daubert compliance in code.
    expect('daubertCompliant' in snap.governance).toBe(false);
  });

  it('fails closed on non-finite elevation constants', () => {
    expect(() =>
      scientificSiteSnapshot(38.0, -87.5, {
        BFE: 375,
        LAG: Number.NaN,
        FFE: 382.5,
        BERM: 379.8,
      }),
    ).toThrow(/Invalid site elevation constant/);
  });

  it('fails closed on out-of-range coordinates', () => {
    expect(() => scientificSiteSnapshot(91, -88)).toThrow();
    expect(() => scientificSiteSnapshot(37.8, -181)).toThrow();
  });
});
