#!/usr/bin/env node
/** Static native source-contract gate. UE compilation and packaged-runtime evidence are independent. */
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const native = path.join(repo, "tsm-native/Source/TSMNative");
const read = (name) => readFileSync(path.join(native, name), "utf8");

test("native runtime exposes three experiences via its HUD and Blueprint subsystem", () => {
  const h = read("TSMExperienceSubsystem.h");
  const cpp = read("TSMExperienceSubsystem.cpp");
  const hud = read("TSMEngineeringHUD.cpp");
  for (const tag of ["LivingRiverValley", "EngineeringScenarioSandbox", "EvidenceToCinemaStoryboard"]) {
    assert.match(h, new RegExp(tag));
  }
  for (const name of ["InspectLivingRiverValley", "ScreenBermConcept", "ExportEvidenceStoryboard"]) {
    assert.match(h, new RegExp(name));
    assert.match(cpp, new RegExp(name));
  }
  for (const caption of ["LIVING RIVER VALLEY", "SCENARIO SANDBOX", "EVIDENCE STORYBOARD"]) {
    assert.ok(hud.includes(caption));
  }
  assert.match(hud, /No site measurements or placeholder rainfall are passed as real inputs/);
});

test("four clocks remain disjoint and data existence is not verified evidence", () => {
  const h = read("TSMExperienceSubsystem.h");
  const cpp = read("TSMExperienceSubsystem.cpp");
  for (const clock of ["Observation", "Historical", "Simulation", "Cinematic"]) {
    assert.match(h, new RegExp(clock));
  }
  assert.match(cpp, /bDataManifestContentsVerified = false/);
  assert.match(cpp, /MANIFEST_PRESENT_CONTENTS_UNVERIFIED/);
  assert.doesNotMatch(cpp, /FHttpModule|ProcessRequest\(/);
});

test("berm screening uses trapezoid SI geometry and finite bounded inputs", () => {
  const cpp = read("TSMExperienceSubsystem.cpp");
  assert.match(cpp, /Input\.BermHeightMeters\s*\*\s*\(Input\.BermTopWidthMeters/);
  assert.match(cpp, /Input\.BermSideSlopeHorizontalToVertical \* Input\.BermHeightMeters/);
  assert.match(cpp, /Input\.BermLengthMeters/);
  assert.match(cpp, /FMath::IsFinite/);
  assert.match(cpp, /SCENARIO_ENVELOPE_EXCEEDED/);
  assert.match(cpp, /CONCEPTUAL_GEOMETRY_ONLY/);
  // Verify formula independently for a symmetric trapezoid, H=2m, W=4m, z=3, L=100m.
  const height = 2, width = 4, slope = 3, length = 100;
  const expectedArea = (width + (width + 2 * slope * height)) / 2 * height;
  assert.equal(height * (width + slope * height) * length, expectedArea * length);
  assert.equal(expectedArea * length, 2000);
});

test("cinematic exports never certify scenes or overwrite previous source data", () => {
  const cpp = read("TSMExperienceSubsystem.cpp");
  for (const s of ["REVIEW_REQUIRED_NOT_RENDERED", "sourceContentVerifiedByThisOperation", "agencyApproved", "modelOutputAltered"]) {
    assert.ok(cpp.includes(s));
  }
  assert.match(cpp, /FileExists\(\*Target\)/);
  assert.match(cpp, /IsSha256\(Shot\.SourceSha256\)/);
});

test("storyboard schema enforces disclosure and per-shot provenance", () => {
  const schema = JSON.parse(readFileSync(path.join(repo,
    "schemas/native/tsm-evidence-storyboard.schema.json"), "utf8"));
  assert.equal(schema.properties.schema.const, "tsm.native.evidence-storyboard.v1");
  assert.equal(schema.properties.regulatoryDetermination.const, false);
  assert.equal(schema.properties.modelOutputAltered.const, false);
  assert.equal(schema.properties.shots.maxItems, 64);
  const shot = schema.properties.shots.items;
  assert.equal(shot.properties.sourceContentVerifiedByThisOperation.const, false);
  assert.equal(shot.properties.agencyApproved.const, false);
  assert.match(JSON.stringify(shot.allOf), /sourceSha256/);
});
