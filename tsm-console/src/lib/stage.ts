import { siteSpatialReference, siteVerticalReference } from './geodetic';
import { SITE } from '../types/site';
import type { MapTwinLoaderData } from '../types/loaders';
import { convertGageHeightToNavd88, stageVerticalMetadata } from './gage-datums';
import { tsmApiUrl } from './api-base';

/**
 * Live stage fetch — always via TSM server hydrologic plane.
 * Never calls legacy waterservices.usgs.gov from the browser.
 * Prefer USGS modern OGC (source=usgs); NOAA MTVI3 is often obs_not_current.
 * Vertical reference remains GAGE_DATUM unless a validated gage-zero exists.
 */

function categorize(ft: number | null): MapTwinLoaderData['stage']['floodCategory'] {
  if (ft == null) return 'unknown';
  const s = SITE.noaaGauge.stages;
  if (s.major != null && ft >= s.major) return 'major';
  if (s.moderate != null && ft >= s.moderate) return 'moderate';
  if (s.minor != null && ft >= s.minor) return 'minor';
  if (s.action != null && ft >= s.action) return 'action';
  return s.major == null && s.moderate == null && s.minor == null && s.action == null
    ? 'unknown'
    : 'normal';
}

const PRIMARY_USGS = '03378500';
const PRIMARY_NWS = 'MTVI3';

export async function fetchLiveStage(): Promise<MapTwinLoaderData['stage']> {
  const attempts = [
    `/api/hydrologic/live?source=usgs&usgs_id=${PRIMARY_USGS}&nws_id=${PRIMARY_NWS}`,
    `/api/hydrologic/live?source=auto&usgs_id=${PRIMARY_USGS}&nws_id=${PRIMARY_NWS}`,
  ];

  for (const path of attempts) {
    try {
      const response = await fetch(tsmApiUrl(path), {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) continue;
      const record = (await response.json()) as Record<string, unknown>;
      if (record.ok === false || record.status === 'unavailable') continue;

      const value = typeof record.value === 'number' ? record.value : null;
      if (value == null || !Number.isFinite(value) || value === -999) continue;

      const conversion = convertGageHeightToNavd88(PRIMARY_USGS, value);

      return {
        source:
          record.source === 'NOAA' || record.source === 'USGS' ? record.source : 'UNAVAILABLE',
        gaugeId: typeof record.gaugeId === 'string' ? record.gaugeId : PRIMARY_USGS,
        value_ft: value,
        timestamp: typeof record.observedAt === 'string' ? record.observedAt : null,
        retrievedAt: typeof record.retrievedAt === 'string' ? record.retrievedAt : null,
        status:
          record.status === 'current' ||
          record.status === 'stale' ||
          record.status === 'unavailable'
            ? record.status
            : 'provisional',
        qualifier: typeof record.qualifier === 'string' ? record.qualifier : null,
        discharge_cfs: typeof record.discharge_cfs === 'number' ? record.discharge_cfs : null,
        discharge_observedAt:
          typeof record.discharge_observedAt === 'string' ? record.discharge_observedAt : null,
        discharge_status:
          record.discharge_status === 'current' ||
          record.discharge_status === 'provisional' ||
          record.discharge_status === 'stale' ||
          record.discharge_status === 'unavailable'
            ? record.discharge_status
            : null,
        floodCategory: categorize(value),
        vertical_reference: 'GAGE_DATUM',
        wse_navd88_ft: conversion?.wseNavd88Ft ?? null,
        gage_zero_navd88_ft: conversion?.gageZeroNavd88Ft ?? null,
        conversion_applied: conversion?.conversionApplied ?? false,
        sourceUri: typeof record.sourceUri === 'string' ? record.sourceUri : null,
        ...((conversion ? stageVerticalMetadata(PRIMARY_USGS, conversion) : {}) as Record<
          string,
          unknown
        >),
      } as MapTwinLoaderData['stage'];
    } catch {
      // try next
    }
  }

  return {
    source: 'UNAVAILABLE',
    gaugeId: PRIMARY_USGS,
    value_ft: null,
    timestamp: null,
    retrievedAt: null,
    status: 'unavailable',
    qualifier: null,
    discharge_cfs: null,
    discharge_observedAt: null,
    discharge_status: 'unavailable',
    floodCategory: 'unknown',
    vertical_reference: 'GAGE_DATUM',
    wse_navd88_ft: null,
    gage_zero_navd88_ft: null,
    conversion_applied: false,
    sourceUri: null,
  };
}

export function withSiteGeodesy<T extends Record<string, unknown>>(payload: T) {
  return {
    ...payload,
    spatial_reference: siteSpatialReference(),
    vertical_reference_site: siteVerticalReference(),
  };
}
