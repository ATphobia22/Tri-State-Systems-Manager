import { HorizontalDatum } from "./HorizontalDatum.js";
import { VerticalDatum } from "./VerticalDatum.js";
import type { CoordinateReference, ValidationResult } from "./CoordinateReference.js";

export interface GeoidModelDefinition {
  id: string;
  compatibleHorizontalDatum: HorizontalDatum;
  compatibleEpoch: string;
  supportedVerticalDatums: readonly VerticalDatum[];
  coverage: string;
  sourceUrl: string;
  limitations: readonly string[];
}
export const GEOID_MODELS: ReadonlyMap<string, GeoidModelDefinition> = new Map([
  ["GEOID18", {
    id: "GEOID18",
    compatibleHorizontalDatum: HorizontalDatum.NAD83_2011,
    compatibleEpoch: "2010.0",
    supportedVerticalDatums: [VerticalDatum.NAVD88],
    coverage: "CONUS, Puerto Rico and U.S. Virgin Islands; area-of-use must still be checked",
    sourceUrl: "https://www.ngs.noaa.gov/GEOID/GEOID18/geoid18_tech_details.shtml",
    limitations: [
      "Use with NAD83(2011) epoch 2010.0 ellipsoid heights only.",
      "Not compatible with WGS84, ITRF, or other NAD83 realizations without a separately documented frame transformation.",
      "GEOID18 is not a general solution for Alaska, Hawaii, Guam, or CNMI."
    ]
  }]
]);
export function validateGeoidModel(reference: CoordinateReference): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!reference.geoidModel) return { valid: true, errors, warnings };
  const model = GEOID_MODELS.get(reference.geoidModel);
  if (!model) return { valid: false, errors: ["UNSUPPORTED_GEOID_MODEL:" + reference.geoidModel], warnings };
  if (reference.horizontalDatum !== model.compatibleHorizontalDatum) errors.push(reference.geoidModel + "_HORIZONTAL_DATUM_INCOMPATIBLE");
  if (reference.epoch !== model.compatibleEpoch) errors.push(reference.geoidModel + "_EPOCH_MUST_BE_" + model.compatibleEpoch);
  if (!reference.verticalDatum || !model.supportedVerticalDatums.includes(reference.verticalDatum)) errors.push(reference.geoidModel + "_VERTICAL_DATUM_INCOMPATIBLE");
  if (!reference.transformationSourceUrl) errors.push("GEOID_MODEL_SOURCE_URL_REQUIRED");
  else {
    try {
      const source = new URL(reference.transformationSourceUrl);
      if (source.protocol !== "https:" || source.username || source.password) errors.push("GEOID_MODEL_SOURCE_URL_UNSAFE");
    } catch { errors.push("GEOID_MODEL_SOURCE_URL_INVALID"); }
  }
  return { valid: errors.length === 0, errors, warnings };
}
