/**
 * Sovereign site constants for 13101 Bonebank Road
 * Source of truth: tsm-site-constants-13101-bonebank.json
 */

export interface SiteConstants {
  address: string;
  township: string;
  county: string;
  state: string;
  region: string;
  apn: string;
  crs: {
    horizontalEpsg: number;
    horizontalName: string;
    verticalDatum: string;
  };
  elevations: {
    bfe_ft: number;
    lag_ft: number;
    ffe_ft: number;
    bermCrest_ft: number;
    clearanceAboveBfe_ft: number;
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
      action: number;
      minor: number;
      moderate: number;
      major: number;
      record: number;
    };
  };
  femaCommunities: {
    mountVernon: string;
    poseyUnincorporated: string;
    newHarmony: string;
  };
}

/** Runtime constant object — never mutate at runtime */
export const SITE: SiteConstants = {
  address: '13101 Bonebank Road',
  township: 'Point Township',
  county: 'Posey County',
  state: 'Indiana',
  region: 'Tri-State River Valley',
  apn: '65-19-08-100-008.001-010',
  crs: {
    horizontalEpsg: 2966,
    horizontalName: 'NAD83 / Indiana West (ftUS)',
    verticalDatum: 'NAVD88',
  },
  elevations: {
    bfe_ft: 375.0,
    lag_ft: 377.2,
    ffe_ft: 382.5,
    bermCrest_ft: 379.8,
    clearanceAboveBfe_ft: 2.2,
  },
  boundingEnvelope: {
    minLon: -88.0150,
    minLat: 37.8920,
    maxLon: -87.9850,
    maxLat: 37.9150,
  },
  noaaGauge: {
    nwsId: 'MTVI3',
    name: 'Ohio River at Mount Vernon',
    lat: 37.9286,
    lon: -87.8956,
    stages: {
      action: 28,
      minor: 35,
      moderate: 45,
      major: 52,
      record: 59.21,
    },
  },
  femaCommunities: {
    mountVernon: '180389',
    poseyUnincorporated: '180209',
    newHarmony: '180210',
  },
};
