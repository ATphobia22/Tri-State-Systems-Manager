import test from "node:test";
import assert from "node:assert/strict";
import {
  BONEBANK_FREEBOARD,
  computeLagBfeFreeboard,
} from "../../tsm-console/src/lib/lag-bfe-freeboard.ts";
import {
  invokeHecRasSolver,
  importHecRasResultSummary,
  HEC_RAS_AUTHORITY,
} from "../../packages/geo/src/hydraulics/HecRasIntegrationBoundary.ts";

test("Bonebank freeboard is +2.2 ft NAVD88 modeling", () => {
  assert.equal(BONEBANK_FREEBOARD.freeboardRoundedFt, 2.2);
  assert.equal(BONEBANK_FREEBOARD.aboveBfe, true);
  assert.match(BONEBANK_FREEBOARD.formula, /LAG/);
});

test("negative freeboard when LAG below BFE", () => {
  const r = computeLagBfeFreeboard({ lagFt: 370, bfeFt: 375 });
  assert.equal(r.belowBfe, true);
  assert.equal(r.freeboardFt, -5);
});

test("HEC-RAS solver invoke is fail-closed", () => {
  const r = invokeHecRasSolver({ projectId: "demo" });
  assert.equal(r.ok, false);
  assert.equal(r.authority, HEC_RAS_AUTHORITY);
});

test("HEC-RAS import requires humanReviewed", () => {
  const denied = importHecRasResultSummary({
    projectId: "demo",
    profileName: "100yr",
    wseFt: 375,
    depthFt: 2,
    verticalDatumLabel: "NAVD88",
    importedAt: new Date().toISOString(),
    humanReviewed: false,
  });
  assert.equal(denied.ok, false);
  const ok = importHecRasResultSummary({
    projectId: "demo",
    profileName: "100yr",
    wseFt: 375,
    depthFt: 2,
    verticalDatumLabel: "NAVD88",
    importedAt: new Date().toISOString(),
    humanReviewed: true,
  });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.mode, "IMPORT_ONLY");
});
