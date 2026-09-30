import { siteSpatialReference, siteVerticalReference } from './geodetic';
import type { MapTwinLoaderData } from '../types/loaders';

/**
 * Live stage fetch — RETIRED by owner decision on 2026-09-29
 * ("drop live river data"). This function performs no network I/O and
 * returns the retired sentinel; no live gauges are polled. The previous
 * TSM-server hydrologic-plane implementation is removed — re-enabling live
 * telemetry requires an explicit new owner decision, not a revert.
 *
 * Vertical reference remains GAGE_DATUM unless a validated gage-zero exists.
 * See gage-datums.ts for the station datum table (published conversions only).
 */

const PRIMARY_USGS = '03378500';

const RETIRED_STAGE: MapTwinLoaderData['stage'] = {
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
  vertical_conversion_status: 'CONVERSION_BLOCKED',
  vertical_conversion_source: null,
  site_transfer_status: 'REQUIRES_VALIDATED_HYDRAULIC_PROFILE',
  hydraulic_extrusion_eligibility: 'BLOCKED_UNTIL_SITE_WSE_TRANSFER_VALIDATED',
  sourceUri: null,
};

export async function fetchLiveStage(): Promise<MapTwinLoaderData['stage']> {
  // Retired 2026-09-29: no network, no polling — return the sentinel.
  return { ...RETIRED_STAGE };
}

export function withSiteGeodesy<T extends Record<string, unknown>>(payload: T) {
  return {
    ...payload,
    spatial_reference: siteSpatialReference(),
    vertical_reference_site: siteVerticalReference(),
  };
}
