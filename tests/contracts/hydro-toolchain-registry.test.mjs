import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { listHydroToolchain, getHydroTool } from "../../packages/geo/src/hydraulics/HydroToolchainRegistry.ts";
import { invokeHecRasSolver, importHecRasResultSummary } from "../../packages/geo/src/hydraulics/HecRasIntegrationBoundary.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("JSON registry lists ras-commander and ras2fim", () => {
  const j = JSON.parse(
    readFileSync(join(root, "integrations/hydro/tsm-hydro-digital-twin-toolchain-registry-v1.json"), "utf8")
  );
  const ids = j.categories.hec_ras_automation.map((x) => x.id);
  assert.ok(ids.includes("gpt-cmdr-ras-commander"));
  assert.ok(ids.includes("noaa-owp-ras2fim"));
});

test("TS registry exposes adapter-ready tools", () => {
  assert.ok(listHydroToolchain().length >= 8);
  assert.equal(getHydroTool("ras-commander")?.status, "ADAPTER_READY");
  assert.equal(getHydroTool("maplibre")?.status, "INTEGRATED");
});

test("invokeHecRasSolver returns bridge guidance (enabled path)", () => {
  const r = invokeHecRasSolver({ projectId: "bonebank-demo" });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.mode, "BRIDGE_GUIDANCE");
});

test("import allows results; humanReviewed recorded", () => {
  const r = importHecRasResultSummary({
    projectId: "demo",
    profileName: "Q100",
    wseFt: 375.0,
    depthFt: 1.2,
    verticalDatumLabel: "NAVD88",
    importedAt: new Date().toISOString(),
    humanReviewed: true,
    toolChain: "ras-commander",
  });
  assert.equal(r.ok, true);
});
