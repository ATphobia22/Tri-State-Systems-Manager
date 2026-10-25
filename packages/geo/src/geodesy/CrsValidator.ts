import { HorizontalDatum } from "./HorizontalDatum.js";
import { VerticalDatum } from "./VerticalDatum.js";
import { getEpsgCrs } from "./EpsgRegistry.js";
import type { CoordinateReference, ValidationResult } from "./CoordinateReference.js";
import { validateGeoidModel } from "./GeoidModel.js";

export function validateCoordinateReference(reference: CoordinateReference): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!reference || typeof reference !== "object") return { valid: false, errors: ["COORDINATE_REFERENCE_REQUIRED"], warnings };
  if (!reference.horizontalDatum || reference.horizontalDatum === HorizontalDatum.UNKNOWN) errors.push("HORIZONTAL_DATUM_REQUIRED");
  if (!reference.verticalDatum || reference.verticalDatum === VerticalDatum.UNKNOWN) errors.push("VERTICAL_DATUM_REQUIRED");
  if (!Number.isInteger(reference.epsg) || reference.epsg <= 0) {
    errors.push("EPSG_CODE_REQUIRED");
  } else {
    const crs = getEpsgCrs(reference.epsg);
    if (!crs) errors.push("UNSUPPORTED_EPSG_CODE:" + reference.epsg);
    else if (reference.horizontalDatum && reference.horizontalDatum !== HorizontalDatum.UNKNOWN && crs.horizontalDatum !== reference.horizontalDatum) errors.push("EPSG_HORIZONTAL_DATUM_MISMATCH:" + reference.epsg);
    if (crs?.suitability === "DISPLAY_ONLY") warnings.push("CRS_DISPLAY_ONLY:" + reference.epsg + "_NOT_FOR_METRIC_ENGINEERING_ANALYSIS");
  }
  if (reference.horizontalDatum === HorizontalDatum.NAD83_2011 && !reference.epoch) errors.push("COORDINATE_EPOCH_REQUIRED_FOR_NAD83_2011");
  if (reference.epoch !== undefined && (!Number.isFinite(Number(reference.epoch)) || Number(reference.epoch) < 1800 || Number(reference.epoch) > 2200)) errors.push("COORDINATE_EPOCH_INVALID");
  const geoid = validateGeoidModel(reference);
  errors.push(...geoid.errors);
  warnings.push(...geoid.warnings);
  return { valid: errors.length === 0, errors, warnings };
}
