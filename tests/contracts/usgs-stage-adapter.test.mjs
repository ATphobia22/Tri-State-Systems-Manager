import test from "node:test";
import assert from "node:assert/strict";
import { getUSGSStage, assessRelease, STATIONS } from "../../packages/hydrology/src/usgs-stage-adapter.mjs";

test("observed stage never becomes NAVD88 elevation", async () => {
  const payload = JSON.stringify({ value: { timeSeries: [{
    sourceInfo: { siteCode: [{ value: STATIONS.NEW_HARMONY }] },
    variable: { variableCode: [{ value: "00065" }], unit: { unitCode: "ft" } },
    values: [{ value: [{ value: "12.34", dateTime: "2026-11-08T12:00:00Z", qualifiers: ["P"] }] }]
  }] } });
  const result = await getUSGSStage({
    stationId: STATIONS.NEW_HARMONY,
    fetchImpl: async () => ({ ok: true, text: async () => payload }),
    now: () => new Date("2026-11-08T12:01:00Z")
  });
  assert.equal(result.latest.stage, 12.34);
  assert.equal(result.latest.unit, "ft");
  assert.equal(result.navd88Elevation, null);
  assert.equal(result.verticalDatum, "GAGE_DATUM_UNRESOLVED");
  assert.equal(result.regulatoryUse, false);
  assert.match(result.rawSha256, /^[a-f0-9]{64}$/);
});
test("unknown station is rejected before network", async () => {
  await assert.rejects(getUSGSStage({ stationId: "00000000" }), /allowlist/);
});
test("unverified gate blocks release", () => {
  const record = { classification: "REGULATORY", checks: {
    aoi: "VERIFIED", terrain: "VERIFIED", datum: "PENDING",
    integrity: "VERIFIED", humanReview: "VERIFIED"
  }, authorization: { humanAuthorityFinal: true, approvedForRegulatoryUse: false } };
  const outcome = assessRelease(record);
  assert.equal(outcome.eligible, false);
  assert.ok(outcome.missingOrUnverified.includes("datum"));
  assert.ok(outcome.missingOrUnverified.includes("regulatoryAuthorization"));
});
