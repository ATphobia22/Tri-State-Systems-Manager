import test from "node:test";
import assert from "node:assert/strict";
import {
  vdatumConvert,
  BONEBANK_VDATUM,
  VDATUM_CONVERT_URL,
} from "../../packages/geo/src/geodesy/VDatumClient.ts";

test("VDatum convert URL is official NOAA host", () => {
  assert.match(VDATUM_CONVERT_URL, /^https:\/\/vdatum\.noaa\.gov\/vdatumweb\/api\/convert$/);
});

test("vdatumConvert rejects non-finite coords without network", async () => {
  await assert.rejects(
    () => vdatumConvert({ s_x: Number.NaN, s_y: 37.8 }),
    /VDATUM_S_X_NOT_FINITE/
  );
});

test("vdatumConvert live: Bonebank NAVD88 identity under GEOID18", async (t) => {
  if (process.env.TSM_SKIP_LIVE_VDATUM === "1") {
    t.skip("TSM_SKIP_LIVE_VDATUM=1");
    return;
  }
  const result = await vdatumConvert({ ...BONEBANK_VDATUM });
  assert.equal(result.region, "CONTIGUOUS");
  assert.match(result.s_v_frame, /NAVD88/i);
  assert.match(result.t_v_frame, /NAVD88/i);
  const tz = Number(result.t_z);
  assert.ok(Number.isFinite(tz));
  assert.ok(Math.abs(tz - 0) < 1e-6);
});
