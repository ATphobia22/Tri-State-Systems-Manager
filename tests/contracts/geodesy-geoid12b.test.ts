import test from "node:test";
import assert from "node:assert/strict";
import { HorizontalDatum, VerticalDatum, validateCoordinateReference, GEOID_MODELS } from "../../packages/geo/src/geodesy/index.ts";

const GEOID12B_URL = "https://www.ngs.noaa.gov/GEOID/GEOID12B/g2012Brme.txt";

test("GEOID12B entry mirrors the GEOID18 frame/epoch/vertical-datum relationship", () => {
  const model = GEOID_MODELS.get("GEOID12B");
  assert.ok(model, "GEOID12B must be registered");
  assert.equal(model.compatibleHorizontalDatum, HorizontalDatum.NAD83_2011);
  assert.equal(model.compatibleEpoch, "2010.0");
  assert.deepEqual([...model.supportedVerticalDatums], [VerticalDatum.NAVD88]);
  assert.equal(model.sourceUrl, GEOID12B_URL);
  assert.ok(model.limitations.length > 0);
});

test("valid GEOID12B reference passes (NAVD88/GEOID12B, as in the 2020 Indiana DEM)", () => {
  const result = validateCoordinateReference({
    epsg: 6318, horizontalDatum: HorizontalDatum.NAD83_2011, verticalDatum: VerticalDatum.NAVD88,
    geoidModel: "GEOID12B", epoch: "2010.0",
    transformationSourceUrl: GEOID12B_URL,
  });
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test("GEOID12B reference fails with the wrong epoch or horizontal datum", () => {
  const wrongEpoch = validateCoordinateReference({
    epsg: 6318, horizontalDatum: HorizontalDatum.NAD83_2011, verticalDatum: VerticalDatum.NAVD88,
    geoidModel: "GEOID12B", epoch: "2007.0",
    transformationSourceUrl: GEOID12B_URL,
  });
  assert.equal(wrongEpoch.valid, false);
  assert.ok(wrongEpoch.errors.some((e) => e.includes("GEOID12B_EPOCH_MUST_BE_2010.0")));

  const wrongDatum = validateCoordinateReference({
    epsg: 4326, horizontalDatum: HorizontalDatum.WGS84, verticalDatum: VerticalDatum.NAVD88,
    geoidModel: "GEOID12B", epoch: "2010.0",
    transformationSourceUrl: GEOID12B_URL,
  });
  assert.equal(wrongDatum.valid, false);
  assert.ok(wrongDatum.errors.some((e) => e.includes("GEOID12B_HORIZONTAL_DATUM_INCOMPATIBLE")));
});

test("unknown geoid model still fails", () => {
  const result = validateCoordinateReference({
    epsg: 6318, horizontalDatum: HorizontalDatum.NAD83_2011, verticalDatum: VerticalDatum.NAVD88,
    geoidModel: "GEOID99", epoch: "2010.0",
    transformationSourceUrl: GEOID12B_URL,
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("UNSUPPORTED_GEOID_MODEL:GEOID99"));
});

test("GEOID18 behaviour is unchanged by the GEOID12B addition", () => {
  const valid = validateCoordinateReference({
    epsg: 6318, horizontalDatum: HorizontalDatum.NAD83_2011, verticalDatum: VerticalDatum.NAVD88,
    geoidModel: "GEOID18", epoch: "2010.0",
    transformationSourceUrl: "https://www.ngs.noaa.gov/GEOID/GEOID18/geoid18_tech_details.shtml",
  });
  assert.equal(valid.valid, true);
  const incompatible = validateCoordinateReference({
    epsg: 4326, horizontalDatum: HorizontalDatum.WGS84, verticalDatum: VerticalDatum.NAVD88,
    geoidModel: "GEOID18", epoch: "2010.0",
    transformationSourceUrl: "https://www.ngs.noaa.gov/GEOID/GEOID18/geoid18_tech_details.shtml",
  });
  assert.equal(incompatible.valid, false);
});
