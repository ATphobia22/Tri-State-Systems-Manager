import test from "node:test";
import assert from "node:assert/strict";
import {
  getUSGSStage, assessRelease, STATIONS, MODERN_USGS_LATEST_URL,
} from "../../packages/hydrology/src/usgs-stage-adapter.mjs";

const NOW = new Date("2026-11-11T12:00:00Z");
function feature(station, value = "12.34", options = {}) {
  return { type: "Feature", properties: {
    monitoring_location_id: "USGS-" + station,
    parameter_code: "00065",
    time: "2026-11-11T11:55:00Z",
    value,
    unit_of_measure: "ft",
    approval_status: "Provisional",
    ...options,
  } };
}
function fakeFetch(features, capture = null) {
  return async (url) => {
    if (capture) capture.push(url);
    return { ok: true, status: 200,
      text: async () => JSON.stringify({ type: "FeatureCollection", features }) };
  };
}

test("modern OGC endpoint is used and stage never becomes NAVD88 elevation", async () => {
  const calls = [];
  const result = await getUSGSStage({
    stationId: STATIONS.NEW_HARMONY,
    fetchImpl: fakeFetch([feature(STATIONS.NEW_HARMONY)], calls),
    now: () => NOW,
  });
  assert.equal(result.latest.stage, 12.34);
  assert.equal(result.latest.unit, "ft");
  assert.deepEqual(result.latest.qualifiers, ["P"]);
  assert.equal(result.navd88Elevation, null);
  assert.equal(result.verticalDatum, "GAGE_DATUM_UNRESOLVED");
  assert.equal(result.regulatoryUse, false);
  assert.equal(result.verification, "PROVISIONAL");
  assert.match(result.rawSha256, /^[a-f0-9]{64}$/);
  assert.equal(new URL(calls[0]).origin + new URL(calls[0]).pathname,
    MODERN_USGS_LATEST_URL);
  const url = new URL(calls[0]);
  assert.equal(url.searchParams.get("monitoring_location_id"), "USGS-03378500");
  assert.equal(url.searchParams.get("parameter_code"), "00065");
  assert.ok(!calls[0].includes("waterservices.usgs.gov"));
});

test("invalid station rejects before calling network", async () => {
  let called = false;
  await assert.rejects(getUSGSStage({
    stationId: "00000000",
    fetchImpl: async () => { called = true; throw Error("wrong"); },
  }), /allowlist/);
  assert.equal(called, false);
});

test("missing values do not become numeric zero; genuine zero remains valid", async () => {
  const station = STATIONS.NEW_HARMONY;
  const values = [null, "", " ", false, "-999", -9999, "-8888", "NaN", "Infinity"];
  const rows = values.map((value) => feature(station, value));
  rows.push(feature(station, 0));
  const result = await getUSGSStage({
    stationId: station, fetchImpl: fakeFetch(rows), now: () => NOW,
  });
  assert.equal(result.latest.stage, 0);
  assert.equal(result.verification, "PROVISIONAL");
});

test("foreign stations, other parameters, incorrect units and future times cannot be selected", async () => {
  const station = STATIONS.NEW_HARMONY;
  const rows = [
    feature("03381700", 99),
    feature(station, 78, { parameter_code: "00060" }),
    feature(station, 1000, { unit_of_measure: "m" }),
    feature(station, 1000, { time: "2026-11-11T14:00:00Z" }),
    feature(station, "12.34"),
  ];
  const result = await getUSGSStage({
    stationId: station, fetchImpl: fakeFetch(rows), now: () => NOW,
  });
  assert.equal(result.latest.stage, 12.34);
});

test("no valid observations produce a visible NOT_EVIDENCED state", async () => {
  const result = await getUSGSStage({
    stationId: STATIONS.NEW_HARMONY, fetchImpl: fakeFetch([]), now: () => NOW,
  });
  assert.equal(result.latest, null);
  assert.equal(result.verification, "NOT_EVIDENCED");
  assert.equal(result.navd88Elevation, null);
});

test("older source observation is stale, not live", async () => {
  const result = await getUSGSStage({
    stationId: STATIONS.NEW_HARMONY,
    fetchImpl: fakeFetch([feature(STATIONS.NEW_HARMONY, 12.34,
      { time: "2026-11-09T08:00:00Z" })]),
    now: () => NOW,
  });
  assert.equal(result.verification, "STALE");
  assert.equal(result.latest.stage, 12.34);
});

test("malformed response and excessive body size reject instead of fabricating", async () => {
  await assert.rejects(() => getUSGSStage({
    stationId: STATIONS.NEW_HARMONY,
    fetchImpl: async () => ({ ok: true, text: async () => '{"not_features":1}' }),
    now: () => NOW,
  }), /Unexpected USGS/);
  await assert.rejects(() => getUSGSStage({
    stationId: STATIONS.NEW_HARMONY,
    fetchImpl: async () => ({
      ok: true, headers: { get: () => "6000000" },
      text: async () => { throw Error("body should not be read"); },
    }),
    now: () => NOW,
  }), /size limit/);
});

test("unverified gate still blocks regulatory release", () => {
  const record = { classification: "REGULATORY", checks: {
    aoi: "VERIFIED", terrain: "VERIFIED", datum: "PENDING",
    integrity: "VERIFIED", humanReview: "VERIFIED",
  }, authorization: { humanAuthorityFinal: true, approvedForRegulatoryUse: false } };
  const outcome = assessRelease(record);
  assert.equal(outcome.eligible, false);
  assert.ok(outcome.missingOrUnverified.includes("datum"));
  assert.ok(outcome.missingOrUnverified.includes("regulatoryAuthorization"));
});
