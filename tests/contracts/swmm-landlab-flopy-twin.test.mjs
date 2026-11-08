import test from "node:test";
import assert from "node:assert/strict";
import { getHydroTool, listHydroToolchain } from "../../packages/geo/src/hydraulics/HydroToolchainRegistry.ts";
import { listDigitalTwinStack, getTwinComponent } from "../../packages/geo/src/twin/DigitalTwinStackRegistry.ts";

test("SWMM Landlab FloPy registered as ADAPTER_READY", () => {
  assert.equal(getHydroTool("epa-swmm")?.status, "ADAPTER_READY");
  assert.equal(getHydroTool("landlab")?.status, "ADAPTER_READY");
  assert.equal(getHydroTool("flopy")?.status, "ADAPTER_READY");
  assert.ok(listHydroToolchain().length >= 14);
});

test("digital twin stack includes MapLibre integrated and Cesium partial", () => {
  assert.equal(getTwinComponent("maplibre")?.status, "INTEGRATED");
  assert.equal(getTwinComponent("cesium")?.status, "PARTIAL");
  assert.equal(getTwinComponent("eclipse-ditto")?.status, "ADAPTER_READY");
  assert.ok(listDigitalTwinStack().length >= 8);
});
