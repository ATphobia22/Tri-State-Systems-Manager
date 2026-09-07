import { siteSpatialReference, siteVerticalReference } from './geodetic';
import { SITE } from '../types/site';
import type { MapTwinLoaderData } from '../types/loaders';
import { convertGageHeightToNavd88, stageVerticalMetadata } from './gage-datums';

function categorize(ft: number | null): MapTwinLoaderData['stage']['floodCategory'] {
  if (ft == null) return 'unknown';
  const s = SITE.noaaGauge.stages;
  if (ft >= s.major) return 'major'; if (ft >= s.moderate) return 'moderate'; if (ft >= s.minor) return 'minor'; if (ft >= s.action) return 'action'; return 'normal';
}

export async function fetchLiveStage(): Promise<MapTwinLoaderData['stage']> {
  try {
    const response = await fetch('/api/hydrologic/live?source=usgs&usgs_id=03378500', { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error(`TSM hydrologic API HTTP ${response.status}`);
    const record = await response.json() as Record<string, unknown>;
    const value = typeof record.value === 'number' ? record.value : null;
    const conversion = value == null ? null : convertGageHeightToNavd88('03378500', value);
    return {
      source: 'USGS', gaugeId: '03378500', value_ft: value,
      timestamp: typeof record.observedAt === 'string' ? record.observedAt : null,
      retrievedAt: typeof record.retrievedAt === 'string' ? record.retrievedAt : null,
      status: record.status === 'current' ? 'current' : 'provisional', floodCategory: categorize(value), vertical_reference: 'GAGE_DATUM',
      wse_navd88_ft: conversion?.wseNavd88Ft ?? null, gage_zero_navd88_ft: conversion?.gageZeroNavd88Ft ?? null,
      conversion_applied: conversion?.conversionApplied ?? false,
      ...((conversion ? stageVerticalMetadata('03378500', conversion) : {}) as Record<string, unknown>),
    } as MapTwinLoaderData['stage'];
  } catch {
    return { source: 'UNAVAILABLE', gaugeId: '03378500', value_ft: null, timestamp: null, retrievedAt: null, status: 'unavailable', floodCategory: 'unknown', vertical_reference: 'GAGE_DATUM', wse_navd88_ft: null, gage_zero_navd88_ft: null, conversion_applied: false };
  }
}

export function withSiteGeodesy<T extends Record<string, unknown>>(payload: T) {
  return { ...payload, spatial_reference: siteSpatialReference(), vertical_reference_site: siteVerticalReference() };
}
