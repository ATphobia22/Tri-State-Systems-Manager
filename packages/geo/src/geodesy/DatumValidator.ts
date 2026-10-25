import type { CoordinateReference, ValidationResult } from "./CoordinateReference.js";
import { validateCoordinateReference } from "./CrsValidator.js";
import { VerticalDatum } from "./VerticalDatum.js";
export function validateDatumReference(reference: CoordinateReference): ValidationResult {
  const result = validateCoordinateReference(reference);
  const warnings = [...result.warnings];
  if (reference?.verticalDatum === VerticalDatum.ELLIPSOID && reference.geoidModel) warnings.push("ELLIPSOIDAL_HEIGHT_IS_NOT_ORTHOMETRIC_HEIGHT");
  return { valid: result.errors.length === 0, errors: [...result.errors], warnings };
}
