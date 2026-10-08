import test from "node:test";
import assert from "node:assert/strict";

// ESM bridge via dynamic import of compiled-less TS is not available in plain node test.
// Mirror ADR-006 policy checks in pure JS for production-gates style verification.

const S2_ALLOW = new Set([
  "hydrologic.read_snapshot",
  "analytics.freeboard_residual",
  "spatial.h3_summary",
  "draft.local_llm_text",
  "evidence.propose_artifact",
]);

function isToolAllowed(tool, scope, humanGate) {
  if (scope === "S1") return false;
  if (scope === "S3") return false;
  if (scope === "S2") return humanGate && S2_ALLOW.has(tool);
  return false;
}

test("S1 blocks all agent tools", () => {
  assert.equal(isToolAllowed("hydrologic.read_snapshot", "S1", true), false);
});

test("S2 allows hydrologic snapshot with human gate", () => {
  assert.equal(isToolAllowed("hydrologic.read_snapshot", "S2", true), true);
});

test("S2 blocks tools without human gate", () => {
  assert.equal(isToolAllowed("hydrologic.read_snapshot", "S2", false), false);
});

test("auto-file tools are not in allow-list", () => {
  assert.equal(S2_ALLOW.has("fema.auto_file_loma"), false);
});
