import { describe, expect, it } from "vitest";
import { createMapillaryEvidenceRecord } from "../src/integrations/mapillary/evidence";

describe("Mapillary evidence boundary", () => {
  it("marks street imagery as observational and human-review-required", () => {
    const record = createMapillaryEvidenceRecord("abc_123", "https://www.mapillary.com/app/?pKey=abc_123");
    expect(record.authority).toBe("observational_reference");
    expect(record.humanReviewRequired).toBe(true);
  });

  it("rejects non-HTTPS sources", () => {
    expect(() => createMapillaryEvidenceRecord("abc_123", "http://example.test/image")).toThrow();
  });
});
