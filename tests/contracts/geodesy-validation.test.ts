import test from "node:test";
import assert from "node:assert/strict";
import { HorizontalDatum, VerticalDatum, validateCoordinateReference, validateElevation, convertLinear, stageToElevation } from "../../packages/geo/src/geodesy/index.ts";

test("NAD83 plus NAVD88 is valid with a supported horizontal CRS", () => {
  const result = validateCoordinateReference({ epsg: 26916, horizontalDatum: HorizontalDatum.NAD83, verticalDatum: VerticalDatum.NAVD88 });
  assert.equal(result.valid, true);
});
test("WGS84 horizontal CRS can carry an independently declared orthometric vertical datum", () => {
  const result = validateCoordinateReference({ epsg: 4326, horizontalDatum: HorizontalDatum.WGS84, verticalDatum: VerticalDatum.NAVD88 });
  assert.equal(result.valid, true);
});
test("missing vertical datum is a validation error", () => {
  const result = validateCoordinateReference({ epsg: 26916, horizontalDatum: HorizontalDatum.NAD83, verticalDatum: null });
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("VERTICAL_DATUM_REQUIRED"));
});
test("unsupported EPSG identifiers are rejected rather than guessed", () => {
  const result = validateCoordinateReference({ epsg: 999999, horizontalDatum: HorizontalDatum.NAD83, verticalDatum: VerticalDatum.NAVD88 });
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("UNSUPPORTED_EPSG_CODE:999999"));
});
test("GEOID18 requires its published NAD83(2011) epoch and vertical-datum relationship", () => {
  const valid = validateCoordinateReference({
    epsg: 6318, horizontalDatum: HorizontalDatum.NAD83_2011, verticalDatum: VerticalDatum.NAVD88,
    geoidModel: "GEOID18", epoch: "2010.0",
    transformationSourceUrl: "https://www.ngs.noaa.gov/GEOID/GEOID18/geoid18_tech_details.shtml"
  });
  assert.equal(valid.valid, true);
  const incompatible = validateCoordinateReference({
    epsg: 4326, horizontalDatum: HorizontalDatum.WGS84, verticalDatum: VerticalDatum.NAVD88,
    geoidModel: "GEOID18", epoch: "2010.0",
    transformationSourceUrl: "https://www.ngs.noaa.gov/GEOID/GEOID18/geoid18_tech_details.shtml"
  });
  assert.equal(incompatible.valid, false);
});
test("ellipsoidal GPS height cannot be labelled as NAVD88 without sourced transformation evidence", () => {
  const result = validateElevation({
    value: 100, units: "m", sourceId: "gnss-observation-1", heightType: "ELLIPSOIDAL",
    reference: { epsg: 4326, horizontalDatum: HorizontalDatum.WGS84, verticalDatum: VerticalDatum.NAVD88 }
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("GPS_HEIGHT_AS_NAVD88"));
  const operationIdOnly = validateElevation({
    value: 100, units: "m", sourceId: "gnss-observation-3", heightType: "ELLIPSOIDAL",
    reference: { epsg: 4326, horizontalDatum: HorizontalDatum.WGS84, verticalDatum: VerticalDatum.NAVD88, transformationOperationId: "claimed-but-not-applied" }
  });
  assert.equal(operationIdOnly.valid, false, "provenance metadata alone must not relabel an unchanged ellipsoidal measurement");
});
test("ellipsoidal height remains distinct from orthometric elevation", () => {
  const result = validateElevation({
    value: 100, units: "m", sourceId: "gnss-observation-2", heightType: "ELLIPSOIDAL",
    reference: { epsg: 4979, horizontalDatum: HorizontalDatum.WGS84, verticalDatum: VerticalDatum.ELLIPSOID }
  });
  assert.equal(result.valid, true);
});
test("gage stage cannot pass as an elevation value", () => {
  const result = validateElevation({
    value: 12, units: "ft", sourceId: "gage-1", heightType: "GAGE_STAGE",
    reference: { epsg: 26916, horizontalDatum: HorizontalDatum.NAD83, verticalDatum: VerticalDatum.GAGE_DATUM }
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("GAGE_STAGE_IS_NOT_ELEVATION"));
});
test("international feet and U.S. survey feet are distinct units", () => {
  assert.ok(Math.abs(convertLinear(1, "ft", "m") - 0.3048) < 1e-12);
  assert.ok(Math.abs(convertLinear(1, "ftUS", "m") - 1200 / 3937) < 1e-12);
  assert.notEqual(convertLinear(1, "ft", "m"), convertLinear(1, "ftUS", "m"));
  assert.throws(() => convertLinear(Number.NaN, "m", "ft"), /FINITE/);
});
test("gage stage conversion requires matching station, local zero, and surveyed target datum", () => {
  const measurement = { stage: 10, units: "ft" as const, stationId: "03378500", gageDatumId: "zero-1", observedAt: "2026-10-25T00:00:00Z", sourceUrl: "https://water.example.gov/obs" };
  const survey = {
    stationId: "03378500", gageDatumId: "zero-1", gageZeroElevation: 350, units: "ft" as const,
    reference: { epsg: 26916, horizontalDatum: HorizontalDatum.NAD83, verticalDatum: VerticalDatum.NAVD88 },
    surveyId: "survey-1", surveyedAt: "2026-10-01", sourceUrl: "https://water.example.gov/survey"
  };
  const result = stageToElevation(measurement, survey);
  assert.equal(result.valid, true);
  assert.equal(result.elevation?.value, 360);
  assert.equal(result.elevation?.reference.verticalDatum, VerticalDatum.NAVD88);
  assert.equal(stageToElevation(measurement, { ...survey, gageDatumId: "other-zero" }).valid, false);
});
