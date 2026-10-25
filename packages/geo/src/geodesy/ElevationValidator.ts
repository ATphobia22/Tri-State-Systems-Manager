import type { CoordinateReference, ValidationResult } from "./CoordinateReference.js";
import type { LinearUnit } from "./UnitRegistry.js";
import { validateCoordinateReference } from "./CrsValidator.js";
import { VerticalDatum, type HeightType } from "./VerticalDatum.js";

export interface ElevationValue {
  value: number;
  units: LinearUnit;
  reference: CoordinateReference;
  sourceId: string;
  heightType: HeightType;
}
export function validateElevation(elevation: ElevationValue): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!elevation || typeof elevation !== "object") return { valid: false, errors: ["ELEVATION_VALUE_REQUIRED"], warnings };
  if (!Number.isFinite(elevation.value)) errors.push("ELEVATION_MUST_BE_FINITE");
  if (!elevation.sourceId?.trim()) errors.push("ELEVATION_SOURCE_ID_REQUIRED");
  if (!elevation.units) errors.push("ELEVATION_UNIT_REQUIRED");
  if (!elevation.heightType) errors.push("HEIGHT_TYPE_REQUIRED");
  const referenceResult = validateCoordinateReference(elevation.reference);
  errors.push(...referenceResult.errors);
  warnings.push(...referenceResult.warnings);
  const verticalDatum = elevation.reference?.verticalDatum;
  if (elevation.heightType === "GAGE_STAGE") errors.push("GAGE_STAGE_IS_NOT_ELEVATION");
  if (elevation.heightType === "ELLIPSOIDAL") {
    if (verticalDatum !== VerticalDatum.ELLIPSOID && !elevation.reference?.transformationOperationId) errors.push("GPS_HEIGHT_AS_ORTHOMETRIC_WITHOUT_TRANSFORMATION");
    if (verticalDatum === VerticalDatum.NAVD88 && !elevation.reference?.transformationOperationId) errors.push("GPS_HEIGHT_AS_NAVD88");
  }
  if (elevation.heightType === "ORTHOMETRIC" && verticalDatum === VerticalDatum.ELLIPSOID) errors.push("ORTHOMETRIC_HEIGHT_REQUIRES_VERTICAL_DATUM");
  if (elevation.heightType === "TIDAL" && verticalDatum !== VerticalDatum.MLLW && verticalDatum !== VerticalDatum.MHW) errors.push("TIDAL_HEIGHT_REQUIRES_TIDAL_VERTICAL_DATUM");
  if (elevation.heightType === "ORTHOMETRIC" && verticalDatum === VerticalDatum.GAGE_DATUM) errors.push("GAGE_STAGE_REQUIRES_SURVEYED_GAGE_ZERO_CONVERSION");
  return { valid: errors.length === 0, errors: [...new Set(errors)], warnings };
}
