import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getTwinComponent, listDigitalTwinStack } from "../../packages/geo/src/twin/DigitalTwinStackRegistry.ts";
import { buildBonebankCesiumConfig, cesiumStatus } from "../../packages/geo/src/twin/CesiumIntegration.ts";
import { probeDittoConfig } from "../../integrations/twin/ditto/ditto-adapter.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("twin stack upgrades PyGMT 3dfier HydroPol Ditto DTDL to ADAPTER_READY", () => {
  for (const id of ["pygmt", "3dfier", "hydropol2d", "eclipse-ditto", "dtdl"]) {
    assert.equal(getTwinComponent(id)?.status, "ADAPTER_READY", id);
  }
  assert.equal(getTwinComponent("cesium")?.status, "PARTIAL");
  assert.ok(listDigitalTwinStack().length >= 10);
});

test("Cesium bonebank config defaults to site pin", () => {
  const c = buildBonebankCesiumConfig();
  assert.equal(c.latitude, 37.84589);
  assert.equal(cesiumStatus().status, "PARTIAL");
});

test("DTDL bonebank interface is valid JSON with freeboard telemetry", () => {
  const dtdl = JSON.parse(
    readFileSync(join(root, "integrations/twin/dtdl/bonebank-site.dtdl.json"), "utf8")
  );
  assert.equal(dtdl["@type"], "Interface");
  const names = dtdl.contents.map((c) => c.name);
  assert.ok(names.includes("freeboardFt"));
  assert.ok(names.includes("modeledBfeFt"));
});

test("Ditto probe reads env", () => {
  const p = probeDittoConfig({});
  assert.equal(p.configured, false);
  assert.equal(p.authority, "PRESENTATION");
});
