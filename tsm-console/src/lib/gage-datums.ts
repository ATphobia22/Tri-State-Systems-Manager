/**
 * Station-specific vertical datum metadata.
 *
 * Raw gage height remains GAGE_DATUM. A NAVD88 WSE is derived only when a
 * current, product-matched published gage-zero relationship is available.
 */
export type VerticalReference = 'GAGE_DATUM' | 'NAVD88' | 'NGVD29' | 'UNKNOWN';

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
    id: '03378500', name: 'Wabash River at New Harmony, IN', agency: 'USGS', usgsId: '03378500',
    lat: 38.13089124, lon: -87.9414145, gageZeroNavd88Ft: null,
    sourceUri: 'https://waterdata.usgs.gov/monitoring-location/USGS-03378500/',
    notes: 'USGS station metadata reports gage/land-surface altitude 352.71 ft NAVD88. This station altitude is not silently treated as a parameter-00065 gage-zero conversion.',
    conversionPublished: false, lastVerified: '2026-09-14',
  },
  '03322000': {
    id: '03322000', name: 'Ohio River at Evansville, IN', agency: 'USGS', usgsId: '03322000', nwsId: 'EVVI3',
    lat: 37.97228264107407, lon: -87.57640285193835, gageZeroNavd88Ft: null,
    sourceUri: 'https://waterdata.usgs.gov/monitoring-location/USGS-03322000/',
    notes: 'USGS station metadata reports gage/land-surface altitude 328.32 ft NAVD88. This station altitude is not silently treated as a parameter-00065 gage-zero conversion.',
    conversionPublished: false, lastVerified: '2026-09-14',
  },
  MTVI3: {
    id: 'MTVI3', name: 'Ohio River at Mount Vernon, IN', agency: 'NWS', nwsId: 'MTVI3',
    lat: 37.9286, lon: -87.8956, gageZeroNavd88Ft: null,
    sourceUri: 'https://water.noaa.gov/gauges/mtvi3',
    notes: 'Conversion withheld until current NWPS station/product metadata explicitly validates the gage-zero relationship.',
    conversionPublished: false, lastVerified: '2026-09-14',
  },
  UNWK2: {
    id: 'UNWK2', name: 'Ohio River at John T. Myers Locks and Dam (NWS context)', agency: 'NWS', usgsId: '03322420', nwsId: 'UNWK2',
    lat: 37.7833, lon: -87.9794, gageZeroNavd88Ft: null,
    sourceUri: 'https://water.noaa.gov/gauges/unwk2',
    notes: 'NWS operational gauge context for John T. Myers Locks and Dam. Conversion withheld until current NWPS station/product metadata explicitly validates the gage-zero relationship.',
    conversionPublished: false, lastVerified: '2026-09-14',
  },
  '03322420': {
    id: '03322420', name: 'OHIO RIVER AT UNIONTOWN DAM, KY', agency: 'USGS', usgsId: '03322420', nwsId: 'UNWK2',
    lat: 37.7971555584685, lon: -87.9983356426059, gageZeroNavd88Ft: null,
    sourceUri: 'https://waterdata.usgs.gov/monitoring-location/USGS-03322420',
    notes: 'Official USGS station identity. USGS metadata reports 310.95 ft NAVD88 gage/land-surface altitude; this is not treated as a tailwater gage-zero conversion.',
    conversionPublished: false, lastVerified: '2026-09-14',
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

export function convertGageHeightToNavd88(gageId: string, gageHeightFt: number): StageConversionResult {
  const rec = GAGE_DATUM_TABLE[gageId];
  const disclaimerBase = 'PROVISIONAL data subject to revision. Gage height is relative to gage datum, not automatically NAVD88.';
  if (!Number.isFinite(gageHeightFt)) return { gageHeightFt, verticalReference: 'GAGE_DATUM', wseNavd88Ft: null, gageZeroNavd88Ft: null, conversionApplied: false, conversionPublished: false, disclaimer: `${disclaimerBase} Non-finite gage height — no conversion applied.` };
  if (!rec) return { gageHeightFt, verticalReference: 'GAGE_DATUM', wseNavd88Ft: null, gageZeroNavd88Ft: null, conversionApplied: false, conversionPublished: false, disclaimer: `${disclaimerBase} Unknown gage id ${gageId} — no conversion applied.` };
  if (!rec.conversionPublished || rec.gageZeroNavd88Ft == null) return { gageHeightFt, verticalReference: 'GAGE_DATUM', wseNavd88Ft: null, gageZeroNavd88Ft: null, conversionApplied: false, conversionPublished: false, disclaimer: `${disclaimerBase} ${rec.name}: no validated station/product-specific conversion is available.` };
  const wse = gageHeightFt + rec.gageZeroNavd88Ft;
  return { gageHeightFt, verticalReference: 'NAVD88', wseNavd88Ft: wse, gageZeroNavd88Ft: rec.gageZeroNavd88Ft, conversionApplied: true, conversionPublished: true, disclaimer: `${disclaimerBase} WSE_NAVD88 = gage_height (${gageHeightFt}) + validated gage_zero (${rec.gageZeroNavd88Ft}) = ${wse.toFixed(2)} ft. Verify the current source product before regulatory use.` };
}

export function stageVerticalMetadata(_gageId: string, conversion: StageConversionResult) {
  return {
    vertical_reference_raw: 'GAGE_DATUM' as const,
    vertical_reference_converted: conversion.conversionApplied ? ('NAVD88' as const) : null,
    gage_zero_navd88_ft: conversion.gageZeroNavd88Ft,
    wse_navd88_ft: conversion.wseNavd88Ft,
    conversion_published: conversion.conversionPublished,
    authority_note: 'Raw parameter 00065 / NWPS primary remains in source gage datum. NAVD88 is only produced when a validated station/product-specific relationship is available.',
  };
}
