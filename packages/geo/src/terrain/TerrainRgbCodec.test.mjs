import test from "node:test";
import assert from "node:assert/strict";
import {
  decodeTerrariumMeters,
  encodeTerrariumMeters,
  decodeMapboxTerrainRgbMeters,
  encodeMapboxTerrainRgbMeters,
  sampleDerivedElevationFt,
  metersToFeet,
} from "./TerrainRgbCodec.ts";

test("Terrarium encode/decode near Bonebank orthometric scale", () => {
  // ~115 m ≈ 377 ft screening
  const h = 115.0;
  const { r, g, b } = encodeTerrariumMeters(h);
  const back = decodeTerrariumMeters(r, g, b);
  assert.ok(Math.abs(back - h) < 0.01, String(back));
});

test("Mapbox Terrain-RGB encode/decode", () => {
  const h = 100;
  const { r, g, b } = encodeMapboxTerrainRgbMeters(h);
  const back = decodeMapboxTerrainRgbMeters(r, g, b);
  assert.ok(Math.abs(back - h) < 0.15, String(back));
});

test("sample is DERIVED feet", () => {
  const s = sampleDerivedElevationFt(100);
  assert.equal(s.authority, "DERIVED");
  assert.ok(Math.abs(s.elevationFt - metersToFeet(100)) < 1e-6);
});
