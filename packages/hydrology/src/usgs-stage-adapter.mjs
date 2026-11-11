/**
 * TSM USGS observations from the modern 2026 OGC Water Data API v1.
 * Public, bounded and user-initiated. Never turns stage into NAVD88 WSE.
 * Legacy WaterServices is scheduled for retirement in early 2027.
 *
 * Official API: https://api.waterdata.usgs.gov/docs/ogcapi/migration/
 */
import { createHash } from "node:crypto";

export const STATIONS = Object.freeze({
  NEW_HARMONY: "03378500",
  MOUNT_CARMEL: "03377500",
  EVANSVILLE: "03322000",
});

export const MODERN_USGS_LATEST_URL =
  "https://api.waterdata.usgs.gov/ogcapi/v1/collections/latest-continuous/items";
const MAX_BODY_CHARACTERS = 5_000_000;
const MAX_FEATURES = 10_000;
const TIME_TOLERANCE_MS = 5 * 60 * 1000;
const STALE_AFTER_MS = 2 * 60 * 60 * 1000;
const NO_DATA = new Set([-999, -9999, -8888]);

export function assessRelease(record) {
  const names = ["aoi", "terrain", "datum", "integrity", "humanReview"];
  const failed = names.filter((name) => record?.checks?.[name] !== "VERIFIED");
  const regulatory = record?.classification === "REGULATORY";
  if (record?.authorization?.humanAuthorityFinal !== true) failed.push("humanAuthorityFinal");
  if (regulatory && record?.authorization?.approvedForRegulatoryUse !== true) failed.push("regulatoryAuthorization");
  if (regulatory && (!record?.authorization?.reviewerId || !record?.authorization?.reviewEvidenceSha256)) failed.push("reviewEvidence");
  return { eligible: failed.length === 0, missingOrUnverified: failed };
}

function finiteStage(value) {
  if (value === null || value === undefined || typeof value === "boolean") return null;
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && !NO_DATA.has(numeric) ? numeric : null;
}

function extractStage(feature, stationId, nowTime) {
  if (!feature || typeof feature !== "object" || !feature.properties) return null;
  const p = feature.properties;
  const rawId = p.monitoring_location_id;
  const siteNumber = p.monitoring_location_number;
  if (rawId !== "USGS-" + stationId && siteNumber !== stationId) return null;
  if (p.parameter_code !== "00065") return null;
  if (p.unit_of_measure !== "ft") return null;
  const stage = finiteStage(p.value);
  if (stage === null || typeof p.time !== "string") return null;
  const measuredAt = Date.parse(p.time);
  if (!Number.isFinite(measuredAt) || measuredAt > nowTime + TIME_TOLERANCE_MS) return null;
  const qualifier = typeof p.qualifier === "string" && p.qualifier.trim()
    ? p.qualifier.trim() : null;
  const approval = typeof p.approval_status === "string" ? p.approval_status : "";
  return {
    stage,
    time: p.time,
    qualifiers: qualifier ? [qualifier] : approval.toLowerCase() === "provisional" ? ["P"] : [],
    unit: "ft",
  };
}

/**
 * Read stage for a reviewed station. Real source bytes are SHA-256 hashed for
 * audit, but the hash is not a signature/endorsement of scientific meaning.
 */
export async function getUSGSStage({
  stationId, fetchImpl = fetch, now = () => new Date(), timeoutMs = 12_000,
} = {}) {
  if (!Object.values(STATIONS).includes(stationId)) throw new Error("Station not in reviewed TSM allowlist");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000)
    throw new RangeError("USGS request timeout out of range");
  const captured = now();
  if (!(captured instanceof Date) || !Number.isFinite(captured.getTime()))
    throw new TypeError("Invalid observation-retrieval timestamp");

  const url = new URL(MODERN_USGS_LATEST_URL);
  url.searchParams.set("f", "json");
  url.searchParams.set("monitoring_location_id", "USGS-" + stationId);
  url.searchParams.set("parameter_code", "00065");
  url.searchParams.set("limit", "100");
  const retrievedAt = captured.toISOString();
  const response = await fetchImpl(url.toString(), {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { Accept: "application/geo+json, application/json" },
    redirect: "error",
  });
  if (!response.ok) throw new Error("USGS HTTP " + response.status);
  const declaredLength = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_CHARACTERS)
    throw new Error("USGS payload exceeds size limit");
  const body = await response.text();
  if (body.length > MAX_BODY_CHARACTERS) throw new Error("USGS payload exceeds size limit");
  const rawSha256 = createHash("sha256").update(body).digest("hex");
  const parsed = JSON.parse(body);
  if (!Array.isArray(parsed?.features) || parsed.features.length > MAX_FEATURES)
    throw new Error("Unexpected USGS OGC latest-continuous response shape");
  const readings = parsed.features
    .map((feature) => extractStage(feature, stationId, captured.getTime()))
    .filter((record) => record !== null)
    .sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
  const latest = readings[0] ?? null;
  const age = latest ? captured.getTime() - Date.parse(latest.time) : null;

  return {
    classification: "OBSERVED",
    verification: !latest ? "NOT_EVIDENCED"
      : age > STALE_AFTER_MS ? "STALE" : "PROVISIONAL",
    stationId, retrievedAt, sourceUrl: url.toString(), rawSha256,
    latest,
    verticalDatum: "GAGE_DATUM_UNRESOLVED",
    navd88Elevation: null,
    regulatoryUse: false,
  };
}
