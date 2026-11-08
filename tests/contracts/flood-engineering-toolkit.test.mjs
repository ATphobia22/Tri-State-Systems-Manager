import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTHORITY_CLASS,
  BONEBANK_MODEL,
  computeFreeboardFt,
  inundationDepthFt,
  buildWseAnimationKeyframes,
  summarizeBonebankScenario,
  mtvi3StageFromWseFt,
} from "../../tsm-console/src/lib/flood-engineering-toolkit.ts";

test("freeboard at Bonebank modeling constants is +2.2 ft", () => {
  const r = computeFreeboardFt(BONEBANK_MODEL.lagFtNavd88, BONEBANK_MODEL.bfeFtNavd88);
  assert.equal(r.freeboardFt, 2.2);
  assert.equal(r.aboveBfe, true);
  assert.equal(r.authority, AUTHORITY_CLASS);
});

test("1937 crest yields small depth at modeling LAG", () => {
  const d = inundationDepthFt(
    BONEBANK_MODEL.lagFtNavd88,
    BONEBANK_MODEL.historical1937CrestFtNavd88
  );
  assert.ok(Math.abs(d.depthFt - 0.6) < 1e-9);
  assert.equal(d.wet, true);
});

test("animation keyframes are monotonic and end at target", () => {
  const kf = buildWseAnimationKeyframes(370, 377.8, 12);
  assert.equal(kf[0].t, 0);
  assert.equal(kf[kf.length - 1].t, 1);
  assert.equal(kf[kf.length - 1].waterSurfaceFt, 377.8);
  for (let i = 1; i < kf.length; i++) {
    assert.ok(kf[i].waterSurfaceFt >= kf[i - 1].waterSurfaceFt);
  }
});

test("scenario summary carries SIMULATION_DEMO authority", () => {
  const s = summarizeBonebankScenario("historical-1937");
  assert.equal(s.authority, AUTHORITY_CLASS);
  assert.ok(s.keyframes && s.keyframes.length >= 2);
  assert.ok(mtvi3StageFromWseFt(377.8) > 50);
});
