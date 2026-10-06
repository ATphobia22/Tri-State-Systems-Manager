import { siteSpatialReference, siteVerticalReference } from './geodetic';
import type { MapTwinLoaderData } from '../types/loaders';
import { GAGE_DATUM_TABLE } from './gage-datums';

/**
 * Live stage — one-time USGS fetch on page load (user-initiated navigation).
 *
 * Owner history:
 * - 2026-09-29: live river data dropped ("drop live river data"); fetch retired
 *   to a no-network sentinel.
 * - 2026-10-01 (SUPERSEDING): river data YES — static + historical kept; no
 *   automatic polling/refresh; live values only via user-initiated fetch.
 * - 2026-10-05: owner directed "fix everything ... real world real current".
 *   This loader performs a SINGLE one-time fetch of USGS instantaneous values
 *   when the twin page loads. There is no timer, no polling, and no background
 *   refresh. The RiverGaugeBoard "Fetch live snapshot" button remains the
 *   explicit on-demand path on the River Watch page.
 *
 * Vertical conversion uses the published USGS SIR 2016-5119 gage-zero
 * relationship for 03378500 (+352.67 ft NAVD88). This yields the STATION WSE
 * only. Transfer to the project site still requires a validated hydraulic
 * profile and remains fail-closed (site_transfer_status).
 *
 * USGS instantaneous values carry qualifier P (provisional — subject to
 * revision). Missing values are returned as unavailable, never fabricated.
 */

const PRIMARY_USGS = '03378500';
const IV_URL =
  `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${PRIMARY_USGS}&parameterCd=00060,00065&siteStatus=all`;
// NWS flood stages for NHRI3 (Wabash River at New Harmony); mirrors SITE.noaaGauge.stages.
const STAGE_ACTION_FT = 10;
const STAGE_MINOR_FT = 15;
const STAGE_MODERATE_FT = 20;
const STAGE_MAJOR_FT = 23;

function unavailableStage(): MapTwinLoaderData['stage'] {
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

export async function fetchLiveStage(): Promise<MapTwinLoaderData['stage']> {
  const retrievedAt = new Date().toISOString();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    let payload: any;
    try {
      const response = await fetch(IV_URL, { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new Error(`USGS IV HTTP ${response.status}`);
      payload = await response.json();
    } finally {
      clearTimeout(timer);
    }

    let stageFt: number | null = null;
    let stageTime: string | null = null;
    let dischargeCfs: number | null = null;
    let dischargeTime: string | null = null;
    for (const ts of payload?.value?.timeSeries ?? []) {
      const code = String(ts?.variable?.variableCode?.[0]?.value ?? '');
      const vals = ts?.values?.[0]?.value ?? [];
      const latest = vals[vals.length - 1];
      const v = Number(latest?.value);
      if (!Number.isFinite(v)) continue;
      if (code === '00065') {
        stageFt = v;
        stageTime = typeof latest?.dateTime === 'string' ? latest.dateTime : null;
      } else if (code === '00060') {
        dischargeCfs = v;
        dischargeTime = typeof latest?.dateTime === 'string' ? latest.dateTime : null;
      }
    }
    if (stageFt == null) return unavailableStage();

    const datum = GAGE_DATUM_TABLE[PRIMARY_USGS];
    const gageZero = datum?.gageZeroNavd88Ft ?? null;
    const wse = gageZero != null ? stageFt + gageZero : null;
    return {
      source: 'USGS',
      gaugeId: PRIMARY_USGS,
      value_ft: stageFt,
      timestamp: stageTime,
      retrievedAt,
      status: 'provisional',
      qualifier: 'P',
      discharge_cfs: dischargeCfs,
      discharge_observedAt: dischargeTime,
      discharge_status: dischargeCfs != null ? 'provisional' : 'unavailable',
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
      sourceUri: IV_URL,
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
