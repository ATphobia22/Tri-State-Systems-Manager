/**
 * Geodetic helpers — EPSG:2966 + NAVD88 authority
 * NAD83 → ITRF2014 chain is recorded, not silently executed in-browser.
 */

import type { TransformationStep } from '../types/evidence';
import { SITE } from '../types/site';

export const AUTHORITATIVE_HORIZONTAL_EPSG = 2966;
export const REJECTED_HORIZONTAL_EPSG = [2967] as const;
export const AUTHORITATIVE_VERTICAL = 'NAVD88';

export const PROJ4_EPSG_2966 =
  '+proj=tmerc +lat_0=37.5 +lon_0=-87.0833333333333 +k=0.999966667 +x_0=900000 +y_0=249999.9998984 +ellps=GRS80 +units=us-ft +no_defs';

export function assertAuthoritativeHorizontal(epsg: number | string): void {
  const n = typeof epsg === 'string' ? Number(String(epsg).replace(/EPSG:/i, '')) : epsg;
  if (REJECTED_HORIZONTAL_EPSG.includes(n as 2967)) {
    throw new Error(
      `Rejected CRS EPSG:${n}. Authoritative horizontal CRS is EPSG:${AUTHORITATIVE_HORIZONTAL_EPSG} (NAD83 / Indiana West ftUS).`
    );
  }
  if (n !== AUTHORITATIVE_HORIZONTAL_EPSG) {
    // Allow only with explicit chain — callers must not pretend foreign CRS is 2966
    console.warn(
      `[TSM geodetic] Non-authoritative EPSG:${n} — require transformation_chain before regulatory use.`
    );
  }
}

export function siteSpatialReference() {
  return {
    horizontal_crs: `EPSG:${SITE.crs.horizontalEpsg}`,
    horizontal_crs_name: SITE.crs.horizontalName,
    units: 'US survey feet',
  };
}

export function siteVerticalReference() {
  return {
    vertical_datum: SITE.crs.verticalDatum,
    units: 'ft',
  };
}

/**
 * Template chain: projected 2966 → NAD83 geodetic → ECEF → Helmert → HTDP → ITRF geodetic.
 * Does not compute numeric coordinates in the browser (NGS HTDP/Helmert offline).
 */
export function buildNad83ToItrf2014Chain(opts: {
  observationEpoch: string;
  targetEpoch?: string;
  coseismicApplied?: boolean;
  software?: string;
}): TransformationStep[] {
  const t2 = opts.targetEpoch ?? '2010.0';
  const soft = opts.software ?? 'NGS-HTDP-family (offline)';
  const coseismic = opts.coseismicApplied ?? false;

  return [
    {
      step: 1,
      operation: 'inverse_transverse_mercator',
      from: 'EPSG:2966',
      to: 'NAD83 geodetic',
      software: soft,
      parameters: { units: 'us-ft', note: 'Never Helmert easting/northing directly' },
    },
    {
      step: 2,
      operation: 'geodetic_to_ecef',
      from: 'NAD83 geodetic',
      to: 'NAD83 ECEF',
      software: soft,
      parameters: { epoch: opts.observationEpoch, ellipsoid: 'GRS80' },
    },
    {
      step: 3,
      operation: 'helmert_14_param',
      from: 'NAD83 ECEF',
      to: 'ITRF2014 ECEF',
      software: soft,
      parameters: {
        epoch: opts.observationEpoch,
        translations: 3,
        rotations: 3,
        scale: 1,
        rates: 7,
      },
    },
    {
      step: 4,
      operation: 'htdp_propagate',
      from: `ITRF2014 ECEF@${opts.observationEpoch}`,
      to: `ITRF2014 ECEF@${t2}`,
      software: soft,
      parameters: {
        t1: opts.observationEpoch,
        t2,
        coseismic_applied: coseismic,
        region_note: 'Posey County IN — coseismic typically false',
      },
    },
    {
      step: 5,
      operation: 'ecef_to_geodetic',
      from: `ITRF2014 ECEF@${t2}`,
      to: `ITRF2014 geodetic@${t2}`,
      software: soft,
      parameters: { epoch: t2 },
    },
  ];
}

/** Display lon/lat for MapLibre — not a substitute for 2966 analysis coordinates */
export function siteCenterWgs84(): [number, number] {
  const { minLon, maxLon, minLat, maxLat } = SITE.boundingEnvelope;
  return [(minLon + maxLon) / 2, (minLat + maxLat) / 2];
}

export const GEODETIC_POLICY = {
  analysis_frame: 'EPSG:2966 + NAVD88',
  display_frame: 'WGS84 / Web Mercator (MapLibre)',
  htdp_coseismic_relevant_to_posey: false,
  reject_epsg: REJECTED_HORIZONTAL_EPSG,
} as const;


/** Vertical datum models — names only; grids stay offline (NCAT / NGS) */
export const VERTICAL_MODELS = {
  authoritative: 'NAVD88',
  ellipsoid_to_orthometric: 'GEOID18',
  ngvd29_to_navd88: 'VERTCON3',
  future: 'NAPGD2022',
  reject_new_without_chain: ['NAVD29', 'NGVD29'],
} as const;

export function buildEllipsoidToNavd88Chain(opts: {
  geoidModel?: string;
  software?: string;
}): TransformationStep[] {
  const model = opts.geoidModel ?? 'GEOID18';
  const soft = opts.software ?? 'NGS NCAT / GEOID18';
  return [
    {
      step: 1,
      operation: 'geoid_separation',
      from: 'NAD83 ellipsoid height h',
      to: 'NAVD88 orthometric H',
      software: soft,
      parameters: { model, relation: 'H ≈ h - N' },
    },
  ];
}
