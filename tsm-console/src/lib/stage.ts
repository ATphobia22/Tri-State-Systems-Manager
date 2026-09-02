import { siteSpatialReference, siteVerticalReference } from './geodetic';
/**
 * Live NOAA / USGS stage fetch with graceful fallback
 * Raw stage is always GAGE_DATUM — never labeled NAVD88 without conversion.
 * MOCK results are SIMULATION_DEMO — not engineering predictions.
 * Observed vs forecast must never be collapsed.
 */

import { SITE } from '../types/site';
import type { MapTwinLoaderData } from '../types/loaders';
import {
  convertGageHeightToNavd88,
  stageVerticalMetadata,
} from './gage-datums';

function categorize(ft: number | null): MapTwinLoaderData['stage']['floodCategory'] {
  if (ft == null) return 'unknown';
  const s = SITE.noaaGauge.stages;
  if (ft >= s.major) return 'major';
  if (ft >= s.moderate) return 'moderate';
  if (ft >= s.minor) return 'minor';
  if (ft >= s.action) return 'action';
  return 'normal';
}

function packageStage(
  source: 'NOAA' | 'USGS' | 'MOCK',
  gaugeId: string,
  value_ft: number | null,
  timestamp: string | null,
  floodCategory: MapTwinLoaderData['stage']['floodCategory'],
): MapTwinLoaderData['stage'] & Record<string, unknown> {
  const conversion =
    value_ft != null
      ? convertGageHeightToNavd88(gaugeId, value_ft)
      : null;

  return {
    source,
    gaugeId,
    value_ft,
    timestamp,
    floodCategory,
    /** Raw reading is always gage datum */
    vertical_reference: 'GAGE_DATUM',
    wse_navd88_ft: conversion?.wseNavd88Ft ?? null,
    gage_zero_navd88_ft: conversion?.gageZeroNavd88Ft ?? null,
    conversion_applied: conversion?.conversionApplied ?? false,
    provisional: source !== 'MOCK',
    is_simulation_demo: source === 'MOCK',
    disclaimer:
      conversion?.disclaimer ??
      'PROVISIONAL data subject to revision. Not a regulatory determination.',
    regulatory_banner:
      'NOT A REGULATORY DETERMINATION — decision support only. Human authority final.',
    ...(conversion ? stageVerticalMetadata(gaugeId, conversion) : {}),
  };
}

/**
 * Attempt live stage. Returns mock/unknown on network failure so the UI never breaks.
 */
export async function fetchLiveStage(): Promise<MapTwinLoaderData['stage']> {
  try {
    const url = `https://api.water.noaa.gov/nwps/v1/gauges/${SITE.noaaGauge.nwsId}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const json = await res.json();
      const obs = json?.status?.observed?.primary;
      const value = typeof obs === 'number' ? obs : parseFloat(obs);
      if (!Number.isNaN(value)) {
        return packageStage(
          'NOAA',
          SITE.noaaGauge.nwsId,
          value,
          json?.status?.observed?.primaryTime || new Date().toISOString(),
          categorize(value),
        ) as MapTwinLoaderData['stage'];
      }
    }
  } catch {
    // fall through
  }

  for (const usgsId of ['03378500', '03322000', '03322420'] as const) {
    try {
      const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${usgsId}&parameterCd=00065&siteStatus=all`;
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const json = await res.json();
        const v = json?.value?.timeSeries?.[0]?.values?.[0]?.value?.[0];
        const value = v ? parseFloat(v.value) : NaN;
        if (!Number.isNaN(value)) {
          return packageStage(
            'USGS',
            usgsId,
            value,
            v.dateTime || new Date().toISOString(),
            categorize(value),
          ) as MapTwinLoaderData['stage'];
        }
      }
    } catch {
      // try next
    }
  }

  return packageStage('MOCK', SITE.noaaGauge.nwsId, null, null, 'unknown') as MapTwinLoaderData['stage'];
}

/** Stamp authoritative CRS on any stage payload for evidence packaging */
export function withSiteGeodesy<T extends Record<string, unknown>>(payload: T) {
  return {
    ...payload,
    spatial_reference: siteSpatialReference(),
    /** Site elevations remain NAVD88; raw stage remains GAGE_DATUM unless converted */
    vertical_reference_site: siteVerticalReference(),
  };
}
