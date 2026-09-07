import { classifyFreshness } from './freshness.mjs';

export const SOURCE_FRESHNESS_POLICIES = Object.freeze({
  USGS_NWIS_OBSERVATION: 15 * 60 * 1000,
  NOAA_NWPS_OBSERVATION: 15 * 60 * 1000,
  NOAA_NWPS_FORECAST: 60 * 60 * 1000,
  FEMA_NFHL: 24 * 60 * 60 * 1000,
  INDIANA_GIS: 24 * 60 * 60 * 1000,
  USACE_NLD: 24 * 60 * 60 * 1000,
  USGS_TNM: 7 * 24 * 60 * 60 * 1000,
});

export function classifySourceFreshness(kind, timestamps, nowMs = Date.now()) {
  const maxAgeMs = SOURCE_FRESHNESS_POLICIES[kind];
  if (!maxAgeMs) throw new RangeError(`unknown source freshness policy: ${kind}`);
  return classifyFreshness({ ...timestamps, maxAgeMs, nowMs });
}
