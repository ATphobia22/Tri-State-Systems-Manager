import test from "node:test";
import assert from "node:assert/strict";
import {
  MTVI3_GAGE_ZERO_NAVD88,
  MTVI3_HISTORIC_1937_CREST_STAGE_FT,
  mtvi31937CrestWseNavd88,
  stageToWseFt,
} from "../../packages/geo/src/hydrology/GageDatumDiscipline.ts";
import { SIGNATURE_EXPERIENCES } from "../../tsm-console/src/experiences/signatureExperiences.ts";

test("MTVI3 published zero is 318.59 NAVD88", () => {
  assert.equal(MTVI3_GAGE_ZERO_NAVD88.gageZeroFt, 318.59);
  assert.equal(MTVI3_GAGE_ZERO_NAVD88.verticalDatum, "NAVD88");
});

test("1937 crest WSE is 377.80 NAVD88", () => {
  assert.equal(mtvi31937CrestWseNavd88(), 377.8);
  assert.equal(MTVI3_HISTORIC_1937_CREST_STAGE_FT + 318.59, 377.8);
});

test("wrong station zero is refused", () => {
  const r = stageToWseFt(
    { stationId: "03378500", stageFt: 20, stageDatum: "GAGE_DATUM", source: "test" },
    MTVI3_GAGE_ZERO_NAVD88
  );
  assert.equal(r.wseFt, null);
  assert.equal(r.authority, "GAGE_DATUM_ONLY");
});

test("three signature experiences registered", () => {
  assert.equal(SIGNATURE_EXPERIENCES.length, 3);
  assert.ok(SIGNATURE_EXPERIENCES.every((e) => e.sources.length >= 2));
});
