/**
 * USGS / NWS gage datum conversion table (Posey Tri-State focus)
 *
 * WSE_NAVD88 ≈ gage_height_ft + gage_zero_navd88_ft
 *
 * Verified 2026-09-02 against NWS AHPS vertical datum tables + USGS site metadata.
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
  gageZeroNavd88Ft: number | null;
  gageZeroNgvd29Ft?: number | null;
  gageZeroAccuracyFt?: number | null;
  sourceUri: string;
  notes: string;
  conversionPublished: boolean;
  lastVerified: string;
}

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
      'USGS: gage datum 352.71 ft above NAVD88. Historical pubs NGVD29 ~353.20 ft.',
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
    notes: 'NWS EVVI3 vertical datum table Gauge Zero NAVD88 328.38 / NGVD29 328.70.',
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
    gageZeroNavd88Ft: 318.59,
    gageZeroNgvd29Ft: 318.92,
    sourceUri: 'https://water.noaa.gov/gauges/mtvi3',
    notes:
      'NWS Vertical Datum Table 2026-08-26: Gauge Zero NAVD88 318.59 ft / NGVD29 318.92 ft. Stages: action 28 / minor 35 / moderate 45 / major 52.',
    conversionPublished: true,
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
    gageZeroNavd88Ft: 311.31,
    gageZeroNgvd29Ft: 311.65,
    sourceUri: 'https://water.noaa.gov/gauges/unwk2',
    notes:
      'NWS Vertical Datum Table: Gauge Zero NAVD88 311.31 ft / NGVD29 311.65 ft. Stages: action 33 / minor 37 / moderate 49 / major 60 / record 64.4. USGS companion 03322420.',
    conversionPublished: true,
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
    gageZeroNavd88Ft: 311.31,
    gageZeroNgvd29Ft: 311.65,
    sourceUri: 'https://water.noaa.gov/gauges/unwk2',
    notes: 'Aligned to NWS UNWK2 published zero until USGS site elev supersedes.',
    conversionPublished: true,
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
