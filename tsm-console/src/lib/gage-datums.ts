/**
 * USGS / NWS gage datum conversion table (Posey Tri-State focus)
 *
 * CRITICAL: Gage height (parameter 00065) is relative to the published
 * gage zero / gage datum. It is NOT a NAVD88 orthometric height until
 * conversion is applied:
 *
 *   WSE_NAVD88 ≈ gage_height_ft + gage_zero_navd88_ft
 *
 * Sources: USGS NWIS site pages, NWS NWPS vertical datum tables.
 * Always re-verify against waterdata.usgs.gov before PE use.
 *
 * TSM must never stamp raw gage height with vertical_datum: 'NAVD88'.
 */

export type VerticalReference =
  | 'GAGE_DATUM'
  | 'NAVD88'
  | 'NGVD29'
  | 'UNKNOWN';

export interface GageDatumRecord {
  id: string;
  name: string;
  agency: 'USGS' | 'NWS' | 'USACE';
  usgsId?: string;
  nwsId?: string;
  lat: number;
  lon: number;
  /** Elevation of gage zero in NAVD88 feet when published */
  gageZeroNavd88Ft: number | null;
  /** Legacy NGVD29 zero if known */
  gageZeroNgvd29Ft?: number | null;
  /** Vertical accuracy of gage zero (ft) when published */
  gageZeroAccuracyFt?: number | null;
  sourceUri: string;
  notes: string;
  /** When true, conversion is published and may be used for WSE_NAVD88 */
  conversionPublished: boolean;
  lastVerified: string;
}

/**
 * Published conversion table — extend only with cited USGS/NWS values.
 */
export const GAGE_DATUM_TABLE: Record<string, GageDatumRecord> = {
  '03378500': {
    id: '03378500',
    name: 'Wabash River at New Harmony, IN',
    agency: 'USGS',
    usgsId: '03378500',
    lat: 38.13089124,
    lon: -87.9414145,
    gageZeroNavd88Ft: 352.71,
    gageZeroAccuracyFt: 0.02,
    sourceUri: 'https://waterdata.usgs.gov/monitoring-location/USGS-03378500/',
    notes:
      'USGS peak/site metadata: gage datum 352.71 ft above NAVD88. Historical publications referenced NGVD29 ~353.20 ft; use current NWIS NAVD88 value.',
    conversionPublished: true,
    lastVerified: '2026-09-02',
  },
  '03322000': {
    id: '03322000',
    name: 'Ohio River at Evansville, IN',
    agency: 'USGS',
    usgsId: '03322000',
    nwsId: 'EVVI3',
    lat: 37.9722644,
    lon: -87.5764045,
    gageZeroNavd88Ft: 328.38,
    gageZeroNgvd29Ft: 328.7,
    gageZeroAccuracyFt: 0.05,
    sourceUri: 'https://water.noaa.gov/gauges/evvi3',
    notes:
      'NWS vertical datum table: Gauge Zero NAVD88 328.38 ft / NGVD29 328.70 ft. Aligns with USGS site elevation ~328.32 ft NAVD88.',
    conversionPublished: true,
    lastVerified: '2026-09-02',
  },
  MTVI3: {
    id: 'MTVI3',
    name: 'Ohio River at Mount Vernon, IN',
    agency: 'NWS',
    nwsId: 'MTVI3',
    lat: 37.9286,
    lon: -87.8956,
    gageZeroNavd88Ft: null,
    sourceUri: 'https://api.water.noaa.gov/nwps/v1/gauges/MTVI3',
    notes:
      'Primary NWS AHPS/NWPS gauge for Mount Vernon. Gage-zero NAVD88 not locked in TSM until NWPS/USGS publish explicit zero; treat stage as GAGE_DATUM only.',
    conversionPublished: false,
    lastVerified: '2026-09-02',
  },
  UNWK2: {
    id: 'UNWK2',
    name: 'Ohio River at John T. Myers Lock and Dam',
    agency: 'NWS',
    usgsId: '03322420',
    nwsId: 'UNWK2',
    lat: 37.7833,
    lon: -87.9794,
    gageZeroNavd88Ft: null,
    sourceUri: 'https://water.noaa.gov/gauges/unwk2',
    notes:
      'USACE John T. Myers L&D (Ohio RM ~846). NWS stages: action 33 / minor 37 / moderate 49 / major 60 / record 64.4 ft. Pool elev ~342 ft MSL class per navigation tables — confirm before NAVD88 conversion.',
    conversionPublished: false,
    lastVerified: '2026-09-02',
  },
  '03322420': {
    id: '03322420',
    name: 'Ohio River at John T. Myers Lock and Dam (USGS)',
    agency: 'USGS',
    usgsId: '03322420',
    nwsId: 'UNWK2',
    lat: 37.7833,
    lon: -87.9794,
    gageZeroNavd88Ft: null,
    sourceUri: 'https://waterdata.usgs.gov/monitoring-location/USGS-03322420/',
    notes: 'USGS companion ID for Myers L&D; pair with UNWK2 NWS product. Conversion unpublished until site elev locked.',
    conversionPublished: false,
    lastVerified: '2026-09-02',
  },
};

export interface StageConversionResult {
  gageHeightFt: number;
  verticalReference: VerticalReference;
  wseNavd88Ft: number | null;
  gageZeroNavd88Ft: number | null;
  conversionApplied: boolean;
  conversionPublished: boolean;
  disclaimer: string;
}

/**
 * Convert gage height → optional WSE in NAVD88.
 * Never invent a zero: if unpublished, wseNavd88Ft stays null.
 */
export function convertGageHeightToNavd88(
  gageId: string,
  gageHeightFt: number,
): StageConversionResult {
  const rec = GAGE_DATUM_TABLE[gageId];
  const disclaimerBase =
    'PROVISIONAL data subject to revision. Gage height is relative to gage datum, not automatically NAVD88.';

  if (!rec) {
    return {
      gageHeightFt,
      verticalReference: 'GAGE_DATUM',
      wseNavd88Ft: null,
      gageZeroNavd88Ft: null,
      conversionApplied: false,
      conversionPublished: false,
      disclaimer: `${disclaimerBase} Unknown gage id ${gageId} — no conversion applied.`,
    };
  }

  if (!rec.conversionPublished || rec.gageZeroNavd88Ft == null) {
    return {
      gageHeightFt,
      verticalReference: 'GAGE_DATUM',
      wseNavd88Ft: null,
      gageZeroNavd88Ft: rec.gageZeroNavd88Ft,
      conversionApplied: false,
      conversionPublished: false,
      disclaimer: `${disclaimerBase} ${rec.name}: conversion not published in TSM table.`,
    };
  }

  const wse = gageHeightFt + rec.gageZeroNavd88Ft;
  return {
    gageHeightFt,
    verticalReference: 'NAVD88',
    wseNavd88Ft: wse,
    gageZeroNavd88Ft: rec.gageZeroNavd88Ft,
    conversionApplied: true,
    conversionPublished: true,
    disclaimer: `${disclaimerBase} WSE_NAVD88 = gage_height (${gageHeightFt}) + gage_zero (${rec.gageZeroNavd88Ft}) = ${wse.toFixed(2)} ft. Verify against current USGS/NWS before regulatory use.`,
  };
}

/** Evidence metadata helper — never claim NAVD88 on raw stage */
export function stageVerticalMetadata(gageId: string, conversion: StageConversionResult) {
  return {
    vertical_reference_raw: 'GAGE_DATUM' as const,
    vertical_reference_converted: conversion.conversionApplied ? ('NAVD88' as const) : null,
    gage_zero_navd88_ft: conversion.gageZeroNavd88Ft,
    wse_navd88_ft: conversion.wseNavd88Ft,
    conversion_published: conversion.conversionPublished,
    authority_note:
      'Raw parameter 00065 / NWPS primary is GAGE_DATUM. NAVD88 only when conversionPublished and applied.',
  };
}
