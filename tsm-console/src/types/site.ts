/**
 * Community region constants used by the console.
 * No private residence, parcel/APN, or house-specific engineering target is stored here.
 * Elevation values below are real-world working values with explicit provenance —
 * owner-supplied values are NOT certified surveys and the BFE working value still
 * awaits independent FIRM-panel verification. See elevationsProvenance.
 */

export interface SiteConstants {
  address: string;
  township: string;
  county: string;
  state: string;
  region: string;
  apn: string;
  elevationEvidenceStatus: 'LEGACY_SCENARIO_REQUIRES_PROJECT_EVIDENCE';
  crs: {
    horizontalEpsg: number;
    horizontalName: string;
    verticalDatum: 'UNVERIFIED' | string;
  };
  elevations: {
    bfe_ft: number | null;
    lag_ft: number | null;
    ffe_ft: number | null;
    bermCrest_ft: number | null;
    clearanceAboveBfe_ft: number | null;
  };
  /** Per-value provenance for elevations — shown in the twin UI. Never implies certification. */
  elevationsProvenance: {
    bfe_ft: string;
    lag_ft: string;
    ffe_ft: string;
    bermCrest_ft: string;
    clearanceAboveBfe_ft: string;
  };
  boundingEnvelope: {
    minLon: number;
    minLat: number;
    maxLon: number;
    maxLat: number;
  };
  noaaGauge: {
    nwsId: string;
    name: string;
    lat: number;
    lon: number;
    stages: {
      action: number | null;
      minor: number | null;
      moderate: number | null;
      major: number | null;
      record: number | null;
    };
  };
  femaCommunities: {
    mountVernon: string;
    poseyUnincorporated: string;
    newHarmony: string;
  };
}

export const SITE: SiteConstants = {
  address: 'Lower Wabash-Ohio Confluence Community',
  township: 'Point Township / regional community scope',
  county: 'Posey County',
  state: 'Indiana',
  region: 'Tri-State River Valley',
  apn: 'COMMUNITY_SCOPE',
  elevationEvidenceStatus: 'LEGACY_SCENARIO_REQUIRES_PROJECT_EVIDENCE',
  crs: {
    horizontalEpsg: 2966,
    horizontalName: 'NAD83 / Indiana West (ftUS)',
    verticalDatum: 'UNVERIFIED',
  },
  elevations: {
    bfe_ft: 375.0,
    lag_ft: 377.2,
    ffe_ft: 382.5,
    bermCrest_ft: 379.8,
    clearanceAboveBfe_ft: 2.2,
  },
  elevationsProvenance: {
    bfe_ft: 'Working value per 2026-08-22 Bonebank LOMA checklist; FIRM panel 18129C0300C not independently verified',
    lag_ft: 'Owner-supplied; not a certified survey',
    ffe_ft: 'Owner-supplied; not a certified survey',
    bermCrest_ft: 'Owner-supplied; not a certified survey',
    clearanceAboveBfe_ft: 'Derived: owner-supplied LAG 377.2 minus checklist BFE 375.0',
  },
  boundingEnvelope: {
    minLon: -88.35,
    minLat: 37.55,
    maxLon: -87.55,
    maxLat: 38.35,
  },
  noaaGauge: {
    nwsId: 'NHRI3',
    name: 'Wabash River at New Harmony',
    lat: 38.13089124398878,
    lon: -87.94141452141561,
    stages: {
      action: 10,
      minor: 15,
      moderate: 20,
      major: 23,
      record: 27.7,
    },
  },
  femaCommunities: {
    mountVernon: '180389',
    poseyUnincorporated: '180209',
    newHarmony: '180210',
  },
};
