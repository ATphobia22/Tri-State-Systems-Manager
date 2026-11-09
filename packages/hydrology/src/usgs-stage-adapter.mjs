/**
 * TSM public USGS observation adapter. Node 22+; no third-party dependencies.
 * Returns raw stage values only: NEVER interprets stage as NAVD88 elevation.
 * The caller must separately establish the station-specific gage datum.
 */
import { createHash } from "node:crypto";

export const STATIONS = Object.freeze({
  NEW_HARMONY: "03378500",
  MOUNT_CARMEL: "03377500",
  EVANSVILLE: "03322000",
});

export function assessRelease(record) {
  const names = ["aoi", "terrain", "datum", "integrity", "humanReview"];
  const failed = names.filter((name) => record?.checks?.[name] !== "VERIFIED");
  const regulatory = record?.classification === "REGULATORY";
  if (record?.authorization?.humanAuthorityFinal !== true) failed.push("humanAuthorityFinal");
  if (regulatory && record?.authorization?.approvedForRegulatoryUse !== true) failed.push("regulatoryAuthorization");
  if (regulatory && (!record?.authorization?.reviewerId || !record?.authorization?.reviewEvidenceSha256)) failed.push("reviewEvidence");
  return { eligible: failed.length === 0, missingOrUnverified: failed };
}

export async function getUSGSStage({ stationId, fetchImpl = fetch, now = () => new Date(), timeoutMs = 12000 } = {}) {
  if (!Object.values(STATIONS).includes(stationId)) throw new Error("Station not in reviewed TSM allowlist");
  const url = new URL("https://waterservices.usgs.gov/nwis/iv/");
  url.searchParams.set("format", "json");
  url.searchParams.set("sites", stationId);
  url.searchParams.set("parameterCd", "00065");
  url.searchParams.set("siteStatus", "all");
  const retrievedAt = now().toISOString();
  const response = await fetchImpl(url.toString(), { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`USGS HTTP ${response.status}`);
  const body = await response.text();
  if (body.length > 5_000_000) throw new Error("USGS payload exceeds size limit");
  const rawSha256 = createHash("sha256").update(body).digest("hex");
  const parsed = JSON.parse(body);
  const series = parsed?.value?.timeSeries;
  if (!Array.isArray(series)) throw new Error("Unexpected USGS response shape");
  const matching = series.filter(s => s?.sourceInfo?.siteCode?.some(c => c.value === stationId) &&
    s?.variable?.variableCode?.some(c => c.value === "00065"));
  const observations = matching.flatMap(s => (s.values ?? []).flatMap(group =>
    (group.value ?? []).map(v => ({
      stage: Number(v.value),
      time: v.dateTime,
      qualifiers: v.qualifiers ?? [],
      unit: s.variable?.unit?.unitCode ?? null
    })))).filter(v => Number.isFinite(v.stage) && !Number.isNaN(Date.parse(v.time)));
  observations.sort((a,b) => Date.parse(b.time) - Date.parse(a.time));
  return {
    classification: "OBSERVED",
    verification: observations.length ? "PROVISIONAL" : "NOT_EVIDENCED",
    stationId, retrievedAt, sourceUrl: url.toString(), rawSha256,
    latest: observations[0] ?? null,
    verticalDatum: "GAGE_DATUM_UNRESOLVED",
    navd88Elevation: null,
    regulatoryUse: false
  };
}
