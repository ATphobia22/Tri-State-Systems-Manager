import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEngineeringCinemaPath,
  freeboardFt,
  historic1937WseNavd88,
  sampleCinemaPath,
  interpolateWse,
} from "../../packages/geo/src/cinema/CinematicEngineeringModel.ts";

test("1937 WSE and freeboard", () => {
  assert.equal(historic1937WseNavd88(), 377.8);
  assert.equal(freeboardFt(377.2, 375), 2.2);
});

test("cinema path samples midpoints", () => {
  const path = buildEngineeringCinemaPath();
  assert.ok(path.length >= 4);
  const mid = sampleCinemaPath(path, 0.5);
  assert.ok(Number.isFinite(mid.lon));
  assert.ok(mid.heightM > 0);
});

test("smooth WSE interpolation", () => {
  const v = interpolateWse(350, 370, 0.5);
  assert.ok(v > 350 && v < 370);
});
