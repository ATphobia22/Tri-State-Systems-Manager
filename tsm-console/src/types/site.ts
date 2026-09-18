/**
 * Community region constants used by the console.
 * No private residence, parcel/APN, or house-specific engineering target is stored here.
 * The elevation values are retained only as legacy scenario inputs and are not universal design criteria.
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
    bfe_ft: null,
    lag_ft: null,
    ffe_ft: null,
    bermCrest_ft: null,
    clearanceAboveBfe_ft: null,
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
      action: null,
      minor: null,
      moderate: null,
      major: null,
      record: null,
    },
  },
  femaCommunities: {
    mountVernon: '180389',
    poseyUnincorporated: '180209',
    newHarmony: '180210',
  },
};
