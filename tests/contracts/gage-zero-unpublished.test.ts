import test from "node:test";
import assert from "node:assert/strict";
import {
  GAGE_DATUM_TABLE,
  convertGageHeightToNavd88,
} from "../../tsm-console/src/lib/gage-datums.ts";

test("no gage publishes NAVD88 conversion without explicit conversionPublished", () => {
  for (const [id, rec] of Object.entries(GAGE_DATUM_TABLE)) {
    if (rec.conversionPublished) {
      assert.notEqual(
        rec.gageZeroNavd88Ft,
        null,
        `${id}: published conversion requires non-null gageZeroNavd88Ft`
      );
    } else {
      const result = convertGageHeightToNavd88(id, 10);
      assert.equal(result.conversionApplied, false, `${id} must not convert`);
      assert.equal(result.wseNavd88Ft, null, `${id} must not emit WSE`);
      assert.equal(result.verticalReference, "GAGE_DATUM");
    }
  }
});

test("03378500 retains candidate zero but conversionPublished stays false", () => {
  const rec = GAGE_DATUM_TABLE["03378500"];
  assert.equal(rec.conversionPublished, false);
  assert.equal(typeof rec.gageZeroNavd88Ft, "number");
  const result = convertGageHeightToNavd88("03378500", 5);
  assert.equal(result.conversionApplied, false);
  assert.match(result.disclaimer, /no validated|not/i);
});
