import { siteSpatialReference, siteVerticalReference } from './geodetic';
import type { MapTwinLoaderData } from '../types/loaders';
import { GAGE_DATUM_TABLE } from './gage-datums';
import { fetchUsgsLatestContinuous } from './usgs-direct';

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
 *   decommissioned 2026-02-22) to the USGS Water Data OGC API
 *   (api.waterdata.usgs.gov/ogcapi/v1/collections/latest-continuous).
 *   approval_status replaces the legacy qualifier convention; Provisional
 *   still maps to qualifier 'P' and status 'provisional'.
 *
 * Vertical conversion uses the published USGS SIR 2016-5119 gage-zero
 * relationship for 03378500 (+352.67 ft NAVD88). This yields the STATION WSE
 * only. Transfer to the project site still requires a validated hydraulic
 * profile and remains fail-closed (site_transfer_status).
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
    // OGC API path (USGS Water Services decommissioned 2026-02-22).
    const observations = await fetchUsgsLatestContinuous(PRIMARY_USGS, ['00065', '00060'], {
      timeoutMs: 15000,
    });

    let stageFt: number | null = null;
    let stageTime: string | null = null;
    let stageApproval: string | null = null;
    let stageSourceUri: string | null = null;
    let dischargeCfs: number | null = null;
    let dischargeTime: string | null = null;
    let dischargeApproval: string | null = null;
    for (const obs of observations) {
      if (obs.parameterCode === '00065' && stageFt == null) {
        stageFt = obs.value;
        stageTime = obs.observedAt;
        stageApproval = obs.approvalStatus;
        stageSourceUri = obs.sourceUri;
      } else if (obs.parameterCode === '00060' && dischargeCfs == null) {
        dischargeCfs = obs.value;
        dischargeTime = obs.observedAt;
        dischargeApproval = obs.approvalStatus;
      }
    }
    if (stageFt == null) return unavailableStage();

    const stageProvisional = stageApproval === 'Provisional';
    const dischargeProvisional = dischargeApproval === 'Provisional';
    const datum = GAGE_DATUM_TABLE[PRIMARY_USGS];
    const gageZero = datum?.gageZeroNavd88Ft ?? null;
    const wse = gageZero != null ? stageFt + gageZero : null;
    return {
      source: 'USGS',
      gaugeId: PRIMARY_USGS,
      value_ft: stageFt,
      timestamp: stageTime,
      retrievedAt,
      status: stageProvisional ? 'provisional' : 'current',
      qualifier: stageProvisional ? 'P' : 'A',
      discharge_cfs: dischargeCfs,
      discharge_observedAt: dischargeTime,
      discharge_status: dischargeCfs != null ? (dischargeProvisional ? 'provisional' : 'current') : 'unavailable',
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
