/**
 * Scientific site-snapshot analytics for the Bonebank operational node.
 *
 * Computes deterministic freeboard margins (elevation above Base Flood
 * Elevation) and multi-resolution H3 spatial indexes for a site. All
 * elevation constants are owner-supplied and overridable via parameters;
 * nothing here is independently verified by the repository.
 *
 * Governance honesty note: FRE 702 (Daubert) admissibility is a legal
 * determination made by a court — it is not a boolean computable in code.
 * The repository's canonical plane map
 * (data/schemas/tsm-four-plane-architecture-v1.json) explicitly forbids
 * self-certifying compliance claims, so this module carries
 * `evidenceStatus: 'OWNER_SUPPLIED'` and `humanOversightRequired: true`
 * instead of asserting verified/compliant status.
 *
 * Coordinate note: the default site coordinates below are the independently
 * geocoded address point for 13101 Bonebank Rd (37.84589, -88.0051).
 * Owner PTDT documents assert a surveyed centroid of (37.9035, -88.0007).
 * The ~6.4 km discrepancy is unresolved — reconcile against the certified
 * elevation survey before using H3 cells derived from the default for any
 * regulatory purpose.
 */
import { cellToParent, isValidCell } from 'h3-js';
import { toH3Cell } from './h3-spatial-fabric';

export interface SiteElevationConstants {
  /** Base Flood Elevation, ft NAVD88 */
  readonly BFE: number;
  /** Lowest Adjacent Grade, ft NAVD88 */
  readonly LAG: number;
  /** First Floor Elevation, ft NAVD88 */
  readonly FFE: number;
  /** Protective berm crest elevation, ft NAVD88 */
  readonly BERM: number;
}

/**
 * Elevation constants for the Bonebank operational node.
 * Source: FEMA FIS 18129CV000A Table 9, Section A (RM 844.75):
 * regulatory BFE 369.1 ft NAVD88 (corrected 2026-10-18 from 375.0 ft
 * working target in Bonebank_LOMA_Checklist.pdf). LAG 377.20 ft owner-supplied.
 * Override per-site via the `siteConstants` parameter —
 * these defaults describe one property, not the region.
 */
export const BONEBANK_SITE_CONSTANTS: SiteElevationConstants = {
  BFE: 369.1,
  LAG: 377.2,
  FFE: 382.5,
  BERM: 379.8,
} as const;

/** Independently geocoded address point for 13101 Bonebank Rd (see note above). */
export const BONEBANK_GEOCODED_LAT = 37.84589;
export const BONEBANK_GEOCODED_LNG = -88.0051;

export interface ScientificSnapshotResult {
  readonly siteId: string;
  readonly location: { readonly lat: number; readonly lng: number };
  readonly h3Cells: {
    /** Terrain / sensor scale (~66 m edge) */
    readonly res10: string;
    /** Site envelope (~0.46 km^2) */
    readonly res8: string;
    /** Basin / multi-county scale */
    readonly res5: string;
  };
  readonly elevations: SiteElevationConstants;
  readonly freeboardMargins: {
    readonly lagFreeboard: number;
    readonly ffeFreeboard: number;
    readonly bermFreeboard: number;
  };
  readonly uncertainty: {
    readonly verticalRmseFt: number;
    readonly datum: string;
    readonly horizontalCrs: string;
    readonly note: string;
  };
  readonly governance: {
    readonly evidenceStatus: 'OWNER_SUPPLIED';
    readonly humanOversightRequired: true;
  };
}

function requireFiniteElevation(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid site elevation constant ${name}: ${value}`);
  }
}

/**
 * Build a deterministic scientific snapshot for a site.
 *
 * Freeboard margins are simple differences vs BFE, rounded to 2 decimals.
 * H3 cells form a strict parent chain: res10 -> res8 -> res5.
 * Throws (resilient) on non-finite elevation constants or coordinates.
 */
export function scientificSiteSnapshot(
  lat: number = BONEBANK_GEOCODED_LAT,
  lng: number = BONEBANK_GEOCODED_LNG,
  siteConstants: SiteElevationConstants = BONEBANK_SITE_CONSTANTS,
): ScientificSnapshotResult {
  for (const [name, value] of Object.entries(siteConstants) as Array<[string, number]>) {
    requireFiniteElevation(value, name);
  }

  const res10 = toH3Cell(lat, lng, 10);
  const res8 = cellToParent(res10, 8);
  const res5 = cellToParent(res10, 5);
  if (!isValidCell(res10) || !isValidCell(res8) || !isValidCell(res5)) {
    throw new Error('Derived H3 cells failed validation.');
  }

  const round2 = (n: number): number => Number(n.toFixed(2));

  return {
    siteId: '13101-BONEBANK-ROAD-PTDT-V35',
    location: { lat, lng },
    h3Cells: { res10, res8, res5 },
    elevations: siteConstants,
    freeboardMargins: {
      lagFreeboard: round2(siteConstants.LAG - siteConstants.BFE),
      ffeFreeboard: round2(siteConstants.FFE - siteConstants.BFE),
      bermFreeboard: round2(siteConstants.BERM - siteConstants.BFE),
    },
    uncertainty: {
      verticalRmseFt: 0.33,
      datum: 'NAVD88',
      horizontalCrs: 'EPSG:2966',
      note: 'QL2-class RMSE is catalog context only — not a site survey accuracy claim',
    },
    governance: {
      evidenceStatus: 'OWNER_SUPPLIED',
      humanOversightRequired: true,
    },
  };
}
