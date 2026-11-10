import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { NATIVE_WORKSPACES, DEFAULT_LAYER_BROWSER, SHELL_SHORTCUTS } from "../../packages/geo/src/native/NativeShellContract.ts";
import { ENGINEERING_TOOLS, hecRasReadonlyPlaybackStatus, createScenarioDraft } from "../../packages/geo/src/native/EngineeringInteractionContract.ts";
import { CINEMATIC_PRESETS, buildDefaultCameraPath } from "../../packages/geo/src/native/CinematicProductionContract.ts";
import { defaultReleaseGates, summarizeReleaseGates } from "../../packages/geo/src/native/ReleaseValidationContract.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("Phase 1 six workspaces and shortcuts", () => {
  assert.equal(NATIVE_WORKSPACES.length, 6);
  assert.ok(SHELL_SHORTCUTS["mod+k"]);
  assert.ok(DEFAULT_LAYER_BROWSER.some((l) => l.authority === "REGULATORY"));
});

test("Phase 2 engineering tools and readonly RAS", () => {
  assert.ok(ENGINEERING_TOOLS.includes("hec_ras_playback_readonly"));
  assert.equal(hecRasReadonlyPlaybackStatus().canInvokeSolver, false);
  const s = createScenarioDraft("t", 377.2, 375);
  assert.equal(s.freeboardFt, 2.2);
});

test("Phase 3 cinema presets and camera path", () => {
  assert.ok(CINEMATIC_PRESETS.length >= 4);
  assert.equal(buildDefaultCameraPath().length, 3);
});

test("Phase 4 release gates not falsely ready", () => {
  const sum = summarizeReleaseGates(defaultReleaseGates());
  assert.equal(sum.readyForPublicClaim, false);
});

test("registry JSON has four phases", () => {
  const j = JSON.parse(
    readFileSync(join(root, "integrations/native/tsm-phase-1-4-priority-registry-v1.json"), "utf8")
  );
  assert.equal(j.phases.length, 4);
});
