import { siteSpatialReference, siteVerticalReference } from './geodetic';
import { SITE } from '../types/site';
import type { MapTwinLoaderData } from '../types/loaders';
import { convertGageHeightToNavd88, stageVerticalMetadata } from './gage-datums';
import { tsmApiUrl } from './api-base';

function categorize(ft: number | null): MapTwinLoaderData['stage']['floodCategory'] {
  if (ft == null) return 'unknown';
  const s = SITE.noaaGauge.stages;
  if (ft >= s.major) return 'major'; if (ft >= s.moderate) return 'moderate'; if (ft >= s.minor) return 'minor'; if (ft >= s.action) return 'action'; return 'normal';
}

export async function fetchLiveStage(): Promise<MapTwinLoaderData['stage']> {
  try {
    const response = await fetch(tsmApiUrl('/api/hydrologic/live?source=auto&usgs_id=03378500&nws_id=NHRI3'), { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error(`TSM hydrologic API HTTP ${response.status}`);
    const record = await response.json() as Record<string, unknown>;
    const value = typeof record.value === 'number' ? record.value : null;
    const conversion = value != null ? convertGageHeightToNavd88('03378500', value) : null;
    return {
      source: record.source === 'NOAA' || record.source === 'USGS' ? record.source : 'UNAVAILABLE',
      gaugeId: typeof record.gaugeId === 'string' ? record.gaugeId : '03378500', value_ft: value,
      timestamp: typeof record.observedAt === 'string' ? record.observedAt : null, retrievedAt: typeof record.retrievedAt === 'string' ? record.retrievedAt : null,
      status: record.status === 'current' || record.status === 'stale' || record.status === 'unavailable' ? record.status : 'provisional',
      qualifier: typeof record.qualifier === 'string' ? record.qualifier : null,
      discharge_cfs: typeof record.discharge_cfs === 'number' ? record.discharge_cfs : null,
      discharge_observedAt: typeof record.discharge_observedAt === 'string' ? record.discharge_observedAt : null,
      discharge_status: record.discharge_status === 'current' || record.discharge_status === 'provisional' || record.discharge_status === 'stale' || record.discharge_status === 'unavailable' ? record.discharge_status : null,
      floodCategory: categorize(value), vertical_reference: 'GAGE_DATUM', wse_navd88_ft: conversion?.wseNavd88Ft ?? null, gage_zero_navd88_ft: conversion?.gageZeroNavd88Ft ?? null,
      conversion_applied: conversion?.conversionApplied ?? false, sourceUri: typeof record.sourceUri === 'string' ? record.sourceUri : null,
      ...((conversion ? stageVerticalMetadata('03378500', conversion) : {}) as Record<string, unknown>),
    } as MapTwinLoaderData['stage'];
  } catch {
    return { source: 'UNAVAILABLE', gaugeId: '03378500', value_ft: null, timestamp: null, retrievedAt: null, status: 'unavailable', qualifier: null, discharge_cfs: null, discharge_observedAt: null, discharge_status: 'unavailable', floodCategory: 'unknown', vertical_reference: 'GAGE_DATUM', wse_navd88_ft: null, gage_zero_navd88_ft: null, conversion_applied: false, sourceUri: null };
  }
}

export function withSiteGeodesy<T extends Record<string, unknown>>(payload: T) {
  return { ...payload, spatial_reference: siteSpatialReference(), vertical_reference_site: siteVerticalReference() };
}
