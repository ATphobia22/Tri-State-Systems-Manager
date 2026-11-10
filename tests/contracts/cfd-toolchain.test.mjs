import test from "node:test";
import assert from "node:assert/strict";
import { listCfdToolchain } from "../../packages/geo/src/cfd/CfdToolchainRegistry.ts";
import { sdfSphere, sdfWaterSurface } from "../../packages/geo/src/cfd/SdfGeometry.ts";

test("CFD toolchain lists sdf fenicsx openfoam simscale", () => {
  const ids = listCfdToolchain().map((t) => t.id);
  for (const id of ["sdf", "fenicsx", "openfoam", "simscale"]) {
    assert.ok(ids.includes(id), id);
  }
});

test("SDF sphere and water surface signs", () => {
  const c = { x: 0, y: 0, z: 0 };
  assert.ok(sdfSphere({ x: 0, y: 0, z: 0 }, c, 1) < 0);
  assert.ok(sdfSphere({ x: 3, y: 0, z: 0 }, c, 1) > 0);
  assert.ok(sdfWaterSurface({ x: 0, y: 0, z: 10 }, 12) < 0);
});
