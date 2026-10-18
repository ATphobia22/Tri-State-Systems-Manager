import { siteSpatialReference, siteVerticalReference } from './geodetic';
import type { MapTwinLoaderData } from '../types/loaders';
import { GAGE_DATUM_TABLE } from './gage-datums';
import { tsmApiUrl } from './api-base';

/**
 * Live stage — user-initiated USGS snapshot ONLY.
 *
 * Owner history:
 * - 2026-09-29: live river data dropped ("drop live river data"); fetch retired
 *   to a no-network sentinel.
 * - 2026-10-01 (SUPERSEDING): river data YES — static + historical kept; no
 *   automatic polling/refresh; live values ONLY via a user-initiated
 *   "Fetch live snapshot" button. Never automatic polling.
 * - 2026-10-06: corrected to the standing rule — page loaders return the
 *   unavailable sentinel and perform NO network fetch. The ONLY live path is
 *   fetchLiveStage(), called from an explicit button press (RiverGaugeBoard
 *   "Fetch live snapshot"; Digital Twin "Fetch live snapshot").
 * - 2026-10-06: migrated from USGS Water Services (waterservices.usgs.gov,
 *   scheduled for shutdown on 2027-02-22) to the USGS Water Data OGC API
 *   (api.waterdata.usgs.gov/ogcapi/v1/collections/latest-continuous).
 *   approval_status replaces the legacy qualifier convention; Provisional
 *   still maps to qualifier 'P' and status 'provisional'.
 *
 * The 03378500 SIR 2016-5119 value (+352.67 ft NAVD88) is retained as a
 * candidate only while the recorded SIR/NWPS product-semantic conflict remains
 * unresolved. The conversion is not published and station WSE remains null
 * until that conflict is reconciled. Transfer to any project site additionally
 * requires a validated hydraulic profile and remains fail-closed.
 *
 * USGS instantaneous values carry approval_status Provisional (subject to
 * revision). Missing values are returned as unavailable, never fabricated.
 */

const PRIMARY_USGS = '03378500';
// NWS flood stages for NHRI3 (Wabash River at New Harmony); mirrors SITE.noaaGauge.stages.
const STAGE_ACTION_FT = 10;
const STAGE_MINOR_FT = 15;
const STAGE_MODERATE_FT = 20;
const STAGE_MAJOR_FT = 23;

/**
 * Unavailable sentinel. Page loaders use this — they perform NO network
 * fetch. The only live path is fetchLiveStage(), called from an explicit
 * user button press.
 */
export function unavailableStage(): MapTwinLoaderData['stage'] {
  return {
    source: 'UNAVAILABLE',
    gaugeId: PRIMARY_USGS,
    value_ft: null,
    timestamp: null,
    retrievedAt: new Date().toISOString(),
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
    vertical_conversion_status: 'UNVERIFIED_CONVERSION',
    vertical_conversion_source: null,
    site_transfer_status: 'REQUIRES_VALIDATED_HYDRAULIC_PROFILE',
    hydraulic_extrusion_eligibility: 'NOT_ELIGIBLE_UNVERIFIED_SITE_TRANSFER',
    sourceUri: null,
  };
}

function floodCategoryFor(stageFt: number): MapTwinLoaderData['stage']['floodCategory'] {
  if (stageFt >= STAGE_MAJOR_FT) return 'major';
  if (stageFt >= STAGE_MODERATE_FT) return 'moderate';
  if (stageFt >= STAGE_MINOR_FT) return 'minor';
  if (stageFt >= STAGE_ACTION_FT) return 'action';
  return 'normal';
}

/**
 * Live USGS snapshot — call ONLY from an explicit user button press
 * ("Fetch live snapshot"). Never called from a page loader, timer, or
 * background refresh. Returns the unavailable sentinel on any failure.
 */
export async function fetchLiveStage(): Promise<MapTwinLoaderData['stage']> {
  const retrievedAt = new Date().toISOString();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let payload: {
      observations?: Array<{
        stationId: string;
        provider?: string;
        value: number | null;
        observedAt: string | null;
        retrievedAt: string | null;
        qualifier: string | null;
        provisional: boolean;
        status: string;
        dischargeCfs: number | null;
        dischargeObservedAt: string | null;
        sourceUri: string | null;
        verticalDatum: string;
      }>;
    };
    try {
      const response = await fetch(
        tsmApiUrl(`/api/hydrologic/community?stationIds=${PRIMARY_USGS}`),
        { headers: { Accept: 'application/json' }, cache: 'no-store', signal: controller.signal },
      );
      if (!response.ok) throw new Error(`TSM hydrology API returned HTTP ${response.status}`);
      payload = await response.json() as typeof payload;
    } finally {
      clearTimeout(timeout);
    }
    const observation = payload.observations?.find((item) => item.stationId === PRIMARY_USGS);
    if (!observation || typeof observation.value !== 'number' || observation.status === 'unavailable') {
      return unavailableStage();
    }

    const stageFt = observation.value;
    const stageTime = observation.observedAt;
    const stageApproval = observation.qualifier;
    const stageSourceUri = observation.sourceUri;
    const dischargeCfs = observation.dischargeCfs;
    const dischargeTime = observation.dischargeObservedAt;
    const stageProvisional = observation.provisional === true;
    const dischargeProvisional = observation.provisional === true;
    const datum = GAGE_DATUM_TABLE[PRIMARY_USGS];
    const gageZero = datum?.conversionPublished === true
      ? datum.gageZeroNavd88Ft
      : null;
    const wse = gageZero != null ? stageFt + gageZero : null;
    return {
      source: observation.provider === 'NOAA' || observation.provider === 'NOAA_NWS' ? 'NOAA' : 'USGS',
      gaugeId: PRIMARY_USGS,
      value_ft: stageFt,
      timestamp: stageTime,
      retrievedAt,
      status: observation.status === 'stale' ? 'stale' : stageProvisional ? 'provisional' : 'current',
      qualifier: stageApproval || (stageProvisional ? 'P' : null),
      discharge_cfs: dischargeCfs,
      discharge_observedAt: dischargeTime,
      discharge_status: dischargeCfs != null ? (observation.status === 'stale' ? 'stale' : dischargeProvisional ? 'provisional' : 'current') : 'unavailable',
      floodCategory: floodCategoryFor(stageFt),
      vertical_reference: 'GAGE_DATUM',
      wse_navd88_ft: wse,
      gage_zero_navd88_ft: gageZero,
      conversion_applied: wse != null,
      vertical_conversion_status:
        wse != null ? 'PUBLISHED_USGS_SIR_2016_5119' : 'UNVERIFIED_CONVERSION',
      vertical_conversion_source: datum?.sourceUri ?? null,
      site_transfer_status: 'REQUIRES_VALIDATED_HYDRAULIC_PROFILE',
      hydraulic_extrusion_eligibility: 'NOT_ELIGIBLE_UNVERIFIED_SITE_TRANSFER',
      sourceUri: stageSourceUri,
    };
  } catch {
    return unavailableStage();
  }
}

export function withSiteGeodesy<T extends Record<string, unknown>>(payload: T) {
  return {
    ...payload,
    spatial_reference: siteSpatialReference(),
    vertical_reference_site: siteVerticalReference(),
  };
}
