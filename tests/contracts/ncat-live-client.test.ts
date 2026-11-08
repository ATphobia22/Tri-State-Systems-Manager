import test from "node:test";
import assert from "node:assert/strict";
import { ncatLlh, BONEBANK_LL, NCAT_BASE_URL } from "../../packages/geo/src/geodesy/NcatClient.ts";

test("NCAT base URL is official NGS host", () => {
  assert.match(NCAT_BASE_URL, /^https:\/\/geodesy\.noaa\.gov\/api\/ncat$/);
});

test("ncatLlh rejects non-finite coordinates without network", async () => {
  await assert.rejects(
    () => ncatLlh({ lat: Number.NaN, lon: -88, inDatum: "nad83(2011)", outDatum: "nad83(2011)" }),
    /NCAT_LAT_NOT_FINITE/
  );
});

test("ncatLlh live: Bonebank NAD83(2011) identity + Indiana West SPC zone", async (t) => {
  if (process.env.TSM_SKIP_LIVE_NCAT === "1") {
    t.skip("TSM_SKIP_LIVE_NCAT=1");
    return;
  }
  const result = await ncatLlh({ ...BONEBANK_LL });
  assert.equal(result.srcDatum.toUpperCase().includes("NAD83"), true);
  assert.equal(result.destDatum.toUpperCase().includes("NAD83"), true);
  assert.ok(result.spcZone && /IN\s*W|1302/i.test(result.spcZone), `expected IN West SPC, got ${result.spcZone}`);
  const lat = Number(result.destLat);
  const lon = Number(result.destLon);
  assert.ok(Math.abs(lat - BONEBANK_LL.lat) < 1e-5);
  assert.ok(Math.abs(lon - BONEBANK_LL.lon) < 1e-5);
});
